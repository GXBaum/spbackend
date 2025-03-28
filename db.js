import sqlite3 from "sqlite3";

// Initialize database
const initDb = () => {
    const db = new sqlite3.Database('./databasetest.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) return console.error("Error opening database:", err);
        console.log("Connected to the database.");
    });

    // Create tables
    db.serialize(() => {
        // Create users table (it's referenced but not defined in your code)
        db.run(`CREATE TABLE IF NOT EXISTS users(
            SpUsername TEXT PRIMARY KEY,
            SpPassword TEXT
        )`);

        // Create courses table
        db.run(`CREATE TABLE IF NOT EXISTS courses(
            courseId INTEGER PRIMARY KEY, 
            name TEXT, 
            teachers TEXT
        )`);

        // Create marks table
        db.run(`CREATE TABLE IF NOT EXISTS marks(
            markId INTEGER PRIMARY KEY,
            name TEXT,
            date TEXT,
            grade TEXT,
            courseId INTEGER,
            SpUsername TEXT,
            FOREIGN KEY(courseId) REFERENCES courses(courseId),
            FOREIGN KEY(SpUsername) REFERENCES users(SpUsername)
        )`);

    });
    return db;
};

export default initDb;
