
/**
 * Represents a component in the diagram.
 */
export interface Component {
  /**
   * The unique identifier of the component.
   */
id: string;
  /**
   * The type of the component (e.g., server, database).
   */
type: string;
  /**
   * The properties of the component.
   */
properties: Record<string, any> & {
    /** Optional position for saving layout */
    position?: { x: number; y: number };
    /** Optional width for saving layout */
    width?: number;
    /** Optional height for saving layout */
    height?: number;
    /** Name property is commonly used */
    name?: string;
  };
}

/**
 * Represents a diagram.
 */
export interface Diagram {
  /**
   * The unique identifier of the diagram.
   */
id: string;
  /**
   * The name of the diagram.
   */
name: string;
  /**
   * The components in the diagram.
   */
components: Component[];
  /**
   * Optional: Add connections/edges if needed
   */
  // connections?: Array<{ source: string; target: string; sourceHandle?: string; targetHandle?: string }>;
}

/**
 * Asynchronously retrieves a diagram by its ID.
 * Simulates fetching data with layout properties.
 *
 * @param id The ID of the diagram to retrieve.
 * @returns A promise that resolves to a Diagram object.
 */
export async function getDiagram(id: string): Promise<Diagram> {
  console.log(`Fetching diagram with ID: ${id}`);
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 300));

  // Return mock data including position, width, and height
  return {
    id: '1',
    name: 'Sample E-commerce Architecture',
    components: [
      {
        id: 'web-server-1',
        type: 'server',
        properties: {
          name: 'Web Server',
          os: 'Ubuntu 22.04',
          ipAddress: '10.0.0.5',
          description: 'Handles incoming HTTP requests.',
          position: { x: 250, y: 50 },
          width: 150,
          height: 80,
        },
      },
      {
        id: 'db-1',
        type: 'database',
        properties: {
          name: 'Customer DB',
          engine: 'PostgreSQL 14',
          storageGB: 512,
          description: 'Stores customer information.',
          position: { x: 250, y: 250 },
          width: 150,
          height: 80,
        },
      },
      {
        id: 'api-gw-1',
        type: 'service', // Using 'service' for cloud-like components
        properties: {
            name: 'API Gateway',
            provider: 'Cloud Provider',
            description: 'Manages API access.',
            position: { x: 50, y: 150},
            width: 150,
            height: 80,
        }
      },
      {
        id: 'trust-boundary-1',
        type: 'boundary',
        properties: {
            name: 'Internal Network',
            description: 'Internal trusted network zone.',
            position: { x: 180, y: 20 },
            width: 300,
            height: 350,
        }
      }
    ],
    // Add mock connections if your model supports them
    // connections: [
    //   { source: 'api-gw-1', target: 'web-server-1', sourceHandle: 'right', targetHandle: 'left' },
    //   { source: 'web-server-1', target: 'db-1', sourceHandle: 'bottom', targetHandle: 'top' },
    // ],
  };
}

/**
 * Asynchronously saves a diagram.
 * Simulates saving data including layout properties.
 *
 * @param diagram The diagram to save.
 * @returns A promise that resolves when the diagram is saved.
 */
export async function saveDiagram(diagram: Diagram): Promise<void> {
  console.log('Saving diagram:', JSON.stringify(diagram, null, 2)); // Pretty print the diagram object
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  // In a real app, you would send this data to your backend API
  // e.g., fetch('/api/diagrams', { method: 'POST', body: JSON.stringify(diagram) });
  console.log(`Diagram ${diagram.id} simulated save complete.`);
}
