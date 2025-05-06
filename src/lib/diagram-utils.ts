import type { Node, Edge, XYPosition, Dimensions, Bounds } from '@xyflow/react';
import type { Component as DiagramComponent, Connection as DiagramConnection } from '@/services/diagram';

// Z-index constants for different node states and types
const BOUNDARY_BOX_DEFAULT_Z_INDEX = -1; // Boundary Boxes are always at the very back
const BOUNDARY_BOX_SELECTED_Z_INDEX = 0; // Selected Boundary Boxes slightly above default, but still behind nodes
const NODE_DEFAULT_Z_INDEX = 10;    // Non-boundary nodes start higher
const NODE_SELECTED_Z_INDEX = 11;   // Selected non-boundary nodes are on top of other non-boundary nodes


/**
 * Calculates the effective z-index for a node.
 * Boundary Box nodes are always kept behind other interactive nodes.
 */
export const calculateEffectiveZIndex = (
    nodeId: string,
    nodeType: string,
    nodeSelected: boolean | undefined, 
    rfProvidedZIndex: number | undefined,
    selectedElementIdGlobal: string | null 
): number => {
    const isBoundaryBoxType = nodeType === 'boundary';
    const isEffectivelySelected = nodeSelected || (selectedElementIdGlobal === nodeId);

    if (rfProvidedZIndex !== undefined && rfProvidedZIndex !== null) {
      // If RF provides zIndex (e.g., during drag), respect it but cap boundaries
      return isBoundaryBoxType ? Math.min(rfProvidedZIndex, isEffectivelySelected ? BOUNDARY_BOX_SELECTED_Z_INDEX : BOUNDARY_BOX_DEFAULT_Z_INDEX) 
                               : rfProvidedZIndex;
    }

    if (isBoundaryBoxType) {
        return isEffectivelySelected ? BOUNDARY_BOX_SELECTED_Z_INDEX : BOUNDARY_BOX_DEFAULT_Z_INDEX;
    }
    return isEffectivelySelected ? NODE_SELECTED_Z_INDEX : NODE_DEFAULT_Z_INDEX;
};


/**
 * Converts a DiagramComponent to a ReactFlow Node.
 */
export const componentToNode = (component: DiagramComponent, isSelectedOverride?: boolean): Node => {
  const defaultPosition: XYPosition = { x: Math.random() * 400 + 50, y: Math.random() * 200 + 50 };
  const position = component.properties?.position || defaultPosition;
  const type = component.type || 'default'; // 'boundary' for Boundary Box
  const isBoundaryBox = type === 'boundary';

  const defaultWidth = isBoundaryBox ? 400 : 150; 
  const defaultHeight = isBoundaryBox ? 300 : 80; 
  
  const minWidth = isBoundaryBox ? 150 : 80; 
  const minHeight = isBoundaryBox ? 100 : 40;

  const width = component.properties?.width ?? defaultWidth;
  const height = component.properties?.height ?? defaultHeight;

  const selected = typeof isSelectedOverride === 'boolean' ? isSelectedOverride : (component.properties?.selected || false);

  return {
    id: component.id,
    type: type,
    position: position,
    data: {
      label: component.properties?.name || component.id,
      properties: { ...component.properties }, 
      type: type, 
      resizable: true, // All nodes, including Boundary Box, are resizable
      minWidth: minWidth, 
      minHeight: minHeight, 
    },
    style: { 
        width: width,
        height: height,
    },
    // Boundary Box specific configurations
    ...(isBoundaryBox && {
        selectable: true, 
        connectable: false, // Boundary Boxes are not connectable directly
        // zIndex will be set by CustomNode using calculateEffectiveZIndex
    }),
    // For non-boundary nodes, zIndex also handled by CustomNode
    ...(component.properties?.parentNode && !isBoundaryBox && { parentNode: component.properties.parentNode }), // Boundary boxes don't get parented
    selected: selected,
  };
};

/**
 * Converts a ReactFlow Node back to a DiagramComponent.
 */
