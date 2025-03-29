import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { initDb, resetDb } from './db.js';

// TODO: DB GETS RESET EVERY TIME THE SCRIPT RUNS
// WARNING: This will delete all database tables and recreate them
await resetDb()

const db = initDb()
let sql;

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15";

// Main function to log in
async function main() {
    try {

        console.time('Script');

        console.time('Login');
        const loginCookies = await getLoginCookies("Rafael.Beckmann", "RafaelBigFail5-", 6078);
        console.timeEnd('Login');


        console.time("getCourses")
        const courses = await getCourses(loginCookies);
        for (const course of courses) {
            sql = `Insert INTO courses (courseId, name) VALUES (?, ?)`;

            db.run(sql, [course.id, course.name], function(err) {
                if (err) return console.error("Error inserting course:", err);
                //console.log(`Course inserted: ${course.name}, ID: ${this.lastID}`);
            });
        }
        console.log(`inserted ${courses.length} courses`);

        console.timeEnd("getCourses");

        console.time("getMarks")


        for (const course of courses) {
            const marks = await getMarks(loginCookies, course.id, 1);
            //console.log(`Inserting ${marks.length} marks for course: ${course.name}`);

            // Insert each mark into the database
            for (const mark of marks) {
                sql = `Insert INTO marks (name, date, grade, courseId, SpUsername) VALUES (?, ?, ?, ?, ?)`;

                db.run(sql, [mark.name, mark.date, mark.grade, course.id, "Rafael.Beckmann"], function(err) {
                    if (err) return console.error("Error inserting mark:", err);
                    //console.log(`Mark inserted: ${mark.name}, ID: ${this.lastID}`);
                });
            }
        }
        console.log(`Inserted marks for ${courses.length} courses`);
        console.timeEnd("getMarks")

        /*console.time("getTeachers")
        const teachers = await getTeachers(loginCookies);
        console.log("Teachers found:", teachers);

        for (const teacher of teachers) {
            sql = `Insert INTO teachers (name, type, teacherId, logo, abbreviation, email) VALUES (?, ?, ?, ?, ?, ?)`;

            db.run(sql, [teacher.text, teacher.type, teacher.id, teacher.logo, teacher.abbreviation, teacher.email], function(err) {
                if (err) return console.error("Error inserting teacher:", err);
                console.log(`Teacher inserted: ${teacher.text}, ID: ${this.lastID}`);
            });
        }*/
        console.time("getTeachers")
        const { teachers, coursesTeachers } = await getTeachers(loginCookies);
        console.log("Teachers found:", teachers.length);
        console.log("Course-Teacher relationships found:", coursesTeachers.length);

        for (const teacher of teachers) {
            sql = `INSERT INTO teachers (name, type, teacherId, logo, abbreviation, email) VALUES (?, ?, ?, ?, ?, ?)`;

            db.run(sql, [teacher.text, teacher.type, teacher.id, teacher.logo, teacher.abbreviation, teacher.email], function(err) {
                if (err) return console.error("Error inserting teacher:", err);
                //console.log(`Teacher inserted: ${teacher.text}, ID: ${this.lastID}`);
            });
        }
        console.log(`Inserted ${teachers.length} teachers`);

        for (const relation of coursesTeachers) {
            sql = `INSERT INTO coursesTeachers (courseId, teacherId) VALUES (?, ?)`;

            db.run(sql, [relation.courseId, relation.teacherId], function(err) {
                if (err) return console.error("Error inserting course-teacher relationship:", err);
            });
        }
        console.timeEnd("getTeachers");



        console.timeEnd('Script');
    } catch (error) {
        console.error("Error:", error);
        console.timeEnd('Script'); // Ensure it still ends even on error
    }
}
main();


