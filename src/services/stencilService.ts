
'use server';

import { db, ensureFirebaseInitialized } from '@/lib/firebase/firebase';
import type { StencilData, InfrastructureStencilData, ProcessStencilData, StencilFirestoreData } from '@/types/stencil';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';

const STENCILS_COLLECTION = 'stencils';

// Helper to convert Firestore timestamp to Date for properties if needed
const convertTimestamps = (data: Record<string, any>): Record<string, any> => {
  const convertedData = { ...data };
  for (const key in convertedData) {
    if (convertedData[key] instanceof Timestamp) {
      convertedData[key] = convertedData[key].toDate();
    }
  }
  return convertedData;
};


export async function addStencil(stencilData: StencilFirestoreData): Promise<string> {
  const { initialized, error } = ensureFirebaseInitialized();
  if (!initialized || !db) {
    throw new Error(error || "Firestore not initialized for addStencil");
  }
  const stencilsCollectionRef = collection(db, STENCILS_COLLECTION);
  const docRef = await addDoc(stencilsCollectionRef, {
    ...stencilData,
    createdDate: serverTimestamp(),
    modifiedDate: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateStencil(stencilId: string, stencilData: Partial<StencilFirestoreData>): Promise<void> {
  const { initialized, error } = ensureFirebaseInitialized();
  if (!initialized || !db) {
    throw new Error(error || "Firestore not initialized for updateStencil");
  }
  const stencilDocRef = doc(db, STENCILS_COLLECTION, stencilId);
  await updateDoc(stencilDocRef, {
    ...stencilData,
    modifiedDate: serverTimestamp(),
  });
}

export async function deleteStencil(stencilId: string): Promise<void> {
  const { initialized, error } = ensureFirebaseInitialized();
  if (!initialized || !db) {
    throw new Error(error || "Firestore not initialized for deleteStencil");
  }
  const stencilDocRef = doc(db, STENCILS_COLLECTION, stencilId);
  await deleteDoc(stencilDocRef);
}

export async function getStencils(modelType: 'infrastructure' | 'process'): Promise<StencilData[]> {
  const { initialized, error } = ensureFirebaseInitialized();
  if (!initialized || !db) {
    console.error("getStencils: Firestore not initialized or db is null.", error);
    throw new Error(error || "Firestore not initialized for getStencils");
  }
  // console.log(`getStencils: Fetching stencils of type "${modelType}"`);
  const stencilsCollectionRef = collection(db, STENCILS_COLLECTION);
  const q = query(stencilsCollectionRef, where('stencilType', '==', modelType));
  
  try {
    const querySnapshot = await getDocs(q);
    // console.log(`getStencils: Query for type "${modelType}" returned ${querySnapshot.docs.length} documents.`);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const properties = data.properties || {};
      return {
        id: docSnap.id,
        ...data,
        properties: properties,
      } as StencilData;
    });
  } catch (e) {
    console.error(`getStencils: Error executing query for type "${modelType}":`, e);
    if (e instanceof Error && (e.message.includes("permission-denied") || e.message.includes("Missing or insufficient permissions"))) {
      console.error("getStencils: PERMISSION DENIED. This means Firestore security rules are blocking the read operation for the current user on the 'stencils' collection for type:", modelType);
    }
    throw e; // Re-throw the error to be caught by the caller
  }
}

export async function getStencilById(stencilId: string): Promise<StencilData | null> {
  const { initialized, error } = ensureFirebaseInitialized();
  if (!initialized || !db) {
    throw new Error(error || "Firestore not initialized for getStencilById");
  }
  const stencilDocRef = doc(db, STENCILS_COLLECTION, stencilId);
  const docSnap = await getDoc(stencilDocRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    const properties = data.properties || {};
    return {
      id: docSnap.id,
      ...data,
      properties: properties,
    } as StencilData;
  }
  return null;
}

export async function parseStaticPropertiesString(str: string | undefined): Promise<Record<string, string>> {
  if (!str || typeof str !== 'string') return {};
  const properties: Record<string, string> = {};
  str.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      properties[key.trim()] = valueParts.join(':').trim();
    }
  });
  return properties;
}

export async function formatStaticPropertiesToString(props: Record<string, any> | undefined): Promise<string> {
  if (!props) return "";
  return Object.entries(props)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n');
}


// --- Placeholder Stencil Data and Function ---

