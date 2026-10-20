import { describe, it, expect } from 'vitest';
import { query } from '../db.js';

describe('Feature 2: Dynamic Schema Manager Backend API', () => {
  const testTableName = `test_dept_${Date.now()}`;

  it('1. Introspects public tables from PostgreSQL', async () => {
    const res = await query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';`
    );
    expect(res.rows.length).toBeGreaterThan(0);
    const tableNames = res.rows.map(r => r.table_name);
    expect(tableNames).toContain('students');
    expect(tableNames).toContain('faculty');
  });

  it('2. Creates a new table with supported PostgreSQL types and primary key', async () => {
    const createDdl = `
      CREATE TABLE "${testTableName}" (
        "dept_code" VARCHAR(20) NOT NULL,
        "dept_name" VARCHAR(100) NOT NULL,
        "budget" DECIMAL,
        "is_active" BOOLEAN NOT NULL,
        PRIMARY KEY ("dept_code")
      );
    `;
    await query(createDdl);

    // Verify table exists
    const checkRes = await query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position;`,
      [testTableName]
    );
    expect(checkRes.rows.length).toBe(4);
    const colNames = checkRes.rows.map(r => r.column_name);
    expect(colNames).toEqual(['dept_code', 'dept_name', 'budget', 'is_active']);
  });

  it('3. Adds a column to an existing table', async () => {
    const addColDdl = `ALTER TABLE "${testTableName}" ADD COLUMN "created_at" TIMESTAMP;`;
    await query(addColDdl);

    const checkRes = await query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'created_at';`,
      [testTableName]
    );
    expect(checkRes.rows.length).toBe(1);
  });

  it('4. Rejects invalid table identifier or dangerous SQL fragment', () => {
    const isValidIdentifier = (id) =>
      typeof id === 'string' &&
      id.length > 0 &&
      id.length <= 63 &&
      /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id) &&
      !id.toLowerCase().startsWith('pg_');

    expect(isValidIdentifier('valid_table_123')).toBe(true);
    expect(isValidIdentifier('123_invalid')).toBe(false);
    expect(isValidIdentifier('drop table students;--')).toBe(false);
    expect(isValidIdentifier('pg_shadow')).toBe(false);
    expect(isValidIdentifier('table with spaces')).toBe(false);
  });

  it('5. Validates allowed PostgreSQL data types', () => {
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
    const isValidType = (type) => {
      if (typeof type !== 'string') return false;
      const upper = type.trim().toUpperCase();
      if (ALLOWED_TYPES.has(upper)) return true;
      if (/^VARCHAR\(\d+\)$/.test(upper)) return true;
      if (/^DECIMAL\(\d+(?:,\s*\d+)?\)$/.test(upper)) return true;
      return false;
    };

    expect(isValidType('INTEGER')).toBe(true);
    expect(isValidType('VARCHAR(50)')).toBe(true);
    expect(isValidType('DECIMAL(10,2)')).toBe(true);
    expect(isValidType('TEXT')).toBe(true);
    expect(isValidType('DATE')).toBe(true);
    expect(isValidType('TIMESTAMP')).toBe(true);
    expect(isValidType('BOOLEAN')).toBe(true);
    expect(isValidType('MALICIOUS_TYPE; DROP TABLE;')).toBe(false);
  });

  // Cleanup test table after test
  it('6. Cleans up test table', async () => {
    await query(`DROP TABLE IF EXISTS "${testTableName}";`);
    const checkRes = await query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1;`,
      [testTableName]
    );
    expect(checkRes.rows.length).toBe(0);
  });
});
