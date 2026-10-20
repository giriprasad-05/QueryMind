/**
 * QueryMind Compiler — Grammar Definitions
 * Phase 5: Syntax Analysis (Parser)
 *
 * This module documents the QueryMind grammar as a set of named constants.
 * It is the single source of truth for:
 *   - Node type labels used in the Concrete Syntax Tree (CST)
 *   - Operator lexeme canonicalization
 *   - The set of connector lexemes that introduce a CONDITION_CLAUSE
 *   - The set of keyword lexemes that introduce a logical AND / OR link
 *
 * Design rules
 * ─────────────
 * 1. No parsing logic here — this is pure data / constants.
 * 2. Adding a new node type or connector word never requires editing parser.js.
 * 3. All strings are UPPER-CASED to match token.lexeme comparisons in parser.js.
 *
 * Grammar (BNF-style, informal):
 *
 *   QUERY             → SHOW_QUERY
 *
 *   SHOW_QUERY        → SHOW  SOURCE
 *                     | SHOW  SOURCE  CONDITION_CLAUSE
 *
 *   CONDITION_CLAUSE  → CONNECTOR  CONDITION
 *                       (CONNECTOR ∈ { WHOSE, WITH, WHERE, HAVING })
 *
 *   CONDITION         → SIMPLE_CONDITION
 *                     | SIMPLE_CONDITION  AND  CONDITION
 *                     | SIMPLE_CONDITION  OR   CONDITION
 *
 *   SIMPLE_CONDITION  → IDENTIFIER  [CONNECTOR*]  COMPARISON_OPERATOR  VALUE
 *                       (optional connectors: IS, ARE, etc. — skipped gracefully)
 *
 *   COMPARISON_OPERATOR → OPERATOR token (>, <, =, !=, >=, <=,
 *                          GREATER THAN, LESS THAN, EQUAL TO, …)
 *
 *   VALUE             → NUMBER | STRING
 *
 *   SOURCE            → TABLE | IDENTIFIER  (IDENTIFIER fallback for unknown names)
 */

// ─── Concrete Syntax Tree node type labels ────────────────────────────────────

/** Root wrapper for any parsed query */
export const NODE_QUERY              = 'QUERY';

/** A SHOW/SELECT style query */
export const NODE_SHOW_QUERY         = 'SHOW_QUERY';

/** The action keyword node (SHOW, SELECT, …) */
export const NODE_ACTION             = 'ACTION';

/** The source table/identifier node */
export const NODE_SOURCE             = 'SOURCE';

/** A WHERE / WHOSE / WITH condition block */
export const NODE_CONDITION_CLAUSE   = 'CONDITION_CLAUSE';

/** A compound condition joined by AND or OR */
export const NODE_COMPOUND_CONDITION = 'COMPOUND_CONDITION';

/** A simple (single) predicate: column OP value */
export const NODE_SIMPLE_CONDITION   = 'SIMPLE_CONDITION';

/** The column (left-hand side of a predicate) */
export const NODE_COLUMN             = 'COLUMN';

/** A comparison operator node */
export const NODE_OPERATOR           = 'OPERATOR';

/** A literal value node (number or string) */
export const NODE_VALUE              = 'VALUE';

/** A logical connector between conditions (AND / OR) */
export const NODE_LOGICAL_OP         = 'LOGICAL_OP';

/** The projection clause (ALL_COLUMNS, COLUMN, or AGGREGATE) */
export const NODE_PROJECTION         = 'PROJECTION';

/** An aggregate function node */
export const NODE_AGGREGATE          = 'AGGREGATE';

/** The function name node (AVG, MAX, MIN, SUM, COUNT) */
export const NODE_FUNCTION           = 'FUNCTION';

// ─── Lexeme sets used by the parser ──────────────────────────────────────────

/**
 * Keyword lexemes that introduce a CONDITION_CLAUSE.
 * The parser checks token.lexeme against this set.
 */
export const CONDITION_INTRODUCERS = new Set([
  'WHOSE',
  'WHERE',
  'WITH',
  'HAVING',
]);

/**
 * Keyword / connector lexemes treated as logical operators between conditions.
 * Corresponding token types are KEYWORD (AND, OR).
 */
export const LOGICAL_OPERATORS = new Set([
  'AND',
  'OR',
]);

/**
 * Connector lexemes that may appear between COLUMN and OPERATOR in a
 * SIMPLE_CONDITION and should be silently skipped.
 * Examples: "marks ARE greater than 80", "age IS less than 20"
 */
export const BRIDGE_CONNECTORS = new Set([
  'IS',
  'ARE',
  'BE',
  'WAS',
  'WERE',
]);

/**
 * Keyword lexemes that introduce a SHOW-style query.
 * Extend this set to support SELECT, LIST, FIND, etc.
 */
export const SHOW_KEYWORDS = new Set([
  'SHOW',
  'SELECT',
  'LIST',
  'FIND',
  'GET',
  'DISPLAY',
]);
