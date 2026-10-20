import React from 'react';

// ─── Node colour map (keyed by CST node type) ─────────────────────────────────
const NODE_COLORS = {
  QUERY:              'parse-node-query',
  SHOW_QUERY:         'parse-node-show',
  ACTION:             'parse-node-action',
  SOURCE:             'parse-node-source',
  CONDITION_CLAUSE:   'parse-node-clause',
  COMPOUND_CONDITION: 'parse-node-compound',
  SIMPLE_CONDITION:   'parse-node-simple',
  COLUMN:             'parse-node-column',
  OPERATOR:           'parse-node-operator',
  VALUE:              'parse-node-value',
  LOGICAL_OP:         'parse-node-logical',

  // AST nodes mapped to CSS classes
  Program:            'parse-node-Program',
  Select:             'parse-node-Select',
  Table:              'parse-node-Table',
  Where:              'parse-node-Where',
  BinaryExpression:   'parse-node-BinaryExpression',
  LogicalExpression:  'parse-node-LogicalExpression',
  Column:             'parse-node-Column',
  Literal:            'parse-node-Literal',
};

export default function ParseTreeNode({ 
  node, 
  isVisible, 
  isActive, 
  isSelected, 
  onClick 
}) {
  if (!isVisible) return null;

  const { x, y, width, height, originalNode } = node;
  const { type, value } = originalNode;
  const colorClass = NODE_COLORS[type] || 'parse-node-default';

  return (
    <g 
      className={`parse-tree-node ${colorClass} ${isActive ? 'is-active' : ''} ${isSelected ? 'is-selected' : ''}`}
      transform={`translate(${x}, ${y})`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(node);
        }
      }}
    >
      <rect 
        className="node-bg"
        width={width} 
        height={height} 
        rx={6} 
      />
      
      {value !== null ? (
        <>
          <text 
            className="node-type-text with-value"
            x={width / 2} 
            y={height / 2 - 4} 
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {type}
          </text>
          <text 
            className="node-value-text"
            x={width / 2} 
            y={height / 2 + 10} 
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {value}
          </text>
        </>
      ) : (
        <text 
          className="node-type-text"
          x={width / 2} 
          y={height / 2} 
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          {type}
        </text>
      )}
    </g>
  );
}
