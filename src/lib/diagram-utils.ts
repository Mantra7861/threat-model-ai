
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

  const isActualBoundary = component.stencilType === 'infrastructure' && component.isBoundary === true;
  const type = isActualBoundary ? 'Boundary' : (component.iconName || 'Package');


  let defaultWidth = isActualBoundary ? 400 : 150;
  let defaultHeight = isActualBoundary ? 300 : 80;
  let minWidth = isActualBoundary ? 200 : 60;
  let minHeight = isActualBoundary ? 150 : 40;

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
        default:
            defaultWidth = 80; defaultHeight = 80; minWidth = 40; minHeight = 40;
    }
  } else if (!isActualBoundary && component.stencilType === 'infrastructure') {
     defaultWidth = 80; defaultHeight = 80; minWidth = 40; minHeight = 40;
  }


  const width = component.properties?.width ?? defaultWidth;
  const height = component.properties?.height ?? defaultHeight;

  const selected = typeof isSelectedOverride === 'boolean' ? isSelectedOverride : (component.properties?.selected || false);

  const nodeData: Record<string, any> = {
    label: component.properties?.name || component.name || component.id,
    properties: { ...(component.properties || {}), name: component.properties?.name || component.name },
    iconName: component.iconName || 'Package',
    textColor: component.textColor,
    resizable: true,
    minWidth: minWidth,
    minHeight: minHeight,
    stencilId: component.id, // This should be the stencil's original ID, not the node instance ID
    isBoundary: isActualBoundary,
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


  const returnedNode: Node = {
    id: component.id, // This should be the unique instance ID of the node on the canvas
    type: type,
    position: position,
    data: nodeData,
    style: nodeStyle,
    connectable: !isActualBoundary,
    ...(isActualBoundary && {
        selectable: true,
    }),
    ...(component.properties?.parentNode && !isActualBoundary && { parentNode: component.properties.parentNode }),
    selected: selected,
  };
  return returnedNode;
};


export const nodeToComponent = (node: Node): DiagramComponent => {
  const propertiesToSave: Record<string, any> = { ...(node.data.properties || {}) };

  propertiesToSave.position = node.position;

  if (node.measured?.width && node.measured.width > 0) propertiesToSave.width = node.measured.width;
  else if (node.style?.width && typeof node.style.width === 'number' && node.style.width > 0) propertiesToSave.width = node.style.width;
  else if (node.width && node.width > 0) propertiesToSave.width = node.width;


  if (node.measured?.height && node.measured.height > 0) propertiesToSave.height = node.measured.height;
  else if (node.style?.height && typeof node.style.height === 'number' && node.style.height > 0) propertiesToSave.height = node.style.height;
  else if (node.height && node.height > 0) propertiesToSave.height = node.height;


  propertiesToSave.name = node.data.label || node.data.properties?.name || node.id;

  if (node.parentNode && node.data.isBoundary !== true) {
    propertiesToSave.parentNode = node.parentNode;
  } else {
    delete propertiesToSave.parentNode;
  }

  propertiesToSave.selected = !!node.selected;
  // Do not delete node.data.label from properties if it's the source of the name
  // delete propertiesToSave.label; 

  const baseDiagramComponent: Omit<DiagramComponent, 'stencilType' | 'iconName' | 'textColor' | 'boundaryColor' | 'isBoundary' | 'name' > = {
    id: node.id, // This is the unique instance ID of the node on the canvas
    type: node.type || 'Package', // This is the React Flow node type
    properties: propertiesToSave,
  };
   // Add name at the root of DiagramComponent, taken from propertiesToSave.name
  const componentName = propertiesToSave.name;


  if (node.data.isBoundary) {
    return {
      ...baseDiagramComponent,
      name: componentName,
      stencilType: 'infrastructure',
      iconName: node.data.iconName || 'ShieldCheck',
      textColor: node.data.textColor,
      boundaryColor: node.data.boundaryColor,
      isBoundary: true,
    } as DiagramComponent;
  } else {
    let stencilType: 'infrastructure' | 'process' = node.data.stencilType;
    if (!stencilType) {
      const processShapes = ['Circle', 'Diamond', 'Rectangle', 'Parallelogram', 'ArrowRight'];
      const infraIcons = ['HardDrive', 'Database', 'Cloud', 'Router', 'Server', 'ShieldCheck', 'User', 'Package', 'HardDrives'];
      if (processShapes.includes(node.type || '')) {
        stencilType = 'process';
      } else if (infraIcons.includes(node.type || '')) {
        stencilType = 'infrastructure';
      } else {
        stencilType = 'infrastructure'; 
      }
    }

    return {
      ...baseDiagramComponent,
      name: componentName,
      stencilType: stencilType,
      iconName: node.data.iconName || node.type || 'Package',
      textColor: node.data.textColor,
      isBoundary: false,
    } as DiagramComponent;
  }
};


