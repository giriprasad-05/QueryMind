/**
 * QueryMind Compiler — Parser Unit Tests
 * Phase 5: Syntax Analysis
 *
 * Tests the parse() function using real lexer output (tokenize()).
 * All 8 required test cases plus extended edge cases are covered.
 *
 * Run with:  npm test
 */

import { describe, it, expect } from 'vitest';
import { tokenize } from '../lexer/lexer.js';
import { parse } from './parser.js';
import {
  NODE_QUERY,
  NODE_ACTION,
  NODE_SOURCE,
  NODE_CONDITION_CLAUSE,
  NODE_COMPOUND_CONDITION,
  NODE_SIMPLE_CONDITION,
  NODE_COLUMN,
  NODE_OPERATOR,
  NODE_VALUE,
  NODE_LOGICAL_OP,
} from './grammar.js';

// ─── Schema context ───────────────────────────────────────────────────────────
// Matches the live schema used in the app — STUDENTS and COURSES and FACULTY
const SCHEMA_TABLES = new Set(['STUDENTS', 'COURSES', 'FACULTY']);

/** Run lexer then parser, returning { lexResult, parseResult }. */
function compile(query) {
  const lexResult   = tokenize(query, SCHEMA_TABLES);
  const parseResult = parse(lexResult.tokens);
  return { lexResult, parseResult };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively find the first node with the given type in the tree. */
function findNode(node, type) {
  if (!node) return null;
  if (node.type === type) return node;
  for (const child of node.children) {
    const found = findNode(child, type);
    if (found) return found;
  }
  return null;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Parser — parse()', () => {

  // ── Required Test 1: "Show students" ──────────────────────────────────────
  describe('T01 — "Show students" (basic valid query)', () => {
    it('succeeds with no errors', () => {
      const { parseResult } = compile('Show students');
      expect(parseResult.success).toBe(true);
      expect(parseResult.errors).toHaveLength(0);
    });

    it('produces a QUERY root node', () => {
      const { parseResult } = compile('Show students');
      expect(parseResult.tree).not.toBeNull();
      expect(parseResult.tree.type).toBe(NODE_QUERY);
    });

    it('has ACTION node with value "Show"', () => {
      const { parseResult } = compile('Show students');
      const action = findNode(parseResult.tree, NODE_ACTION);
      expect(action).not.toBeNull();
      expect(action.value).toBe('SHOW');
    });

    it('has SOURCE node with value "students"', () => {
      const { parseResult } = compile('Show students');
      const source = findNode(parseResult.tree, NODE_SOURCE);
      expect(source).not.toBeNull();
      expect(source.value).toBe('students');
    });

    it('has no CONDITION_CLAUSE', () => {
      const { parseResult } = compile('Show students');
      expect(findNode(parseResult.tree, NODE_CONDITION_CLAUSE)).toBeNull();
    });
  });

  // ── Required Test 2: canonical query with condition ────────────────────────
  describe('T02 — "Show students whose marks are greater than 80"', () => {
    it('succeeds with no errors', () => {
      const { parseResult } = compile('Show students whose marks are greater than 80');
      expect(parseResult.success).toBe(true);
      expect(parseResult.errors).toHaveLength(0);
    });

    it('has a CONDITION_CLAUSE', () => {
      const { parseResult } = compile('Show students whose marks are greater than 80');
      expect(findNode(parseResult.tree, NODE_CONDITION_CLAUSE)).not.toBeNull();
    });

    it('has SIMPLE_CONDITION with COLUMN marks, OPERATOR "greater than", VALUE 80', () => {
      const { parseResult } = compile('Show students whose marks are greater than 80');
      const cond    = findNode(parseResult.tree, NODE_SIMPLE_CONDITION);
      const column  = findNode(cond, NODE_COLUMN);
      const op      = findNode(cond, NODE_OPERATOR);
      const val     = findNode(cond, NODE_VALUE);
      expect(column.value).toBe('marks');
      expect(op.value).toBe('>');
      expect(val.value).toBe('80');
    });
  });

  // ── Required Test 3: AND compound condition ────────────────────────────────
  describe('T03 — "Show students whose marks are greater than 80 and age is less than 20"', () => {
    it('succeeds with no errors', () => {
      const { parseResult } = compile(
        'Show students whose marks are greater than 80 and age is less than 20'
      );
      expect(parseResult.success).toBe(true);
      expect(parseResult.errors).toHaveLength(0);
    });

    it('produces a COMPOUND_CONDITION with AND operator', () => {
      const { parseResult } = compile(
        'Show students whose marks are greater than 80 and age is less than 20'
      );
      const compound = findNode(parseResult.tree, NODE_COMPOUND_CONDITION);
      expect(compound).not.toBeNull();
      const logOp = findNode(compound, NODE_LOGICAL_OP);
      expect(logOp).not.toBeNull();
      expect(logOp.value.toUpperCase()).toBe('AND');
    });
  });

  // ── Required Test 4: OR compound condition ─────────────────────────────────
  describe('T04 — "Show students whose marks are greater than 80 or age is less than 20"', () => {
    it('succeeds with no errors', () => {
      const { parseResult } = compile(
        'Show students whose marks are greater than 80 or age is less than 20'
      );
      expect(parseResult.success).toBe(true);
      expect(parseResult.errors).toHaveLength(0);
    });

    it('produces a COMPOUND_CONDITION with OR operator', () => {
      const { parseResult } = compile(
        'Show students whose marks are greater than 80 or age is less than 20'
      );
      const compound = findNode(parseResult.tree, NODE_COMPOUND_CONDITION);
      const logOp    = findNode(compound, NODE_LOGICAL_OP);
      expect(logOp.value.toUpperCase()).toBe('OR');
    });
  });

  // ── Required Test 5: SHOW missing → error ─────────────────────────────────
  describe('T05 — "students whose marks are greater than 80" (missing SHOW)', () => {
    it('fails with at least one parser error', () => {
      const { parseResult } = compile('students whose marks are greater than 80');
      expect(parseResult.success).toBe(false);
      expect(parseResult.errors.length).toBeGreaterThan(0);
    });

    it('error mentions expected action keyword', () => {
      const { parseResult } = compile('students whose marks are greater than 80');
      const first = parseResult.errors[0];
      expect(first.expected).toContain('SHOW');
    });

    it('error found value reflects "students" token', () => {
      const { parseResult } = compile('students whose marks are greater than 80');
      expect(parseResult.errors[0].found).toContain('students');
    });
  });

  // ── Required Test 6: truncated condition → error ───────────────────────────
  describe('T06 — "Show students whose marks" (no operator or value)', () => {
    it('fails with at least one parser error', () => {
      const { parseResult } = compile('Show students whose marks');
      expect(parseResult.success).toBe(false);
      expect(parseResult.errors.length).toBeGreaterThan(0);
    });

    it('error mentions expected OPERATOR', () => {
      const { parseResult } = compile('Show students whose marks');
      const hasOperatorErr = parseResult.errors.some(e =>
        e.expected.includes('OPERATOR')
      );
      expect(hasOperatorErr).toBe(true);
    });

    it('error position is at END_OF_INPUT', () => {
      const { parseResult } = compile('Show students whose marks');
      const opErr = parseResult.errors.find(e => e.expected.includes('OPERATOR'));
      expect(opErr.found).toBe('END_OF_INPUT');
    });
  });

  // ── Required Test 7: operator present but value missing ───────────────────
  describe('T07 — "Show students whose marks greater than" (no value)', () => {
    it('fails with at least one parser error', () => {
      const { parseResult } = compile('Show students whose marks greater than');
      expect(parseResult.success).toBe(false);
    });

    it('error mentions expected NUMBER or STRING', () => {
      const { parseResult } = compile('Show students whose marks greater than');
      const hasValueErr = parseResult.errors.some(e =>
        e.expected.some(ex => ex === 'NUMBER' || ex === 'STRING')
      );
      expect(hasValueErr).toBe(true);
    });
  });

  // ── Required Test 8: trailing AND without right-hand condition ────────────
  describe('T08 — "Show students whose marks are greater than 80 and" (dangling AND)', () => {
    it('fails with a parser error about the dangling AND', () => {
      const { parseResult } = compile(
        'Show students whose marks are greater than 80 and'
      );
      expect(parseResult.success).toBe(false);
      expect(parseResult.errors.length).toBeGreaterThan(0);
    });

    it('error mentions expected IDENTIFIER after AND', () => {
      const { parseResult } = compile(
        'Show students whose marks are greater than 80 and'
      );
      const andErr = parseResult.errors.find(e =>
        e.expected.includes('IDENTIFIER')
      );
      expect(andErr).toBeDefined();
    });
  });

  // ─── Extended edge-case tests ──────────────────────────────────────────────

  // Symbolic operators (>, <, >=, <=, !=, =)
  describe('T09 — symbolic operators', () => {
    const ops = [
      { q: 'Show students whose marks > 80',   op: '>' },
      { q: 'Show students whose marks < 80',   op: '<' },
      { q: 'Show students whose marks >= 80',  op: '>=' },
      { q: 'Show students whose marks <= 80',  op: '<=' },
      { q: 'Show students whose marks != 80',  op: '!=' },
      { q: 'Show students whose marks = 80',   op: '='  },
    ];
    for (const { q, op } of ops) {
      it(`parses "${op}" successfully`, () => {
        const { parseResult } = compile(q);
        expect(parseResult.success).toBe(true);
        const opNode = findNode(parseResult.tree, NODE_OPERATOR);
        expect(opNode.value).toBe(op);
      });
    }
  });

  // String value
  it('T10 — parses a string value correctly', () => {
    const { parseResult } = compile("Show students whose name is equal to 'Alice'");
    expect(parseResult.success).toBe(true);
    const val = findNode(parseResult.tree, NODE_VALUE);
    expect(val.value).toBe("'Alice'");
  });

  // nodeCount > 0 for valid queries
  it('T11 — nodeCount reflects real tree size', () => {
    const { parseResult } = compile('Show students whose marks are greater than 80');
    expect(parseResult.nodeCount).toBeGreaterThan(5);
  });

  // "Show all students" — connector ALL should be skipped gracefully
  it('T12 — skips leading connector ("Show all students")', () => {
    const { parseResult } = compile('Show all students');
    expect(parseResult.success).toBe(true);
    const source = findNode(parseResult.tree, NODE_SOURCE);
    expect(source.value).toBe('students');
  });

  // WHERE as introducer
  it('T13 — handles WHERE as condition introducer', () => {
    const { parseResult } = compile('Show students where marks > 80');
    expect(parseResult.success).toBe(true);
    expect(findNode(parseResult.tree, NODE_CONDITION_CLAUSE)).not.toBeNull();
  });

  // Empty input → error, no crash
  it('T14 — empty token stream returns error, not a crash', () => {
    const result = parse([]);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.tree).toBeNull();
  });

  // Lexically valid but semantically vacuous: "Show salary > 50000"
  // Parser should accept because semantic analysis belongs to Phase 6
  it('T15 — syntactically valid query with unknown column passes parser', () => {
    const { parseResult } = compile('Show students whose salary is greater than 50000');
    expect(parseResult.success).toBe(true);
  });
});
