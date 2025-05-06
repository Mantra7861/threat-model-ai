import type { Node, XYPosition } from '@xyflow/react';
import type { Component as DiagramComponent } from '@/services/diagram';

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

  // Default dimensions - boundaries are typically larger
  const defaultWidth = isBoundary ? 350 : 150;
  const defaultHeight = isBoundary ? 400 : 80;
  
  // Minimum dimensions for resizing
  const minWidth = isBoundary ? 200 : 100; 
  const minHeight = isBoundary ? 250 : 50;

  const width = component.properties?.width ?? defaultWidth;
  const height = component.properties?.height ?? defaultHeight;

  const selected = typeof isSelectedOverride === 'boolean' ? isSelectedOverride : (component.properties?.selected || false);

  return {
    id: component.id,
    type: type, // This will be used by React Flow to determine which custom node component to render
    position: position,
    data: {
      label: component.properties?.name || component.id,
      properties: { ...component.properties }, // Store all original properties
      type: type, // Store the structural type in data as well, for easier access in property panel & AI
      resizable: !isBoundary, // Only non-boundary nodes are resizable by default
      minWidth: minWidth, 
      minHeight: minHeight, 
    },
    style: {
        width: width,
        height: height,
        zIndex: isBoundary ? 0 : 1, // Ensure boundaries are visually behind other elements
    },
    // Add drag handle only for non-boundary nodes
    ...(!isBoundary && { dragHandle: '.drag-handle' }),
    // Configuration specific to boundary nodes
    ...(isBoundary && {
        selectable: true, // Boundaries should be selectable
        connectable: false, // Boundaries usually don't have connection handles
        dragHandle: undefined, // Boundaries are dragged by their body, not a specific handle
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
  // Persist width and height if they exist (e.g., from resizing)
  if (node.width) propertiesToSave.width = node.width;
  if (node.height) propertiesToSave.height = node.height;
  
  // 'name' is the source of truth for the label, ensure it's in properties
  propertiesToSave.name = node.data.label || node.data.properties?.name || node.id;

  if (node.parentNode) {
    propertiesToSave.parentNode = node.parentNode;
  } else {
    delete propertiesToSave.parentNode; // Ensure parentNode is removed if not present
  }

  // Persist selected state
  propertiesToSave.selected = !!node.selected;


  // Remove React Flow specific or derived data properties that are not part of the core component model
  // 'type' in node.data.type is the structural type we want to persist. node.type is for React Flow rendering.
  // 'resizable', 'minWidth', 'minHeight' are for UI control, not typically part of the persistent model directly,
  // but width/height are.
  delete propertiesToSave.label; // 'name' is the source of truth
  delete propertiesToSave.resizable;
  delete propertiesToSave.minWidth;
  delete propertiesToSave.minHeight;
  // Keep data.type as it was intentionally stored there.

  return {
    id: node.id,
    type: node.data?.type || node.type || 'default', // Fallback to node.type if data.type isn't there
    properties: propertiesToSave,
  };
};
