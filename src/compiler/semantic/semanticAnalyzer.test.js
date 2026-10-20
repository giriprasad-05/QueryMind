import { describe, it, expect } from 'vitest';
import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { buildAST } from '../ast/astBuilder.js';
import { analyze } from './semanticAnalyzer.js';
import { DATABASE_SCHEMA } from '../../data/schema.js';
import { 
  ERR_TABLE_NOT_FOUND, 
  ERR_COLUMN_NOT_FOUND, 
  ERR_TYPE_MISMATCH, 
  ERR_INVALID_OPERATOR 
} from './semanticErrors.js';

// Reusing same set from App.jsx for lexical step
const SCHEMA_TABLES = new Set(DATABASE_SCHEMA.tables.map(t => t.name.toUpperCase()));

function getSemanticResult(query) {
  const { tokens } = tokenize(query, SCHEMA_TABLES);
  const parseResult = parse(tokens);
  if (!parseResult.success) throw new Error('Parse failed during test');
  const astResult = buildAST(parseResult.tree);
  if (!astResult.success) throw new Error('AST build failed during test');
  return analyze(astResult.ast, DATABASE_SCHEMA);
}

describe('Semantic Analyzer', () => {
  it('Test 1: Show students (Valid)', () => {
    const { success, errors } = getSemanticResult('Show students');
    expect(success).toBe(true);
    expect(errors.length).toBe(0);
  });

  it('Test 2: Show students whose marks are greater than 80 (Valid)', () => {
    const { success, errors } = getSemanticResult('Show students whose marks are greater than 80');
    expect(success).toBe(true);
    expect(errors.length).toBe(0);
  });

  it('Test 3: Show students whose salary is greater than 80 (COLUMN_NOT_FOUND)', () => {
    const { success, errors } = getSemanticResult('Show students whose salary is greater than 80');
    expect(success).toBe(false);
    expect(errors[0].type).toBe(ERR_COLUMN_NOT_FOUND);
    expect(errors[0].column).toBe('salary');
  });

  it('Test 4: Show studentss (TABLE_NOT_FOUND)', () => {
    // Override SCHEMA_TABLES for this test to bypass lexer blocking 'studentss' as a table
    // Wait, the lexer will classify 'studentss' as IDENTIFIER, and parser might fail if it strictly expects a TABLE token.
    // Let's modify the lexer call just for this test, or adjust the test since the lexer requires SCHEMA_TABLES.
    // The parser accepts IDENTIFIER or TABLE for SOURCE! Let's check parser rules.
    // Assuming parser allows any identifier as source:
    
    // Actually, let's bypass lexer checks by just building a raw token stream, 
    // or provide the name directly to AST.
    // The lexer treats unknown words as IDENTIFIERs. The parser `parseSource` accepts `IDENTIFIER` or `TABLE`.
    
    const { tokens } = tokenize('Show studentss', new Set(['STUDENTS']));
    const parseResult = parse(tokens);
    const astResult = buildAST(parseResult.tree);
    const { success, errors } = analyze(astResult.ast, DATABASE_SCHEMA);

    expect(success).toBe(false);
    expect(errors[0].type).toBe(ERR_TABLE_NOT_FOUND);
    expect(errors[0].table).toBe('studentss');
  });

  it('Test 5: Show students whose marks are greater than "hello" (TYPE_MISMATCH)', () => {
    const { success, errors } = getSemanticResult('Show students whose marks are greater than "hello"');
    expect(success).toBe(false);
    expect(errors[0].type).toBe(ERR_TYPE_MISMATCH);
  });

  it('Test 6: Show students whose department is equal to "CSE" (Valid)', () => {
    const { success } = getSemanticResult('Show students whose department is equal to "CSE"');
    expect(success).toBe(true);
  });

  it('Test 7: Show students whose department is greater than "CSE" (INVALID_OPERATOR)', () => {
    const { success, errors } = getSemanticResult('Show students whose department is greater than "CSE"');
    expect(success).toBe(false);
    expect(errors[0].type).toBe(ERR_INVALID_OPERATOR);
    expect(errors[0].operator).toBe('>');
  });

  it('Test 8: AND expression (Valid)', () => {
    const { success } = getSemanticResult('Show students whose marks are greater than 80 and age is less than 20');
    expect(success).toBe(true);
  });

  it('Test 9: AND expression with 1 error', () => {
    const { success, errors } = getSemanticResult('Show students whose marks are greater than 80 and salary is greater than 50000');
    expect(success).toBe(false);
    expect(errors.length).toBe(1);
    expect(errors[0].type).toBe(ERR_COLUMN_NOT_FOUND);
    expect(errors[0].column).toBe('salary');
  });
});
