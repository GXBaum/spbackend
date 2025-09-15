import admin from "../config/firebase.js";
import {createDefaultNotificationsRepository} from "../db/repositories/notificationsRepository.js";

export function sendNotification(title, body, registrationToken, options = {}) {
    const message = {
        data: { title: String(title), body: String(body) },
        token: registrationToken
    };

    // Add each option as a string value to the data object
    if (options) {
        Object.keys(options).forEach(key => {
            message.data[key] = String(options[key]);  // Convert all values to strings
        });
    }
    return admin.messaging().send(message);
}

// Helper function to send to a user by ID
export async function sendNotificationToUser(
    userId,
    title,
    body,
    options = {},
    { repo = createDefaultNotificationsRepository() } = {}
) {
    const tokens = repo.getUserNotificationTokens(userId) || [];
    console.log(`Tokens for user ${userId}:`, tokens);

    if (!tokens.length) {
        return { userId, sent: 0, invalid: [], failures: [], totalTokens: 0 };
    }

    const invalidCodes = new Set([
        "messaging/registration-token-not-registered",
        "messaging/invalid-registration-token"
    ]);

    const invalid = [];
    const failures = [];
    let sent = 0;

    for (const token of tokens) {
        try {
            await sendNotification(title, body, token, options);
            sent++;
        } catch (err) {
            const code = err?.errorInfo?.code;
            if (code && invalidCodes.has(code)) {
                console.warn(`Pruning invalid token: ${token} (${code})`);
                invalid.push(token);
            } else {
                console.error(`Failed token ${token}:`, err.message || err);
                failures.push({ token, error: code || err.message || "unknown" });
            }
            // continue to next token
        }
    }

    if (invalid.length) {
        try {
            repo.removeTokens(invalid);
        } catch (e) {
            console.error("Failed pruning invalid tokens:", e);
        }
    }

    const summary = {
        userId,
        totalTokens: tokens.length,
        sent,
        invalid,
        failures
    };
    console.log("Notification summary:", summary);
    return summary;
}
