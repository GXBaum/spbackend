import {scrapeVpData} from "./scrapeVp.js";
import {sendNotificationToUser} from "./notifications.js";
import {buildDeeplink} from "../utils/deepLinkBuilder.js";
import {CHANNEL_NAMES} from "../config/constants.js";
import {aiService} from "./aiService.js";
import {createDefaultUserRepository} from "../db/repositories/userRepository.js";
import {createDefaultVpRepository} from "../db/repositories/vpRepository.js";

export async function vpCheckForDifferences(
    day,
    {
        vpRepo = createDefaultVpRepository(),
        userRepo = createDefaultUserRepository(),
        scraper = scrapeVpData,
        notifier = sendNotificationToUser,
        deepLinkBuilder = buildDeeplink,
        channelNames = CHANNEL_NAMES
    } = {}
) {
    const stringDay = day === 1 ? "today" : day === 2 ? "tomorrow" : null;
    if (!stringDay) {
        console.warn("Invalid day argument:", day);
        return;
    }

    const url = `https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/${day}/vp.html`;
    const data = await scraper(url);

    const oldRawData = vpRepo.getPlanHtml(stringDay);
    if (oldRawData === data.rawPage) {
        console.log("no changes");
        return;
    }

    console.log("changes detected");
    vpRepo.upsertPlanHtml(stringDay, data.rawPage);
    vpRepo.insertRawHistory(stringDay, data.rawPage);

    // AI vp info extraction, non-blocking
    console.log("ai test");
    const oldVpInfo = vpRepo.getLatestVpInfo(stringDay);
    console.log("oldSummary: ", oldVpInfo);


    const systemPrompt = `Du bist ein deutscher Extraktions-Assistent für den Vertretungsplan einer Schule. Oben stehen, falls es welche gibt, besondere Infos. Sei intelligent und suche diese raus. Die 3 Tabellen für fehlende Lehrer, Klassen und Räume sind normal und zählen nicht dazu. Ebenfalls gehören die normalen max. 2 Tabellen für Vertretungen und Ersatzräume ebenfalls nicht dazu. Nur besondere Infos. Folgende Beispiele gehören nicht dazu: "In Arbeit" oder "Vertretungsplan für <Datum>", sowie der Name der Schule. Generell: nur Sachen die wirklich wichtig sind, da Nutzer Benachrichtigt werden. Fehlende Lehrer etc sind irrelevant, nur etwas was nicht immer da steht. Antworte nur damit, mit nichts anderem. Benutz alle normale deutsche Zeichen, also auch ß,ü etc, falls angemessen. Eins ist der normale text, so wie er im Plan steht. schreib auch in summary eine kürzere version, welche ungefähr max. 15 Wörter sein soll. Die Summary kann auch formatiert sein. Wichtige Infos sollten drinne stehen, es sei den der Platz reicht nicht, dann such nach wichtigkeit aus, und gib den rest nur ungefähr an. der normale soll aber original (aber sinnvoll) bleiben.
    Du erhältst deine vorherigen extrahierten Infos. Wenn die alten Daten noch korrekt sind, setze es null. Falls es jetzt keine Infos mehr gibt, weil der Vertretungsplan jetzt anders oder neu ist, gibt bei beidem einen leeren String zurück.
    Gib ausschließlich gültiges JSON zurück (kein Text, keine Erklärungen).
    Schema:
    {
    "text": string | null,
    "summary": string | null,
    }
    
    `;

    const prompt = `Vertretungsplan:\n${data.rawPage}\n\nDeine alte spezielle Info, die du vorher extrahiert hast:${oldVpInfo?.data || "(keine vorhanden)"}\nDeine alte Zusammenfassung: ${oldVpInfo?.summary || "(keine vorhanden)"}`;


    aiService(systemPrompt, prompt)
        .then((completion) => {
            console.log("completion: " + JSON.stringify(completion));
            const rawContent = completion.choices?.[0]?.message?.content
            const contentJson = JSON.parse(rawContent)

            if (contentJson.text === "null" || contentJson.text === null) {
                console.log("no changes to ai info");
            } else if (contentJson.text === "") {
                console.log("no ai info")
                vpRepo.insertVpInfo(stringDay, null, null);
            } else {
                console.log("inserting new info: " + contentJson.text + ", summary: " + contentJson.summary);
                vpRepo.insertVpInfo(stringDay, contentJson.text, contentJson.summary);

                const users = userRepo.getUsersWithEnabledNotifications();
                console.log(`users ${JSON.stringify(users)}`);
                console.log("notifying users for info");

                // TODO: uncomment
                // FIXME: UNCOMMENT
                users.forEach((user) => {
                    notifier(user.id, `VP Info am ${stringDay === "today" ? "heutigen" : "nächsten"} Schultag`, contentJson.summary,
                        {
                            channel_id: channelNames.CHANNEL_VP_UPDATES,
                            notification_id: day
                        })
                })

                //notifier(1, `[TEST] VP Info am ${stringDay === "today" ? "heutigen" : "nächsten"} Schultag`, contentJson.summary)

            }
        })
        .catch(error => {
            console.error('Error in AI VP info extraction:', error);
        });


    const changedCourses = await processSubstitutions(data, stringDay, true, vpRepo);
    console.log("changedCourses ", changedCourses);
    await notifyUsers(
        changedCourses,
        day,
        stringDay,
        data.websiteDate,
        true,
        vpRepo,
        notifier,
        deepLinkBuilder,
        channelNames,
    );


    // TODO: ... yes. yes, i am (now slightly less) ashamed.
    const changedDifferentRoomsCourses = await processSubstitutions(data, stringDay, false, vpRepo);
    await notifyUsers(
        changedDifferentRoomsCourses,
        day,
        stringDay,
        data.websiteDate,
        false,
        vpRepo,
        notifier,
        deepLinkBuilder,
        channelNames
    );

}

