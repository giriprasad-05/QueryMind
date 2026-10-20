/**
 * QueryMind Compiler — Semantic Errors
 * Phase 8: Semantic Analysis & Schema Validation
 */

export const ERR_TABLE_NOT_FOUND  = 'TABLE_NOT_FOUND';
export const ERR_COLUMN_NOT_FOUND = 'COLUMN_NOT_FOUND';
export const ERR_TYPE_MISMATCH    = 'TYPE_MISMATCH';
export const ERR_INVALID_OPERATOR = 'INVALID_OPERATOR';

export function createSemanticError(type, message, details = {}) {
  return {
    type,
    severity: 'error',
    message,
    ...details
  };
}
