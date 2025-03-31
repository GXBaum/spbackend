import fetch from "node-fetch";
import * as cheerio from "cheerio";
import {USER_AGENT} from "../config/constants.js";

export async function getMarks(cookies, id, halb) {
    const URL = `https://start.schulportal.hessen.de/meinunterricht.php?a=sus_view&id=${id}&halb=${halb}`;

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
        throw new Error(`Failed to fetch marks page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const marks = [];

    $('#marks table.table tbody tr').each((i, row) => {
        const $row = $(row);
        const markData = {
            name: $row.find('td').eq(0).text().trim(),
            date: $row.find('td').eq(1).text().trim(),
            grade: $row.find('td').eq(2).find('span.badge').text().trim()
        };
        marks.push(markData);
    });

    return marks;
}