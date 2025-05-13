
import type { Icon as LucideIcon } from 'lucide-react';

export interface StencilProperty {
  key: string;
  value: string; 
}

export interface BaseStencil {
  id: string;
  name: string;
  iconName: keyof typeof import('lucide-react'); // For Lucide icon names
  textColor?: string; // hex color
  staticPropertiesString?: string; // For simple textarea input initially
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
