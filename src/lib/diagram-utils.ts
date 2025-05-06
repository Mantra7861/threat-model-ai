import type { Node, XYPosition } from '@xyflow/react';
import type { Component as DiagramComponent } from '@/services/diagram';

/**
 * Converts a DiagramComponent to a ReactFlow Node.
 */
export const componentToNode = (component: DiagramComponent): Node => {
  const defaultPosition: XYPosition = { x: Math.random() * 400 + 50, y: Math.random() * 200 + 50 };
  const position = component.properties?.position || defaultPosition;
  const type = component.type || 'default';
  const isBoundary = type === 'boundary';

  const defaultWidth = isBoundary ? 350 : 150;
  const defaultHeight = isBoundary ? 400 : 80;
  const minWidth = isBoundary ? 200 : 100; 
  const minHeight = isBoundary ? 250 : 50;

  const width = component.properties?.width ?? defaultWidth;
  const height = component.properties?.height ?? defaultHeight;

  return {
    id: component.id,
    type: type,
    position: position,
    data: {
      label: component.properties?.name || component.id,
      properties: { ...component.properties }, // Make a copy of properties
      type: type, 
      resizable: !isBoundary, 
      minWidth: minWidth, 
      minHeight: minHeight, 
    },
    style: {
        width: width,
        height: height,
        zIndex: isBoundary ? 0 : 1, // Boundaries behind other elements
    },
    ...(!isBoundary && { dragHandle: '.drag-handle' }),
    ...(isBoundary && {
        selectable: true, 
        connectable: false, 
        dragHandle: undefined, // Boundaries dragged by body
    }),
    ...(component.properties?.parentNode && { parentNode: component.properties.parentNode }),
    selected: component.properties?.selected || false,
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
  
  // 'name' is the source of truth for the label, ensure it's in properties
  propertiesToSave.name = node.data.label || node.id;

  if (node.parentNode) {
    propertiesToSave.parentNode = node.parentNode;
  } else {
    delete propertiesToSave.parentNode;
  }

  propertiesToSave.selected = !!node.selected;


  // Remove React Flow specific or derived data properties that are not part of the core component model
  // but keep essential ones like 'name', 'type' (if it was in original properties for some reason)
  // 'type' is primary on DiagramComponent, 'label' is derived from 'name'
  // 'resizable', 'minWidth', 'minHeight' are for UI control, not persistent model data typically.
  delete propertiesToSave.label; 
  delete propertiesToSave.resizable;
  delete propertiesToSave.minWidth;
  delete propertiesToSave.minHeight;
  // 'type' from node.data.type is structural, already handled by node.type -> component.type

  return {
    id: node.id,
    type: node.data?.type || node.type || 'default',
    properties: propertiesToSave,
  };
};