export function isNewSubstitution(oldData, substitution, websiteDate) {
    return !oldData || !oldData.some(oldSub =>
        oldSub.hour === substitution.hour &&
        oldSub.original === substitution.original &&
        oldSub.replacement === substitution.replacement &&
        oldSub.description === substitution.description &&
        oldSub.vp_date === websiteDate
    );
}

export function isDeletedSubstitution(newData, oldSubstitution, websiteDate) {
    // newData is the array from scraper (doesn't have vp_date); oldSubstitution is a DB row (has vp_date)
    // We treat a DB row as deleted if there is no exact match in newData (exact fields compared).
    if (!Array.isArray(newData) || newData.length === 0) return true;

    return !newData.some(n =>
            n.hour === oldSubstitution.hour &&
            n.original === oldSubstitution.original &&
            n.replacement === oldSubstitution.replacement &&
            n.description === oldSubstitution.description
        // we do NOT compare vp_date against n because newData items come without vp_date;
        // scope is controlled when fetching oldSubstitutions via listAllSubstitutionsForDay(day, websiteDate)
    );
}

export async function processSubstitutions(data, stringDay, isSubstitution, vpRepo) {
    const siteDate = data.websiteDate;

    const oldItems = isSubstitution
        ? vpRepo.listAllSubstitutionsForDay(stringDay, siteDate) || []
        : vpRepo.listAllDifferentRoomsForDay(stringDay, siteDate) || [];

    const newItems = isSubstitution
        ? Array.isArray(data.substitutions) ? data.substitutions : []
        : Array.isArray(data.differentRooms) ? data.differentRooms : [];

    const coursesWithUpdates = new Set();

    // TODO: add transactions
    for (const oldItem of oldItems) {
        if (isDeletedSubstitution(newItems, oldItem, siteDate)) {
            console.log("DELETING:", JSON.stringify(oldItem));

            let deleted;
            if (isSubstitution) {
                deleted = vpRepo.markSubstitutionAsDeleted({
                    course: oldItem.course,
                    day: stringDay,
                    hour: oldItem.hour ?? null,
                    original: oldItem.original ?? null,
                    replacement: oldItem.replacement ?? null,
                    description: oldItem.description ?? null,
                    vp_date: oldItem.vp_date
                });
            } else {
                deleted = vpRepo.markDifferentRoomAsDeleted({
                    course: oldItem.course,
                    day: stringDay,
                    hour: oldItem.hour ?? null,
                    original: oldItem.original ?? null,
                    replacement: oldItem.replacement ?? null,
                    description: oldItem.description ?? null,
                    vp_date: oldItem.vp_date
                });
            }

            console.log("markAsDeleted returned:", deleted);
            if (deleted && oldItem.course) coursesWithUpdates.add(oldItem.course);
        }
    }

    // TODO: add transactions
    // insert new rows
    for (const row of newItems) {
        if (!isNewSubstitution(oldItems, row, siteDate)) {
            continue;
        }

        if (isSubstitution) {
            vpRepo.insertSubstitution({
                course: row.course,
                day: stringDay,
                hour: row.hour ?? null,
                original: row.original ?? null,
                replacement: row.replacement ?? null,
                description: row.description ?? null,
                vp_date: siteDate
            });
        } else {
            vpRepo.insertDifferentRoom({
                course: row.course,
                day: stringDay,
                hour: row.hour ?? null,
                original: row.original ?? null,
                replacement: row.replacement ?? null,
                description: row.description ?? null,
                vp_date: siteDate
            });
        }

        if (row.course) coursesWithUpdates.add(row.course);
    }
    console.log("changed substitutions: " + Array.from(coursesWithUpdates));
    return Array.from(coursesWithUpdates);
}


