/*
function sendNotification(title, message, priority, token) {
    // Create the message payload
    const payload = {
        notification: {
            title: title,
            body: message
        },
        android: {
            priority: priority
        },
        token: token
    };

    // Send the message
    return admin.messaging().send(payload)
        .then(response => {
            console.log('Successfully sent notification:', response);
            return response;
        })
        .catch(error => {
            console.error('Error sending notification:', error);
            throw error;
        });

}
*/

import admin from "../config/firebase.js";
export function sendNotification(title, message, priority, token) {
    // Create the message payload
    const payload = {
        notification: {
            title: title,
            body: message,
            // Add these for better visibility
        },
        android: {
            priority: priority,
            // Add notification specifics for Android
            notification: {
                channel_id: "chat",
                notification_priority: "PRIORITY_HIGH",
                visibility: "PUBLIC",
                default_sound: true,
                default_vibrate_timings: true
            }
        },
        // Set content_available for iOS
        apns: {
            headers: {
                "apns-priority": "10"
            },
            payload: {
                aps: {
                    alert: {
                        title: title,
                        body: message
                    },
                    sound: "default",
                    badge: 1,
                    content_available: true
                }
            }
        },
        token: token
    };

    // Send the message
    return admin.messaging().send(payload)
        .then(response => {
            console.log('Successfully sent notification:', response);
            return response;
        })
        .catch(error => {
            console.error('Error sending notification:', error);
            throw error;
        });
}