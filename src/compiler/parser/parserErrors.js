/**
 * QueryMind Compiler — Parser Error Helpers
 * Phase 5: Syntax Analysis (Parser)
 *
 * Provides a small, consistent API for creating structured parser errors.
 * All errors carry:
 *   - message   : human-readable description (compiler-style phrasing)
 *   - found     : the token value or "END_OF_INPUT" that was encountered
 *   - expected  : array of expected token types / lexemes
 *   - position  : character offset in the original input (or -1 if unknown)
 *
 * Design rules
 * ─────────────
 * 1. No parser logic here — only error construction helpers.
 * 2. Error objects are plain JS objects — no class hierarchy needed.
 * 3. Every helper accepts an optional `token` for position tracking.
 */

/**
 * Build a structured parser error object.
 *
 * @param {string}          message   - Human-readable description.
 * @param {string[]}        expected  - What the parser was looking for.
 * @param {Object|null}     token     - The offending token (or null at EOF).
 * @returns {{ message: string, found: string, expected: string[], position: number }}
 */
export function makeParseError(message, expected, token) {
  return {
    message,
    found:    token ? `"${token.lexeme}" (${token.type})` : 'END_OF_INPUT',
    expected: Array.isArray(expected) ? expected : [expected],
    position: token ? token.position : -1,
  };
}

// ─── Named constructors (self-documenting call sites) ────────────────────────

/**
 * Error for when the query does not start with a recognised action keyword.
 */
export function errExpectedAction(token) {
  return makeParseError(
    `Expected a query action keyword (e.g. SHOW) to start the query`,
    ['SHOW', 'SELECT', 'LIST', 'FIND', 'GET', 'DISPLAY'],
    token,
  );
}

/**
 * Error for when no source table / identifier follows the action keyword.
 */
export function errExpectedSource(token) {
  return makeParseError(
    `Expected a table name or identifier after the action keyword`,
    ['TABLE', 'IDENTIFIER'],
    token,
  );
}

/**
 * Error for when a comparison operator was expected in a condition but not found.
 */
export function errExpectedOperator(token) {
  return makeParseError(
    `Expected a comparison operator (e.g. "greater than", ">", "=") after the column name`,
    ['OPERATOR'],
    token,
  );
}

/**
 * Error for when a value (number or string) was expected after an operator.
 */
export function errExpectedValue(token) {
  return makeParseError(
    `Expected a value (number or string) after the comparison operator`,
    ['NUMBER', 'STRING'],
    token,
  );
}

/**
 * Error for when a column identifier was expected in a condition.
 */
export function errExpectedColumn(token) {
  return makeParseError(
    `Expected a column name (identifier) after the condition introducer`,
    ['IDENTIFIER'],
    token,
  );
}

/**
 * Error for when a condition is expected after a logical operator (AND / OR)
 * but the token stream ended or an unexpected token was found.
 */
export function errExpectedConditionAfterLogical(logicalLexeme, token) {
  return makeParseError(
    `Expected a condition after "${logicalLexeme}"`,
    ['IDENTIFIER'],
    token,
  );
}

/**
 * Generic "unexpected token" error used as a catch-all.
 */
export function errUnexpectedToken(token, context = '') {
  return makeParseError(
    context
      ? `Unexpected token in ${context}`
      : `Unexpected token`,
    ['valid grammar construct'],
    token,
  );
}
