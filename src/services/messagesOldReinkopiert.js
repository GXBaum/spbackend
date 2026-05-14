import fetch from "node-fetch";
import {USER_AGENT} from "../config/constants.js";
import CryptoJS from "crypto-js";
import {createDefaultMessageRepository} from "../db/repositories/messageRepository.js";
import {initMessageAccess} from "./auth.js";


// TODO: das hier implementieren, es funktioniert nicht weil die Nachrichten nur mit aktiviertem javascript laden // jetzt nicht mehr :)
export async function spGetMessages(cookies, userId /*localStorage*/) {
    const URL = "https://start.schulportal.hessen.de/nachrichten.php";

    console.log("getting messages...");

    const messageRepo = createDefaultMessageRepository()

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


    const aesKeyToken = await initMessageAccess(
        cookies
    )

    const res = await fetch(
        URL, {
            method: "POST",
            headers: {
                "Cookie": cookies,
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Safari/605.1.15",
                "Accept": "*/*",
                "Accept-Encoding": "gzip, deflate, br, zstd",
                "Accept-Language": "en-US,en;q=0.9",
                "Connection": "keep-alive",
                "Origin": "https://start.schulportal.hessen.de",
                "Priority": "u=3, i",
                "Referer": "https://start.schulportal.hessen.de/nachrichten.php",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest"
            },
            body: "a=headers&getType=visibleOnly&last=0"
        })

    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log(`Content-Type: ${res.headers.get("content-type")}`);


    const data = await res.json()
    try {
        const res = decrypt(
            data.rows,
            aesKeyToken
        )
        console.log("NACHRICHTEN: " + res)



        res.forEach(chat => { // OH NEIIIIIIIIN DAS IST JA O(n) 😲 WIE KANN JEMAND SOWAS MACHEN
            console.log("IN DER LOOP: " + chat)

            try {
                messageRepo.insertChat(
                    chat.Uniquid,
                    chat.Sender,
                    chat.Betreff,
                    chat.Papierkorb === "ja" ? 1 : 0,
                    chat.Datum,
                    chat.DatumUnix
                )
                messageRepo.insertUserChat(
                    userId,
                    chat.Uniquid
                )
            } catch (insertError) {
                console.error(`Failed to insert chat ${chat.Uniquid}:`, insertError.message);
            }
        })

    } catch {

    }


    try {
        const userChats = messageRepo.getUserChats(userId);
        console.log(userChats)

        for (const chatInfo of userChats ) {
            const uniqueId = CryptoJS.AES.encrypt(
                chatInfo.chat_id,
                aesKeyToken
            )

            const chat = await fetch(
                URL,
                {
                    method: "POST",
                    headers: {
                        "Cookie": cookies,
                        "User-Agent": USER_AGENT
                    },
                    body: new URLSearchParams({
                        "a": "read",
                        "uniqid": uniqueId
                    })
                }
            )
            const chatResult = await chat.json()

            const chatDecrypted = decrypt(
                chatResult.message,
                aesKeyToken
            )

            console.log("CHATS NACHRICHTEN:", chatDecrypted);

            console.log(chatResult)

            try {
                console.log("IN DIESEM TRYYY ----")

                console.log(chatDecrypted.Uniquid)
                console.log(chatDecrypted.Inhalt)

                messageRepo.chatAddContent(
                    chatDecrypted.Uniquid,
                    chatDecrypted.Inhalt
                )
            } catch (error){
                console.error(`LSDKFJASÖDLFKAJSDFÖLKASJDFÖLASKDFJALÖWKSDFJSALPDKFJLSFKJASDÖLFKJASDÖL-FKJSDALÖFKAJSDLKFJASÖLDKFJASLDKFJASDÖLFKJASDÖLKFJDSALKFJASLÖFJADSLÖKFJAWKFLDJ + ${error}`)
            }

            try {
                chatDecrypted.reply.forEach( reply => {
                    console.log("FOR EACH: ###### " + reply)
                    messageRepo.insertChatMessage(
                        reply.Uniquid,
                        chatDecrypted.Uniquid,
                        reply.Sender,
                        reply.SenderArt,
                        reply.Betreff,
                        reply.Inhalt
                    )
                })
            } catch (error){
                console.error(error)
            }
        }

    } catch {
        console.log("ERROR READING CHAT ##########################")
    }





    function decrypt(encryptedString, aesPassword) {
        const bytes = CryptoJS.AES.decrypt(encryptedString, aesPassword);


        // Utf8-Encoding angeben, sonst geht es nicht
        const plaintext = bytes.toString(CryptoJS.enc.Utf8);

        return JSON.parse(plaintext);
    }



    // funktioniert
    /*const searchRes = await search(
        "Wa",
        cookies
    )
    console.log(searchRes)*/


    // funktioniert
    /*
    const replyChatId = "ce701ea2c0c963ff81dbb9e4ca0f8175-b73febae-10cd-4d3c-8731-823615fddceb"
    const replyRes = await reply(
        "ok noch ein test, dieses mal aber cool",
        replyChatId,
        aesKeyToken,
        cookies
    )
    console.log(replyRes)
    */
}


export async function reply(
    text,
    chatId,
    aesKeyToken,
    cookies
) {
    const URL = "https://start.schulportal.hessen.de/nachrichten.php";

    const payload = {
        to: "all",
        message: text,
        replyToMsg: chatId
    }

    const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(payload),
        aesKeyToken
    ).toString()
    console.log(encrypted)

    console.log("Sende Antwort...");

    const res = await fetch(
        URL,
        {
            method: "POST",
            headers: {
                "Cookie": cookies,
                "User-Agent": USER_AGENT
            },
            body: new URLSearchParams({
                "a": "reply", // action?
                "c": encrypted // content? and encrypted
            })
        }
    )

    return await res.json()
}

export async function search(
    query, // needs to be at least two letters
    cookies
) {
    const res = await fetch(
        `https://start.schulportal.hessen.de/nachrichten.php?page=1&a=searchRecipt&q=${query}`,
        {
            method: "GET",
            headers: {
                "Cookie": cookies,
                "User-Agent": USER_AGENT
            }
        }
    )
    const data = await res.json()
    return data
}