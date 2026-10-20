/**
 * QueryMind Compiler — Parser (Syntax Analyzer)
 * Phase 5: Syntax Analysis
 *
 * Implements a recursive-descent parser producing a Concrete Syntax Tree (CST).
 */

import {
  NODE_QUERY,
  NODE_ACTION,
  NODE_SOURCE,
  NODE_CONDITION_CLAUSE,
  NODE_COMPOUND_CONDITION,
  NODE_SIMPLE_CONDITION,
  NODE_COLUMN,
  NODE_OPERATOR,
  NODE_VALUE,
  NODE_LOGICAL_OP,
  CONDITION_INTRODUCERS,
  BRIDGE_CONNECTORS,
  SHOW_KEYWORDS,
} from './grammar.js';

import {
  errExpectedAction,
  errExpectedSource,
  errExpectedOperator,
  errExpectedValue,
  errExpectedColumn,
  errExpectedConditionAfterLogical,
} from './parserErrors.js';

function countNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      count += countNodes(child);
    }
  }
  return count;
}

export function parse(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return {
      success: false,
      tree: null,
      errors: [errExpectedAction(null)],
      nodeCount: 0,
    };
  }

  const errors = [];
  let cursor = 0;

  // 1. Action Keyword (SHOW, SELECT, LIST, FIND, GET, DISPLAY)
  const firstTok = tokens[cursor];
  const firstLexemeUpper = (firstTok.lexeme || firstTok.value || '').toUpperCase();
  const firstValUpper = (firstTok.value || '').toUpperCase();

  if (!SHOW_KEYWORDS.has(firstLexemeUpper) && !SHOW_KEYWORDS.has(firstValUpper)) {
    errors.push(errExpectedAction(firstTok));
    return { success: false, tree: null, errors, nodeCount: 0 };
  }

  const actionNode = {
    type: NODE_ACTION,
    value: firstValUpper,
    children: [],
  };
  cursor++;

  // 2. Skip leading connector words before source (e.g. "Show all students" -> skip "ALL")
  while (cursor < tokens.length && (tokens[cursor].value === 'ALL' || tokens[cursor].value === 'THE')) {
    cursor++;
  }

  // 3. Source Table / Identifier
  if (cursor >= tokens.length) {
    errors.push(errExpectedSource(null));
    return { success: false, tree: null, errors, nodeCount: 0 };
  }

  const sourceTok = tokens[cursor];
  if (sourceTok.type !== 'TABLE' && sourceTok.type !== 'IDENTIFIER') {
    errors.push(errExpectedSource(sourceTok));
    return { success: false, tree: null, errors, nodeCount: 0 };
  }

  const sourceNode = {
    type: NODE_SOURCE,
    value: sourceTok.lexeme.toLowerCase(),
    children: [],
  };
  cursor++;

  // 4. Condition Clause (introduced by WHOSE, WHERE, WITH, HAVING)
  let conditionClauseNode = null;

  if (cursor < tokens.length) {
    const introTok = tokens[cursor];
    const introLexUpper = (introTok.lexeme || '').toUpperCase();
    const introValUpper = (introTok.value || '').toUpperCase();

    const isIntroducer =
      CONDITION_INTRODUCERS.has(introLexUpper) ||
      CONDITION_INTRODUCERS.has(introValUpper) ||
      introValUpper === 'WHERE';

    if (isIntroducer) {
      cursor++; // consume introducer

      function parseSimpleCondition() {
        // Skip bridge connectors (IS, ARE, BE, WAS, WERE)
        while (cursor < tokens.length && BRIDGE_CONNECTORS.has((tokens[cursor].value || '').toUpperCase())) {
          cursor++;
        }

        // Column identifier
        if (cursor >= tokens.length) {
          errors.push(errExpectedColumn(null));
          return null;
        }

        const colTok = tokens[cursor];
        if (colTok.type === 'OPERATOR') {
          errors.push(errExpectedColumn(colTok));
          return null;
        }

        const columnNode = {
          type: NODE_COLUMN,
          value: colTok.lexeme.toLowerCase(),
          children: [],
        };
        cursor++;

        // Skip bridge connectors between column and operator
        while (cursor < tokens.length && BRIDGE_CONNECTORS.has((tokens[cursor].value || '').toUpperCase())) {
          cursor++;
        }

        // Comparison Operator
        if (cursor >= tokens.length) {
          errors.push(errExpectedOperator(null));
          return null;
        }

        const opTok = tokens[cursor];
        if (opTok.type !== 'OPERATOR') {
          errors.push(errExpectedOperator(opTok));
          return null;
        }

        const opNode = {
          type: NODE_OPERATOR,
          value: opTok.value,
          children: [],
        };
        cursor++;

        // Literal Value
        if (cursor >= tokens.length) {
          errors.push(errExpectedValue(null));
          return null;
        }

        const valTok = tokens[cursor];
        if (valTok.type !== 'NUMBER' && valTok.type !== 'STRING') {
          errors.push(errExpectedValue(valTok));
          return null;
        }

        const valueNode = {
          type: NODE_VALUE,
          value: valTok.value,
          children: [],
        };
        cursor++;

        return {
          type: NODE_SIMPLE_CONDITION,
          value: null,
          children: [columnNode, opNode, valueNode],
        };
      }

      let currentCondition = parseSimpleCondition();
      if (!currentCondition) {
        return { success: false, tree: null, errors, nodeCount: 0 };
      }

      while (
        cursor < tokens.length &&
        ((tokens[cursor].value || '').toUpperCase() === 'AND' ||
          (tokens[cursor].value || '').toUpperCase() === 'OR')
      ) {
        const logTok = tokens[cursor++];
        const logOpUpper = (logTok.value || '').toUpperCase();
        const logOpNode = {
          type: NODE_LOGICAL_OP,
          value: logOpUpper,
          children: [],
        };

        if (cursor >= tokens.length) {
          errors.push(errExpectedConditionAfterLogical(logOpUpper, null));
          return { success: false, tree: null, errors, nodeCount: 0 };
        }

        const nextCondition = parseSimpleCondition();
        if (!nextCondition) {
          return { success: false, tree: null, errors, nodeCount: 0 };
        }

        currentCondition = {
          type: NODE_COMPOUND_CONDITION,
          value: null,
          children: [currentCondition, logOpNode, nextCondition],
        };
      }

      conditionClauseNode = {
        type: NODE_CONDITION_CLAUSE,
        value: null,
        children: [currentCondition],
      };
    }
  }

  const queryChildren = [actionNode, sourceNode];
  if (conditionClauseNode) {
    queryChildren.push(conditionClauseNode);
  }

  const tree = {
    type: NODE_QUERY,
    value: null,
    children: queryChildren,
  };

  const nodeCount = countNodes(tree);

  return {
    success: errors.length === 0,
    tree: errors.length === 0 ? tree : null,
    errors,
    nodeCount,
  };
}
