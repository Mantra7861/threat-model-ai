
import type { InfrastructureStencilData, ProcessStencilData } from '@/types/stencil';

export const placeholderInfrastructureStencils: InfrastructureStencilData[] = [
  {
    id: 'server-1',
    name: 'Server',
    iconName: 'Server',
    textColor: '#333333',
    stencilType: 'infrastructure',
    staticPropertiesString: 'OS: Linux\nVersion: Ubuntu 22.04\nIPAddress: 192.168.1.10',
  },
  {
    id: 'database-1',
    name: 'Database',
    iconName: 'Database',
    textColor: '#333333',
    stencilType: 'infrastructure',
    staticPropertiesString: 'Type: PostgreSQL\nVersion: 14\nReplication: Enabled',
  },
  {
    id: 'cloud-service-1',
    name: 'Cloud Service',
    iconName: 'Cloud',
    textColor: '#333333',
    stencilType: 'infrastructure',
    staticPropertiesString: 'Provider: AWS\nService: S3\nRegion: us-east-1',
  },
  {
    id: 'router-1',
    name: 'Router',
    iconName: 'Router',
    textColor: '#333333',
    stencilType: 'infrastructure',
    staticPropertiesString: 'Model: Cisco ISR 4000\nFirmware: 17.3.4a',
  },
  {
    id: 'trust-boundary-1',
    name: 'Trust Boundary',
    iconName: 'ShieldCheck',
    textColor: '#D32F2F',
    stencilType: 'infrastructure',
    isBoundary: true,
    boundaryColor: '#D32F2F',
    staticPropertiesString: 'Description: Internal Network\nAccessControl: Strict',
  },
];

export const placeholderProcessStencils: ProcessStencilData[] = [
  {
    id: 'step-1',
    name: 'Step/Action',
    iconName: 'Square',
    textColor: '#333333',
    stencilType: 'process',
    staticPropertiesString: 'Description: User Authentication\nSystem: Auth Service',
  },
  {
    id: 'start-end-1',
    name: 'Process Start',
    iconName: 'Circle',
    textColor: '#333333',
    stencilType: 'process',
    staticPropertiesString: 'Trigger: User Request',
  },
  {
    id: 'decision-1',
    name: 'Decision',
    iconName: 'Diamond',
    textColor: '#333333',
    stencilType: 'process',
    staticPropertiesString: 'Condition: Is user valid?\nTruePath: Grant Access\nFalsePath: Deny Access',
  },
  {
    id: 'flow-1',
    name: 'Process Flow', // Note: Arrows are typically connections, but listed as per prompt
    iconName: 'ArrowRight',
    textColor: '#333333',
    stencilType: 'process',
    staticPropertiesString: 'DataType: User Credentials',
  },
  {
    id: 'input-output-1',
    name: 'Input/Output',
    iconName: 'Archive',
    textColor: '#333333',
    stencilType: 'process',
    staticPropertiesString: 'Data: Payment Information\nFormat: JSON',
  },
  {
    id: 'document-1',
    name: 'Document',
    iconName: 'FileText',
    textColor: '#333333',
    stencilType: 'process',
    staticPropertiesString: 'Name: Invoice\nStorage: Document DB',
  },
  {
    id: 'manual-input-1',
    name: 'Manual Input',
    iconName: 'Edit3',
    textColor: '#333333',
    stencilType: 'process',
    staticPropertiesString: 'Data: Customer Address\nSource: Phone Call',
  },
];
