/**
 * QueryMind Compiler — Deterministic Natural Language Normalization
 * Phase 2.5
 *
 * Translates idiomatic English phrases into a canonical syntax that the
 * existing Lexer and Parser can understand, completely deterministically.
 */

export function normalizeNaturalLanguage(input) {
  if (!input || typeof input !== 'string') return input;

  let s = input;

  // 1. Query Intent
  s = s.replace(/\b(?:show\s+me|give\s+me|find|list|display|show)\b/gi, 'SHOW');
  s = s.replace(/\bhow\s+many\b/gi, 'SHOW COUNT');
  s = s.replace(/\bare\s+there\b/gi, ''); // clean up trailing parts of "how many ... are there?"

  // 2. Implied Semantic Patterns (Marks)
  // Check this before generic 'above' to catch "scoring above" vs just "above"
  s = s.replace(/\b(?:marks\s+above|marks\s+over|marks\s+greater\s+than|scoring\s+above|scored\s+more\s+than|scored\s+above)\s+(\d+)\b/gi, 'marks > $1');
  s = s.replace(/\b(?:marks\s+below|marks\s+under|scoring\s+below|scored\s+less\s+than)\s+(\d+)\b/gi, 'marks < $1');

  // 3. Implied Semantic Patterns (Age)
  s = s.replace(/\b(?:older\s+than|age\s+above|age\s+over|age\s+greater\s+than|age\s+is\s+greater\s+than)\s+(\d+)(?:\s+years(?:\s+old)?)?\b/gi, 'age > $1');
  s = s.replace(/\b(?:younger\s+than|age\s+below|age\s+under|age\s+less\s+than)\s+(\d+)(?:\s+years(?:\s+old)?)?\b/gi, 'age < $1');

  // 4. Implied Semantic Patterns (Department)
  s = s.replace(/\b(?:from|belonging\s+to(?:\s+the)?|belong\s+to(?:\s+the)?|in\s+the|in|department\s+is|department\s+equals)\s+(?!equal\b|greater\b|less\b|not\b)([A-Za-z0-9_-]+)(?:\s+department)?\b/gi, "department = '$1'");

  // 5. Comparison Phrases (Generic)
  s = s.replace(/\b(?:greater\s+than\s+or\s+equal\s+to|at\s+least)\b/gi, '>=');
  s = s.replace(/\b(?:less\s+than\s+or\s+equal\s+to|at\s+most)\b/gi, '<=');
  s = s.replace(/\b(?:greater\s+than|more\s+than|higher\s+than|above|over)\b/gi, '>');
  s = s.replace(/\b(?:less\s+than|lower\s+than|below|under)\b/gi, '<');
  s = s.replace(/\b(?:not\s+equal\s+to|different\s+from|is\s+not)\b/gi, '!=');
  s = s.replace(/\b(?:is\s+equal\s+to|equal\s+to|same\s+as|equals)\b/gi, '=');

  // 6. Multiple Conditions and Linking
  s = s.replace(/\b(?:also|as\s+well\s+as)\b/gi, 'AND');
  // Relative pronouns act as AND when chaining conditions
  s = s.replace(/\b(?:who|whose|that|which)\b/gi, 'AND');
  
  // Logical connectors
  s = s.replace(/\band\b/gi, 'AND');
  s = s.replace(/\bor\b/gi, 'OR');

  // commas separating conditions
  s = s.replace(/,\s+AND\b/gi, ' AND ');
  s = s.replace(/,\s+OR\b/gi, ' OR ');
  s = s.replace(/,/g, ' AND ');

  // 7. Table -> Condition Introducer mapping
  // Converts "students age > 18" to "students WHERE age > 18"
  s = s.replace(/\b(students|courses|faculty)\s+(age|marks|department|credits|course_name|name|id|faculty_id)\b/gi, '$1 WHERE $2');

  // 8. Implicit numeric condition fallback
  // Converts "students > 18" to "students WHERE age > 18"
  // Ensures "Show students above 18" parses deterministically based on schema logic.
  s = s.replace(/\b(students)\s+(>|<|>=|<=|=|!=)\s+(\d+)\b/gi, '$1 WHERE age $2 $3');

  // 9. Clean up artifact "AND"s right after a table
  // "students AND age > 18" -> "students WHERE age > 18"
  s = s.replace(/\b(students|courses|faculty)\s+AND\b/gi, '$1 WHERE');

  // Clean up any double spaces that might have been introduced
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}