export const connectionToEdge = (connection: DiagramConnection, isSelectedOverride?: boolean): Edge => {
  const selected = typeof isSelectedOverride === 'boolean' ? isSelectedOverride : (connection.selected || false);
  const connectionProperties = connection.properties || {};

  let userFacingName = connectionProperties.name || connection.label;
  if (!userFacingName || userFacingName.trim() === '' || userFacingName === connection.id) {
    userFacingName = 'Data Flow';
  }

  const defaultProps = {
    description: 'A data or process flow connection.',
    dataType: 'Generic',
    protocol: 'Sequence/TCP',
    securityConsiderations: 'Needs review',
    isBiDirectional: false,
  };

  const edgeDataProperties: Record<string, any> = {
    ...defaultProps,
    ...connectionProperties, // Saved properties override defaults
    name: userFacingName, // Ensure name is prioritized
  };
  
  const isBi = edgeDataProperties.isBiDirectional === true;

  return {
    id: connection.id,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle || undefined,
    targetHandle: connection.targetHandle || undefined,
    label: userFacingName,
    type: 'default', // Could be extended for different edge types later
    data: {
      label: userFacingName,
      properties: edgeDataProperties,
    },
    selected: selected,
    markerEnd: { type: 'arrowclosed' },
    markerStart: isBi ? { type: 'arrowclosed' } : undefined,
  };
};