export const nodeToComponent = (node: Node): DiagramComponent => {
  const propertiesToSave: Record<string, any> = { ...(node.data.properties || {}) };

  propertiesToSave.position = node.position; 
  
  if (node.width && node.width > 0) propertiesToSave.width = node.width;
  else if (node.measured?.width && node.measured.width > 0) propertiesToSave.width = node.measured.width;
  
  if (node.height && node.height > 0) propertiesToSave.height = node.height;
  else if (node.measured?.height && node.measured.height > 0) propertiesToSave.height = node.measured.height;
  
  propertiesToSave.name = node.data.label || node.data.properties?.name || node.id;

  // Only save parentNode if it's not a boundary box itself
  if (node.parentNode && node.type !== 'boundary') {
    propertiesToSave.parentNode = node.parentNode;
  } else {
    delete propertiesToSave.parentNode; 
  }

  propertiesToSave.selected = !!node.selected; 
  delete propertiesToSave.label; // Label is derived from name

  return {
    id: node.id,
    type: node.data?.type || node.type || 'default', 
    properties: propertiesToSave,
  };
};


/**
 * Converts a DiagramConnection to a ReactFlow Edge.
 */
export const connectionToEdge = (connection: DiagramConnection, isSelectedOverride?: boolean): Edge => {
  const selected = typeof isSelectedOverride === 'boolean' ? isSelectedOverride : (connection.selected || false);
  return {
    id: connection.id,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle || undefined,
    targetHandle: connection.targetHandle || undefined,
    label: connection.label || connection.properties?.name,
    type: 'smoothstep', 
    animated: true,
    data: { 
      label: connection.label || connection.properties?.name, 
      properties: connection.properties || { 
        name: 'Data Flow',
        description: 'A data flow connection.',
        dataType: 'Generic',
        protocol: 'TCP/IP',
        securityConsiderations: 'Needs review',
      },
    },
    selected: selected,
    // Edges are typically above Boundary Boxes due to node z-indexing
  };
};

/**
 * Converts a ReactFlow Edge back to a DiagramConnection.
 */
export const edgeToConnection = (edge: Edge): DiagramConnection => {
  const edgeProperties = edge.data?.properties || {};
  const edgeLabel = edge.data?.label || edge.label || edge.id;

  const propertiesToSave = { 
    ...edgeProperties,
    name: edgeLabel, 
  };

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edgeLabel,
    properties: propertiesToSave,
    selected: !!edge.selected, 
  };
};


/**
 * Checks if a click position is within the bounds of a node.
 * Assumes node.positionAbsolute, node.width, and node.height are valid.
 */
export const isClickOnNode = (
    node: Node,
    clickPos: XYPosition,
    // zoom: number // zoom currently not used directly here for basic check
): boolean => {
    if (!node.positionAbsolute || typeof node.width !== 'number' || typeof node.height !== 'number' || node.width <= 0 || node.height <= 0) {
        return false;
    }
    const { x, y } = node.positionAbsolute;
    const { width, height } = node;

    return (
        clickPos.x >= x &&
        clickPos.x <= x + width &&
        clickPos.y >= y &&
        clickPos.y <= y + height
    );
};


/**
 * A simplified check to see if a point is "near" an edge.
 * This is not a precise check on the path, but on a bounding box around the edge.
 * For more accurate edge click detection, React Flow's internal mechanisms or more complex geometry libraries would be needed.
 * @param edge The edge to check.
 * @param point The click point in flow coordinates.
 * @param nodes The list of all nodes (to get source/target positions).
 * @param tolerance The click tolerance around the edge.
 */
export const isPointNearEdge = (edge: Edge, point: XYPosition, nodes: Node[], tolerance = 10): boolean => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode || !sourceNode.positionAbsolute || !targetNode.positionAbsolute || !sourceNode.width || !sourceNode.height || !targetNode.width || !targetNode.height) {
        return false;
    }
    
    // Approximate center of source and target nodes
    const sourceCenter = { 
        x: sourceNode.positionAbsolute.x + sourceNode.width / 2, 
        y: sourceNode.positionAbsolute.y + sourceNode.height / 2 
    };
    const targetCenter = { 
        x: targetNode.positionAbsolute.x + targetNode.width / 2, 
        y: targetNode.positionAbsolute.y + targetNode.height / 2 
    };

    // Create a bounding box for the edge
    const minX = Math.min(sourceCenter.x, targetCenter.x) - tolerance;
    const maxX = Math.max(sourceCenter.x, targetCenter.x) + tolerance;
    const minY = Math.min(sourceCenter.y, targetCenter.y) - tolerance;
    const maxY = Math.max(sourceCenter.y, targetCenter.y) + tolerance;

    if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
        return false; // Point is outside the rough bounding box
    }

    // More precise (but still simplified) distance to line segment check
    const A = sourceCenter;
    const B = targetCenter;
    const P = point;

    const ABx = B.x - A.x;
    const ABy = B.y - A.y;
    const APx = P.x - A.x;
    const APy = P.y - A.y;

    const dotProduct = APx * ABx + APy * ABy;
    if (dotProduct < 0) { // Closest point is A
        return Math.sqrt(APx * APx + APy * APy) < tolerance;
    }

    const squaredLengthAB = ABx * ABx + ABy * ABy;
    if (dotProduct > squaredLengthAB) { // Closest point is B
        const BPx = P.x - B.x;
        const BPy = P.y - B.y;
        return Math.sqrt(BPx * BPx + BPy * BPy) < tolerance;
    }

    // Closest point is on the segment, calculate perpendicular distance
    const crossProduct = APx * ABy - APy * ABx;
    const distance = Math.abs(crossProduct) / Math.sqrt(squaredLengthAB);
    
    return distance < tolerance;
};


