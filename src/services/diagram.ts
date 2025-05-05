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
properties: Record<string, any>;
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
}

/**
 * Asynchronously retrieves a diagram by its ID.
 *
 * @param id The ID of the diagram to retrieve.
 * @returns A promise that resolves to a Diagram object.
 */
export async function getDiagram(id: string): Promise<Diagram> {
  // TODO: Implement this by calling an API.

  return {
    id: '1',
    name: 'Sample Diagram',
    components: [
      {
        id: '1',
        type: 'server',
        properties: {
          name: 'Web Server',
          os: 'Linux',
        },
      },
      {
        id: '2',
        type: 'database',
        properties: {
          name: 'Database Server',
          engine: 'PostgreSQL',
        },
      },
    ],
  };
}

/**
 * Asynchronously saves a diagram.
 *
 * @param diagram The diagram to save.
 * @returns A promise that resolves when the diagram is saved.
 */
export async function saveDiagram(diagram: Diagram): Promise<void> {
  // TODO: Implement this by calling an API.
  console.log('Diagram saved:', diagram);
}
