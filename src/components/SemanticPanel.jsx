import React, { useState, useEffect } from 'react';
import { DatabaseZap, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import './SemanticPanel.css';

export default function SemanticPanel({ semanticResult, isASTComplete, onSemanticStatusChange }) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  const hasResult = semanticResult !== null;
  const isSuccess = hasResult && semanticResult.success;
  const hasErrors = hasResult && semanticResult.errors && semanticResult.errors.length > 0;
  const annotations = hasResult ? semanticResult.annotations : [];
  
  // Animation logic
  useEffect(() => {
    if (hasResult && isASTComplete) {
      setIsPlaying(true);
      setCurrentStep(0);
      onSemanticStatusChange?.('animating');
    } else {
      setIsPlaying(false);
      setCurrentStep(-1);
      if (!isASTComplete) {
        onSemanticStatusChange?.('idle');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanticResult, isASTComplete]);

  useEffect(() => {
    if (isPlaying && currentStep < annotations.length) {
      const timer = setTimeout(() => {
        setCurrentStep(s => s + 1);
      }, 400); // 400ms per step
      return () => clearTimeout(timer);
    } else if (isPlaying && currentStep >= annotations.length) {
      setIsPlaying(false);
      onSemanticStatusChange?.(isSuccess ? 'success' : 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentStep, annotations.length, isSuccess]);

  const visibleAnnotations = annotations.slice(0, currentStep >= 0 ? currentStep + 1 : 0);

  return (
    <section className="output-subpanel semantic-panel">
      <div className="panel-tab-header">
        <div className="panel-tab-title">
          <DatabaseZap size={15} className="panel-icon" />
          <span className="tab-name">Semantic Analysis</span>
        </div>
        <div className="panel-tab-meta">
          <span className={`panel-badge stage-badge ${hasErrors ? 'error-badge' : isSuccess ? 'success-badge' : ''}`}>
            {isSuccess ? 'Semantic ✓' : hasErrors ? 'Semantic ⚠' : 'Semantic'}
          </span>
        </div>
      </div>

      <div className="panel-inner-content semantic-panel-inner">
        {!hasResult ? (
          <div className="panel-placeholder-state">
            <div className="placeholder-icon-wrap">
              <DatabaseZap size={28} className="placeholder-icon" />
            </div>
            <p className="placeholder-primary-text">Generate an AST to perform semantic analysis.</p>
            <p className="placeholder-secondary-text">
              Validates schema tables, columns, data types, and logical operators.
            </p>
          </div>
        ) : (
          <div className="semantic-results-area">
            
            {/* Errors */}
            {hasErrors && currentStep >= annotations.length && (
              <div className="semantic-error-list">
                <div className="semantic-error-header">
                  <AlertCircle size={14} className="semantic-error-icon" />
                  <span>Semantic {semanticResult.errors.length === 1 ? 'Error' : 'Errors'} ({semanticResult.errors.length})</span>
                </div>
                {semanticResult.errors.map((err, i) => (
                  <div key={i} className="semantic-error-item">
                    <p className="semantic-error-msg">{err.message}</p>
                    {err.table && !err.column && (
                      <span className="semantic-err-detail">Table: <code>{err.table}</code></span>
                    )}
                    {err.column && (
                      <span className="semantic-err-detail">Column: <code>{err.column}</code></span>
                    )}
                    {err.operator && (
                      <span className="semantic-err-detail">Operator: <code>{err.operator}</code></span>
                    )}
                    {err.leftType && err.rightType && (
                      <div className="semantic-type-detail">
                        <span><code>{err.left}</code>: {err.leftType}</span>
                        <span><code>{err.right}</code>: {err.rightType}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Live Annotations */}
            <div className="semantic-annotations">
              {visibleAnnotations.map((ann, i) => {
                const isCheck = ann.message.startsWith('Checking');
                const isSuccessMsg = ann.message.startsWith('✓');
                
                return (
                  <div key={i} className={`semantic-annotation-row ${isCheck ? 'check-row' : isSuccessMsg ? 'success-row' : ''}`}>
                    {isCheck && <Loader2 size={12} className="spinning annotation-icon" />}
                    {isSuccessMsg && <CheckCircle2 size={12} className="success annotation-icon" />}
                    <span className="annotation-text">{ann.message}</span>
                  </div>
                );
              })}
              
              {/* If done but has errors, show failed final step */}
              {hasErrors && currentStep >= annotations.length && (
                <div className="semantic-annotation-row error-row">
                  <AlertCircle size={12} className="error annotation-icon" />
                  <span className="annotation-text">Semantic Analysis Failed</span>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </section>
  );
}
