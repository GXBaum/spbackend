import fetch from "node-fetch";
import * as cheerio from "cheerio";

// Main function to log in
async function main() {
    try {
        console.time('Script');

        const finalCookies = await getLoginCookies("Rafael.Beckmann", "RafaelBigFail5-", 6078);

        console.time('GetMarks');
        const marks = await getMarks(finalCookies, 5743, );
        console.timeEnd('GetMarks');

        console.log("Marks found:", marks);

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


/**
 * Fetches marks from the school portal
 * @param {string} cookies - Required: Authentication cookies for the session
 * @param {number} id - Required: Course/subject ID to fetch marks for
 * @param {number} [halb] - Optional: Semester number (1 or 2)
 */
async function getMarks(cookies, id, halb) {
    //const url = "https://start.schulportal.hessen.de/meinunterricht.php?a=sus_view&id=5743";
    //const url = "https://start.schulportal.hessen.de/meinunterricht.php?a=sus_view&id=5477&halb=1";
    const URL = `https://start.schulportal.hessen.de/meinunterricht.php?a=sus_view&id=${id}&halb=${halb}`;

    const response = await fetch(URL, {
        method: "GET",
        headers: {
            "Cookie": cookies,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
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
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
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
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
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