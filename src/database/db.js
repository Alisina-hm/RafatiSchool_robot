const Database = require("better-sqlite3");
const path = require("path");

// ساخت دیتابیس در ریشه پروژه
const db = new Database(path.join(__dirname, "../../database.sqlite"));

// ساخت جدول گروه‌ها
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

// ذخیره گروه یا به‌روزرسانی اطلاعات آن
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

module.exports = {
  db,
  saveGroup,
};
