/**
 * QueryMind Compiler — AST Builder
 * Phase 7: Abstract Syntax Tree Construction
 *
 * Converts a Concrete Syntax Tree (CST) or CanonicalQuery into a semantic AST.
 */

import {
  AST_PROGRAM,
  AST_SELECT,
  AST_TABLE,
  AST_WHERE,
  AST_BINARY_EXPRESSION,
  AST_LOGICAL_EXPRESSION,
  AST_COLUMN,
  AST_LITERAL,
  AST_AGGREGATE_EXPRESSION,
  AST_PROJECTION_LIST,
  AST_ALL_COLUMNS,
  AST_JOIN,
} from './astNodeTypes.js';

import {
  NODE_QUERY,
  NODE_SOURCE,
  NODE_CONDITION_CLAUSE,
  NODE_COMPOUND_CONDITION,
  NODE_SIMPLE_CONDITION,
  NODE_COLUMN,
  NODE_OPERATOR,
  NODE_VALUE,
  NODE_LOGICAL_OP,
  NODE_PROJECTION,
  NODE_AGGREGATE,
} from '../parser/grammar.js';

export function buildAST(parseTree) {
  const errors = [];
  let nodeCount = 0;

  function count(node) {
    if (node) nodeCount++;
    return node;
  }

  if (!parseTree) {
    errors.push('Expected valid parse tree root node.');
    return { success: false, ast: null, errors, nodeCount: 0 };
  }

  // Case 1: CanonicalQuery object
  if (parseTree.type === 'CanonicalQuery') {
    const mainTable = (parseTree.sources && parseTree.sources[0]) || 'students';
    if (!mainTable || mainTable === 'unknown') {
      errors.push('No table source could be identified.');
      return { success: false, ast: null, errors, nodeCount: 0 };
    }

    // Projections
    let projectionAst;
    if (!parseTree.projections || parseTree.projections.length === 0 || parseTree.projections[0] === '*' || parseTree.projections[0].endsWith('.*')) {
      projectionAst = count({ type: AST_ALL_COLUMNS });
    } else {
      const projNodes = parseTree.projections.map(p => {
        const aggMatch = p.match(/^([A-Z]+)\((.*?)\)$/);
        if (aggMatch) {
          return count({
            type: AST_AGGREGATE_EXPRESSION,
            function: aggMatch[1],
            argument: aggMatch[2] === '*' ? count({ type: AST_ALL_COLUMNS }) : count({ type: AST_COLUMN, name: aggMatch[2] }),
          });
        }
        return count({ type: AST_COLUMN, name: p });
      });

      if (projNodes.length === 1) {
        projectionAst = projNodes[0];
      } else {
        projectionAst = count({ type: AST_PROJECTION_LIST, columns: projNodes });
      }
    }

    const tableAst = count({ type: AST_TABLE, name: mainTable });
    const joins = (parseTree.joins || []).map(j =>
      count({
        type: AST_JOIN,
        leftColumn: count({ type: AST_COLUMN, name: j.left }),
        rightColumn: count({ type: AST_COLUMN, name: j.right }),
        joinType: j.type || 'INNER',
      })
    );

    const selectAst = count({
      type: AST_SELECT,
      table: tableAst,
      joins,
      projection: projectionAst,
    });

    if (parseTree.conditions && parseTree.conditions.length > 0) {
      const conditionNodes = parseTree.conditions.map(c => {
        const isNum = typeof c.value === 'number' || (!isNaN(c.value) && !String(c.value).startsWith("'") && !String(c.value).startsWith('"'));
        const valNode = isNum
          ? count({ type: AST_LITERAL, value: Number(c.value), dataType: 'number' })
          : count({ type: AST_LITERAL, value: String(c.value).replace(/['"]/g, ''), dataType: 'string' });

        return count({
          type: AST_BINARY_EXPRESSION,
          operator: c.operator,
          left: count({ type: AST_COLUMN, name: c.column }),
          right: valNode,
        });
      });

      let rootCondition = conditionNodes[0];
      for (let i = 1; i < conditionNodes.length; i++) {
        const op = (parseTree.logicalOperators && parseTree.logicalOperators[i - 1]) || 'AND';
        rootCondition = count({
          type: AST_LOGICAL_EXPRESSION,
          operator: op,
          left: rootCondition,
          right: conditionNodes[i],
        });
      }

      selectAst.where = count({
        type: AST_WHERE,
        expression: rootCondition,
      });
    }

    const programAst = count({
      type: AST_PROGRAM,
      body: selectAst,
    });

    return {
      success: errors.length === 0,
      ast: programAst,
      errors,
      nodeCount,
    };
  }

  // Case 2: Standard CST (NODE_QUERY)
  if (parseTree.type === NODE_QUERY) {
    const children = parseTree.children || [];
    const sourceNode = children.find(c => c.type === NODE_SOURCE);
    const tableName = sourceNode ? sourceNode.value : 'students';
    const tableAst = count({ type: AST_TABLE, name: tableName });

    // Look for explicit projection node or default to AllColumns
    const projNode = children.find(c => c.type === NODE_PROJECTION);
    let projectionAst = count({ type: AST_ALL_COLUMNS });

    if (projNode && Array.isArray(projNode.children) && projNode.children.length > 0) {
      const cols = projNode.children.map(c => {
        if (c.type === NODE_AGGREGATE) {
          return count({
            type: AST_AGGREGATE_EXPRESSION,
            function: c.value,
            argument: count({ type: AST_COLUMN, name: c.column || '*' }),
          });
        }
        const cName = c.value || c.name;
        return count({ type: AST_COLUMN, name: cName.includes('.') ? cName : `${tableName}.${cName}` });
      });
      projectionAst = cols.length === 1 ? cols[0] : count({ type: AST_PROJECTION_LIST, columns: cols });
    }

    const selectAst = count({
      type: AST_SELECT,
      table: tableAst,
      joins: [],
      projection: projectionAst,
    });

    const condClause = children.find(c => c.type === NODE_CONDITION_CLAUSE);
    if (condClause && condClause.children && condClause.children.length > 0) {
      function convertCstCondition(node) {
        if (!node) return null;

        if (node.type === NODE_SIMPLE_CONDITION) {
          const cCol = node.children.find(c => c.type === NODE_COLUMN);
          const cOp = node.children.find(c => c.type === NODE_OPERATOR);
          const cVal = node.children.find(c => c.type === NODE_VALUE);

          const colRaw = cCol ? cCol.value : '';
          const colName = colRaw.includes('.') ? colRaw : `${tableName}.${colRaw}`;
          const operator = cOp ? cOp.value : '=';

          const valRaw = cVal ? cVal.value : '';
          let val = valRaw;
          let dataType = 'string';

          if (/^-?\d+(?:\.\d+)?$/.test(valRaw)) {
            val = Number(valRaw);
            dataType = 'number';
          } else if (
            (valRaw.startsWith("'") && valRaw.endsWith("'")) ||
            (valRaw.startsWith('"') && valRaw.endsWith('"'))
          ) {
            val = valRaw.slice(1, -1);
            dataType = 'string';
          }

          return count({
            type: AST_BINARY_EXPRESSION,
            operator,
            left: count({ type: AST_COLUMN, name: colName }),
            right: count({ type: AST_LITERAL, value: val, dataType }),
          });
        }

        if (node.type === NODE_COMPOUND_CONDITION) {
          const leftNode = node.children[0];
          const logNode = node.children[1];
          const rightNode = node.children[2];

          const leftAst = convertCstCondition(leftNode);
          const rightAst = convertCstCondition(rightNode);
          const operator = logNode ? logNode.value.toUpperCase() : 'AND';

          return count({
            type: AST_LOGICAL_EXPRESSION,
            operator,
            left: leftAst,
            right: rightAst,
          });
        }

        return null;
      }

      const rootCondition = convertCstCondition(condClause.children[0]);
      if (rootCondition) {
        selectAst.where = count({
          type: AST_WHERE,
          expression: rootCondition,
        });
      }
    }

    const programAst = count({
      type: AST_PROGRAM,
      body: selectAst,
    });

    return {
      success: errors.length === 0,
      ast: programAst,
      errors,
      nodeCount,
    };
  }

  errors.push(`Unrecognized parse tree node type: ${parseTree.type}`);
  return { success: false, ast: null, errors, nodeCount: 0 };
}
