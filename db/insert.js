import {DB_PATH, TABLE_NAMES} from "../config/constants.js";
import {execute} from "./sql.js";
import sqlite from "sqlite3";
import Fuse from 'fuse.js';

// TODO: diese ineffiziente scheiße fixen, es macht immer neue db connections

// Helper function to get database connection
const getDb = () => new sqlite.Database(DB_PATH);

// User insertion function
const insertUser = async (spUsername, spPassword, notificationsEnabled = 0) => {
    const db = getDb();
    try {
        await execute(
            db,
            `INSERT INTO ${TABLE_NAMES.USER} (sp_username, sp_password, notifications_enabled)
             VALUES (?, ?, ?)`,
            [spUsername, spPassword, notificationsEnabled]
        );
    } finally {
        db.close();
    }
};

// TODO: ich glaube diese Funktion gibt es schon
const getUserByUsername = async (spUsername) => {
    const db = getDb();
    try {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM ${TABLE_NAMES.USER} WHERE sp_username = ?`, [spUsername], (err, row) => {
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

// Get marks for a specific course
const getUserMarksForCourse = async (spUsername, courseId) => {
    const db = getDb();
    try {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM ${TABLE_NAMES.MARK} WHERE sp_username = ? AND course_id = ?`,
                [spUsername, courseId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    } finally {
        db.close();
    }
};


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
            `INSERT OR REPLACE INTO ${TABLE_NAMES.COURSE_TEACHER} (course_id, teacher_id)
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
            `INSERT OR REPLACE INTO ${TABLE_NAMES.USER_NOTIFICATION_TOKEN} (sp_username, token)
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

const getUserCourses = async (spUsername) => {
    const db = getDb();
    try {
        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM ${TABLE_NAMES.USER_COURSE} WHERE sp_username = ?`, [spUsername], (err, rows) => {
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

const getUserCourseNames = async (spUsername) => {
    const db = getDb();
    try {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT c.course_id, c.name
                 FROM ${TABLE_NAMES.USER_COURSE} uc
                          JOIN ${TABLE_NAMES.COURSE} c ON uc.course_id = c.course_id
                 WHERE uc.sp_username = ?`,
                [spUsername],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    } finally {
        db.close();
    }
};

const insertUserVpSelectedCourses = async (spUsername, courseName) => {
    const db = getDb();
    try {
        await execute(
            db,
            `INSERT OR REPLACE INTO ${TABLE_NAMES.USER_VP_SELECTED_COURSE} (sp_username, course_name)
             VALUES (?, ?)`,
            [spUsername, courseName]
        );
    } finally {
        db.close();
    }
};

const deleteUserVpSelectedCourse = async (spUsername, courseName) => {
    const db = getDb();
    try {
        await execute(
            db,
            `DELETE FROM ${TABLE_NAMES.USER_VP_SELECTED_COURSE} WHERE sp_username = ? AND course_name = ?`,
            [spUsername, courseName]
        );
    } finally {
        db.close();
    }
};

const getUserVpSelectedCourses = async (spUsername) => {
    const db = getDb();
    try {
        return new Promise((resolve, reject) => {
            db.all(`SELECT course_name FROM ${TABLE_NAMES.USER_VP_SELECTED_COURSE} WHERE sp_username = ?`,
                [spUsername],
                (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => row.course_name));
                }
            });
        });
    } finally {
        db.close();
    }
}


const insertVpDifferences = async (day, data) => {
    const db = getDb();
    try {
        await execute(
            db,
            `INSERT OR REPLACE INTO ${TABLE_NAMES.VP_DIFFERENCES} (day, data)
             VALUES (?, ?)`,
            [day, data]
        );
    } finally {
        db.close();
    }
}
const getVpDifferences = async (day) => {
    const db = getDb();
    try {
        return new Promise((resolve, reject) => {
            db.get(`SELECT data FROM ${TABLE_NAMES.VP_DIFFERENCES} WHERE day = ?`, [day], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    //resolve(row);
                    resolve(row ? row.data : null); // Extract just the data field
                }
            });
        });
    } finally {
        db.close();
    }
}

