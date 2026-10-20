/**
 * QueryMind Compiler — Token Type Definitions
 * Phase 3: Lexical Analysis
 *
 * This module defines the complete token type taxonomy.
 * Design rule: adding future token types MUST NOT require modifying the lexer core.
 */

// ─── Core token types (Phase 3) ──────────────────────────────────────────────

/** Language keywords that introduce a clause (SHOW, SELECT, FROM, …) */
export const TOKEN_KEYWORD    = 'KEYWORD';

/** Known table names resolved against the live schema */
export const TOKEN_TABLE      = 'TABLE';

/** Column names and unresolved word tokens that act as identifiers */
export const TOKEN_IDENTIFIER = 'IDENTIFIER';

/** Structural connectors linking clauses (WHOSE, WITH, THAN, OF, …) */
export const TOKEN_CONNECTOR  = 'CONNECTOR';

/** Comparison / logical operators (>, <, =, GREATER THAN, …) */
export const TOKEN_OPERATOR   = 'OPERATOR';

/** Integer or decimal numeric literals */
export const TOKEN_NUMBER     = 'NUMBER';

/** Single-quoted or double-quoted string literals */
export const TOKEN_STRING     = 'STRING';

/** Any text that did not match any known pattern */
export const TOKEN_UNKNOWN    = 'UNKNOWN';

// ─── Reserved type slots (Phase 4+ can populate these) ───────────────────────

/** Aggregate functions: COUNT, SUM, AVG, MIN, MAX */
export const TOKEN_AGGREGATE  = 'AGGREGATE';

/** Sorting directives: ASC, ASCENDING, DESC, DESCENDING */
export const TOKEN_SORT       = 'SORT';

/** Row-count limiters: LIMIT, TOP */
export const TOKEN_LIMIT      = 'LIMIT';

/** Grouping directives: GROUP BY */
export const TOKEN_GROUP      = 'GROUP';

/** Boolean literals or conjunction/disjunction tokens when used structurally */
export const TOKEN_BOOLEAN    = 'BOOLEAN';

/** Opening / closing parentheses */
export const TOKEN_PARENTHESIS = 'PARENTHESIS';

// ─── Convenience set for exhaustive checks ───────────────────────────────────

export const ALL_TOKEN_TYPES = [
  TOKEN_KEYWORD,
  TOKEN_TABLE,
  TOKEN_IDENTIFIER,
  TOKEN_CONNECTOR,
  TOKEN_OPERATOR,
  TOKEN_NUMBER,
  TOKEN_STRING,
  TOKEN_UNKNOWN,
  TOKEN_AGGREGATE,
  TOKEN_SORT,
  TOKEN_LIMIT,
  TOKEN_GROUP,
  TOKEN_BOOLEAN,
  TOKEN_PARENTHESIS,
];
