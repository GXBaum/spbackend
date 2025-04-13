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
import db from "../db/insert.js";

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


// Helper function to send to a user by ID
export async function sendNotificationToUser(userId, title, message, priority = "high") {
    try {
        const token = await db.getUserNotificationToken(userId);
        console.log(`Token for user ${userId}:`, token);
        if (!token) {
            throw new Error(`No notification token found for user ${userId}`);
        }
        return await sendNotification(title, message, priority, token.token);
    } catch (error) {
        console.error(`Failed to send notification to user ${userId}:`, error);
        throw error;
    }
}