const insertVpSubstitution = async (courseName, day, timestamp, hour, original, replacement, description, vpDate) => {
    const db = getDb();
    try {
        await execute(
            db,
            `INSERT INTO ${TABLE_NAMES.VP_SUBSTITUTION} (course_name, day, timestamp, hour, original, replacement, description, vp_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [courseName, day, timestamp, hour, original, replacement, description, vpDate]
        );
    } finally {
        db.close();
    }
}

const getVpSubstitutions = async (courseName, day, websiteDate) => {
    const db = getDb();
    try {
        return new Promise((resolve, reject) => {
            db.all(`SELECT hour, original, replacement, description, vp_date FROM ${TABLE_NAMES.VP_SUBSTITUTION} WHERE course_name = ? AND day = ? AND vp_date = ? ORDER BY CAST(hour AS INTEGER)`,
                [courseName, day, websiteDate],
                (err, rows) => {
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

const getVpSubstitutionsForCourses = async (courseNames, day, websiteDate) => {
    const db = getDb();
    try {
        return new Promise((resolve, reject) => {
            const placeholders = courseNames.map(() => '?').join(',');
            const sql = `
                SELECT course_name, hour, original, replacement, description, vp_date 
                FROM ${TABLE_NAMES.VP_SUBSTITUTION} 
                WHERE course_name IN (${placeholders}) AND day = ? AND vp_date = ? 
                ORDER BY course_name, CAST(hour AS INTEGER)`;

            db.all(sql, [...courseNames, day, websiteDate], (err, rows) => {
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
};

const deleteVpSubstitutionsForDay = async (day) => {
    const db = getDb();
    try {
        await execute(
            db,
            `DELETE FROM ${TABLE_NAMES.VP_SUBSTITUTION} WHERE day = ?`,
            [day]
        );
    } finally {
        db.close();
    }
}

const deleteVpSubstitutionsForCourseName = async (courseName) => {
    const db = getDb();
    try {
        await execute(
            db,
            `DELETE FROM ${TABLE_NAMES.VP_SUBSTITUTION} WHERE course_name = ?`,
            [courseName]
        );
    } finally {
        db.close();
    }
}

const getUsersWithVPCourseName = async (courseName) => {
    const db = getDb();
    try {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM ${TABLE_NAMES.USER_VP_SELECTED_COURSE} WHERE course_name = ?`,
                [courseName],
                 (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    } finally {
        db.close();
    }
};

const getVpLatestVpDate = async () => {
    const db = getDb();
    try {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT vp_day FROM ${TABLE_NAMES.VP_SUBSTITUTION} ORDER BY 'date added' DESC LIMIT 1`,
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    } finally {
        db.close();
    }
};

// ... other functions in db/insert.js

const storeRefreshToken = async (token, spUsername, expiresAt) => {
    const db = getDb();
    try {
        await execute(
            db,
            `INSERT INTO ${TABLE_NAMES.REFRESH_TOKEN} (token, sp_username, expires_at)
             VALUES (?, ?, ?)`,
            [token, spUsername, expiresAt]
        );
    } finally {
        db.close();
    }
};

const getRefreshToken = async (token) => {
    const db = getDb();
    try {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM ${TABLE_NAMES.REFRESH_TOKEN} WHERE token = ?`, [token], (err, row) => {
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
};

const deleteRefreshToken = async (token) => {
    const db = getDb();
    try {
        await execute(
            db,
            `DELETE FROM ${TABLE_NAMES.REFRESH_TOKEN} WHERE token = ?`,
            [token]
        );
    } finally {
        db.close();
    }
};

const fuzzyCourseSearch = async (searchTerm) => {
    const db = getDb();
    try {
        const courses = await new Promise((resolve, reject) => {
            const query = `SELECT * FROM ${TABLE_NAMES.COURSE}`;
            db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });

        // Normalize course names for better matching
        const processedCourses = courses.map(course => ({
            ...course,
            normalizedName: course.name.replace(/[\s./-]/g, '').toLowerCase()
        }));

        const fuseOptions = {
            keys: ['normalizedName'],
            includeScore: true,
            threshold: 0.4, // Adjust threshold for more or less strict matching
        };

        const fuse = new Fuse(processedCourses, fuseOptions);
        const normalizedSearchTerm = searchTerm.replace(/[\s./-]/g, '').toLowerCase();

        return fuse.search(normalizedSearchTerm).map(result => result.item);

    } finally {
        db.close();
    }
};

const courseSearch = async (searchTerm) => {
    const db = getDb();
    // Normalize the search term by removing special characters and converting to lowercase.
    const processedSearchTerm = searchTerm.replace(/[\/\s-]/g, '').toLowerCase();
    try {
        return new Promise((resolve, reject) => {
            // In the query, normalize the 'name' column by removing separators ('/', ' ', '-')
            // and converting to lowercase before performing a LIKE comparison.
            const query = `
                SELECT * FROM ${TABLE_NAMES.COURSE}
                WHERE REPLACE(REPLACE(REPLACE(LOWER(name), '/', ''), ' ', ''), '-', '') LIKE ?`;
            const params = [`%${processedSearchTerm}%`];

            db.all(query, params, (err, rows) => {
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
};






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
    getUserMarksForCourse,
    deleteMarksOfHalfYear,
    getUsers,
    getUserCourses,
    getUserCourseNames,
    insertUserVpSelectedCourses,
    getUserVpSelectedCourses,
    insertVpDifferences,
    getVpDifferences,
    insertVpSubstitution,
    getVpSubstitutions,
    deleteVpSubstitutionsForDay,
    deleteVpSubstitutionsForCourseName,
    getUsersWithVPCourseName,
    getVpLatestVpDate,
    getUserByUsername,
    storeRefreshToken,
    getRefreshToken,
    deleteRefreshToken,
    deleteUserVpSelectedCourse,
    getVpSubstitutionsForCourses,
    fuzzyCourseSearch,
    courseSearch,
};