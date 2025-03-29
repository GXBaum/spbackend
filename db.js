import sqlite3 from "sqlite3";

// Database path
const DB_PATH = "./databasetest.db";

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
          SpUsername TEXT PRIMARY KEY,
          SpPassword TEXT
        )`
            );

            db.run(
                `CREATE TABLE IF NOT EXISTS courses (
          courseId INTEGER PRIMARY KEY,
          name TEXT
        )`
            );

            db.run(
                `CREATE TABLE IF NOT EXISTS marks (
          markId INTEGER PRIMARY KEY,
          name TEXT,
          date TEXT,
          grade TEXT,
          courseId INTEGER,
          /*SpUsername TEXT,*/
          FOREIGN KEY(courseId) REFERENCES courses(courseId)
          /*FOREIGN KEY(SpUsername) REFERENCES users(SpUsername)*/
        )`
            );

            db.run(
                `CREATE TABLE IF NOT EXISTS teachers (
          teacherId TEXT PRIMARY KEY,
          name TEXT,
          type TEXT,
          logo TEXT,
          abbreviation TEXT,
          email TEXT
        )`
            );

            db.run(
                `CREATE TABLE IF NOT EXISTS coursesTeachers (
          courseId INTEGER,
          teacherId TEXT,
          PRIMARY KEY(courseId, teacherId),
          FOREIGN KEY(courseId) REFERENCES courses(courseId),
          FOREIGN KEY(teacherId) REFERENCES teachers(teacherId)
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
            db.run("DROP TABLE IF EXISTS teachers");
            db.run("DROP TABLE IF EXISTS courses");
            db.run("DROP TABLE IF EXISTS users");

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
    async insertCourse(course) {
        const dbConn = await getDb();
        return new Promise((resolve, reject) => {
            dbConn.run(
                "INSERT OR REPLACE INTO courses (courseId, name) VALUES (?, ?)",
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

    async insertMark(mark) {
        const dbConn = await getDb();
        return new Promise((resolve, reject) => {
            dbConn.run(
                "INSERT INTO marks (name, date, grade, courseId/*, SpUsername*/) VALUES (?, ?, ?, ?/*, ?*/)",
                [mark.name, mark.date, mark.grade, mark.courseId/*, mark.username*/],
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
                "INSERT OR REPLACE INTO teachers (teacherId, name, type, logo, abbreviation, email) VALUES (?, ?, ?, ?, ?, ?)",
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
                "INSERT OR REPLACE INTO coursesTeachers (courseId, teacherId) VALUES (?, ?)",
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