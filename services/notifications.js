import db from "../db/insert.js";
import admin from "../config/firebase.js";

export function sendNotification(title, body, registrationToken, options = {}) {

    const message = {
        data: {
            title: title,
            body: body,
        },
        token: registrationToken
    }

    // Add each option as a string value to the data object
    if (options) {
        Object.keys(options).forEach(key => {
            message.data[key] = String(options[key]);  // Convert all values to strings
        });
    }

    return admin.messaging().send(message)
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
export async function sendNotificationToUser(userId, title, message, options = {}) {
    try {
        const token = await db.getUserNotificationToken(userId);
        console.log(`Token for user ${userId}:`, token);
        if (!token) {
            throw new Error(`No notification token found for user ${userId}`);
        }
        return await sendNotification(title, message, token.token, options);
    } catch (error) {
        console.error(`Failed to send notification to user ${userId}:`, error);
        throw error;
    }
}