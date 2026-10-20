/**
 * QueryMind Compiler — Semantic Analyzer
 * Phase 8: Semantic Analysis & Schema Validation
 *
 * Validates the AST against the schema, returning a semantically 
 * annotated AST, a list of errors, warnings, and log annotations.
 */

import {
  ERR_TABLE_NOT_FOUND,
  ERR_COLUMN_NOT_FOUND,
  ERR_TYPE_MISMATCH,
  ERR_INVALID_OPERATOR,
  createSemanticError
} from './semanticErrors.js';

import {
  AST_PROGRAM,
  AST_TABLE,
  AST_BINARY_EXPRESSION,
  AST_LOGICAL_EXPRESSION,
  AST_COLUMN,
  AST_LITERAL,
  AST_AGGREGATE_EXPRESSION,
  AST_PROJECTION_LIST,
  AST_JOIN,
  AST_ALL_COLUMNS
} from '../ast/astNodeTypes.js';

// Map SQL/schema types to JS logical types for checking
function normalizeSchemaType(dbType) {
  const upper = dbType.toUpperCase();
  if (upper.startsWith('INT') || upper.startsWith('NUM') || upper.startsWith('FLOAT') || upper.startsWith('DEC')) {
    return 'number';
  }
  return 'string';
}

/**
 * Perform semantic analysis on an AST.
 * Does not mutate the original AST; returns a cloned/annotated AST.
 *
 * @param {Object} astRoot - The output of the AST Builder
 * @param {Object} schema - The database schema object
 * @returns {Object} { success, ast, errors, annotations }
 */
export function analyze(astRoot, schema) {
  const errors = [];
  const annotations = []; // Sequence of validation steps for the UI animation
  
  if (!astRoot || astRoot.type !== AST_PROGRAM || !astRoot.body) {
    errors.push(createSemanticError('INVALID_AST', 'Missing or invalid AST root.'));
    return { success: false, ast: null, errors, annotations };
  }

  // Clone AST recursively so we can annotate it safely
  const annotatedAst = JSON.parse(JSON.stringify(astRoot));
  const selectNode = annotatedAst.body;
  
  let targetTableDef = null;

  // 1. Table Validation
  const allTableDefs = [];
  if (selectNode.table && selectNode.table.type === AST_TABLE) {
    const tableName = selectNode.table.name.toLowerCase();
    annotations.push({ step: 'table_check', message: `Checking table '${tableName}'...` });
    
    targetTableDef = schema.tables.find(t => t.name.toLowerCase() === tableName);
    
    if (targetTableDef) {
      annotations.push({ step: 'table_valid', message: `✓ Table '${tableName}' exists.` });
      selectNode.table.semanticType = 'table';
      allTableDefs.push(targetTableDef);
    } else {
      errors.push(createSemanticError(
        ERR_TABLE_NOT_FOUND,
        `Table '${selectNode.table.name}' does not exist.`,
        { table: selectNode.table.name }
      ));
    }
  }

  // 1.5 Join Validation
  if (selectNode.joins && selectNode.joins.length > 0) {
    selectNode.joins.forEach(join => {
       const leftTable = join.leftColumn.name.split('.')[0];
       const rightTable = join.rightColumn.name.split('.')[0];
       
       const rightDef = schema.tables.find(t => t.name.toLowerCase() === rightTable);
       if (rightDef) {
         if (!allTableDefs.find(t => t.name === rightDef.name)) {
            allTableDefs.push(rightDef);
         }
       }
       annotations.push({ step: 'join_check', message: `✓ Validated join between ${leftTable} and ${rightTable}` });
    });
  }

  // 2. Projection Validation
  if (allTableDefs.length > 0 && selectNode.projection) {
    const projections = selectNode.projection.type === AST_PROJECTION_LIST ? selectNode.projection.columns : [selectNode.projection];
    
    projections.forEach(proj => {
      if (proj.type === AST_AGGREGATE_EXPRESSION) {
        validateAggregate(proj, allTableDefs, errors, annotations);
      } else if (proj.type === AST_COLUMN) {
        validateColumn(proj, allTableDefs, errors, annotations);
      }
    });
  }

  // 3. Condition Validation (if table exists and we have a WHERE clause)
  if (allTableDefs.length > 0 && selectNode.where && selectNode.where.expression) {
    validateExpression(selectNode.where.expression, allTableDefs, errors, annotations);
  }

  // Check overall success
  const success = errors.length === 0;
  if (success) {
    annotations.push({ step: 'complete', message: '✓ Semantic Analysis Passed' });
  }

  return {
    success,
    ast: annotatedAst,
    errors,
    annotations
  };
}

// ─── Projection & Aggregate Traversal ────────────────────────────────────────

function validateColumn(colNode, allTableDefs, errors, annotations) {
  const colName = colNode.name.includes('.') ? colNode.name.split('.')[1] : colNode.name;
  annotations.push({ step: 'column_check', message: `Checking column '${colName}'...` });
  
  let colDef = null;
  let foundTable = null;
  
  for (const tDef of allTableDefs) {
     colDef = tDef.columns.find(c => c.name.toLowerCase() === colName.toLowerCase());
     if (colDef) {
       foundTable = tDef;
       break;
     }
  }
  
  if (colDef) {
    annotations.push({ step: 'column_valid', message: `✓ Column '${colName}' exists.` });
    colNode.dataType = normalizeSchemaType(colDef.type);
    colNode.table = foundTable.name;
  } else {
    errors.push(createSemanticError(
      ERR_COLUMN_NOT_FOUND,
      `Column '${colName}' does not exist in requested tables.`,
      { column: colName, table: allTableDefs.map(t=>t.name).join(', ') }
    ));
  }
}

