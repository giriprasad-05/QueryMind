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
  const conditions = [];
  const logicalOperators = [];
  const conditionColumns = new Set();

  // Pattern A: "older than X" / "age above X"
  const ageAboveMatch = query.match(/\b(?:older\s+than|age\s+above|age\s+over|age\s*>\s*|age\s+is\s+greater\s+than|age\s+greater\s+than)\s+(\d+)\b/i);
  if (ageAboveMatch) {
    conditions.push({ column: 'age', operator: '>', value: Number(ageAboveMatch[1]) });
    conditionColumns.add('age');
  }

  // Pattern B: "younger than X" / "age below X"
  const ageBelowMatch = query.match(/\b(?:younger\s+than|age\s+below|age\s+under|age\s*<\s*|age\s+is\s+less\s+than|age\s+less\s+than)\s+(\d+)\b/i);
  if (ageBelowMatch) {
    conditions.push({ column: 'age', operator: '<', value: Number(ageBelowMatch[1]) });
    conditionColumns.add('age');
  }

  // Pattern C: "scored above X" / "scoring above X" / "marks above X" / "marks > X"
  const marksAboveMatch = query.match(/\b(?:scored\s+above|scoring\s+above|marks\s+above|marks\s+over|marks\s*>\s*|marks\s+are\s+greater\s+than|marks\s+greater\s+than|marks\s+more\s+than|scored\s+more\s+than)\s+(\d+(?:\.\d+)?)\b/i);
  if (marksAboveMatch) {
    conditions.push({ column: 'marks', operator: '>', value: Number(marksAboveMatch[1]) });
    conditionColumns.add('marks');
  }

  // Pattern D: "scored below X" / "scoring below X" / "marks below X" / "marks < X"
  const marksBelowMatch = query.match(/\b(?:scored\s+below|scoring\s+below|marks\s+below|marks\s+under|marks\s*<\s*|marks\s+are\s+less\s+than|marks\s+less\s+than)\s+(\d+(?:\.\d+)?)\b/i);
  if (marksBelowMatch) {
    conditions.push({ column: 'marks', operator: '<', value: Number(marksBelowMatch[1]) });
    conditionColumns.add('marks');
  }

  // Pattern E: "belong to X" / "from X" / "in CSE" / "department = 'X'"
  const deptMatch = query.match(/\b(?:belong\s+to|belonging\s+to|from|in|department\s+is|department\s*=\s*)\s+(?:the\s+)?['"]?([A-Za-z0-9_-]+)['"]?(?:\s+department)?\b/i);
  if (deptMatch) {
    const deptVal = deptMatch[1].trim();
    // Verify it's not a stopword like 'the', 'faculty', 'students'
    const ignoreWords = new Set(['the', 'all', 'a', 'an', 'faculty', 'students', 'courses', 'greater', 'less', 'than', 'more', 'their', 'respective']);
    if (!ignoreWords.has(deptVal.toLowerCase())) {
      conditions.push({ column: 'department', operator: '=', value: `'${deptVal}'` });
      conditionColumns.add('department');
    }
  }

  // Pattern F: Generic "<col> [is/are] [operator] <val>" for any table column
  for (const tDef of detectedTables) {
    for (const cDef of tDef.columns) {
      if (conditionColumns.has(cDef.name.toLowerCase())) continue;
      const cName = cDef.name.toLowerCase();

      // Check for <col> > <num>, <col> < <num>, <col> = <val>
      const genericRegex = new RegExp(`\\b${cName}\\b(?:\\s+(?:is|are))?\\s+(>=|<=|!=|>|<|=|greater\\s+than|less\\s+than|equal\\s+to|equals|at\\s+least|at\\s+most)\\s+['"]?([^'"\\s]+)['"]?`, 'i');
      const gMatch = query.match(genericRegex);
      if (gMatch) {
        let op = gMatch[1].toLowerCase();
        if (op === 'greater than') op = '>';
        else if (op === 'less than') op = '<';
        else if (op === 'equal to' || op === 'equals') op = '=';
        else if (op === 'at least') op = '>=';
        else if (op === 'at most') op = '<=';

        let val = gMatch[2];
        if (!isNaN(val)) val = Number(val);
        else val = `'${val.replace(/['"]/g, '')}'`;

        conditions.push({ column: cDef.name, operator: op, value: val });
        conditionColumns.add(cDef.name.toLowerCase());
      }
    }
  }

  // Determine logical operators (AND/OR)
  if (conditions.length > 1) {
    const hasOr = /\bor\b/i.test(query);
    for (let i = 0; i < conditions.length - 1; i++) {
      logicalOperators.push(hasOr ? 'OR' : 'AND');
    }
  }

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
    canonicalQuery,
    errors,
  };
}
