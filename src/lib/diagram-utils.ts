
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
    const isBoundaryBoxType = nodeType === 'Boundary'; // Note: 'Boundary' with capital B if that's the type used
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
  
  // Determine node type: 'Boundary' for infra boundaries, iconName for others.
  const isActualBoundary = component.stencilType === 'infrastructure' && component.isBoundary === true;
  const type = isActualBoundary ? 'Boundary' : (component.iconName || 'Package');


  let defaultWidth = isActualBoundary ? 400 : 150; 
  let defaultHeight = isActualBoundary ? 300 : 80; 
  let minWidth = isActualBoundary ? 200 : 60; // Adjusted min for boundaries
  let minHeight = isActualBoundary ? 150 : 40; // Adjusted min for boundaries

  if (!isActualBoundary && component.stencilType === 'process') {
    switch (type) {
        case 'Circle': case 'Diamond':
            defaultWidth = 100; defaultHeight = 100; minWidth = 60; minHeight = 60;
            break;
        case 'Rectangle': case 'Parallelogram': case 'ArchiveBox': case 'FileText': case 'PencilSimpleLine': case 'StickyNote':
            defaultWidth = 160; defaultHeight = 70; minWidth = 100; minHeight = 50;
            break;
        case 'ArrowRight':
            defaultWidth = 120; defaultHeight = 50; minWidth = 80; minHeight = 30;
            break;
        default: // Default for other process icons
            defaultWidth = 80; defaultHeight = 80; minWidth = 40; minHeight = 40;
    }
  } else if (!isActualBoundary && component.stencilType === 'infrastructure') {
     // Defaults for icon-only infrastructure nodes
     defaultWidth = 80; defaultHeight = 80; minWidth = 40; minHeight = 40;
  }


  const width = component.properties?.width ?? defaultWidth;
  const height = component.properties?.height ?? defaultHeight;

  const selected = typeof isSelectedOverride === 'boolean' ? isSelectedOverride : (component.properties?.selected || false);

  const nodeData: Record<string, any> = {
    label: component.properties?.name || component.name || component.id,
    properties: { ...(component.properties || {}), name: component.properties?.name || component.name }, // Ensure name is in properties
    iconName: component.iconName || 'Package', // Pass the original icon name for CustomNode
    textColor: component.textColor,
    resizable: true, // Most nodes are resizable
    minWidth: minWidth, 
    minHeight: minHeight, 
    stencilId: component.id, // Original stencil ID
    isBoundary: isActualBoundary, // Explicit boolean flag
  };

  if (isActualBoundary) {
    nodeData.boundaryColor = component.boundaryColor;
  }
  
  const nodeStyle: React.CSSProperties = {
    width: width,
    height: height,
  };

  if (isActualBoundary && nodeData.boundaryColor) {
    nodeStyle['--dynamic-boundary-color' as any] = nodeData.boundaryColor;
  }


  return {
    id: component.id, // Use stencil's original ID if it's meant to be unique for the *instance*
    type: type, // 'Boundary' or the iconName
    position: position,
    data: nodeData,
    style: nodeStyle,
    ...(isActualBoundary && {
        selectable: true, 
        connectable: false, 
    }),
    ...(component.properties?.parentNode && !isActualBoundary && { parentNode: component.properties.parentNode }),
    selected: selected,
  };
};