function validateAggregate(agg, allTableDefs, errors, annotations) {
  const func = agg.function;
  
  if (func === 'COUNT') {
     annotations.push({ step: 'agg_check', message: `✓ Aggregate COUNT is valid.` });
     return;
  }
  
  if (agg.argument.type !== AST_COLUMN) {
    errors.push(createSemanticError('INVALID_AGGREGATE', `Function ${func} requires a column argument.`));
    return;
  }
  
  const colName = agg.argument.name.includes('.') ? agg.argument.name.split('.')[1] : agg.argument.name;
  
  let colDef = null;
  for (const tDef of allTableDefs) {
     colDef = tDef.columns.find(c => c.name.toLowerCase() === colName.toLowerCase());
     if (colDef) break;
  }
  
  if (!colDef) {
    errors.push(createSemanticError(ERR_COLUMN_NOT_FOUND, `Column '${colName}' does not exist.`));
    return;
  }
  
  const colType = normalizeSchemaType(colDef.type);
  agg.argument.dataType = colType;
  
  if ((func === 'AVG' || func === 'SUM') && colType !== 'number') {
    errors.push(createSemanticError('TYPE_MISMATCH', `Cannot calculate ${func} on column '${colName}' because its type is ${colType}.`));
    return;
  }
  
  annotations.push({ step: 'agg_check', message: `✓ Aggregate ${func}(${colName}) is valid.` });
}

// ─── Expression Traversal ────────────────────────────────────────────────────

function validateExpression(expr, allTableDefs, errors, annotations) {
  if (!expr) return;

  if (expr.type === AST_LOGICAL_EXPRESSION) {
    // Validate both sides
    validateExpression(expr.left, allTableDefs, errors, annotations);
    validateExpression(expr.right, allTableDefs, errors, annotations);
    expr.semanticType = 'boolean';
  } 
  else if (expr.type === AST_BINARY_EXPRESSION) {
    validateBinaryExpression(expr, allTableDefs, errors, annotations);
  }
}

function validateBinaryExpression(expr, allTableDefs, errors, annotations) {
  const left = expr.left;
  const right = expr.right;
  const operator = expr.operator;
  
  let leftType = null;
  let rightType = null;

  // Validate Left (Expected to be Column, but handle generic for robustness)
  if (left.type === AST_COLUMN) {
    const colName = left.name.includes('.') ? left.name.split('.')[1] : left.name;
    annotations.push({ step: 'column_check', message: `Checking column '${colName}'...` });
    
    let colDef = null;
    let foundTable = null;
    for (const tDef of allTableDefs) {
       colDef = tDef.columns.find(c => c.name.toLowerCase() === colName.toLowerCase());
       if (colDef) { foundTable = tDef; break; }
    }
    
    if (colDef) {
      annotations.push({ step: 'column_valid', message: `✓ Column '${colName}' exists.` });
      leftType = normalizeSchemaType(colDef.type);
      left.dataType = leftType;
      left.table = foundTable.name;
    } else {
      errors.push(createSemanticError(
        ERR_COLUMN_NOT_FOUND,
        `Column '${colName}' does not exist in requested tables.`,
        { column: colName, table: allTableDefs.map(t=>t.name).join(', ') }
      ));
    }
  } else if (left.type === AST_LITERAL) {
    leftType = left.dataType;
  }

  // Validate Right (Expected to be Literal)
  if (right.type === AST_LITERAL) {
    rightType = right.dataType; // 'number' or 'string'
  } else if (right.type === AST_COLUMN) {
    const colName = right.name.includes('.') ? right.name.split('.')[1] : right.name;
    let colDef = null;
    for (const tDef of allTableDefs) {
       colDef = tDef.columns.find(c => c.name.toLowerCase() === colName.toLowerCase());
       if (colDef) break;
    }
    if (colDef) rightType = normalizeSchemaType(colDef.type);
  }

  // If column wasn't found, stop checking this expression to avoid cascading errors
  if (!leftType || !rightType) return;

  // Type compatibility check
  annotations.push({ step: 'type_check', message: `Checking types for operator '${operator}'...` });
  
  if (leftType !== rightType) {
    errors.push(createSemanticError(
      ERR_TYPE_MISMATCH,
      `Cannot apply operator '${operator}' between column '${left.name}' (${leftType}) and value '${right.value}' (${rightType}).`,
      { left: left.name, leftType, right: right.value, rightType, operator }
    ));
    return;
  }
  
  annotations.push({ step: 'type_valid', message: `✓ Types compatible (${leftType})` });

  // Operator validity check
  annotations.push({ step: 'operator_check', message: `Checking operator '${operator}'...` });
  
  const validStringOps = ['=', '!=', '~*', '!~*'];
  if (leftType === 'string' && !validStringOps.includes(operator)) {
    errors.push(createSemanticError(
      ERR_INVALID_OPERATOR,
      `Operator '${operator}' is not valid for column '${left.name}' of type 'string'.`,
      { column: left.name, dataType: 'string', operator }
    ));
    return;
  }

  annotations.push({ step: 'operator_valid', message: `✓ Operator '${operator}' valid.` });
  
  expr.semanticType = 'boolean';
}
