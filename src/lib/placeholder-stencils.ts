
import type { InfrastructureStencilData, ProcessStencilData } from '@/types/stencil';
import type { Icon as PhosphorIconType } from '@phosphor-icons/react'; // Corrected import for type checking

// Updated with Phosphor icon names where direct equivalents exist,
// or suitable alternatives. User can customize further in admin.
export const placeholderInfrastructureStencils: InfrastructureStencilData[] = [
  {
    id: 'server-1',
    name: 'Server',
    iconName: 'HardDrive',
    textColor: '#3B82F6', // Blue
    stencilType: 'infrastructure',
    properties: { OS: 'Linux', Version: 'Ubuntu 22.04', IPAddress: '192.168.1.10', name: 'Web Server' },
  },
  {
    id: 'database-1',
    name: 'Database',
    iconName: 'Database',
    textColor: '#10B981', // Green
    stencilType: 'infrastructure',
    properties: { Type: 'PostgreSQL', Version: '14', Replication: 'Enabled', name: 'User DB' },
  },
  {
    id: 'cloud-service-1',
    name: 'Cloud Service',
    iconName: 'Cloud',
    textColor: '#0EA5E9', // Sky Blue
    stencilType: 'infrastructure',
    properties: { Provider: 'AWS', Service: 'S3', Region: 'us-east-1', name: 'File Storage' },
  },
  {
    id: 'router-1',
    name: 'Router',
    iconName: 'Router',
    textColor: '#F59E0B', // Amber
    stencilType: 'infrastructure',
    properties: { Model: 'Cisco ISR 4000', Firmware: '17.3.4a', name: 'Core Router' },
  },
  {
    id: 'trust-boundary-1',
    name: 'Trust Boundary',
    iconName: 'ShieldCheck', // This icon is for the label if shown, type 'Boundary' controls rendering
    textColor: '#4F46E5', // Indigo for label
    stencilType: 'infrastructure',
    isBoundary: true,
    boundaryColor: '#4F46E5', // Indigo for dashed border
    properties: { Description: 'Internal Network', AccessControl: 'Strict', name: 'DMZ' },
  },
  {
    id: 'user-generic-1',
    name: 'User',
    iconName: 'User',
    textColor: '#EF4444', // Red
    stencilType: 'infrastructure',
    properties: { Role: 'End User', Department: 'Sales', name: 'Customer' },
  },
  {
    id: 'firewall-1',
    name: 'Firewall',
    iconName: 'ShieldCheck',
    textColor: '#D97706', // Orange
    stencilType: 'infrastructure',
    properties: { Type: 'Next-Gen Firewall', Policy: 'Default Deny', name: 'Main Firewall'},
  },
];

export const placeholderProcessStencils: ProcessStencilData[] = [
  {
    id: 'step-1',
    name: 'Process Step',
    iconName: 'Rectangle', // This will be used as node.type
    textColor: '#3B82F6', // Blue for shape color
    stencilType: 'process',
    properties: { Description: 'User Authentication', System: 'Auth Service', name: 'Authenticate User' },
  },
  {
    id: 'start-end-1',
    name: 'Start/End',
    iconName: 'Circle', // This will be used as node.type
    textColor: '#10B981', // Green for shape color
    stencilType: 'process',
    properties: { Trigger: 'User Request', name: 'Begin Process' },
  },
  {
    id: 'decision-1',
    name: 'Decision Point',
    iconName: 'Diamond', // This will be used as node.type
    textColor: '#F59E0B', // Amber for shape color
    stencilType: 'process',
    properties: { Condition: 'Is user valid?', TruePath: 'Grant Access', FalsePath: 'Deny Access', name: 'Validate User' },
  },
  {
    id: 'flow-1',
    name: 'Process Flow', // This stencil is typically just an icon for dragging, the actual edge is drawn by user.
    iconName: 'ArrowRight', // This icon is for the draggable stencil item itself
    textColor: '#6B7280', // Gray for icon
    stencilType: 'process',
    properties: { DataType: 'User Credentials', name: 'Data Flow' }, // Name here is less critical for the icon
  },
  {
    id: 'input-output-1',
    name: 'Data Input/Output',
    iconName: 'Parallelogram', // This will be used as node.type
    textColor: '#6366F1', // Indigo for shape color
    stencilType: 'process',
    properties: { Data: 'Payment Information', Format: 'JSON', name: 'Receive Payment' },
  },
  {
    id: 'document-1',
    name: 'Document',
    iconName: 'FileText', // Icon-based process stencil
    textColor: '#4B5563', // Dark Gray for icon
    stencilType: 'process',
    properties: { Name: 'Invoice', Storage: 'Document DB', name: 'Generate Invoice' },
  },
  {
    id: 'manual-input-1',
    name: 'Manual Input',
    iconName: 'PencilSimpleLine', // Icon-based process stencil
    textColor: '#EC4899', // Pink for icon
    stencilType: 'process',
    properties: { Data: 'Customer Address', Source: 'Phone Call', name: 'Enter Address' },
  },
  {
    id: 'sticky-note-1',
    name: 'Annotation',
    iconName: 'StickyNote', // Icon-based process stencil
    textColor: '#F97316', // Orange for icon
    stencilType: 'process',
    properties: { Note: 'Review this process step for compliance.', name: 'Compliance Note'}
  }
];
