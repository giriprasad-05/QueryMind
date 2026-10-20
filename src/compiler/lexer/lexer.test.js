/**
 * QueryMind Compiler — Lexer Unit Tests
 * Phase 3: Lexical Analysis
 *
 * Run with:  npm test
 *
 * Covers the 10 required test cases plus extended edge cases.
 */

import { describe, it, expect } from 'vitest';
import { tokenize } from './lexer.js';
import {
  TOKEN_KEYWORD,
  TOKEN_TABLE,
  TOKEN_IDENTIFIER,
  TOKEN_CONNECTOR,
  TOKEN_OPERATOR,
  TOKEN_NUMBER,
  TOKEN_STRING,
  TOKEN_UNKNOWN,
} from './tokenTypes.js';

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Pull just { type, lexeme } pairs for concise assertions */
function typeLexemes(input, tableNames) {
  const { tokens } = tokenize(input, tableNames);
  return tokens.map(t => ({ type: t.type, value: t.value }));
}

// Table names set matching the mock schema
const SCHEMA_TABLES = new Set(['STUDENTS', 'COURSES', 'FACULTY']);

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Lexer — tokenize()', () => {

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: Empty input
  // ──────────────────────────────────────────────────────────────────────────
  it('T01 — returns empty result for empty input', () => {
    const { tokens, errors } = tokenize('');
    expect(tokens).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('T01b — returns empty result for whitespace-only input', () => {
    const { tokens, errors } = tokenize('   \t\n  ');
    expect(tokens).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Basic SHOW/SELECT style query
  // ──────────────────────────────────────────────────────────────────────────
  it('T02 — basic SHOW query with table name', () => {
    const result = typeLexemes('Show students', SCHEMA_TABLES);
    expect(result).toEqual([
      { type: TOKEN_KEYWORD, value: 'SHOW' },
      { type: TOKEN_TABLE,   value: 'STUDENTS' },
    ]);
  });

  it('T02b — full canonical query produces correct token sequence', () => {
    const { tokens, errors } = tokenize(
      'Show students whose marks are greater than 80',
      SCHEMA_TABLES
    );
    expect(errors).toHaveLength(0);

    const result = tokens.map(t => ({ type: t.type, value: t.value }));
    expect(result).toEqual([
      { type: TOKEN_KEYWORD,    value: 'SHOW'         },
      { type: TOKEN_TABLE,      value: 'STUDENTS'     },
      { type: TOKEN_KEYWORD,    value: 'WHERE'        },
      { type: TOKEN_IDENTIFIER, value: 'MARKS'        },
      { type: TOKEN_CONNECTOR,  value: 'ARE'          },
      { type: TOKEN_OPERATOR,   value: '>'            },
      { type: TOKEN_NUMBER,     value: '80'           },
    ]);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: Comparison operator — symbolic
  // ──────────────────────────────────────────────────────────────────────────
  it('T03 — recognises > operator', () => {
    const result = typeLexemes('marks > 80');
    expect(result).toContainEqual({ type: TOKEN_OPERATOR, value: '>' });
  });

  it('T03b — recognises >= operator', () => {
    const result = typeLexemes('marks >= 80');
    expect(result).toContainEqual({ type: TOKEN_OPERATOR, value: '>=' });
  });

  it('T03c — recognises <= operator', () => {
    const result = typeLexemes('marks <= 80');
    expect(result).toContainEqual({ type: TOKEN_OPERATOR, value: '<=' });
  });

  it('T03d — recognises != operator', () => {
    const result = typeLexemes('age != 18');
    expect(result).toContainEqual({ type: TOKEN_OPERATOR, value: '!=' });
  });

  it('T03e — recognises = operator', () => {
    const result = typeLexemes('age = 18');
    expect(result).toContainEqual({ type: TOKEN_OPERATOR, value: '=' });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: Integer number
  // ──────────────────────────────────────────────────────────────────────────
  it('T04 — recognises integer number', () => {
    const result = typeLexemes('80');
    expect(result).toEqual([{ type: TOKEN_NUMBER, value: '80' }]);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: Decimal number
  // ──────────────────────────────────────────────────────────────────────────
  it('T05 — recognises decimal number', () => {
    const result = typeLexemes('3.14');
    expect(result).toEqual([{ type: TOKEN_NUMBER, value: '3.14' }]);
  });

  it('T05b — recognises decimal in context', () => {
    const result = typeLexemes('marks > 7.5');
    const num = result.find(t => t.type === TOKEN_NUMBER);
    expect(num).toBeDefined();
    expect(num.value).toBe('7.5');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 6: Quoted string
  // ──────────────────────────────────────────────────────────────────────────
  it('T06 — recognises single-quoted string', () => {
    const result = typeLexemes("department = 'CSE'");
    const str = result.find(t => t.type === TOKEN_STRING);
    expect(str).toBeDefined();
    expect(str.value).toBe("'CSE'");
  });

  it('T06b — recognises double-quoted string', () => {
    const result = typeLexemes('name = "Alice"');
    const str = result.find(t => t.type === TOKEN_STRING);
    expect(str).toBeDefined();
    expect(str.value).toBe('"Alice"');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 7: AND keyword
  // ──────────────────────────────────────────────────────────────────────────
  it('T07 — recognises AND as KEYWORD', () => {
    const result = typeLexemes('marks > 70 AND age < 25');
    const andTok = result.find(t => t.value === 'AND');
    expect(andTok).toBeDefined();
    expect(andTok.type).toBe(TOKEN_KEYWORD);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 8: OR keyword
  // ──────────────────────────────────────────────────────────────────────────
  it('T08 — recognises OR as KEYWORD', () => {
    const result = typeLexemes('marks > 90 OR marks < 40');
    const orTok = result.find(t => t.value === 'OR');
    expect(orTok).toBeDefined();
    expect(orTok.type).toBe(TOKEN_KEYWORD);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 9: Multi-word operator — "greater than"
  // ──────────────────────────────────────────────────────────────────────────
  it('T09 — "greater than" is a single OPERATOR token', () => {
    const result = typeLexemes('marks greater than 80');
    const ops = result.filter(t => t.type === TOKEN_OPERATOR);
    expect(ops).toHaveLength(1);
    expect(ops[0].value).toBe('>');
  });

  it('T09b — "less than" is a single OPERATOR token', () => {
    const result = typeLexemes('age less than 18');
    const ops = result.filter(t => t.type === TOKEN_OPERATOR);
    expect(ops).toHaveLength(1);
    expect(ops[0].value).toBe('<');
  });

  it('T09c — "greater than or equal to" is a single OPERATOR token', () => {
    const result = typeLexemes('marks greater than or equal to 50');
    const ops = result.filter(t => t.type === TOKEN_OPERATOR);
    expect(ops).toHaveLength(1);
    expect(ops[0].value).toBe('>=');
  });

  it('T09d — "not equal to" is a single OPERATOR token', () => {
    const result = typeLexemes('department not equal to CSE');
    const ops = result.filter(t => t.type === TOKEN_OPERATOR);
    expect(ops).toHaveLength(1);
    expect(ops[0].value).toBe('!=');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 10: Unknown token
  // ──────────────────────────────────────────────────────────────────────────
  it('T10 — unknown character produces UNKNOWN token and error', () => {
    const { tokens, errors } = tokenize('Show students @#$');
    const unknowns = tokens.filter(t => t.type === TOKEN_UNKNOWN);
    expect(unknowns.length).toBeGreaterThanOrEqual(1);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].value).toMatch(/[@#$]/);
  });

  it('T10b — valid tokens before unknown are still produced', () => {
    const { tokens } = tokenize('Show @', SCHEMA_TABLES);
    const keywords = tokens.filter(t => t.type === TOKEN_KEYWORD);
    expect(keywords).toHaveLength(1);
    expect(keywords[0].value).toBe('SHOW');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Additional: Token metadata
  // ──────────────────────────────────────────────────────────────────────────
  it('Token objects carry position and length', () => {
    const { tokens } = tokenize('Show students', SCHEMA_TABLES);
    expect(tokens[0].position).toBe(0);
    expect(tokens[0].length).toBe(4);   // 'Show'
    expect(tokens[1].position).toBe(5); // after space
    expect(tokens[1].length).toBe(8);   // 'students'
  });

  it('Token objects carry sequential index', () => {
    const { tokens } = tokenize('Show students whose marks', SCHEMA_TABLES);
    tokens.forEach((t, i) => expect(t.index).toBe(i));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Additional: Table resolution
  // ──────────────────────────────────────────────────────────────────────────
  it('Resolves known table name → TABLE token', () => {
    const result = typeLexemes('Show courses', SCHEMA_TABLES);
    expect(result[1].value).toEqual('COURSES');
  });

  it('Unknown table name stays IDENTIFIER', () => {
    const result = typeLexemes('Show widgets', SCHEMA_TABLES);
    expect(result[1].value).toEqual('WIDGETS');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Additional: CSE department query
  // ──────────────────────────────────────────────────────────────────────────
  it('CSE department query tokenizes correctly', () => {
    const { tokens, errors } = tokenize(
      "Show students from the CSE department",
      SCHEMA_TABLES
    );
    expect(errors).toHaveLength(0);
    const types = tokens.map(t => t.type);
    // SHOW → STUDENTS(TABLE) → FROM → THE → CSE → department
    expect(types[0]).toBe(TOKEN_KEYWORD);
    expect(types[1]).toBe(TOKEN_TABLE);
    expect(types[2]).toBe(TOKEN_KEYWORD);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Additional: Top 5 query
  // ──────────────────────────────────────────────────────────────────────────
  it('Top 5 students by marks tokenizes correctly', () => {
    const { tokens, errors } = tokenize(
      'Show the top 5 students by marks',
      SCHEMA_TABLES
    );
    expect(errors).toHaveLength(0);
    const limitTok = tokens.find(t => t.value === 'TOP');
    expect(limitTok).toBeDefined();
    expect(limitTok.type).toBe('LIMIT');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Additional: Average marks query
  // ──────────────────────────────────────────────────────────────────────────
  it('Average marks query recognises AVERAGE as AGGREGATE', () => {
    const { tokens } = tokenize(
      'Show the average marks of students',
      SCHEMA_TABLES
    );
    const agg = tokens.find(t => t.type === 'AGGREGATE');
    expect(agg).toBeDefined();
    expect(agg.value).toBe('AVG');
  });
});
