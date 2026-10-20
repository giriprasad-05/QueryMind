/**
 * QueryMind Compiler — AST Node Types
 * Phase 7: Abstract Syntax Tree Generation
 *
 * Defines the logical node types for the simplified AST.
 */

export const AST_PROGRAM            = 'Program';
export const AST_SELECT             = 'Select';
export const AST_TABLE              = 'Table';
export const AST_JOIN               = 'Join';
export const AST_WHERE              = 'Where';
export const AST_BINARY_EXPRESSION  = 'BinaryExpression';
export const AST_LOGICAL_EXPRESSION = 'LogicalExpression';
export const AST_COLUMN             = 'Column';
export const AST_LITERAL            = 'Literal';
export const AST_AGGREGATE_EXPRESSION = 'AggregateExpression';
export const AST_PROJECTION_LIST    = 'ProjectionList';
export const AST_ALL_COLUMNS        = 'AllColumns';
