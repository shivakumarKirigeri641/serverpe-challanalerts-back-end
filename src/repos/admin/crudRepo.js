const { connectDB } = require("../../database/connectDB");
const pool = connectDB();

/**
 * Generic, config-driven CRUD repository.
 *
 * Every method returns the standard ServerPe result shape:
 *   { statuscode, successstatus, message, data?, meta? }
 *
 * Identifiers (table / column names) come ONLY from the trusted resource
 * config — never from request input — so they are safe to interpolate.
 * All request VALUES are passed as parameterised query placeholders ($1…).
 */

/** Pick only the writable columns present in the body. */
const pickWritable = (body, writable) => {
  const out = {};
  for (const col of writable) {
    if (body && Object.prototype.hasOwnProperty.call(body, col)) {
      out[col] = body[col] === "" ? null : body[col];
    }
  }
  return out;
};

/**
 * Required columns for a table = writable + NOT NULL + no DB default.
 * Cached per-table so we don't re-hit information_schema on every write.
 */
const requiredCache = {};
const getRequiredColumns = async (cfg) => {
  if (requiredCache[cfg.table]) return requiredCache[cfg.table];
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
        AND is_nullable = 'NO' AND column_default IS NULL;`,
    [cfg.table],
  );
  const notNull = result.rows.map((r) => r.column_name);
  const required = (cfg.writable || []).filter((c) => notNull.includes(c));
  requiredCache[cfg.table] = required;
  return required;
};

const isEmpty = (v) => v === null || v === undefined || v === "";

/**
 * LIST with pagination, search, and is_active filtering.
 * query params: page, limit, search, is_active, order
 */
const list = async (cfg, query = {}) => {
  try {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 25, 1), 200);
    const offset = (page - 1) * limit;

    const where = [];
    const values = [];

    // is_active filter (accepts true/false/1/0) — only when the table has it.
    if (
      !cfg.readonly &&
      query.is_active !== undefined &&
      query.is_active !== ""
    ) {
      values.push(query.is_active === "true" || query.is_active === "1");
      where.push(`is_active = $${values.length}`);
    }

    // free-text search across configured columns
    if (query.search && cfg.search?.length) {
      values.push(`%${query.search}%`);
      const idx = values.length;
      const ors = cfg.search.map((c) => `${c}::text ILIKE $${idx}`);
      where.push(`(${ors.join(" OR ")})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    // Admin lists are ordered by id by default for a stable, predictable order;
    // an explicit ?order= query param can still override it when needed.
    const orderSql = query.order
      ? `ORDER BY ${query.order}`
      : `ORDER BY id ASC`;

    // Reads can come from an enriched joined view (cfg.source); writes always
    // target cfg.table. Falls back to the plain table when no source is set.
    const source = cfg.source || cfg.table;

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM ${source} ${whereSql};`,
      values,
    );
    const total = countResult.rows[0]?.total || 0;

    const dataResult = await pool.query(
      `SELECT * FROM ${source} ${whereSql} ${orderSql} LIMIT $${
        values.length + 1
      } OFFSET $${values.length + 2};`,
      [...values, limit, offset],
    );

    return {
      statuscode: 200,
      successstatus: true,
      message: `${cfg.table} fetched successfully`,
      data: dataResult.rows,
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 0,
      },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching ${cfg.table}. Error: ${err.message}`,
    };
  }
};

/**
 * LIST child rows of a parent, filtered by a foreign-key column.
 * Used for nested grids (e.g. violation_details under a challan).
 */
const listByForeignKey = async (cfg, fkColumn, fkValue, query = {}) => {
  try {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 100, 1), 500);
    const orderSql = query.order ? `ORDER BY ${query.order}` : `ORDER BY id ASC`;
    const result = await pool.query(
      `SELECT * FROM ${cfg.table} WHERE ${fkColumn} = $1 ${orderSql} LIMIT $2;`,
      [fkValue, limit],
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: `${cfg.table} child rows fetched successfully`,
      data: result.rows,
      meta: { total: result.rows.length, fk: fkColumn, parent_id: fkValue },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching child rows. Error: ${err.message}`,
    };
  }
};

/** GET one row by id. */
const getById = async (cfg, id) => {
  try {
    const result = await pool.query(
      `SELECT * FROM ${cfg.source || cfg.table} WHERE id = $1 LIMIT 1;`,
      [id],
    );
    if (result.rows.length === 0) {
      return {
        statuscode: 404,
        successstatus: false,
        message: `Record not found in ${cfg.table}`,
      };
    }
    return {
      statuscode: 200,
      successstatus: true,
      message: `${cfg.table} record fetched successfully`,
      data: result.rows[0],
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching record. Error: ${err.message}`,
    };
  }
};

/** CREATE a row from writable body columns. */
const create = async (cfg, body) => {
  try {
    const payload = pickWritable(body, cfg.writable);

    // Reject missing required fields up-front with a friendly, specific message.
    const required = await getRequiredColumns(cfg);
    const missing = required.filter((c) => isEmpty(payload[c]));
    if (missing.length) {
      return {
        statuscode: 400,
        successstatus: false,
        message: `Please fill the required field(s): ${missing.join(", ")}`,
      };
    }

    const cols = Object.keys(payload);
    if (cols.length === 0) {
      return {
        statuscode: 400,
        successstatus: false,
        message: "No valid fields provided to create the record",
      };
    }
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const result = await pool.query(
      `INSERT INTO ${cfg.table} (${cols.join(", ")})
       VALUES (${placeholders.join(", ")}) RETURNING *;`,
      cols.map((c) => payload[c]),
    );
    return {
      statuscode: 201,
      successstatus: true,
      message: `${cfg.table} record created successfully`,
      data: result.rows[0],
    };
  } catch (err) {
    return {
      statuscode: 400,
      successstatus: false,
      message: `Error creating record. Error: ${err.message}`,
    };
  }
};