/**
 * Gets the topmost interactive element (node or edge) at a click position.
 * Prioritizes non-boundary nodes, then edges, then boundary nodes.
 */
export const getTopmostElementAtClick = (
    nodes: Node[],
    edges: Edge[],
    clickPos: XYPosition,
    zoom: number,
    selectedElementIdGlobal: string | null
): Node | Edge | null => {
    const clickedNonBoundaryNodes: Node[] = [];
    const clickedBoundaryBoxes: Node[] = [];
    const clickedEdges: Edge[] = [];

    for (const node of nodes) {
        if (isClickOnNode(node, clickPos)) {
            if (node.type === 'boundary') {
                clickedBoundaryBoxes.push(node);
            } else {
                clickedNonBoundaryNodes.push(node);
            }
        }
    }

    // Check edges only if no non-boundary node was directly clicked (or to find edges on top of boundaries)
    // This simplified edge check runs if non-boundary nodes aren't the primary target.
    if (clickedNonBoundaryNodes.length === 0) {
        for (const edge of edges) {
            if (isPointNearEdge(edge, clickPos, nodes)) {
                clickedEdges.push(edge);
            }
        }
    }
    

    // Priority:
    // 1. Non-boundary nodes (sorted by z-index, then area)
    if (clickedNonBoundaryNodes.length > 0) {
        return clickedNonBoundaryNodes.sort((a, b) => {
            const zIndexA = calculateEffectiveZIndex(a.id, a.type as string, a.selected, a.zIndex, selectedElementIdGlobal);
            const zIndexB = calculateEffectiveZIndex(b.id, b.type as string, b.selected, b.zIndex, selectedElementIdGlobal);
            if (zIndexA !== zIndexB) return zIndexB - zIndexA;
            const areaA = (a.width || 0) * (a.height || 0);
            const areaB = (b.width || 0) * (b.height || 0);
            return areaA - areaB; // Smaller area first
        })[0];
    }

    // 2. Edges (if any are clicked and no non-boundary node was)
    //    Edges don't have a complex z-index relative to each other in this simplified model, first found is fine.
    if (clickedEdges.length > 0) {
        // Simple selection: first edge found. Could be refined if edges overlap significantly.
        return clickedEdges[0];
    }

    // 3. Boundary Boxes (if no non-boundary node or edge was clicked at this point)
    //    (sorted by z-index, then area - smaller/more specific boundary preferred)
    if (clickedBoundaryBoxes.length > 0) {
        return clickedBoundaryBoxes.sort((a, b) => {
            const zIndexA = calculateEffectiveZIndex(a.id, a.type as string, a.selected, a.zIndex, selectedElementIdGlobal);
            const zIndexB = calculateEffectiveZIndex(b.id, b.type as string, b.selected, b.zIndex, selectedElementIdGlobal);
            if (zIndexA !== zIndexB) return zIndexB - zIndexA;
            const areaA = (a.width || 0) * (a.height || 0);
            const areaB = (b.width || 0) * (b.height || 0);
            return areaA - areaB; // Smaller area first
        })[0];
    }
    
    return null; // No interactive element found at click position
};

// Renamed from getTopmostNodeAtClick to be more generic if needed, but keeping specific for now
export const getTopmostNodeAtClick = (
    nodes: Node[],
    clickPos: XYPosition,
    zoom: number,
    selectedElementIdGlobal: string | null
): Node | null => {
    const element = getTopmostElementAtClick(nodes, [], clickPos, zoom, selectedElementIdGlobal);
    return element && 'position' in element ? element : null; // Return only if it's a Node
};



// Debounce function
export function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };
  return debounced as (...args: Parameters<F>) => void;
}

// Helper to check if a point is inside arbitrary bounds
export function isPointInsideBounds(point: XYPosition, bounds: Bounds): boolean {
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
           point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}