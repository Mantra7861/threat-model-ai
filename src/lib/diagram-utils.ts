import type { Node, Edge, XYPosition } from '@xyflow/react';
import type { Component as DiagramComponent, Connection as DiagramConnection } from '@/services/diagram';

// Z-index constants for different node states and types
const BOUNDARY_DEFAULT_Z_INDEX = 0; // Boundaries are at the bottom
const BOUNDARY_SELECTED_Z_INDEX = 1; // Selected boundaries slightly above default boundaries, but still below other nodes
const NODE_DEFAULT_Z_INDEX = 10;    // Non-boundary nodes start higher
const NODE_SELECTED_Z_INDEX = 11;   // Selected non-boundary nodes are on top of other non-boundary nodes
const HANDLE_Z_INCREMENT = 1; // Handles should be above their parent node
const RESIZER_Z_INCREMENT = 5; // Resizer should be on top of everything related to the node

/**
 * Calculates the effective z-index for a node.
 * This helps in determining rendering order and click priority.
 * @param nodeId The ID of the node.
 * @param nodeType The type of the node (e.g., 'server', 'boundary').
 * @param nodeSelected Whether the node itself is currently selected.
 * @param rfProvidedZIndex The z-index provided by React Flow (e.g., during drag).
 * @param selectedElementIdGlobal The ID of the globally selected element in the diagram.
 */
export const calculateEffectiveZIndex = (
    nodeId: string,
    nodeType: string,
    nodeSelected: boolean | undefined, // Selected state of this specific node
    rfProvidedZIndex: number | undefined,
    selectedElementIdGlobal: string | null // ID of the element selected in the wider application state
): number => {
    // If ReactFlow provides a zIndex (e.g. during drag), respect it, but ensure it's above our base for non-boundaries
    if (rfProvidedZIndex !== undefined && rfProvidedZIndex !== null) {
        return nodeType === 'boundary' ? Math.max(rfProvidedZIndex, BOUNDARY_DEFAULT_Z_INDEX) : Math.max(rfProvidedZIndex, NODE_DEFAULT_Z_INDEX);
    }

    const isBoundaryType = nodeType === 'boundary';
    // Consider the node selected if its own selected prop is true OR if it's the globally selected element
    const isEffectivelySelected = nodeSelected || (selectedElementIdGlobal === nodeId);

    if (isBoundaryType) {
        // Boundaries always stay behind non-boundary nodes.
        return isEffectivelySelected ? BOUNDARY_SELECTED_Z_INDEX : BOUNDARY_DEFAULT_Z_INDEX;
    }
    // Non-boundary nodes
    return isEffectivelySelected ? NODE_SELECTED_Z_INDEX : NODE_DEFAULT_Z_INDEX;
};


/**
 * Converts a DiagramComponent to a ReactFlow Node.
 */
export const componentToNode = (component: DiagramComponent, isSelectedOverride?: boolean): Node => {
  const defaultPosition: XYPosition = { x: Math.random() * 400 + 50, y: Math.random() * 200 + 50 };
  const position = component.properties?.position || defaultPosition;
  const type = component.type || 'default';
  const isBoundary = type === 'boundary';

  const defaultWidth = isBoundary ? 400 : 150; // Boundary wider by default
  const defaultHeight = isBoundary ? 400 : 80; // Boundary taller by default
  
  const minWidth = isBoundary ? 200 : 100; // Min width for boundary
  const minHeight = isBoundary ? 200 : 50; // Min height for boundary

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
      resizable: true, // All nodes can be resizable; CustomNode manages visibility of resizer
      minWidth: minWidth, 
      minHeight: minHeight, 
    },
    style: { 
        width: width,
        height: height,
    },
    ...(isBoundary && {
        selectable: true, 
        connectable: false, 
        // zIndex explicitly set via calculateEffectiveZIndex in CustomNode
    }),
    ...(!isBoundary && {
        // zIndex explicitly set via calculateEffectiveZIndex in CustomNode
    }),
    ...(component.properties?.parentNode && { parentNode: component.properties.parentNode }),
    selected: selected,
  };
};