export function formatSubstitutionsMessage(substitutions) {
    return substitutions.map(substitution =>
        `${substitution.hour}: ${substitution.original || "—"} → ${substitution.replacement || "—"}${substitution.description ? ` (${substitution.description})` : ""}`
    ).join('\n');
}

// TODO: implement something like this but this doesnt work
export function formatSubstitutionsMessageCombine(substitutions) {
    let oldSub = "";
    let texts = [];
    substitutions.forEach((sub, index) => {
        if (
            oldSub.hour === sub.hour - 1 &&
            oldSub.original === sub.original &&
            oldSub.replacement === sub.replacement &&
            oldSub.description === sub.description) {
            texts[index - 1] = `${sub.hour - 1}/${sub.hour}: ${sub.original || "—"} → ${sub.replacement || "—"}${sub.description ? ` (${sub.description})` : ""}`
        } else {
            texts.push(
                `${sub.hour}: ${sub.original || "—"} → ${sub.replacement || "—"}${sub.description ? ` (${sub.description})` : ""}`
            )
        }
        oldSub = sub;
    })
    return texts.join('\n');
}

export async function notifyUsers(
    changedCourses,
    day,
    stringDay,
    websiteDate,
    isSubstitution,
    vpRepo,
    notifier,
    deepLinkBuilder,
    channelNames
) {
    for (const course of changedCourses) {
        const users = vpRepo.getUsersWithVPCourseName(course);
        console.log(`users: ${JSON.stringify(users)}`);

        const items = isSubstitution
            ? vpRepo.listSubstitutions(course, stringDay, websiteDate)
            : vpRepo.listDifferentRooms(course, stringDay, websiteDate);

        if (items.length === 0) continue;

        const message = formatSubstitutionsMessage(items);
        const title = `${course}: ${isSubstitution ? "Vertretung" : "Ersatzräume"} am ${stringDay === "today" ? "heutigen" : "nächsten"} Schultag`;
        const uri = deepLinkBuilder("vpScreen", {"course": course});

        const notificationId = items[0].course_id * 100 + day * 10 + (isSubstitution ? 1 : 2)

        for (const {user_id} of users) {
            // TODO UNCOMMENT NOW
            // FIXME UNCOMMENT NOW
            await notifier(user_id, title, message, {
                deepLink: uri,
                channel_id: channelNames.CHANNEL_VP_UPDATES,
                notification_id: notificationId
            });
        }

        /*await notifier(1, "[TEST] " + title, message, {
            deepLink: uri,
            channel_id: channelNames.CHANNEL_VP_UPDATES,
            notification_id: notificationId
        });*/

        /*if (Array.isArray(users) && users.some(u => u.user_id === 1)) {
            await notifier(1, "[TEST] " + title, message, {
                deepLink: uri,
                channel_id: channelNames.CHANNEL_VP_UPDATES,
                notification_id: notificationId
            });
        }*/

    }
}
