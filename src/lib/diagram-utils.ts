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
      type: type, 
      resizable: true, 
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

  return {
    id: node.id,
    type: node.data?.type || node.type || 'default', 
    properties: propertiesToSave,
  };
};


/**
 * Converts a DiagramConnection to a ReactFlow Edge.
 * @param connection The diagram connection to convert.
 * @param isSelectedOverride Optional boolean to override the selected state from connection properties.
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
        description: '',
        dataType: '',
        protocol: '',
        securityConsiderations: '',
      },
    },
    selected: selected,
  };
};

/**
 * Converts a ReactFlow Edge back to a DiagramConnection.
 */
export const edgeToConnection = (edge: Edge): DiagramConnection => {
  const propertiesToSave = { ...(edge.data?.properties || {}) };
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

