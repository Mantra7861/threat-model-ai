
import type { Node, XYPosition } from '@xyflow/react';
import type { Component as DiagramComponent } from '@/services/diagram';

/**
 * Converts a DiagramComponent to a ReactFlow Node.
 *
 * @param component The DiagramComponent to convert.
 * @returns A ReactFlow Node object.
 */
export const componentToNode = (component: DiagramComponent): Node => {
  const defaultPosition: XYPosition = { x: Math.random() * 500, y: Math.random() * 300 };
  const position = component.properties?.position || defaultPosition;
  const type = component.type || 'default'; // Ensure type is always defined
  const isBoundary = type === 'boundary';
  const defaultWidth = isBoundary ? 300 : 150;
  const defaultHeight = isBoundary ? 350 : 80;
  const width = component.properties?.width ?? defaultWidth;
  const height = component.properties?.height ?? defaultHeight;

  return {
    id: component.id,
    type: type, // Use the determined type
    position: position,
    data: {
      label: component.properties?.name || component.id, // Use ID as fallback label
      properties: component.properties || {}, // Ensure properties object exists
      type: type, // Pass type to data for CustomNode logic
      resizable: !isBoundary, // Make non-boundary nodes resizable by default
    },
    style: { // Use saved dimensions or defaults
        width: width,
        height: height,
        // Apply boundary-specific styles directly if needed, but prefer class-based styling
        ...(isBoundary && {
            // backgroundColor: 'rgba(255, 0, 0, 0.05)', // Prefer CSS class
            // borderColor: 'rgba(255, 0, 0, 0.4)', // Prefer CSS class
            // borderStyle: 'dashed', // Prefer CSS class
            // borderWidth: 2, // Prefer CSS class
            zIndex: 0, // Keep boundaries behind other elements
        }),
    },
    // Specify drag handle if not a boundary
    ...(!isBoundary && { dragHandle: '.drag-handle' }),
    // Add parentNode if defined in properties (for nesting)
    ...(component.properties?.parentNode && { parentNode: component.properties.parentNode }),
    ...(isBoundary && { selectable: true, connectable: false, dragHandle: undefined }), // Boundaries usually aren't connectable or dragged by handle
  };
};

/**
 * Converts a ReactFlow Node back to a DiagramComponent.
 *
 * @param node The ReactFlow Node to convert.
 * @returns A DiagramComponent object.
 */
export const nodeToComponent = (node: Node): DiagramComponent => ({
  id: node.id,
  type: node.data.type || node.type || 'default', // Ensure type is saved
  properties: {
    // Persist all properties from node.data.properties
    ...(node.data.properties || {}),
    // Explicitly overwrite/add position, dimensions, and name from node structure
    position: node.position,
    width: node.width || node.style?.width, // Prefer direct width if available (e.g., after resize)
    height: node.height || node.style?.height, // Prefer direct height if available
    name: node.data.label || node.id, // Ensure name is saved back from label, fallback to ID
    // Add parentNode if it exists on the node
    ...(node.parentNode && { parentNode: node.parentNode }),
  },
});
