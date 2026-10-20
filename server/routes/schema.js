import express from 'express';
import { query } from '../db.js';

const router = express.Router();

const ALLOWED_TYPES = new Set([
  'INTEGER',
  'BIGINT',
  'DECIMAL',
  'REAL',
  'VARCHAR',
  'TEXT',
  'BOOLEAN',
  'DATE',
  'TIMESTAMP',
]);

function isValidIdentifier(id) {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id.length <= 63 &&
    /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id) &&
    !id.toLowerCase().startsWith('pg_')
  );
}

function isValidType(type) {
  if (typeof type !== 'string') return false;
  const upper = type.trim().toUpperCase();
  if (ALLOWED_TYPES.has(upper)) return true;
  if (/^VARCHAR\(\d+\)$/.test(upper)) return true;
  if (/^DECIMAL\(\d+(?:,\s*\d+)?\)$/.test(upper)) return true;
  return false;
}

function normalizeTypeFormat(col) {
  const dt = (col.data_type || '').toUpperCase();
  if (dt === 'CHARACTER VARYING') {
    return col.character_maximum_length
      ? `VARCHAR(${col.character_maximum_length})`
      : 'VARCHAR';
  }
  if (dt === 'INTEGER') return 'INTEGER';
  if (dt === 'BIGINT') return 'BIGINT';
  if (dt === 'NUMERIC' || dt === 'DECIMAL') return 'DECIMAL';
  if (dt === 'REAL') return 'REAL';
  if (dt === 'TEXT') return 'TEXT';
  if (dt === 'BOOLEAN') return 'BOOLEAN';
  if (dt === 'DATE') return 'DATE';
  if (dt.includes('TIMESTAMP')) return 'TIMESTAMP';
  return dt;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/schema — Full Schema Introspection
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    // 1. Tables in public schema
    const tablesResult = await query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name;`
    );

    // 2. Columns in public schema
    const columnsResult = await query(
      `SELECT table_name, column_name, data_type, udt_name, 
              character_maximum_length, is_nullable, column_default
       FROM information_schema.columns 
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position;`
    );

    // 3. Primary keys
    const pkResult = await query(
      `SELECT tc.table_name, kcu.column_name 
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu 
         ON tc.constraint_name = kcu.constraint_name 
         AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public';`
    );

    // 4. Foreign keys
    const fkResult = await query(
      `SELECT tc.constraint_name, 
              tc.table_name AS source_table, 
              kcu.column_name AS source_column, 
              ccu.table_name AS target_table, 
              ccu.column_name AS target_column
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu 
         ON tc.constraint_name = kcu.constraint_name 
         AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu 
         ON tc.constraint_name = ccu.constraint_name 
         AND tc.table_schema = ccu.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';`
    );

    // Create lookup sets
    const pkSet = new Set(
      pkResult.rows.map(r => `${r.table_name.toLowerCase()}.${r.column_name.toLowerCase()}`)
    );

    // Group columns by table
    const columnsByTable = {};
    for (const col of columnsResult.rows) {
      const t = col.table_name.toLowerCase();
      if (!columnsByTable[t]) columnsByTable[t] = [];
      const isPk = pkSet.has(`${t}.${col.column_name.toLowerCase()}`);
      columnsByTable[t].push({
        name: col.column_name,
        type: normalizeTypeFormat(col),
        isPrimary: isPk,
        nullable: col.is_nullable === 'YES',
      });
    }

    // Group foreign keys by table
    const fksByTable = {};
    for (const fk of fkResult.rows) {
      const s = fk.source_table.toLowerCase();
      if (!fksByTable[s]) fksByTable[s] = [];
      fksByTable[s].push({
        constraintName: fk.constraint_name,
        column: fk.source_column,
        referencedTable: fk.target_table,
        referencedColumn: fk.target_column,
      });
    }

    // Build tables metadata and row counts
    const tables = [];
    for (const r of tablesResult.rows) {
      const tName = r.table_name;
      let rowCount = 0;
      try {
        const countRes = await query(`SELECT COUNT(*) as count FROM "${tName}";`);
        rowCount = parseInt(countRes.rows[0].count, 10) || 0;
      } catch {
        rowCount = 0;
      }

      tables.push({
        id: tName,
        name: tName,
        description: `PostgreSQL table ${tName}`,
        rowCount,
        columns: columnsByTable[tName.toLowerCase()] || [],
        foreignKeys: fksByTable[tName.toLowerCase()] || [],
      });
    }

    return res.json({
      success: true,
      data: {
        name: 'university_db',
        dialect: 'PostgreSQL',
        tables,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: {
        type: 'SCHEMA_INTROSPECTION_ERROR',
        message: err.message || 'Failed to inspect database schema.',
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /api/schema/table — Create Table
// ─────────────────────────────────────────────────────────────────────────────
router.post('/table', async (req, res) => {
  try {
    const { tableName, columns } = req.body;

    if (!isValidIdentifier(tableName)) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: `Invalid table name "${tableName}". Must begin with a letter or underscore and contain only alphanumeric characters.`,
        },
      });
    }

    if (!Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'At least one column is required to create a table.',
        },
      });
    }

    const seenCols = new Set();
    const colDefs = [];
    const pkCols = [];

    for (const col of columns) {
      if (!isValidIdentifier(col.name)) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: `Invalid column name "${col.name}".`,
          },
        });
      }

      const lowerCol = col.name.toLowerCase();
      if (seenCols.has(lowerCol)) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: `Duplicate column name "${col.name}" in table definition.`,
          },
        });
      }
      seenCols.add(lowerCol);

      if (!isValidType(col.type)) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'VALIDATION_ERROR',
            message: `Invalid or unsupported data type "${col.type}" for column "${col.name}".`,
          },
        });
      }

      const nullability = col.nullable ? '' : ' NOT NULL';
      colDefs.push(`"${col.name}" ${col.type.toUpperCase()}${nullability}`);

      if (col.isPrimary) {
        pkCols.push(`"${col.name}"`);
      }
    }

    if (pkCols.length > 0) {
      colDefs.push(`PRIMARY KEY (${pkCols.join(', ')})`);
    }

    const ddl = `CREATE TABLE "${tableName}" (\n  ${colDefs.join(',\n  ')}\n);`;
    await query(ddl);

    return res.json({
      success: true,
      message: `Table "${tableName}" created successfully.`,
      tableName,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: {
        type: 'TABLE_CREATION_ERROR',
        message: err.message || 'Failed to create table in PostgreSQL.',
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/schema/column — Add Column to Existing Table
// ─────────────────────────────────────────────────────────────────────────────
router.post('/column', async (req, res) => {
  try {
    const { tableName, column } = req.body;

    if (!isValidIdentifier(tableName)) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: `Invalid table name "${tableName}".`,
        },
      });
    }

    if (!column || !isValidIdentifier(column.name)) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: `Invalid column name "${column?.name}".`,
        },
      });
    }

    if (!isValidType(column.type)) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: `Invalid or unsupported data type "${column.type}".`,
        },
      });
    }

    const typeUpper = column.type.toUpperCase();
    const ddl = `ALTER TABLE "${tableName}" ADD COLUMN "${column.name}" ${typeUpper}${
      column.nullable === false ? ' NOT NULL' : ''
    };`;

    await query(ddl);

    if (column.isPrimary) {
      try {
        await query(
          `ALTER TABLE "${tableName}" ADD PRIMARY KEY ("${column.name}");`
        );
      } catch {
        // If primary key addition fails, continue gracefully
      }
    }

    return res.json({
      success: true,
      message: `Column "${column.name}" added to table "${tableName}".`,
      tableName,
      columnName: column.name,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: {
        type: 'COLUMN_CREATION_ERROR',
        message: err.message || 'Failed to add column to table.',
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/schema/foreign-key — Add Foreign Key Constraint
// ─────────────────────────────────────────────────────────────────────────────
router.post('/foreign-key', async (req, res) => {
  try {
    const { sourceTable, sourceColumn, targetTable, targetColumn } = req.body;

    if (
      !isValidIdentifier(sourceTable) ||
      !isValidIdentifier(sourceColumn) ||
      !isValidIdentifier(targetTable) ||
      !isValidIdentifier(targetColumn)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Table and column names must be valid PostgreSQL identifiers.',
        },
      });
    }

    // Verify source column exists
    const srcColRes = await query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2;`,
      [sourceTable, sourceColumn]
    );

    if (srcColRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'COLUMN_NOT_FOUND',
          message: `Source column "${sourceColumn}" does not exist in table "${sourceTable}".`,
        },
      });
    }

    // Verify target column exists
    const tgtColRes = await query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2;`,
      [targetTable, targetColumn]
    );

    if (tgtColRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'COLUMN_NOT_FOUND',
          message: `Referenced column "${targetColumn}" does not exist in table "${targetTable}".`,
        },
      });
    }

    // Verify target column has a PRIMARY KEY or UNIQUE constraint
    const tgtConstraintRes = await query(
      `SELECT tc.constraint_type 
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu 
         ON tc.constraint_name = kcu.constraint_name 
         AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = 'public' 
         AND tc.table_name = $1 
         AND kcu.column_name = $2 
         AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE');`,
      [targetTable, targetColumn]
    );

    if (tgtConstraintRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'REFERENCED_KEY_INVALID',
          message: `Referenced column "${targetTable}.${targetColumn}" must be a PRIMARY KEY or UNIQUE constraint.`,
        },
      });
    }

    const constraintName = `fk_${sourceTable}_${sourceColumn}_${targetTable}`.slice(0, 63);

    const ddl = `ALTER TABLE "${sourceTable}" ADD CONSTRAINT "${constraintName}" FOREIGN KEY ("${sourceColumn}") REFERENCES "${targetTable}" ("${targetColumn}");`;
    await query(ddl);

    return res.json({
      success: true,
      message: `Foreign key constraint "${constraintName}" created successfully: ${sourceTable}.${sourceColumn} → ${targetTable}.${targetColumn}.`,
      constraintName,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: {
        type: 'FOREIGN_KEY_CREATION_ERROR',
        message: err.message || 'Failed to create foreign key constraint.',
      },
    });
  }
});

export default router;
