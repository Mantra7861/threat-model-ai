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

  // Default dimensions - boundaries are larger
  const defaultWidth = isBoundary ? 350 : 150;
  const defaultHeight = isBoundary ? 400 : 80;

  // Min dimensions for resizable nodes
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
      properties: component.properties || {},
      type: type, // Pass type to data for CustomNode logic and property panel
      resizable: !isBoundary, // Boundaries are typically not resizable by corner handles
      minWidth: minWidth, // Pass minWidth for NodeResizer
      minHeight: minHeight, // Pass minHeight for NodeResizer
    },
    style: {
        width: width,
        height: height,
        zIndex: isBoundary ? 0 : 1, // Keep boundaries behind other elements
    },
    // Specify drag handle for non-boundary nodes
    ...(!isBoundary && { dragHandle: '.drag-handle' }),
    // Boundaries properties
    ...(isBoundary && {
        selectable: true, // Boundaries can be selected
        connectable: false, // Boundaries usually don't have connection handles
        dragHandle: undefined, // Boundaries are dragged by their body
    }),
    // Parent node information for nesting
    ...(component.properties?.parentNode && { parentNode: component.properties.parentNode }),
    selected: component.properties?.selected || false, // Persist selection state if available
  };
};

/**
 * Converts a ReactFlow Node back to a DiagramComponent.
 */
export const nodeToComponent = (node: Node): DiagramComponent => {
  // Create a mutable copy of node.data.properties to avoid modifying the original node's data directly
  const propertiesToSave = { ...(node.data.properties || {}) };

  // Update/add position from the node itself
  propertiesToSave.position = node.position;

  // Update/add dimensions from node.width/height (set by resizer) or node.style
  if (node.width) propertiesToSave.width = node.width;
  else if (node.style?.width) propertiesToSave.width = Number(node.style.width);

  if (node.height) propertiesToSave.height = node.height;
  else if (node.style?.height) propertiesToSave.height = Number(node.style.height);
  
  // Ensure name is saved from label (which might have been edited)
  propertiesToSave.name = node.data.label || node.id;

  // Persist parentNode if it exists
  if (node.parentNode) {
    propertiesToSave.parentNode = node.parentNode;
  } else {
    // If node.parentNode is null/undefined, ensure it's removed from properties if it was there
    delete propertiesToSave.parentNode;
  }

  // Persist selection state
  propertiesToSave.selected = !!node.selected;


  // Remove internal/derived data properties that shouldn't be saved in 'properties' blob directly
  // (like 'type' if it's already top-level, 'resizable', 'minWidth', 'minHeight', 'label')
  delete propertiesToSave.type; // 'type' is a top-level field in DiagramComponent
  delete propertiesToSave.resizable;
  delete propertiesToSave.minWidth;
  delete propertiesToSave.minHeight;
  delete propertiesToSave.label; // 'label' is derived from 'name'


  return {
    id: node.id,
    type: node.data?.type || node.type || 'default', // Ensure type is correctly sourced
    properties: propertiesToSave,
  };
};
