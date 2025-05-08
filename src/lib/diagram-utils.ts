
import type { Node, Edge, XYPosition, Dimensions, Bounds } from '@xyflow/react';
import type { Component as DiagramComponent, Connection as DiagramConnection } from '@/services/diagram';

// Z-index constants
const BOUNDARY_BOX_DEFAULT_Z_INDEX = -1; 
const BOUNDARY_BOX_SELECTED_Z_INDEX = 0; 
const NODE_DEFAULT_Z_INDEX = 10;    
const NODE_SELECTED_Z_INDEX = 11;  


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
      return isBoundaryBoxType ? Math.min(rfProvidedZIndex, isEffectivelySelected ? BOUNDARY_BOX_SELECTED_Z_INDEX : BOUNDARY_BOX_DEFAULT_Z_INDEX) 
                               : rfProvidedZIndex;
    }

    if (isBoundaryBoxType) {
        return isEffectivelySelected ? BOUNDARY_BOX_SELECTED_Z_INDEX : BOUNDARY_BOX_DEFAULT_Z_INDEX;
    }
    return isEffectivelySelected ? NODE_SELECTED_Z_INDEX : NODE_DEFAULT_Z_INDEX;
};


export const componentToNode = (component: DiagramComponent, isSelectedOverride?: boolean): Node => {
  const defaultPosition: XYPosition = { x: Math.random() * 400 + 50, y: Math.random() * 200 + 50 };
  const position = component.properties?.position || defaultPosition;
  const type = component.type || 'default'; 
  const isBoundaryBox = type === 'boundary';

  let defaultWidth = isBoundaryBox ? 400 : 150; 
  let defaultHeight = isBoundaryBox ? 300 : 80; 
  let minWidth = isBoundaryBox ? 150 : 80; 
  let minHeight = isBoundaryBox ? 100 : 40;

  // Adjust default/min sizes for specific process shapes
  if (type === 'start-end' || type === 'decision') { // Circle, Diamond
    defaultWidth = 100;
    defaultHeight = 100;
    minWidth = 60;
    minHeight = 60;
  } else if (type === 'step' || type === 'input-output' || type === 'document' || type === 'manual-input') {
    defaultWidth = 160;
    defaultHeight = 70;
    minWidth = 100;
    minHeight = 50;
  }


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
      resizable: true, 
      minWidth: minWidth, 
      minHeight: minHeight, 
    },
    style: { 
        width: width,
        height: height,
    },
    ...(isBoundaryBox && {
        selectable: true, 
        connectable: false, 
    }),
    ...(component.properties?.parentNode && !isBoundaryBox && { parentNode: component.properties.parentNode }),
    selected: selected,
    // Ensure zIndex is calculated by CustomNode via its props or internal logic
  };
};


export const nodeToComponent = (node: Node): DiagramComponent => {
  const propertiesToSave: Record<string, any> = { ...(node.data.properties || {}) };

  propertiesToSave.position = node.position; 
  
  if (node.width && node.width > 0) propertiesToSave.width = node.width;
  else if (node.measured?.width && node.measured.width > 0) propertiesToSave.width = node.measured.width;
  
  if (node.height && node.height > 0) propertiesToSave.height = node.height;
  else if (node.measured?.height && node.measured.height > 0) propertiesToSave.height = node.measured.height;
  
  propertiesToSave.name = node.data.label || node.data.properties?.name || node.id;

  if (node.parentNode && node.type !== 'boundary') {
    propertiesToSave.parentNode = node.parentNode;
  } else {
    delete propertiesToSave.parentNode; 
  }

  propertiesToSave.selected = !!node.selected; 
  delete propertiesToSave.label; 

  return {
    id: node.id,
    type: node.data?.type || node.type || 'default', 
    properties: propertiesToSave,
  };
};


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
        name: 'Data/Process Flow', // Generic default
        description: 'A data or process flow connection.',
        dataType: 'Generic',
        protocol: 'Sequence/TCP',
        securityConsiderations: 'Needs review',
      },
    },
    selected: selected,
  };
};


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


