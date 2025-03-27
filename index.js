import fetch from "node-fetch";
let SPHSession = "";
let allCookies;
// Step 1: Fetch initial cookies
async function getCookies() {
    const response = await fetch("https://login.schulportal.hessen.de/?i=6078", {
        redirect: "manual" // Prevent following redirects
    });
    const rawCookies = response.headers.get("set-cookie");
    const cookies = rawCookies
        ? rawCookies.split(", ").map(cookie => cookie.split(";")[0]).join("; ")
        : "";
    console.log(rawCookies);
    console.log("Initial cookies:", cookies);
    return cookies;
}

// Step 2: Send the login data and follow redirects
async function login(cookies) {
    const data = {
        //url: "aHR0cHM6Ly9jb25uZWN0LnNjaHVscG9ydGFsLmhlc3Nlbi5kZS8=", // From the form
        //url: "aHR0cHM6Ly9jb25uZWN0LnNjaHVscG9ydGFsLmhlc3Nlbi5kZS8%3D",
        //url: "",
        timezone: "1", // Match the form's empty value
        skin: "sp",
        user2: "Rafael.Beckmann",
        user: "6078.Rafael.Beckmann",
        password: "RafaelBigFail5-",
        //saveUsername: "1", // From the form's checkbox (optional)
        stayconnected: "1" // From the form's checkbox (optional)
    };

    // Send the POST request and follow redirects
    const response = await fetch("https://login.schulportal.hessen.de/?i=6078", {

        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://login.schulportal.hessen.de",
            "Referer": "https://login.schulportal.hessen.de/?i=6078",
            //"Cookie": cookies,
            //"Cookie": "i=6078; sph-login-upstream=4",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            //"Accept-Language": "en-US,en;q=0.9",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin"
        },
        body: new URLSearchParams(data),
        redirect: "follow" // Automatically follow redirects
    });
    console.log("Final URL:", response.url);
    console.log("Response status:", response.status, response.statusText);
    const responseText = await response.text();

    //all cookies
    allCookies = response.headers.get("set-cookie");
    console.log("allcookies: ", allCookies);

    // Extract updated cookies from the response
    const updatedCookies = response.headers.get("set-cookie");
    const formattedUpdatedCookies = updatedCookies
        ? updatedCookies.split(", ").map(cookie => cookie.split(";")[0]).join("; ")
        : cookies;
    console.log("Updated cookies:", formattedUpdatedCookies);

    const sessionMatch = formattedUpdatedCookies.match(/SPH-Session=([^;]+)/);
    SPHSession = sessionMatch ? sessionMatch[1] : "";
    console.log("Extracted SPH-Session:", SPHSession);
    console.log("all headers: ", response.headers);

    console.log("Login response:", responseText.substring(0, 200));

    return formattedUpdatedCookies;
}

// Main function to perform the login
async function main() {

    // Step 1: Fetch initial cookies

    // Step 2: Send the login data and follow redirects
    const updatedCookies = await login();

    const updatedCookies2 = await login2(allCookies);
}

main().catch(err => console.error(err));




async function login2(cookies) {
    const data = {
        //url: "aHR0cHM6Ly9jb25uZWN0LnNjaHVscG9ydGFsLmhlc3Nlbi5kZS8=", // From the form
        //url: "aHR0cHM6Ly9jb25uZWN0LnNjaHVscG9ydGFsLmhlc3Nlbi5kZS8%3D",
        //url: "",
        timezone: "1", // Match the form's empty value
        skin: "sp",
        user2: "Rafael.Beckmann",
        user: "6078.Rafael.Beckmann",
        password: "RafaelBigFail5-",
        //saveUsername: "1", // From the form's checkbox (optional)
        stayconnected: "1" // From the form's checkbox (optional)
    };

    // Send the POST request and follow redirects
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
        //body: new URLSearchParams(data),
        redirect: "follow" // Automatically follow redirects
    });
    console.log("Final URL:", response.url);
    console.log("Response status:", response.status, response.statusText);
    const responseText = await response.text();

    // Extract updated cookies from the response
    const updatedCookies = response.headers.get("set-cookie");
    const formattedUpdatedCookies = updatedCookies
        ? updatedCookies.split(", ").map(cookie => cookie.split(";")[0]).join("; ")
        : cookies;
    console.log("Updated cookies:", formattedUpdatedCookies);

    console.log("all headers: ", response.headers);

    console.log("Login response:", responseText.substring(0, 200));

    return formattedUpdatedCookies;
}

