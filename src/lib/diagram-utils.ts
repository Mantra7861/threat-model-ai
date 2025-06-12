
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
    const isBoundaryBoxType = nodeType === 'Boundary';
    const isEffectivelySelected = nodeSelected || (selectedElementIdGlobal === nodeId);

    if (rfProvidedZIndex !== undefined && rfProvidedZIndex !== null) {
      // If React Flow provides a zIndex, respect it but cap it for boundaries
      return isBoundaryBoxType 
             ? Math.min(rfProvidedZIndex, isEffectivelySelected ? BOUNDARY_BOX_SELECTED_Z_INDEX : BOUNDARY_BOX_DEFAULT_Z_INDEX)
             : rfProvidedZIndex;
    }

    // Default logic if React Flow doesn't provide a zIndex
    if (isBoundaryBoxType) {
        return isEffectivelySelected ? BOUNDARY_BOX_SELECTED_Z_INDEX : BOUNDARY_BOX_DEFAULT_Z_INDEX;
    }
    return isEffectivelySelected ? NODE_SELECTED_Z_INDEX : NODE_DEFAULT_Z_INDEX;
};


export const componentToNode = (component: DiagramComponent, isSelectedOverride?: boolean): Node => {
  const defaultPosition: XYPosition = { x: Math.random() * 400 + 50, y: Math.random() * 200 + 50 };
  const position = component.properties?.position || defaultPosition;

  const isActualBoundary = component.stencilType === 'infrastructure' && component.isBoundary === true;
  // The 'type' for React Flow node must match a key in nodeTypes in DiagramCanvas
  // For boundaries, it's 'Boundary'. For others, it's based on iconName or a default.
  const type = isActualBoundary ? 'Boundary' : (component.iconName || 'Package');


  let defaultWidth = isActualBoundary ? 400 : 150; // Default for icon-based infra nodes too
  let defaultHeight = isActualBoundary ? 300 : 80; // Default for icon-based infra nodes too
  let minWidth = isActualBoundary ? 200 : 60;
  let minHeight = isActualBoundary ? 150 : 40;

  if (!isActualBoundary && component.stencilType === 'process') {
    // Process shapes might have different defaults
    switch (type) {
        case 'Circle': case 'Diamond':
            defaultWidth = 100; defaultHeight = 100; minWidth = 60; minHeight = 60;
            break;
        case 'Rectangle': case 'Parallelogram': 
            defaultWidth = 160; defaultHeight = 70; minWidth = 100; minHeight = 50;
            break;
        // Icon-based process nodes use icon + label, similar to infra
        case 'ArrowRight': case 'ArchiveBox': case 'FileText': case 'PencilSimpleLine': case 'StickyNote': default:
            defaultWidth = 80; defaultHeight = 80; minWidth = 40; minHeight = 40; // Default for icon-based process nodes
            break;
    }
  } else if (!isActualBoundary && component.stencilType === 'infrastructure') {
     // Default for general icon-based infrastructure nodes
     defaultWidth = 80; defaultHeight = 80; minWidth = 40; minHeight = 40;
  }


  const width = component.properties?.width ?? defaultWidth;
  const height = component.properties?.height ?? defaultHeight;

  const selected = typeof isSelectedOverride === 'boolean' ? isSelectedOverride : (component.properties?.selected || false);

  const nodeData: Record<string, any> = {
    label: component.properties?.name || component.name || component.id, // Label for display (e.g., CustomNode uses this)
    properties: { ...(component.properties || {}), name: component.properties?.name || component.name }, // Ensure name is in properties
    iconName: component.iconName || 'Package', // For CustomNode to pick up the icon
    textColor: component.textColor, // For CustomNode to color icon/text or shape
    resizable: true, // Most nodes should be resizable by default
    minWidth: minWidth,
    minHeight: minHeight,
    stencilId: component.id, // This refers to the original stencil ID from which this node was created if applicable, not the node's instance ID.
                            // Actually, component.id IS the instance ID on the canvas. Stencil ID should be stored in properties if needed.
                            // Let's assume component.id is instance ID for now.
    isBoundary: isActualBoundary,
    // Pass stencilType for CustomNode to differentiate if needed (e.g., icon-based process vs icon-based infra)
    stencilType: component.stencilType, 
  };
  
  if (isActualBoundary) {
    nodeData.boundaryColor = component.boundaryColor;
  }

  const nodeStyle: React.CSSProperties = {
    width: width,
    height: height,
  };

  if (isActualBoundary && nodeData.boundaryColor) {
    // This CSS variable is used by globals.css to color the dashed border
    nodeStyle['--dynamic-boundary-color' as any] = nodeData.boundaryColor;
  }


  const returnedNode: Node = {
    id: component.id, // Unique instance ID of the node on the canvas
    type: type,       // React Flow node type (e.g., 'Boundary', 'Server', 'Circle')
    position: position,
    data: nodeData,
    style: nodeStyle,
    connectable: !isActualBoundary, // Boundaries are not typically connectable directly
    ...(isActualBoundary && {
        selectable: true, // Boundaries should be selectable
    }),
    ...(component.properties?.parentNode && !isActualBoundary && { parentNode: component.properties.parentNode }), // Nesting
    selected: selected,
  };
  return returnedNode;
};