/** UPDATE a row by id from writable body columns. */
const update = async (cfg, id, body) => {
  try {
    const payload = pickWritable(body, cfg.writable);
    const cols = Object.keys(payload);
    if (cols.length === 0) {
      return {
        statuscode: 400,
        successstatus: false,
        message: "No valid fields provided to update the record",
      };
    }

    // Don't allow a required field to be blanked out on update.
    const required = await getRequiredColumns(cfg);
    const cleared = cols.filter((c) => required.includes(c) && isEmpty(payload[c]));
    if (cleared.length) {
      return {
        statuscode: 400,
        successstatus: false,
        message: `These field(s) cannot be empty: ${cleared.join(", ")}`,
      };
    }

    const setSql = cols.map((c, i) => `${c} = $${i + 1}`);
    if (!cfg.noUpdatedAt) setSql.push(`updated_at = now()`);
    const result = await pool.query(
      `UPDATE ${cfg.table} SET ${setSql.join(", ")}
       WHERE id = $${cols.length + 1} RETURNING *;`,
      [...cols.map((c) => payload[c]), id],
    );
    if (result.rows.length === 0) {
      return {
        statuscode: 404,
        successstatus: false,
        message: `Record not found in ${cfg.table}`,
      };
    }
    return {
      statuscode: 200,
      successstatus: true,
      message: `${cfg.table} record updated successfully`,
      data: result.rows[0],
    };
  } catch (err) {
    return {
      statuscode: 400,
      successstatus: false,
      message: `Error updating record. Error: ${err.message}`,
    };
  }
};

/**
 * DELETE by id. mode="soft" (default) flips is_active=false; mode="hard"
 * removes the row permanently. Tables flagged noSoftDelete always hard-delete.
 */
const remove = async (cfg, id, mode = "soft") => {
  try {
    if (mode === "hard" || cfg.noSoftDelete) {
      const result = await pool.query(
        `DELETE FROM ${cfg.table} WHERE id = $1 RETURNING id;`,
        [id],
      );
      if (result.rows.length === 0) {
        return {
          statuscode: 404,
          successstatus: false,
          message: `Record not found in ${cfg.table}`,
        };
      }
      return {
        statuscode: 200,
        successstatus: true,
        message: `${cfg.table} record permanently deleted`,
        data: { id: result.rows[0].id },
      };
    }

    const result = await pool.query(
      `UPDATE ${cfg.table} SET is_active = false, updated_at = now()
       WHERE id = $1 RETURNING *;`,
      [id],
    );
    if (result.rows.length === 0) {
      return {
        statuscode: 404,
        successstatus: false,
        message: `Record not found in ${cfg.table}`,
      };
    }
    return {
      statuscode: 200,
      successstatus: true,
      message: `${cfg.table} record deactivated successfully`,
      data: result.rows[0],
    };
  } catch (err) {
    return {
      statuscode: 400,
      successstatus: false,
      message: `Error deleting record. Error: ${err.message}`,
    };
  }
};

/** Column metadata for a table (drives the frontend form rendering). */
const getColumns = async (cfg) => {
  try {
    const result = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;`,
      [cfg.table],
    );
    const writableSet = cfg.writable || [];
    const columns = result.rows.map((c) => {
      const writable = writableSet.includes(c.column_name);
      const hasDefault = c.column_default !== null;
      return {
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable === "YES",
        hasDefault,
        // A field the user MUST fill: writable, NOT NULL, and no DB default.
        required: writable && c.is_nullable === "NO" && !hasDefault,
        writable,
      };
    });
    return {
      statuscode: 200,
      successstatus: true,
      message: `${cfg.table} columns fetched successfully`,
      data: {
        table: cfg.table,
        label: cfg.label,
        readonly: !!cfg.readonly,
        group: cfg.group || "Other",
        writable: cfg.writable || [],
        search: cfg.search || [],
        children: cfg.children || [],
        display: cfg.display || [],
        references: cfg.references || {},
        columns,
      },
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching columns. Error: ${err.message}`,
    };
  }
};

/**
 * Lightweight {id, label} pairs for FK dropdowns. labelField is sanitized to a
 * bare identifier; it must be a column of the resource's read source.
 */
const options = async (cfg, labelField) => {
  try {
    const safe = /^[a-zA-Z0-9_]+$/.test(labelField || "") ? labelField : "id";
    const source = cfg.source || cfg.table;
    const result = await pool.query(
      `SELECT id, (${safe})::text AS label
         FROM ${source}
        ORDER BY label NULLS LAST
        LIMIT 1000;`,
    );
    return {
      statuscode: 200,
      successstatus: true,
      message: `${cfg.table} options fetched successfully`,
      data: result.rows,
    };
  } catch (err) {
    return {
      statuscode: 500,
      successstatus: false,
      message: `Error fetching options. Error: ${err.message}`,
    };
  }
};

module.exports = {
  list,
  listByForeignKey,
  getById,
  create,
  update,
  remove,
  getColumns,
  options,
};