/**
 Gets authentication cookies required for accessing the school portal
 @param {string} username - Required: Username for login
 @param {string} password - Required: Password for login
 @param {number} [schoolId=6078] - Optional: School ID (defaults to 6078)
 @returns {string} Formatted cookies string containing SPH session and SID cookies
 @description
 This is a two-step authentication process:
 First requests an SPHSession cookie via POST to the login endpoint
 Then uses that cookie to get the SID cookie via a redirect chain:
 connect.schulportal.hessen.de → start.schulportal.hessen.de/schulportallogin.php?k=value
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

    // Process each course entry in the table
    $("#aktuellTable tbody tr").each((i, courseRow) => {
        const $courseRow = $(courseRow);
        const courseId = $courseRow.attr('data-book');

        if (!courseId) return;

        // Find all teacher buttons within this course row
        $courseRow.find(".teacher .btn-group").each((j, btnGroup) => {
            const $btnGroup = $(btnGroup);
            const $button = $btnGroup.find('button.btn-xs');

            // Skip if this isn't a teacher button
            if (!$button.length || !$button.attr('title')) return;

            const title = $button.attr('title');
            const abbreviation = $button.text().trim().replace(/\s.*$/, ''); // Get the abbreviation (like "Ld")

            // Get name from title attribute (e.g., "Landsbeck, Toni (Ld)")
            const nameMatch = title.match(/(.*?)\s+\(.*?\)/);
            const name = nameMatch ? nameMatch[1] : title;

            // Find the encoded ID in the "Nachricht schreiben" link
            const $messageLink = $btnGroup.find('a[href^="nachrichten.php?to[]"]');
            const encodedId = $messageLink.length ?
                $messageLink.attr('href').match(/to\[]=(.*?)}/)?.[1] : null;
            const decodedId = encodedId ? Buffer.from(encodedId, 'base64').toString() : null;

            // Find the email address
            const $emailLink = $btnGroup.find('a[href^="mailto:"]');
            const email = $emailLink.length ? $emailLink.attr('href').replace('mailto: ', '') : null;

            // Create teacher record if not already added
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

            // Add course-teacher relationship
            if (decodedId) {
                coursesTeachers.push({
                    courseId: parseInt(courseId),
                    teacherId: decodedId
                });
            }
        });
    });

    // Add coursesTeachers to the return value so they can be saved to DB
    return { teachers, coursesTeachers };
}
async function getTeachersOld(cookies) {
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

    // Find all teacher buttons in the dropdown
    $(".btn-group").each((i, btnGroup) => {
        const $btnGroup = $(btnGroup);
        const $button = $btnGroup.find('button.btn-xs');

        // Skip if this isn't a teacher button
        if (!$button.length || !$button.attr('title')) return;

        const title = $button.attr('title');
        const abbreviation = $button.text().trim().replace(/\s.*$/, ''); // Get the abbreviation (like "Ld")

        // Get name from title attribute (e.g., "Landsbeck, Toni (Ld)")
        const nameMatch = title.match(/(.*?)\s+\(.*?\)/);
        const name = nameMatch ? nameMatch[1] : title;

        // Find the encoded ID in the "Nachricht schreiben" link
        const $messageLink = $btnGroup.find('a[href^="nachrichten.php?to[]"]');
        const encodedId = $messageLink.length ?
            $messageLink.attr('href').match(/to\[]=(.*?)}/)?.[1] : null;
        const decodedId = encodedId ? Buffer.from(encodedId, 'base64').toString() : null;

        // Find the email address
        const $emailLink = $btnGroup.find('a[href^="mailto:"]');
        const email = $emailLink.length ? $emailLink.attr('href').replace('mailto: ', '') : null;

        const teacher = {
            type: "lul", // Assuming this is a constant value
            id: decodedId,
            logo: "fa fa-user", // Using the example value
            text: name,
            abbreviation: abbreviation,
            email: email
        };

        teachers.push(teacher);
    });

    return teachers;
}





/**
 * Fetches marks from the school portal
 * @param {string} cookies - Required: Authentication cookies for the session
 * @param {number} id - Required: Course/subject ID to fetch marks for
 * @param {number} [halb] - Optional: Semester number (1 or 2)
 */
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

    // Array to store the marks data
    const marks = [];

    // Select the table rows from tbody within div#marks
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
    const URL = "https://start.schulportal.hessen.de/meinunterricht.php#anwesend"

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

    // Array to store the courses
    const courses = [];

    // Select all rows from the table in the "anwesend" tab
    $("#anwesend table.table tbody tr").each( (i, row) => {
        const $row = $(row);

        // Extract course information from the first cell
        const $courseCell = $row.find('td').first();
        const $courseLink = $courseCell.find('a');

        // Parse course information
        const course = {
            name: $courseLink.text().trim(),
            //link: $courseLink.attr('href'),
            id: extractIdFromHref($courseLink.attr('href')),
        };

        courses.push(course);
    });

    // Helper function to extract ID from href
    function extractIdFromHref(href) {
        if (!href) return null;
        const match = href.match(/id=(\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    return courses;
}


async function loginGetSPHSessionCookie(username, password, schoolId) {
    /*const data = {
        //timezone: "1",
        //skin: "sp",
        user2: "Rafael.Beckmann",
        user: "6078.Rafael.Beckmann",
        password: "RafaelBigFail5-",
        //saveUsername: "1", // From the form's checkbox (optional)
        stayconnected: "1" // From the form's checkbox (notwendig)
    };*/
    const data = {
        user2: username,
        user: schoolId + "." + username,
        password: password,
        stayconnected: "1"
    }

    // Send the POST request and don't follow redirects, the server responds with 200 for some reason
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
        redirect: "follow" // Automatically follow redirects
    });

    const updatedCookies = response.headers.get("set-cookie");
    const formattedUpdatedCookies = formatUpdatedCookies(updatedCookies, "");

    console.log("Final URL:", response.url);
    console.log("Response status:", response.status, response.statusText);
    //console.log("all headers: ", response.headers);
    //console.log("all cookies: ", updatedCookies);
    console.log("Updated cookies: ", formattedUpdatedCookies);
    //const responseText = await response.text();
    //console.log("Login response:", responseText.substring(0, 200));

    return formattedUpdatedCookies;
}


async function loginGetSidCookie(cookies) {

    // Send the GET request and follow redirects
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
        redirect: "follow" // Automatically follow redirects
    });

    const updatedCookies = response.headers.get("set-cookie");
    const formattedUpdatedCookies = formatUpdatedCookies(updatedCookies, cookies);

    console.log("Final URL:", response.url);
    console.log("Response status:", response.status, response.statusText);
    //console.log("all headers: ", response.headers);
    //console.log("all cookies: ", updatedCookies);
    console.log("Updated cookies: ", formattedUpdatedCookies);
    //const responseText = await response.text();
    //console.log("Login response:", responseText.substring(0, 200));

    return formattedUpdatedCookies;
}


function formatUpdatedCookies(responseCookies, defaultCookies = "") {
    if (!responseCookies) return defaultCookies;
    return responseCookies.split(", ").map(cookie => cookie.split(";")[0]).join("; ");
}