import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Play, RotateCcw, Maximize, ZoomIn, ZoomOut, Info, Loader2 } from 'lucide-react';
import { calculateLayout } from './treeLayout';
import ParseTreeNode from './ParseTreeNode';
import ParseTreeEdge from './ParseTreeEdge';
import './ParseTree.css';

export default function ParseTree({ tree, onStatusChange }) {
  // ─── Layout Configuration ───────────────────────────────────────────────
  const NODE_WIDTH = 110;
  const NODE_HEIGHT = 46;

  // ─── State ─────────────────────────────────────────────────────────────
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  
  // Viewport/Zoom state
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const svgRef = useRef(null);

  // ─── Data Preparation ──────────────────────────────────────────────────
  const layout = useMemo(() => {
    if (!tree) return null;
    const l = calculateLayout(tree, {
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
      siblingSpacing: 30,
      levelSpacing: 50,
      padding: 40,
    });

    // Decorate nodes and edges with animation frames
    // Nodes appear at frame = depth * 2
    l.nodes.forEach(n => { n.animFrame = n.depth * 2; });
    
    // Edges appear at frame = sourceDepth * 2 + 1
    l.edges.forEach(e => {
      const sourceNode = l.nodes.find(n => n.id === e.sourceId);
      e.animFrame = sourceNode ? sourceNode.depth * 2 + 1 : 0;
    });

    return l;
  }, [tree]);

  const maxFrame = layout ? Math.max(
    ...layout.nodes.map(n => n.animFrame),
    ...layout.edges.map(e => e.animFrame)
  ) : 0;

  // ─── Animation Loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (!layout) return;

    if (isPlaying && currentFrame <= maxFrame) {
      const timer = setTimeout(() => {
        setCurrentFrame(f => f + 1);
      }, 300); // 300ms per frame
      return () => clearTimeout(timer);
    } else if (currentFrame > maxFrame && isPlaying) {
      setIsPlaying(false);
    }
  }, [currentFrame, isPlaying, maxFrame, layout]);

  // Report status upward
  useEffect(() => {
    if (!layout) {
      onStatusChange?.('idle', 0, 0);
      return;
    }
    
    if (currentFrame === 0 && !isPlaying) {
      onStatusChange?.('ready', 0, layout.nodes.length);
    } else if (currentFrame <= maxFrame) {
      const visibleNodes = layout.nodes.filter(n => n.animFrame <= currentFrame).length;
      onStatusChange?.('animating', visibleNodes, layout.nodes.length);
    } else {
      onStatusChange?.('complete', layout.nodes.length, layout.nodes.length);
    }
  }, [currentFrame, isPlaying, maxFrame, layout, onStatusChange]);

  // ─── Controls ──────────────────────────────────────────────────────────
  const handleReplay = () => {
    setCurrentFrame(0);
    setIsPlaying(true);
    setSelectedNode(null);
  };

  const handleFitTree = () => {
    if (!layout || !svgRef.current) return;
    const containerWidth = svgRef.current.clientWidth;
    const containerHeight = svgRef.current.clientHeight;
    
    // Calculate scale to fit width and height with some padding
    const scaleX = (containerWidth - 40) / layout.width;
    const scaleY = (containerHeight - 40) / layout.height;
    const newScale = Math.min(scaleX, scaleY, 1); // Cap at 1 (no upscaling)
    
    setScale(newScale);
    
    // Center it
    const scaledWidth = layout.width * newScale;
    const scaledHeight = layout.height * newScale;
    setPan({
      x: (containerWidth - scaledWidth) / 2,
      y: (containerHeight - scaledHeight) / 2
    });
  };

  // Fit tree initially
  useEffect(() => {
    if (layout && svgRef.current && currentFrame === 0) {
      // Slight delay to ensure DOM is ready
      setTimeout(handleFitTree, 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // ─── Pan & Zoom Handlers ───────────────────────────────────────────────
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newScale = Math.min(Math.max(0.2, scale * (1 + delta)), 2);
    setScale(newScale);
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Attach non-passive wheel listener for zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (svg) {
      svg.addEventListener('wheel', handleWheel, { passive: false });
      return () => svg.removeEventListener('wheel', handleWheel);
    }
  });

  // ─── Render ────────────────────────────────────────────────────────────
  if (!layout) return null;

  return (
    <div className="parse-tree-wrapper">
      
      {/* Viewport */}
      <div 
        className="parse-tree-viewport"
        ref={svgRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <svg 
          width="100%" 
          height="100%" 
          className="parse-tree-svg"
          onClick={() => setSelectedNode(null)}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {/* Draw Edges */}
            {layout.edges.map(edge => {
              const isVisible = edge.animFrame <= currentFrame;
              return (
                <ParseTreeEdge 
                  key={edge.id} 
                  edge={edge} 
                  isVisible={isVisible} 
                />
              );
            })}

            {/* Draw Nodes */}
            {layout.nodes.map(node => {
              const isVisible = node.animFrame <= currentFrame;
              // Node is "active" (glowing) if it's the exact current frame being animated
              const isActive = isPlaying && node.animFrame === currentFrame;
              const isSelected = selectedNode && selectedNode.id === node.id;
              
              // We need to inject node width/height because layout creates x/y but expects components to know size
              const nodeWithDims = { ...node, width: NODE_WIDTH, height: NODE_HEIGHT };

              return (
                <ParseTreeNode 
                  key={node.id} 
                  node={nodeWithDims}
                  isVisible={isVisible}
                  isActive={isActive}
                  isSelected={isSelected}
                  onClick={(n) => setSelectedNode(n)}
                />
              );
            })}
          </g>
        </svg>

        {/* Selected Node Details Panel */}
        {selectedNode && (
          <div className="node-details-panel">
            <div className="details-header">
              <Info size={14} />
              <span>Node Details</span>
            </div>
            <div className="details-body">
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span className="detail-val type-val">{selectedNode.originalNode.type}</span>
              </div>
              {selectedNode.originalNode.value !== null && selectedNode.originalNode.value !== undefined && (
                <div className="detail-row">
                  <span className="detail-label">Value:</span>
                  <span className="detail-val value-val">{selectedNode.originalNode.value}</span>
                </div>
              )}
              {selectedNode.originalNode.dataType && (
                <div className="detail-row">
                  <span className="detail-label">Data Type:</span>
                  <span className="detail-val token-val">{selectedNode.originalNode.dataType}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Children:</span>
                <span className="detail-val">{selectedNode.originalNode.children.length}</span>
              </div>
              {selectedNode.originalNode.token && (
                <div className="detail-row">
                  <span className="detail-label">Source Token:</span>
                  <span className="detail-val token-val">
                    {selectedNode.originalNode.token.lexeme} 
                    <span className="pos-hint">@{selectedNode.originalNode.token.position}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="parse-tree-toolbar">
        <div className="toolbar-group">
          {isPlaying ? (
            <button className="tool-btn active-btn" onClick={() => setIsPlaying(false)} title="Pause Animation">
              <Loader2 size={14} className="spinning" />
              <span>Building...</span>
            </button>
          ) : currentFrame > maxFrame ? (
            <button className="tool-btn" onClick={handleReplay} title="Replay Animation">
              <RotateCcw size={14} />
              <span>Replay</span>
            </button>
          ) : (
            <button className="tool-btn" onClick={() => setIsPlaying(true)} title="Resume Animation">
              <Play size={14} />
              <span>Resume</span>
            </button>
          )}
        </div>
        
        <div className="toolbar-divider" />
        
        <div className="toolbar-group">
          <button className="tool-btn icon-only" onClick={() => setScale(s => Math.min(2, s + 0.2))} title="Zoom In">
            <ZoomIn size={14} />
          </button>
          <button className="tool-btn icon-only" onClick={() => setScale(s => Math.max(0.2, s - 0.2))} title="Zoom Out">
            <ZoomOut size={14} />
          </button>
          <button className="tool-btn" onClick={handleFitTree} title="Fit Tree to View">
            <Maximize size={14} />
            <span>Fit Tree</span>
          </button>
        </div>
      </div>
    </div>
  );
}

