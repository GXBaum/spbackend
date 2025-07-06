import {scrapeVpData} from "./scrapeVp.js";
import db from "../db/insert.js"
import {sendNotificationToUser} from "./notifications.js";


export async function vpCheckForDifferences(day) {
    const data = await scrapeVpData(`https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/${day}/vp.html`);

    let stringDay;
    if (day === 1) {
        console.log("checking for today");
        stringDay = "today"
    } else if (day === 2) {
        console.log("checking for tomorrow");
        stringDay = "tomorrow"
    }

    const oldRawData = await db.getVpDifferences(stringDay);

    if (oldRawData === data.rawPage) {
        console.log("no changes");
        return
    }
    console.log("changes detected")
    await db.insertVpDifferences(stringDay, data.rawPage);

    const timestamp = new Date().toISOString();

    let usernames = [];
    for (const substitution of data.substitutions) {
        const oldData = await db.getVpSubstitutions(substitution.course, stringDay, data.websiteDate);

        function areSubstitutionsEqual(sub1, sub2) {
            return sub1.hour === sub2.hour &&
                sub1.original === sub2.original &&
                sub1.replacement === sub2.replacement &&
                sub1.description === sub2.description &&
                sub1.vp_date === data.websiteDate
        }
        if (oldData && oldData.some(oldSubstitution => areSubstitutionsEqual(oldSubstitution, substitution))) {
            // substitution already exists in the database
            continue;
        }

        console.log("new substitution", JSON.stringify(substitution));
        await db.insertVpSubstitution(substitution.course, stringDay, timestamp, substitution.hour, substitution.original, substitution.replacement, substitution.description, data.websiteDate);

        const users = await db.getUsersWithVPCourseName(substitution.course)
        users.forEach(user => {
            if (!usernames.includes(user.sp_username)) {
                usernames.push(user.sp_username);
            }
        });

    }

    console.log("notifying users:", usernames);
    for (const username of usernames) {
        const courseNames = await db.getUserVpSelectedCourses(username);
        if (!courseNames || courseNames.length === 0) {
            continue;
        }

        for (const courseName of courseNames) {
            const substitutions = await db.getVpSubstitutions(courseName, stringDay, data.websiteDate);

            if (substitutions.length === 0) {
                continue;
            }

            console.log(`user ${username} has substitutions for course ${courseName}:`, substitutions);

            // TODO: gleiche vertretungen aus einer doppelstunde zusammenfassen. bsp: 1/2: Gl D → ----- (Auftrag)
            const message = substitutions.map(substitution =>
                `${substitution.hour}: ${substitution.original} → ${substitution.replacement} (${substitution.description})`
            ).join('\n');

            const title = `Vertretung für ${courseName} am ${stringDay === "today" ? "heutigen" : "nächsten"} Schultag`;
            await sendNotificationToUser(username, title, message, "high", {"open_vp": true});
        }
    }

}

