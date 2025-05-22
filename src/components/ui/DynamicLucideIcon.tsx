// This file should be renamed to DynamicPhosphorIcon.tsx
"use client";

import * as React from 'react';
import * as PhosphorIcons from 'phosphor-react';
import { Question as QuestionIcon } from 'phosphor-react'; // Default fallback icon

interface DynamicPhosphorIconProps {
  name: string; // Keep as string, will validate against PhosphorIcons keys
  className?: string;
  style?: React.CSSProperties;
  [key: string]: any; // For other props like size, color, weight
}

const DynamicPhosphorIcon: React.FC<DynamicPhosphorIconProps> = ({ name, ...props }) => {
  // Type assertion to allow string indexing, then check existence
  const IconComponent = (PhosphorIcons as any)[name] as PhosphorIcons.Icon | undefined; 
  
  if (IconComponent && typeof IconComponent === 'function') {
    // Check if it's a Phosphor Icon component (they are functions)
    // Phosphor icons are typically rendered as React components directly
    return <IconComponent {...props} />;
  }
  
  console.warn(`DynamicPhosphorIcon: Icon "${name}" not found or not a valid component in PhosphorIcons. Falling back to QuestionIcon.`);
  return <QuestionIcon {...props} />;
};

export default DynamicPhosphorIcon;
