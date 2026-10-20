import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Play, 
  RotateCcw, 
  AlertCircle, 
  Loader2, 
  Command, 
  Lightbulb
} from 'lucide-react';
import { EXAMPLE_QUERIES } from '../data/examples';

/**
 * QueryEditor — Phase 3
 *
 * Props:
 *   onStatusChange(status: string)     – tells App the current lifecycle status
 *   onCompile(query: string)           – App runs the lexer, returns { tokens, errors }
 */
export default function QueryEditor({ onStatusChange, onCompile }) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const textareaRef = useRef(null);

  // Compute input state flags
  const isFilled = query.trim().length > 0;
  const isEmpty  = query.length === 0;

  // Dynamic line-number gutter
  const lineCount   = Math.max(3, (query.match(/\n/g) || []).length + 1);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  // Handle text changes — clear validation on any keystroke
  const handleQueryChange = (e) => {
    setQuery(e.target.value);
    if (validationError) setValidationError(null);
  };

  // ── Compile Handler ────────────────────────────────────────────────────
  const handleCompile = () => {
    if (isCompiling) return;

    if (!query.trim()) {
      setValidationError('Enter a query to compile.');
      textareaRef.current?.focus();
      return;
    }

    setValidationError(null);
    setIsCompiling(true);
    onStatusChange?.('Compiling...');

    // Run the real lexer synchronously; wrap in rAF so the "Compiling…"
    // spinner renders for at least one frame (visual feedback), then resolve.
    requestAnimationFrame(() => {
      // Small deliberate delay (100ms) so the compiling state is visible
      setTimeout(() => {
        const result = onCompile?.(query);
        setIsCompiling(false);

        const lexErrors = result?.errors || result?.lexResult?.errors || [];
        if (lexErrors.length > 0) {
          onStatusChange?.('Lexical errors found');
        } else {
          onStatusChange?.('Lexer complete');
        }
      }, 150);
    });
  };

  // ── Clear Handler ──────────────────────────────────────────────────────
  const handleClear = () => {
    setQuery('');
    setValidationError(null);
    setIsCompiling(false);
    onStatusChange?.('Idle');
    textareaRef.current?.focus();
  };

  // ── Example chip handler ───────────────────────────────────────────────
  const handleSelectExample = (exampleText) => {
    setQuery(exampleText);
    setValidationError(null);
    textareaRef.current?.focus();
  };

  // ── Ctrl / Cmd + Enter shortcut ───────────────────────────────────────
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCompile();
    }
  };

  // ── Visual state classes for the editor container ─────────────────────
  const containerStateClass = [
    isEmpty ? 'state-empty' : 'state-filled',
    isFocused    ? 'state-focused'   : '',
    isCompiling  ? 'state-compiling' : '',
    validationError ? 'state-error'  : '',
  ].filter(Boolean).join(' ');

  return (
    <section className="query-editor-card" aria-labelledby="query-section-heading">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="card-header">
        <div className="card-title-group">
          <Sparkles size={16} className="card-title-icon" />
          <h2 id="query-section-heading" className="card-title">Natural Language Query</h2>
        </div>

        <div className="card-header-actions">
          <div className="shortcut-badge" title="Shortcut to compile: Ctrl + Enter">
            <Command size={11} className="shortcut-icon" />
            <span>Ctrl + Enter</span>
          </div>
        </div>
      </div>

      {/* ── Example chips ─────────────────────────────────────────────── */}
      <div className="examples-bar" role="region" aria-label="Example Queries">
        <div className="examples-header">
          <Lightbulb size={13} className="examples-icon" />
          <span className="examples-title">Try an example:</span>
        </div>
        <div className="examples-list" role="list">
          {EXAMPLE_QUERIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`example-chip ${query === item.query ? 'selected' : ''}`}
              onClick={() => handleSelectExample(item.query)}
              title={`Load: "${item.query}"`}
              disabled={isCompiling}
            >
              <span>{item.query}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Editor area ───────────────────────────────────────────────── */}
      <div className={`editor-container ${containerStateClass}`}>
        <div className="editor-gutter" aria-hidden="true">
          {lineNumbers.map((num) => (
            <span key={num} className="line-num">{num}</span>
          ))}
        </div>

        <div className="editor-input-wrapper">
          <textarea
            ref={textareaRef}
            id="nl-query-input"
            className="query-textarea"
            placeholder="Ask your database a question..."
            value={query}
            onChange={handleQueryChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            disabled={isCompiling}
            rows={lineCount}
            spellCheck={false}
            aria-label="Natural Language Query input"
            aria-invalid={Boolean(validationError)}
            aria-describedby={validationError ? 'query-validation-error' : undefined}
          />
        </div>
      </div>

      {/* ── Inline validation message ──────────────────────────────────── */}
      {validationError && (
        <div
          id="query-validation-error"
          className="inline-validation-message"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle size={14} className="validation-icon" />
          <span className="validation-text">{validationError}</span>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="card-footer">
        <div className="footer-left">
          <span className="char-count" aria-live="polite">
            Characters: {query.length}
          </span>
          <span className="editor-status-divider">•</span>
          <span className={`editor-status-indicator ${isCompiling ? 'compiling' : ''}`}>
            {isCompiling ? (
              <>
                <Loader2 size={11} className="spinning inline-spin" />
                <span>Running lexer…</span>
              </>
            ) : (
              <span>Editor ready</span>
            )}
          </span>
        </div>

        <div className="footer-actions">
          <button
            type="button"
            className="action-btn clear-btn"
            onClick={handleClear}
            disabled={!isFilled && !validationError}
            title="Clear the current query text"
            aria-label="Clear query input"
          >
            <RotateCcw size={13} />
            <span>Clear</span>
          </button>

          <button
            type="button"
            className={`action-btn compile-btn ${isCompiling ? 'loading' : ''}`}
            onClick={handleCompile}
            disabled={isCompiling}
            title={isCompiling ? 'Running lexer…' : 'Compile query (Ctrl + Enter)'}
            aria-label="Compile Natural Language Query"
          >
            {isCompiling ? (
              <>
                <Loader2 size={14} className="spinning" />
                <span>Compiling…</span>
              </>
            ) : (
              <>
                <Play size={13} className="play-icon" />
                <span>Compile</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
