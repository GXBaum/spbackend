// just rename to sqlite3 and remove const to remove verbose
import sql3 from "sqlite3";
const sqlite3 = sql3.verbose();

// Database path
const DB_PATH = "./db/databasetest.db";

// Singleton database connection
let dbInstance = null;

// Initialize and get database instance
async function getDb() {
    if (!dbInstance) {
        dbInstance = new sqlite3.Database(
            DB_PATH,
            sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
            (err) => {
                if (err) {
                    console.error("Error opening database:", err);
                } else {
                    console.log("Connected to the database.");
                }
            }
        );

        // Enable foreign keys
        await new Promise((resolve, reject) => {
            dbInstance.run("PRAGMA foreign_keys = ON", (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Initialize tables
        await initTables(dbInstance);
    }
    return dbInstance;
}

// Initialize tables
async function initTables(db) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(
                `CREATE TABLE IF NOT EXISTS users (
          sp_username TEXT PRIMARY KEY,
          sp_password TEXT,
          is_notifications_enabled INTEGER DEFAULT 0

                 )`
            );

            db.run(
                `CREATE TABLE IF NOT EXISTS courses (
          course_id INTEGER PRIMARY KEY,
          name TEXT
        )`
            );

            db.run(
                `CREATE TABLE IF NOT EXISTS userCourses (
                                                            sp_username TEXT,
                                                            course_id INTEGER,
                                                            PRIMARY KEY(sp_username, course_id),
                                                            FOREIGN KEY(sp_username) REFERENCES users(sp_username),
                                                            FOREIGN KEY(course_id) REFERENCES courses(course_id)
                 )`,
            );

            db.run(
                `CREATE TABLE IF NOT EXISTS marks (
          mark_id INTEGER PRIMARY KEY,
          name TEXT,
          date TEXT,
          grade TEXT,
          course_id INTEGER,
          sp_username TEXT,
          half_year INTEGER,
          FOREIGN KEY(course_id) REFERENCES courses(course_id),
          FOREIGN KEY(sp_username) REFERENCES users(sp_username)
        )`);

            db.run(
                `CREATE TABLE IF NOT EXISTS teachers (
          teacher_id TEXT PRIMARY KEY,
          name TEXT,
          type TEXT,
          logo TEXT,
          abbreviation TEXT,
          email TEXT
        )`);

            db.run(
                `CREATE TABLE IF NOT EXISTS coursesTeachers (
          course_id INTEGER,
          teacher_id TEXT,
          PRIMARY KEY(course_id, teacher_id),
          FOREIGN KEY(course_id) REFERENCES courses(course_id),
          FOREIGN KEY(teacher_id) REFERENCES teachers(teacher_id)
        )`,);

            db.run(
                    `CREATE TABLE IF NOT EXISTS userNotificationTokens (
            sp_username TEXT,
            token TEXT,
            PRIMARY KEY(sp_username),
            FOREIGN KEY(sp_username) REFERENCES users(sp_username)
        )`,

                (err) => {
                    if (err) {
                        console.error("Error initializing tables:", err);
                        reject(err);
                    } else {
                        console.log("All tables initialized successfully.");
                        resolve();
                    }
                }
            );
        });
    });
}

// Reset database
async function resetDb() {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("PRAGMA foreign_keys = OFF");

            db.run("DROP TABLE IF EXISTS coursesTeachers");
            db.run("DROP TABLE IF EXISTS marks");
            db.run("DROP TABLE IF EXISTS userCourses");
            db.run("DROP TABLE IF EXISTS teachers");
            db.run("DROP TABLE IF EXISTS courses");
            db.run("DROP TABLE IF EXISTS users");
            db.run("DROP TABLE IF EXISTS userNotificationTokens")


            db.run("PRAGMA foreign_keys = ON", (err) => {
                if (err) {
                    console.error("Error resetting database:", err);
                    reject(err);
                } else {
                    console.log("All tables dropped successfully.");
                    initTables(db)
                        .then(() => resolve(true))
                        .catch(reject);
                }
            });
        });
    });
}

