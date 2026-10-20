import React, { useState } from 'react';
import {
  Database,
  Table2,
  KeyRound,
  Link2,
  Plus,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import './SchemaManagerModal.css';

const SUPPORTED_TYPES = [
  'INTEGER',
  'BIGINT',
  'DECIMAL',
  'REAL',
  'VARCHAR(100)',
  'VARCHAR(50)',
  'VARCHAR(20)',
  'TEXT',
  'BOOLEAN',
  'DATE',
  'TIMESTAMP',
];

export default function SchemaManagerModal({
  isOpen,
  onClose,
  schema,
  onRefresh,
}) {
  const [activeTab, setActiveTab] = useState('explorer'); // 'explorer' | 'createTable' | 'addColumn' | 'addFk'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // ── Form State: Create Table ────────────────────────────────────────────────
  const [newTableName, setNewTableName] = useState('');
  const [newTableColumns, setNewTableColumns] = useState([
    { name: 'id', type: 'INTEGER', isPrimary: true, nullable: false },
    { name: 'name', type: 'VARCHAR(100)', isPrimary: false, nullable: false },
  ]);

  // ── Form State: Add Column ──────────────────────────────────────────────────
  const [selectedTableForCol, setSelectedTableForCol] = useState('');
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('VARCHAR(100)');
  const [newColNullable, setNewColNullable] = useState(true);
  const [newColPrimary, setNewColPrimary] = useState(false);

  // ── Form State: Add Foreign Key ─────────────────────────────────────────────
  const [fkSourceTable, setFkSourceTable] = useState('');
  const [fkSourceCol, setFkSourceCol] = useState('');
  const [fkTargetTable, setFkTargetTable] = useState('');
  const [fkTargetCol, setFkTargetCol] = useState('');

  if (!isOpen) return null;

  const tables = schema?.tables || [];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await onRefresh();
      setSuccessMessage('Schema successfully reloaded from PostgreSQL.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to refresh schema.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // ── Handlers: Create Table ──────────────────────────────────────────────────
  const handleAddColumnRow = () => {
    setNewTableColumns(prev => [
      ...prev,
      { name: '', type: 'VARCHAR(100)', isPrimary: false, nullable: true },
    ]);
  };

  const handleRemoveColumnRow = index => {
    if (newTableColumns.length <= 1) return;
    setNewTableColumns(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleColumnRowChange = (index, field, value) => {
    setNewTableColumns(prev =>
      prev.map((col, idx) => (idx === index ? { ...col, [field]: value } : col))
    );
  };

  const handleCreateTableSubmit = async e => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!newTableName.trim()) {
      setErrorMessage('Table name is required.');
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newTableName.trim())) {
      setErrorMessage('Table name must start with a letter/underscore and contain only alphanumeric characters.');
      return;
    }

    for (const c of newTableColumns) {
      if (!c.name.trim()) {
        setErrorMessage('All columns must have a valid name.');
        return;
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c.name.trim())) {
        setErrorMessage(`Invalid column identifier "${c.name}".`);
        return;
      }
    }

    try {
      const res = await fetch('http://localhost:3001/api/schema/table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableName: newTableName.trim(),
          columns: newTableColumns.map(c => ({
            name: c.name.trim(),
            type: c.type,
            isPrimary: c.isPrimary,
            nullable: c.nullable,
          })),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to create table.');
      }

      setSuccessMessage(`Table "${newTableName.trim()}" created successfully!`);
      setNewTableName('');
      setNewTableColumns([
        { name: 'id', type: 'INTEGER', isPrimary: true, nullable: false },
        { name: 'name', type: 'VARCHAR(100)', isPrimary: false, nullable: false },
      ]);
      await onRefresh();
      setActiveTab('explorer');
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // ── Handlers: Add Column ────────────────────────────────────────────────────
  const handleAddColumnSubmit = async e => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const targetTable = selectedTableForCol || tables[0]?.name;
    if (!targetTable) {
      setErrorMessage('Please select a target table.');
      return;
    }
    if (!newColName.trim()) {
      setErrorMessage('Column name is required.');
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newColName.trim())) {
      setErrorMessage('Column name must start with a letter/underscore.');
      return;
    }

    try {
      const res = await fetch('http://localhost:3001/api/schema/column', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableName: targetTable,
          column: {
            name: newColName.trim(),
            type: newColType,
            nullable: newColNullable,
            isPrimary: newColPrimary,
          },
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to add column.');
      }

      setSuccessMessage(`Column "${newColName.trim()}" added to "${targetTable}" successfully!`);
      setNewColName('');
      await onRefresh();
      setActiveTab('explorer');
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  // ── Handlers: Add Foreign Key ───────────────────────────────────────────────
  const sourceTableDef = tables.find(t => t.name === (fkSourceTable || tables[0]?.name));
  const targetTableDef = tables.find(t => t.name === (fkTargetTable || tables[1]?.name || tables[0]?.name));

  const handleAddFkSubmit = async e => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const srcT = fkSourceTable || tables[0]?.name;
    const tgtT = fkTargetTable || tables[1]?.name || tables[0]?.name;
    const srcC = fkSourceCol || sourceTableDef?.columns[0]?.name;
    const tgtC = fkTargetCol || targetTableDef?.columns[0]?.name;

    if (!srcT || !tgtT || !srcC || !tgtC) {
      setErrorMessage('Please specify source and referenced tables and columns.');
      return;
    }

    try {
      const res = await fetch('http://localhost:3001/api/schema/foreign-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTable: srcT,
          sourceColumn: srcC,
          targetTable: tgtT,
          targetColumn: tgtC,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to create foreign key constraint.');
      }

      setSuccessMessage(data.message || `Foreign key constraint created: ${srcT}.${srcC} → ${tgtT}.${tgtC}`);
      await onRefresh();
      setActiveTab('explorer');
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  return (
    <div className="schema-modal-overlay" role="dialog" aria-modal="true">
      <div className="schema-modal-container">
        {/* ── Modal Header ────────────────────────────────────────────── */}
        <div className="schema-modal-header">
          <div className="schema-modal-title-group">
            <div className="schema-modal-icon-badge">
              <Database size={20} />
            </div>
            <div>
              <h2 className="schema-modal-title">Database Schema Manager</h2>
              <p className="schema-modal-subtitle">
                PostgreSQL schema introspection, table definitions, columns & foreign keys
              </p>
            </div>
          </div>

          <div className="schema-modal-header-actions">
            <button
              type="button"
              className="schema-btn schema-btn-secondary"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh Schema from PostgreSQL"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spinning' : ''} />
              <span>{isRefreshing ? 'Refreshing…' : 'Refresh Schema'}</span>
            </button>
            <button
              type="button"
              className="schema-modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Notifications ───────────────────────────────────────────── */}
        {errorMessage && (
          <div className="schema-alert schema-alert-error" role="alert">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="schema-alert schema-alert-success" role="status">
            <CheckCircle2 size={15} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ── Navigation Tabs ─────────────────────────────────────────── */}
        <div className="schema-tabs-bar">
          <button
            type="button"
            className={`schema-tab-btn ${activeTab === 'explorer' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('explorer');
              setErrorMessage('');
            }}
          >
            <Layers size={14} />
            <span>Schema Explorer</span>
            <span className="schema-pill-count">{tables.length}</span>
          </button>
          <button
            type="button"
            className={`schema-tab-btn ${activeTab === 'createTable' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('createTable');
              setErrorMessage('');
            }}
          >
            <Table2 size={14} />
            <span>Create Table</span>
          </button>
          <button
            type="button"
            className={`schema-tab-btn ${activeTab === 'addColumn' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('addColumn');
              setErrorMessage('');
            }}
          >
            <Plus size={14} />
            <span>Add Column</span>
          </button>
          <button
            type="button"
            className={`schema-tab-btn ${activeTab === 'addFk' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('addFk');
              setErrorMessage('');
            }}
          >
            <Link2 size={14} />
            <span>Add Foreign Key</span>
          </button>
        </div>

        {/* ── Tab Content ─────────────────────────────────────────────── */}
        <div className="schema-tab-content">
          {/* TAB 1: Schema Explorer */}
          {activeTab === 'explorer' && (
            <div className="schema-explorer-view">
              {tables.length === 0 ? (
                <div className="schema-empty-state">
                  <Database size={32} />
                  <p>No tables detected in PostgreSQL public schema.</p>
                </div>
              ) : (
                <div className="schema-tables-grid">
                  {tables.map(table => (
                    <div key={table.name} className="schema-table-card">
                      <div className="schema-table-card-header">
                        <div className="schema-table-card-title">
                          <Table2 size={16} className="text-primary" />
                          <span className="schema-table-name">{table.name}</span>
                        </div>
                        <span className="schema-row-badge">{table.rowCount} rows</span>
                      </div>

                      <div className="schema-cols-table-wrapper">
                        <table className="schema-cols-table">
                          <thead>
                            <tr>
                              <th>Column</th>
                              <th>Type</th>
                              <th>Key</th>
                              <th>Nullable</th>
                            </tr>
                          </thead>
                          <tbody>
                            {table.columns.map(col => (
                              <tr key={col.name}>
                                <td className="schema-col-name-cell">
                                  {col.isPrimary ? (
                                    <KeyRound size={12} className="col-key-primary" />
                                  ) : (
                                    <span className="schema-col-bullet" />
                                  )}
                                  <span className={col.isPrimary ? 'primary-font' : ''}>
                                    {col.name}
                                  </span>
                                </td>
                                <td>
                                  <span className="schema-type-pill">{col.type}</span>
                                </td>
                                <td>
                                  {col.isPrimary ? (
                                    <span className="schema-pk-badge">PK</span>
                                  ) : (
                                    <span className="schema-muted-text">-</span>
                                  )}
                                </td>
                                <td>
                                  <span className="schema-muted-text">
                                    {col.nullable ? 'YES' : 'NO'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Foreign Keys section */}
                      {table.foreignKeys && table.foreignKeys.length > 0 && (
                        <div className="schema-fk-footer">
                          <span className="schema-fk-title">Foreign Keys:</span>
                          <div className="schema-fk-tags">
                            {table.foreignKeys.map((fk, idx) => (
                              <div key={idx} className="schema-fk-tag">
                                <Link2 size={11} />
                                <span>
                                  {fk.column} <ArrowRight size={10} /> {fk.referencedTable}.{fk.referencedColumn}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Create Table Form */}
          {activeTab === 'createTable' && (
            <form onSubmit={handleCreateTableSubmit} className="schema-form">
              <div className="schema-form-section">
                <label className="schema-form-label" htmlFor="new-table-name">
                  Table Name <span className="schema-required">*</span>
                </label>
                <input
                  id="new-table-name"
                  type="text"
                  className="schema-input"
                  placeholder="e.g. departments, enrollments, grades"
                  value={newTableName}
                  onChange={e => setNewTableName(e.target.value)}
                  required
                />
              </div>

              <div className="schema-form-section">
                <div className="schema-cols-header-row">
                  <label className="schema-form-label">
                    Columns Definition <span className="schema-required">*</span>
                  </label>
                  <button
                    type="button"
                    className="schema-btn schema-btn-sm"
                    onClick={handleAddColumnRow}
                  >
                    <Plus size={13} />
                    <span>Add Column</span>
                  </button>
                </div>

                <div className="schema-cols-form-list">
                  {newTableColumns.map((col, idx) => (
                    <div key={idx} className="schema-col-form-row">
                      <input
                        type="text"
                        className="schema-input schema-input-sm"
                        placeholder="Column name"
                        value={col.name}
                        onChange={e => handleColumnRowChange(idx, 'name', e.target.value)}
                        required
                      />

                      <select
                        className="schema-select schema-select-sm"
                        value={col.type}
                        onChange={e => handleColumnRowChange(idx, 'type', e.target.value)}
                      >
                        {SUPPORTED_TYPES.map(t => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>

                      <label className="schema-checkbox-label">
                        <input
                          type="checkbox"
                          checked={col.isPrimary}
                          onChange={e =>
                            handleColumnRowChange(idx, 'isPrimary', e.target.checked)
                          }
                        />
                        <span>Primary Key</span>
                      </label>

                      <label className="schema-checkbox-label">
                        <input
                          type="checkbox"
                          checked={col.nullable}
                          onChange={e =>
                            handleColumnRowChange(idx, 'nullable', e.target.checked)
                          }
                        />
                        <span>Nullable</span>
                      </label>

                      <button
                        type="button"
                        className="schema-icon-btn schema-danger-btn"
                        onClick={() => handleRemoveColumnRow(idx)}
                        disabled={newTableColumns.length <= 1}
                        title="Remove column"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="schema-form-actions">
                <button
                  type="button"
                  className="schema-btn schema-btn-secondary"
                  onClick={() => setActiveTab('explorer')}
                >
                  Cancel
                </button>
                <button type="submit" className="schema-btn schema-btn-primary">
                  <Table2 size={14} />
                  <span>Create Table</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Add Column to Existing Table */}
          {activeTab === 'addColumn' && (
            <form onSubmit={handleAddColumnSubmit} className="schema-form">
              <div className="schema-form-section">
                <label className="schema-form-label" htmlFor="target-table-select">
                  Select Table <span className="schema-required">*</span>
                </label>
                <select
                  id="target-table-select"
                  className="schema-select"
                  value={selectedTableForCol || tables[0]?.name || ''}
                  onChange={e => setSelectedTableForCol(e.target.value)}
                  required
                >
                  {tables.map(t => (
                    <option key={t.name} value={t.name}>
                      {t.name} ({t.columns.length} columns)
                    </option>
                  ))}
                </select>
              </div>

              <div className="schema-form-grid-2">
                <div className="schema-form-section">
                  <label className="schema-form-label" htmlFor="new-col-name">
                    Column Name <span className="schema-required">*</span>
                  </label>
                  <input
                    id="new-col-name"
                    type="text"
                    className="schema-input"
                    placeholder="e.g. email, phone, faculty_id"
                    value={newColName}
                    onChange={e => setNewColName(e.target.value)}
                    required
                  />
                </div>

                <div className="schema-form-section">
                  <label className="schema-form-label" htmlFor="new-col-type">
                    Data Type <span className="schema-required">*</span>
                  </label>
                  <select
                    id="new-col-type"
                    className="schema-select"
                    value={newColType}
                    onChange={e => setNewColType(e.target.value)}
                  >
                    {SUPPORTED_TYPES.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="schema-form-checkboxes">
                <label className="schema-checkbox-label">
                  <input
                    type="checkbox"
                    checked={newColNullable}
                    onChange={e => setNewColNullable(e.target.checked)}
                  />
                  <span>Nullable (Allow NULL values)</span>
                </label>

                <label className="schema-checkbox-label">
                  <input
                    type="checkbox"
                    checked={newColPrimary}
                    onChange={e => setNewColPrimary(e.target.checked)}
                  />
                  <span>Designate as Primary Key</span>
                </label>
              </div>

              <div className="schema-form-actions">
                <button
                  type="button"
                  className="schema-btn schema-btn-secondary"
                  onClick={() => setActiveTab('explorer')}
                >
                  Cancel
                </button>
                <button type="submit" className="schema-btn schema-btn-primary">
                  <Plus size={14} />
                  <span>Add Column</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: Add Foreign Key Constraint */}
          {activeTab === 'addFk' && (
            <form onSubmit={handleAddFkSubmit} className="schema-form">
              <div className="schema-fk-diagram-card">
                <div className="schema-fk-diagram-col">
                  <span className="diagram-label">SOURCE TABLE & COLUMN</span>
                  <div className="diagram-pill">
                    {fkSourceTable || tables[0]?.name || 'source'}.{fkSourceCol || sourceTableDef?.columns[0]?.name || 'col'}
                  </div>
                </div>
                <div className="schema-fk-arrow">
                  <ArrowRight size={18} />
                </div>
                <div className="schema-fk-diagram-col">
                  <span className="diagram-label">REFERENCED (TARGET) TABLE & PK</span>
                  <div className="diagram-pill target">
                    {fkTargetTable || tables[1]?.name || tables[0]?.name || 'target'}.{fkTargetCol || targetTableDef?.columns[0]?.name || 'col'}
                  </div>
                </div>
              </div>

              <div className="schema-form-grid-2">
                <div className="schema-form-section">
                  <label className="schema-form-label" htmlFor="fk-src-table">
                    Source Table <span className="schema-required">*</span>
                  </label>
                  <select
                    id="fk-src-table"
                    className="schema-select"
                    value={fkSourceTable || tables[0]?.name || ''}
                    onChange={e => {
                      setFkSourceTable(e.target.value);
                      const t = tables.find(x => x.name === e.target.value);
                      if (t && t.columns.length > 0) setFkSourceCol(t.columns[0].name);
                    }}
                  >
                    {tables.map(t => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="schema-form-section">
                  <label className="schema-form-label" htmlFor="fk-src-col">
                    Source Column <span className="schema-required">*</span>
                  </label>
                  <select
                    id="fk-src-col"
                    className="schema-select"
                    value={fkSourceCol || sourceTableDef?.columns[0]?.name || ''}
                    onChange={e => setFkSourceCol(e.target.value)}
                  >
                    {(sourceTableDef?.columns || []).map(c => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="schema-form-grid-2">
                <div className="schema-form-section">
                  <label className="schema-form-label" htmlFor="fk-tgt-table">
                    Referenced (Target) Table <span className="schema-required">*</span>
                  </label>
                  <select
                    id="fk-tgt-table"
                    className="schema-select"
                    value={fkTargetTable || tables[1]?.name || tables[0]?.name || ''}
                    onChange={e => {
                      setFkTargetTable(e.target.value);
                      const t = tables.find(x => x.name === e.target.value);
                      const pk = t?.columns.find(c => c.isPrimary) || t?.columns[0];
                      if (pk) setFkTargetCol(pk.name);
                    }}
                  >
                    {tables.map(t => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="schema-form-section">
                  <label className="schema-form-label" htmlFor="fk-tgt-col">
                    Referenced Column (Primary Key) <span className="schema-required">*</span>
                  </label>
                  <select
                    id="fk-tgt-col"
                    className="schema-select"
                    value={fkTargetCol || targetTableDef?.columns.find(c => c.isPrimary)?.name || targetTableDef?.columns[0]?.name || ''}
                    onChange={e => setFkTargetCol(e.target.value)}
                  >
                    {(targetTableDef?.columns || []).map(c => (
                      <option key={c.name} value={c.name}>
                        {c.name} {c.isPrimary ? '🔑 (Primary Key)' : `(${c.type})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="schema-form-actions">
                <button
                  type="button"
                  className="schema-btn schema-btn-secondary"
                  onClick={() => setActiveTab('explorer')}
                >
                  Cancel
                </button>
                <button type="submit" className="schema-btn schema-btn-primary">
                  <Link2 size={14} />
                  <span>Add Foreign Key</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
