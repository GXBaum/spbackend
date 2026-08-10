import axios from "axios";
import {prisma} from "../db/prisma.js";
import {Day, VpType} from "../generated/prisma/enums.js";
import type {MulticastMessage} from "firebase-admin/messaging";
import {messaging} from "../firebase.js";
import {parseVpHtml} from "./vpScraperParser.js";
import {Prisma, type VpSubstitution} from "../generated/prisma/client.js";
import {buildDeepLink, CHANNEL_NAMES} from "./DeepLinkBuilder.js";
import {relativeDateFormatter} from "./DateFormatter.js";
import {logger} from "../logger.js";

const log = logger.child({ service: "vp-scraper" });

export async function scrapeVp(day: Day) {
    const dayNumber = day === Day.today ? 1 : 2;
    const url = `https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/${dayNumber}/vp.html`;

    const html = await fetchHtml(url);

    // FIXME UNCOMMENT
    if (!(await hasVpChanged(day, html))) {
        log.debug({day}, "VP data has not changed");
        return;
    }
    log.info({day}, "VP data changed");

    // FIXME: can lead to missed entries if it failes downrange
    await prisma.vpRawLog.create({
        data: {
            data: html,
            day: day
        }
    });

    const data = parseVpHtml(html);


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

    const updateData: Prisma.VpDayUpdateInput = {};
    if (hasInfoChanged) {
        updateData.infos = {
            create: {
                text: data.details
            }
        };

        if (data.details != "") {
            await sendInfoNotification(data.details, day, data.targetDateTest)
        }
    }

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

    const deleted = findDeletedSubstitutions(oldSubstitutions, allSubstitutions);

    const deletedRows = await prisma.vpSubstitution.updateManyAndReturn({
        where: {
            id: {
                in: deleted.map(item => item.id)
            }
        },
        include: {
            course: true
        },
        data: {
            isDeleted: true
        }
    });

    const newSubstitutions = findNewSubstitutions(oldSubstitutions, allSubstitutions);

    log.info({
        day,
        targetDate: data.targetDateTest,
        oldCount: oldSubstitutions.length,
        foundCount: allSubstitutions.length,
        newCount: newSubstitutions.length,
        deletedCount: deleted.length
    }, "VP scrape summary");

    /*
    const updatedCourses = new Set([
        ...newSubstitutions.map(sub => sub.courseName),
        ...deletedRows.map(sub => sub.course.name)
    ]);
    console.log(updatedCourses);
    */

    // TODO: quick fix to separate substitutions from differentRooms (call that codeduplicationmaxxing)
    const updatedSubstitutionCourses = new Set([
        ...newSubstitutions
            .filter(sub => sub.VpType === VpType.substitution)
            .map(sub => sub.courseName),
        ...deletedRows
            .filter(sub => sub.VpType === VpType.substitution)
            .map(sub => sub.course.name)
    ]);
    const updatedDifferentRoomCourses = new Set([
        ...newSubstitutions
            .filter(sub => sub.VpType === VpType.differentRoom)
            .map(sub => sub.courseName),
        ...deletedRows
            .filter(sub => sub.VpType === VpType.differentRoom)
            .map(sub => sub.course.name)
    ]);

    //for (const course of updatedCourses) {
    for (const course of updatedSubstitutionCourses) {
        try {
            await sendCourseNotification(course, VpType.substitution, day, data.targetDateTest);
        } catch (error) {
            log.error({err: error, course, type: VpType.substitution}, "VP Notification failed");
        }
    }
    for (const course of updatedDifferentRoomCourses) {
        try {
            await sendCourseNotification(course, VpType.differentRoom, day, data.targetDateTest);
        } catch (error) {
            log.error({err: error, course, type: VpType.differentRoom}, "VP Notification failed");
        }
    }

}

// seems like an unnecessary function
export async function fetchHtml(url: string): Promise<string> {
    const { data } = await axios.get(url)
    return data
}

interface SubstitutionForSetKey {
    courseName: string;
    hour: string | null;
    original: string | null;
    replacement: string | null;
    description: string | null;
    VpType: VpType;
}

function generateSetKey(sub: SubstitutionForSetKey) {
    return `${sub.courseName} ~~~~~~~~|o|~~HELP~~~~ ${sub.hour ?? ""} | ${sub.original ?? ""} | ${sub.replacement ?? ""} | ${sub.description ?? ""}`;
}

function findDeletedSubstitutions(oldSubs: VpSubstitution[], newSubs: SubstitutionForSetKey[]): VpSubstitution[] {
    const newSubsSet = new Set(newSubs.map(sub => (generateSetKey(sub))));

    return oldSubs.filter(sub => !newSubsSet.has(generateSetKey(sub)));
}

// TODO: maybe replace with prisma .createManyAndReturn instead of this?
function findNewSubstitutions(
    oldSubs: SubstitutionForSetKey[],
    newSubs: SubstitutionForSetKey[]
): SubstitutionForSetKey[] {
    const oldSubsSet = new Set(oldSubs.map(sub => generateSetKey(sub)));
    return newSubs.filter(sub => !oldSubsSet.has(generateSetKey(sub)));
}

async function hasVpChanged(day: Day, html: string) {
    const oldData = await prisma.vpRawLog.findFirst({
        where: {
            day: day,
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    return html !== oldData?.data;
}

async function sendCourseNotification(course: string, vpType: VpType, day: Day, targetDate: Date) {
    const subs = await prisma.vpSubstitution.findMany({
        where: {
            courseName: course,
            targetDate: targetDate,
            isDeleted: false,
            VpType: vpType
        }
    });
    // TODO: sends empty notifications if everything is deleted

    const title = `${course}: ${vpType === VpType.substitution ? "Vertretung" : "Ersatzraum"} ${relativeDateFormatter(targetDate)}`;

    const body = subs
        .map(sub => `${sub.hour}: ${sub.original || "—"} → ${sub.replacement || "—"} ${sub.description ? `(${sub.description})` : ""}`)
        .join("\n");

    // TODO: lol what is this
    const notificationId = "vp" + course + day + vpType // FIXME doesn't differentiate between substitution and rooms

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
        return;
    }

    // FIXME: doesn't differentiate between substitution and rooms
    const message: MulticastMessage = {
        tokens: tokens.map(row => row.token),
        data: {
            title: title,
            body: body,
            deepLink: buildDeepLink({ path: "vpScreen", queryParams: { course: course } }),
            id: notificationId,
            channel_id: CHANNEL_NAMES.CHANNEL_VP_UPDATES, // TODO: improve this
        }
    };
    await messaging.sendEachForMulticast(message);
}

async function sendInfoNotification(info: string, day: Day, targetDate: Date) {
    const tokens = await prisma.userNotificationToken.findMany();

    if (tokens.length === 0) {
        return;
    }

    // TODO: notification id missing
    const message: MulticastMessage = {
        tokens: tokens.map(row => row.token),
        data: {
            title: `Info für ${relativeDateFormatter(targetDate)}`,
            body: info,
            channel_id: CHANNEL_NAMES.CHANNEL_VP_UPDATES, // TODO: improve this
            id: `vpinfo ${day}`
        }
    };

    await messaging.sendEachForMulticast(message);
}