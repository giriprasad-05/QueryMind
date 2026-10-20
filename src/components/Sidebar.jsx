import React, { useState } from 'react';
import { 
  Database, 
  ChevronRight, 
  ChevronDown, 
  Table2, 
  KeyRound, 
  ChevronsUpDown, 
  Layers,
  Search,
  RefreshCw,
  PlusCircle,
  Link2
} from 'lucide-react';
import { DATABASE_SCHEMA } from '../data/schema';

export default function Sidebar({
  schema = DATABASE_SCHEMA,
  onOpenSchemaManager,
  onRefreshSchema,
}) {
  const currentSchema = schema || DATABASE_SCHEMA;
  const tables = currentSchema.tables || [];

  // All tables expanded by default
  const [expandedTables, setExpandedTables] = useState({
    students: true,
    courses: true,
    faculty: true
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const toggleTable = (tableId) => {
    setExpandedTables(prev => ({
      ...prev,
      [tableId]: !prev[tableId]
    }));
  };

  const toggleAll = () => {
    const allExpanded = Object.values(expandedTables).every(Boolean);
    const newState = {};
    tables.forEach(table => {
      const id = table.id || table.name;
      newState[id] = !allExpanded;
    });
    setExpandedTables(newState);
  };

  const handleRefreshClick = async () => {
    if (onRefreshSchema) {
      setIsRefreshing(true);
      try {
        await onRefreshSchema();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  const filteredTables = tables.map(table => {
    if (!searchTerm.trim()) return table;
    const lower = searchTerm.toLowerCase();
    const tableMatches = table.name.toLowerCase().includes(lower);
    const matchingCols = (table.columns || []).filter(col => 
      col.name.toLowerCase().includes(lower) || col.type.toLowerCase().includes(lower)
    );
    if (tableMatches) return table;
    if (matchingCols.length > 0) {
      return { ...table, columns: matchingCols };
    }
    return null;
  }).filter(Boolean);

  const areAllExpanded = Object.values(expandedTables).every(Boolean);

  return (
    <aside className="sidebar" id="querymind-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title-wrapper">
          <Database size={15} className="sidebar-icon" />
          <h2 className="sidebar-title">DATABASE</h2>
        </div>
        <div className="sidebar-actions">
          {onOpenSchemaManager && (
            <button 
              type="button" 
              className="sidebar-action-btn" 
              onClick={onOpenSchemaManager}
              title="Open Schema Manager"
              aria-label="Open Schema Manager"
            >
              <PlusCircle size={14} />
            </button>
          )}
          {onRefreshSchema && (
            <button 
              type="button" 
              className="sidebar-action-btn" 
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              title="Refresh Schema from PostgreSQL"
              aria-label="Refresh Schema"
            >
              <RefreshCw size={13} className={isRefreshing ? 'spinning' : ''} />
            </button>
          )}
          <button 
            type="button" 
            className="sidebar-action-btn" 
            onClick={toggleAll}
            title={areAllExpanded ? "Collapse All Tables" : "Expand All Tables"}
            aria-label="Toggle all tables"
          >
            <ChevronsUpDown size={14} />
          </button>
        </div>
      </div>

      <div className="sidebar-meta-bar">
        <span className="sidebar-schema-name">{currentSchema.name || 'university_db'}</span>
        <span className="sidebar-table-count">{tables.length} tables</span>
      </div>

      <div className="sidebar-search">
        <Search size={13} className="search-icon" />
        <input 
          type="text" 
          placeholder="Filter tables or columns..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="sidebar-search-input"
        />
        {searchTerm && (
          <button 
            className="clear-search-btn" 
            onClick={() => setSearchTerm('')}
            type="button"
          >
            ×
          </button>
        )}
      </div>

      <div className="sidebar-content">
        <div className="table-tree">
          {filteredTables.length === 0 ? (
            <div className="no-tables-match">No schema items match &quot;{searchTerm}&quot;</div>
          ) : (
            filteredTables.map((table) => {
              const tableKey = table.id || table.name;
              const isExpanded = expandedTables[tableKey] ?? true;
              return (
                <div key={tableKey} className="table-node">
                  <button 
                    type="button"
                    className="table-header-btn" 
                    onClick={() => toggleTable(tableKey)}
                    aria-expanded={isExpanded}
                  >
                    <span className="table-chevron">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <Table2 size={14} className="table-icon" />
                    <span className="table-name">{table.name}</span>
                    <span className="col-count-pill">{table.columns?.length || 0}</span>
                  </button>

                  {isExpanded && (
                    <div className="columns-list">
                      {(table.columns || []).map((col) => {
                        const isFk = (table.foreignKeys || []).some(
                          fk => fk.column === col.name
                        );
                        return (
                          <div key={col.name} className="column-item">
                            <div className="column-left">
                              {col.isPrimary ? (
                                <KeyRound size={12} className="col-key-icon primary" title="Primary Key" />
                              ) : isFk ? (
                                <Link2 size={11} className="col-key-icon" style={{ color: '#818cf8' }} title="Foreign Key" />
                              ) : (
                                <span className="col-bullet"></span>
                              )}
                              <span className={`column-name ${col.isPrimary ? 'primary-col' : ''}`}>
                                {col.name}
                              </span>
                            </div>
                            <span className="column-type">{col.type}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="footer-info-row">
          <Layers size={13} className="footer-icon" />
          <span className="footer-text">Target: PostgreSQL Live</span>
        </div>
        <div className="footer-status-pill" style={{ cursor: onOpenSchemaManager ? 'pointer' : 'default' }} onClick={onOpenSchemaManager}>
          <span className="footer-dot"></span>
          <span>Schema Manager</span>
        </div>
      </div>
    </aside>
  );
}