export const nodeToComponent = (node: Node): DiagramComponent => {
  const propertiesToSave: Record<string, any> = { ...(node.data.properties || {}) };

  propertiesToSave.position = node.position;

  // Prioritize measured dimensions if available, then style, then direct node properties
  if (node.measured?.width && node.measured.width > 0) propertiesToSave.width = node.measured.width;
  else if (node.style?.width && typeof node.style.width === 'number' && node.style.width > 0) propertiesToSave.width = node.style.width;
  else if (node.width && node.width > 0) propertiesToSave.width = node.width;


  if (node.measured?.height && node.measured.height > 0) propertiesToSave.height = node.measured.height;
  else if (node.style?.height && typeof node.style.height === 'number' && node.style.height > 0) propertiesToSave.height = node.style.height;
  else if (node.height && node.height > 0) propertiesToSave.height = node.height;


  // Ensure name is consistent
  propertiesToSave.name = node.data.label || node.data.properties?.name || node.id;

  if (node.parentNode && node.data.isBoundary !== true) {
    propertiesToSave.parentNode = node.parentNode;
  } else {
    delete propertiesToSave.parentNode; // Clean up if not nested or is a boundary
  }

  propertiesToSave.selected = !!node.selected;
  
  // Remove the generic 'label' from properties if 'name' is already there, to avoid redundancy in saved data.
  if (propertiesToSave.name && propertiesToSave.label === propertiesToSave.name) {
      delete propertiesToSave.label;
  }


  // Base structure for DiagramComponent
  const baseDiagramComponent: Omit<DiagramComponent, 'stencilType' | 'iconName' | 'textColor' | 'boundaryColor' | 'isBoundary' | 'name' > = {
    id: node.id, // Unique instance ID
    type: node.type || 'Package', // React Flow node type
    properties: propertiesToSave,
  };
  
  const componentName = propertiesToSave.name; // Use the resolved name

  if (node.data.isBoundary) {
    return {
      ...baseDiagramComponent,
      name: componentName,
      stencilType: 'infrastructure', // Boundaries are infrastructure
      iconName: node.data.iconName || 'ShieldCheck', // Default icon for boundary stencil item
      textColor: node.data.textColor, // Color for the label of the boundary
      boundaryColor: node.data.boundaryColor, // Color for the dashed border
      isBoundary: true,
    } as DiagramComponent; // Cast as DiagramComponent which includes all possible fields
  } else {
    // Determine stencilType if not explicitly set in node.data (e.g. from a dropped stencil)
    let stencilType: 'infrastructure' | 'process' = node.data.stencilType;
    if (!stencilType) { // Infer if missing
      const processShapes = ['Circle', 'Diamond', 'Rectangle', 'Parallelogram', 'ArrowRight'];
      // Add more infra icons if needed for inference
      const infraIcons = ['HardDrive', 'Database', 'Cloud', 'Router', 'Server', 'ShieldCheck', 'User', 'Package', 'HardDrives']; 
      if (processShapes.includes(node.type || '')) {
        stencilType = 'process';
      } else if (infraIcons.includes(node.type || '')) {
        stencilType = 'infrastructure';
      } else {
        // Fallback, could be based on node.type if more specific icon names are used as types
        stencilType = 'infrastructure'; 
      }
    }

    return {
      ...baseDiagramComponent,
      name: componentName,
      stencilType: stencilType,
      iconName: node.data.iconName || node.type || 'Package', // Icon for the node
      textColor: node.data.textColor, // Color for icon/text or shape
      isBoundary: false,
    } as DiagramComponent;
  }
};


