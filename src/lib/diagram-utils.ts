import type { Node, Edge, XYPosition } from '@xyflow/react';
import type { Component as DiagramComponent, Connection as DiagramConnection } from '@/services/diagram';

// Z-index constants for different node states and types
const BOUNDARY_DEFAULT_Z_INDEX = 0;
const BOUNDARY_SELECTED_Z_INDEX = 1; // Must be lower than non-boundary nodes unless it's the only thing selected
const NODE_DEFAULT_Z_INDEX = 2;
const NODE_SELECTED_Z_INDEX = 3; // Selected non-boundary nodes on top
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
    // If ReactFlow provides a zIndex (e.g. during drag), respect it
    if (rfProvidedZIndex !== undefined && rfProvidedZIndex !== null) {
        return rfProvidedZIndex;
    }

    const isBoundaryType = nodeType === 'boundary';
    // Consider the node selected if its own selected prop is true OR if it's the globally selected element
    const isEffectivelySelected = nodeSelected || (selectedElementIdGlobal === nodeId);

    if (isBoundaryType) {
        // Boundaries generally sit behind other nodes unless they are the specific item selected.
        // If a boundary is selected, it might come forward slightly, but still generally behind active non-boundary nodes.
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

  const defaultWidth = isBoundary ? 300 : 150; 
  const defaultHeight = isBoundary ? 350 : 80; 
  
  const minWidth = isBoundary ? 100 : 100; 
  const minHeight = isBoundary ? 100 : 50;

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
      type: type, // Ensure data.type is also set for CustomNode
      resizable: true, // All nodes are resizable by default, CustomNode can override for non-boundaries
      minWidth: minWidth, 
      minHeight: minHeight, 
    },
    style: { // Initial style, CustomNode might override or add to this
        width: width,
        height: height,
    },
    // Specific properties for boundary nodes
    ...(isBoundary && {
        selectable: true, // Boundaries are selectable
        connectable: false, // Boundaries usually don't have connection handles
        // zIndex: selected ? BOUNDARY_SELECTED_Z_INDEX : BOUNDARY_DEFAULT_Z_INDEX, // Initial z-index, can be dynamic
    }),
    // Specific properties for non-boundary nodes
    ...(!isBoundary && {
        // zIndex: selected ? NODE_SELECTED_Z_INDEX : NODE_DEFAULT_Z_INDEX, // Initial z-index
    }),
    ...(component.properties?.parentNode && { parentNode: component.properties.parentNode }),
    selected: selected,
    // Let calculateEffectiveZIndex handle dynamic zIndex in CustomNode or layout
  };
};

/**
 * Converts a ReactFlow Node back to a DiagramComponent.
 */
export const nodeToComponent = (node: Node): DiagramComponent => {
  const propertiesToSave: Record<string, any> = { ...(node.data.properties || {}) };

  propertiesToSave.position = node.position; // Current position
  if (node.measured?.width) propertiesToSave.width = node.measured.width; // Use measured if available
  else if (node.width) propertiesToSave.width = node.width; // Fallback to node.width (from style or initial)
  
  if (node.measured?.height) propertiesToSave.height = node.measured.height;
  else if (node.height) propertiesToSave.height = node.height;
  
  propertiesToSave.name = node.data.label || node.data.properties?.name || node.id;

  if (node.parentNode) {
    propertiesToSave.parentNode = node.parentNode;
  } else {
    // Ensure parentNode is explicitly removed if no longer parented
    // This prevents stale parentNode IDs if a node is dragged out of a parent.
    delete propertiesToSave.parentNode; 
  }

  propertiesToSave.selected = !!node.selected; // Capture current selection state

  // Don't save 'label' in properties if it's derived from 'name' or 'id'
  // Keep if 'label' is a distinct editable field, but usually it's for display.
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
    data: { // Ensure data object exists for properties and label
      label: connection.label || connection.properties?.name, // Duplicate label in data for consistency if needed
      properties: connection.properties || { // Default properties if none exist
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
  // Ensure properties exist, defaulting if necessary
  const edgeProperties = edge.data?.properties || {};
  const edgeLabel = edge.data?.label || edge.label || edge.id;

  const propertiesToSave = { 
    ...edgeProperties,
    name: edgeLabel, // Ensure name is captured, typically from the label
  };

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edgeLabel,
    properties: propertiesToSave,
    selected: !!edge.selected, // Capture current selection state
  };
};


/**
 * Checks if a click position is within the bounds of a node.
 * @param node The node to check.
 * @param clickPos The click position in flow coordinates.
 * @param zoom The current zoom level (can be used for fine-tuning, but typically not for basic hit-testing in flow coords).
 */
export const isClickOnNode = (
    node: Node,
    clickPos: XYPosition,
    zoom: number 
): boolean => {
    if (!node.positionAbsolute || typeof node.width !== 'number' || typeof node.height !== 'number') {
        // Node doesn't have necessary layout information yet
        return false;
    }

    const { x, y } = node.positionAbsolute;
    const { width, height } = node; // Use node.width/height which should be up-to-date

    return (
        clickPos.x >= x &&
        clickPos.x <= x + width &&
        clickPos.y >= y &&
        clickPos.y <= y + height
    );
};

/**
 * Gets the topmost interactive node at a click position, prioritizing non-boundaries.
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
    const clickedNodes = nodes
        .filter(node => isClickOnNode(node, clickPos, zoom)) // Find all nodes at click position
        .sort((a, b) => {
            // Calculate effective z-index for both nodes
            const zIndexA = calculateEffectiveZIndex(a.id, a.type as string, a.selected, a.zIndex, selectedElementIdGlobally);
            const zIndexB = calculateEffectiveZIndex(b.id, b.type as string, b.selected, b.zIndex, selectedElementIdGlobally);
            
            // 1. Primary sort: Higher z-index on top
            if (zIndexA !== zIndexB) {
                return zIndexB - zIndexA;
            }

            // 2. Secondary sort (if z-indexes are equal): Prioritize non-boundary nodes
            const aIsBoundary = a.type === 'boundary';
            const bIsBoundary = b.type === 'boundary';
            if (aIsBoundary && !bIsBoundary) return 1;  // b (non-boundary) comes before a (boundary)
            if (!aIsBoundary && bIsBoundary) return -1; // a (non-boundary) comes before b (boundary)

            // 3. Tertiary sort (if z-indexes and boundary status are same): Smaller area nodes on top
            // This helps select more specific, smaller nodes if they overlap with larger ones of same type/z-index
            const areaA = (a.width || 0) * (a.height || 0);
            const areaB = (b.width || 0) * (b.height || 0);
            if (areaA !== areaB) {
                return areaA - areaB;
            }
            
            // 4. Fallback (e.g. if nodes are identical in z, type, and area - unlikely but possible):
            // Could sort by node ID or keep original order, but usually not critical.
            return 0; 
        });

    return clickedNodes[0] || null; // Return the first node after sorting (topmost and highest priority)
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
