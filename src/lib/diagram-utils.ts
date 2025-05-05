
import type { Node } from '@xyflow/react';
import type { Component as DiagramComponent } from '@/services/diagram';

/**
 * Converts a DiagramComponent to a ReactFlow Node.
 *
 * @param component The DiagramComponent to convert.
 * @returns A ReactFlow Node object.
 */
export const componentToNode = (component: DiagramComponent): Node => ({
  id: component.id,
  type: component.type || 'default', // Ensure a type is always present
  position: component.properties?.position || { x: Math.random() * 500, y: Math.random() * 300 }, // Use saved position or random
  data: {
    label: component.properties?.name || component.type,
    properties: component.properties,
    type: component.type, // Pass type to data for CustomNode
    resizable: component.type !== 'boundary', // Make non-boundary nodes resizable
  },
  style: { // Use saved dimensions or defaults
      width: component.properties?.width || (component.type === 'boundary' ? 300 : 150),
      height: component.properties?.height || (component.type === 'boundary' ? 350 : 80),
  },
  // Specify drag handle if not a boundary
  ...(component.type !== 'boundary' && { dragHandle: '.drag-handle' }),
  // Add parentNode if defined in properties (for nesting)
  ...(component.properties?.parentNode && { parentNode: component.properties.parentNode }),
  ...(component.type === 'boundary' && { // Ensure boundaries can contain other nodes
        style: {
          ...component.properties?.style,
          backgroundColor: 'rgba(255, 0, 0, 0.05)', // Example styling for boundary visibility
          borderColor: 'rgba(255, 0, 0, 0.4)',
          borderStyle: 'dashed',
          borderWidth: 2,
          width: component.properties?.width || 300,
          height: component.properties?.height || 350,
        },
        zIndex: 0, // Keep boundaries behind other elements
      }),
});

/**
 * Converts a ReactFlow Node back to a DiagramComponent.
 *
 * @param node The ReactFlow Node to convert.
 * @returns A DiagramComponent object.
 */
export const nodeToComponent = (node: Node): DiagramComponent => ({
  id: node.id,
  type: node.data.type,
  properties: {
    // Persist all properties from node.data.properties
    ...(node.data.properties || {}),
    // Explicitly overwrite/add position, dimensions, and name from node structure
    position: node.position,
    width: node.style?.width,
    height: node.style?.height,
    name: node.data.label, // Ensure name is saved back from label
    // Add parentNode if it exists on the node
    ...(node.parentNode && { parentNode: node.parentNode }),
  },
});
