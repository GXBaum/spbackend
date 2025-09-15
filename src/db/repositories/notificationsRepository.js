import {getDb} from "../client.js";


export function createNotificationsRepository(db) {
    if (!db) throw new Error('createNotificationsRepository: db instance required');


    const stmts = {
        selectTokensByUser: db.prepare(`SELECT token FROM user_notification_token WHERE user_id = ?`),
        insertToken: db.prepare(`INSERT OR IGNORE INTO user_notification_token (user_id, token) VALUES (?, ?)`),
        deleteToken: db.prepare(`DELETE FROM user_notification_token WHERE token = ?`),
    };

    return {
        getUserNotificationTokens(userId) {
            return stmts.selectTokensByUser.all(userId).map(r => r.token);
        },
        addUserNotificationToken(userId, token) {
            stmts.insertToken.run(userId, token);
        },
        removeTokens(tokens) {
            db.transaction(ts => {
                for (const t of ts) stmts.deleteToken.run(t);
            })(tokens);
        }
    };
}

export function createDefaultNotificationsRepository() {
    return createNotificationsRepository(getDb());
}