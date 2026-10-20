/**
 * QueryMind Compiler — Centralized Error Normalization
 *
 * Guarantees a stable error contract across all compiler phases:
 * {
 *   type: string,
 *   severity: "error" | "warning",
 *   message: string,
 *   found: string | null,
 *   expected: string[],
 *   position: number | null
 * }
 */

export function normalizeCompilerError(error, defaultType = 'COMPILER_ERROR') {
  if (!error) return null;

  if (typeof error === 'string') {
    return {
      type: defaultType,
      severity: 'error',
      message: error,
      found: null,
      expected: [],
      position: null
    };
  }

  const expectedArray = Array.isArray(error.expected)
    ? error.expected.map(String)
    : (error.expected !== undefined && error.expected !== null
        ? [String(error.expected)]
        : []);

  return {
    ...error,
    type: error.type || defaultType,
    severity: error.severity === 'warning' ? 'warning' : 'error',
    message: error.message || 'Unknown compiler error',
    found: error.found !== undefined && error.found !== null ? String(error.found) : null,
    expected: expectedArray,
    position: typeof error.position === 'number' && !isNaN(error.position) ? error.position : null
  };
}

export function normalizeCompilerErrors(errors, defaultType = 'COMPILER_ERROR') {
  if (!errors || !Array.isArray(errors)) return [];
  return errors.map(err => normalizeCompilerError(err, defaultType)).filter(Boolean);
}
