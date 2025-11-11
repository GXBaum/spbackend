import {getDb} from "../client.js";

export function createAuthRepository(db) {
    if (!db) throw new Error("createAuthRepository: db instance required");

    const stmts = {
        getUserByUsername: db.prepare(`
            SELECT u.id,
                   u.notifications_enabled,
                   s.sp_username,
                   s.sp_password
            FROM user u
                     JOIN user_sp_data s ON s.user_id = u.id
            WHERE s.sp_username = ?
        `),
        upsertUserCredentials: db.prepare(`
            INSERT INTO user_sp_data (user_id, sp_username, sp_password)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET sp_username = excluded.sp_username,
                                               sp_password = excluded.sp_password,
                                               updated_at  = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        `),
        insertRefreshToken: db.prepare(`
            INSERT INTO user_refresh_token (user_id, token, expires_at)
            VALUES (?, ?, ?)
        `),
        getRefreshToken: db.prepare(`
            SELECT t.token,
                   t.expires_at,
                   u.id AS user_id
            FROM user_refresh_token t
                     JOIN user u ON u.id = t.user_id
            WHERE t.token = ?
        `),
        deleteRefreshToken: db.prepare(`
            DELETE
            FROM user_refresh_token
            WHERE token = ?
        `),
    };

    return {
        getUserByUsername(username) {
            return stmts.getUserByUsername.get(username) ?? null;
        },
        upsertUserCredentials(userId, spUsername, spPassword) {
            stmts.upsertUserCredentials.run(userId, spUsername, spPassword);
        },
        storeRefreshToken(userId, token, expiresAt) {
            return stmts.insertRefreshToken.run(userId, token, expiresAt);
        },
        getRefreshToken(token) {
            return stmts.getRefreshToken.get(token) ?? null;
        },
        deleteRefreshToken(token) {
            return stmts.deleteRefreshToken.run(token);
        },
    };
}

export function createDefaultAuthRepository() {
    return createAuthRepository(getDb());
}