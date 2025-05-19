
import type { Icon as LucideIcon } from 'lucide-react';
import type { Timestamp } from 'firebase-admin/firestore'; // For Admin SDK types if needed server-side before conversion

export interface StencilProperty {
  key: string;
  value: string;
}

export interface BaseStencil {
  id: string; 
  name: string;
  iconName: keyof typeof import('lucide-react'); 
  textColor?: string; 
  properties?: Record<string, string | boolean | number | null>; 
  createdDate?: string; // ISO string for client
  modifiedDate?: string; // ISO string for client
}

export interface InfrastructureStencilData extends BaseStencil {
  stencilType: 'infrastructure';
  boundaryColor?: string; 
  isBoundary?: boolean;
}

export interface ProcessStencilData extends BaseStencil {
  stencilType: 'process';
}

export type StencilData = InfrastructureStencilData | ProcessStencilData;

// Type for data being saved to Firestore using Admin SDK
// Dates will be FieldValue.serverTimestamp() or actual Timestamp objects on write/update
export type StencilFirestoreData = 
  Omit<InfrastructureStencilData, 'id' | 'createdDate' | 'modifiedDate'> & { createdDate?: Timestamp | Date, modifiedDate?: Timestamp | Date } | 
  Omit<ProcessStencilData, 'id' | 'createdDate' | 'modifiedDate'> & { createdDate?: Timestamp | Date, modifiedDate?: Timestamp | Date };

