
'use server';

import { db, ensureFirebaseInitialized } from '@/lib/firebase/firebase';
import type { StencilData, StencilFirestoreData, InfrastructureStencilData, ProcessStencilData } from '@/types/stencil';
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

// Helper to convert Firestore timestamp to Date for properties if needed (though properties are Record<string, string> for now)
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
    throw new Error(error || "Firestore not initialized for getStencils");
  }
  const stencilsCollectionRef = collection(db, STENCILS_COLLECTION);
  const q = query(stencilsCollectionRef, where('stencilType', '==', modelType));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    // Ensure properties are treated as Record<string, string>
    const properties = data.properties || {};
    return {
      id: docSnap.id,
      ...data,
      properties: properties,
    } as StencilData;
  });
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

export const parseStaticPropertiesString = (str: string | undefined): Record<string, string> => {
  if (!str || typeof str !== 'string') return {};
  const properties: Record<string, string> = {};
  str.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      properties[key.trim()] = valueParts.join(':').trim();
    }
  });
  return properties;
};

export const formatStaticPropertiesToString = (props: Record<string, any> | undefined): string => {
  if (!props) return "";
  return Object.entries(props)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n');
};
