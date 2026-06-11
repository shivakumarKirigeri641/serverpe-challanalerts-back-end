const fs = require("fs");
const path = require("path");
const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/* Where monthly CSV archives are written. Lives under src/uploads (gitignored). */
const BACKUP_DIR = path.join(
  __dirname,
  "..",
  "..",
  "uploads",
  "apilogbackups",
);

/* Archive + prune rows older than this many days; back up at most once per
   this many days (so it produces one CSV per ~month). */
const RETENTION_DAYS = 30;

/* Minimal RFC-4180 CSV cell escaping (no external dependency). */
function csvEscape(value) {
  if (value === null || value === undefined) return "";
  let s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/* mtime of the most recent existing backup file, or null if none. */
function lastBackupTime() {
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".csv"));
    if (!files.length) return null;
    let latest = 0;
    for (const f of files) {
      const m = fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs;
      if (m > latest) latest = m;
    }
    return latest ? new Date(latest) : null;
  } catch {
    return null;
  }
}

/**
 * Export api_logs rows older than RETENTION_DAYS to a timestamped CSV in
 * BACKUP_DIR, then delete exactly those rows from the DB to keep the table small.
 *
 * - Self-gating: skips if a backup was already made within RETENTION_DAYS, so it
 *   is safe to tick this daily (Node timers can't hold a 30-day interval) and
 *   safe across app restarts.
 * - Uses one captured cutoff timestamp for both SELECT and DELETE so rows
 *   inserted mid-run are never deleted without being archived first.
 * - Fail-safe: never throws into the caller; logging issues can't break the app.
 */
const backupApiLogs = async () => {
  let client;
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    // Not due yet → no-op.
    const last = lastBackupTime();
    if (last && (Date.now() - last.getTime()) / 86400000 < RETENTION_DAYS) {
      return;
    }

    client = await pool.connect();

    // Single cutoff shared by SELECT + DELETE (no mid-run race).
    const cutoffRes = await client.query(
      `SELECT now() - make_interval(days => $1) AS cutoff;`,
      [RETENTION_DAYS],
    );
    const cutoff = cutoffRes.rows[0].cutoff;

    const { rows } = await client.query(
      `SELECT * FROM api_logs WHERE created_at < $1 ORDER BY id;`,
      [cutoff],
    );
    if (rows.length === 0) {
      console.log("api_logs backup: no rows older than 30 days; skipping");
      return;
    }

    const columns = Object.keys(rows[0]);
    const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filePath = path.join(BACKUP_DIR, `api_logs_${stamp}.csv`);

    const out = fs.createWriteStream(filePath, { encoding: "utf8" });
    out.write(columns.join(",") + "\n");
    for (const row of rows) {
      out.write(columns.map((c) => csvEscape(row[c])).join(",") + "\n");
    }
    await new Promise((resolve, reject) =>
      out.end((err) => (err ? reject(err) : resolve())),
    );

    // Delete exactly what we archived (same cutoff). Sequence keeps counting —
    // ids are not reset (resetting is unsafe while rows remain).
    const del = await client.query(
      `DELETE FROM api_logs WHERE created_at < $1;`,
      [cutoff],
    );
    console.log(
      `api_logs backup: archived ${rows.length} rows -> ${filePath}; deleted ${del.rowCount} from DB`,
    );
  } catch (err) {
    console.error("api_logs backup failed:", err.message);
  } finally {
    if (client) client.release();
  }
};

module.exports = backupApiLogs;
