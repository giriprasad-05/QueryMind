import { describe, it, expect } from 'vitest';
import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { buildAST } from '../ast/astBuilder.js';
import { analyze } from '../semantic/semanticAnalyzer.js';
import { DATABASE_SCHEMA } from '../../data/schema.js';
import { buildIR } from './irBuilder.js';

const SCHEMA_TABLES = new Set(DATABASE_SCHEMA.tables.map(t => t.name.toUpperCase()));

function getIR(query) {
  const { tokens } = tokenize(query, SCHEMA_TABLES);
  const parseResult = parse(tokens);
  const astResult = buildAST(parseResult.tree);
  const semResult = analyze(astResult.ast, DATABASE_SCHEMA);
  return buildIR(semResult.ast);
}

describe('IR Builder', () => {
  it('Test 1: Show students', () => {
    const { success, ir } = getIR('Show students');
    expect(success).toBe(true);
    expect(ir.operation).toBe('SELECT');
    expect(ir.table).toBe('students');
    expect(ir.filter).toBe(null);
  });

  it('Test 2: Comparison filter', () => {
    const { success, ir } = getIR('Show students whose marks are greater than 80');
    expect(success).toBe(true);
    expect(ir.filter).toBeDefined();
    const filter = ir.filter;
    expect(filter.type).toBe('comparison');
    expect(filter.column).toBe('students.marks');
    expect(filter.operator).toBe('>');
    expect(filter.value).toBe(80);
    expect(filter.valueType).toBe('number');
  });

  it('Test 3: Logical filter (AND)', () => {
    const { success, ir } = getIR('Show students whose marks are greater than 80 and age is less than 20');
    expect(success).toBe(true);
    expect(ir.filter).toBeDefined();
    const filter = ir.filter;
    expect(filter.type).toBe('logical');
    expect(filter.operator).toBe('AND');
    
    expect(filter.left.type).toBe('comparison');
    expect(filter.left.column).toBe('students.marks');
    expect(filter.right.type).toBe('comparison');
    expect(filter.right.column).toBe('students.age');
  });
});
