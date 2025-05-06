import type { Node, Edge, XYPosition } from '@xyflow/react';
import type { Component as DiagramComponent, Connection as DiagramConnection } from '@/services/diagram';

/**
 * Converts a DiagramComponent to a ReactFlow Node.
 * @param component The diagram component to convert.
 * @param isSelectedOverride Optional boolean to override the selected state from component properties.
 */
export const componentToNode = (component: DiagramComponent, isSelectedOverride?: boolean): Node => {
  const defaultPosition: XYPosition = { x: Math.random() * 400 + 50, y: Math.random() * 200 + 50 };
  const position = component.properties?.position || defaultPosition;
  const type = component.type || 'default';
  const isBoundary = type === 'boundary';

  const defaultWidth = isBoundary ? 300 : 150; // Keep original default for boundaries
  const defaultHeight = isBoundary ? 350 : 80; // Keep original default for boundaries
  
  const minWidth = isBoundary ? 100 : 100; // Smaller min for more flexible boundaries
  const minHeight = isBoundary ? 100 : 50; // Smaller min for more flexible boundaries

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
      resizable: true, // All nodes are resizable when selected. Boundary resizing handled in CustomNode.
      minWidth: minWidth, 
      minHeight: minHeight, 
    },
    style: {
        width: width,
        height: height,
        // zIndex handled by CustomNode based on type and selected state
    },
    ...(isBoundary && {
        selectable: true, 
        connectable: false, 
        // For boundaries, allow them to expand by not setting extent: 'parent' here by default.
        // If a boundary should contain children strictly, parentNode + extent:'parent' would be set on children.
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
  if (node.width) propertiesToSave.width = node.width;
  if (node.height) propertiesToSave.height = node.height;
  
  propertiesToSave.name = node.data.label || node.data.properties?.name || node.id;

  if (node.parentNode) {
    propertiesToSave.parentNode = node.parentNode;
  } else {
    delete propertiesToSave.parentNode; 
  }

  propertiesToSave.selected = !!node.selected;

  delete propertiesToSave.label; 
  // 'resizable' is a UI concern, not typically part of the core model unless explicitly needed.
  // minWidth/minHeight are also primarily UI hints.
  // delete propertiesToSave.resizable; // We can keep it if it's useful for the model
  // delete propertiesToSave.minWidth;
  // delete propertiesToSave.minHeight;

  return {
    id: node.id,
    type: node.data?.type || node.type || 'default', 
    properties: propertiesToSave,
  };
};


/**
 * Converts a DiagramConnection to a ReactFlow Edge.
 */
export const connectionToEdge = (connection: DiagramConnection): Edge => {
  return {
    id: connection.id,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle || undefined,
    targetHandle: connection.targetHandle || undefined,
    label: connection.label || connection.properties?.name,
    type: 'smoothstep', // Default edge type
    animated: true,
    data: {
      label: connection.label || connection.properties?.name,
      properties: connection.properties || {
        name: 'Data Flow',
        description: '',
        dataType: '',
        protocol: '',
        securityConsiderations: '',
      },
    },
    selected: connection.selected || false,
    // Add zIndex if you want selected edges to be on top of non-selected nodes
    // style: { zIndex: connection.selected ? 20 : 2 }, // Example
  };
};

/**
 * Converts a ReactFlow Edge back to a DiagramConnection.
 */
export const edgeToConnection = (edge: Edge): DiagramConnection => {
  const propertiesToSave = { ...(edge.data?.properties || {}) };
  // Ensure name property is consistent with label
  propertiesToSave.name = edge.data?.label || edge.label || edge.id;

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.data?.label || edge.label,
    properties: propertiesToSave,
    selected: !!edge.selected,
  };
};
