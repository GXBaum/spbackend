import {getDb} from "../client.js";

export function createMessageRepository(db) {
    if (!db) throw new Error("createVpRepository: db required");

    const stmts = {
        // vp_difference
        getPlanHtml: db.prepare(`
            SELECT data
            FROM vp_difference
            WHERE day = ?
        `),

        getUserChats: db.prepare(`
            SELECT *
            FROM user_sp_chat uc
            JOIN sp_chat c ON c.id = uc.chat_id
            WHERE user_id = ?
        `),

        insertUserChat: db.prepare(`
            INSERT OR IGNORE INTO user_sp_chat (user_id, chat_id)
            VALUES (?, ?)
        `),

        insertChat: db.prepare(`
            INSERT OR REPLACE INTO sp_chat (id, sender, betreff, is_trash, datum, datumUnix)
            VALUES (?, ?, ?, ?, ?, ?)
        `),

        chatAddContent: db.prepare(`
            UPDATE sp_chat
            SET content = ?
            WHERE id = ?
        `),

        insertChatMessage: db.prepare(`
            INSERT OR REPLACE INTO sp_chat_message (id, chat_id, sender, sender_art, betreff, content)
            VALUES (?, ?, ?, ?, ?, ?)
        `),

        getChatMessages: db.prepare(`
            SELECT *
            FROM sp_chat_message
            WHERE chat_id = ?
        `)

    };



    return {
        // vp_difference
        getPlanHtml(day) {
            return stmts.getPlanHtml.pluck().get(day) ?? null;
        },

        getUserChats(userId) {
            return stmts.getUserChats.all(userId)
        },

        insertUserChat(userId, chatId: String) {
            return stmts.insertUserChat.run(userId, chatId)
        },

        insertChat(id: String, sender, betreff: String, is_trash, datum, datumUnix) {
            return stmts.insertChat.run(id, sender, betreff, is_trash, datum, datumUnix)
        },

        chatAddContent(id: String, content: String) {
            return stmts.chatAddContent.run(content, id)
        },

        insertChatMessage(id: String, chat_id: String, sender, sender_art, betreff, content) {
            return stmts.insertChatMessage.run(id, chat_id, sender, sender_art, betreff, content)
        },

        getChatMessages(chatId: String) {
            return stmts.getChatMessages.all(chatId)
        }
    };
}

export function createDefaultMessageRepository() {
    return createMessageRepository(getDb());
}
