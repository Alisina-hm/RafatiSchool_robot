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
};
