import fetch from "node-fetch";
import * as cheerio from "cheerio";
import {USER_AGENT} from "../config/constants.js";

export async function getCourses(cookies) {
    const URL = "https://start.schulportal.hessen.de/meinunterricht.php#anwesend";

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
        throw new Error(`Failed to fetch courses page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const courses = [];

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

    function extractIdFromHref(href) {
        if (!href) return null;
        const match = href.match(/id=(\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    return courses;
}