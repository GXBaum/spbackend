import fetch from "node-fetch";
import {USER_AGENT} from "../config/constants.js";
import * as cheerio from "cheerio";

// TODO: das hier implementieren, es funktioniert nicht weil die Nachrichten nur mit aktiviertem javascript laden
export async function spGetMessages(cookies, /*localStorage*/) {
    const URL = "https://start.schulportal.hessen.de/nachrichten.php";
    const MAX_CHAT_COUNT = 690;
    const MAX_CHAT_MESSAGES_COUNT = 690;

    console.log("getting messages...");


    /*
    if (!localStorage.aespw || !cookies) {
        console.error("no login data passed");
        return
    }
    console.log(localStorage.aespw)

    // AESPW is the login token, from "AES PassWord"
    const localStorageContent = {
        "key": "aespw",
        "value": localStorage.aespw
    }
    */

    const response = await fetch(URL, {
        method: "GET",
        headers: {
            "Cookie": cookies,
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": "https://connect.schulportal.hessen.de/",
        }
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    //console.log(html)


    /*
    try {
        let chatTopics = [];
        let chatDataIds = [];
        let chatUnreadMessagesCounts = [];

        for (let i = 0; i < MAX_CHAT_COUNT; i++) {
            console.log("chat index: " + i);

            const chatDataId = await page.evaluate(index => {
                // get the data-id of the chat (data-id attribute of chat row)
                const element = document.querySelector(`tr[data-index="${index}"]`);
                return element ? element.getAttribute("data-id") : null;
            }, i);
            console.log("chat data id: " + chatDataId);

            const chatTopic = await page.evaluate(index => {
                // get the topic of the chat (3rd td element of chat row)
                const element = document.querySelector(`tr[data-index="${index}"] td:nth-child(3)`);
                return element ? element.innerText : null;
            }, i);
            console.log("chat topic: " + chatTopic);

            const chatUnreadMessagesCount = await page.evaluate(async (index) => {
                try {
                    let msg_tr_index_unread_messages = await document.querySelector(`tr[data-index="${index}"] td:nth-child(2)`).innerText;
                    return parseInt(msg_tr_index_unread_messages.match(/\d+/)[0]);
                } catch {
                    return null
                }
            }, i);
            console.log("chat unread messages count: " + chatUnreadMessagesCount);


            if (chatTopic && chatDataIds) {
                chatTopics.push(chatTopic);
                chatDataIds.push(chatDataId);
                chatUnreadMessagesCounts.push(chatUnreadMessagesCount);
            } else {
                console.log("chatTopic / chatID not defined");
                break
            }

        }
        console.log("chat ids: " + chatDataIds);
        console.log("chat topics: " + chatTopics);

        let result = {
            chatDataIds: chatDataIds,
            chatTopics: chatTopics,
            chatUnreadMessagesCounts: chatUnreadMessagesCounts
        };


        console.log("setting cookies & localstorage...");
        await page.setCookie(...cookies);
        await page.evaluate((localStorageContent) => {
            localStorage.setItem(localStorageContent.key, localStorageContent.value);
        }, localStorageContent);


        console.log("----------------------chats-------------------------")
        let chats = [];
        for (let chatIndex = 0; chatIndex < chatDataIds.length; chatIndex++) {
            console.log("chat index: " + chatIndex);

            await page.goto(TARGET_URL + "?a=read&msg=" + chatDataIds[chatIndex], {waitUntil: "networkidle2"});
            console.log(TARGET_URL + "?a=read&msg=" + chatDataIds[chatIndex]);

            // wait for the chat messages to load
            await page.waitForSelector("#msg1");


            let chat = [];
            for (let messageIndex = 0; messageIndex < MAX_CHAT_MESSAGES_COUNT; messageIndex++) {
                console.log("message index: " + messageIndex);

                let message = {
                    "text": "",
                    "author": "",
                    "time": "",
                }

                message.text = await page.evaluate(async (Index) => {
                    try {
                        const messageHTML = document.getElementById(`msg${Index + 1}`).innerHTML;
                        return messageHTML.replace(/<\/?span>/g, "")
                    } catch (error) {
                        console.error(error);
                        return null
                    }
                }, messageIndex);

                message.time = await page.evaluate(async (Index) => {
                    try {
                        let messageList = document.getElementById(`msg${Index + 1}`).parentElement;
                        let messageSentTime = messageList.querySelector(".message-data-time").innerHTML;
                        return messageSentTime
                    } catch (error) {
                        console.error(error);
                        return null
                    }
                }, messageIndex);
                message.author = await page.evaluate(async (Index) => {
                    try {
                        let messageList = document.getElementById(`msg${Index + 1}`).parentElement;
                        let messageAuthor = messageList.querySelector(".message-data-name").innerHTML;
                        return messageAuthor
                    } catch (error) {
                        console.error(error);
                        return null
                    }
                }, messageIndex);

                console.log("message: " + message.text);

                if (message.text) {
                    chat.push(message);
                } else {
                    console.log("message not defined");
                    break
                }
            }

            console.log(chats);
            chats.push(chat);

        }
        result.chats = chats;
        await browser.close();

        return result


    } catch {
        console.error("necessary element not found, possibly old login data / try reloading. error: ", error);
    }

    */
}
