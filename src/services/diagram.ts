
import type { Viewport } from '@xyflow/react';
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
  properties?: Record<string, any> & {
    isBiDirectional?: boolean; // New property for bi-directional arrows
  };
  /**
   * Optional selected state for the connection.
   */
  selected?: boolean;
}

export type ModelType = 'infrastructure' | 'process';

/**
 * Represents a single generated report entry.
 */
export interface ReportEntry {
  reportName: string;
  reportData: string; // HTML content of the report
  createdDate: Date | Timestamp; // Date on client, Timestamp in Firestore
}


/**
 * Represents the data structure stored within a threat model document.
 */
interface ThreatModelData {
  components: Component[];
  connections: Connection[];
  viewport?: Viewport;
  reports?: ReportEntry[]; // Array of saved reports
}

/**
 * Represents the full threat model document structure in Firestore.
 */
interface ThreatModelDocument {
  id?: string;
  userId: string;
  name: string;
  modelType: ModelType;
  data: ThreatModelData;
  createdDate: Timestamp | FieldValue;
  modifiedDate: Timestamp | FieldValue;
}

/**
 * Represents a diagram. Used mainly for runtime state before saving.
 */
export interface Diagram {
  id: string | null;
  name: string;
  modelType?: ModelType;
  components: Component[];
  connections?: Connection[];
  viewport?: Viewport;
  reports?: ReportEntry[]; // For runtime management
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
 * @param reportsToSave Optional array of reports to save.
 * @returns A promise that resolves to the model's ID (new or existing).
 */
export async function saveThreatModel(
  userId: string,
  modelId: string | null,
  modelName: string,
  modelType: ModelType,
  components: Component[],
  connections: Connection[],
  viewport?: Viewport,
  reportsToSave?: ReportEntry[]
): Promise<string> {
  const { initialized, error } = ensureFirebaseInitialized();
  if (!initialized || !db) {
    throw new Error(error || "Firestore not initialized for saveThreatModel");
  }

  const processedReports = (reportsToSave || []).map(report => ({
    ...report,
    createdDate: report.createdDate instanceof Date ? Timestamp.fromDate(report.createdDate) : report.createdDate,
  }));

  const modelData: ThreatModelData = { 
    components, 
    connections: connections ?? [], 
    viewport,
    reports: processedReports,
  };

  if (modelId) {
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
    const collectionRef = collection(db, 'threatModels');
    const docRef = await addDoc(collectionRef, {
      userId: userId,
      name: modelName,
      modelType: modelType,
      data: modelData,
      createdDate: serverTimestamp(),
      modifiedDate: serverTimestamp(),
    } as Omit<ThreatModelDocument, 'id'>);
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
     throw new Error(error || "Firestore not initialized for getUserThreatModels");
   }
   const modelsCollectionRef = collection(db, 'threatModels');
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
   }).sort((a, b) => (b.modifiedDate?.getTime() || 0) - (a.modifiedDate?.getTime() || 0));
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
    reports?: ReportEntry[]; // Array of saved reports
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
      // console.error("getThreatModelById: Firebase not initialized or db is null.");
      throw new Error(error || "Firestore not initialized for getThreatModelById");
    }
    const modelDocRef = doc(db, 'threatModels', modelId);
    // console.log(`getThreatModelById: Fetching model ${modelId}`);
    const docSnap = await getDoc(modelDocRef);

    if (!docSnap.exists()) {
        // console.error(`getThreatModelById: Threat model with ID ${modelId} not found.`);
        return null;
    }

    const data = docSnap.data();
    if (!data || !data.data) {
         // console.error(`getThreatModelById: Threat model data field missing for ID ${modelId}. Document data:`, data);
         return null;
    }
    const modelData = data.data as ThreatModelData;
    // console.log(`getThreatModelById: Successfully fetched document data for ${modelId}:`, data);
    // console.log(`getThreatModelById: Extracted modelData (components, connections, viewport) for ${modelId}:`, modelData);

    const reports = (modelData.reports || []).map(report => ({
      ...report,
      createdDate: report.createdDate instanceof Timestamp ? report.createdDate.toDate() : report.createdDate,
    }));


    return {
        id: docSnap.id,
        name: data.name || 'Untitled Model',
        modelType: data.modelType || 'infrastructure',
        components: modelData.components || [], // Ensure components is an array
        connections: modelData.connections || [], // Ensure connections is an array
        viewport: modelData.viewport,
        reports: reports,
    };
}


export const getDefaultDiagram = (id: string | null, name: string, type: ModelType): Diagram => ({
  id,
  name,
  modelType: type,
  components: [],
  connections: [],
  viewport: undefined,
  reports: [],
});
