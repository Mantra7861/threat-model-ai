
import type { Viewport } from '@xyflow/react'; // Need Viewport type
import { db, ensureFirebaseInitialized } from '@/lib/firebase/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  type FieldValue,
} from 'firebase/firestore';


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
 * Represents the data structure stored within a threat model document.
 */
interface ThreatModelData {
  components: Component[];
  connections: Connection[];
  viewport?: Viewport; // Add viewport
}

/**
 * Represents the full threat model document structure in Firestore.
 */
interface ThreatModelDocument {
  id?: string; // Firestore document ID, optional before saving
  userId: string;
  name: string;
  modelType: ModelType;
  data: ThreatModelData;
  createdDate: Timestamp | FieldValue; // For Firestore
  modifiedDate: Timestamp | FieldValue; // For Firestore
}

/**
 * Represents a diagram. Used mainly for runtime state before saving.
 */
export interface Diagram {
  /**
   * The unique identifier of the diagram (may be null if new).
   */
  id: string | null;
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
  /**
   * Optional viewport state for the diagram.
   */
  viewport?: Viewport;
}


/**
 * Asynchronously saves or updates a threat model in Firestore.
 *
 * @param userId The ID of the user saving the model.
 * @param modelId The current ID of the model (null if new).
 * @param modelName The name of the model.
 * @param modelType The type of the model.
 * @param components The components array.
 * @param connections The connections array.
 * @param viewport Optional viewport state.
 * @returns A promise that resolves to the model's ID (new or existing).
 */
export async function saveThreatModel(
  userId: string,
  modelId: string | null,
  modelName: string,
  modelType: ModelType,
  components: Component[],
  connections: Connection[],
  viewport?: Viewport
): Promise<string> { // Returns the modelId
  const { initialized, error } = ensureFirebaseInitialized();
  if (!initialized || !db) {
    throw new Error(error || "Firestore not initialized");
  }

  const modelData: ThreatModelData = { components, connections: connections ?? [], viewport };

  if (modelId) {
    // Update existing model
    const modelDocRef = doc(db, 'threatModels', modelId);
    await updateDoc(modelDocRef, {
      name: modelName,
      modelType: modelType,
      data: modelData,
      modifiedDate: serverTimestamp(),
    });
    console.log(`Threat model updated: ${modelId}`);
    return modelId;
  } else {
    // Create new model
    const collectionRef = collection(db, 'threatModels');
    const docRef = await addDoc(collectionRef, {
      userId: userId,
      name: modelName,
      modelType: modelType,
      data: modelData,
      createdDate: serverTimestamp(),
      modifiedDate: serverTimestamp(),
    } as Omit<ThreatModelDocument, 'id'>); // Ensure type matches Firestore structure
    console.log(`New threat model created: ${docRef.id}`);
    return docRef.id;
  }
}

/**
 * Information about a saved model, used for listing.
 */
export interface SavedModelInfo {
  id: string;
  name: string;
  modifiedDate?: Date;
}

/**
 * Asynchronously retrieves a list of saved threat models for a given user.
 *
 * @param userId The ID of the user whose models to retrieve.
 * @returns A promise that resolves to an array of SavedModelInfo objects.
 */
export async function getUserThreatModels(userId: string): Promise<SavedModelInfo[]> {
   const { initialized, error } = ensureFirebaseInitialized();
   if (!initialized || !db) {
     throw new Error(error || "Firestore not initialized");
   }
   const modelsCollectionRef = collection(db, 'threatModels');
   // Note: Firestore security rules require the query to filter by userId.
   const q = query(modelsCollectionRef, where('userId', '==', userId));
   const querySnapshot = await getDocs(q);
   return querySnapshot.docs.map(docSnap => {
       const data = docSnap.data();
       let modifiedDate: Date | undefined = undefined;
       if (data.modifiedDate && data.modifiedDate instanceof Timestamp) {
           modifiedDate = data.modifiedDate.toDate();
       }
       return {
           id: docSnap.id,
           name: data.name || 'Untitled Model',
           modifiedDate: modifiedDate
       } as SavedModelInfo;
   }).sort((a, b) => (b.modifiedDate?.getTime() || 0) - (a.modifiedDate?.getTime() || 0)); // Sort by date descending
}

/**
 * The structure of a loaded threat model ready for use in the application.
 */
export interface LoadedThreatModel {
    id: string;
    name: string;
    modelType: ModelType;
    components: Component[];
    connections: Connection[];
    viewport?: Viewport;
}

/**
 * Asynchronously retrieves a specific threat model by its ID from Firestore.
 *
 * @param modelId The ID of the threat model to retrieve.
 * @returns A promise that resolves to a LoadedThreatModel object or null if not found.
 */
export async function getThreatModelById(modelId: string): Promise<LoadedThreatModel | null> {
    const { initialized, error } = ensureFirebaseInitialized();
    if (!initialized || !db) {
      throw new Error(error || "Firestore not initialized");
    }
    const modelDocRef = doc(db, 'threatModels', modelId);
    const docSnap = await getDoc(modelDocRef);

    if (!docSnap.exists()) {
        console.error(`Threat model with ID ${modelId} not found.`);
        return null;
    }

    const data = docSnap.data();
    if (!data || !data.data) {
         console.error(`Threat model data field missing for ID ${modelId}.`);
         return null;
    }
    const modelData = data.data as ThreatModelData;

    return {
        id: docSnap.id,
        name: data.name || 'Untitled Model',
        modelType: data.modelType || 'infrastructure', // Default if missing
        components: modelData.components || [],
        connections: modelData.connections || [],
        viewport: modelData.viewport
    };
}


// Default empty diagram structure
export const getDefaultDiagram = (id: string | null, name: string, type: ModelType): Diagram => ({
  id, // Can be null for a new diagram
  name,
  modelType: type,
  components: [],
  connections: [],
  viewport: undefined, // Start with default viewport
});
