/**
 * AstPanel — Phase 7: AST Generation & Visualization
 *
 * Displays either the CST (Parse Tree) or the simplified AST.
 */

import React, { useState } from 'react';
import { Network, AlertCircle, GitFork } from 'lucide-react';
import ParseTree from './ParseTree/ParseTree';

import {
  AST_PROGRAM,
  AST_SELECT,
  AST_TABLE,
  AST_WHERE,
  AST_BINARY_EXPRESSION,
  AST_LOGICAL_EXPRESSION,
  AST_COLUMN,
  AST_LITERAL,
  AST_AGGREGATE_EXPRESSION,
  AST_ALL_COLUMNS,
} from '../compiler/ast/astNodeTypes.js';

// ─── Parse error list ─────────────────────────────────────────────────────────

function ParseErrorList({ errors }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="parse-error-list" role="alert" aria-label="Parser errors">
      <div className="parse-error-header">
        <AlertCircle size={13} className="parse-error-icon" />
        <span>{`Syntax ${errors.length === 1 ? 'Error' : 'Errors'} (${errors.length})`}</span>
      </div>
      {errors.map((err, i) => (
        <div key={i} className="parse-error-item">
          <p className="parse-error-msg">{err.message}</p>
          <div className="parse-error-details">
            <span className="parse-err-label">Found:</span>
            <code className="parse-err-found">{err.found}</code>
            <span className="parse-err-label">Expected:</span>
            <code className="parse-err-expected">{err.expected ? err.expected.join(' | ') : 'N/A'}</code>
            {err.position >= 0 && (
              <>
                <span className="parse-err-label">Position:</span>
                <code className="parse-err-pos">{err.position}</code>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── AST Adapter ────────────────────────────────────────────────────────────

/**
 * Transforms the logical AST object structure into the { type, value, children: [] } 
 * structure expected by the ParseTree layout visualizer.
 */
function mapASTToVisual(astNode) {
  if (!astNode) return null;

  switch (astNode.type) {
    case AST_PROGRAM:
      return {
        type: AST_PROGRAM,
        value: null,
        children: astNode.body ? [mapASTToVisual(astNode.body)] : []
      };
    case AST_SELECT: {
      const children = [];
      if (astNode.projection) children.push(mapASTToVisual(astNode.projection));
      if (astNode.table) children.push(mapASTToVisual(astNode.table));
      if (astNode.where) children.push(mapASTToVisual(astNode.where));
      return { type: AST_SELECT, value: null, children: children.filter(Boolean) };
    }
    case AST_AGGREGATE_EXPRESSION:
      return {
        type: AST_AGGREGATE_EXPRESSION,
        value: astNode.function,
        children: astNode.argument ? [mapASTToVisual(astNode.argument)].filter(Boolean) : []
      };
    case AST_ALL_COLUMNS:
      return { type: AST_ALL_COLUMNS, value: '*', children: [] };
    case AST_TABLE:
      return { type: AST_TABLE, value: astNode.name, children: [] };
    case AST_WHERE:
      return {
        type: AST_WHERE,
        value: null,
        children: astNode.expression ? [mapASTToVisual(astNode.expression)] : []
      };
    case AST_BINARY_EXPRESSION:
      return {
        type: AST_BINARY_EXPRESSION,
        value: astNode.operator,
        children: [mapASTToVisual(astNode.left), mapASTToVisual(astNode.right)].filter(Boolean)
      };
    case AST_LOGICAL_EXPRESSION:
      return {
        type: AST_LOGICAL_EXPRESSION,
        value: astNode.operator,
        children: [mapASTToVisual(astNode.left), mapASTToVisual(astNode.right)].filter(Boolean)
      };
    case AST_COLUMN:
      return { type: AST_COLUMN, value: astNode.name, children: [] };
    case AST_LITERAL:
      return {
        type: AST_LITERAL,
        value: String(astNode.value),
        dataType: astNode.dataType, // preserved for inspection
        children: []
      };
    default:
      return { type: astNode.type, value: null, children: [] };
  }
}

// ─── Main AstPanel ────────────────────────────────────────────────────────────

export default function AstPanel({ 
  parseResult = null, 
  astResult = null,
  astNodesCount = 0,
  logicalNodesCount = 0,
  onTreeStatusChange 
}) {
  const [activeTab, setActiveTab] = useState('AST');

  const hasParseResult = parseResult !== null;
  const hasParseTree   = hasParseResult && parseResult.tree !== null;
  const hasErrors      = hasParseResult && parseResult.errors.length > 0;
  const isParseSuccess = hasParseResult && parseResult.success;

  const hasAstResult   = astResult !== null;
  const hasAstTree     = hasAstResult && astResult.ast !== null;
  const isAstSuccess   = hasAstResult && astResult.success;

  const visualAST = hasAstTree ? mapASTToVisual(astResult.ast) : null;

  return (
    <div className="output-subpanel ast-panel" id="ast-panel">
      {/* ── Panel header ────────────────────────────────────────────────── */}
      <div className="panel-tab-header">
        <div className="panel-tab-title">
          <GitFork size={15} className="panel-icon" />
          <span className="tab-name">Syntax Trees</span>
        </div>
        
        {hasParseResult && !hasErrors && (
          <div className="panel-tab-controls" style={{ marginLeft: '12px', display: 'flex', gap: '4px' }}>
            <button 
              className={`tab-btn ${activeTab === 'ParseTree' ? 'active' : ''}`}
              onClick={() => setActiveTab('ParseTree')}
            >
              Parse Tree
            </button>
            <button 
              className={`tab-btn ${activeTab === 'AST' ? 'active' : ''}`}
              onClick={() => setActiveTab('AST')}
            >
              AST
            </button>
          </div>
        )}

        <div className="panel-tab-meta">
          {hasParseResult && !hasErrors && (
            <span className="panel-badge count-badge">
              Parse: {astNodesCount} | AST: {logicalNodesCount}
            </span>
          )}
          <span className={`panel-badge stage-badge ${hasErrors ? 'error-badge' : isAstSuccess ? 'success-badge' : ''}`}>
            {isAstSuccess
              ? 'AST ✓'
              : isParseSuccess
                ? 'Parser ✓'
                : hasErrors
                  ? 'Parser ⚠'
                  : 'AST'
            }
          </span>
        </div>
      </div>

      {/* ── Panel body ──────────────────────────────────────────────────── */}
      <div className="panel-inner-content ast-panel-inner">
        {!hasParseResult ? (
          /* ── Placeholder state ─────────────────────────────────────── */
          <div className="panel-placeholder-state">
            <div className="placeholder-icon-wrap">
              <Network size={28} className="placeholder-icon" />
            </div>
            <p className="placeholder-primary-text">Compile a valid query to generate its AST.</p>
            <p className="placeholder-secondary-text">
              The AST Builder transforms the grammar-oriented Parse Tree into a
              simplified Abstract Syntax Tree for semantic analysis.
            </p>
          </div>
        ) : (
          /* ── Results area ──────────────────────────────────────────── */
          <div className="ast-results-area fill-height">
            {/* Parser status banner for errors only */}
            {hasErrors && (
              <div className="ast-status-banner ast-banner-error">
                <AlertCircle size={14} className="ast-banner-icon" />
                <span className="ast-banner-title">PARSE TREE UNAVAILABLE</span>
                <span className="ast-banner-sub">
                  Syntax errors must be fixed before the AST can be built.
                </span>
              </div>
            )}

            {/* Parse errors */}
            {hasErrors && <ParseErrorList errors={parseResult.errors} />}
            
            {/* AST Builder errors */}
            {!hasErrors && astResult && !astResult.success && astResult.errors && astResult.errors.length > 0 && (
              <div className="ast-status-banner ast-banner-error">
                <AlertCircle size={14} className="ast-banner-icon" />
                <span className="ast-banner-title">AST CONSTRUCTION FAILED</span>
                <span className="ast-banner-sub">{astResult.errors[0]}</span>
              </div>
            )}

            {/* Tree visualization */}
            {!hasErrors && activeTab === 'ParseTree' && hasParseTree && (
              <div className="ast-tree-viz-container">
                <ParseTree 
                  key="cst"
                  tree={parseResult.tree} 
                  onStatusChange={onTreeStatusChange}
                />
              </div>
            )}

            {!hasErrors && activeTab === 'AST' && visualAST && (
              <div className="ast-tree-viz-container">
                <ParseTree 
                  key="ast"
                  tree={visualAST} 
                  onStatusChange={onTreeStatusChange}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
