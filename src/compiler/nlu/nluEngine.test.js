import { describe, it, expect } from 'vitest';
import { processNLU } from './nluEngine.js';
import { buildAST } from '../ast/astBuilder.js';
import { analyze } from '../semantic/semanticAnalyzer.js';
import { buildIR } from '../ir/irBuilder.js';
import { generateSQL } from '../sql/sqlGenerator.js';
import { DATABASE_SCHEMA } from '../../data/schema.js';

// Schema with foreign key for testing JOIN
const SCHEMA_WITH_FK = {
  ...DATABASE_SCHEMA,
  tables: DATABASE_SCHEMA.tables.map(t => {
    if (t.name === 'students') {
      return {
        ...t,
        columns: [
          ...t.columns,
          { name: 'faculty_id', type: 'VARCHAR(20)', isPrimary: false, nullable: true },
        ],
        foreignKeys: [
          {
            constraintName: 'fk_students_faculty',
            column: 'faculty_id',
            referencedTable: 'faculty',
            referencedColumn: 'faculty_id',
          },
        ],
      };
    }
    return t;
  }),
};

function runPipeline(query, schema = DATABASE_SCHEMA) {
  const nluResult = processNLU(query, schema);
  if (!nluResult.canonicalQuery) {
    return { success: false, errors: nluResult.errors, sql: null };
  }
  const astResult = buildAST({ type: 'CanonicalQuery', ...nluResult.canonicalQuery });
  if (!astResult.success) {
    return { success: false, errors: astResult.errors, sql: null };
  }
  const semResult = analyze(astResult.ast, schema);
  if (!semResult.success) {
    return { success: false, errors: semResult.errors, sql: null };
  }
  const irResult = buildIR(semResult.ast);
  if (!irResult.success) {
    return { success: false, errors: irResult.errors, sql: null };
  }
  const sqlResult = generateSQL(irResult.ir);
  return { success: true, sql: sqlResult.sql, errors: [] };
}

describe('Feature 1: Natural Language to SQL Pipeline', () => {
  it('1. Show students', () => {
    const res = runPipeline('Show students');
    expect(res.success).toBe(true);
    expect(res.sql).toBe('SELECT\n    *\nFROM students;');
  });

  it('2. Show students name and marks', () => {
    const res = runPipeline('Show students name and marks');
    expect(res.success).toBe(true);
    expect(res.sql).toBe('SELECT name, marks\nFROM students;');
  });

  it('3. Give me the names and marks of students', () => {
    const res = runPipeline('Give me the names and marks of students');
    expect(res.success).toBe(true);
    expect(res.sql).toBe('SELECT name, marks\nFROM students;');
  });

  it('4. Show students older than 18', () => {
    const res = runPipeline('Show students older than 18');
    expect(res.success).toBe(true);
    expect(res.sql).toBe('SELECT\n    *\nFROM students\nWHERE age > 18;');
  });

  it('5. Show students older than 18 and scoring above 75', () => {
    const res = runPipeline('Show students older than 18 and scoring above 75');
    expect(res.success).toBe(true);
    expect(res.sql).toBe('SELECT\n    *\nFROM students\nWHERE age > 18\n  AND marks > 75;');
  });

  it('6. Show students who scored above 75 and belong to CSE', () => {
    const res = runPipeline('Show students who scored above 75 and belong to CSE');
    expect(res.success).toBe(true);
    expect(res.sql).toBe("SELECT\n    *\nFROM students\nWHERE marks > 75\n  AND department = 'CSE';");
  });

  it('7. Show the average marks of students', () => {
    const res = runPipeline('Show the average marks of students');
    expect(res.success).toBe(true);
    expect(res.sql).toBe('SELECT AVG(marks) AS average_marks\nFROM students;');
  });

  it('8. How many students are there?', () => {
    const res = runPipeline('How many students are there?');
    expect(res.success).toBe(true);
    expect(res.sql).toBe('SELECT COUNT(*) AS total_students\nFROM students;');
  });

  it('9. Show students and their respective faculty name (JOIN via FK)', () => {
    const res = runPipeline('Show students and their respective faculty name', SCHEMA_WITH_FK);
    expect(res.success).toBe(true);
    expect(res.sql).toBe(
      'SELECT\n    s.name AS student_name,\n    f.name AS faculty_name\nFROM students s\nJOIN faculty f\n    ON s.faculty_id = f.faculty_id;'
    );
  });

  it('10. Reports error when no relationship (FK) exists between requested tables', () => {
    // schema without FK between courses and students
    const nluResult = processNLU('Show students and courses', DATABASE_SCHEMA);
    expect(nluResult.errors.length).toBeGreaterThan(0);
    expect(nluResult.errors[0].type).toBe('RELATIONSHIP_NOT_FOUND');
  });
});
