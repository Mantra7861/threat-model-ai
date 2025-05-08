
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
    /** Optional parent node ID for nesting */
    parentNode?: string;
    /** Optional selected state */
    selected?: boolean;
  };
}

/**
 * Represents a connection (edge) between components in the diagram.
 */
export interface Connection {
  /**
   * The unique identifier of the connection.
   */
  id: string;
  /**
   * The ID of the source component.
   */
  source: string;
  /**
   * The ID of the target component.
   */
  target: string;
  /**
   * Optional: The ID of the source handle.
   */
  sourceHandle?: string | null;
  /**
   * Optional: The ID of the target handle.
   */
  targetHandle?: string | null;
  /**
   * Optional: A visual label for the connection.
   */
  label?: string;
  /**
   * Custom properties of the connection (e.g., data type, protocol).
   */
  properties?: Record<string, any>;
  /**
   * Optional selected state for the connection.
   */
  selected?: boolean;
}

export type ModelType = 'infrastructure' | 'process';

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
   * The type of the model.
   */
  modelType?: ModelType;
  /**
   * The components in the diagram.
   */
components: Component[];
  /**
   * The connections (edges) in the diagram.
   */
  connections?: Connection[];
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
    modelType: 'infrastructure', // Default to infrastructure for existing mock
    components: [
      {
        id: 'web-server-1',
        type: 'server',
        properties: {
          name: 'Web Server',
          os: 'Ubuntu 22.04',
          ipAddress: '10.0.0.5',
          description: 'Handles incoming HTTP requests.',
          position: { x: 250, y: 100 }, 
          width: 150,
          height: 80,
          selected: false,
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
          position: { x: 250, y: 300 }, 
          width: 150,
          height: 80,
          selected: false,
        },
      },
      {
        id: 'api-gw-1',
        type: 'service', 
        properties: {
            name: 'API Gateway',
            provider: 'Cloud Provider',
            description: 'Manages API access.',
            position: { x: 50, y: 200}, 
            width: 150,
            height: 80,
            selected: false,
        }
      },
      {
        id: 'trust-boundary-1',
        type: 'boundary',
        properties: {
            name: 'Internal Network',
            description: 'Internal trusted network zone.',
            position: { x: 180, y: 50 }, 
            width: 300, 
            height: 350, 
            selected: false,
        }
      }
    ],
    connections: [
      { 
        id: 'edge-api-web', 
        source: 'api-gw-1', target: 'web-server-1', 
        sourceHandle: 'right', targetHandle: 'left', 
        label: 'HTTPS Traffic', 
        properties: { name: 'HTTPS Traffic', protocol: 'HTTPS/TLS', dataType: 'JSON API Calls', securityConsiderations: 'Input validation, WAF' },
        selected: false,
      },
      { 
        id: 'edge-web-db', 
        source: 'web-server-1', target: 'db-1', 
        sourceHandle: 'bottom', targetHandle: 'top',
        label: 'DB Queries',
        properties: { name: 'DB Queries', protocol: 'TCP/IP (PostgreSQL)', dataType: 'SQL', securityConsiderations: 'Parameterized queries, network segmentation' },
        selected: false,
      },
    ],
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
  console.log('Saving diagram:', JSON.stringify(diagram, null, 2)); 
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log(`Diagram ${diagram.id} (type: ${diagram.modelType || 'unknown'}) simulated save complete.`);
}

// Default empty diagram structure
export const getDefaultDiagram = (id: string, name: string, type: ModelType): Diagram => ({
  id,
  name,
  modelType: type,
  components: [],
  connections: [],
});
