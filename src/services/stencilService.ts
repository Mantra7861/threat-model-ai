
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
import { placeholderInfrastructureStencils as infraPlaceholders, placeholderProcessStencils as processPlaceholders } from '@/lib/placeholder-stencils';


const STENCILS_COLLECTION = 'stencils';

// Helper to convert Firestore timestamp to a serializable format (ISO string)
const convertTimestampToString = (timestamp: Timestamp | Date | undefined): string | undefined => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return undefined;
};

// Helper to process stencil data for client-side consumption
const processStencilForClient = (docSnap: firebase.firestore.DocumentSnapshot | any): StencilData => { // Use any for docSnap due to varying SDK versions/types
    const data = docSnap.data();
    const properties = data.properties || {};
    return {
      id: docSnap.id,
      ...data,
      properties: properties,
      createdDate: convertTimestampToString(data.createdDate),
      modifiedDate: convertTimestampToString(data.modifiedDate),
    } as StencilData; // Cast to StencilData, assuming string dates are handled in type
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
  const stencilsCollectionRef = collection(db, STENCILS_COLLECTION);
  const q = query(stencilsCollectionRef, where('stencilType', '==', modelType));
  
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(processStencilForClient);
  } catch (e) {
    console.error(`getStencils: Error executing query for type "${modelType}":`, e);
    if (e instanceof Error && (e.message.includes("permission-denied") || e.message.includes("Missing or insufficient permissions"))) {
      console.error("getStencils: PERMISSION DENIED. This means Firestore security rules are blocking the read operation for the current user on the 'stencils' collection for type:", modelType);
    }
    throw e; 
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
    return processStencilForClient(docSnap);
  }
  return null;
}

export async function parseStaticPropertiesString(str: string | undefined): Promise<Record<string, string | boolean | number | null>> {
  if (!str || typeof str !== 'string') return {};
  const properties: Record<string, string | boolean | number | null> = {};
  str.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const valueStr = valueParts.join(':').trim();
      if (valueStr.toLowerCase() === 'true') {
        properties[key.trim()] = true;
      } else if (valueStr.toLowerCase() === 'false') {
        properties[key.trim()] = false;
      } else if (!isNaN(Number(valueStr)) && valueStr.trim() !== '') {
        properties[key.trim()] = Number(valueStr);
      } else if (valueStr.toLowerCase() === 'null') {
        properties[key.trim()] = null;
      }
      else {
        properties[key.trim()] = valueStr;
      }
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
export async function addPlaceholderStencils(): Promise<{ infraAdded: number, processAdded: number, errors: string[] }> {
  const { initialized, error } = ensureFirebaseInitialized();
  if (!initialized || !db) {
    throw new Error(error || "Firestore not initialized for addPlaceholderStencils");
  }

  console.log("Attempting to add placeholder stencils...");
  let infraAdded = 0;
  let processAdded = 0;
  const errors: string[] = [];

  for (const stencil of infraPlaceholders) {
    try {
      const q = query(collection(db, STENCILS_COLLECTION), where('name', '==', stencil.name), where('stencilType', '==', 'infrastructure'));
      const existing = await getDocs(q);
      if (existing.empty) {
        await addStencil(stencil as StencilFirestoreData); // Cast is okay as id is not part of StencilFirestoreData
        infraAdded++;
      }
    } catch (e) {
      const errorMsg = `Error adding placeholder infrastructure stencil "${stencil.name}": ${e instanceof Error ? e.message : String(e)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  for (const stencil of processPlaceholders) {
     try {
      const q = query(collection(db, STENCILS_COLLECTION), where('name', '==', stencil.name), where('stencilType', '==', 'process'));
      const existing = await getDocs(q);
      if (existing.empty) {
        await addStencil(stencil as StencilFirestoreData); // Cast is okay
        processAdded++;
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
