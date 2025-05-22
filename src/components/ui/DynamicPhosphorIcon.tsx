
"use client";

import * as React from 'react';
import * as PhosphorIcons from 'phosphor-react';
import { Question as QuestionIcon } from 'phosphor-react'; // Default fallback icon

interface DynamicPhosphorIconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  size?: number; // Explicit size prop
  [key: string]: any; // For other props like color, weight
}

const DynamicPhosphorIcon: React.FC<DynamicPhosphorIconProps> = ({ name, size, ...props }) => {
  if (!name || name.trim() === "") {
    console.warn(`DynamicPhosphorIcon: Received empty or invalid name. Falling back to QuestionIcon.`);
    return <QuestionIcon size={size || 24} {...props} />; // Pass size to fallback
  }

  const IconComponent = (PhosphorIcons as any)[name] as PhosphorIcons.Icon | undefined;

  if (IconComponent && typeof IconComponent === 'function') {
    return <IconComponent size={size || undefined} {...props} />; // Pass size to actual icon
  }

  console.warn(`DynamicPhosphorIcon: Icon "${name}" not found or not a valid component in PhosphorIcons. Falling back to QuestionIcon.`);
  return <QuestionIcon size={size || 24} {...props} />; // Pass size to fallback
};

export default DynamicPhosphorIcon;