export const nodeToComponent = (node: Node): DiagramComponent => {
  const propertiesToSave: Record<string, any> = { ...(node.data.properties || {}) };

  propertiesToSave.position = node.position; 
  
  // Use measured dimensions if available and valid, otherwise use style dimensions
  if (node.measured?.width && node.measured.width > 0) propertiesToSave.width = node.measured.width;
  else if (node.style?.width && typeof node.style.width === 'number' && node.style.width > 0) propertiesToSave.width = node.style.width;
  else if (node.width && node.width > 0) propertiesToSave.width = node.width;


  if (node.measured?.height && node.measured.height > 0) propertiesToSave.height = node.measured.height;
  else if (node.style?.height && typeof node.style.height === 'number' && node.style.height > 0) propertiesToSave.height = node.style.height;
  else if (node.height && node.height > 0) propertiesToSave.height = node.height;

  
  propertiesToSave.name = node.data.label || node.data.properties?.name || node.id;

  if (node.parentNode && node.data.isBoundary !== true) { // Only add parentNode if it's not a boundary itself
    propertiesToSave.parentNode = node.parentNode;
  } else {
    delete propertiesToSave.parentNode; 
  }

  propertiesToSave.selected = !!node.selected; 
  delete propertiesToSave.label; // Label is derived from name, not stored directly in properties

  const baseComponent: Omit<DiagramComponent, 'stencilType' | 'iconName' | 'textColor' | 'boundaryColor' | 'isBoundary' > = {
    id: node.id,
    // type: node.data?.isBoundary ? 'Boundary' : (node.data?.iconName || node.type || 'Package'), // Use iconName from data for type consistency
    type: node.type || 'Package', // This 'type' is more like the React Flow node type ('Boundary', 'Server', etc.)
    properties: propertiesToSave,
  };
  
  // Reconstruct the full DiagramComponent with stencilType and other original stencil props
  // This part is tricky as node.data might not have all original stencil fields if not explicitly passed.
  // Assuming data.stencilId helps, but we need more info from data if it's an infrastructure or process stencil.
  // For now, we'll infer based on isBoundary and iconName. This might need refinement.

  if (node.data.isBoundary) {
    return {
      ...baseComponent,
      stencilType: 'infrastructure',
      iconName: node.data.iconName || 'ShieldCheck', // Fallback icon for boundary type
      textColor: node.data.textColor, // Might be undefined, boundary color is key
      boundaryColor: node.data.boundaryColor,
      isBoundary: true,
    } as DiagramComponent; // Cast needed due to union type
  } else {
    // For non-boundary, we need a hint for stencilType.
    // Let's assume if it's not explicitly 'infrastructure', it could be 'process' or a generic 'infrastructure'.
    // This is imperfect. Ideally, original stencilType is also in node.data.
    const inferredStencilType = (node.data.iconName === 'Circle' || node.data.iconName === 'Diamond' || node.data.iconName === 'Rectangle' || node.data.iconName === 'Parallelogram') ? 'process' : 'infrastructure';

    return {
      ...baseComponent,
      stencilType: node.data.stencilType || inferredStencilType, // Prefer data.stencilType if passed
      iconName: node.data.iconName || node.type || 'Package',
      textColor: node.data.textColor,
      isBoundary: false,
    } as DiagramComponent;
  }
};


