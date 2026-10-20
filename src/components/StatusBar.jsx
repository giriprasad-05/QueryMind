import React from 'react';
import { CircleDot, Binary, GitFork, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

export default function StatusBar({
  tokensCount         = 0,
  astNodesCount       = 0,
  errorsCount         = 0,
  compilationStatus   = 'Idle',
  parseErrCount       = 0,
}) {
  const isCompiling   = compilationStatus === 'Compiling...';
  const isLexerDone   = compilationStatus === 'Lexer complete';
  const isLexerError  = compilationStatus === 'Lexical errors found';
  const isSyntaxValid = compilationStatus === 'Syntax valid';
  const isSyntaxError = compilationStatus === 'Syntax errors found';

  const statusColorClass = (() => {
    if (isCompiling)   return 'status-compiling-text';
    if (isLexerError || isSyntaxError) return 'status-error-text';
    if (isSyntaxValid) return 'status-success-text';
    if (isLexerDone)   return 'status-success-text';
    return 'status-idle';
  })();

  return (
    <footer className="status-bar" id="querymind-status-bar" role="status">
      <div className="status-bar-left">
        {/* Compilation phase status */}
        <div className="status-item status-compilation">
          {isCompiling ? (
            <Loader2 size={12} className="status-icon spinning compiling-icon" />
          ) : (isSyntaxValid || isLexerDone) ? (
            <CheckCircle2 size={12} className="status-icon status-ok-icon" />
          ) : (
            <CircleDot size={12} className="status-icon idle-icon" />
          )}
          <span className="status-key">Compilation:</span>
          <span className={`status-value ${statusColorClass}`}>
            {compilationStatus}
          </span>
        </div>

        <div className="status-divider" aria-hidden="true"></div>

        {/* Token count */}
        <div className="status-item">
          <Binary size={12} className="status-icon" />
          <span className="status-key">Tokens:</span>
          <span className="status-val-num">{tokensCount}</span>
        </div>

        <div className="status-divider" aria-hidden="true"></div>

        {/* AST node count */}
        <div className="status-item">
          <GitFork size={12} className="status-icon" />
          <span className="status-key">AST Nodes:</span>
          <span className="status-val-num">{astNodesCount}</span>
        </div>

        <div className="status-divider" aria-hidden="true"></div>

        {/* Parser errors */}
        <div className="status-item">
          <AlertCircle size={12} className="status-icon error-icon-muted" />
          <span className="status-key">Parser Errors:</span>
          <span className={`status-val-num ${parseErrCount > 0 ? 'error-val' : ''}`}>
            {parseErrCount}
          </span>
        </div>

        <div className="status-divider" aria-hidden="true"></div>

        {/* Total errors */}
        <div className="status-item">
          <AlertCircle size={12} className="status-icon error-icon-muted" />
          <span className="status-key">Errors:</span>
          <span className={`status-val-num ${errorsCount > 0 ? 'error-val' : ''}`}>
            {errorsCount}
          </span>
        </div>
      </div>

      <div className="status-bar-right">
        <div className="status-item status-meta">
          <span>Target: PostgreSQL</span>
        </div>
        <div className="status-divider" aria-hidden="true"></div>
        <div className="status-item status-meta">
          <span>UTF-8</span>
        </div>
        <div className="status-divider" aria-hidden="true"></div>
        <div className="status-item status-meta status-phase">
          <span>Phase 5: Parser</span>
        </div>
      </div>
    </footer>
  );
}
