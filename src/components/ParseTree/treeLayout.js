/**
 * QueryMind Compiler — Parse Tree Layout
 * Phase 6: Parse Tree Visualization
 *
 * Computes a simple top-down hierarchical layout for the Concrete Syntax Tree.
 * Returns an array of node coordinates and an array of edge coordinates.
 */

// Simple ID generator for nodes
let nextId = 1;
function generateId() {
  return `node_${nextId++}`;
}

/**
 * Transforms the CST into a flattened list of nodes and edges with (x, y) coordinates.
 *
 * @param {Object} treeRoot - The root of the parser's CST
 * @param {Object} options - Layout configuration
 * @returns {{ nodes: Object[], edges: Object[], width: number, height: number }}
 */
export function calculateLayout(treeRoot, options = {}) {
  const {
    nodeWidth = 120,
    nodeHeight = 50,
    siblingSpacing = 40,
    levelSpacing = 60,
    padding = 40
  } = options;

  if (!treeRoot) return { nodes: [], edges: [], width: 0, height: 0 };

  const nodes = [];
  const edges = [];
  nextId = 1;

  // Pass 1: Build a tree with IDs and calculate depth
  function buildInternalTree(node, depth = 0) {
    const internalNode = {
      id: generateId(),
      originalNode: node,
      depth,
      children: [],
      x: 0,
      y: depth * (nodeHeight + levelSpacing),
      width: 0, // subtree width
    };

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        internalNode.children.push(buildInternalTree(child, depth + 1));
      }
    }

    return internalNode;
  }

  const rootInternal = buildInternalTree(treeRoot, 0);

  // Pass 2: Calculate subtree widths and X positions (post-order traversal)
  let currentLeafX = 0;

  function calculatePositions(node) {
    if (node.children.length === 0) {
      // Leaf node: place it at current leaf X and advance
      node.x = currentLeafX;
      currentLeafX += nodeWidth + siblingSpacing;
    } else {
      // Internal node: layout children first
      for (const child of node.children) {
        calculatePositions(child);
      }
      // Center parent over children
      const firstChildX = node.children[0].x;
      const lastChildX = node.children[node.children.length - 1].x;
      node.x = (firstChildX + lastChildX) / 2;
    }
  }

  calculatePositions(rootInternal);

  // Determine total bounds
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Pass 3: Flatten into nodes and edges arrays
  function flatten(node) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);

    nodes.push(node);

    for (const child of node.children) {
      edges.push({
        id: `edge_${node.id}_${child.id}`,
        sourceId: node.id,
        targetId: child.id,
        x1: node.x + nodeWidth / 2,
        y1: node.y + nodeHeight,
        x2: child.x + nodeWidth / 2,
        y2: child.y,
      });
      flatten(child);
    }
  }

  flatten(rootInternal);

  // Shift everything so minX is at padding
  const shiftX = padding - minX;
  for (const node of nodes) {
    node.x += shiftX;
  }
  for (const edge of edges) {
    edge.x1 += shiftX;
    edge.x2 += shiftX;
  }

  return {
    nodes,
    edges,
    width: (maxX - minX) + nodeWidth + padding * 2,
    height: maxY + nodeHeight + padding * 2,
  };
}
