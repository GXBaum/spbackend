import {messaging} from "../firebase.js";
import {prisma} from "../db/prisma.js";
import type {MulticastMessage} from "firebase-admin/messaging";
import type {CheerioAPI} from "cheerio";
import * as cheerio from "cheerio";

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

    // TODO: copied to test if it logs in
    function getCourses($: CheerioAPI) {
        const courses: any = [];

        $("#anwesend table.table tbody tr").each((i, row) => {
            const $row = $(row);
            const $courseCell = $row.find('td').first();
            const $courseLink = $courseCell.find('a');

            const course = {
                name: $courseLink.text().trim(),
                id: extractIdFromHref($courseLink.attr('href')),
            };

            courses.push(course);
        });

        function extractIdFromHref(href: any) {
            if (!href) return null;
            const match = href.match(/id=(\d+)/);
            return match ? parseInt(match[1]) : null;
        }

        return courses;
    }

    const body: string = getCourses($).map((course: any) => course.name).join("\n")

    console.log(`in body erstellt: ${body}`)









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