export const connectionToEdge = (connection: DiagramConnection, isSelectedOverride?: boolean): Edge => {
  const selected = typeof isSelectedOverride === 'boolean' ? isSelectedOverride : (connection.selected || false);
  const connectionProperties = connection.properties || {};

  // Prioritize name from properties, then label, then default.
  let userFacingName = connectionProperties.name || connection.label;
  if (!userFacingName || userFacingName.trim() === '' || userFacingName === connection.id) {
    userFacingName = 'Data Flow'; // Default name for connections
  }

  // Ensure default properties exist for the edge's data field
  const defaultEdgeDataProps = {
    description: 'A data or process flow connection.',
    dataType: 'Generic',
    protocol: 'Sequence/TCP', // Or a more generic default like 'HTTPS'
    securityConsiderations: 'Needs review',
    isBiDirectional: false, // Default to false
  };

  const edgeDataProperties: Record<string, any> = {
    ...defaultEdgeDataProps,
    ...connectionProperties, // Saved properties override defaults
    name: userFacingName, // Ensure name is set to the resolved user-facing name
    isBiDirectional: connectionProperties.isBiDirectional === true, // Ensure boolean
  };
  
  const isBi = edgeDataProperties.isBiDirectional;

  return {
    id: connection.id,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle || undefined,
    targetHandle: connection.targetHandle || undefined,
    label: userFacingName, // Visual label on the canvas
    type: 'default', // Or a custom edge type if you define one
    data: {
      // Store properties in edge.data.properties for SidebarPropertiesPanel
      properties: edgeDataProperties,
      // Optional: also store label in data for direct access if needed, though properties.name is preferred
      label: userFacingName, 
    },
    selected: selected,
    markerEnd: { type: 'arrowclosed' }, // Always an arrow at the target
    markerStart: isBi ? { type: 'arrowclosed' } : undefined, // Arrow at source if bi-directional
  };
};

export const edgeToConnection = (edge: Edge): DiagramConnection => {
  const edgeData = edge.data || {};
  const currentEdgeDataProperties = edgeData.properties || {};

  // Prioritize name from data.properties.name, then edge.label (visual label), then data.label
  let connectionName = currentEdgeDataProperties.name || edge.label || edgeData.label;
  if (!connectionName || connectionName.trim() === '' || connectionName === edge.id) {
    connectionName = 'Data Flow'; // Default name
  }
  
  const defaultConnectionProps = {
    description: 'A data or process flow connection.',
    dataType: 'Generic',
    protocol: 'Sequence/TCP',
    securityConsiderations: 'Needs review',
    isBiDirectional: false, // Default to false
  };

  const propertiesToSave: Record<string, any> = {
    ...defaultConnectionProps,
    ...currentEdgeDataProperties, // Properties from edge data override defaults
    name: connectionName, // Ensure name is set to the resolved user-facing name
    isBiDirectional: currentEdgeDataProperties.isBiDirectional === true, // Ensure boolean
  };
  // Clean up label from properties if name is already set
  if (propertiesToSave.name && propertiesToSave.label === propertiesToSave.name) {
    delete propertiesToSave.label;
  }


  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle || undefined,
    targetHandle: edge.targetHandle || undefined,
    label: connectionName, // Label for the connection object itself (e.g., for reports)
    properties: propertiesToSave, // Store all relevant data here
    selected: !!edge.selected,
  };
};


// --- Utility functions for click detection and interaction ---

export const isClickOnNode = (
    node: Node,
    clickPos: XYPosition,
): boolean => {
    if (!node.positionAbsolute || typeof node.width !== 'number' || typeof node.height !== 'number' || node.width <= 0 || node.height <= 0) {
        return false; // Node has no valid dimensions or position
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
        !sourceNode.positionAbsolute || typeof sourceNode.width !== 'number' || typeof sourceNode.height !== 'number' ||
        !targetNode.positionAbsolute || typeof targetNode.width !== 'number' || typeof targetNode.height !== 'number') {
        return false;
    }

    // Get center points of nodes.
    // TODO: Could be enhanced to use actual handle positions if available and precise.
    let sourcePos = {
        x: sourceNode.positionAbsolute.x + sourceNode.width / 2,
        y: sourceNode.positionAbsolute.y + sourceNode.height / 2
    };
    let targetPos = {
        x: targetNode.positionAbsolute.x + targetNode.width / 2,
        y: targetNode.positionAbsolute.y + targetNode.height / 2
    };
    
    const minX = Math.min(sourcePos.x, targetPos.x) - tolerance;
    const maxX = Math.max(sourcePos.x, targetPos.x) + tolerance;
    const minY = Math.min(sourcePos.y, targetPos.y) - tolerance;
    const maxY = Math.max(sourcePos.y, targetPos.y) + tolerance;

    if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
        return false; // Quick check: if point is outside bounding box of segment + tolerance
    }

    // Distance from point P to line segment AB
    const A = sourcePos;
    const B = targetPos;
    const P = point;

    const l2 = (B.x - A.x) * (B.x - A.x) + (B.y - A.y) * (B.y - A.y); // Squared length of AB
    if (l2 === 0) return Math.sqrt((P.x - A.x) * (P.x - A.x) + (P.y - A.y) * (P.y - A.y)) < tolerance; // A and B are the same point

    // Project P onto the line AB, find t
    let t = ((P.x - A.x) * (B.x - A.x) + (P.y - A.y) * (B.y - A.y)) / l2;
    t = Math.max(0, Math.min(1, t)); // Clamp t to be on the segment AB

    const closestPointX = A.x + t * (B.x - A.x);
    const closestPointY = A.y + t * (B.y - A.y);

    const dx = P.x - closestPointX;
    const dy = P.y - closestPointY;
    
    return (dx * dx + dy * dy) < (tolerance * tolerance); // Check if distance squared is less than tolerance squared
};


