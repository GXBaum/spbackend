import axios from "axios";
import {prisma} from "../db/prisma.js";
import {Day, VpType} from "../generated/prisma/enums.js";
import type {MulticastMessage} from "firebase-admin/messaging";
import {messaging} from "../firebase.js";
import {parseVpHtml, type VpData} from "./vpScraperParser.js";
import type {VpSubstitution} from "../generated/prisma/client.js";

interface substitutionForSetKey {
    courseName: string,
    hour: string | null,
    original: string | null,
    replacement: string | null,
    description: string | null
}

function generateSetKey(sub: substitutionForSetKey) {
    return `${sub.courseName} ~~~~~~~~|o|~~HELP~~~~ ${sub.hour ?? ""} | ${sub.original ?? ""} | ${sub.replacement ?? ""} | ${sub.description ?? ""}`
}

function findDeletedSubstitutions(oldSubs: VpSubstitution[], newSubs: substitutionForSetKey[]): VpSubstitution[] {
    const newSubsSet = new Set(newSubs.map(sub => (generateSetKey(sub))));

    return oldSubs.filter(sub => !newSubsSet.has(generateSetKey(sub)))
}

// TODO: maybe replace with prisma .createManyAndReturn instead of this?
function findNewSubstitutions(oldSubs: VpSubstitution[], newSubs: substitutionForSetKey[]): substitutionForSetKey[] {
    const oldSubsSet = new Set(oldSubs.map(sub => (generateSetKey(sub))));

    return newSubs.filter(sub => !oldSubsSet.has(generateSetKey(sub)))
}

export async function scrapeVp(day: Day) {
    const dayNumber = day === Day.today ? 1 : 2;
    const url = `https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/${dayNumber}/vp.html`;
    const data = await scrapeVpData(url);

    const oldData = await prisma.vpRawLog.findFirst({
        where: {
            day: day,
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    if (data.rawPage === oldData?.data) {
        console.log(`no changes for ${day}`);
        return
    }
    console.log(`changes for ${day}`);

    // TODO: Yes — there are real miss cases in this setup. The biggest one is:
    //
    // • You write vpRawLog before finishing DB update + notifications.
    // If anything fails after that (Firebase error, DB error, process crash), the next run sees “same HTML” and returns early, so that update is never retried and users can miss the notification.
    //
    // There’s also a logic gap for course notifications:
    //
    // • updatedCourses is built only from newSubstitutions.
    // If a course only has removals (no new rows), that course won’t be in updatedCourses, so subscribers won’t get notified about that change.
    //
    // So: yes, updates can be missed for notifications in the current flow.

    await prisma.vpRawLog.create({
        data: {
            data: data.rawPage,
            day: day
        }
    });


    const allCourseNames = [...data.differentRooms, ...data.substitutions].map(item => ({
        name: item.course
    }));

    await prisma.vpCourse.createMany({
        data: allCourseNames,
        skipDuplicates: true
    });

    const lastInfo = await prisma.vpInfo.findFirst({
        where: {
            targetDate: data.targetDateTest
        },
        orderBy: {
            createdAt: "desc"
        }
    });
    const hasInfoChanged = !lastInfo || lastInfo.text !== data.details;

    const updateData: any = {};
    if (hasInfoChanged) {
        updateData.infos = {
            create: {
                text: data.details
            }
        };

        // TODO: notify for info (code is not tested)
        const tokens = await prisma.userNotificationToken.findMany();

        const message: MulticastMessage = {
            tokens: tokens.map(row => row.token),
            data: {
                title: `VP Info für ${day}`,
                body: data.details
            }
        };

        await messaging.sendEachForMulticast(message);
    }

    try {
        await prisma.vpDay.upsert({
            where: {
                targetDate: data.targetDateTest
            },
            update: updateData,
            create: {
                targetDate: data.targetDateTest,
                websiteDate: data.websiteDate,
                infos: {
                    create: {
                        text: data.details
                    }
                }
            }
        });
    } catch {
        console.log("day already created");
    }


    const oldSubstitutions = await prisma.vpSubstitution.findMany({
        where: {
            isDeleted: false,
            //day: day,
            targetDate: data.targetDateTest
        }
    });



    const allSubstitutions = [
        ...data.differentRooms.map(item => ({
            hour: item.hour,
            original: item.original,
            replacement: item.replacement,
            description: item.description,
            isDeleted: false,
            VpType: VpType.differentRoom,
            courseName: item.course,
            targetDate: data.targetDateTest
        })),
        ...data.substitutions.map(item => ({
            hour: item.hour,
            original: item.original,
            replacement: item.replacement,
            description: item.description,
            isDeleted: false,
            VpType: VpType.substitution,
            courseName: item.course,
            targetDate: data.targetDateTest
        }))
    ];
    await prisma.vpSubstitution.createMany({
        data: allSubstitutions,
        skipDuplicates: true
    });

    console.log(oldSubstitutions.length);
    console.log(allSubstitutions.length);

    const deleted = findDeletedSubstitutions(oldSubstitutions, allSubstitutions);
    console.log("GELÖSCHT??? ", deleted);

    const deletedRows = await prisma.vpSubstitution.updateManyAndReturn({
        where: {
            id: {
                in: deleted.map(item => item.id)
            }
        },
        data: {
            isDeleted: true
        }
    });
    console.log(deletedRows);

    const newSubstitutions = findNewSubstitutions(oldSubstitutions, allSubstitutions);
    const updatedCourses = new Set(newSubstitutions.map(sub => (sub.courseName)));
    console.log(updatedCourses);

    for (const course of updatedCourses) {
        console.log(course);

        const subs = await prisma.vpSubstitution.findMany({
            where: {
                courseName: course,
                targetDate: data.targetDateTest
            }
        });

        // FIXME: doesn't differentiate between substitution and rooms
        const title = `${course}: Vertretung ${day}`; // TODO: day is in english
        const body = subs
            .map(sub => `${sub.hour}: ${sub.original || "—"} → ${sub.replacement || "—"} ${sub.description ? `(${sub.description})` : ""}`)
            .join("\n");


        const tokens = await prisma.userNotificationToken.findMany({
            where: {
                user: {
                    vpCourses: {
                        some: {
                            course: course
                        }
                    }
                }
            }
        });

        if (tokens.length === 0) {
            continue;
        }

        // FIXME: doesn't differentiate between substitution and rooms
        // TODO: channel id and deeplink missing
        const message: MulticastMessage = {
            tokens: tokens.map(row => row.token),
            data: {
                title: title,
                body: body
            }
        };
        await messaging.sendEachForMulticast(message);
    }
}

export async function scrapeVpData(url: string): Promise<VpData> {
    try {
        // TODO: remove axios again? i think fetch() might be fine. in that case, also remove it from package.json
        const { data } = await axios.get(url)
        return parseVpHtml(data)

    } catch (error) {
        console.error("Error fetching or parsing the HTML:", error);
        throw error
    }
}