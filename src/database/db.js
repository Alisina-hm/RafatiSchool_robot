const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// مسیر ذخیره دیتابیس
const dataDirectory = process.env.DATA_DIR || path.join(__dirname, "../../");

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

const db = new Database(path.join(dataDirectory, "database.sqlite"));

db.pragma("foreign_keys = ON");

// جدول گروه‌ها
db.prepare(
  `
    CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        username TEXT,
        added_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`,
).run();

// جدول مدارس
db.prepare(
  `
    CREATE TABLE IF NOT EXISTS schools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL UNIQUE,
        owner_id INTEGER NOT NULL,
        owner_name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id)
    )
`,
).run();

// جدول مراحل ثبت مدرسه
db.prepare(
  `
    CREATE TABLE IF NOT EXISTS school_registrations (
        user_id INTEGER PRIMARY KEY,
        group_id INTEGER,
        step TEXT NOT NULL,
        data TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`,
).run();

// ذخیره اطلاعات گروه
function saveGroup(id, title, username) {
  db.prepare(
    `
        INSERT INTO groups (id, title, username)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            username = excluded.username
    `,
  ).run(id, title, username || null);
}

// ذخیره یا به‌روزرسانی مرحله ثبت‌نام
function saveRegistration(userId, groupId, step, data = {}) {
  db.prepare(
    `
        INSERT INTO school_registrations (
            user_id, group_id, step, data
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            group_id = excluded.group_id,
            step = excluded.step,
            data = excluded.data
    `,
  ).run(userId, groupId, step, JSON.stringify(data));
}

// دریافت مرحله ثبت‌نام
function getRegistration(userId) {
  const registration = db
    .prepare(
      `
        SELECT * FROM school_registrations
        WHERE user_id = ?
    `,
    )
    .get(userId);

  if (!registration) return null;

  try {
    registration.data = JSON.parse(registration.data || "{}");
  } catch {
    registration.data = {};
  }

  return registration;
}

// حذف ثبت‌نام موقت
function deleteRegistration(userId) {
  db.prepare(
    `
        DELETE FROM school_registrations
        WHERE user_id = ?
    `,
  ).run(userId);
}

// ثبت مدرسه
function createSchool(groupId, ownerId, ownerName, username, passwordHash) {
  return db
    .prepare(
      `
        INSERT INTO schools (
            group_id,
            owner_id,
            owner_name,
            username,
            password_hash
        )
        VALUES (?, ?, ?, ?, ?)
    `,
    )
    .run(groupId, ownerId, ownerName, username, passwordHash);
}

// بررسی تکراری نبودن نام کاربری مدرسه
function isSchoolUsernameTaken(username) {
  return Boolean(
    db
      .prepare(
        `
            SELECT 1 FROM schools
            WHERE username = ?
        `,
      )
      .get(username),
  );
}

// دریافت اطلاعات مدرسه با نام کاربری
function getSchoolByUsername(username) {
  return db
    .prepare(
      `
    SELECT * FROM schools
    WHERE username = ?
  `,
    )
    .get(username);
}

// تغییر رمز عبور مدرسه
function updateSchoolPassword(username, passwordHash) {
  return db
    .prepare(
      `
    UPDATE schools
    SET password_hash = ?
    WHERE username = ?
  `,
    )
    .run(passwordHash, username);
}

// ذخیره نشست ورود کاربر
function saveSchoolSession(userId, schoolId) {
  db.prepare(
    `
    INSERT INTO school_sessions (user_id, school_id)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      school_id = excluded.school_id
  `,
  ).run(userId, schoolId);
}

// دریافت نشست ورود
function getSchoolSession(userId) {
  return db
    .prepare(
      `
    SELECT * FROM school_sessions
    WHERE user_id = ?
  `,
    )
    .get(userId);
}

// خروج از حساب
function deleteSchoolSession(userId) {
  db.prepare(
    `
    DELETE FROM school_sessions
    WHERE user_id = ?
  `,
  ).run(userId);
}

// جدول نشست‌های ورود کاربران
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS school_sessions (
    user_id INTEGER PRIMARY KEY,
    school_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id)
  )
`,
).run();

// جدول مدیران مدارس
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS school_managers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id),
    UNIQUE (school_id, user_id),
    UNIQUE (school_id, username)
  )
`,
).run();

function createManager(schoolId, userId, name, username) {
  return db
    .prepare(
      `
    INSERT INTO school_managers (school_id, user_id, name, username)
    VALUES (?, ?, ?, ?)
  `,
    )
    .run(schoolId, userId, name, username);
}