const placeholderInfrastructureStencils: Omit<InfrastructureStencilData, 'id'>[] = [
  {
    name: 'Web Server',
    iconName: 'Server',
    textColor: '#2563EB', // Blue-600
    stencilType: 'infrastructure',
    properties: { OS: 'Linux', Purpose: 'Handles HTTP requests', DataClassification: 'Public' },
  },
  {
    name: 'Application Database',
    iconName: 'Database',
    textColor: '#16A34A', // Green-600
    stencilType: 'infrastructure',
    properties: { Type: 'PostgreSQL', Version: '15', Encryption: 'At-rest, In-transit' },
  },
  {
    name: 'User Authentication Service',
    iconName: 'ShieldCheck',
    textColor: '#CA8A04', // Yellow-600
    stencilType: 'infrastructure',
    properties: { Protocol: 'OAuth 2.0', MFARequired: 'true' },
  },
  {
    name: 'DMZ Network Zone',
    iconName: 'Network', 
    textColor: '#DC2626', // Red-600
    stencilType: 'infrastructure',
    isBoundary: true,
    boundaryColor: '#DC2626',
    properties: { Description: 'Demilitarized Zone Firewall', AccessControl: 'Strict Ingress/Egress' },
  }
];

const placeholderProcessStencils: Omit<ProcessStencilData, 'id'>[] = [
  {
    name: 'User Login Action',
    iconName: 'KeyRound', 
    textColor: '#1D4ED8', // Blue-700
    stencilType: 'process',
    properties: { Description: 'User submits credentials for authentication', SystemModule: 'Authentication Service' },
  },
  {
    name: 'Validate Payment Details',
    iconName: 'CreditCard',
    textColor: '#059669', // Emerald-600
    stencilType: 'process',
    properties: { InputData: 'Credit Card Info', OutputData: 'Validation Status (Success/Fail)' },
  },
  {
    name: 'Order Value > $1000?',
    iconName: 'Diamond',
    textColor: '#7C3AED', // Violet-600
    stencilType: 'process',
    properties: { TruePath: 'Route to Manual Fraud Review', FalsePath: 'Proceed to Auto-Processing' },
  },
  {
    name: 'Generate Invoice Document',
    iconName: 'FileText',
    textColor: '#DB2777', // Pink-600
    stencilType: 'process',
    properties: { DocumentType: 'PDF Invoice', Storage: 'Customer Account Portal' },
  },
];

export async function addPlaceholderStencils(): Promise<{ infraAdded: number, processAdded: number, errors: string[] }> {
  const { initialized, error } = ensureFirebaseInitialized();
  if (!initialized || !db) {
    throw new Error(error || "Firestore not initialized for addPlaceholderStencils");
  }

  console.log("Attempting to add placeholder stencils...");
  let infraAdded = 0;
  let processAdded = 0;
  const errors: string[] = [];

  for (const stencil of placeholderInfrastructureStencils) {
    try {
      const q = query(collection(db, STENCILS_COLLECTION), where('name', '==', stencil.name), where('stencilType', '==', 'infrastructure'));
      const existing = await getDocs(q);
      if (existing.empty) {
        await addStencil(stencil as StencilFirestoreData);
        infraAdded++;
      } else {
        // console.log(`Infrastructure stencil "${stencil.name}" already exists. Skipping.`);
      }
    } catch (e) {
      const errorMsg = `Error adding placeholder infrastructure stencil "${stencil.name}": ${e instanceof Error ? e.message : String(e)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  for (const stencil of placeholderProcessStencils) {
     try {
      const q = query(collection(db, STENCILS_COLLECTION), where('name', '==', stencil.name), where('stencilType', '==', 'process'));
      const existing = await getDocs(q);
      if (existing.empty) {
        await addStencil(stencil as StencilFirestoreData);
        processAdded++;
      } else {
        // console.log(`Process stencil "${stencil.name}" already exists. Skipping.`);
      }
    } catch (e) {
      const errorMsg = `Error adding placeholder process stencil "${stencil.name}": ${e instanceof Error ? e.message : String(e)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }
  
  const summary = `Added ${infraAdded} infrastructure stencils and ${processAdded} process stencils.`;
  console.log(summary);
  if (errors.length > 0) {
    console.error("Errors occurred during placeholder addition:", errors);
  }
  return { infraAdded, processAdded, errors };
}
