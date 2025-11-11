import {getDb} from "../client.js";

export function createUserRepository(db) {
    if (!db) throw new Error("createUserRepository: db required");
    const stmts = {
        insertUser: db.prepare(`
            INSERT INTO user (notifications_enabled)
            VALUES (?)
        `),
        deleteUser: db.prepare(`
            DELETE FROM user
            WHERE id = ?
        `),
        deleteUserWithSpCredentials: db.prepare(`
            DELETE FROM user
            WHERE id IN (
                SELECT user_id
                FROM user_sp_data
                WHERE sp_username = ?
                  AND sp_password = ?
            )
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
        getUserMergedWithSpUsername: db.prepare(`
            SELECT u.id,
                   u.notifications_enabled,
                   s.sp_username,
                   s.sp_password
            FROM user u
                     JOIN user_sp_data s ON s.user_id = u.id
            WHERE s.sp_username = ?
        `),
        getUsersWithEnabledNotificationsAndSp: db.prepare(`
            SELECT u.id as userId, s.sp_username
            FROM user u
                     JOIN user_sp_data s ON s.user_id = u.id
            WHERE u.notifications_enabled = 1
        `)
    };

    return {
        insertUser(notificationsEnabled = 1) {
            const info = stmts.insertUser.run(notificationsEnabled);
            return Number(info.lastInsertRowid);
        },
        deleteUser(userId) {
            const info = stmts.deleteUser.run(userId);
            return info.changes > 0;
        },
        deleteUserWithSpCredentials(username, password) {
            const info = stmts.deleteUserWithSpCredentials.run(username, password);
            return info.changes > 0;
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
        getUserMergedWithSpUsername(username){
            return stmts.getUserMergedWithSpUsername.get(username) ?? null;
        },
        getUsersWithEnabledNotificationsAndSp() {
            return stmts.getUsersWithEnabledNotificationsAndSp.all();
        }
    };
}

export function createDefaultUserRepository() {
    return createUserRepository(getDb());
}
