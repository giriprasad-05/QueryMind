import React, { useState, useEffect } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import './IrPanel.css';

export default function IrPanel({ irResult, isSemanticComplete, onIrStatusChange }) {
  const [viewMode, setViewMode] = useState('structured');
  const [isGenerating, setIsGenerating] = useState(false);

  const hasResult = irResult !== null;
  const isSuccess = hasResult && irResult.success;
  const hasErrors = hasResult && irResult.errors && irResult.errors.length > 0;
  const ir = hasResult ? irResult.ir : null;
  const stats = hasResult ? irResult.stats : { nodes: 0, filters: 0, columns: 0 };

  useEffect(() => {
    if (hasResult && isSemanticComplete) {
      setIsGenerating(true);
      onIrStatusChange?.('animating');
      const timer = setTimeout(() => {
        setIsGenerating(false);
        onIrStatusChange?.(isSuccess ? 'success' : 'error');
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setIsGenerating(false);
      if (!isSemanticComplete) {
        onIrStatusChange?.('idle');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [irResult, isSemanticComplete]);

  const renderFilter = (filter, depth = 0) => {
    const indent = "  ".repeat(depth);
    if (filter.type === 'comparison') {
      return (
        <div className="ir-filter-block" key={filter.column + filter.operator + filter.value + depth}>
          <div className="ir-filter-row"><span className="ir-key">{indent}COLUMN</span><span className="ir-val">{filter.column}</span></div>
          <div className="ir-filter-row"><span className="ir-key">{indent}OPERATOR</span><span className="ir-val operator">{filter.operator}</span></div>
          <div className="ir-filter-row"><span className="ir-key">{indent}VALUE</span><span className={`ir-val ${filter.valueType}`}>{filter.value}</span></div>
        </div>
      );
    }
    if (filter.type === 'logical') {
      return (
        <div className="ir-filter-block" key={filter.operator + depth}>
          <div className="ir-filter-row"><span className="ir-key">{indent}LOGICAL</span><span className="ir-val operator">{filter.operator}</span></div>
          <div className="ir-filter-sub">
            {renderFilter(filter.left, depth + 1)}
            {renderFilter(filter.right, depth + 1)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section className="output-subpanel ir-panel">
      <div className="panel-tab-header">
        <div className="panel-tab-title">
          <Share2 size={15} className="panel-icon" />
          <span className="tab-name">Intermediate Representation</span>
        </div>
        
        {isSuccess && !isGenerating && (
          <div className="panel-tab-controls" style={{ marginLeft: '12px', display: 'flex', gap: '4px' }}>
            <button 
              className={`tab-btn ${viewMode === 'structured' ? 'active' : ''}`}
              onClick={() => setViewMode('structured')}
            >
              Structured View
            </button>
            <button 
              className={`tab-btn ${viewMode === 'json' ? 'active' : ''}`}
              onClick={() => setViewMode('json')}
            >
              JSON
            </button>
          </div>
        )}

        <div className="panel-tab-meta">
          {isSuccess && !isGenerating && (
            <span className="panel-badge count-badge">
              IR Nodes: {stats.nodes} | Filters: {stats.filters} | Columns: {stats.columns}
            </span>
          )}
          <span className={`panel-badge stage-badge ${hasErrors && !isGenerating ? 'error-badge' : isSuccess && !isGenerating ? 'success-badge' : ''}`}>
            {isGenerating ? 'Generating IR...' : isSuccess ? 'IR ✓' : hasErrors ? 'IR ⚠' : 'IR'}
          </span>
        </div>
      </div>

      <div className="panel-inner-content ir-panel-inner">
        {!hasResult ? (
          <div className="panel-placeholder-state">
            <div className="placeholder-icon-wrap">
              <Share2 size={28} className="placeholder-icon" />
            </div>
            <p className="placeholder-primary-text">Generate IR from semantically validated AST.</p>
            <p className="placeholder-secondary-text">
              The IR isolates relational algebra operations logically.
            </p>
          </div>
        ) : isGenerating ? (
          <div className="panel-placeholder-state">
            <Loader2 size={28} className="placeholder-icon spinning" />
            <p className="placeholder-primary-text">Building Intermediate Representation...</p>
          </div>
        ) : hasErrors ? (
          <div className="ir-results-area error-area">
            <div className="ir-error-header">IR Generation Error</div>
            {irResult.errors.map((err, i) => (
              <div key={i} className="ir-error-msg">{err}</div>
            ))}
          </div>
        ) : (
          <div className="ir-results-area">
            {viewMode === 'json' ? (
              <pre className="ir-json-view">{JSON.stringify(ir, null, 2)}</pre>
            ) : (
              <div className="ir-structured-view">
                <div className="ir-block">
                  <div className="ir-section-title">OPERATION</div>
                  <div className="ir-val operator indent">{ir?.operation || 'SELECT'}</div>
                </div>

                <div className="ir-block">
                  <div className="ir-section-title">TABLE</div>
                  <div className="ir-val table indent">{ir?.table || '—'}</div>
                </div>

                <div className="ir-block">
                  <div className="ir-section-title">COLUMNS</div>
                  <div className="ir-val column indent">
                    {ir?.projection 
                      ? (ir.projection.type === 'aggregate' 
                          ? `${ir.projection.function}(${ir.projection.column})` 
                          : ir.projection.column)
                      : Array.isArray(ir?.columns) 
                        ? ir.columns.join(', ') 
                        : (ir?.columns || '*')}
                  </div>
                </div>

                {(ir?.filter || (Array.isArray(ir?.filters) && ir.filters.length > 0)) && (
                  <div className="ir-block">
                    <div className="ir-section-title">FILTERS</div>
                    <div className="ir-filters-container">
                      {ir.filter ? renderFilter(ir.filter, 0) : ir.filters?.map((f) => renderFilter(f, 0))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
