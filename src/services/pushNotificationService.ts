import {messaging} from "../firebase.js";

interface NotificationOptions {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, string>;
}

export function sendNotification({tokens, title, body, data}: NotificationOptions) {
    return messaging.sendEachForMulticast({
        tokens,
        data: {...data, title, body},
        apns: {
            headers: {
                "apns-push-type": "alert",
                "apns-priority": "10"
            },
            payload: {
                aps: {
                    alert: {title, body},
                    sound: "default"
                }
            }
        }
    });
}
