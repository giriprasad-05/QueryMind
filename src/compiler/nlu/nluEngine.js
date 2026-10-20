/**
 * QueryMind Compiler — Deterministic Natural Language Understanding (NLU) Engine
 *
 * Implements deterministic semantic parsing using:
 * - Normalization rules and synonyms
 * - Schema-aware table and column detection
 * - Foreign-key relationship discovery from the live PostgreSQL schema
 * - Condition and projection extraction
 *
 * No external APIs, LLMs, or runtime ML models.
 */

import { DATABASE_SCHEMA } from '../../data/schema.js';

// Table name singular/plural helper
function matchTableName(word, tableDef) {
  if (!word || !tableDef) return false;
  const w = word.toLowerCase();
  const t = tableDef.name.toLowerCase();
  if (w === t) return true;
  // Singular / Plural
  if (t.endsWith('s') && w === t.slice(0, -1)) return true;
  if (!t.endsWith('s') && w === t + 's') return true;
  if (t === 'faculty' && (w === 'faculties' || w === 'faculty')) return true;
  return false;
}

// Column name singular/plural/synonym helper
function matchColumnName(word, colDef) {
  if (!word || !colDef) return false;
  const w = word.toLowerCase();
  const c = colDef.name.toLowerCase();
  if (w === c) return true;
  if (w === 'names' && c === 'name') return true;
  if ((w === 'score' || w === 'scores' || w === 'marks' || w === 'mark') && c === 'marks') return true;
  if ((w === 'age' || w === 'ages') && c === 'age') return true;
  if ((w === 'department' || w === 'departments' || w === 'dept') && c === 'department') return true;
  if ((w === 'credit' || w === 'credits') && c === 'credits') return true;
  if ((w === 'course' || w === 'course_name') && (c === 'course_name' || c === 'name')) return true;
  return false;
}

// Discover foreign key relationship between two tables from schema
function findRelationship(t1Def, t2Def, schema) {
  const t1Name = t1Def.name.toLowerCase();
  const t2Name = t2Def.name.toLowerCase();

  // 1. Check t1's declared foreign keys
  if (Array.isArray(t1Def.foreignKeys)) {
    const fk = t1Def.foreignKeys.find(
      k => (k.referencedTable || k.targetTable || '').toLowerCase() === t2Name
    );
    if (fk) {
      return {
        left: `${t1Def.name}.${fk.column || fk.sourceColumn}`,
        right: `${t2Def.name}.${fk.referencedColumn || fk.targetColumn}`,
        type: 'INNER',
      };
    }
  }

  // 2. Check t2's declared foreign keys
  if (Array.isArray(t2Def.foreignKeys)) {
    const fk = t2Def.foreignKeys.find(
      k => (k.referencedTable || k.targetTable || '').toLowerCase() === t1Name
    );
    if (fk) {
      return {
        left: `${t1Def.name}.${fk.referencedColumn || fk.targetColumn}`,
        right: `${t2Def.name}.${fk.column || fk.sourceColumn}`,
        type: 'INNER',
      };
    }
  }

  // 3. Fallback: check columns in t1 referencing t2 primary key (e.g. students.faculty_id -> faculty.faculty_id)
  const t2Pk = t2Def.columns.find(c => c.isPrimary) || t2Def.columns[0];
  const t1FkCol = t1Def.columns.find(
    c =>
      c.name.toLowerCase() === `${t2Name}_id` ||
      (t2Pk && c.name.toLowerCase() === t2Pk.name.toLowerCase() && c.name.toLowerCase().includes('_id'))
  );
  if (t1FkCol && t2Pk) {
    return {
      left: `${t1Def.name}.${t1FkCol.name}`,
      right: `${t2Def.name}.${t2Pk.name}`,
      type: 'INNER',
    };
  }

  // Check columns in t2 referencing t1 primary key
  const t1Pk = t1Def.columns.find(c => c.isPrimary) || t1Def.columns[0];
  const t2FkCol = t2Def.columns.find(
    c =>
      c.name.toLowerCase() === `${t1Name}_id` ||
      (t1Pk && c.name.toLowerCase() === t1Pk.name.toLowerCase() && c.name.toLowerCase().includes('_id'))
  );
  if (t2FkCol && t1Pk) {
    return {
      left: `${t1Def.name}.${t1Pk.name}`,
      right: `${t2Def.name}.${t2FkCol.name}`,
      type: 'INNER',
    };
  }

  return null;
}

