
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
export type StencilFirestoreData = Omit<InfrastructureStencilData, 'id'> | Omit<ProcessStencilData, 'id'>;
