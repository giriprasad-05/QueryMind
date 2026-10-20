/**
 * QueryMind Compiler — Lexical Analyzer (Lexer)
 * Phase 3: Lexical Analysis
 *
 * Scans raw input text into structured tokens with position tracking.
 */

import {
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
} from './tokenTypes.js';

import {
  MULTI_WORD_PHRASES,
  KEYWORDS,
  AGGREGATES,
  SORT_WORDS,
  LIMIT_WORDS,
  GROUP_WORDS,
  CONNECTORS,
  SYMBOL_OPERATORS,
} from './vocabulary.js';

export function tokenize(rawInput, schemaOrTableNames) {
  if (typeof rawInput !== 'string' || rawInput.trim() === '') {
    return { tokens: [], errors: [] };
  }

  // Build a Set of known uppercase table names
  const knownTables = new Set();
  if (schemaOrTableNames instanceof Set) {
    for (const t of schemaOrTableNames) {
      if (typeof t === 'string') knownTables.add(t.toUpperCase());
    }
  } else if (schemaOrTableNames && Array.isArray(schemaOrTableNames.tables)) {
    for (const t of schemaOrTableNames.tables) {
      if (t && t.name) knownTables.add(String(t.name).toUpperCase());
    }
  }

  const tokens = [];
  const errors = [];
  let pos = 0;
  const len = rawInput.length;

  while (pos < len) {
    const ch = rawInput[pos];

    // 1. Whitespace
    if (/\s/.test(ch)) {
      pos++;
      continue;
    }

    // 2. String literals ('...' or "...")
    if (ch === "'" || ch === '"') {
      const quoteChar = ch;
      const start = pos;
      pos++; // skip opening quote
      while (pos < len && rawInput[pos] !== quoteChar) {
        pos++;
      }
      if (pos < len) {
        pos++; // consume closing quote
      }
      const strVal = rawInput.slice(start, pos);
      tokens.push({
        type: TOKEN_STRING,
        value: strVal,
        lexeme: strVal,
        position: start,
        length: pos - start,
        index: tokens.length,
      });
      continue;
    }

    // 3. Multi-word phrases (Operators & Aggregates)
    let matchedMulti = false;
    for (const { phrase, type } of MULTI_WORD_PHRASES) {
      if (rawInput.slice(pos, pos + phrase.length).toUpperCase() === phrase) {
        const nextChar = rawInput[pos + phrase.length];
        if (!nextChar || !/[a-zA-Z0-9_]/.test(nextChar)) {
          const matchedLexeme = rawInput.slice(pos, pos + phrase.length);
          let value = phrase;

          if (phrase === 'GREATER THAN OR EQUAL TO') value = '>=';
          else if (phrase === 'LESS THAN OR EQUAL TO') value = '<=';
          else if (phrase === 'NOT EQUAL TO' || phrase === 'DIFFERENT FROM') value = '!=';
          else if (phrase === 'GREATER THAN' || phrase === 'MORE THAN') value = '>';
          else if (phrase === 'LESS THAN') value = '<';
          else if (phrase === 'EQUAL TO') value = '=';
          else if (phrase === 'NUMBER OF') value = 'COUNT';
          else if (phrase === 'AS WELL AS') value = 'AND';
          else if (phrase === 'HOW MANY') value = 'SHOW';

          tokens.push({
            type,
            value,
            lexeme: matchedLexeme,
            position: pos,
            length: phrase.length,
            index: tokens.length,
          });

          pos += phrase.length;
          matchedMulti = true;
          break;
        }
      }
    }
    if (matchedMulti) continue;

    // 4. Symbolic operators (>=, <=, !=, <>, >, <, =)
    const twoChar = rawInput.slice(pos, pos + 2);
    if (SYMBOL_OPERATORS.has(twoChar)) {
      tokens.push({
        type: TOKEN_OPERATOR,
        value: twoChar === '<>' ? '!=' : twoChar,
        lexeme: twoChar,
        position: pos,
        length: 2,
        index: tokens.length,
      });
      pos += 2;
      continue;
    }

    if (SYMBOL_OPERATORS.has(ch)) {
      tokens.push({
        type: TOKEN_OPERATOR,
        value: ch,
        lexeme: ch,
        position: pos,
        length: 1,
        index: tokens.length,
      });
      pos += 1;
      continue;
    }

    // 5. Numeric literals (integer or decimal)
    const numMatch = rawInput.slice(pos).match(/^\d+(?:\.\d+)?/);
    if (numMatch) {
      const numStr = numMatch[0];
      tokens.push({
        type: TOKEN_NUMBER,
        value: numStr,
        lexeme: numStr,
        position: pos,
        length: numStr.length,
        index: tokens.length,
      });
      pos += numStr.length;
      continue;
    }

    // 6. Word tokens (identifiers, keywords, tables, connectors)
    const wordMatch = rawInput.slice(pos).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const wordUpper = word.toUpperCase();
      let type;
      let value = wordUpper;

      if (wordUpper === 'WHOSE') {
        type = TOKEN_KEYWORD;
        value = 'WHERE';
      } else if (KEYWORDS.has(wordUpper)) {
        type = TOKEN_KEYWORD;
        value = wordUpper;
      } else if (AGGREGATES.has(wordUpper)) {
        type = TOKEN_AGGREGATE;
        if (['AVG', 'AVERAGE', 'MEAN'].includes(wordUpper)) value = 'AVG';
        else if (['COUNT', 'NUMBER'].includes(wordUpper)) value = 'COUNT';
        else if (['SUM', 'TOTAL'].includes(wordUpper)) value = 'SUM';
        else if (['MIN', 'MINIMUM', 'LOWEST', 'SMALLEST'].includes(wordUpper)) value = 'MIN';
        else if (['MAX', 'MAXIMUM', 'HIGHEST', 'LARGEST'].includes(wordUpper)) value = 'MAX';
        else value = wordUpper;
      } else if (LIMIT_WORDS.has(wordUpper)) {
        type = TOKEN_LIMIT;
        value = wordUpper;
      } else if (SORT_WORDS.has(wordUpper)) {
        type = TOKEN_SORT;
        value = SORT_WORDS.get(wordUpper);
      } else if (GROUP_WORDS.has(wordUpper)) {
        type = TOKEN_GROUP;
        value = GROUP_WORDS.get(wordUpper);
      } else if (CONNECTORS.has(wordUpper)) {
        type = TOKEN_CONNECTOR;
        value = wordUpper;
      } else if (knownTables.has(wordUpper)) {
        type = TOKEN_TABLE;
        value = wordUpper;
      } else {
        type = TOKEN_IDENTIFIER;
        value = wordUpper;
      }

      tokens.push({
        type,
        value,
        lexeme: word,
        position: pos,
        length: word.length,
        index: tokens.length,
      });

      pos += word.length;
      continue;
    }

    // 7. Punctuation / Unknown symbols
    if (ch === ',') {
      tokens.push({
        type: TOKEN_CONNECTOR,
        value: ',',
        lexeme: ',',
        position: pos,
        length: 1,
        index: tokens.length,
      });
      pos++;
      continue;
    }

    // Unrecognized characters
    errors.push({
      message: `Unrecognized character '${ch}' at position ${pos}`,
      value: ch,
      position: pos,
    });
    tokens.push({
      type: TOKEN_UNKNOWN,
      value: ch,
      lexeme: ch,
      position: pos,
      length: 1,
      index: tokens.length,
    });
    pos++;
  }

  return { tokens, errors };
}
