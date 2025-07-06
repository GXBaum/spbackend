import {DB_PATH, TABLE_NAMES} from "../config/constants.js";
import {execute} from "./sql.js";
import sqlite from "sqlite3";


export const createTables = async () => {
    const db = new sqlite.Database(DB_PATH);

    try {
        // Create user table
        await execute(
            db,
            `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USER}
             (
                 sp_username           TEXT PRIMARY KEY,
                 sp_password           TEXT              NOT NULL,
                 notifications_enabled INTEGER DEFAULT 0 NOT NULL CHECK (notifications_enabled IN (0, 1))
             )`
        );

        // Create course table
        await execute(
            db,
            `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.COURSE}
             (
                 course_id INTEGER PRIMARY KEY,
                 name TEXT NOT NULL
             )`
        );

        // Create user_course table
        await execute(
            db,
            `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USER_COURSE}
             (
                 sp_username TEXT NOT NULL,
                 course_id INTEGER NOT NULL,
                 PRIMARY KEY (sp_username, course_id),
                 FOREIGN KEY (sp_username) REFERENCES ${TABLE_NAMES.USER}(sp_username) ON DELETE CASCADE,
                 FOREIGN KEY (course_id) REFERENCES ${TABLE_NAMES.COURSE}(course_id) ON DELETE CASCADE
             )`
        );

        // Create mark table
        await execute(
            db,
            `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.MARK}
             (
                 mark_id INTEGER PRIMARY KEY /*AUTOINCREMENT*/,
                 name TEXT NOT NULL,
                 date TEXT NOT NULL,
                 grade TEXT NOT NULL,
                 course_id INTEGER NOT NULL,
                 sp_username TEXT NOT NULL,
                 half_year INTEGER NOT NULL CHECK (half_year IN (1,2)),
                 FOREIGN KEY (course_id) REFERENCES ${TABLE_NAMES.COURSE}(course_id) ON DELETE CASCADE,
                 FOREIGN KEY (sp_username) REFERENCES ${TABLE_NAMES.USER}(sp_username) ON DELETE CASCADE
             )`
        );

        // Create teacher table
        await execute(
            db,
            `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.TEACHER}
             (
                 teacher_id TEXT PRIMARY KEY,
                 name TEXT NOT NULL,
                 type TEXT,
                 logo TEXT,
                 abbreviation TEXT,
                 email TEXT /*UNIQUE*/
             )`
        );

        // Create course_teacher table
        await execute(
            db,
            `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.COURSE_TEACHER}
             (
                 course_id INTEGER NOT NULL,
                 teacher_id TEXT NOT NULL,
                 PRIMARY KEY (course_id, teacher_id),
                 FOREIGN KEY (course_id) REFERENCES ${TABLE_NAMES.COURSE}(course_id) ON DELETE CASCADE,
                 FOREIGN KEY (teacher_id) REFERENCES ${TABLE_NAMES.TEACHER}(teacher_id) ON DELETE CASCADE
             )`
        );

        // Create user_notification_token table
        await execute(
            db,
            `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USER_NOTIFICATION_TOKEN}
             (
                 sp_username TEXT PRIMARY KEY,
                 token TEXT NOT NULL,
                 FOREIGN KEY (sp_username) REFERENCES ${TABLE_NAMES.USER}(sp_username) ON DELETE CASCADE
             )`
        );

        // Create user_vp_selected_courses table
        await execute(
            db,
            `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USER_VP_SELECTED_COURSES}
             (
                 sp_username TEXT NOT NULL,
                 course_name TEXT NOT NULL,
                 PRIMARY KEY (sp_username),
                 FOREIGN KEY (sp_username) REFERENCES ${TABLE_NAMES.USER}(sp_username) ON DELETE CASCADE
             )`
        );

        await execute(
            db,
            `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.VP_DIFFERENCES}(
                 day TEXT PRIMARY KEY NOT NULL CHECK (day IN ('today', 'tomorrow')),
                 data TEXT NOT NULL
             )`
        );

        // TODO: alles ändern, dass ist arsch
        await execute(
            db,
            `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.VP_SUBSTITUTION}
             (
                 substitution_id INTEGER PRIMARY KEY,
                 course_name TEXT NOT NULL,
                 day TEXT NOT NULL CHECK (day IN ('today', 'tomorrow')),
                 timestamp TEXT NOT NULL,
                 
                 vp_date TEXT NOT NULL,
                 
                 hour TEXT NOT NULL,
                 original TEXT NOT NULL,
                 replacement TEXT NOT NULL,
                 description TEXT NOT NULL
             )`
        );

        await execute(
            db,
            `CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.REFRESH_TOKEN}
                 (
                     token       TEXT PRIMARY KEY,
                     sp_username TEXT NOT NULL,
                     expires_at  TEXT NOT NULL,
                     FOREIGN KEY (sp_username) REFERENCES ${TABLE_NAMES.USER} (sp_username) ON DELETE CASCADE
                 )`
        );



    } catch (error) {
        console.log(error);
    } finally {
        db.close();
    }
};

//await createTables();