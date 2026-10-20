import { describe, it, expect } from 'vitest';
import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { buildAST } from '../ast/astBuilder.js';
import { analyze } from '../semantic/semanticAnalyzer.js';
import { buildIR } from '../ir/irBuilder.js';
import { generateSQL } from './sqlGenerator.js';
import { DATABASE_SCHEMA } from '../../data/schema.js';

const SCHEMA_TABLES = new Set(DATABASE_SCHEMA.tables.map(t => t.name.toUpperCase()));

function getSQL(query) {
  const { tokens } = tokenize(query, SCHEMA_TABLES);
  const parseResult = parse(tokens);
  const astResult = buildAST(parseResult.tree);
  const semResult = analyze(astResult.ast, DATABASE_SCHEMA);
  const irResult = buildIR(semResult.ast);
  return generateSQL(irResult.ir);
}

describe('SQL Generator', () => {
  it('Test 1: Show students', () => {
    const { sql, errors } = getSQL('Show students');
    expect(errors.length).toBe(0);
    expect(sql).toBe('SELECT\n    *\nFROM students;');
  });

  it('Test 2: Comparison', () => {
    const { sql } = getSQL('Show students whose marks are greater than 80');
    expect(sql).toBe('SELECT\n    *\nFROM students\nWHERE students.marks > 80;');
  });

  it('Test 3: AND condition', () => {
    const { sql } = getSQL('Show students whose marks are greater than 80 and age is less than 20');
    expect(sql).toBe('SELECT\n    *\nFROM students\nWHERE students.marks > 80\n  AND students.age < 20;');
  });

  it('Test 4: OR condition', () => {
    const { sql } = getSQL('Show students whose marks are greater than 80 or age is less than 20');
    expect(sql).toBe('SELECT\n    *\nFROM students\nWHERE students.marks > 80\n  OR students.age < 20;');
  });

  it('Test 5: String escaping', () => {
    const { sql } = getSQL('Show students whose department is equal to "CSE"');
    expect(sql).toBe("SELECT\n    *\nFROM students\nWHERE students.department = 'CSE';");
  });

  it('Test 6: Decimal values', () => {
    const { sql } = getSQL('Show students whose marks are greater than 80.5');
    expect(sql).toBe('SELECT\n    *\nFROM students\nWHERE students.marks > 80.5;');
  });

  it('Test 8: Unsupported operation', () => {
    const { sql, errors } = generateSQL({ operation: "INSERT" });
    expect(sql).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});
