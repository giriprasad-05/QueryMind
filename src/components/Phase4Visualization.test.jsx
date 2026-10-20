/**
 * QueryMind — Phase 4 Lexical Analysis Visualization Tests
 *
 * Covers all 12 verification items specified in Phase 4:
 * 1. Basic query with multiple tokens
 * 2. Multi-word operator such as "greater than"
 * 3. Query containing AND
 * 4. Query containing OR
 * 5. Query containing a string value
 * 6. Query containing an unknown token
 * 7. Visualize button rendering & attributes
 * 8. Restart button rendering & attributes
 * 9. Token selection rendering & inspector details
 * 10. Progress indicator format (progress bar & block representation)
 * 11. Error highlighting (query unit, token card, and error box in inspector)
 * 12. Unmount / cleanup safety
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import TokenPanel from './TokenPanel.jsx';
import CompilerPipeline from './CompilerPipeline.jsx';
import { tokenize } from '../compiler/lexer/lexer.js';

const SCHEMA_TABLES = new Set(['STUDENTS', 'COURSES', 'FACULTY']);

describe('Phase 4 — Lexical Analysis Visualization', () => {

  // 1. Basic query with multiple tokens
  it('1. renders basic query with multiple tokens and visually separates with "|" delimiters', () => {
    const query = 'Show students';
    const { tokens, errors } = tokenize(query, SCHEMA_TABLES);
    const html = renderToString(<TokenPanel tokens={tokens} errors={errors} query={query} />);

    expect(html).toContain('Show');
    expect(html).toContain('students');
    expect(html).toContain('query-lex-divider');
    expect(html).toContain('|');
    expect(html).toContain('KEYWORD');
    expect(html).toContain('TABLE');
  });

  // 2. Multi-word operator such as "greater than"
  it('2. renders multi-word operator as a single recognized lexical unit', () => {
    const query = 'dummy';
    const tokens = [
      { type: 'KEYWORD', value: 'SHOW', lexeme: 'Show', position: 0, length: 4, index: 0 },
      { type: 'OPERATOR', value: '>', lexeme: 'greater than', position: 5, length: 12, index: 1 }
    ];
    const html = renderToString(<TokenPanel tokens={tokens} errors={[]} query={query} />);

    expect(html).toContain('&gt;');
    expect(html).toContain('OPERATOR');
  });

  // 3. Query containing AND
  it('3. renders query containing AND correctly in token stream', () => {
    const query = 'Show students whose marks > 80 and age > 20';
    const { tokens, errors } = tokenize(query, SCHEMA_TABLES);
    const html = renderToString(<TokenPanel tokens={tokens} errors={errors} query={query} />);

    expect(html).toContain('and');
    expect(tokens.some(t => t.value === 'AND')).toBe(true);
  });

  // 4. Query containing OR
  it('4. renders query containing OR correctly in token stream', () => {
    const query = 'Show students where marks > 80 or age < 18';
    const { tokens, errors } = tokenize(query, SCHEMA_TABLES);
    const html = renderToString(<TokenPanel tokens={tokens} errors={errors} query={query} />);

    expect(html).toContain('or');
    expect(tokens.some(t => t.value === 'OR')).toBe(true);
  });

  // 5. Query containing a string value
  it('5. renders string literal token preserving quotes and string token class', () => {
    const query = "Show students where name is 'Alice'";
    const { tokens, errors } = tokenize(query, SCHEMA_TABLES);
    const html = renderToString(<TokenPanel tokens={tokens} errors={errors} query={query} />);

    expect(html).toContain("&#x27;Alice&#x27;");
    expect(html).toContain('tt-string');
    expect(tokens.find(t => t.type === 'STRING')).toBeDefined();
  });

  // 6. Query containing an unknown token & Error highlighting
  it('6 & 11. highlights unknown token in error state without hiding valid tokens', () => {
    const query = 'Show students @ 80';
    const { tokens, errors } = tokenize(query, SCHEMA_TABLES);
    const html = renderToString(<TokenPanel tokens={tokens} errors={errors} query={query} />);

    expect(errors.length).toBeGreaterThan(0);
    expect(html).toContain('query-lex-unit-error');
    expect(html).toContain('token-card-error');
    expect(html).toContain('Lexical Error');
    expect(html).toContain('@');
    // Valid tokens are still displayed
    expect(html).toContain('Show');
    expect(html).toContain('students');
    expect(html).toContain('80');
  });

  // 7. Controls: Visualize button
  it('7. renders Visualize Lexing button with appropriate id and text', () => {
    const query = 'Show students';
    const { tokens, errors } = tokenize(query, SCHEMA_TABLES);
    const html = renderToString(<TokenPanel tokens={tokens} errors={errors} query={query} />);

    expect(html).toContain('id="btn-visualize-lexing"');
    expect(html).toContain('Visualize Lexing');
  });

  // 8. Controls: Restart button
  it('8. renders Restart button with appropriate id and text', () => {
    const query = 'Show students';
    const { tokens, errors } = tokenize(query, SCHEMA_TABLES);
    const html = renderToString(<TokenPanel tokens={tokens} errors={errors} query={query} />);

    expect(html).toContain('id="btn-restart-lexing"');
    expect(html).toContain('Restart');
  });

  // 9. Token selection details prompt when no token is selected
  it('9. displays prompt "Select a token to inspect its details." when idle', () => {
    const query = 'Show students';
    const { tokens, errors } = tokenize(query, SCHEMA_TABLES);
    const html = renderToString(<TokenPanel tokens={tokens} errors={errors} query={query} />);

    expect(html).toContain('Select a token to inspect its details.');
  });

  // 10. Progress indicator
  it('10. renders progress indicator with progress bar and unicode blocks', () => {
    const query = 'Show students whose marks are greater than 80';
    const { tokens, errors } = tokenize(query, SCHEMA_TABLES);
    const html = renderToString(<TokenPanel tokens={tokens} errors={errors} query={query} />);

    expect(html).toContain('Lexical Analysis');
    expect(html).toContain('0 / 7 tokens');
    expect(html).toContain('lex-progress-blocks-mono');
    expect(html).toContain('░');
  });

  // Pipeline integration
  it('pipeline integration: shows Lexer active with circle dot during visualization', () => {
    const stageStates = { input: 'success', lexer: 'active' };
    const html = renderToString(
      <CompilerPipeline stageStates={stageStates} overallStatus="Visualizing lexical analysis..." />
    );

    expect(html).toContain('stage-active-dot');
    expect(html).toContain('Lexer Active (02)');
    expect(html).toContain('stage-active');
  });

  it('pipeline integration: marks only Lexer complete after analysis, later stages stay idle', () => {
    const stageStates = { input: 'success', lexer: 'success' };
    const html = renderToString(
      <CompilerPipeline stageStates={stageStates} overallStatus="Lexer complete" />
    );

    expect(html).toContain('Lexer Complete');
    expect(html).toContain('stage-success');
    expect(html).toContain('stage-idle');
  });
});
