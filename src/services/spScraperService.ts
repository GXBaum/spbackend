import {messaging} from "../firebase.js";
import {prisma} from "../db/prisma.js";
import type {MulticastMessage} from "firebase-admin/messaging";
import * as cheerio from "cheerio";
import {parseCourses, parseMarks} from "./spScraperParser.js";

// TODO: just playing around
export async function scrapeSp(userId: string) {
    console.log("in sp scrape")

    const userSpData = await prisma.userSpData.findUnique({
        where: {
            userId: userId
        }
    })
    console.log(userSpData)
    if (userSpData == null) return

    const loginCookies = userSpData.spAuthCookie
    if (!loginCookies) return // TODO: improve
    if (!loginCookies.includes("sid")) return

    const URL = "https://start.schulportal.hessen.de/meinunterricht.php";

    const result = await fetch(
        URL,
        {
            headers: {
                "Cookie": loginCookies
            }
        }
    )
    console.log(`is ok: ${result.ok}`)
    if (!result.ok) return

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
    console.log("tokens: " + tokens)

    if (tokens.length === 0) {
        console.log("tokens empty, returning")
        return;
    }

    const title = "test";

    const message: MulticastMessage = {
        tokens: tokens.map(row => row.token),
        data: {
            title: title,
            body: body
        }
    }
    await messaging.sendEachForMulticast(message)
}

export async function scrapeSpCourse(userId: string, courseId: number, halb: number) {
    console.log(`in sp course scrape for course id: ${courseId}`)

    const userSpData = await prisma.userSpData.findUnique({
        where: {
            userId: userId
        }
    })
    console.log(userSpData)
    if (userSpData == null) return

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
    console.log(`is ok: ${result.ok}`)
    if (!result.ok) return

    const html = await result.text();
    const $ = cheerio.load(html)
    console.log("html: " + html)

    const marks = parseMarks($, courseId, halb)
    console.log(marks);

    return marks;
}

export async function scrapeSpMessages(userId: string) {

    const userSpData = await prisma.userSpData.findUnique({
        where: {
            userId: userId
        }
    })
    console.log(userSpData)
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

    console.log(`is ok: ${result.ok}`)
    if (!result.ok) return

    const html = await result.text();
    const $ = cheerio.load(html)

    // TODO: implement
}