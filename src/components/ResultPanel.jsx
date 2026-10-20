import React from 'react';
import { LayoutGrid, AlertCircle, Loader2 } from 'lucide-react';
import './ResultPanel.css';

export default function ResultPanel({ dbResult, isExecuting }) {
  if (!dbResult && !isExecuting) return null;

  const hasResult = dbResult !== null;
  const isSuccess = hasResult && dbResult.success;
  const hasErrors = hasResult && dbResult.error;

  const rows = isSuccess && dbResult?.data?.rows ? dbResult.data.rows : [];
  const rowCount = isSuccess && dbResult?.data ? (dbResult.data.rowCount ?? rows.length) : 0;
  const executionTimeMs = isSuccess && dbResult?.data ? (dbResult.data.executionTimeMs ?? 0) : 0;
  
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <section className="output-subpanel result-panel">
      <div className="panel-tab-header">
        <div className="panel-tab-title">
          <LayoutGrid size={15} className="panel-icon" />
          <span className="tab-name">Query Result</span>
        </div>
        
        <div className="panel-tab-meta">
          {isSuccess && (
            <span className="panel-badge count-badge">
              {rowCount} rows returned · {executionTimeMs} ms
            </span>
          )}
        </div>
      </div>

      <div className="panel-inner-content result-panel-inner">
        {isExecuting ? (
          <div className="panel-placeholder-state">
            <Loader2 size={28} className="placeholder-icon spinning" />
            <p className="placeholder-primary-text">Executing query...</p>
          </div>
        ) : hasErrors ? (
          <div className="result-error-area">
            <div className="result-error-header">
              <AlertCircle size={14} className="error-icon" />
              <span>Database Error</span>
            </div>
            <div className="result-error-msg">{dbResult.error.message}</div>
          </div>
        ) : isSuccess && rowCount === 0 ? (
          <div className="panel-placeholder-state">
            <p className="placeholder-primary-text">✓ Query executed successfully</p>
            <p className="placeholder-secondary-text">0 rows returned</p>
          </div>
        ) : isSuccess ? (
          <div className="result-table-container">
            <table className="result-table">
              <thead>
                <tr>
                  {columns.map((col, idx) => (
                    <th key={idx}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {columns.map((col, colIndex) => {
                      const val = row[col];
                      const isNumber = typeof val === 'number';
                      return (
                        <td key={colIndex} className={isNumber ? 'numeric' : ''}>
                          {val === null ? <span className="null-val">NULL</span> : val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
