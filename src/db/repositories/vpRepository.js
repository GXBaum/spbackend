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


        getCourseIdByName: db.prepare(`SELECT id FROM vp_course_lookup WHERE name = ?`),
        insertCourseLookup: db.prepare(`
            INSERT INTO vp_course_lookup (name)
            VALUES (?)
            ON CONFLICT(name) DO NOTHING
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
        listAllSubstitutionsForDay: db.prepare(`
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

        // substitutions v2
        listSubstitutionsV2: db.prepare(`
            SELECT c.name AS course, c.id AS course_id, s.hour, s.original, s.replacement, s.description, s.vp_date
            FROM vp_substitution_v2 s
            JOIN vp_course_lookup c ON c.id = s.course_id
            WHERE c.name = ?
              AND s.day = ?
              AND s.vp_date = ?
              AND s.is_deleted = 0
            ORDER BY CAST(s.hour AS INTEGER)
        `),
        listAllSubstitutionsV2: db.prepare(`
            SELECT c.name AS course, c.id AS course_id, s.hour, s.original, s.replacement, s.description, s.vp_date, s.is_deleted
            FROM vp_substitution_v2 s
            JOIN vp_course_lookup c ON c.id = s.course_id
            WHERE c.name = ?
              AND s.day = ?
              AND s.vp_date = ?
            ORDER BY CAST(s.hour AS INTEGER)
        `),
        listAllSubstitutionsForDayV2: db.prepare(`
            SELECT c.name AS course, c.id AS course_id, s.hour, s.original, s.replacement, s.description, s.vp_date, s.is_deleted
            FROM vp_substitution_v2 s
            JOIN vp_course_lookup c ON c.id = s.course_id
            WHERE s.day = ?
              AND s.vp_date = ?
            ORDER BY c.name, CAST(s.hour AS INTEGER)
        `),
        insertSubstitutionV2: db.prepare(`
            INSERT OR IGNORE INTO vp_substitution_v2
                (course_id, day, hour, original, replacement, description, vp_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `),
        markSubstitutionAsDeletedV2: db.prepare(`
            UPDATE vp_substitution_v2
            SET is_deleted = 1
            WHERE course_id = ?
              AND day = ?
              AND COALESCE(hour, '') = COALESCE(?, '')
              AND COALESCE(original, '') = COALESCE(?, '')
              AND COALESCE(replacement, '') = COALESCE(?, '')
              AND COALESCE(description, '') = COALESCE(?, '')
              AND vp_date = ?
              AND is_deleted = 0
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


        // different rooms v2
        listDifferentRoomsV2: db.prepare(`
            SELECT c.name AS course, c.id AS course_id, s.hour, s.original, s.replacement, s.description, s.vp_date
            FROM vp_different_room_v2 s
                     JOIN vp_course_lookup c ON c.id = s.course_id
            WHERE c.name = ?
              AND s.day = ?
              AND s.vp_date = ?
              AND s.is_deleted = 0
            ORDER BY CAST(s.hour AS INTEGER)
        `),
        listAllDifferentRoomsV2: db.prepare(`
            SELECT c.name AS course, c.id AS course_id, s.hour, s.original, s.replacement, s.description, s.vp_date, s.is_deleted
            FROM vp_different_room_v2 s
                     JOIN vp_course_lookup c ON c.id = s.course_id
            WHERE c.name = ?
              AND s.day = ?
              AND s.vp_date = ?
            ORDER BY CAST(s.hour AS INTEGER)
        `),
        listAllDifferentRoomsForDayV2: db.prepare(`
            SELECT c.name AS course, c.id AS course_id, s.hour, s.original, s.replacement, s.description, s.vp_date, s.is_deleted
            FROM vp_different_room_v2 s
                     JOIN vp_course_lookup c ON c.id = s.course_id
            WHERE s.day = ?
              AND s.vp_date = ?
            ORDER BY c.name, CAST(s.hour AS INTEGER)
        `),
        insertDifferentRoomsV2: db.prepare(`
            INSERT OR IGNORE INTO vp_different_room_v2
                (course_id, day, hour, original, replacement, description, vp_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `),
        markDifferentRoomAsDeletedV2: db.prepare(`
            UPDATE vp_different_room_v2
            SET is_deleted = 1
            WHERE course_id = ?
              AND day = ?
              AND COALESCE(hour, '') = COALESCE(?, '')
              AND COALESCE(original, '') = COALESCE(?, '')
              AND COALESCE(replacement, '') = COALESCE(?, '')
              AND COALESCE(description, '') = COALESCE(?, '')
              AND vp_date = ?
              AND is_deleted = 0
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

        // other
        getLatestVpDate: db.prepare(`
            SELECT vp_date
            FROM vp_substitution_v2
            ORDER BY vp_date DESC
            LIMIT 1
        `),
    };

    function getOrCreateCourseId(course) {
        if (!course) return null;
        const existing = stmts.getCourseIdByName.pluck().get(course);
        if (existing) return existing;
        const res = stmts.insertCourseLookup.run(course);
        return res.changes ? res.lastInsertRowid : stmts.getCourseIdByName.pluck().get(course);
    }

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


        // substitutions v2
        listSubstitutions(course, day, vpDate) {
            return stmts.listSubstitutionsV2.all(course, day, vpDate);
        },
        listAllSubstitutions(course, day, vpDate) {
            return stmts.listAllSubstitutionsV2.all(course, day, vpDate);
        },
        listAllSubstitutionsForDay(day, vpDate) {
            return stmts.listAllSubstitutionsForDayV2.all(day, vpDate);
        },
        insertSubstitution({course, day, hour, original, replacement, description, vp_date}) {
            const courseId = getOrCreateCourseId(course);
            if (!courseId) return;
            stmts.insertSubstitutionV2.run(
                courseId,
                day,
                hour ?? null,
                original ?? null,
                replacement ?? null,
                description ?? null,
                vp_date
            );
        },
        markSubstitutionAsDeleted({course, day, hour, original, replacement, description, vp_date}) {
            const courseId = getOrCreateCourseId(course);
            if (!courseId) return false;
            return stmts.markSubstitutionAsDeletedV2.run(
                courseId,
                day,
                hour ?? null,
                original ?? null,
                replacement ?? null,
                description ?? null,
                vp_date
            ).changes > 0;
        },
        listSubstitutionsForCourses(courses, day, vpDate) {
            if (!courses?.length) return [];
            const placeholders = courses.map(() => "?").join(",");
            const sql = `
                SELECT c.name AS course, s.hour, s.original, s.replacement, s.description, s.vp_date
                FROM vp_substitution_v2 s
                         JOIN vp_course_lookup c ON c.id = s.course_id
                WHERE course IN (${placeholders})
                  AND s.day = ?
                  AND s.vp_date = ?
                  AND s.is_deleted = 0
                ORDER BY course, CAST(s.hour AS INTEGER)
            `;
            return db.prepare(sql).all(...courses, day, vpDate);
        },
        listAllSubstitutionsForCourses(courses, day, vpDate) {
            if (!courses?.length) return [];
            const placeholders = courses.map(() => "?").join(",");
            const sql = `
                SELECT c.name AS course, s.hour, s.original, s.replacement, s.description, s.vp_date, s.is_deleted
                FROM vp_substitution_v2 s
                         JOIN vp_course_lookup c ON c.id = s.course_id
                WHERE course IN (${placeholders})
                  AND s.day = ?
                  AND s.vp_date = ?
                ORDER BY course, CAST(s.hour AS INTEGER)
            `;
            return db.prepare(sql).all(...courses, day, vpDate);
        },







        listDifferentRooms(course, day, vpDate) {
            return stmts.listDifferentRoomsV2.all(course, day, vpDate);
        },
        listAllDifferentRooms(course, day, vpDate) {
            return stmts.listAllDifferentRoomsV2.all(course, day, vpDate);
        },
        listAllDifferentRoomsForDay(day, vpDate) {
            return stmts.listAllDifferentRoomsForDayV2.all(day, vpDate);
        },
        insertDifferentRoom({course, day, hour, original, replacement, description, vp_date}) {
            const courseId = getOrCreateCourseId(course);
            if (!courseId) return;
            stmts.insertDifferentRoomsV2.run(
                courseId,
                day,
                hour ?? null,
                original ?? null,
                replacement ?? null,
                description ?? null,
                vp_date
            );
        },
        markDifferentRoomAsDeleted({course, day, hour, original, replacement, description, vp_date}) {
            const courseId = getOrCreateCourseId(course);
            if (!courseId) return false;
            return stmts.markDifferentRoomAsDeletedV2.run(
                courseId,
                day,
                hour ?? null,
                original ?? null,
                replacement ?? null,
                description ?? null,
                vp_date
            ).changes > 0;
        },
        listDifferentRoomsForCourses(courses, day, vpDate) {
            if (!courses?.length) return [];
            const placeholders = courses.map(() => "?").join(",");
            return db.prepare(`
                SELECT c.name AS course, s.hour, s.original, s.replacement, s.description, s.vp_date
                FROM vp_different_room_v2 s
                         JOIN vp_course_lookup c ON c.id = s.course_id
                WHERE course IN (${placeholders})
                  AND s.day = ?
                  AND s.vp_date = ?
                  AND s.is_deleted = 0
                ORDER BY course, CAST(s.hour AS INTEGER)
            `).all(...courses, day, vpDate);
        },
        listAllDifferentRoomsForCourses(courses, day, vpDate) {
            if (!courses?.length) return [];
            const placeholders = courses.map(() => "?").join(",");
            return db.prepare(`
                SELECT c.name AS course, s.hour, s.original, s.replacement, s.description, s.vp_date, s.is_deleted
                FROM vp_different_room_v2 s
                         JOIN vp_course_lookup c ON c.id = s.course_id
                WHERE course IN (${placeholders})
                  AND s.day = ?
                  AND s.vp_date = ?
                ORDER BY course, CAST(s.hour AS INTEGER)
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
                SELECT DISTINCT name AS course
                FROM vp_course_lookup
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
