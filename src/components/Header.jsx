import React from 'react';
import { Terminal, Cpu, Loader2, CheckCircle2, AlertCircle, Database } from 'lucide-react';

export default function Header({ status = 'Ready', onOpenSchemaManager }) {
  const isCompiling      = status === 'Compiling...';
  const isLexerComplete  = status === 'Lexer complete';
  const isLexerError     = status === 'Lexical errors found';

  return (
    <header className="header" id="querymind-header">
      <div className="header-left">
        <div className="brand-logo">
          <div className="logo-icon-wrapper">
            <Cpu className="logo-icon" size={20} />
          </div>
          <div className="brand-titles">
            <div className="brand-name-row">
              <span className="brand-name">QueryMind</span>
              <span className="brand-version">v0.3</span>
            </div>
            <span className="brand-subtitle">Natural Language → SQL Compiler</span>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="playground-pill">
          <Terminal size={14} className="pill-icon" />
          <span className="pill-text">Compiler Playground</span>
        </div>
        {onOpenSchemaManager && (
          <button
            type="button"
            className="playground-pill"
            style={{ cursor: 'pointer', background: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8' }}
            onClick={onOpenSchemaManager}
            title="Open Dynamic Database Schema Manager"
          >
            <Database size={13} className="pill-icon" />
            <span className="pill-text" style={{ color: '#38bdf8', fontWeight: 600 }}>Schema Manager</span>
          </button>
        )}
      </div>

      <div className="header-right">
        {isCompiling ? (
          <div className="status-badge compiling">
            <Loader2 size={12} className="spinning" />
            <span className="status-label">Compiling…</span>
          </div>
        ) : isLexerError ? (
          <div className="status-badge error-badge">
            <AlertCircle size={12} />
            <span className="status-label">Lexical errors found</span>
          </div>
        ) : isLexerComplete ? (
          <div className="status-badge ready-analysis">
            <CheckCircle2 size={12} />
            <span className="status-label">Lexer complete</span>
          </div>
        ) : (
          <div className="status-badge ready">
            <span className="status-dot"></span>
            <span className="status-label">Ready</span>
          </div>
        )}
        <div className="phase-badge">
          <span>SQL Compiler</span>
        </div>
      </div>
    </header>
  );
}
