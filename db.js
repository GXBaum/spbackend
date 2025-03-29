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
            name TEXT
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

        db.run( `CREATE TABLE IF NOT EXISTS teachers(
            teacherId TEXT PRIMARY KEY,
            name TEXT,
            type TEXT,
            logo TEXT,
            abbreviation TEXT,
            email TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS coursesTeachers(
            courseId INTEGER,
            teacherId TEXT,
            FOREIGN KEY(courseId) REFERENCES courses(courseId),
            FOREIGN KEY(teacherId) REFERENCES teachers(teacherId)
        )`);

    });
    return db;
};

// Reset database by dropping all tables and recreating them
const resetDb = () => {
    const db = new sqlite3.Database('./databasetest.db', sqlite3.OPEN_READWRITE, (err) => {
        if (err) return console.error("Error opening database:", err);
        console.log("Connected to the database for reset.");
    });

    // Drop all tables in correct order (to avoid foreign key constraint issues)
    db.serialize(() => {
        // Turn off foreign key checks temporarily
        db.run('PRAGMA foreign_keys = OFF');

        // Drop tables in reverse order of dependencies
        db.run('DROP TABLE IF EXISTS coursesTeachers');
        db.run('DROP TABLE IF EXISTS marks');
        db.run('DROP TABLE IF EXISTS teachers');
        db.run('DROP TABLE IF EXISTS courses');
        db.run('DROP TABLE IF EXISTS users');

        // Turn foreign key checks back on
        db.run('PRAGMA foreign_keys = ON');

        console.log("All tables dropped successfully.");

        // Close connection
        db.close((err) => {
            if (err) return console.error("Error closing database:", err);
            console.log("Database connection closed after reset.");

            // Reinitialize the database with empty tables
            initDb();
        });
    });
};

export { initDb, resetDb };