// ─── Condition extraction helpers ─────────────────────────────────────────────

const HONORIFIC_RE = /^(prof|dr|mr|mrs|ms|miss)\.\s+/i;
const NAME_PATTERN_PREFIX = '^(?:(?:prof|dr|mr|mrs|ms|miss)\\.\\s+)?';

const STOPWORDS = new Set([
  'the', 'all', 'a', 'an', 'of', 'to', 'in', 'from', 'their', 'respective',
  'and', 'or', 'but', 'not', 'whose', 'who', 'that', 'which',
  'greater', 'less', 'than', 'more',
]);

const OPERATOR_PHRASES = [
  { words: ['greater', 'than', 'or', 'equal', 'to'], op: '>=' },
  { words: ['less', 'than', 'or', 'equal', 'to'], op: '<=' },
  { words: ['above', 'or', 'equal', 'to'], op: '>=' },
  { words: ['below', 'or', 'equal', 'to'], op: '<=' },
  { words: ['at', 'least'], op: '>=' },
  { words: ['at', 'most'], op: '<=' },
  { words: ['different', 'from'], op: '!=' },
  { words: ['greater', 'than'], op: '>' },
  { words: ['more', 'than'], op: '>' },
  { words: ['less', 'than'], op: '<' },
  { words: ['equal', 'to'], op: '=' },
];

const SINGLE_OP_SYNONYMS = {
  above: '>',
  over: '>',
  higher: '>',
  exceeds: '>',
  exceed: '>',
  below: '<',
  under: '<',
  lower: '<',
  equals: '=',
};

