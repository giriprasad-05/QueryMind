import React, { useState, useEffect, useRef } from 'react';
import { 
  Binary, 
  AlertCircle, 
  X, 
  Info, 
  Play, 
  RotateCcw, 
  Loader2 
} from 'lucide-react';

// ─── Token type colour/label config ──────────────────────────────────────────
const TOKEN_DISPLAY = {
  KEYWORD:     { label: 'KEYWORD',     colorClass: 'tt-keyword'    },
  TABLE:       { label: 'TABLE',       colorClass: 'tt-table'      },
  IDENTIFIER:  { label: 'IDENTIFIER',  colorClass: 'tt-identifier' },
  CONNECTOR:   { label: 'CONNECTOR',   colorClass: 'tt-connector'  },
  OPERATOR:    { label: 'OPERATOR',    colorClass: 'tt-operator'   },
  NUMBER:      { label: 'NUMBER',      colorClass: 'tt-number'     },
  STRING:      { label: 'STRING',      colorClass: 'tt-string'     },
  UNKNOWN:     { label: 'UNKNOWN',     colorClass: 'tt-unknown'    },
  AGGREGATE:   { label: 'AGGREGATE',   colorClass: 'tt-aggregate'  },
  SORT:        { label: 'SORT',        colorClass: 'tt-sort'       },
  LIMIT:       { label: 'LIMIT',       colorClass: 'tt-limit'      },
  GROUP:       { label: 'GROUP',       colorClass: 'tt-group'      },
  BOOLEAN:     { label: 'BOOLEAN',     colorClass: 'tt-boolean'    },
  PARENTHESIS: { label: 'PAREN',       colorClass: 'tt-paren'      },
};

function getDisplay(type) {
  return TOKEN_DISPLAY[type] || { label: type, colorClass: 'tt-unknown' };
}

