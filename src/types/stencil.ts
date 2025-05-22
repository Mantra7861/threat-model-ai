
import type { Icon as PhosphorIcon } from 'phosphor-react'; // Import from phosphor-react
import type { Timestamp } from 'firebase-admin/firestore'; 

export interface StencilProperty {
  key: string;
  value: string;
}

export interface BaseStencil {
  id: string; 
  name: string;
  iconName: keyof typeof import('phosphor-react'); // Updated to phosphor-react
  textColor?: string; 
  properties?: Record<string, string | boolean | number | null>; 
  createdDate?: string; 
  modifiedDate?: string; 
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

export type StencilFirestoreData = 
  Omit<InfrastructureStencilData, 'id' | 'createdDate' | 'modifiedDate'> & { createdDate?: Timestamp | Date, modifiedDate?: Timestamp | Date } | 
  Omit<ProcessStencilData, 'id' | 'createdDate' | 'modifiedDate'> & { createdDate?: Timestamp | Date, modifiedDate?: Timestamp | Date };
