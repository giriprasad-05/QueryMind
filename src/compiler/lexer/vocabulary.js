/**
 * QueryMind Compiler — Lexer Vocabulary
 * Phase 3: Lexical Analysis
 *
 * Centralises every word/phrase the lexer recognises.
 * To extend the vocabulary: add entries here — the lexer core stays unchanged.
 *
 * All keys are UPPER-CASED normalised forms.
 * Multi-word entries MUST be listed before single-word entries in every
 * table that could produce a prefix clash (e.g. "GREATER THAN OR EQUAL TO"
 * before "GREATER THAN", which must come before "GREATER").
 */

import {
  TOKEN_KEYWORD,
  TOKEN_CONNECTOR,
  TOKEN_OPERATOR,
  TOKEN_AGGREGATE,
  TOKEN_SORT,
  TOKEN_LIMIT,
  TOKEN_GROUP,
  TOKEN_BOOLEAN,
} from './tokenTypes.js';

// ─── Multi-word phrases (Operators & Aggregates) ─────────────────────────────────────────────
// IMPORTANT: list longer phrases first so the greedy scanner finds them first.
export const MULTI_WORD_PHRASES = [
  // Operators
  { phrase: 'GREATER THAN OR EQUAL TO', type: TOKEN_OPERATOR },
  { phrase: 'LESS THAN OR EQUAL TO',    type: TOKEN_OPERATOR },
  { phrase: 'NOT EQUAL TO',             type: TOKEN_OPERATOR },
  { phrase: 'DIFFERENT FROM',           type: TOKEN_OPERATOR },
  { phrase: 'GREATER THAN',             type: TOKEN_OPERATOR },
  { phrase: 'MORE THAN',                type: TOKEN_OPERATOR },
  { phrase: 'LESS THAN',                type: TOKEN_OPERATOR },
  { phrase: 'EQUAL TO',                 type: TOKEN_OPERATOR },
  
  // Aggregates
  { phrase: 'NUMBER OF',                type: TOKEN_AGGREGATE },
  
  // Condition Connectors
  { phrase: 'AS WELL AS',               type: TOKEN_KEYWORD }, // Maps to AND later
  { phrase: 'HOW MANY',                 type: TOKEN_KEYWORD }, // Treated as SHOW action
];

// ─── Single-word keywords ─────────────────────────────────────────────────────
export const KEYWORDS = new Map([
  ['SHOW',     TOKEN_KEYWORD],
  ['SELECT',   TOKEN_KEYWORD],
  ['FROM',     TOKEN_KEYWORD],
  ['WHERE',    TOKEN_KEYWORD],
  ['AND',      TOKEN_KEYWORD],
  ['OR',       TOKEN_KEYWORD],
  ['BY',       TOKEN_KEYWORD],
  ['DISTINCT', TOKEN_KEYWORD],
  ['JOIN',     TOKEN_KEYWORD],
  ['ON',       TOKEN_KEYWORD],
  ['AS',       TOKEN_KEYWORD],
]);

// ─── Aggregate function keywords ─────────────────────────────────────────────
export const AGGREGATES = new Map([
  ['COUNT',    TOKEN_AGGREGATE],
  ['NUMBER',   TOKEN_AGGREGATE],
  ['SUM',      TOKEN_AGGREGATE],
  ['TOTAL',    TOKEN_AGGREGATE],
  ['AVG',      TOKEN_AGGREGATE],
  ['AVERAGE',  TOKEN_AGGREGATE],
  ['MEAN',     TOKEN_AGGREGATE],
  ['MIN',      TOKEN_AGGREGATE],
  ['MINIMUM',  TOKEN_AGGREGATE],
  ['LOWEST',   TOKEN_AGGREGATE],
  ['SMALLEST', TOKEN_AGGREGATE],
  ['MAX',      TOKEN_AGGREGATE],
  ['MAXIMUM',  TOKEN_AGGREGATE],
  ['HIGHEST',  TOKEN_AGGREGATE],
  ['LARGEST',  TOKEN_AGGREGATE],
]);

// ─── Sort-direction words ─────────────────────────────────────────────────────
export const SORT_WORDS = new Map([
  ['ASC',        TOKEN_SORT],
  ['ASCENDING',  TOKEN_SORT],
  ['DESC',       TOKEN_SORT],
  ['DESCENDING', TOKEN_SORT],
  ['ORDER',      TOKEN_SORT],   // ORDER (BY handled at keyword level as needed)
]);

// ─── Limit/top quantifiers ────────────────────────────────────────────────────
export const LIMIT_WORDS = new Map([
  ['LIMIT', TOKEN_LIMIT],
  ['TOP',   TOKEN_LIMIT],
]);

// ─── Group-by words ───────────────────────────────────────────────────────────
export const GROUP_WORDS = new Map([
  ['GROUP', TOKEN_GROUP],
]);

// ─── Connectors (Filler words) ───────────────────────────────────────────────────────────────
export const CONNECTORS = new Map([
  ['WHOSE',   TOKEN_CONNECTOR],
  ['WITH',    TOKEN_CONNECTOR],
  ['HAVING',  TOKEN_CONNECTOR],
  ['THAN',    TOKEN_CONNECTOR],  // standalone fallback (normally consumed by multi-word)
  ['THE',     TOKEN_CONNECTOR],
  ['OF',      TOKEN_CONNECTOR],
  ['IN',      TOKEN_CONNECTOR],
  ['IS',      TOKEN_CONNECTOR],
  ['ARE',     TOKEN_CONNECTOR],
  ['ALL',     TOKEN_CONNECTOR],
  ['A',       TOKEN_CONNECTOR],
  ['AN',      TOKEN_CONNECTOR],
  ['THAT',    TOKEN_CONNECTOR],
  ['HAVE',    TOKEN_CONNECTOR],
  ['AMONG',   TOKEN_CONNECTOR],
  ['FOR',     TOKEN_CONNECTOR],
  ['ME',      TOKEN_CONNECTOR],
  ['THERE',   TOKEN_CONNECTOR],
]);

// ─── Boolean literals ─────────────────────────────────────────────────────────
export const BOOLEANS = new Map([
  ['TRUE',  TOKEN_BOOLEAN],
  ['FALSE', TOKEN_BOOLEAN],
  ['NULL',  TOKEN_BOOLEAN],
]);

// ─── Single-character SQL-style symbolic operators ────────────────────────────
export const SYMBOL_OPERATORS = new Map([
  ['>=', TOKEN_OPERATOR],
  ['<=', TOKEN_OPERATOR],
  ['!=', TOKEN_OPERATOR],
  ['<>', TOKEN_OPERATOR],
  ['>',  TOKEN_OPERATOR],
  ['<',  TOKEN_OPERATOR],
  ['=',  TOKEN_OPERATOR],
]);

// ─── Table names (loaded lazily from schema at runtime) ──────────────────────
// The lexer accepts a `tableNames` Set so it remains decoupled from the schema module.
// src/compiler/lexer/lexer.js calls tokenize(input, tableNames).