// ─── Helper: ASCII/Unicode block progress bar generator ──────────────────────
function renderProgressBlocks(processedCount, totalCount, numBlocks = 14) {
  if (totalCount <= 0) return '░'.repeat(numBlocks);
  const ratio = Math.min(1, Math.max(0, processedCount / totalCount));
  const filled = Math.round(ratio * numBlocks);
  const empty = Math.max(0, numBlocks - filled);
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// ─── 1. Query Highlighting Stream (Requirement 1) ─────────────────────────────
function QueryHighlightStream({ 
  tokens, 
  scanningIndex, 
  isScanning, 
  selectedToken, 
  onSelectToken,
  rawQuery
}) {
  return (
    <div className="query-highlight-card" aria-label="Query Highlighting Stream">
      <div className="query-highlight-header">
        <span className="query-highlight-title">Recognized Lexical Stream</span>
        {rawQuery ? (
          <span className="query-highlight-hint" title={rawQuery}>
            Source: "{rawQuery.length > 40 ? rawQuery.slice(0, 40) + '…' : rawQuery}"
          </span>
        ) : (
          <span className="query-highlight-hint">Left-to-right lexical scan</span>
        )}
      </div>
      <div className="query-highlight-body" role="list">
        {tokens.map((tok, idx) => {
          const isScannedCurrent = isScanning && scanningIndex === tok.index;
          const isSelected = selectedToken?.index === tok.index;
          const isError = tok.type === 'UNKNOWN';
          const { colorClass } = getDisplay(tok.type);

          const unitClass = [
            'query-lex-unit',
            colorClass,
            isScannedCurrent ? 'query-lex-unit-active' : '',
            isSelected ? 'query-lex-unit-selected' : '',
            isError ? 'query-lex-unit-error' : '',
          ].filter(Boolean).join(' ');

          return (
            <React.Fragment key={tok.index}>
              <button
                type="button"
                className={unitClass}
                onClick={() => onSelectToken(tok)}
                title={`Token #${tok.index}: ${tok.type} "${tok.value}" @ pos ${tok.position}`}
                aria-label={`Lexical unit: ${tok.value}, Type: ${tok.type}`}
                aria-pressed={isSelected}
              >
                <span className="query-lex-val">{tok.value}</span>
                <span className="query-lex-type">{tok.type}</span>
              </button>
              {idx < tokens.length - 1 && (
                <span className="query-lex-divider" aria-hidden="true">|</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── 2. Single token card (Requirement 3) ─────────────────────────────────────
function TokenCard({ token, isCurrentScanning, isSelected, onClick }) {
  const { label, colorClass } = getDisplay(token.type);
  const isError = token.type === 'UNKNOWN';

  const cardClasses = [
    'token-card',
    colorClass,
    isCurrentScanning ? 'token-card-scanning' : '',
    isSelected ? 'token-card-selected' : '',
    isError ? 'token-card-error' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={cardClasses}
      onClick={() => onClick(token)}
      title={`Inspect: ${token.type} "${token.value}" @ pos ${token.position}`}
      aria-label={`Token ${token.index + 1}: ${token.type} "${token.value}"`}
      aria-pressed={isSelected}
    >
      <span className="token-card-value">{token.value}</span>
      <span className="token-card-type">{label}</span>
    </button>
  );
}

// ─── 3. Token detail inspector (Requirement 4 & 6) ────────────────────────────
function TokenDetailPanel({ token, isScanning, onClose }) {
  if (!token) {
    return (
      <div className="token-detail-panel token-detail-empty" role="complementary" aria-label="Token details">
        <div className="token-detail-header">
          <div className="token-detail-title">
            <Info size={13} className="token-detail-icon" />
            <span>Token Details</span>
          </div>
        </div>
        <div className="token-detail-empty-body">
          <p className="token-detail-empty-msg">Select a token to inspect its details.</p>
        </div>
      </div>
    );
  }

  const { label, colorClass } = getDisplay(token.type);
  const isError = token.type === 'UNKNOWN';

  return (
    <div className={`token-detail-panel ${colorClass}-border`} role="complementary" aria-label="Token details">
      <div className="token-detail-header">
        <div className="token-detail-title">
          <Info size={13} className="token-detail-icon" />
          <span>Token Details</span>
          {isScanning && <span className="token-detail-scanning-tag">Scanning…</span>}
        </div>
        {!isScanning && (
          <button
            type="button"
            className="token-detail-close"
            onClick={onClose}
            aria-label="Deselect token"
            title="Deselect token"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Error visualization in details panel (Requirement 6) */}
      {isError && (
        <div className="token-detail-error-box" role="alert">
          <div className="error-box-header">
            <AlertCircle size={14} className="error-box-icon" />
            <span className="error-box-title">Lexical Error</span>
          </div>
          <div className="error-box-body">
            <div className="error-box-row">
              <span className="error-box-label">Unknown token:</span>
              <code className="error-box-val">{token.value}</code>
            </div>
            <div className="error-box-row">
              <span className="error-box-label">Position:</span>
              <span className="error-box-mono">{token.position}</span>
            </div>
          </div>
        </div>
      )}

      <div className="token-detail-body">
        <div className="token-detail-row">
          <span className="token-detail-label">Value:</span>
          <span className={`token-detail-value token-detail-mono ${colorClass}-text`}>
            {token.value}
          </span>
        </div>
        <div className="token-detail-row">
          <span className="token-detail-label">Type:</span>
          <span className={`token-detail-chip ${colorClass}`}>{label}</span>
        </div>
        <div className="token-detail-row">
          <span className="token-detail-label">Position:</span>
          <span className="token-detail-value token-detail-mono">{token.position}</span>
        </div>
        <div className="token-detail-row">
          <span className="token-detail-label">Lexeme:</span>
          <span className="token-detail-value token-detail-mono">{token.lexeme}</span>
        </div>
        <div className="token-detail-row">
          <span className="token-detail-label">Length:</span>
          <span className="token-detail-value token-detail-mono">{token.length} chars</span>
        </div>
        <div className="token-detail-row">
          <span className="token-detail-label">Index:</span>
          <span className="token-detail-value token-detail-mono">#{token.index}</span>
        </div>
      </div>
    </div>
  );
}

// ─── 4. Lexical error list summary (Requirement 6) ───────────────────────────
function LexErrors({ errors }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="lex-error-list" role="alert" aria-label="Lexical errors">
      <div className="lex-error-header">
        <AlertCircle size={13} className="lex-error-header-icon" />
        <span>{`Lexical ${errors.length === 1 ? 'Error' : 'Errors'} (${errors.length})`}</span>
      </div>
      {errors.map((err, i) => (
        <div key={i} className="lex-error-item">
          <span className="lex-error-msg">{err.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main TokenPanel Component ───────────────────────────────────────────────
export default function TokenPanel({ 
  tokens = [], 
  errors = [], 
  query = '', 
  onVisualizingChange,
  canonicalQuery
}) {
  const [scanningIndex, setScanningIndex] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);

  const timerRef = useRef(null);
  const hasTokens = tokens.length > 0;
  const hasErrors = errors.length > 0;

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // ── Visualize Lexing Trigger (Requirement 2 & 7) ────────────────────────────
  const handleStartVisualization = () => {
    if (isScanning || tokens.length === 0) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 1. Reset visualization state
    setSelectedToken(null);
    setIsScanning(true);
    setIsComplete(false);
    setScanningIndex(0);
    onVisualizingChange?.(true);

    let currentIdx = 0;
    const total = tokens.length;
    const STEP_DELAY = 450; // Smooth 450ms delay between tokens

    timerRef.current = setInterval(() => {
      currentIdx += 1;
      if (currentIdx < total) {
        setScanningIndex(currentIdx);
      } else {
        // Complete all tokens
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setIsScanning(false);
        setIsComplete(true);
        setScanningIndex(null);
        onVisualizingChange?.(false);
      }
    }, STEP_DELAY);
  };

  // ── Restart Trigger (Requirement 7) ────────────────────────────────────────
  const handleRestart = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsScanning(false);
    setIsComplete(false);
    setScanningIndex(null);
    setSelectedToken(null);
    onVisualizingChange?.(false);
  };

  // ── Manual Token Click Selection ───────────────────────────────────────────
  const handleTokenClick = (tok) => {
    if (isScanning) return; // Prevent selection conflicts during active animation
    setSelectedToken(prev => (prev && prev.index === tok.index ? null : tok));
  };

  const handleCloseDetail = () => setSelectedToken(null);

  // Active token for detail inspector
  const displayedToken = (isScanning && scanningIndex !== null && tokens[scanningIndex])
    ? tokens[scanningIndex]
    : selectedToken;

  // Progress metrics (Requirement 5)
  const processedCount = isComplete
    ? tokens.length
    : isScanning && scanningIndex !== null
      ? scanningIndex + 1
      : 0;

  const progressPercent = tokens.length > 0
    ? (processedCount / tokens.length) * 100
    : 0;

  const progressBlocks = renderProgressBlocks(processedCount, tokens.length, 14);

  return (
    <div className="output-subpanel token-panel" id="token-panel">
      {/* ── Panel header ──────────────────────────────────────────────── */}
      <div className="panel-tab-header">
        <div className="panel-tab-title">
          <Binary size={15} className="panel-icon" />
          <span className="tab-name">Lexical Analysis</span>
        </div>
        <div className="panel-tab-meta">
          <span className={`panel-badge stage-badge ${hasErrors ? 'error-badge' : isScanning ? 'active-badge' : ''}`}>
            {isScanning ? (
              <span className="badge-active-dot">◉ Scanning</span>
            ) : hasErrors ? (
              'Lexer ⚠'
            ) : hasTokens ? (
              'Lexer ✓'
            ) : (
              'Lexer'
            )}
          </span>
          <span className="panel-badge count-badge">{tokens.length} tokens</span>
        </div>
      </div>

      {/* ── Panel body ────────────────────────────────────────────────── */}
      <div className="panel-inner-content token-panel-inner">
        {!hasTokens ? (
          /* Placeholder state */
          <div className="panel-placeholder-state">
            <div className="placeholder-icon-wrap">
              <Binary size={28} className="placeholder-icon" />
            </div>
            <p className="placeholder-primary-text">Compile a query to view generated tokens</p>
            <p className="placeholder-secondary-text">
              The lexical analyzer breaks down input queries into formal compiler tokens
              (KEYWORD, TABLE, IDENTIFIER, OPERATOR, NUMBER, STRING).
            </p>

            <div className="mock-table-preview" aria-hidden="true">
              <div className="mock-table-head">
                <span>#</span>
                <span>TYPE</span>
                <span>LEXEME</span>
                <span>POS</span>
              </div>
              <div className="mock-table-empty-row">
                <span className="dash-placeholder">— Waiting for compilation stream —</span>
              </div>
            </div>
          </div>
        ) : (
          /* Token visualizer results */
          <div className="token-panel-results">
            {/* ── Controls Toolbar (Requirement 7) ──────────────────────── */}
            <div className="lex-controls-bar">
              <div className="lex-controls-left">
                <button
                  type="button"
                  id="btn-visualize-lexing"
                  className={`lex-action-btn lex-btn-primary ${isScanning ? 'is-scanning' : ''}`}
                  onClick={handleStartVisualization}
                  disabled={isScanning || tokens.length === 0}
                  title={isScanning ? 'Lexical scan animation in progress…' : 'Scan tokens step-by-step'}
                >
                  {isScanning ? (
                    <>
                      <Loader2 size={13} className="spinning" />
                      <span>Scanning…</span>
                    </>
                  ) : (
                    <>
                      <Play size={13} className="lex-btn-icon" />
                      <span>Visualize Lexing</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="btn-restart-lexing"
                  className="lex-action-btn lex-btn-secondary"
                  onClick={handleRestart}
                  disabled={tokens.length === 0}
                  title="Reset animation and selection"
                >
                  <RotateCcw size={13} />
                  <span>Restart</span>
                </button>
              </div>

              <div className="lex-controls-right">
                <span className="lex-mode-status">
                  {isScanning ? (
                    <span className="lex-status-live">Scanning token #{scanningIndex + 1}</span>
                  ) : isComplete ? (
                    <span className="lex-status-done">Analysis complete</span>
                  ) : (
                    <span className="lex-status-ready">Ready to visualize</span>
                  )}
                </span>
              </div>
            </div>

            {/* ── Progress Indicator (Requirement 5) ────────────────────── */}
            <div className="lex-progress-card" role="region" aria-label="Lexical Analysis Progress">
              <div className="lex-progress-header">
                <span className="lex-progress-title">Lexical Analysis</span>
                <span className="lex-progress-count">
                  {isComplete ? (
                    <span className="lex-progress-complete-label">
                      {hasErrors ? (
                        <>⚠ {tokens.length} tokens recognized ({errors.length} error{errors.length > 1 ? 's' : ''})</>
                      ) : (
                        <>✓ {tokens.length} tokens recognized</>
                      )}
                    </span>
                  ) : isScanning ? (
                    `${processedCount} / ${tokens.length} tokens`
                  ) : (
                    `0 / ${tokens.length} tokens`
                  )}
                </span>
              </div>

              <div className="lex-progress-meter">
                <div className="lex-progress-bar-track">
                  <div 
                    className={`lex-progress-bar-fill ${isComplete ? 'is-complete' : ''} ${hasErrors ? 'has-error' : ''}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="lex-progress-blocks-mono" aria-hidden="true">
                  {progressBlocks}
                </div>
              </div>
            </div>

            {/* ── NLU Canonical Query (Understanding Query) ─────────────── */}
            {canonicalQuery && (
              <div className="query-highlight-card" style={{ marginBottom: '16px' }}>
                <div className="query-highlight-header">
                  <span className="query-highlight-title">UNDERSTANDING QUERY...</span>
                </div>
                <div className="query-highlight-body" style={{ display: 'block', padding: '12px', fontFamily: 'monospace', fontSize: '13px' }}>
                  <div style={{ marginBottom: '4px' }}><strong>Intent:</strong> {canonicalQuery.intent}</div>
                  <div style={{ marginBottom: '4px' }}><strong>Entities:</strong> {canonicalQuery.tables.join(', ') || 'None'}</div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Fields:</strong> {canonicalQuery.columns.length > 0 
                      ? canonicalQuery.columns.map(c => c.value === '*' ? '*' : `${c.table}.${c.value}`).join(', ') 
                      : '*'}
                  </div>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Conditions:</strong> {canonicalQuery.conditions.length > 0 
                      ? canonicalQuery.conditions.map(c => 
                          `${c.column} ${c.operator} ${c.value}${c.logical ? ' ' + c.logical : ''}`
                        ).join(', ') 
                      : 'None'}
                  </div>
                  <div>
                    <strong>Relationships:</strong> {canonicalQuery.joins && canonicalQuery.joins.length > 0
                      ? canonicalQuery.joins.map(j => 
                          `${j.fromTable} → ${j.toTable} ON ${j.fromCol}=${j.toCol}`
                        ).join(', ')
                      : 'None'}
                  </div>
                </div>
              </div>
            )}

            {/* ── Query Highlighting Stream (Requirement 1) ─────────────── */}
            <QueryHighlightStream
              tokens={tokens}
              scanningIndex={scanningIndex}
              isScanning={isScanning}
              selectedToken={selectedToken}
              onSelectToken={handleTokenClick}
              rawQuery={query}
            />

            {/* ── Lexical Errors Notice (Requirement 6) ──────────────────── */}
            {hasErrors && <LexErrors errors={errors} />}

            {/* ── Token Cards Grid (Requirement 3) ───────────────────────── */}
            <div className="token-cards-section">
              <div className="section-mini-header">
                <span className="mini-header-title">Generated Tokens</span>
                <span className="mini-header-hint">Click card to inspect</span>
              </div>
              <div className="token-cards-grid" role="list" aria-label="Token cards">
                {tokens.map((token) => (
                  <TokenCard
                    key={token.index}
                    token={token}
                    isCurrentScanning={isScanning && scanningIndex === token.index}
                    isSelected={selectedToken?.index === token.index}
                    onClick={handleTokenClick}
                  />
                ))}
              </div>
            </div>

            {/* ── Token Details Inspector (Requirement 4 & 6) ───────────── */}
            <TokenDetailPanel
              token={displayedToken}
              isScanning={isScanning}
              onClose={handleCloseDetail}
            />

            {/* ── Compact Token Table (Preserved developer tool stream) ──── */}
            <div className="token-table-compact">
              <div className="token-table-head-row">
                <span>#</span>
                <span>TYPE</span>
                <span>VALUE</span>
                <span>POS</span>
              </div>
              {tokens.map((tok) => {
                const { label, colorClass } = getDisplay(tok.type);
                const isRowScanning = isScanning && scanningIndex === tok.index;
                const isRowSelected = selectedToken?.index === tok.index;
                return (
                  <button
                    key={tok.index}
                    type="button"
                    className={`token-table-row ${isRowScanning ? 'token-row-scanning' : ''} ${isRowSelected ? 'token-row-selected' : ''}`}
                    onClick={() => handleTokenClick(tok)}
                    aria-label={`Inspect row: token #${tok.index}`}
                  >
                    <span className="tok-cell tok-idx">{tok.index}</span>
                    <span className={`tok-cell tok-type-badge ${colorClass}`}>{label}</span>
                    <span className="tok-cell tok-value">{tok.value}</span>
                    <span className="tok-cell tok-pos">{tok.position}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