export const connectionToEdge = (connection: DiagramConnection, isSelectedOverride?: boolean): Edge => {
  const selected = typeof isSelectedOverride === 'boolean' ? isSelectedOverride : (connection.selected || false);
  const label = connection.label || connection.properties?.name || 'Flow';
  return {
    id: connection.id,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle || undefined,
    targetHandle: connection.targetHandle || undefined,
    label: label,
    type: 'smoothstep', 
    animated: true,
    data: { 
      label: label, 
      properties: connection.properties || { 
        name: 'Data/Process Flow',
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
    sourceHandle: edge.sourceHandle || undefined, // Ensure nulls are handled
    targetHandle: edge.targetHandle || undefined, // Ensure nulls are handled
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
        // console.warn(`isClickOnNode: Invalid dimensions or position for node ${node.id}`, node);
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

    if (!sourceNode || !targetNode || 
        !sourceNode.positionAbsolute || !sourceNode.width || !sourceNode.height || 
        !targetNode.positionAbsolute || !targetNode.width || !targetNode.height) {
        // console.warn("isPointNearEdge: Source or target node missing or has invalid layout for edge", edge.id);
        return false;
    }
    
    // Use center of nodes for edge path approximation
    const sourceCenter = { 
        x: sourceNode.positionAbsolute.x + sourceNode.width / 2, 
        y: sourceNode.positionAbsolute.y + sourceNode.height / 2 
    };
    const targetCenter = { 
        x: targetNode.positionAbsolute.x + targetNode.width / 2, 
        y: targetNode.positionAbsolute.y + targetNode.height / 2 
    };

    // Simple bounding box check first for performance
    const minX = Math.min(sourceCenter.x, targetCenter.x) - tolerance;
    const maxX = Math.max(sourceCenter.x, targetCenter.x) + tolerance;
    const minY = Math.min(sourceCenter.y, targetCenter.y) - tolerance;
    const maxY = Math.max(sourceCenter.y, targetCenter.y) + tolerance;

    if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
        return false; 
    }

    // Distance from point P to line segment AB
    const A = sourceCenter;
    const B = targetCenter;
    const P = point;

    const ABx = B.x - A.x;
    const ABy = B.y - A.y;
    const APx = P.x - A.x;
    const APy = P.y - A.y;

    const dotProduct = APx * ABx + APy * ABy;
    if (dotProduct < 0) { // Point is closest to A
        return Math.sqrt(APx * APx + APy * APy) < tolerance;
    }

    const squaredLengthAB = ABx * ABx + ABy * ABy;
    if (squaredLengthAB === 0) { // A and B are the same point
        return Math.sqrt(APx * APx + APy * APy) < tolerance;
    }
    if (dotProduct > squaredLengthAB) { // Point is closest to B
        const BPx = P.x - B.x;
        const BPy = P.y - B.y;
        return Math.sqrt(BPx * BPx + BPy * BPy) < tolerance;
    }

    // Point is closest to the line segment itself
    const crossProduct = APx * ABy - APy * ABx;
    const distance = Math.abs(crossProduct) / Math.sqrt(squaredLengthAB);
    
    return distance < tolerance;
};


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

    console.log("[DIAG] getTopmostElementAtClick: Checking nodes at click", clickPos, "Zoom:", zoom);
    for (const node of nodes) {
        if (isClickOnNode(node, clickPos)) {
            console.log(`[DIAG] Node ${node.id} (type: ${node.type}, data.isBoundary: ${node.data?.isBoundary}, zIndex: ${node.zIndex}) is at click point.`);
            if (node.data && node.data.isBoundary === true) {
                clickedBoundaryBoxes.push(node);
                console.log(`[DIAG]   -> Classified as Boundary: ${node.id}`);
            } else {
                clickedNonBoundaryNodes.push(node);
                console.log(`[DIAG]   -> Classified as Non-Boundary: ${node.id}`);
            }
        }
    }
    
    // Check edges if no non-boundary node was directly hit OR if a boundary was hit (edges can be on top of boundaries)
    if (clickedNonBoundaryNodes.length === 0 || clickedBoundaryBoxes.length > 0) {
       for (const edge of edges) {
           if (isPointNearEdge(edge, clickPos, nodes)) {
               console.log(`[DIAG] Edge ${edge.id} is near click point.`);
               clickedEdges.push(edge);
           }
       }
    }
    
    console.log("[DIAG] Clicked Non-Boundary Nodes:", clickedNonBoundaryNodes.map(n => ({id: n.id, z: n.zIndex})));
    console.log("[DIAG] Clicked Edges:", clickedEdges.map(e => e.id));
    console.log("[DIAG] Clicked Boundary Boxes:", clickedBoundaryBoxes.map(n => ({id: n.id, z: n.zIndex})));


    // Priority:
    // 1. Non-boundary nodes (sorted by z-index descending, then area ascending - smaller on top of larger)
    if (clickedNonBoundaryNodes.length > 0) {
        const topNode = clickedNonBoundaryNodes.sort((a, b) => {
            const zIndexA = calculateEffectiveZIndex(a.id, a.type as string, a.selected, a.zIndex, selectedElementIdGlobal);
            const zIndexB = calculateEffectiveZIndex(b.id, b.type as string, b.selected, b.zIndex, selectedElementIdGlobal);
            if (zIndexA !== zIndexB) return zIndexB - zIndexA; // Higher z-index first
            const areaA = (a.width || 0) * (a.height || 0);
            const areaB = (b.width || 0) * (b.height || 0);
            return areaA - areaB; // Smaller area (more specific node) first if z-indexes are equal
        })[0];
        console.log("[DIAG] Returning top Non-Boundary Node:", topNode.id);
        return topNode;
    }

    // 2. Edges (if any are clicked and no non-boundary node was)
    // Edges don't typically have z-index in the same way, select the first found for now.
    // React Flow might render selected edges on top, which could be a factor if multiple edges overlap.
    if (clickedEdges.length > 0) {
        const topEdge = clickedEdges[0]; 
        console.log("[DIAG] Returning top Edge:", topEdge.id);
        return topEdge;
    }

    // 3. Boundary Boxes (if no non-boundary node or edge was clicked)
    // Sorted by z-index descending, then area ascending (smaller/inner boundary on top if nested and same z-index)
    if (clickedBoundaryBoxes.length > 0) {
        const topBoundary = clickedBoundaryBoxes.sort((a, b) => {
            const zIndexA = calculateEffectiveZIndex(a.id, a.type as string, a.selected, a.zIndex, selectedElementIdGlobal);
            const zIndexB = calculateEffectiveZIndex(b.id, b.type as string, b.selected, b.zIndex, selectedElementIdGlobal);
            if (zIndexA !== zIndexB) return zIndexB - zIndexA; 
            const areaA = (a.width || 0) * (a.height || 0);
            const areaB = (b.width || 0) * (b.height || 0);
            return areaA - areaB; 
        })[0];
        console.log("[DIAG] Returning top Boundary Box:", topBoundary.id);
        return topBoundary;
    }
    
    console.log("[DIAG] No specific element found at click point by getTopmostElementAtClick.");
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


    