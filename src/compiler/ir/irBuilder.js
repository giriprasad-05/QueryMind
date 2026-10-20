/**
 * QueryMind Compiler — IR Builder
 * Phase 9: Intermediate Representation
 *
 * Converts the semantically validated AST into a clean, 
 * logical database operation representation (IR).
 */

import {
  AST_PROGRAM,
  AST_SELECT,
  AST_BINARY_EXPRESSION,
  AST_LOGICAL_EXPRESSION,
  AST_COLUMN,
  AST_LITERAL
} from '../ast/astNodeTypes.js';

function buildFilter(expression) {
  if (!expression) return null;

  if (expression.type === AST_BINARY_EXPRESSION) {
    let colName = null;
    let valNode = null;

    if (expression.left.type === AST_COLUMN) {
      colName = expression.left.name;
      valNode = expression.right;
    } else if (expression.right.type === AST_COLUMN) {
      colName = expression.right.name;
      valNode = expression.left;
    }

    if (!colName || valNode.type !== AST_LITERAL) {
      throw new Error("IR Construction: Binary expression must contain a column and a literal.");
    }

    return {
      type: "comparison",
      column: colName,
      operator: expression.operator,
      value: valNode.value,
      valueType: valNode.dataType
    };
  }

  if (expression.type === AST_LOGICAL_EXPRESSION) {
    return {
      type: "logical",
      operator: expression.operator,
      left: buildFilter(expression.left),
      right: buildFilter(expression.right)
    };
  }

  throw new Error(`IR Construction: Unsupported expression type '${expression.type}'`);
}

/**
 * Builds the Intermediate Representation (IR) from a semantic AST.
 * 
 * @param {Object} semanticAst 
 * @returns {Object} { success, ir, errors, stats }
 */
export function buildIR(semanticAst) {
  const errors = [];
  const stats = {
    nodes: 0,
    filters: 0,
    columns: 0
  };

  if (!semanticAst || semanticAst.type !== AST_PROGRAM || !semanticAst.body) {
    errors.push("Invalid semantic AST provided to IR builder.");
    return { success: false, ir: null, errors, stats };
  }

  const selectNode = semanticAst.body;
  if (selectNode.type !== AST_SELECT) {
    errors.push("IR Builder only supports SELECT operations.");
    return { success: false, ir: null, errors, stats };
  }

  try {
    let projectionIr = [];
    if (selectNode.projection) {
      if (selectNode.projection.type === 'AllColumns') {
         projectionIr = [{ type: 'column', column: '*' }];
      } else if (selectNode.projection.type === 'ProjectionList') {
         projectionIr = selectNode.projection.columns.map(p => {
           if (p.type === 'AggregateExpression') return { type: 'aggregate', function: p.function, column: p.argument.type === 'Column' ? p.argument.name : '*' };
           return { type: 'column', column: p.name };
         });
      } else if (selectNode.projection.type === 'AggregateExpression') {
        projectionIr = [{
          type: 'aggregate',
          function: selectNode.projection.function,
          column: selectNode.projection.argument.type === 'Column' ? selectNode.projection.argument.name : '*'
        }];
      } else if (selectNode.projection.type === 'Column') {
        projectionIr = [{
          type: 'column',
          column: selectNode.projection.name
        }];
      }
    }

    const columns = projectionIr.map(p => p.type === 'aggregate' ? `${p.function}(${p.column})` : p.column);

    const ir = {
      operation: "SELECT",
      table: selectNode.table.name,
      joins: (selectNode.joins || []).map(j => ({
         type: j.joinType,
         left: j.leftColumn.name,
         right: j.rightColumn.name
      })),
      projection: projectionIr,
      columns,
      filter: null,
      filters: []
    };

    stats.nodes++; // operation node
    stats.columns = columns.length;

    if (selectNode.where && selectNode.where.expression) {
      const filter = buildFilter(selectNode.where.expression);
      if (filter) {
        ir.filter = filter;
        ir.filters = [filter];
        
        // Count stats simply
        const countFilterStats = (f) => {
          stats.nodes++;
          if (f.type === 'comparison') {
            stats.filters++;
          } else if (f.type === 'logical') {
            stats.filters++;
            countFilterStats(f.left);
            countFilterStats(f.right);
          }
        };
        countFilterStats(filter);
      }
    }

    return {
      success: true,
      ir,
      errors: [],
      stats
    };

  } catch (err) {
    errors.push(err.message);
    return { success: false, ir: null, errors, stats };
  }
}
