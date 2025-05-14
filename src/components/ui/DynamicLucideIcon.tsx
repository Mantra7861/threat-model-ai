
"use client";

import * as React from 'react'; // Import React for FC type if needed
import * as LucideIcons from 'lucide-react';
import { HelpCircle as HelpCircleIcon } from 'lucide-react';

interface DynamicLucideIconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: any; // For other props
}

const DynamicLucideIcon: React.FC<DynamicLucideIconProps> = ({ name, ...props }) => {
  const iconKey = name as keyof typeof LucideIcons;
  
  // Check if the icon name exists and is a function (React component)
  if (Object.prototype.hasOwnProperty.call(LucideIcons, iconKey) && typeof LucideIcons[iconKey] === 'function') {
    const IconComponent = LucideIcons[iconKey] as LucideIcons.LucideIcon;
    return <IconComponent {...props} />;
  }
  
  console.warn(`DynamicLucideIcon: Icon "${name}" not found or not a valid component in LucideIcons. Falling back to HelpCircleIcon.`);
  return <HelpCircleIcon {...props} />;
};

export default DynamicLucideIcon;
