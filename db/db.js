import sqlite3 from "sqlite3";

// Enable verbose mode for debugging
const db = sqlite3.verbose();

// Constants (using UPPER_SNAKE_CASE for constants)
const DB_PATH = "./db/database_test.db"; // More conventional naming

// Table names (singular, lowercase as per SQL convention)
const TABLE_NAMES = {
  USER: "user",
  COURSE: "course",
  USER_COURSE: "user_course",
  MARK: "mark",
  TEACHER: "teacher",
  COURSE_TEACHER: "course_teacher",
  USER_NOTIFICATION_TOKEN: "user_notification_token"
};

// Singleton database class
class Database {
  static #instance = null;

  constructor() {
    if (Database.#instance) {
      return Database.#instance;
    }
    Database.#instance = this;
    this.db = null;
  }

  async connect() {
    if (this.db) return this.db;

    this.db = await new Promise((resolve, reject) => {
      const dbConn = new db.Database(
        DB_PATH,
        db.OPEN_READWRITE | db.OPEN_CREATE,
        (err) => err ? reject(err) : resolve(dbConn)
      );
    });

    await this.#enableForeignKeys();
    await this.#createTables();
    return this.db;
  }

  async #enableForeignKeys() {
    await this.#run("PRAGMA foreign_keys = ON");
  }

  async #createTables() {
    await this.#run(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USER} (
        sp_username TEXT PRIMARY KEY,
        sp_password TEXT NOT NULL,
        notifications_enabled INTEGER DEFAULT 0 NOT NULL CHECK (notifications_enabled IN (0,1))
      )`);

    await this.#run(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.COURSE} (
        course_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      )`);

    await this.#run(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USER_COURSE} (
        sp_username TEXT NOT NULL,
        course_id INTEGER NOT NULL,
        PRIMARY KEY (sp_username, course_id),
        FOREIGN KEY (sp_username) REFERENCES ${TABLE_NAMES.USER}(sp_username) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES ${TABLE_NAMES.COURSE}(course_id) ON DELETE CASCADE
      )`);

    await this.#run(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.MARK} (
        mark_id INTEGER PRIMARY KEY /*AUTOINCREMENT*/,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        grade TEXT NOT NULL,
        course_id INTEGER NOT NULL,
        sp_username TEXT NOT NULL,
        half_year INTEGER NOT NULL CHECK (half_year IN (1,2)),
        FOREIGN KEY (course_id) REFERENCES ${TABLE_NAMES.COURSE}(course_id) ON DELETE CASCADE,
        FOREIGN KEY (sp_username) REFERENCES ${TABLE_NAMES.USER}(sp_username) ON DELETE CASCADE
      )`);

    await this.#run(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.TEACHER} (
        teacher_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT,
        logo TEXT,
        abbreviation TEXT,
        email TEXT /*UNIQUE*/
      )`);

    await this.#run(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.COURSE_TEACHER} (
        course_id INTEGER NOT NULL,
        teacher_id TEXT NOT NULL,
        PRIMARY KEY (course_id, teacher_id),
        FOREIGN KEY (course_id) REFERENCES ${TABLE_NAMES.COURSE}(course_id) ON DELETE CASCADE,
        FOREIGN KEY (teacher_id) REFERENCES ${TABLE_NAMES.TEACHER}(teacher_id) ON DELETE CASCADE
      )`);

    await this.#run(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USER_NOTIFICATION_TOKEN} (
        sp_username TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        FOREIGN KEY (sp_username) REFERENCES ${TABLE_NAMES.USER}(sp_username) ON DELETE CASCADE
      )`);
  }

  async reset() {
    await this.#run("PRAGMA foreign_keys = OFF");
    for (const table of Object.values(TABLE_NAMES)) {
      await this.#run(`DROP TABLE IF EXISTS ${table}`);
    }
    await this.#run("PRAGMA foreign_keys = ON");
    await this.#createTables();
  }

  // Query helpers
  #run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        err ? reject(err) : resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  #get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        err ? reject(err) : resolve(row);
      });
    });
  }

  #all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        err ? reject(err) : resolve(rows);
      });
    });
  }

  // Public methods
  async addUser(spUsername, spPassword, notificationsEnabled = 0) {
    return this.#run(
      `INSERT OR REPLACE INTO ${TABLE_NAMES.USER} (sp_username, sp_password, notifications_enabled) 
       VALUES (?, ?, ?)`,
      [spUsername, spPassword, notificationsEnabled ? 1 : 0]
    );
  }

  async getUsers() {
    return this.#all(`SELECT * FROM ${TABLE_NAMES.USER}`);
  }

  async addCourse(courseId, name) {
    return this.#run(
      `INSERT OR REPLACE INTO ${TABLE_NAMES.COURSE} (course_id, name) VALUES (?, ?)`,
      [courseId, name]
    );
  }

  async deleteMarksOfHalfYear(spUsername, halfYear) {
    return this.#run(
      `DELETE FROM ${TABLE_NAMES.MARK} WHERE sp_username = ? AND half_year = ?`,
      [spUsername, halfYear]
    );
  }

  async addMark({ name, date, grade, courseId, spUsername, halfYear }) {
    return this.#run(
      `INSERT INTO ${TABLE_NAMES.MARK} (name, date, grade, course_id, sp_username, half_year) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, date, grade, courseId, spUsername, halfYear]
    );
  }

  async addTeacher({ teacherId, name, type, logo, abbreviation, email }) {
    return this.#run(
      `INSERT OR REPLACE INTO ${TABLE_NAMES.TEACHER} (teacher_id, name, type, logo, abbreviation, email) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [teacherId, name, type, logo, abbreviation, email]
    );
  }

  async assignTeacherToCourse(courseId, teacherId) {
    return this.#run(
      `INSERT OR REPLACE INTO ${TABLE_NAMES.COURSE_TEACHER} (course_id, teacher_id) 
       VALUES (?, ?)`,
      [courseId, teacherId]
    );
  }

  async enrollUserInCourse(spUsername, courseId) {
    return this.#run(
      `INSERT OR REPLACE INTO ${TABLE_NAMES.USER_COURSE} (sp_username, course_id) 
       VALUES (?, ?)`,
      [spUsername, courseId]
    );
  }

  async getNotificationToken(spUsername) {
    const row = await this.#get(
      `SELECT token FROM ${TABLE_NAMES.USER_NOTIFICATION_TOKEN} WHERE sp_username = ?`,
      [spUsername]
    );
    return row?.token;
  }

  async getUserMarks(spUsername) {
    return this.#all(
      `SELECT * FROM ${TABLE_NAMES.MARK} WHERE sp_username = ?`,
      [spUsername]
    );
  }

  async close() {
    if (!this.db) return;
    await new Promise((resolve, reject) => {
      this.db.close((err) => err ? reject(err) : resolve());
    });
    this.db = null;
    Database.#instance = null;
  }
}

export default new Database();