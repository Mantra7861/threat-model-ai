
import type { Icon as LucideIcon } from 'lucide-react';

export interface StencilProperty {
  key: string;
  value: string;
}

export interface BaseStencil {
  id: string; // This can be the Firestore document ID after fetching
  name: string;
  iconName: keyof typeof import('lucide-react'); // For Lucide icon names
  textColor?: string; // hex color
  properties?: Record<string, string | boolean | number | null>; // For key-value pairs
  createdDate?: string; // ISO string
  modifiedDate?: string; // ISO string
}

export interface InfrastructureStencilData extends BaseStencil {
  stencilType: 'infrastructure';
  boundaryColor?: string; // hex color
  isBoundary?: boolean;
}

export interface ProcessStencilData extends BaseStencil {
  stencilType: 'process';
}

export type StencilData = InfrastructureStencilData | ProcessStencilData;

// Type for data being saved to Firestore, id might be absent for new stencils
// Dates will be handled as serverTimestamps during write.
export type StencilFirestoreData = 
  Omit<InfrastructureStencilData, 'id' | 'createdDate' | 'modifiedDate'> | 
  Omit<ProcessStencilData, 'id' | 'createdDate' | 'modifiedDate'>;