export const isClickOnNode = (
    node: Node,
    clickPos: XYPosition,
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


export const isPointNearEdge = (edge: Edge, point: XYPosition, nodes: Node[], tolerance = 10): boolean => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode || !sourceNode.positionAbsolute || !targetNode.width || !targetNode.height || !targetNode.width || !targetNode.height) {
        return false;
    }
    
    const sourceCenter = { 
        x: sourceNode.positionAbsolute.x + sourceNode.width / 2, 
        y: sourceNode.positionAbsolute.y + sourceNode.height / 2 
    };
    const targetCenter = { 
        x: targetNode.positionAbsolute.x + targetNode.width / 2, 
        y: targetNode.positionAbsolute.y + targetNode.height / 2 
    };

    const minX = Math.min(sourceCenter.x, targetCenter.x) - tolerance;
    const maxX = Math.max(sourceCenter.x, targetCenter.x) + tolerance;
    const minY = Math.min(sourceCenter.y, targetCenter.y) - tolerance;
    const maxY = Math.max(sourceCenter.y, targetCenter.y) + tolerance;

    if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
        return false; 
    }

    const A = sourceCenter;
    const B = targetCenter;
    const P = point;

    const ABx = B.x - A.x;
    const ABy = B.y - A.y;
    const APx = P.x - A.x;
    const APy = P.y - A.y;

    const dotProduct = APx * ABx + APy * ABy;
    if (dotProduct < 0) { 
        return Math.sqrt(APx * APx + APy * APy) < tolerance;
    }

    const squaredLengthAB = ABx * ABx + ABy * ABy;
    if (squaredLengthAB === 0) { // A and B are the same point
        return Math.sqrt(APx * APx + APy * APy) < tolerance;
    }
    if (dotProduct > squaredLengthAB) { 
        const BPx = P.x - B.x;
        const BPy = P.y - B.y;
        return Math.sqrt(BPx * BPx + BPy * BPy) < tolerance;
    }

    const crossProduct = APx * ABy - APy * ABx;
    const distance = Math.abs(crossProduct) / Math.sqrt(squaredLengthAB);
    
    return distance < tolerance;
};


export const getTopmostElementAtClick = (
    nodes: Node[],
    edges: Edge[],
    clickPos: XYPosition,
    zoom: number, // zoom might be useful for more precise hit testing if needed
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
    
    // Only check edges if no non-boundary node was directly hit, or if the hit non-boundary node is behind an edge.
    // This means edges can be selected even if they visually cross over a part of a non-boundary node,
    // but non-boundary nodes get priority if the click is clearly on them.
    // If a boundary box is hit, edges on top should still be selectable.
    if (clickedNonBoundaryNodes.length === 0 || clickedBoundaryBoxes.length > 0) {
       for (const edge of edges) {
           if (isPointNearEdge(edge, clickPos, nodes)) {
               clickedEdges.push(edge);
           }
       }
    }
    
    // Priority:
    // 1. Non-boundary nodes (sorted by z-index descending, then area ascending - smaller on top of larger)
    if (clickedNonBoundaryNodes.length > 0) {
        return clickedNonBoundaryNodes.sort((a, b) => {
            const zIndexA = calculateEffectiveZIndex(a.id, a.type as string, a.selected, a.zIndex, selectedElementIdGlobal);
            const zIndexB = calculateEffectiveZIndex(b.id, b.type as string, b.selected, b.zIndex, selectedElementIdGlobal);
            if (zIndexA !== zIndexB) return zIndexB - zIndexA;
            const areaA = (a.width || 0) * (a.height || 0);
            const areaB = (b.width || 0) * (b.height || 0);
            return areaA - areaB; 
        })[0];
    }

    // 2. Edges (if any are clicked and no non-boundary node was)
    if (clickedEdges.length > 0) {
        // Simple: first found. Could sort by a proxy for z-index if edges had one.
        return clickedEdges[0];
    }

    // 3. Boundary Boxes (if no non-boundary node or edge was clicked)
    if (clickedBoundaryBoxes.length > 0) {
        return clickedBoundaryBoxes.sort((a, b) => {
            const zIndexA = calculateEffectiveZIndex(a.id, a.type as string, a.selected, a.zIndex, selectedElementIdGlobal);
            const zIndexB = calculateEffectiveZIndex(b.id, b.type as string, b.selected, b.zIndex, selectedElementIdGlobal);
            if (zIndexA !== zIndexB) return zIndexB - zIndexA; // Higher z-index first
            const areaA = (a.width || 0) * (a.height || 0);
            const areaB = (b.width || 0) * (b.height || 0);
            return areaA - areaB; // Smaller area (more specific boundary) first
        })[0];
    }
    
    return null; 
};


export const getTopmostNodeAtClick = (
    nodes: Node[],
    clickPos: XYPosition,
    zoom: number,
    selectedElementIdGlobal: string | null
): Node | null => {
    const element = getTopmostElementAtClick(nodes, [], clickPos, zoom, selectedElementIdGlobal);
    return element && 'position' in element ? element : null; 
};


export function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };
  return debounced as (...args: Parameters<F>) => void;
}

export function isPointInsideBounds(point: XYPosition, bounds: Bounds): boolean {
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
           point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}
