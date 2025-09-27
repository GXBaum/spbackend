import {getDb} from "../client.js";

export function createCourseRepository(db) {
    if (!db) throw new Error("createCourseRepository: db required");
    const stmts = {
        insertCourse: db.prepare(`
            INSERT OR IGNORE INTO sp_course (id, name)
            VALUES (?, ?)
        `),
        insertUserCourse: db.prepare(`
            INSERT OR IGNORE INTO user_sp_course (user_id, course_id)
            VALUES (?, ?)
        `),
        getUserCourses: db.prepare(`
            SELECT course_id
            FROM user_sp_course
            WHERE user_id = ?
        `),
        getUserCourseNames: db.prepare(`
            SELECT uc.course_id, s.name
            FROM user_sp_course uc
                     JOIN sp_course s ON s.id = uc.course_id
            WHERE uc.user_id = ?
            ORDER BY s.name
        `),
        selectAllCourses: db.prepare(`
            SELECT id, name
            FROM sp_course
        `),
    };

    return {
        insertCourse(id, name) {
            stmts.insertCourse.run(id, name);
        },
        addUserCourse(userId, courseId) {
            stmts.insertUserCourse.run(userId, courseId);
        },
        getUserCourses(userId) {
            return stmts.getUserCourses.all(userId).map(r => r.course_id);
        },
        getUserCourseNames(userId) {
            return stmts.getUserCourseNames.all(userId);
        },
        listAllCourses() {
            return stmts.selectAllCourses.all();
        }
    };
}

export function createDefaultCourseRepository() {
    return createCourseRepository(getDb());
}