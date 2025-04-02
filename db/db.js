// Import SQLite with verbose mode
import sql3 from "sqlite3";
const sqlite3 = sql3.verbose();

// Database constants
const DB_PATH = "./db/databasetest.db";
const TABLES = {
  USERS: "users",
  COURSES: "courses",
  USER_COURSES: "userCourses",
  MARKS: "marks",
  TEACHERS: "teachers",
  COURSES_TEACHERS: "coursesTeachers",
  USER_NOTIFICATION_TOKENS: "userNotificationTokens"
};

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
        `CREATE TABLE IF NOT EXISTS ${TABLES.USERS} (
          sp_username TEXT PRIMARY KEY,
          sp_password TEXT,
          is_notifications_enabled INTEGER DEFAULT 0
        )`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS ${TABLES.COURSES} (
          course_id INTEGER PRIMARY KEY,
          name TEXT
        )`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS ${TABLES.USER_COURSES} (
          sp_username TEXT,
          course_id INTEGER,
          PRIMARY KEY(sp_username, course_id),
          FOREIGN KEY(sp_username) REFERENCES ${TABLES.USERS}(sp_username),
          FOREIGN KEY(course_id) REFERENCES ${TABLES.COURSES}(course_id)
        )`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS ${TABLES.MARKS} (
          mark_id INTEGER PRIMARY KEY,
          name TEXT,
          date TEXT,
          grade TEXT,
          course_id INTEGER,
          sp_username TEXT,
          half_year INTEGER,
          FOREIGN KEY(course_id) REFERENCES ${TABLES.COURSES}(course_id),
          FOREIGN KEY(sp_username) REFERENCES ${TABLES.USERS}(sp_username)
        )`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS ${TABLES.TEACHERS} (
          teacher_id TEXT PRIMARY KEY,
          name TEXT,
          type TEXT,
          logo TEXT,
          abbreviation TEXT,
          email TEXT
        )`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS ${TABLES.COURSES_TEACHERS} (
          course_id INTEGER,
          teacher_id TEXT,
          PRIMARY KEY(course_id, teacher_id),
          FOREIGN KEY(course_id) REFERENCES ${TABLES.COURSES}(course_id),
          FOREIGN KEY(teacher_id) REFERENCES ${TABLES.TEACHERS}(teacher_id)
        )`
      );

      db.run(
        `CREATE TABLE IF NOT EXISTS ${TABLES.USER_NOTIFICATION_TOKENS} (
          sp_username TEXT,
          token TEXT,
          PRIMARY KEY(sp_username),
          FOREIGN KEY(sp_username) REFERENCES ${TABLES.USERS}(sp_username)
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

      db.run(`DROP TABLE IF EXISTS ${TABLES.COURSES_TEACHERS}`);
      db.run(`DROP TABLE IF EXISTS ${TABLES.MARKS}`);
      db.run(`DROP TABLE IF EXISTS ${TABLES.USER_COURSES}`);
      db.run(`DROP TABLE IF EXISTS ${TABLES.TEACHERS}`);
      db.run(`DROP TABLE IF EXISTS ${TABLES.COURSES}`);
      db.run(`DROP TABLE IF EXISTS ${TABLES.USERS}`);
      db.run(`DROP TABLE IF EXISTS ${TABLES.USER_NOTIFICATION_TOKENS}`);

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

// Helper function for db operations
const runQuery = async (query, params = []) => {
  const dbConn = await getDb();
  return new Promise((resolve, reject) => {
    dbConn.run(query, params, function(err) {
      if (err) {
        console.error(`Error executing query: ${query}`, err);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

// Helper for get queries
const getQuery = async (query, params = []) => {
  const dbConn = await getDb();
  return new Promise((resolve, reject) => {
    dbConn.get(query, params, (err, row) => {
      if (err) {
        console.error(`Error executing get query: ${query}`, err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Helper for all queries
const allQuery = async (query, params = []) => {
  const dbConn = await getDb();
  return new Promise((resolve, reject) => {
    dbConn.all(query, params, (err, rows) => {
      if (err) {
        console.error(`Error executing all query: ${query}`, err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Database operations object
const db = {
  async insertUser(spUsername, spPassword, isNotificationsEnabled = 0) {
    const result = await runQuery(
      `INSERT OR REPLACE INTO ${TABLES.USERS} (sp_username, sp_password, is_notifications_enabled) 
       VALUES (?, ?, ?)`,
      [spUsername, spPassword, isNotificationsEnabled]
    );
    return result.lastID;
  },

  async getAllUsers() {
    return await allQuery(`SELECT * FROM ${TABLES.USERS}`);
  },

  async insertCourse(course) {
    const result = await runQuery(
      `INSERT OR REPLACE INTO ${TABLES.COURSES} (course_id, name) 
       VALUES (?, ?)`,
      [course.id, course.name]
    );
    return result.lastID;
  },

  async deleteAllMarksOfHalfYear(SpUsername, halfYear) {
    const result = await runQuery(
      `DELETE FROM ${TABLES.MARKS} WHERE sp_username = ? AND half_year = ?`,
      [SpUsername, halfYear]
    );
    console.log("Existing marks deleted successfully.");
    return result.changes;
  },

  async insertMark(mark) {
    const result = await runQuery(
      `INSERT INTO ${TABLES.MARKS} (name, date, grade, course_id, sp_username, half_year) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [mark.name, mark.date, mark.grade, mark.courseId, mark.SpUsername, mark.halfYear]
    );
    return result.lastID;
  },

  async insertTeacher(teacher) {
    const result = await runQuery(
      `INSERT OR REPLACE INTO ${TABLES.TEACHERS} 
       (teacher_id, name, type, logo, abbreviation, email) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        teacher.id,
        teacher.name,
        teacher.type,
        teacher.logo,
        teacher.abbreviation,
        teacher.email,
      ]
    );
    return result.lastID;
  },

  async insertCourseTeacher(courseId, teacherId) {
    await runQuery(
      `INSERT OR REPLACE INTO ${TABLES.COURSES_TEACHERS} (course_id, teacher_id) 
       VALUES (?, ?)`,
      [courseId, teacherId]
    );
    return true;
  },

  async insertUserCourse(SpUsername, courseId) {
    await runQuery(
      `INSERT OR REPLACE INTO ${TABLES.USER_COURSES} (sp_username, course_id) 
       VALUES (?, ?)`,
      [SpUsername, courseId]
    );
    return true;
  },

  async insertUserNotificationToken(SpUsername, token) {
    await runQuery(
      `INSERT OR REPLACE INTO ${TABLES.USER_NOTIFICATION_TOKENS} (sp_username, token) 
       VALUES (?, ?)`,
      [SpUsername, token]
    );
    return true;
  },

  async getUserNotificationToken(SpUsername) {
    const row = await getQuery(
      `SELECT token FROM ${TABLES.USER_NOTIFICATION_TOKENS} WHERE sp_username = ?`,
      [SpUsername]
    );
    return row ? row.token : null;
  },

  async getUserGrades(SpUsername) {
    // Check total records first for debugging
    const countResult = await getQuery(`SELECT COUNT(*) as count FROM ${TABLES.MARKS}`);
    console.log(`Total records in marks table: ${countResult.count}`);

    // Get the user's grades
    const rows = await allQuery(
      `SELECT * FROM ${TABLES.MARKS} WHERE sp_username = ?`,
      [SpUsername]
    );
    console.log(`Found ${rows.length} grades for user ${SpUsername}`);
    return rows;
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