import {prisma} from "../db/prisma.js";
import {sendNotification} from "./pushNotificationService.js";
import * as cheerio from "cheerio";
import {parseCourses, parseMarks} from "./spScraperParser.js";
import {logger} from "../logger.js";

const log = logger.child({ service: "sp-scraper" });;

// TODO: just playing around
export async function scrapeSp(userId: string) {
    log.debug({userId}, "SP scrape started");

    const userSpData = await prisma.userSpData.findUnique({
        where: {
            userId: userId
        }
    })
    if (userSpData == null) {
        log.info({userId}, "SP scrape skipped: no user data");
        return;
    }

    const loginCookies = userSpData.spAuthCookie
    if (!loginCookies) {
        log.info({userId}, "SP scrape skipped: no auth cookie");
        return;
    }
    if (!loginCookies.includes("sid")) {
        log.info({userId}, "SP scrape skipped: invalid auth cookie");
        return;
    }

    const URL = "https://start.schulportal.hessen.de/meinunterricht.php";

    const result = await fetch(
        URL,
        {
            headers: {
                "Cookie": loginCookies
            }
        }
    )
    if (!result.ok) {
        log.warn({userId, status: result.status}, "SP scrape fetch failed");
        return;
    }

    const html = await result.text();
    const $ = cheerio.load(html)
    console.log("html: " + html)


    const response = parseCourses($)
    const responseString = JSON.stringify(response)

    const test = await prisma.userSpCache.create({
        data: {
            coursesEncryptedJson: responseString,
            userId: userId
        }
    })
    console.log(test)


    const body: string = response.map((course: any) => course.name).join("\n")

    const tokens = await prisma.userNotificationToken.findMany({
        where: {
            userId: userId
        }
    })

    if (tokens.length === 0) {
        log.info({userId}, "SP scrape skipped: no notification tokens");
        return;
    }

    const title = "test";

    await sendNotification({tokens: tokens.map(row => row.token), title, body});
    log.info({userId, courseCount: response.length, tokenCount: tokens.length}, "SP scrape completed");
}

export async function scrapeSpCourse(userId: string, courseId: number, halb: number) {
    log.debug({userId, courseId, halb}, "SP course scrape started");

    const userSpData = await prisma.userSpData.findUnique({
        where: {
            userId: userId
        }
    })
    if (userSpData == null) {
        log.info({userId}, "SP course scrape skipped: no user data");
        return;
    }

    const loginCookies = userSpData.spAuthCookie
    if (!loginCookies) return // TODO: improve
    if (!loginCookies.includes("sid")) return

    const URL = `https://start.schulportal.hessen.de/meinunterricht.php?a=sus_view&id=${courseId}&halb=${halb}`;
    const result = await fetch(
        URL,
        {
            headers: {
                "Cookie": loginCookies
            }
        }
    )
    if (!result.ok) {
        log.warn({userId, courseId, halb, status: result.status}, "SP course scrape fetch failed");
        return;
    }

    const html = await result.text();
    const $ = cheerio.load(html)
    console.log("html: " + html)

    const marks = parseMarks($, courseId, halb)
    log.info({userId, courseId, halb, markCount: marks.length}, "SP course scrape completed");

    return marks;
}

export async function scrapeSpMessages(userId: string) {
    log.debug({userId}, "SP messages scrape started");

    const userSpData = await prisma.userSpData.findUnique({
        where: {
            userId: userId
        }
    })
    if (userSpData == null) return

    const loginCookies = userSpData.spAuthCookie
    if (!loginCookies) return // TODO: improve
    if (!loginCookies.includes("sid")) return

    const URL = "https://start.schulportal.hessen.de/nachrichten.php";
    const result = await fetch(
        URL,
        {
            headers: {
                "Cookie": loginCookies
            }
        }
    )

    if (!result.ok) {
        log.warn({userId, status: result.status}, "SP messages scrape fetch failed");
        return;
    }

    const html = await result.text();
    const $ = cheerio.load(html)

    // TODO: implement
}