function getManagerByUsername(username) {
  return db
    .prepare(
      `
    SELECT * FROM school_managers WHERE username = ?
  `,
    )
    .get(username);
}

function getManagerByUserId(userId) {
  return db
    .prepare(
      `
    SELECT * FROM school_managers WHERE user_id = ?
  `,
    )
    .get(userId);
}

function isManagerUsernameTaken(username) {
  return Boolean(
    db
      .prepare(
        `
      SELECT 1 FROM school_managers WHERE username = ?
    `,
      )
      .get(username),
  );
}

function getSchoolUsernameById(id) {
  return db
    .prepare(
      `
    SELECT username FROM schools WHERE id = ?
  `,
    )
    .get(id)?.username;
}

function getSchoolByGroupId(groupId) {
  return db
    .prepare(
      `
      SELECT * FROM schools
      WHERE group_id = ?
    `,
    )
    .get(groupId);
}

// دریافت مدرسه با شناسه دیتابیس
function getSchoolById(id) {
  return db
    .prepare(
      `
    SELECT * FROM schools WHERE id = ?
  `,
    )
    .get(id);
}

// دریافت مدیران یک مدرسه
function getManagersBySchoolId(schoolId) {
  return db
    .prepare(
      `
    SELECT * FROM school_managers
    WHERE school_id = ?
    ORDER BY id
  `,
    )
    .all(schoolId);
}

// ثبت تکلیف
function createHomework(
  schoolId,
  weekday,
  homeworkDate,
  task1,
  task2,
  userId,
  creatorName,
) {
  return db
    .prepare(
      `
    INSERT INTO homeworks (
      school_id, weekday, homework_date,
      task1, task2, created_by, creator_name
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(schoolId, weekday, homeworkDate, task1, task2, userId, creatorName);
}

// دریافت تکالیف آینده مدرسه
function getUpcomingHomeworks(schoolId, today) {
  return db
    .prepare(
      `
    SELECT * FROM homeworks
    WHERE school_id = ? AND homework_date >= ?
    ORDER BY homework_date ASC, id DESC
  `,
    )
    .all(schoolId, today);
}

// ثبت امتحان
function createExam(
  schoolId,
  weekday,
  examDate,
  subjects,
  userId,
  creatorName,
) {
  return db
    .prepare(
      `
    INSERT INTO exams (
      school_id, weekday, exam_date,
      subjects, created_by, creator_name
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    )
    .run(schoolId, weekday, examDate, subjects, userId, creatorName);
}

// دریافت امتحان‌های آینده مدرسه
function getUpcomingExams(schoolId, today) {
  return db
    .prepare(
      `
    SELECT * FROM exams
    WHERE school_id = ? AND exam_date >= ?
    ORDER BY exam_date ASC, id DESC
  `,
    )
    .all(schoolId, today);
}

function getAllSchoolAdmins() {
  return db
    .prepare(
      `
    SELECT
      schools.username AS school_username,
      schools.owner_name,
      school_managers.name AS manager_name,
      school_managers.username AS manager_username
    FROM schools
    LEFT JOIN school_managers
      ON school_managers.school_id = schools.id
    ORDER BY schools.id
  `,
    )
    .all();
}

// جدول تکالیف
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS homeworks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    weekday TEXT NOT NULL,
    homework_date TEXT NOT NULL,
    task1 TEXT NOT NULL,
    task2 TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    creator_name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id)
  )
`,
).run();

// جدول امتحان‌ها
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id INTEGER NOT NULL,
    weekday TEXT NOT NULL,
    exam_date TEXT NOT NULL,
    subjects TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    creator_name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id)
  )
`,
).run();

module.exports = {
  db,
  saveGroup,
  saveRegistration,
  getRegistration,
  deleteRegistration,
  createSchool,
  isSchoolUsernameTaken,
  getSchoolByUsername,
  updateSchoolPassword,
  saveSchoolSession,
  getSchoolSession,
  deleteSchoolSession,
  createManager,
  getManagerByUsername,
  getManagerByUserId,
  isManagerUsernameTaken,
  getSchoolUsernameById,
  getSchoolByGroupId,
  getAllSchoolAdmins,
  getSchoolById,
  getManagersBySchoolId,
  createHomework,
  getUpcomingHomeworks,
  createExam,
  getUpcomingExams,
};
