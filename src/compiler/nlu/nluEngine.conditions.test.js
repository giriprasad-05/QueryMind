import { describe, it, expect } from 'vitest';
import { processNLU } from './nluEngine.js';
import { buildAST } from '../ast/astBuilder.js';
import { analyze } from '../semantic/semanticAnalyzer.js';
import { buildIR } from '../ir/irBuilder.js';
import { generateSQL } from '../sql/sqlGenerator.js';

// Schema mirroring the live PostgreSQL database (students → faculty via faculty_id).
const SCHEMA = {
  name: 'university_db',
  dialect: 'PostgreSQL',
  tables: [
    {
      id: 'students',
      name: 'students',
      columns: [
        { name: 'id', type: 'INTEGER', isPrimary: true, nullable: false },
        { name: 'name', type: 'VARCHAR(100)', isPrimary: false, nullable: false },
        { name: 'age', type: 'INTEGER', isPrimary: false, nullable: true },
        { name: 'marks', type: 'INTEGER', isPrimary: false, nullable: true },
        { name: 'department', type: 'VARCHAR(50)', isPrimary: false, nullable: false },
        { name: 'faculty_id', type: 'VARCHAR(20)', isPrimary: false, nullable: true },
      ],
      foreignKeys: [
        { constraintName: 'fk_students_faculty_id_faculty', column: 'faculty_id', referencedTable: 'faculty', referencedColumn: 'faculty_id' },
      ],
    },
    {
      id: 'courses',
      name: 'courses',
      columns: [
        { name: 'course_id', type: 'VARCHAR(20)', isPrimary: true, nullable: false },
        { name: 'course_name', type: 'VARCHAR(100)', isPrimary: false, nullable: false },
        { name: 'credits', type: 'INTEGER', isPrimary: false, nullable: false },
      ],
      foreignKeys: [],
    },
    {
      id: 'faculty',
      name: 'faculty',
      columns: [
        { name: 'faculty_id', type: 'VARCHAR(20)', isPrimary: true, nullable: false },
        { name: 'name', type: 'VARCHAR(100)', isPrimary: false, nullable: false },
        { name: 'department', type: 'VARCHAR(50)', isPrimary: false, nullable: false },
      ],
      foreignKeys: [],
    },
  ],
};

function runPipeline(query) {
  const nlu = processNLU(query, SCHEMA);
  if (!nlu.canonicalQuery) {
    return { success: false, sql: null, errors: nlu.errors };
  }
  const ast = buildAST({ type: 'CanonicalQuery', ...nlu.canonicalQuery });
  if (!ast.success) return { success: false, sql: null, errors: ast.errors };
  const sem = analyze(ast.ast, SCHEMA);
  if (!sem.success) return { success: false, sql: null, errors: sem.errors };
  const ir = buildIR(sem.ast);
  if (!ir.success) return { success: false, sql: null, errors: ir.errors };
  const sql = generateSQL(ir.ir);
  return { success: !!sql.sql, sql: sql.sql, errors: sql.errors };
}

describe('English-to-SQL conversion: condition preservation', () => {
  it('mandatory: marks greater than 80 AND faculty id = F001', () => {
    const res = runPipeline('Show students whose marks are greater than 80 and faculty id = F001');
    expect(res.success).toBe(true);
    expect(res.sql).toBe(
      'SELECT\n' +
      '    s.name AS student_name,\n' +
      '    f.name AS faculty_name\n' +
      'FROM students s\n' +
      'JOIN faculty f\n' +
      '    ON s.faculty_id = f.faculty_id\n' +
      'WHERE marks > 80\n' +
      '  AND f.faculty_id = \'F001\';'
    );
  });

  it('mandatory: marks greater than 70 AND faculty name is Sunita Rao', () => {
    const res = runPipeline('Show all students whose marks are greater than 70 and faculty name is Sunita Rao');
    expect(res.success).toBe(true);
    expect(res.sql).toContain('WHERE marks > 70');
    expect(res.sql).toContain('AND f.name ~*');
    expect(res.sql).toContain('Sunita Rao');
  });

  it('faculty name with honorific resolves to the same normalized match', () => {
    const a = runPipeline('Show students whose faculty name is "Prof. Sunita Rao"');
    const b = runPipeline('Show students whose faculty name is Sunita Rao');
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    expect(a.sql).toBe(b.sql);
  });

  it('numeric comparison vocabulary', () => {
    expect(runPipeline('Show students whose marks are greater than 80').sql).toContain('marks > 80');
    expect(runPipeline('Show students whose marks are above 70').sql).toContain('marks > 70');
    expect(runPipeline('Show students whose marks is at least 70').sql).toContain('marks >= 70');
    expect(runPipeline('Show students whose marks is greater than or equal to 75').sql).toContain('marks >= 75');
    expect(runPipeline('Show students whose marks is less than 50').sql).toContain('marks < 50');
    expect(runPipeline('Show students whose marks is below or equal to 40').sql).toContain('marks <= 40');
    expect(runPipeline('Show students whose marks is equal to 90').sql).toContain('marks = 90');
    expect(runPipeline('Show students whose marks is not equal to 60').sql).toContain('marks != 60');
  });

  it('BETWEEN expands to an inclusive range', () => {
    const res = runPipeline('Show students whose marks are between 60 and 80');
    expect(res.success).toBe(true);
    expect(res.sql).toContain('marks >= 60');
    expect(res.sql).toContain('marks <= 80');
  });

  it('identifier conditions are preserved as quoted strings', () => {
    const res = runPipeline('Show students whose faculty id equals F002');
    expect(res.success).toBe(true);
    expect(res.sql).toContain("f.faculty_id = 'F002'");
  });

  it('OR relationships are preserved', () => {
    const res = runPipeline('Show students whose marks are greater than 85 or whose age is above 20');
    expect(res.success).toBe(true);
    expect(res.sql).toContain('marks > 85');
    expect(res.sql).toContain('age > 20');
    expect(res.sql).toContain('OR');
  });

  it('three conditions joined by AND are all preserved', () => {
    const res = runPipeline('Show students whose marks exceed 70 and whose department is CSE and whose age is below 25');
    expect(res.success).toBe(true);
    expect(res.sql).toContain('marks > 70');
    expect(res.sql).toContain("department = 'CSE'");
    expect(res.sql).toContain('age < 25');
    expect(res.sql).toContain('AND');
  });

  it('negation is preserved', () => {
    const res = runPipeline('Show students whose name is not Rahul');
    expect(res.success).toBe(true);
    expect(res.sql).toContain('name !~*');
    expect(res.sql).toContain('Rahul');
  });

  it('mixed AND/OR preserves grouping with parentheses', () => {
    const res = runPipeline('Show students whose marks are greater than 80 and age is less than 20 or department is CSE');
    expect(res.success).toBe(true);
    expect(res.sql).toContain('(marks > 80');
    expect(res.sql).toContain('AND age < 20)');
    expect(res.sql).toContain('OR department = \'CSE\'');
  });

  it('a nonexistent column reports an error instead of being silently dropped', () => {
    const res = runPipeline('Show students whose city is Chennai');
    expect(res.success).toBe(false);
    expect(res.errors.some(e => e.type === 'COLUMN_NOT_FOUND')).toBe(true);
  });

  it('different phrasings produce the same marks predicate', () => {
    const a = runPipeline('Show students whose marks exceed 70');
    const b = runPipeline('Show students whose marks are above 70');
    expect(a.sql).toContain('marks > 70');
    expect(b.sql).toContain('marks > 70');
  });
});
