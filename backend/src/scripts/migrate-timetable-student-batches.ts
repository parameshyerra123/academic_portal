import "dotenv/config";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { env } from "../config/env.js";

async function columnExists(
  connection: mysql.Connection,
  table: string,
  column: string,
): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
    `,
    [env.academicDb.database, table, column],
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

async function main() {
  const connection = await mysql.createConnection({
    host: env.academicDb.host,
    port: env.academicDb.port,
    user: env.academicDb.user,
    password: env.academicDb.password,
    database: env.academicDb.database,
    multipleStatements: true,
    connectTimeout: 60000,
    ...(env.academicDb.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  console.log(`Connected to ${env.academicDb.database} @ ${env.academicDb.host}`);

  // 1. Add student_ids and student_count to ap_timetable_entries
  if (!(await columnExists(connection, "ap_timetable_entries", "student_ids"))) {
    await connection.query(`
      ALTER TABLE ap_timetable_entries
        ADD COLUMN student_ids JSON NULL AFTER batch_label
    `);
    console.log("Added column: ap_timetable_entries.student_ids");
  } else {
    console.log("Column ap_timetable_entries.student_ids already exists.");
  }

  if (!(await columnExists(connection, "ap_timetable_entries", "student_count"))) {
    await connection.query(`
      ALTER TABLE ap_timetable_entries
        ADD COLUMN student_count INT NULL AFTER student_ids
    `);
    console.log("Added column: ap_timetable_entries.student_count");
  } else {
    console.log("Column ap_timetable_entries.student_count already exists.");
  }

  if (!(await columnExists(connection, "ap_timetable_entries", "weekly_rotation"))) {
    await connection.query(`
      ALTER TABLE ap_timetable_entries
        ADD COLUMN weekly_rotation TINYINT(1) NOT NULL DEFAULT 0 AFTER student_count
    `);
    console.log("Added column: ap_timetable_entries.weekly_rotation");
  } else {
    console.log("Column ap_timetable_entries.weekly_rotation already exists.");
  }

  if (!(await columnExists(connection, "ap_timetable_entries", "rotation_pattern"))) {
    await connection.query(`
      ALTER TABLE ap_timetable_entries
        ADD COLUMN rotation_pattern VARCHAR(100) NULL AFTER weekly_rotation
    `);
    console.log("Added column: ap_timetable_entries.rotation_pattern");
  } else {
    console.log("Column ap_timetable_entries.rotation_pattern already exists.");
  }

  // 2. Add student_ids, student_count, weekly_rotation, and rotation_pattern to ap_class_sessions
  if (!(await columnExists(connection, "ap_class_sessions", "student_ids"))) {
    await connection.query(`
      ALTER TABLE ap_class_sessions
        ADD COLUMN student_ids JSON NULL AFTER batch_label
    `);
    console.log("Added column: ap_class_sessions.student_ids");
  } else {
    console.log("Column ap_class_sessions.student_ids already exists.");
  }

  if (!(await columnExists(connection, "ap_class_sessions", "student_count"))) {
    await connection.query(`
      ALTER TABLE ap_class_sessions
        ADD COLUMN student_count INT NULL AFTER student_ids
    `);
    console.log("Added column: ap_class_sessions.student_count");
  } else {
    console.log("Column ap_class_sessions.student_count already exists.");
  }

  if (!(await columnExists(connection, "ap_class_sessions", "weekly_rotation"))) {
    await connection.query(`
      ALTER TABLE ap_class_sessions
        ADD COLUMN weekly_rotation TINYINT(1) NOT NULL DEFAULT 0 AFTER student_count
    `);
    console.log("Added column: ap_class_sessions.weekly_rotation");
  } else {
    console.log("Column ap_class_sessions.weekly_rotation already exists.");
  }

  if (!(await columnExists(connection, "ap_class_sessions", "rotation_pattern"))) {
    await connection.query(`
      ALTER TABLE ap_class_sessions
        ADD COLUMN rotation_pattern VARCHAR(100) NULL AFTER weekly_rotation
    `);
    console.log("Added column: ap_class_sessions.rotation_pattern");
  } else {
    console.log("Column ap_class_sessions.rotation_pattern already exists.");
  }

  await connection.end();
  console.log("Student batches migration finished successfully.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
