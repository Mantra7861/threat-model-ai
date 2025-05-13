
import type { InfrastructureStencilData, ProcessStencilData } from '@/types/stencil';

export const placeholderInfrastructureStencils: InfrastructureStencilData[] = [
  {
    id: 'server-1',
    name: 'Server',
    iconName: 'Server',
    textColor: '#333333',
    stencilType: 'infrastructure',
    properties: { OS: 'Linux', Version: 'Ubuntu 22.04', IPAddress: '192.168.1.10' },
  },
  {
    id: 'database-1',
    name: 'Database',
    iconName: 'Database',
    textColor: '#333333',
    stencilType: 'infrastructure',
    properties: { Type: 'PostgreSQL', Version: '14', Replication: 'Enabled' },
  },
  {
    id: 'cloud-service-1',
    name: 'Cloud Service',
    iconName: 'Cloud',
    textColor: '#333333',
    stencilType: 'infrastructure',
    properties: { Provider: 'AWS', Service: 'S3', Region: 'us-east-1' },
  },
  {
    id: 'router-1',
    name: 'Router',
    iconName: 'Router',
    textColor: '#333333',
    stencilType: 'infrastructure',
    properties: { Model: 'Cisco ISR 4000', Firmware: '17.3.4a' },
  },
  {
    id: 'trust-boundary-1',
    name: 'Trust Boundary',
    iconName: 'ShieldCheck',
    textColor: '#D32F2F',
    stencilType: 'infrastructure',
    isBoundary: true,
    boundaryColor: '#D32F2F',
    properties: { Description: 'Internal Network', AccessControl: 'Strict' },
  },
];

export const placeholderProcessStencils: ProcessStencilData[] = [
  {
    id: 'step-1',
    name: 'Step/Action',
    iconName: 'Square',
    textColor: '#333333',
    stencilType: 'process',
    properties: { Description: 'User Authentication', System: 'Auth Service' },
  },
  {
    id: 'start-end-1',
    name: 'Process Start',
    iconName: 'Circle',
    textColor: '#333333',
    stencilType: 'process',
    properties: { Trigger: 'User Request' },
  },
  {
    id: 'decision-1',
    name: 'Decision',
    iconName: 'Diamond', // Lucide has DiamondIcon, ensure this matches a valid key
    textColor: '#333333',
    stencilType: 'process',
    properties: { Condition: 'Is user valid?', TruePath: 'Grant Access', FalsePath: 'Deny Access' },
  },
  {
    id: 'flow-1', // Note: Arrows/flows are usually connections, not stencils. Keeping for consistency with prompt if it was a draggable stencil.
    name: 'Process Flow Arrow',
    iconName: 'ArrowRight',
    textColor: '#333333',
    stencilType: 'process',
    properties: { DataType: 'User Credentials' },
  },
  {
    id: 'input-output-1',
    name: 'Input/Output',
    iconName: 'Archive',
    textColor: '#333333',
    stencilType: 'process',
    properties: { Data: 'Payment Information', Format: 'JSON' },
  },
  {
    id: 'document-1',
    name: 'Document',
    iconName: 'FileText',
    textColor: '#333333',
    stencilType: 'process',
    properties: { Name: 'Invoice', Storage: 'Document DB' },
  },
  {
    id: 'manual-input-1',
    name: 'Manual Input',
    iconName: 'Edit3',
    textColor: '#333333',
    stencilType: 'process',
    properties: { Data: 'Customer Address', Source: 'Phone Call' },
  },
];
