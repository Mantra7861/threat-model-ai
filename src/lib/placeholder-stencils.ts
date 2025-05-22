
import type { InfrastructureStencilData, ProcessStencilData } from '@/types/stencil';

// Updated with Phosphor icon names where direct equivalents exist,
// or suitable alternatives. User can customize further in admin.
export const placeholderInfrastructureStencils: InfrastructureStencilData[] = [
  {
    id: 'server-1',
    name: 'Server',
    iconName: 'HardDrive', // Phosphor: HardDrive or ServerSimple
    textColor: '#333333',
    stencilType: 'infrastructure',
    properties: { OS: 'Linux', Version: 'Ubuntu 22.04', IPAddress: '192.168.1.10' },
  },
  {
    id: 'database-1',
    name: 'Database',
    iconName: 'Database', // Phosphor: Database
    textColor: '#333333',
    stencilType: 'infrastructure',
    properties: { Type: 'PostgreSQL', Version: '14', Replication: 'Enabled' },
  },
  {
    id: 'cloud-service-1',
    name: 'Cloud Service',
    iconName: 'Cloud', // Phosphor: Cloud
    textColor: '#333333',
    stencilType: 'infrastructure',
    properties: { Provider: 'AWS', Service: 'S3', Region: 'us-east-1' },
  },
  {
    id: 'router-1',
    name: 'Router',
    iconName: 'Router', // Phosphor: Router
    textColor: '#333333',
    stencilType: 'infrastructure',
    properties: { Model: 'Cisco ISR 4000', Firmware: '17.3.4a' },
  },
  {
    id: 'trust-boundary-1',
    name: 'Trust Boundary',
    iconName: 'ShieldCheck', // Phosphor: ShieldCheck
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
    iconName: 'Rectangle', // Phosphor: Rectangle (for Square)
    textColor: '#333333',
    stencilType: 'process',
    properties: { Description: 'User Authentication', System: 'Auth Service' },
  },
  {
    id: 'start-end-1',
    name: 'Process Start',
    iconName: 'Circle', // Phosphor: Circle
    textColor: '#333333',
    stencilType: 'process',
    properties: { Trigger: 'User Request' },
  },
  {
    id: 'decision-1',
    name: 'Decision',
    iconName: 'Diamond', // Phosphor: Diamond
    textColor: '#333333',
    stencilType: 'process',
    properties: { Condition: 'Is user valid?', TruePath: 'Grant Access', FalsePath: 'Deny Access' },
  },
  {
    id: 'flow-1', 
    name: 'Process Flow Arrow',
    iconName: 'ArrowRight', // Phosphor: ArrowRight
    textColor: '#333333',
    stencilType: 'process',
    properties: { DataType: 'User Credentials' },
  },
  {
    id: 'input-output-1',
    name: 'Input/Output',
    // Phosphor doesn't have Parallelogram. Using Rectangle or a generic data icon.
    iconName: 'ArchiveBox', // Phosphor: ArchiveBox or Files or Rectangle
    textColor: '#333333',
    stencilType: 'process',
    properties: { Data: 'Payment Information', Format: 'JSON' },
  },
  {
    id: 'document-1',
    name: 'Document',
    iconName: 'FileText', // Phosphor: FileText
    textColor: '#333333',
    stencilType: 'process',
    properties: { Name: 'Invoice', Storage: 'Document DB' },
  },
  {
    id: 'manual-input-1',
    name: 'Manual Input',
    // Phosphor doesn't have Trapezoid. Using an edit-related icon or generic shape.
    iconName: 'PencilSimpleLine', // Phosphor: PencilSimpleLine or Keyboard or Rectangle
    textColor: '#333333',
    stencilType: 'process',
    properties: { Data: 'Customer Address', Source: 'Phone Call' },
  },
  {
    id: 'sticky-note-1',
    name: 'Annotation',
    iconName: 'StickyNote', // Phosphor: StickyNote
    textColor: '#E67E22',
    stencilType: 'process',
    properties: { Note: 'Review this process step for compliance.'}
  }
];
