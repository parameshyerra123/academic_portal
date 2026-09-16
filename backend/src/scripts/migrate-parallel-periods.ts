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

async function indexExists(
  connection: mysql.Connection,
  table: string,
  indexName: string,
): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
    `,
    [env.academicDb.database, table, indexName],
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

  // 1. Add batch_label to ap_timetable_entries if missing (safe, non-destructive)
  if (!(await columnExists(connection, "ap_timetable_entries", "batch_label"))) {
    await connection.query(`
      ALTER TABLE ap_timetable_entries
        ADD COLUMN batch_label VARCHAR(100) NULL AFTER room_label
    `);
    console.log("Added column: ap_timetable_entries.batch_label");
  } else {
    console.log("Column ap_timetable_entries.batch_label already exists.");
  }

  // 2. Add batch_label to ap_class_sessions if missing (safe, non-destructive)
  if (!(await columnExists(connection, "ap_class_sessions", "batch_label"))) {
    await connection.query(`
      ALTER TABLE ap_class_sessions
        ADD COLUMN batch_label VARCHAR(100) NULL AFTER room_label
    `);
    console.log("Added column: ap_class_sessions.batch_label");
  } else {
    console.log("Column ap_class_sessions.batch_label already exists.");
  }

  // 3. Add non-unique index on (plan_id, day_of_week, period_slot_id) if missing
  if (!(await indexExists(connection, "ap_timetable_entries", "idx_plan_day_period"))) {
    await connection.query(`
      ALTER TABLE ap_timetable_entries
        ADD KEY idx_plan_day_period (plan_id, day_of_week, period_slot_id)
    `);
    console.log("Added index: ap_timetable_entries.idx_plan_day_period");
  } else {
    console.log("Index ap_timetable_entries.idx_plan_day_period already exists.");
  }

  // 4. Drop single-slot unique constraint uq_plan_day_period so multiple parallel entries can be saved in same slot
  if (await indexExists(connection, "ap_timetable_entries", "uq_plan_day_period")) {
    await connection.query(`
      ALTER TABLE ap_timetable_entries
        DROP KEY uq_plan_day_period
    `);
    console.log("Dropped unique constraint: ap_timetable_entries.uq_plan_day_period (parallel period slots now supported)");
  } else {
    console.log("Unique constraint uq_plan_day_period already dropped.");
  }

  await connection.end();
  console.log("Migration for parallel periods completed successfully without disturbing existing data.");
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
