import fetch from "node-fetch";

function formatUpdatedCookies(responseCookies, defaultCookies = '') {
    const updatedCookies = responseCookies;
    const formattedUpdatedCookies = updatedCookies
        ? updatedCookies.split(", ").map(cookie => cookie.split(";")[0]).join("; ")
        : defaultCookies;

    return formattedUpdatedCookies;
}

async function login(cookies) {
    const data = {
        timezone: "1",
        skin: "sp",
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

    console.log("Final URL:", response.url);
    console.log("Response status:", response.status, response.statusText);

    //const responseText = await response.text();
    //console.log("Login response:", responseText.substring(0, 200));

    const allSetCookies = response.headers.get("set-cookie");
    console.log("all cookies: ", allSetCookies);
    const formattedUpdatedCookies = formatUpdatedCookies(allSetCookies, cookies);
    console.log("Updated cookies: ", formattedUpdatedCookies);

    return formattedUpdatedCookies;
}

// Main function to perform the login
async function main() {
    console.time('MyCode');

    const updatedCookies = await login();

    const updatedCookies2 = await login2(updatedCookies);

    console.timeEnd('MyCode');

}

main().catch(err => console.error(err));


async function login2(cookies) {
    const data = {
        timezone: "1",
        skin: "sp",
        user2: "Rafael.Beckmann",
        user: "6078.Rafael.Beckmann",
        password: "RafaelBigFail5-",
        //saveUsername: "1", // From the form's checkbox (optional)
        stayconnected: "1" // From the form's checkbox (vlt notwendig)
    };

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
    console.log("Final URL:", response.url);
    console.log("Response status:", response.status, response.statusText);
    const responseText = await response.text();

    // Extract updated cookies from the response
    const updatedCookies = response.headers.get("set-cookie");
    const formattedUpdatedCookies = formatUpdatedCookies(updatedCookies, cookies);
    console.log("Updated cookies:", formattedUpdatedCookies);

    //console.log("all headers: ", response.headers);

    //console.log("Login response:", responseText.substring(0, 200));

    return formattedUpdatedCookies;
}
