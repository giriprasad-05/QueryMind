import React, { useState } from 'react';
import { Database, Play, Copy, Check, Terminal, Loader2 } from 'lucide-react';
import './SqlPanel.css';

export default function SqlPanel({ sqlResult, isExecuting, onExecute }) {
  const [copied, setCopied] = useState(false);

  const hasResult = sqlResult !== null;
  const isSuccess = hasResult && sqlResult.sql;
  const hasErrors = hasResult && sqlResult.errors && sqlResult.errors.length > 0;
  const sql = isSuccess ? sqlResult.sql : "";

  const handleCopy = () => {
    if (!sql) return;
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExecute = () => {
    if (sql && onExecute && !isExecuting) {
      onExecute(sql);
    }
  };

  // Very basic syntax highlighting
  const renderHighlightedSQL = (code) => {
    const lines = code.split('\n');
    return lines.map((line, i) => {
      // split by spaces, but carefully
      const parts = line.split(/(\s+)/);
      return (
        <div key={i} className="sql-line">
          {parts.map((part, j) => {
            const up = part.toUpperCase();
            if (['SELECT', 'FROM', 'WHERE', 'AND', 'OR'].includes(up)) {
              return <span key={j} className="sql-keyword">{part}</span>;
            }
            if (part.startsWith("'") && part.endsWith("'")) {
              return <span key={j} className="sql-string">{part}</span>;
            }
            if (!isNaN(part) && part.trim() !== '') {
              return <span key={j} className="sql-number">{part}</span>;
            }
            return <span key={j}>{part}</span>;
          })}
        </div>
      );
    });
  };

  return (
    <section className="output-subpanel sql-panel-card" aria-labelledby="generated-sql-heading">
      <div className="panel-tab-header sql-header">
        <div className="panel-tab-title sql-title-group">
          <Database size={16} className="sql-title-icon panel-icon" />
          <h2 id="generated-sql-heading" className="tab-name sql-title">Generated SQL</h2>
          <span className="sql-dialect-tag">PostgreSQL Dialect</span>
        </div>

        <div className="sql-header-actions panel-tab-controls">
          <button 
            type="button" 
            className="sql-action-btn copy-btn"
            disabled={!isSuccess}
            onClick={handleCopy}
            title={isSuccess ? "Copy SQL to clipboard" : "No SQL generated yet"}
          >
            {copied ? <Check size={13} className="success" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button 
            type="button" 
            className={`sql-action-btn execute-btn ${isSuccess && !isExecuting ? '' : 'disabled'}`}
            disabled={!isSuccess || isExecuting}
            onClick={handleExecute}
            title={isSuccess ? "Execute Query against PostgreSQL" : "No valid SQL to execute"}
          >
            {isExecuting ? <Loader2 size={13} className="play-icon spinning" /> : <Play size={13} className="play-icon" />}
            <span>{isExecuting ? 'Executing...' : 'Execute Query'}</span>
          </button>
        </div>
      </div>

      <div className="panel-inner-content sql-editor-container">
        <div className="sql-code-area">
          {!hasResult ? (
            <div className="sql-placeholder-content">
              <span className="sql-comment">-- SQL will appear here after compilation.</span>
              <span className="sql-comment-sub">-- Target Engine: PostgreSQL 16</span>
              <span className="sql-comment-sub">-- Status: Pipeline Idle</span>
            </div>
          ) : hasErrors ? (
            <div className="sql-error-content" style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--text-main)', fontSize: '13px', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)'}}>
              <div style={{ color: 'var(--error)', fontWeight: 600, marginBottom: '8px' }}>SQL Generation Error</div>
              {sqlResult.errors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          ) : (
            <div className="sql-pre" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: 1.5, padding: '16px' }}>
              {renderHighlightedSQL(sql)}
            </div>
          )}
        </div>
      </div>

      <div className="sql-footer-bar">
        <div className="sql-footer-info">
          <Terminal size={12} className="footer-icon" />
          <span>Execution sandbox active • Phase 10 Database Integration</span>
        </div>
        <div className="sql-dialect-info">
          <span>ANSI SQL-92 / Postgres Compatible</span>
        </div>
      </div>
    </section>
  );
}
