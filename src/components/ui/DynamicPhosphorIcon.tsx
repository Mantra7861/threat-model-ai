
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

const DynamicPhosphorIcon: React.FC<DynamicPhosphorIconProps> = ({ name, size = 24, ...props }) => {
  // Debug log to see what icon name is being attempted
  console.log(`DynamicPhosphorIcon: Attempting to render icon with name="${name}", size=${size}`);

  if (!name || name.trim() === "") {
    console.warn(`DynamicPhosphorIcon: Received empty or invalid name. Falling back to QuestionIcon.`);
    return <QuestionIcon size={size} {...props} />;
  }

  const IconComponent = (PhosphorIcons as any)[name] as PhosphorIcons.Icon | undefined;

  if (IconComponent && typeof IconComponent === 'function') {
    return <IconComponent size={size} {...props} />;
  }

  console.warn(`DynamicPhosphorIcon: Icon name "${name}" not found or not a valid component in PhosphorIcons. Falling back to QuestionIcon.`);
  return <QuestionIcon size={size} {...props} />;
};

export default DynamicPhosphorIcon;
