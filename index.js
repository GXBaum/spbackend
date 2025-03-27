import fetch from "node-fetch";
import * as cheerio from "cheerio";

// Main function to log in
async function main() {
    try {
        console.time('Script');

        console.time('Login1');
        const updatedCookies = await login();
        console.timeEnd('Login1');

        console.time('Login2');
        const finalCookies = await login2(updatedCookies);
        console.timeEnd('Login2');

        console.time('GetMarks');
        const marks = await getMarks(finalCookies);
        console.timeEnd('GetMarks');

        console.log("Marks found:", marks);

        console.timeEnd('Script');
    } catch (error) {
        console.error("Error:", error);
        console.timeEnd('Script'); // Ensure it still ends even on error
    }
}

main();
async function getMarks(cookies) {
    //const url = "https://start.schulportal.hessen.de/meinunterricht.php?a=sus_view&id=5743#marks";

    const url = "https://start.schulportal.hessen.de/meinunterricht.php?a=sus_view&id=5477&halb=1#marks";

    const response = await fetch(url, {
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

async function login() {
    const data = {
        //timezone: "1",
        //skin: "sp",
        user2: "Rafael.Beckmann",
        user: "6078.Rafael.Beckmann",
        password: "RafaelBigFail5-",
        //saveUsername: "1", // From the form's checkbox (optional)
        stayconnected: "1" // From the form's checkbox (notwendig)
    };

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


async function login2(cookies) {

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

//main().catch(err => console.error(err));