export const edgeToConnection = (edge: Edge): DiagramConnection => {
  const edgeData = edge.data || {};
  const currentEdgeDataProperties = edgeData.properties || {};

  let connectionName = currentEdgeDataProperties.name || edge.label || edgeData.label;
  if (!connectionName || connectionName.trim() === '' || connectionName === edge.id) {
    connectionName = 'Data Flow';
  }
  
  const defaultProps = {
    description: 'A data or process flow connection.',
    dataType: 'Generic',
    protocol: 'Sequence/TCP',
    securityConsiderations: 'Needs review',
    isBiDirectional: false,
  };

  const propertiesToSave: Record<string, any> = {
    ...defaultProps,
    ...currentEdgeDataProperties, // Properties from edge data override defaults
    name: connectionName, // Ensure name is prioritized
    isBiDirectional: currentEdgeDataProperties.isBiDirectional === true, // Ensure boolean
  };

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle || undefined,
    targetHandle: edge.targetHandle || undefined,
    label: connectionName,
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

    if (!sourceNode || !targetNode ||
        !sourceNode.positionAbsolute || !sourceNode.width || !sourceNode.height ||
        !targetNode.positionAbsolute || !targetNode.width || !targetNode.height) {
        return false;
    }

    // Get center points of nodes, or handle points if available
    let sourcePos = {
        x: sourceNode.positionAbsolute.x + sourceNode.width / 2,
        y: sourceNode.positionAbsolute.y + sourceNode.height / 2
    };
    let targetPos = {
        x: targetNode.positionAbsolute.x + targetNode.width / 2,
        y: targetNode.positionAbsolute.y + targetNode.height / 2
    };

    // A simple straight line distance for now.
    // More complex calculations could use sourceHandle/targetHandle positions if available on edge.
    
    const minX = Math.min(sourcePos.x, targetPos.x) - tolerance;
    const maxX = Math.max(sourcePos.x, targetPos.x) + tolerance;
    const minY = Math.min(sourcePos.y, targetPos.y) - tolerance;
    const maxY = Math.max(sourcePos.y, targetPos.y) + tolerance;

    if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
        return false; // Quick check: if point is outside bounding box of segment + tolerance
    }

    const A = sourcePos;
    const B = targetPos;
    const P = point;

    // Distance from point P to line segment AB
    const l2 = (B.x - A.x) * (B.x - A.x) + (B.y - A.y) * (B.y - A.y);
    if (l2 === 0) return Math.sqrt((P.x - A.x) * (P.x - A.x) + (P.y - A.y) * (P.y - A.y)) < tolerance; // A and B are the same point

    let t = ((P.x - A.x) * (B.x - A.x) + (P.y - A.y) * (B.y - A.y)) / l2;
    t = Math.max(0, Math.min(1, t)); // Clamp t to the segment

    const closestPointX = A.x + t * (B.x - A.x);
    const closestPointY = A.y + t * (B.y - A.y);

    const dx = P.x - closestPointX;
    const dy = P.y - closestPointY;
    
    return (dx * dx + dy * dy) < (tolerance * tolerance);
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

    for (const node of nodes) {
        if (isClickOnNode(node, clickPos)) {
            if (node.data && node.data.isBoundary === true) {
                clickedBoundaryBoxes.push(node);
            } else {
                clickedNonBoundaryNodes.push(node);
            }
        }
    }

    if (clickedNonBoundaryNodes.length === 0 || clickedBoundaryBoxes.some(bn => isClickOnNode(bn, clickPos))) {
       for (const edge of edges) {
           if (isPointNearEdge(edge, clickPos, nodes, 10 / zoom)) { // Adjust tolerance by zoom
               clickedEdges.push(edge);
           }
       }
    }

    if (clickedNonBoundaryNodes.length > 0) {
        return clickedNonBoundaryNodes.sort((a, b) => {
            const zIndexA = calculateEffectiveZIndex(a.id, a.type as string, a.selected, a.zIndex, selectedElementIdGlobal);
            const zIndexB = calculateEffectiveZIndex(b.id, b.type as string, b.selected, b.zIndex, selectedElementIdGlobal);
            if (zIndexA !== zIndexB) return zIndexB - zIndexA; // Higher z-index first
            // If z-index is the same, smaller area nodes are considered "on top"
            const areaA = (a.width || 0) * (a.height || 0);
            const areaB = (b.width || 0) * (b.height || 0);
            return areaA - areaB; 
        })[0];
    }

    if (clickedEdges.length > 0) {
        // Basic: return the first one. Could be improved if edge z-indexing becomes necessary.
        // For now, edges are generally "behind" nodes unless nodes are transparent.
        return clickedEdges[0];
    }

    if (clickedBoundaryBoxes.length > 0) {
        return clickedBoundaryBoxes.sort((a, b) => {
            const zIndexA = calculateEffectiveZIndex(a.id, a.type as string, a.selected, a.zIndex, selectedElementIdGlobal);
            const zIndexB = calculateEffectiveZIndex(b.id, b.type as string, b.selected, b.zIndex, selectedElementIdGlobal);
             if (zIndexA !== zIndexB) return zIndexB - zIndexA; // Higher z-index first
            const areaA = (a.width || 0) * (a.height || 0);
            const areaB = (b.width || 0) * (b.height || 0);
            return areaB - areaA; // Larger area (more encompassing boundary) considered "behind" smaller ones
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
