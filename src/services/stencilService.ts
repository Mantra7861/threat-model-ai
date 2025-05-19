
'use server';

import { adminDb } from '@/lib/firebase/firebaseAdmin'; // Use Admin SDK
import { FieldValue, Timestamp } from 'firebase-admin/firestore'; // Use Admin SDK FieldValue
import type { StencilData, InfrastructureStencilData, ProcessStencilData, StencilFirestoreData } from '@/types/stencil';
// Placeholder data import remains the same
import { placeholderInfrastructureStencils as infraPlaceholders, placeholderProcessStencils as processPlaceholders } from '@/lib/placeholder-stencils';

const STENCILS_COLLECTION = 'stencils';

// Helper to convert Firestore timestamp from Admin SDK to a serializable format (ISO string)
const convertAdminTimestampToString = (timestamp: Timestamp | undefined): string | undefined => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  return undefined;
};

// Helper to process stencil data for client-side consumption
const processStencilForClient = (docSnap: FirebaseFirestore.DocumentSnapshot): StencilData => {
    const data = docSnap.data() as StencilFirestoreData; // Cast based on what we store
    const properties = data.properties || {};
    
    // Firestore Timestamps from Admin SDK need to be converted
    const createdDate = data.createdDate instanceof Timestamp ? data.createdDate.toDate().toISOString() : undefined;
    const modifiedDate = data.modifiedDate instanceof Timestamp ? data.modifiedDate.toDate().toISOString() : undefined;

    return {
      id: docSnap.id,
      name: data.name,
      iconName: data.iconName,
      textColor: data.textColor,
      stencilType: data.stencilType,
      properties: properties,
      // Handle specific types for InfrastructureStencilData
      ...(data.stencilType === 'infrastructure' && {
        boundaryColor: (data as InfrastructureStencilData).boundaryColor,
        isBoundary: (data as InfrastructureStencilData).isBoundary,
      }),
      createdDate,
      modifiedDate,
    } as StencilData;
};


export async function addStencil(stencilData: StencilFirestoreData): Promise<string> {
  const stencilsCollectionRef = adminDb.collection(STENCILS_COLLECTION);
  const docRef = await stencilsCollectionRef.add({
    ...stencilData,
    createdDate: FieldValue.serverTimestamp(),
    modifiedDate: FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

export async function updateStencil(stencilId: string, stencilData: Partial<StencilFirestoreData>): Promise<void> {
  const stencilDocRef = adminDb.collection(STENCILS_COLLECTION).doc(stencilId);
  await stencilDocRef.update({
    ...stencilData,
    modifiedDate: FieldValue.serverTimestamp(),
  });
}

export async function deleteStencil(stencilId: string): Promise<void> {
  const stencilDocRef = adminDb.collection(STENCILS_COLLECTION).doc(stencilId);
  await stencilDocRef.delete();
}

export async function getStencils(modelType: 'infrastructure' | 'process'): Promise<StencilData[]> {
  const stencilsCollectionRef = adminDb.collection(STENCILS_COLLECTION);
  const q = stencilsCollectionRef.where('stencilType', '==', modelType);
  
  try {
    const querySnapshot = await q.get();
    return querySnapshot.docs.map(processStencilForClient);
  } catch (e) {
    console.error(`getStencils: Error executing query for type "${modelType}":`, e);
    // Admin SDK bypasses rules, so permission errors here usually mean something else (e.g., network, config)
    throw e; 
  }
}

export async function getStencilById(stencilId: string): Promise<StencilData | null> {
  const stencilDocRef = adminDb.collection(STENCILS_COLLECTION).doc(stencilId);
  const docSnap = await stencilDocRef.get();

  if (docSnap.exists) {
    return processStencilForClient(docSnap);
  }
  return null;
}

// parseStaticPropertiesString remains the same as it's pure string manipulation
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

// formatStaticPropertiesToString remains the same
export async function formatStaticPropertiesToString(props: Record<string, any> | undefined): Promise<string> {
  if (!props) return "";
  return Object.entries(props)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n');
}

// addPlaceholderStencils now uses Admin SDK
export async function addPlaceholderStencils(): Promise<{ infraAdded: number, processAdded: number, errors: string[] }> {
  console.log("Attempting to add placeholder stencils using Admin SDK...");
  let infraAdded = 0;
  let processAdded = 0;
  const errors: string[] = [];

  for (const stencil of infraPlaceholders) {
    try {
      const q = adminDb.collection(STENCILS_COLLECTION)
                      .where('name', '==', stencil.name)
                      .where('stencilType', '==', 'infrastructure');
      const existing = await q.get();
      if (existing.empty) {
        // Remove 'id' if it exists in placeholder, Firestore generates it
        const { id, ...dataToSave } = stencil;
        await addStencil(dataToSave as StencilFirestoreData); 
        infraAdded++;
      }
    } catch (e) {
      const errorMsg = `Error adding placeholder infrastructure stencil "${stencil.name}" via Admin SDK: ${e instanceof Error ? e.message : String(e)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  for (const stencil of processPlaceholders) {
     try {
      const q = adminDb.collection(STENCILS_COLLECTION)
                      .where('name', '==', stencil.name)
                      .where('stencilType', '==', 'process');
      const existing = await q.get();
      if (existing.empty) {
        const { id, ...dataToSave } = stencil;
        await addStencil(dataToSave as StencilFirestoreData);
        processAdded++;
      }
    } catch (e) {
      const errorMsg = `Error adding placeholder process stencil "${stencil.name}" via Admin SDK: ${e instanceof Error ? e.message : String(e)}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }
  
  const summary = `Admin SDK: Added ${infraAdded} infrastructure stencils and ${processAdded} process stencils.`;
  console.log(summary);
  if (errors.length > 0) {
    console.error("Admin SDK: Errors occurred during placeholder addition:", errors);
  }
  return { infraAdded, processAdded, errors };
}
