import {getDb} from "../client.js";

export function createUserRepository(db) {
    if (!db) throw new Error("createUserRepository: db required");
    const stmts = {
        insertUser: db.prepare(`
            INSERT INTO user (notifications_enabled)
            VALUES (?)
        `),
        updateUserNotifications: db.prepare(`
            UPDATE user
            SET notifications_enabled = ?
            WHERE id = ?
        `),
        getUserById: db.prepare(`
            SELECT *
            FROM user
            WHERE id = ?
        `),
        getUsersWithEnabledNotifications: db.prepare(`
            SELECT id
            FROM user
            WHERE notifications_enabled = 1
        `),
        getUserMerged: db.prepare(`
            SELECT u.id,
                   u.notifications_enabled,
                   s.sp_username,
                   s.sp_password
            FROM user u
                     JOIN user_sp_data s ON s.user_id = u.id
            WHERE u.id = ?
        `),
        getUsersWithEnabledNotificationsAndSp: db.prepare(`
            SELECT u.id as userId, s.sp_username
            FROM user u
                     JOIN user_sp_data s ON s.user_id = u.id
            WHERE u.notifications_enabled = 1
        `)
    };

    return {
        insertUser(notificationsEnabled = 0) {
            const info = stmts.insertUser.run(notificationsEnabled);
            return Number(info.lastInsertRowid);
        },
        updateUserNotifications(userId, enabled) {
            stmts.updateUserNotifications.run(enabled ? 1 : 0, userId);
        },
        getUserById(userId) {
            return stmts.getUserById.get(userId) ?? null;
        },
        getUsersWithEnabledNotifications() {
            return stmts.getUsersWithEnabledNotifications.all();
        },
        getUserMerged(userId) {
            return stmts.getUserMerged.get(userId) ?? null;
        },
        getUsersWithEnabledNotificationsAndSp() {
            return stmts.getUsersWithEnabledNotificationsAndSp.all();
        }
    };
}

export function createDefaultUserRepository() {
    return createUserRepository(getDb());
}