// Database operations
const db = {

    async insertUser(spUsername, spPassword, isNotificationsEnabled = 0) {
        const dbConn = await getDb();
        return new Promise((resolve, reject) => {
            dbConn.run(
                "INSERT OR REPLACE INTO users (sp_username, sp_password, is_notifications_enabled) VALUES (?, ?, ?)",
                [spUsername, spPassword, isNotificationsEnabled],
                function (err) {
                    if (err) {
                        console.error("Error inserting user:", err);
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    },

    async insertCourse(course) {
        const dbConn = await getDb();
        return new Promise((resolve, reject) => {
            dbConn.run(
                "INSERT OR REPLACE INTO courses (course_id, name) VALUES (?, ?)",
                [course.id, course.name],
                function (err) {
                    if (err) {
                        console.error("Error inserting course:", err);
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    },
    async deleteAllMarksOfHalfYear(SpUsername, halfYear) {
        const dbConn = await getDb();
        return new Promise((resolve, reject) => {
            dbConn.run(
                "DELETE FROM marks WHERE sp_username = ? AND half_year = ?",
                [SpUsername, halfYear],
                function (err) {
                    if (err) {
                        console.error("Error deleting existing marks:", err);
                        reject(err);
                    } else {
                        console.log("Existing marks deleted successfully.");
                        resolve(this.lastID);
                    }
                }
            );
        });
    },

    async insertMark(mark) {
        const dbConn = await getDb();
        return new Promise((resolve, reject) => {
            dbConn.run(
                "INSERT INTO marks (name, date, grade, course_id, sp_username, half_year) VALUES (?, ?, ?, ?, ?, ?)",
                [mark.name, mark.date, mark.grade, mark.courseId, mark.SpUsername, mark.halfYear],
                function (err) {
                    if (err) {
                        console.error("Error inserting mark:", err);
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    },

    async insertTeacher(teacher) {
        const dbConn = await getDb();
        return new Promise((resolve, reject) => {
            dbConn.run(
                "INSERT OR REPLACE INTO teachers (teacher_id, name, type, logo, abbreviation, email) VALUES (?, ?, ?, ?, ?, ?)",
                [
                    teacher.id,
                    teacher.name,
                    teacher.type,
                    teacher.logo,
                    teacher.abbreviation,
                    teacher.email,
                ],
                function (err) {
                    if (err) {
                        console.error("Error inserting teacher:", err);
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    },

    async insertCourseTeacher(courseId, teacherId) {
        const dbConn = await getDb();
        return new Promise((resolve, reject) => {
            dbConn.run(
                "INSERT OR REPLACE INTO coursesTeachers (course_id, teacher_id) VALUES (?, ?)",
                [courseId, teacherId],
                (err) => {
                    if (err) {
                        console.error("Error inserting course-teacher relationship:", err);
                        reject(err);
                    } else {
                        resolve(true);
                    }
                }
            );
        });
    },

    async insertUserCourse(SpUsername, courseId) {
        const dbConn = await getDb();
        return new Promise((resolve, reject) => {
            dbConn.run(
                "INSERT OR REPLACE INTO userCourses (sp_username, course_id) VALUES (?, ?)",
                [SpUsername, courseId],
                (err) => {
                    if (err) {
                        console.error("Error inserting user-course relationship:", err);
                        reject(err);
                    } else {
                        resolve(true);
                    }
                }
            );
        });
    },

    async insertUserNotificationToken(SpUsername, token) {
        const dbConn = await getDb();
        return new Promise((resolve, reject) => {
            dbConn.run(
                "INSERT OR REPLACE INTO userNotificationTokens (sp_username, token) VALUES (?, ?)",
                [SpUsername, token],
                (err) => {
                    if (err) {
                        console.error("Error inserting user notification token:", err);
                        reject(err);
                    } else {
                        resolve(true);
                    }
                }
            );
        });
    },

    async getUserNotificationToken(SpUsername) {
        const dbConn = await getDb();
        return new Promise((resolve, reject) => {
            dbConn.get(
                "SELECT token FROM userNotificationTokens WHERE sp_username = ?",
                [SpUsername],
                (err, row) => {
                    if (err) {
                        console.error("Error fetching user notification token:", err);
                        reject(err);
                    } else {
                        resolve(row ? row.token : null);
                    }
                }
            );
        });
    },

    async getUserGrades(SpUsername) {
        const dbConn = await getDb();
        return new Promise((resolve, reject) => {
            // First check if any records exist at all
            dbConn.get("SELECT COUNT(*) as count FROM marks", [], (countErr, countResult) => {
                if (countErr) {
                    console.error("Error checking marks table:", countErr);
                    reject(countErr);
                    return;
                }

                console.log(`Total records in marks table: ${countResult.count}`);

                // Now get the user's grades
                dbConn.all(
                    "SELECT * FROM marks WHERE sp_username = ?",
                    [SpUsername],
                    (err, rows) => {
                        if (err) {
                            console.error("Error fetching user grades:", err);
                            reject(err);
                        } else {
                            console.log(`Found ${rows.length} grades for user ${SpUsername}`);
                            resolve(rows);
                        }
                    }
                );
            });
        });
    },
    async close() {
        if (dbInstance) {
            return new Promise((resolve, reject) => {
                dbInstance.close((err) => {
                    if (err) {
                        console.error("Error closing database:", err);
                        reject(err);
                    } else {
                        console.log("Database connection closed.");
                        dbInstance = null;
                        resolve();
                    }
                });
            });
        }
    },
};

export { getDb, resetDb, db };