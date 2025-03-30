import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { getDb, resetDb, db } from './db.js'; // Updated import to use the combined version

// TODO: DB GETS RESET EVERY TIME THE SCRIPT RUNS
// WARNING: This will delete all database tables and recreate them
await resetDb();

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15";

// Main function to log in
async function main() {
    try {
        console.time('Script');

        await db.insertUser("Rafael.Beckmann", "RafaelBigFail5-");

        console.time('Login');
        const loginCookies = await getLoginCookies("Rafael.Beckmann", "RafaelBigFail5-", 6078);
        console.timeEnd('Login');

        console.time("getCourses");
        const courses = await getCourses(loginCookies);
        for (const course of courses) {
            await db.insertCourse({ id: course.id, name: course.name }); // Use db.insertCourse
        }
        console.timeEnd("getCourses");

        //new
        await db.insertUserCourse("Rafael.Beckmann", 5349)


        console.time("getMarks");
        for (const course of courses) {
            const marks = await getMarks(loginCookies, course.id, 1);
            for (const mark of marks) {
                await db.insertMark({
                    name: mark.name,
                    date: mark.date,
                    grade: mark.grade,
                    courseId: course.id,
                    SpUsername: "Rafael.Beckmann"
                });
            }
        }
        console.timeEnd("getMarks");

        console.time("getTeachers");
        const { teachers, coursesTeachers } = await getTeachers(loginCookies);
        console.log("Teachers found:", teachers.length);
        console.log("Course-Teacher relationships found:", coursesTeachers.length);

        for (const teacher of teachers) {
            await db.insertTeacher({
                id: teacher.id,
                name: teacher.text,
                type: teacher.type,
                logo: teacher.logo,
                abbreviation: teacher.abbreviation,
                email: teacher.email
            });
        }
        for (const relation of coursesTeachers) {
            await db.insertCourseTeacher(relation.courseId, relation.teacherId); // Use db.insertCourseTeacher
        }
        console.timeEnd("getTeachers");


        console.timeEnd('Script');
    } catch (error) {
        console.error("Error:", error);
        console.timeEnd('Script'); // Ensure it still ends even on error
    } finally {
        await db.close(); // Close the database connection when done
    }
}
main();



/**
 * Gets authentication cookies required for accessing the school portal
 * @param {string} username - Required: Username for login
 * @param {string} password - Required: Password for login
 * @param {number} [ сайти schoolId=6078] - Optional: School ID (defaults to 6078)
 * @returns {string} Formatted cookies string containing SPH session and SID cookies
 * @description
 *  This is a two-step authentication process:
 *  First requests an SPHSession cookie via POST to the login endpoint
 *  Then uses that cookie to get the SID cookie via a redirect chain:
 *  connect.schulportal.hessen.de → start.schulportal.hessen.de/schulportallogin.php?k=value
 */
async function getLoginCookies(username, password, schoolId = 6078) {
    console.time('Login Part 1');
    const cookiesWithSPHSession = await loginGetSPHSessionCookie(username, password, schoolId);
    console.timeEnd('Login Part 1');

    console.time('Login Part 2');
    const finalCookiesWithSid = await loginGetSidCookie(cookiesWithSPHSession);
    console.timeEnd('Login Part 2');

    return finalCookiesWithSid;
}

async function getTeachers(cookies) {
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
                    courseId: parseInt(courseId),
                    teacherId: decodedId
                });
            }
        });
    });

    return { teachers, coursesTeachers };
}

async function getMarks(cookies, id, halb) {
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

async function getCourses(cookies) {
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

async function loginGetSPHSessionCookie(username, password, schoolId) {
    const data = {
        user2: username,
        user: schoolId + "." + username,
        password: password,
        stayconnected: "1"
    };

    const response = await fetch("https://login.schulportal.hessen.de/?i=6078", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://login.schulportal.hessen.de",
            "Referer": "https://login.schulportal.hessen.de/?i=6078",
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin"
        },
        body: new URLSearchParams(data),
        redirect: "follow"
    });

    const updatedCookies = response.headers.get("set-cookie");
    const formattedUpdatedCookies = formatUpdatedCookies(updatedCookies, "");

    console.log("Final URL:", response.url);
    console.log("Response status:", response.status, response.statusText);
    console.log("Updated cookies: ", formattedUpdatedCookies);

    return formattedUpdatedCookies;
}

async function loginGetSidCookie(cookies) {
    const response = await fetch("https://connect.schulportal.hessen.de/", {
        method: "GET",
        headers: {
            "Referer": "https://login.schulportal.hessen.de/?i=6078",
            "Cookie": cookies,
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Priority": "u=0, i"
        },
        redirect: "follow"
    });

    const updatedCookies = response.headers.get("set-cookie");
    const formattedUpdatedCookies = formatUpdatedCookies(updatedCookies, cookies);

    console.log("Final URL:", response.url);
    console.log("Response status:", response.status, response.statusText);
    console.log("Updated cookies: ", formattedUpdatedCookies);

    return formattedUpdatedCookies;
}

function formatUpdatedCookies(responseCookies, defaultCookies = "") {
    if (!responseCookies) return defaultCookies;
    return responseCookies.split(", ").map(cookie => cookie.split(";")[0]).join("; ");
}