import { describe, it, expect } from 'vitest';
import { normalizeNaturalLanguage } from './normalizer.js';

describe('normalizeNaturalLanguage', () => {
  it('maps "who are older than X" to "age > X" and processes table condition introducers', () => {
    // "older than 18" becomes "age > 18"
    // "who" becomes "AND"
    expect(normalizeNaturalLanguage('who are older than 18')).toBe('AND are age > 18');
    expect(normalizeNaturalLanguage('older than 18 years old')).toBe('age > 18');
  });

  it('maps "belong to the X department" to "department = \'X\'"', () => {
    expect(normalizeNaturalLanguage('belong to the CSE department')).toBe("department = 'CSE'");
    expect(normalizeNaturalLanguage('in the CSE department')).toBe("department = 'CSE'");
    expect(normalizeNaturalLanguage('belong to CSE')).toBe("department = 'CSE'");
  });

  it('maps "have marks greater than X" to "marks > X"', () => {
    expect(normalizeNaturalLanguage('have marks greater than 75')).toBe('have marks > 75');
    expect(normalizeNaturalLanguage('scoring above 75')).toBe('marks > 75');
  });

  it('maps relative pronouns to AND', () => {
    expect(normalizeNaturalLanguage('students who have good grades')).toBe('students WHERE have good grades');
    expect(normalizeNaturalLanguage('students that are passing')).toBe('students WHERE are passing');
  });

  it('handles a full complex query', () => {
    const input = 'Show students who are older than 18 and have marks greater than 75 and belong to the CSE department';
    const expected = "SHOW students WHERE are age > 18 AND have marks > 75 AND department = 'CSE'";
    expect(normalizeNaturalLanguage(input)).toBe(expected);
  });
});