/**
 * Converts a ReactFlow Node back to a DiagramComponent.
 */
export const nodeToComponent = (node: Node): DiagramComponent => {
  const propertiesToSave: Record<string, any> = { ...(node.data.properties || {}) };

  propertiesToSave.position = node.position; 
  
  // Use measured dimensions if available, otherwise current style/node dimensions
  if (node.measured?.width && node.measured.width > 0) propertiesToSave.width = node.measured.width;
  else if (node.width && node.width > 0) propertiesToSave.width = node.width;
  
  if (node.measured?.height && node.measured.height > 0) propertiesToSave.height = node.measured.height;
  else if (node.height && node.height > 0) propertiesToSave.height = node.height;
  
  propertiesToSave.name = node.data.label || node.data.properties?.name || node.id;

  if (node.parentNode) {
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
 */
export const isClickOnNode = (
    node: Node,
    clickPos: XYPosition,
    zoom: number // zoom is not used here, but kept for signature consistency if needed later
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
 * Gets the topmost interactive node at a click position.
 * Prioritizes non-boundary nodes over boundary nodes if they occupy the same space.
 * If multiple non-boundary nodes overlap, the one with the highest z-index is chosen.
 * If z-indexes are equal for non-boundary nodes, the smallest area node is chosen.
 * If a boundary node is clicked and no non-boundary node is at that exact point, the boundary is chosen.
 * @param nodes Array of all nodes.
 * @param clickPos Click position in flow coordinates.
 * @param zoom Current zoom level.
 * @param selectedElementIdGlobally ID of the currently selected element in the application.
 */
export const getTopmostNodeAtClick = (
    nodes: Node[],
    clickPos: XYPosition,
    zoom: number,
    selectedElementIdGlobally: string | null
): Node | null => {
    const clickedInteractiveNodes: Node[] = [];
    const clickedBoundaryNodes: Node[] = [];

    for (const node of nodes) {
        if (isClickOnNode(node, clickPos, zoom)) {
            if (node.type === 'boundary') {
                clickedBoundaryNodes.push(node);
            } else {
                clickedInteractiveNodes.push(node);
            }
        }
    }

    // If any non-boundary (interactive) nodes are clicked, prioritize them
    if (clickedInteractiveNodes.length > 0) {
        return clickedInteractiveNodes.sort((a, b) => {
            const zIndexA = calculateEffectiveZIndex(a.id, a.type as string, a.selected, a.zIndex, selectedElementIdGlobally);
            const zIndexB = calculateEffectiveZIndex(b.id, b.type as string, b.selected, b.zIndex, selectedElementIdGlobally);
            
            if (zIndexA !== zIndexB) return zIndexB - zIndexA; // Higher z-index first

            const areaA = (a.width || 0) * (a.height || 0);
            const areaB = (b.width || 0) * (b.height || 0);
            if (areaA !== areaB) return areaA - areaB; // Smaller area first

            return 0;
        })[0];
    }

    // If no interactive nodes are clicked, but boundary nodes are, select the topmost boundary
    if (clickedBoundaryNodes.length > 0) {
        return clickedBoundaryNodes.sort((a, b) => {
            const zIndexA = calculateEffectiveZIndex(a.id, a.type as string, a.selected, a.zIndex, selectedElementIdGlobally);
            const zIndexB = calculateEffectiveZIndex(b.id, b.type as string, b.selected, b.zIndex, selectedElementIdGlobally);
            
            if (zIndexA !== zIndexB) return zIndexB - zIndexA; // Higher z-index first
            
            // For boundaries, if z-index is same, larger one (parent) might be preferred if click is ambiguous
            // but for now, smaller area (more specific boundary) might be better. Let's test with smaller.
            const areaA = (a.width || 0) * (a.height || 0);
            const areaB = (b.width || 0) * (b.height || 0);
            if (areaA !== areaB) return areaA - areaB;

            return 0;
        })[0];
    }
    
    return null; // No node found at click position
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