export const getTopmostElementAtClick = (
    nodes: Node[],
    edges: Edge[],
    clickPos: XYPosition,
    zoom: number,
    selectedElementIdGlobal: string | null // The ID of the currently globally selected element, if any
): Node | Edge | null => {
    const clickedNonBoundaryNodes: Node[] = [];
    const clickedBoundaryBoxes: Node[] = [];
    const clickedEdges: Edge[] = [];

    // Check nodes
    for (const node of nodes) {
        if (isClickOnNode(node, clickPos)) {
            if (node.data && node.data.isBoundary === true) {
                clickedBoundaryBoxes.push(node);
            } else {
                clickedNonBoundaryNodes.push(node);
            }
        }
    }

    // Check edges only if no non-boundary node was directly clicked, or if a boundary box was clicked (edges can be over boundaries)
    if (clickedNonBoundaryNodes.length === 0 || clickedBoundaryBoxes.some(bn => isClickOnNode(bn, clickPos))) {
       for (const edge of edges) {
           if (isPointNearEdge(edge, clickPos, nodes, 10 / zoom)) { // Adjust tolerance by zoom
               clickedEdges.push(edge);
           }
       }
    }

    // Prioritize non-boundary nodes
    if (clickedNonBoundaryNodes.length > 0) {
        return clickedNonBoundaryNodes.sort((a, b) => {
            const zIndexA = calculateEffectiveZIndex(a.id, a.type as string, a.selected, a.zIndex, selectedElementIdGlobal);
            const zIndexB = calculateEffectiveZIndex(b.id, b.type as string, b.selected, b.zIndex, selectedElementIdGlobal);
            if (zIndexA !== zIndexB) return zIndexB - zIndexA; // Higher z-index first
            // If z-index is the same, smaller area nodes are considered "on top" (more specific click)
            const areaA = (a.width || 0) * (a.height || 0);
            const areaB = (b.width || 0) * (b.height || 0);
            return areaA - areaB; 
        })[0];
    }

    // Then edges (currently simple, could be enhanced with edge z-indexing if needed)
    if (clickedEdges.length > 0) {
        return clickedEdges[0]; // Return the first clicked edge
    }

    // Then boundary boxes (if no non-boundary node or edge was clicked on top)
    if (clickedBoundaryBoxes.length > 0) {
        return clickedBoundaryBoxes.sort((a, b) => {
            const zIndexA = calculateEffectiveZIndex(a.id, a.type as string, a.selected, a.zIndex, selectedElementIdGlobal);
            const zIndexB = calculateEffectiveZIndex(b.id, b.type as string, b.selected, b.zIndex, selectedElementIdGlobal);
             if (zIndexA !== zIndexB) return zIndexB - zIndexA; // Higher z-index first (selected boundary over unselected)
            // If z-index is the same, LARGER area (more encompassing boundary) is considered "behind" smaller ones
            const areaA = (a.width || 0) * (a.height || 0);
            const areaB = (b.width || 0) * (b.height || 0);
            return areaB - areaA; 
        })[0];
    }

    return null; // No element clicked
};


// Simplified version for just nodes if needed
export const getTopmostNodeAtClick = (
    nodes: Node[],
    clickPos: XYPosition,
    zoom: number, // Zoom might be needed if tolerance is involved in future node click logic
    selectedElementIdGlobal: string | null
): Node | null => {
    const element = getTopmostElementAtClick(nodes, [], clickPos, zoom, selectedElementIdGlobal);
    return element && 'position' in element ? element : null; // Check if it's a Node
};


// Debounce utility function
export function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };
  return debounced as (...args: Parameters<F>) => void;
}

// Utility to check if a point is inside given bounds
export function isPointInsideBounds(point: XYPosition, bounds: Bounds): boolean {
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
           point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

    