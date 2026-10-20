/**
 * QueryMind Compiler — SQL Generator
 * Phase 9: SQL Code Generation
 *
 * Emits SQL dialect code from the Intermediate Representation (IR).
 */

function escapeString(val) {
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function buildFilterSQL(filter, indent = "", aliasMap = null) {
  if (filter.type === 'comparison') {
    const safeVal = filter.valueType === 'string' 
      ? (String(filter.value).startsWith("'") ? filter.value : escapeString(filter.value))
      : filter.value;

    let column = filter.column;
    if (aliasMap && typeof column === 'string' && column.includes('.')) {
      const dotIndex = column.indexOf('.');
      const tableName = column.slice(0, dotIndex);
      const colName = column.slice(dotIndex + 1);
      const alias = aliasMap[tableName];
      if (alias) {
        column = `${alias}.${colName}`;
      }
    }

    return `${column} ${filter.operator} ${safeVal}`;
  }

  if (filter.type === 'logical') {
    const leftSql = buildFilterSQL(filter.left, indent, aliasMap);
    const rightSql = buildFilterSQL(filter.right, indent, aliasMap);
    // Parenthesize a nested logical operand whose operator differs, so the
    // emitted SQL preserves the intended grouping (e.g. "(A AND B) OR C").
    const wrap = (sql, child) =>
      child.type === 'logical' && child.operator !== filter.operator ? `(${sql})` : sql;
    return `${wrap(leftSql, filter.left)}\n${indent}${filter.operator} ${wrap(rightSql, filter.right)}`;
  }

  throw new Error(`SQL Generator: Unknown filter type '${filter.type}'`);
}

/**
 * Generates SQL from IR.
 * 
 * @param {Object} ir 
 * @returns {Object} { sql, errors }
 */
export function generateSQL(ir) {
  const errors = [];

  if (!ir) {
    errors.push("No IR provided to SQL generator.");
    return { sql: null, errors };
  }

  if (ir.operation !== 'SELECT') {
    errors.push(`SQL Generator only supports SELECT operations. Attempted: ${ir.operation}`);
    return { sql: null, errors };
  }

  try {
    const table = ir.table;
    const hasJoins = ir.joins && ir.joins.length > 0;
    const tableAlias = hasJoins ? table[0] : '';

    let sql = '';

    if (hasJoins) {
      // Formatted with aliases and line breaks as in the prompt integration example
      const columnsList = (ir.projection || []).map(proj => {
        const colName = proj.column.includes('.') ? proj.column.split('.')[1] : proj.column;
        const tName = proj.column.includes('.') ? proj.column.split('.')[0] : table;
        const tAlias = tName[0];
        const entityName = tName === 'students' ? 'student' : tName;
        return `    ${tAlias}.${colName} AS ${entityName}_${colName}`;
      }).join(',\n');

      sql = `SELECT\n${columnsList}\nFROM ${table} ${tableAlias}`;

      ir.joins.forEach(j => {
        const leftParts = j.left.split('.');
        const rightParts = j.right.split('.');
        const leftAlias = leftParts[0][0];
        const rightTable = rightParts[0];
        const rightAlias = rightTable[0];
        sql += `\nJOIN ${rightTable} ${rightAlias}\n    ON ${leftAlias}.${leftParts[1]} = ${rightAlias}.${rightParts[1]}`;
      });
    } else {
      // Single table query
      let columnsStr = '*';

      if (ir.projection && ir.projection.length > 0) {
        if (ir.projection.length === 1 && (ir.projection[0] === '*' || (ir.projection[0].type === 'column' && ir.projection[0].column === '*'))) {
          columnsStr = '*';
        } else {
          columnsStr = ir.projection.map(proj => {
            if (proj.type === 'aggregate') {
              const func = proj.function;
              const rawCol = proj.column;
              const col = rawCol.includes('.') ? rawCol.split('.')[1] : rawCol;
              let alias = 'aggregate_value';
              
              if (func === 'AVG') alias = `average_${col}`;
              else if (func === 'MAX') alias = `maximum_${col}`;
              else if (func === 'MIN') alias = `minimum_${col}`;
              else if (func === 'SUM') alias = `total_${col}`;
              else if (func === 'COUNT') alias = col === '*' ? `total_${table}` : `count_${col}`;
              
              return `${func}(${col}) AS ${alias}`;
            } else if (proj.type === 'column') {
              return proj.column;
            }
            return String(proj);
          }).join(', ');
        }
      }

      // Check if columns is multi-column or aggregate or single '*'
      if (columnsStr === '*') {
        sql = `SELECT\n    *\nFROM ${table}`;
      } else if (columnsStr.includes('AS') || columnsStr.includes(',')) {
        sql = `SELECT ${columnsStr}\nFROM ${table}`;
      } else {
        sql = `SELECT ${columnsStr}\nFROM ${table}`;
      }
    }

    // Build a table → alias map so filter columns match the FROM/JOIN aliases
    const aliasMap = {};
    if (hasJoins) {
      aliasMap[table] = tableAlias;
      ir.joins.forEach(j => {
        const rightTable = j.right.split('.')[0];
        aliasMap[rightTable] = rightTable[0];
      });
    }

    if (ir.filter) {
      const whereClause = buildFilterSQL(ir.filter, "  ", aliasMap);
      sql += `\nWHERE ${whereClause}`;
    }

    sql += `;`;

    return {
      sql,
      errors: []
    };

  } catch (err) {
    errors.push(err.message);
    return { sql: null, errors };
  }
}
