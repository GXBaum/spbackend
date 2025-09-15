import {getDb} from "../client.js";

export function createTeacherRepository(db) {
  if (!db) throw new Error("createTeacherRepository: db required");
  const stmts = {
    insertTeacher: db.prepare(`
      INSERT OR IGNORE INTO sp_teacher (id, name, type, logo, abbreviation, email)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    insertCourseTeacher: db.prepare(`
      INSERT OR IGNORE INTO sp_course_teacher (course_id, teacher_id)
      VALUES (?, ?)
    `),
  };

  return {
    insertTeacher({teacherId, name, type = null, logo = null, abbreviation = null, email = null}) {
      stmts.insertTeacher.run(teacherId, name, type, logo, abbreviation, email);
    },
    linkCourseTeacher(courseId, teacherId) {
      stmts.insertCourseTeacher.run(courseId, teacherId);
    },
  };
}

export function createDefaultTeacherRepository() {
    return createTeacherRepository(getDb());
}