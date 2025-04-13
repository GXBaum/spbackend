import {DB_PATH, TABLE_NAMES} from "../config/constants.js";
import {execute} from "./sql.js";
import sqlite from "sqlite3";

// Helper function to get database connection
const getDb = () => new sqlite.Database(DB_PATH);

// User insertion function
const insertUser = async (spUsername, spPassword, notificationsEnabled = 0) => {
    const db = getDb();
    try {
        await execute(
            db,
            `INSERT OR REPLACE INTO ${TABLE_NAMES.USER} (sp_username, sp_password, notifications_enabled)
             VALUES (?, ?, ?)`,
            [spUsername, spPassword, notificationsEnabled]
        );
    } finally {
        db.close();
    }
};

const getUsers = async () => {
    const db = getDb();
    try {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM ${TABLE_NAMES.USER}`, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    } finally {
        db.close();
    }
}

// Insert course
const insertCourse = async (courseId, name) => {
    const db = getDb();
    try {
        await execute(
            db,
            `INSERT OR REPLACE INTO ${TABLE_NAMES.COURSE} (course_id, name)
             VALUES (?, ?)`,
            [courseId, name]
        );
    } finally {
        db.close();
    }
};

const deleteMarksOfHalfYear = async (spUsername, halfYear) => {
    const db = getDb();
    try {
        await execute(
            db,
            `DELETE FROM ${TABLE_NAMES.MARK} WHERE sp_username = ? AND half_year = ?`,
            [spUsername, halfYear]
        );
    } finally {
        db.close();
    }
}


// Insert user-course relationship
const insertUserCourse = async (spUsername, courseId) => {
    const db = getDb();
    try {
        await execute(
            db,
            `INSERT OR REPLACE INTO ${TABLE_NAMES.USER_COURSE} (sp_username, course_id)
             VALUES (?, ?)`,
            [spUsername, courseId]
        );
    } finally {
        db.close();
    }
};

// Insert mark
const insertMark = async ({name, date, grade, courseId, SpUsername, halfYear}) => {
    console.log("insertMark", {name, date, grade, courseId, SpUsername, halfYear});
    const db = getDb();
    try {
        await execute(
            db,
            `INSERT INTO ${TABLE_NAMES.MARK} (name, date, grade, course_id, sp_username, half_year)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, date, grade, courseId, SpUsername, halfYear]
        );
    } finally {
        db.close();
    }
};

const getUserMarks = async (spUsername) => {
    const db = getDb();
    try {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM ${TABLE_NAMES.MARK} WHERE sp_username = ?`, [spUsername], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    } finally {
        db.close();
    }
}

// Insert teacher
const insertTeacher = async ({teacherId, name, type = null, logo = null, abbreviation = null, email = null}) => {
    const db = getDb();
    try {
        await execute(
            db,
            `INSERT OR REPLACE INTO ${TABLE_NAMES.TEACHER} (teacher_id, name, type, logo, abbreviation, email)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [teacherId, name, type, logo, abbreviation, email]
        );
    } finally {
        db.close();
    }
};

// Insert course-teacher relationship
const insertCourseTeacher = async (courseId, teacherId) => {
    const db = getDb();
    try {
        await execute(
            db,
            `INSERT INTO ${TABLE_NAMES.COURSE_TEACHER} (course_id, teacher_id)
             VALUES (?, ?)`,
            [courseId, teacherId]
        );
    } finally {
        db.close();
    }
};

// Insert notification token for user
const insertUserNotificationToken = async (spUsername, token) => {
    const db = getDb();
    try {
        await execute(
            db,
            `INSERT INTO ${TABLE_NAMES.USER_NOTIFICATION_TOKEN} (sp_username, token)
             VALUES (?, ?)`,
            [spUsername, token]
        );
    } finally {
        db.close();
    }
};

const getUserNotificationToken = async (spUsername) => {
    const db = getDb();
    try {
        return new Promise((resolve, reject) => {
            db.get(`SELECT token FROM ${TABLE_NAMES.USER_NOTIFICATION_TOKEN} WHERE sp_username = ?`, [spUsername], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    } finally {
        db.close();
    }
}

// Export all functions as a single object
export default {
    insertUser,
    insertCourse,
    insertUserCourse,
    insertMark,
    insertTeacher,
    insertCourseTeacher,
    insertUserNotificationToken,
    getUserNotificationToken,
    getUserMarks,
    deleteMarksOfHalfYear,
    getUsers
};