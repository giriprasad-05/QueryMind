import { describe, it, expect } from 'vitest';
import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { buildAST } from './astBuilder.js';
import {
  AST_PROGRAM,
  AST_SELECT,
  AST_TABLE,
  AST_WHERE,
  AST_BINARY_EXPRESSION,
  AST_LOGICAL_EXPRESSION,
  AST_COLUMN,
  AST_LITERAL,
} from './astNodeTypes.js';

const SCHEMA_TABLES = new Set(['STUDENTS', 'COURSES', 'FACULTY']);

function getAST(query) {
  const { tokens } = tokenize(query, SCHEMA_TABLES);
  const parseResult = parse(tokens);
  return buildAST(parseResult.tree);
}

describe('AST Builder', () => {
  it('Test 1: Show students', () => {
    const { success, ast } = getAST('Show students');
    expect(success).toBe(true);
    expect(ast.type).toBe(AST_PROGRAM);
    expect(ast.body.type).toBe(AST_SELECT);
    expect(ast.body.table.type).toBe(AST_TABLE);
    expect(ast.body.table.name).toBe('students');
    expect(ast.body.where).toBeUndefined();
  });

  it('Test 2: Show students whose marks are greater than 80', () => {
    const { success, ast } = getAST('Show students whose marks are greater than 80');
    expect(success).toBe(true);
    const where = ast.body.where;
    expect(where.type).toBe(AST_WHERE);
    
    const expr = where.expression;
    expect(expr.type).toBe(AST_BINARY_EXPRESSION);
    expect(expr.operator).toBe('>');
    
    expect(expr.left.type).toBe(AST_COLUMN);
    expect(expr.left.name).toBe('students.marks');
    
    expect(expr.right.type).toBe(AST_LITERAL);
    expect(expr.right.value).toBe(80);
    expect(expr.right.dataType).toBe('number');
  });

  it('Test 3: AND condition', () => {
    const { success, ast } = getAST('Show students whose marks are greater than 80 and age is less than 20');
    expect(success).toBe(true);
    const expr = ast.body.where.expression;
    expect(expr.type).toBe(AST_LOGICAL_EXPRESSION);
    expect(expr.operator).toBe('AND');
    
    expect(expr.left.type).toBe(AST_BINARY_EXPRESSION);
    expect(expr.left.left.name).toBe('students.marks');
    expect(expr.left.operator).toBe('>');
    expect(expr.left.right.value).toBe(80);
    
    expect(expr.right.type).toBe(AST_BINARY_EXPRESSION);
    expect(expr.right.left.name).toBe('students.age');
    expect(expr.right.operator).toBe('<');
    expect(expr.right.right.value).toBe(20);
  });

  it('Test 4: OR condition', () => {
    const { success, ast } = getAST('Show students whose marks are greater than 80 or age is less than 20');
    expect(success).toBe(true);
    const expr = ast.body.where.expression;
    expect(expr.type).toBe(AST_LOGICAL_EXPRESSION);
    expect(expr.operator).toBe('OR');
  });

  it('Test 5: String condition', () => {
    const { success, ast } = getAST('Show students whose department is equal to "CSE"');
    expect(success).toBe(true);
    const expr = ast.body.where.expression;
    expect(expr.operator).toBe('=');
    expect(expr.right.type).toBe(AST_LITERAL);
    expect(expr.right.value).toBe('CSE');
    expect(expr.right.dataType).toBe('string');
  });

  it('Test 6: Decimal value', () => {
    const { success, ast } = getAST('Show students whose marks are greater than 80.5');
    expect(success).toBe(true);
    const expr = ast.body.where.expression;
    expect(expr.operator).toBe('>');
    expect(expr.right.type).toBe(AST_LITERAL);
    expect(expr.right.value).toBe(80.5);
    expect(expr.right.dataType).toBe('number');
  });

  it('Handles invalid parse trees gracefully', () => {
    const { success, ast, errors } = buildAST(null);
    expect(success).toBe(false);
    expect(ast).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});
