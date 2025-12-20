import Database from "better-sqlite3";
import {DB_PATH} from "../config/constants.js";
import * as fs from "node:fs";
import * as path from "node:path";

let db;

// TODO: user_refresh_token kann unendlich einträge pro nutzer haben
// TODO: change substitutions and different rooms table name to remove "v2"
const schema = `
BEGIN;

CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  notifications_enabled INTEGER NOT NULL DEFAULT 0 CHECK (notifications_enabled IN (0,1))
);

CREATE TABLE IF NOT EXISTS user_sp_data (
  user_id INTEGER PRIMARY KEY,
  sp_username TEXT NOT NULL,
  sp_password TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_vp_course (
  user_id INTEGER NOT NULL,
  course TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, course),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_notification_token (
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, token),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_sp_course (
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, course_id),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES sp_course(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_refresh_token (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vp_difference (
  day TEXT PRIMARY KEY NOT NULL CHECK (day IN ('today','tomorrow')),
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS vp_raw_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  day TEXT NOT NULL CHECK (day IN ('today','tomorrow')),
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vp_info (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  day TEXT NOT NULL CHECK (day IN ('today','tomorrow')),
  data TEXT,
  summary TEXT,
  CHECK (
    (data IS NULL AND summary IS NULL) OR
    (data IS NOT NULL AND summary IS NOT NULL)
  )
);


CREATE TABLE IF NOT EXISTS vp_course_lookup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS vp_substitution_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES vp_course_lookup(id),
    day TEXT NOT NULL CHECK (day IN ('today','tomorrow')),
    hour TEXT,
    original TEXT,
    replacement TEXT,
    description TEXT,
    vp_date TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (course_id, day, hour, original, replacement, description, vp_date)
);

CREATE TABLE IF NOT EXISTS vp_different_room_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES vp_course_lookup(id),
    day TEXT NOT NULL CHECK (day IN ('today','tomorrow')),
    hour TEXT,
    original TEXT,
    replacement TEXT,
    description TEXT,
    vp_date TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (course_id, day, hour, original, replacement, description, vp_date)
);

CREATE TABLE IF NOT EXISTS sp_course (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sp_mark (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  grade TEXT NOT NULL,
  half_year INTEGER NOT NULL CHECK (half_year IN (1,2)),
  course_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES sp_course(id)
);

CREATE TABLE IF NOT EXISTS sp_teacher (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  logo TEXT,
  abbreviation TEXT,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sp_course_teacher (
  course_id INTEGER NOT NULL,
  teacher_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (course_id, teacher_id),
  FOREIGN KEY (course_id) REFERENCES sp_course(id),
  FOREIGN KEY (teacher_id) REFERENCES sp_teacher(id)
);

CREATE INDEX IF NOT EXISTS idx_mark_user ON sp_mark(user_id);
CREATE INDEX IF NOT EXISTS idx_mark_course ON sp_mark(course_id);
CREATE INDEX IF NOT EXISTS idx_substitution_day ON vp_substitution(day);
CREATE INDEX IF NOT EXISTS idx_user_sp_course_course ON user_sp_course(course_id);
CREATE INDEX IF NOT EXISTS idx_user_sp_course_user ON user_sp_course(user_id);
CREATE INDEX IF NOT EXISTS idx_vp_raw_history_day_fetched ON vp_raw_history(day, fetched_at);
CREATE INDEX IF NOT EXISTS idx_vp_substitution_course_day ON vp_substitution(course, day);
CREATE INDEX IF NOT EXISTS idx_vp_substitution_day_vp_date ON vp_substitution(day, vp_date);
CREATE INDEX IF NOT EXISTS idx_vp_info_day_fetched ON vp_info(day, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_vp_diff_room_day ON vp_different_room(day);
CREATE INDEX IF NOT EXISTS idx_vp_diff_room_course_day ON vp_different_room(course, day);
CREATE INDEX IF NOT EXISTS idx_vp_diff_room_day_vp_date ON vp_different_room(day, vp_date);

COMMIT;
`;

function init() {
    if (db) return db;
    fs.mkdirSync(path.dirname(DB_PATH), {recursive: true});
    db = new Database(DB_PATH, {timeout: 5000});
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.exec(schema);
    return db;
}

function tx(fn) {
    return init().transaction(fn)();
}

function close() {
    if (!db) return;
    try {
        db.close();
    } finally {
        db = undefined;
    }
}

export {init as getDb, tx as withTransaction, close as closeDb};
export default {getDb: init, withTransaction: tx, closeDb: close};