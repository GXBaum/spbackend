import fetch from "node-fetch";
import * as cheerio from "cheerio";
import {USER_AGENT} from "../config/constants.js";

export async function getTeachers(cookies) {
    const URL = "https://start.schulportal.hessen.de/meinunterricht.php";

    const response = await fetch(URL, {
        method: "GET",
        headers: {
            "Cookie": cookies,
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": "https://connect.schulportal.hessen.de/",
        },
        redirect: "follow"
    });

    if (response.status !== 200) {
        throw new Error(`Failed to fetch teachers: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let teachers = [];
    let coursesTeachers = [];

    $("#aktuellTable tbody tr").each((i, courseRow) => {
        const $courseRow = $(courseRow);
        const courseId = $courseRow.attr('data-book');

        if (!courseId) return;

        $courseRow.find(".teacher .btn-group").each((j, btnGroup) => {
            const $btnGroup = $(btnGroup);
            const $button = $btnGroup.find('button.btn-xs');

            if (!$button.length || !$button.attr('title')) return;

            const title = $button.attr('title');
            const abbreviation = $button.text().trim().replace(/\s.*$/, '');
            const nameMatch = title.match(/(.*?)\s+\(.*?\)/);
            const name = nameMatch ? nameMatch[1] : title;

            const $messageLink = $btnGroup.find('a[href^="nachrichten.php?to[]"]');
            const encodedId = $messageLink.length ?
                $messageLink.attr('href').match(/to\[]=(.*?)}/)?.[1] : null;
            const decodedId = encodedId ? Buffer.from(encodedId, 'base64').toString() : null;

            const $emailLink = $btnGroup.find('a[href^="mailto:"]');
            const email = $emailLink.length ? $emailLink.attr('href').replace('mailto: ', '') : null;

            if (decodedId && !teachers.some(t => t.id === decodedId)) {
                const teacher = {
                    type: "lul",
                    id: decodedId,
                    logo: "fa fa-user",
                    text: name,
                    abbreviation: abbreviation,
                    email: email
                };
                teachers.push(teacher);
            }

            if (decodedId) {
                coursesTeachers.push({
                    course_id: parseInt(courseId),
                    teacher_id: decodedId
                });
            }
        });
    });

    return { teachers, coursesTeachers };
}