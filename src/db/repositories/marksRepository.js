import {getDb} from "../client.js";

export function createMarkRepository(db) {
    if (!db) throw new Error("createMarkRepository: db required");
    const stmts = {
        deleteMarksOfHalfYear: db.prepare(`
            DELETE
            FROM sp_mark
            WHERE user_id = ?
              AND half_year = ?`),
        insertMark: db.prepare(`
            INSERT OR IGNORE INTO sp_mark (name, date, grade, course_id, user_id, half_year)
            VALUES (?, ?, ?, ?, ?, ?)
        `),
        markMarkAsDeleted: db.prepare(`
            UPDATE sp_mark
            SET is_deleted = 1,
                updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
            WHERE name = ?
              AND date = ?
              AND grade = ?
              AND half_year = ?
              AND course_id = ?
              AND user_id = ?
              AND is_deleted = 0
        `),
        getUserMarks: db.prepare(`
            SELECT *
            FROM sp_mark
            WHERE user_id = ?
            ORDER BY date DESC
            `),
        getUserMarksForCourse: db.prepare(`
            SELECT *
            FROM sp_mark
            WHERE user_id = ?
              AND course_id = ?
            ORDER BY date DESC
        `),
    };

    return {
        deleteMarksOfHalfYear(userId, halfYear) {
            stmts.deleteMarksOfHalfYear.run(userId, halfYear);
        },
        insertMark(mark) {
            const {name, date, grade, courseId, userId, halfYear} = mark;
            stmts.insertMark.run(name, date, grade, courseId, userId, halfYear);
        },
        markMarkAsDeleted(mark) {
            const {name, date, grade, halfYear, courseId, userId} = mark;
            stmts.markMarkAsDeleted.run(name, date, grade, halfYear, courseId, userId);
        },
        getUserMarks(userId) {
            return stmts.getUserMarks.all(userId);
        },
        getUserActiveMarks(userId) {
            return stmts.getUserMarks.all(userId).filter(m => m.is_deleted === 0);
        },
        getUserMarksForCourse(userId, courseId) {
            return stmts.getUserMarksForCourse.all(userId, courseId);
        },
    };
}

export function createDefaultMarkRepository() {
    return createMarkRepository(getDb());
}