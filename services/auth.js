import fetch from "node-fetch";
import {USER_AGENT} from "../config/constants.js";

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
export async function getLoginCookies(username, password, schoolId = 6078) {
    console.time('Login Part 1');
    const cookiesWithSPHSession = await loginGetSPHSessionCookie(username, password, schoolId);
    console.timeEnd('Login Part 1');

    console.time('Login Part 2');
    const finalCookiesWithSid = await loginGetSidCookie(cookiesWithSPHSession);
    console.timeEnd('Login Part 2');

    return finalCookiesWithSid;
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