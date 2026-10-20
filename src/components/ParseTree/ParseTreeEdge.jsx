import React from 'react';

export default function ParseTreeEdge({ edge, isVisible }) {
  if (!isVisible) return null;

  const { x1, y1, x2, y2 } = edge;

  // Draw a smooth bezier curve between nodes
  const midY = (y1 + y2) / 2;
  const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

  return (
    <g className="parse-tree-edge">
      <path 
        className="edge-path-bg"
        d={d}
        fill="none" 
      />
      <path 
        className="edge-path"
        d={d}
        fill="none" 
      />
    </g>
  );
}
