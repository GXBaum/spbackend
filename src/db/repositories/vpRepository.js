import {getDb} from "../client.js";

export function createVpRepository(db) {
    if (!db) throw new Error("createVpRepository: db required");

    const stmts = {
        // vp_difference
        getPlanHtml: db.prepare(`
            SELECT data
            FROM vp_difference
            WHERE day = ?
        `),

        upsertPlanHtml: db.prepare(`
            INSERT INTO vp_difference (day, data)
            VALUES (?, ?)
            ON CONFLICT(day) DO UPDATE SET data       = excluded.data,
                                           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        `),

        // raw history
        insertRawHistory: db.prepare(`
            INSERT INTO vp_raw_history (day, data)
            VALUES (?, ?)
        `),

        // substitutions
        listSubstitutions: db.prepare(`
            SELECT course, hour, original, replacement, description, vp_date
            FROM vp_substitution
            WHERE course = ?
              AND day = ?
              AND vp_date = ?
              AND is_deleted = 0
            ORDER BY CAST(hour AS INTEGER)
        `),
        listAllSubstitutions: db.prepare(`
            SELECT course, hour, original, replacement, description, vp_date, is_deleted
            FROM vp_substitution
            WHERE course = ?
              AND day = ?
              AND vp_date = ?
            ORDER BY CAST(hour AS INTEGER)
        `),
        listAllSubstitutionsforDay: db.prepare(`
            SELECT course, hour, original, replacement, description, vp_date
            FROM vp_substitution
            WHERE day = ?
              AND vp_date = ?
              AND is_deleted = 0
            ORDER BY CAST(hour AS INTEGER)
        `),
        insertSubstitution: db.prepare(`
            INSERT OR IGNORE INTO vp_substitution
                (course, day, hour, original, replacement, description, vp_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `),
        markSubstitutionAsDeleted: db.prepare(`
            UPDATE vp_substitution
            SET is_deleted = 1
            WHERE course = ?
              AND day = ?
              AND hour = ?
              AND original = ?
              AND replacement = ?
              AND description = ?
              AND vp_date = ?
              AND is_deleted = 0
        `),
        deleteVpSubstitutionsForDay: db.prepare(`
            DELETE
            FROM vp_substitution
            WHERE day = ?
        `),
        deleteVpSubstitutionsForCourse: db.prepare(`
            DELETE
            FROM vp_substitution
            WHERE course = ?
        `),
        getLatestVpDate: db.prepare(`
            SELECT vp_date
            FROM vp_substitution
            ORDER BY vp_date DESC
            LIMIT 1
        `),

        // different rooms
        listDifferentRooms: db.prepare(`
            SELECT course, hour, original, replacement, description, vp_date
            FROM vp_different_room
            WHERE course = ?
              AND day = ?
              AND vp_date = ?
              AND is_deleted = 0
            ORDER BY CAST(hour AS INTEGER)
        `),
        listAllDifferentRooms: db.prepare(`
            SELECT course, hour, original, replacement, description, vp_date, is_deleted
            FROM vp_different_room
            WHERE course = ?
              AND day = ?
              AND vp_date = ?
            ORDER BY CAST(hour AS INTEGER)
        `),
        listAllDifferentRoomsforDay: db.prepare(`
            SELECT course, hour, original, replacement, description, vp_date
            FROM vp_different_room
            WHERE day = ?
              AND vp_date = ?
              AND is_deleted = 0
            ORDER BY CAST(hour AS INTEGER)
        `),
        insertDifferentRoom: db.prepare(`
            INSERT OR IGNORE INTO vp_different_room
                (course, day, hour, original, replacement, description, vp_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `),
        markDifferentRoomAsDeleted: db.prepare(`
            UPDATE vp_different_room
            SET is_deleted = 1
            WHERE course = ?
              AND day = ?
              AND hour = ?
              AND original = ?
              AND replacement = ?
              AND description = ?
              AND vp_date = ?
              AND is_deleted = 0
        `),
        deleteVpDifferentRoomsForDay: db.prepare(`
            DELETE
            FROM vp_different_room
            WHERE day = ?
        `),
        deleteVpDifferentRoomsForCourse: db.prepare(`
            DELETE
            FROM vp_different_room
            WHERE course = ?
        `),

        // user selected courses
        insertUserVpSelectedCourse: db.prepare(`
            INSERT OR IGNORE INTO user_vp_course (user_id, course)
            VALUES (?, ?)
        `),
        deleteUserVpSelectedCourse: db.prepare(`
            DELETE
            FROM user_vp_course
            WHERE user_id = ?
              AND course = ?
        `),
        getUserVpSelectedCourses: db.prepare(`
            SELECT course
            FROM user_vp_course
            WHERE user_id = ?
            ORDER BY course
        `),
        getUsersWithVPCourseName: db.prepare(`
            SELECT user_id
            FROM user_vp_course
            WHERE course = ?
        `),

        insertVpInfo: db.prepare(`
            INSERT INTO vp_info (day, data, summary)
            VALUES (?, ?, ?)
        `),
        getLatestVpInfo: db.prepare(`
            SELECT *
            FROM vp_info
            WHERE day = ?
            ORDER BY fetched_at DESC
            LIMIT 1
        `),
        getLatestVpInfoBothDays: db.prepare(`
            SELECT *
            FROM vp_info v
            WHERE v.fetched_at = (
                SELECT MAX(fetched_at)
                FROM vp_info
                WHERE day = v.day
            )
            AND (v.day = 'today' OR v.day = 'tomorrow')
        `),
        getVpInfoHistory: db.prepare(`
            SELECT *
            FROM vp_info
            WHERE day = ?
            ORDER BY fetched_at ASC
        `),
    };

    return {
        // vp_difference
        getPlanHtml(day) {
            return stmts.getPlanHtml.pluck().get(day) ?? null;
        },
        upsertPlanHtml(day, html) {
            stmts.upsertPlanHtml.run(day, html);
        },
        insertRawHistory(day, data) {
            stmts.insertRawHistory.run(day, data);
        },

        // substitutions
        listSubstitutions(course, day, vpDate) {
            return stmts.listSubstitutions.all(course, day, vpDate);
        },
        listAllSubstitutions(course, day, vpDate) {
            return stmts.listAllSubstitutions.all(course, day, vpDate);
        },
        insertSubstitution({course, day, hour, original, replacement, description, vp_date}) {
            stmts.insertSubstitution.run(
                course,
                day,
                hour ?? null,
                original ?? null,
                replacement ?? null,
                description ?? null,
                vp_date
            );
        },
        listSubstitutionsForCourses(courses, day, vpDate) {
            if (!courses?.length) return [];
            const placeholders = courses.map(() => "?").join(",");
            const sql = `
                SELECT course, hour, original, replacement, description, vp_date
                FROM vp_substitution
                WHERE course IN (${placeholders})
                  AND day = ?
                  AND vp_date = ?
                  AND is_deleted = 0
                ORDER BY course, CAST(hour AS INTEGER)
            `;
            return db.prepare(sql).all(...courses, day, vpDate);
        },
        listAllSubstitutionsForCourses(courses, day, vpDate) {
            if (!courses?.length) return [];
            const placeholders = courses.map(() => "?").join(",");
            const sql = `
                SELECT course, hour, original, replacement, description, vp_date, is_deleted
                FROM vp_substitution
                WHERE course IN (${placeholders})
                  AND day = ?
                  AND vp_date = ?
                ORDER BY course, CAST(hour AS INTEGER)
            `;
            return db.prepare(sql).all(...courses, day, vpDate);
        },
        listAllSubstitutionsForDay(day, vpDate) {
            return stmts.listAllSubstitutionsforDay.all(day, vpDate);
        },
        deleteSubstitutionsForDay(day) {
            stmts.deleteVpSubstitutionsForDay.run(day);
        },
        deleteSubstitutionsForCourse(course) {
            stmts.deleteVpSubstitutionsForCourse.run(course);
        },
        markSubstitutionAsDeleted({course, day, hour, original, replacement, description, vp_date}) {
            return stmts.markSubstitutionAsDeleted.run(
                course, day, hour ?? null, original ?? null, replacement ?? null, description ?? null, vp_date
            ).changes > 0;
        },



        listDifferentRooms(course, day, vpDate) {
            return stmts.listDifferentRooms.all(course, day, vpDate);
        },
        listAllDifferentRooms(course, day, vpDate) {
            return stmts.listAllDifferentRooms.all(course, day, vpDate);
        },
        listAllDifferentRoomsForDay(day, vpDate) {
            return stmts.listAllDifferentRoomsforDay.all(day, vpDate);
        },
        insertDifferentRoom({course, day, hour, original, replacement, description, vp_date}) {
            stmts.insertDifferentRoom.run(
                course,
                day,
                hour ?? null,
                original ?? null,
                replacement ?? null,
                description ?? null,
                vp_date
            );
        },
        markDifferentRoomAsDeleted({course, day, hour, original, replacement, description, vp_date}) {
            return stmts.markDifferentRoomAsDeleted.run(
                course, day, hour ?? null, original ?? null, replacement ?? null, description ?? null, vp_date
            ).changes > 0;
        },
        deleteDifferentRoomsForDay(day) {
            stmts.deleteVpDifferentRoomsForDay.run(day);
        },
        deleteDifferentRoomsForCourse(course) {
            stmts.deleteVpDifferentRoomsForCourse.run(course);
        },
        listDifferentRoomsForCourses(courses, day, vpDate) {
            if (!courses?.length) return [];
            const placeholders = courses.map(() => "?").join(",");
            return db.prepare(`
                SELECT course, hour, original, replacement, description, vp_date
                FROM vp_different_room
                WHERE course IN (${placeholders})
                  AND day = ?
                  AND vp_date = ?
                  AND is_deleted = 0
                ORDER BY course, CAST(hour AS INTEGER)
            `).all(...courses, day, vpDate);
        },
        listAllDifferentRoomsForCourses(courses, day, vpDate) {
            if (!courses?.length) return [];
            const placeholders = courses.map(() => "?").join(",");
            return db.prepare(`
                SELECT course, hour, original, replacement, description, vp_date, is_deleted
                FROM vp_different_room
                WHERE course IN (${placeholders})
                  AND day = ?
                  AND vp_date = ?
                ORDER BY course, CAST(hour AS INTEGER)
            `).all(...courses, day, vpDate);
        },






        getLatestVpDate() {
            return stmts.getLatestVpDate.pluck().get() ?? null;
        },

        insertUserVpSelectedCourse(userId, course) {
            return stmts.insertUserVpSelectedCourse.run(userId, course);
        },
        deleteUserVpSelectedCourse(userId, course) {
            return stmts.deleteUserVpSelectedCourse.run(userId, course);
        },
        getUserVpSelectedCourses(userId) {
            return stmts.getUserVpSelectedCourses.all(userId);
        },

        getUsersWithVPCourseName(course) {
            return stmts.getUsersWithVPCourseName.all(course);
        },

        insertVpInfo(day, data, summary) {
            stmts.insertVpInfo.run(day, data, summary);
        },
        getLatestVpInfo(day) {
            return stmts.getLatestVpInfo.get(day);
        },
        getLatestVpInfoBothDays() {
            return stmts.getLatestVpInfoBothDays.all();
        },
        getVpInfoHistory(day) {
            return stmts.getVpInfoHistory.all(day);
        },

        // TODO do this differently/ somewhere else
        courseSearch(searchTerm) {
            if (!searchTerm) return [];
            const normalized = searchTerm.replace(/[\/\s-]/g, "").toLowerCase();
            const sql = `
                SELECT DISTINCT course
                FROM vp_substitution
                WHERE lower(
                              REPLACE(
                                      REPLACE(
                                              REPLACE(course, '/', ''),
                                              ' ', ''),
                                      '-', '')
                      ) LIKE ?
                ORDER BY course
            `;
            return db.prepare(sql).all(`%${normalized}%`).map(r => r.course);
        }
    };
}

export function createDefaultVpRepository() {
    return createVpRepository(getDb());
}