function regexEscape(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function singularOf(name) {
  const t = String(name).toLowerCase();
  return t.endsWith('s') ? t.slice(0, -1) : t;
}

function normalizeColumnType(colType) {
  const u = String(colType || '').toUpperCase();
  if (u.startsWith('INT') || u.startsWith('NUM') || u.startsWith('FLOAT') || u.startsWith('DEC')) return 'number';
  return 'string';
}

function stripHonorific(raw) {
  const s = String(raw).trim().replace(/\s+/g, ' ');
  const m = s.match(HONORIFIC_RE);
  return m ? s.slice(m[0].length).trim() : s;
}

function negateOperator(op) {
  switch (op) {
    case '=': return '!=';
    case '!=': return '=';
    case '>': return '<=';
    case '<': return '>=';
    case '>=': return '<';
    case '<=': return '>';
    default: return '!=';
  }
}

function tokenizeQuery(query) {
  const tokens = [];
  let i = 0;
  const len = query.length;
  while (i < len) {
    const ch = query[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === "'" || ch === '"') {
      const start = i;
      const q = ch;
      let j = i + 1;
      while (j < len && query[j] !== q) j++;
      const inner = query.slice(i + 1, j);
      const end = j < len ? j + 1 : j;
      tokens.push({ kind: 'string', value: inner, start, end });
      i = end;
      continue;
    }
    const two = query.slice(i, i + 2);
    if (two === '>=' || two === '<=' || two === '!=' || two === '<>') {
      tokens.push({ kind: 'op', value: two === '<>' ? '!=' : two, start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (ch === '>' || ch === '<' || ch === '=') {
      tokens.push({ kind: 'op', value: ch, start: i, end: i + 1 });
      i += 1;
      continue;
    }
    const num = query.slice(i).match(/^\d+(?:\.\d+)?/);
    if (num) {
      tokens.push({ kind: 'number', value: num[0], start: i, end: i + num[0].length });
      i += num[0].length;
      continue;
    }
    const word = query.slice(i).match(/^[a-zA-Z][a-zA-Z0-9_]*/);
    if (word) {
      tokens.push({ kind: 'word', value: word[0], lower: word[0].toLowerCase(), start: i, end: i + word[0].length });
      i += word[0].length;
      continue;
    }
    tokens.push({ kind: 'punct', value: ch, start: i, end: i + 1 });
    i += 1;
  }
  return tokens;
}

function isWordToken(token, word) {
  return !!token && token.kind === 'word' && token.lower === word;
}

function matchOperatorPhrase(tokens, i) {
  for (const p of OPERATOR_PHRASES) {
    let ok = true;
    for (let k = 0; k < p.words.length; k++) {
      if (!isWordToken(tokens[i + k], p.words[k])) { ok = false; break; }
    }
    if (ok) return { op: p.op, consumed: p.words.length };
  }
  return null;
}

function buildColumnMaps(detectedTables) {
  const qualified = new Map();
  const unqualified = new Map();
  for (const tDef of detectedTables) {
    const tName = tDef.name;
    const tLower = tName.toLowerCase();
    const tableWords = Array.from(new Set([tLower, singularOf(tName)]));
    for (const cDef of tDef.columns) {
      const cName = cDef.name;
      const cLower = cName.toLowerCase();
      const entry = {
        table: tName,
        column: cName,
        type: normalizeColumnType(cDef.type),
        isName: cLower === 'name',
      };

      // Strip a leading "<table>_" prefix so "faculty id" resolves to faculty.faculty_id
      // and "course name" resolves to courses.course_name.
      let tail = cLower;
      for (const tw of tableWords) {
        if (tail.startsWith(tw + '_')) { tail = tail.slice(tw.length + 1); break; }
      }
      tail = tail.replace(/_/g, ' ');

      for (const tw of tableWords) {
        const phrase = `${tw} ${tail}`;
        if (!qualified.has(phrase)) qualified.set(phrase, entry);
      }
      if (cLower.includes('_') && !qualified.has(cLower)) {
        qualified.set(cLower, entry);
      }
      if (!cLower.includes('_')) {
        if (!unqualified.has(cLower)) unqualified.set(cLower, []);
        unqualified.get(cLower).push(entry);
      }
    }
  }
  return { qualified, unqualified };
}

function resolveColumnAt(tokens, i, maps, mainTable) {
  const t = tokens[i];
  if (!t || t.kind !== 'word') return null;
  if (i + 1 < tokens.length && tokens[i + 1].kind === 'word') {
    const phrase = `${t.lower} ${tokens[i + 1].lower}`;
    if (maps.qualified.has(phrase)) return { entry: maps.qualified.get(phrase), consumed: 2 };
  }
  if (t.lower.includes('_')) {
    if (maps.qualified.has(t.lower)) return { entry: maps.qualified.get(t.lower), consumed: 1 };
    const human = t.lower.replace(/_/g, ' ');
    if (maps.qualified.has(human)) return { entry: maps.qualified.get(human), consumed: 1 };
  }
  const entries = maps.unqualified.get(t.lower);
  if (entries && entries.length > 0) {
    const main = entries.find(e => e.table.toLowerCase() === mainTable.toLowerCase());
    return { entry: main || entries[0], consumed: 1 };
  }
  return null;
}

function readValue(tokens, i, entry, query) {
  if (i >= tokens.length) return null;
  const t = tokens[i];
  if (t.kind === 'op') return null;
  if (t.kind === 'string') return { raw: t.value, consumed: 1 };
  if (entry.type === 'number') {
    if (t.kind === 'number') return { raw: t.value, consumed: 1 };
    if (t.kind === 'word') return { raw: t.value, consumed: 1 };
    return null;
  }
  // String column: capture a run of word/number/period tokens, stopping at
  // conjunctions, operators, or clause introducers.
  const breakers = new Set(['and', 'or', 'but', 'whose', 'who', 'that', 'which', 'order', 'group', 'having', 'limit', 'sort', 'top']);
  let j = i;
  const parts = [];
  while (j < tokens.length) {
    const tk = tokens[j];
    if (tk.kind === 'word' && breakers.has(tk.lower)) break;
    if (tk.kind === 'op') break;
    if (tk.kind === 'punct' && tk.value !== '.') break;
    if (tk.kind === 'word' || tk.kind === 'number' || (tk.kind === 'punct' && tk.value === '.')) {
      parts.push(tk);
      j++;
    } else {
      break;
    }
  }
  if (parts.length === 0) return null;
  const raw = query.slice(parts[0].start, parts[parts.length - 1].end).trim();
  return { raw, consumed: j - i };
}

function makeCond(entry, operator, raw) {
  if (entry.type === 'number') {
    const str = String(raw);
    if (str.trim() !== '' && /^-?\d+(?:\.\d+)?$/.test(str.trim())) {
      return { operator, value: Number(str.trim()) };
    }
    return { operator, value: `'${str.replace(/'/g, "''")}'` };
  }
  if (entry.isName) {
    const base = stripHonorific(raw);
    const pattern = NAME_PATTERN_PREFIX + regexEscape(base) + '$';
    if (operator === '=') return { operator: '~*', value: pattern };
    if (operator === '!=') return { operator: '!~*', value: pattern };
  }
  return { operator, value: `'${String(raw).replace(/'/g, "''")}'` };
}

function parseConditionAt(tokens, pos, entry, query) {
  let j = pos;
  let negate = false;
  let hadLinkingVerb = false;
  if (isWordToken(tokens[j], 'is') || isWordToken(tokens[j], 'are')) { hadLinkingVerb = true; j++; }
  if (isWordToken(tokens[j], 'not')) { negate = true; j++; }

  // BETWEEN low AND high
  if (isWordToken(tokens[j], 'between')) {
    const low = tokens[j + 1];
    const andTok = tokens[j + 2];
    const high = tokens[j + 3];
    if (low && low.kind === 'number' && andTok && andTok.kind === 'word' && andTok.lower === 'and' && high && high.kind === 'number') {
      return {
        conditions: [
          { operator: '>=', value: Number(low.value) },
          { operator: '<=', value: Number(high.value) },
        ],
        consumed: (j + 4) - pos,
        between: true,
      };
    }
  }

  // Symbolic operator (=, >, <, >=, <=, !=)
  if (tokens[j] && tokens[j].kind === 'op') {
    let op = tokens[j].value;
    j++;
    if (negate) op = negateOperator(op);
    const val = readValue(tokens, j, entry, query);
    if (!val) return null;
    return { conditions: [makeCond(entry, op, val.raw)], consumed: (j + val.consumed) - pos, between: false };
  }

  // Word operator phrase ("greater than", "at least", "equal to", …)
  const phrase = matchOperatorPhrase(tokens, j);
  if (phrase) {
    let op = phrase.op;
    if (negate) op = negateOperator(op);
    const val = readValue(tokens, j + phrase.consumed, entry, query);
    if (!val) return null;
    return { conditions: [makeCond(entry, op, val.raw)], consumed: (j + phrase.consumed + val.consumed) - pos, between: false };
  }

  // Single-word operator synonym ("above", "below", "equals", …)
  if (tokens[j] && tokens[j].kind === 'word' && SINGLE_OP_SYNONYMS[tokens[j].lower]) {
    let op = SINGLE_OP_SYNONYMS[tokens[j].lower];
    j++;
    if (negate) op = negateOperator(op);
    const val = readValue(tokens, j, entry, query);
    if (!val) return null;
    return { conditions: [makeCond(entry, op, val.raw)], consumed: (j + val.consumed) - pos, between: false };
  }

  // Implicit equality only with an explicit linking verb: "<col> is [not] <value>"
  if (hadLinkingVerb) {
    const val = readValue(tokens, j, entry, query);
    if (val) {
      return { conditions: [makeCond(entry, negate ? '!=' : '=', val.raw)], consumed: (j + val.consumed) - pos, between: false };
    }
  }

  return null;
}

function readSingleValue(tokens, i) {
  if (i >= tokens.length) return null;
  const t = tokens[i];
  if (t.kind === 'string') return { raw: t.value, consumed: 1 };
  if (t.kind === 'word' || t.kind === 'number') return { raw: t.value, consumed: 1 };
  return null;
}

// Idiomatic conditions that reference a column without naming it directly
// ("older than", "scoring above", "belong to", "from", "in").
function parseIdiom(tokens, i, resolveUnqualified) {
  const t = tokens[i];
  if (!t || t.kind !== 'word') return null;
  const w = t.lower;

  if (w === 'older' || w === 'younger') {
    let j = i + 1;
    if (isWordToken(tokens[j], 'than')) j++;
    if (tokens[j] && tokens[j].kind === 'number') {
      const entry = resolveUnqualified('age');
      if (entry) {
        return {
          entry,
          conditions: [{ operator: w === 'older' ? '>' : '<', value: Number(tokens[j].value) }],
          consumed: j + 1 - i,
          between: false,
        };
      }
    }
    return null;
  }

  if (w === 'scored' || w === 'scoring') {
    let j = i + 1;
    let op = null;
    if (isWordToken(tokens[j], 'above') || isWordToken(tokens[j], 'over')) { op = '>'; j++; }
    else if (isWordToken(tokens[j], 'below') || isWordToken(tokens[j], 'under')) { op = '<'; j++; }
    else if (isWordToken(tokens[j], 'more') && isWordToken(tokens[j + 1], 'than')) { op = '>'; j += 2; }
    else if (isWordToken(tokens[j], 'less') && isWordToken(tokens[j + 1], 'than')) { op = '<'; j += 2; }
    if (op && tokens[j] && tokens[j].kind === 'number') {
      const entry = resolveUnqualified('marks');
      if (entry) {
        return {
          entry,
          conditions: [{ operator: op, value: Number(tokens[j].value) }],
          consumed: j + 1 - i,
          between: false,
        };
      }
    }
    return null;
  }

  if (w === 'belong' || w === 'belonging' || w === 'from' || w === 'in') {
    let j = i + 1;
    if (isWordToken(tokens[j], 'to')) j++;
    if (isWordToken(tokens[j], 'the')) j++;
    const val = readSingleValue(tokens, j);
    if (val && !STOPWORDS.has(val.raw.toLowerCase())) {
      const entry = resolveUnqualified('department');
      if (entry) {
        return {
          entry,
          conditions: [{ operator: '=', value: `'${val.raw.replace(/'/g, "''")}'` }],
          consumed: (j + val.consumed) - i,
          between: false,
        };
      }
    }
    return null;
  }

  return null;
}

function extractConditions(query, detectedTables, mainTable) {
  const tokens = tokenizeQuery(query);
  const maps = buildColumnMaps(detectedTables);
  const resolveUnqualified = (word) => {
    const entries = maps.unqualified.get(word);
    if (!entries || entries.length === 0) return null;
    const main = entries.find(e => e.table.toLowerCase() === mainTable.toLowerCase());
    return main || entries[0];
  };

  // Words that may legally appear before "is"/"are"/an operator without being a column.
  const tableWords = new Set();
  for (const tDef of detectedTables) {
    const tl = tDef.name.toLowerCase();
    tableWords.add(tl);
    tableWords.add(singularOf(tl));
  }
  const NON_COLUMN_INTRO = new Set([
    'show', 'select', 'list', 'display', 'find', 'give', 'get', 'me',
    'how', 'many', 'what', 'which', 'whose', 'who', 'that', 'where',
    'average', 'avg', 'mean', 'sum', 'total', 'count', 'min', 'max',
    'minimum', 'maximum', 'number', 'the', 'of', 'all', 'their', 'respective',
    'order', 'group', 'by', 'having', 'limit', 'top', 'sort',
  ]);

  const conditions = [];
  const logicalOperators = [];
  const conditionColumns = new Set();
  const conditionErrors = [];
  const seen = new Set();
  let pendingConnector = null;

  const qualify = (entry) =>
    entry.table.toLowerCase() === mainTable.toLowerCase() ? entry.column : `${entry.table}.${entry.column}`;

  function addCondition(entry, operator, value, forcedConnector) {
    const colKey = qualify(entry);
    const dedupeKey = `${colKey}|${operator}|${value}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const conn = forcedConnector !== undefined ? forcedConnector : pendingConnector;
    if (conditions.length > 0 && conn) logicalOperators.push(conn);
    conditions.push({ column: colKey, operator, value });
    conditionColumns.add(colKey.toLowerCase());
    pendingConnector = null;
  }

  function looksLikeConditionStart(idx) {
    const next = tokens[idx + 1];
    if (!next) return false;
    if (isWordToken(next, 'is') || isWordToken(next, 'are') || isWordToken(next, 'equals') || isWordToken(next, 'not')) return true;
    if (next.kind === 'op') return true;
    if (next.kind === 'word' && SINGLE_OP_SYNONYMS[next.lower]) return true;
    if (matchOperatorPhrase(tokens, idx + 1)) return true;
    return false;
  }

  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];

    if (t.kind === 'word') {
      const w = t.lower;
      if (w === 'and' || w === 'but') { pendingConnector = 'AND'; i++; continue; }
      if (w === 'or') { pendingConnector = 'OR'; i++; continue; }
      if (w === 'whose' || w === 'who' || w === 'that' || w === 'which') {
        if (pendingConnector === null) pendingConnector = 'AND';
        i++;
        continue;
      }
    }
    if (t.kind === 'punct' && t.value === ',') {
      if (pendingConnector === null) pendingConnector = 'AND';
      i++;
      continue;
    }

    const idiom = parseIdiom(tokens, i, resolveUnqualified);
    if (idiom) {
      idiom.conditions.forEach((cond, idx) => {
        addCondition(idiom.entry, cond.operator, cond.value, idiom.between && idx === 1 ? 'AND' : undefined);
      });
      i += idiom.consumed;
      continue;
    }

    const resolved = resolveColumnAt(tokens, i, maps, mainTable);
    if (resolved) {
      const parsed = parseConditionAt(tokens, i + resolved.consumed, resolved.entry, query);
      if (parsed) {
        parsed.conditions.forEach((cond, idx) => {
          addCondition(resolved.entry, cond.operator, cond.value, parsed.between && idx === 1 ? 'AND' : undefined);
        });
        i += resolved.consumed + parsed.consumed;
        continue;
      }
      i++;
      continue;
    }

    // A word that is not a known column/table but is followed by a linking verb
    // or operator is an unrecognized column reference → report rather than drop.
    if (
      t.kind === 'word' &&
      !tableWords.has(t.lower) &&
      !NON_COLUMN_INTRO.has(t.lower) &&
      !STOPWORDS.has(t.lower) &&
      looksLikeConditionStart(i)
    ) {
      conditionErrors.push({
        type: 'COLUMN_NOT_FOUND',
        message: `Unknown column or attribute '${t.value}' in query.`,
      });
      i += 2; // skip the word and its operator to avoid cascading errors
      continue;
    }

    i++;
  }

  return { conditions, logicalOperators, conditionColumns, errors: conditionErrors };
}

export function processNLU(rawQuery, schema) {
  if (!schema || !Array.isArray(schema.tables) || schema.tables.length === 0) {
    schema = DATABASE_SCHEMA;
  }

  const errors = [];
  const query = (rawQuery || '').trim();

  if (!query) {
    return {
      tokens: [],
      canonicalQuery: null,
      errors: ['Query cannot be empty.'],
    };
  }

  // 1. Identify all tables referenced in the query in order of appearance
  const detectedTables = [];
  const words = query.replace(/[?,!;.]/g, ' ').split(/\s+/).filter(Boolean);

  for (const w of words) {
    for (const tableDef of schema.tables) {
      if (matchTableName(w, tableDef) && !detectedTables.find(t => t.name.toLowerCase() === tableDef.name.toLowerCase())) {
        detectedTables.push(tableDef);
      }
    }
  }

  // Default to students if no table matched and schema has students
  if (detectedTables.length === 0) {
    const defaultTable = schema.tables.find(t => t.name.toLowerCase() === 'students') || schema.tables[0];
    if (defaultTable) {
      detectedTables.push(defaultTable);
    } else {
      errors.push('No database tables could be matched to your request.');
      return { tokens: [], canonicalQuery: null, errors };
    }
  }

  const mainTable = detectedTables[0].name;

  // 2. Resolve JOINs if multiple tables are detected
  const joins = [];
  if (detectedTables.length > 1) {
    for (let i = 0; i < detectedTables.length - 1; i++) {
      const t1 = detectedTables[i];
      const t2 = detectedTables[i + 1];
      const rel = findRelationship(t1, t2, schema);
      if (rel) {
        joins.push(rel);
      } else {
        errors.push({
          type: 'RELATIONSHIP_NOT_FOUND',
          message: `No relationship (foreign key) found between '${t1.name}' and '${t2.name}'.`,
        });
      }
    }
  }

  // 3. Extract Filtering Conditions
  const {
    conditions,
    logicalOperators,
    conditionColumns,
    errors: conditionErrors,
  } = extractConditions(query, detectedTables, mainTable);
  for (const e of conditionErrors) errors.push(e);

  // 4. Extract Projections & Aggregates
  const projections = [];

  // Check for Aggregates:
  const isAverage = /\b(?:average|avg|mean)\b/i.test(query);
  const isMax = /\b(?:maximum|max|highest)\b/i.test(query);
  const isMin = /\b(?:minimum|min|lowest)\b/i.test(query);
  const isSum = /\b(?:total|sum)\b/i.test(query);
  const isCount = /\b(?:how\s+many|count|number\s+of)\b/i.test(query);

  if (isAverage) {
    const aggCol = detectedTables[0].columns.find(c => matchColumnName('marks', c)) || { name: 'marks' };
    projections.push(`AVG(${aggCol.name})`);
  } else if (isMax) {
    const aggCol = detectedTables[0].columns.find(c => matchColumnName('marks', c)) || { name: 'marks' };
    projections.push(`MAX(${aggCol.name})`);
  } else if (isMin) {
    const aggCol = detectedTables[0].columns.find(c => matchColumnName('marks', c)) || { name: 'marks' };
    projections.push(`MIN(${aggCol.name})`);
  } else if (isSum) {
    const aggCol = detectedTables[0].columns.find(c => matchColumnName('marks', c)) || { name: 'marks' };
    projections.push(`SUM(${aggCol.name})`);
  } else if (isCount) {
    projections.push('COUNT(*)');
  } else {
    // Check for explicit column mentions across detected tables that are NOT condition columns
    if (detectedTables.length > 1) {
      // Multi-table query (e.g. "Show students and their respective faculty name")
      for (const tDef of detectedTables) {
        // Look for column names qualified with table or naturally associated
        // If "faculty name", check faculty's name column
        const tableQualifiedColMatch = new RegExp(`\\b${tDef.name}\\s+([a-zA-Z_]+)\\b`, 'i').exec(query);
        if (tableQualifiedColMatch) {
          const matchedCol = tDef.columns.find(c => matchColumnName(tableQualifiedColMatch[1], c));
          if (matchedCol) {
            projections.push(`${tDef.name}.${matchedCol.name}`);
            continue;
          }
        }

        // If table mentioned and has a 'name' column:
        const hasNameCol = tDef.columns.find(c => c.name.toLowerCase() === 'name');
        if (hasNameCol) {
          projections.push(`${tDef.name}.${hasNameCol.name}`);
        } else {
          // Default to first primary key or all columns
          const pkCol = tDef.columns.find(c => c.isPrimary) || tDef.columns[0];
          if (pkCol) projections.push(`${tDef.name}.${pkCol.name}`);
        }
      }
    } else {
      // Single table query
      const singleTable = detectedTables[0];
      for (const cDef of singleTable.columns) {
        if (conditionColumns.has(cDef.name.toLowerCase())) continue;
        if (words.some(w => matchColumnName(w, cDef))) {
          projections.push(cDef.name);
        }
      }
    }
  }

  // Default projection to '*' if no specific columns or aggregates were requested
  if (projections.length === 0) {
    projections.push('*');
  }

  // 5. Construct Canonical Query Object
  const canonicalQuery = {
    intent: 'SELECT',
    sources: detectedTables.map(t => t.name),
    tables: detectedTables.map(t => t.name),
    projections,
    conditions,
    logicalOperators,
    joins,
  };

  // 6. Format tokens for visualization in TokenPanel
  const tokens = [];
  tokens.push({ type: 'KEYWORD', value: 'SHOW', lexeme: 'SHOW', position: 0, length: 4, index: 0 });

  detectedTables.forEach((t, i) => {
    tokens.push({
      type: 'TABLE',
      value: t.name.toUpperCase(),
      lexeme: t.name,
      position: tokens.length,
      length: t.name.length,
      index: tokens.length,
    });
  });

  projections.forEach(p => {
    tokens.push({
      type: p.includes('(') ? 'AGGREGATE' : 'IDENTIFIER',
      value: p,
      lexeme: p,
      position: tokens.length,
      length: p.length,
      index: tokens.length,
    });
  });

  conditions.forEach(c => {
    tokens.push({
      type: 'IDENTIFIER',
      value: c.column.toUpperCase(),
      lexeme: c.column,
      position: tokens.length,
      length: c.column.length,
      index: tokens.length,
    });
    tokens.push({
      type: 'OPERATOR',
      value: c.operator,
      lexeme: c.operator,
      position: tokens.length,
      length: c.operator.length,
      index: tokens.length,
    });
    tokens.push({
      type: typeof c.value === 'number' ? 'NUMBER' : 'STRING',
      value: String(c.value),
      lexeme: String(c.value),
      position: tokens.length,
      length: String(c.value).length,
      index: tokens.length,
    });
  });

  return {
    tokens,
    canonicalQuery: errors.length > 0 ? null : canonicalQuery,
    errors,
  };
}
