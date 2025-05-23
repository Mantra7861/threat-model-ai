
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
  // console.log(`DynamicPhosphorIcon: Attempting to render icon with name="${name}", size=${size}`);

  if (!name || name.trim() === "") {
    // console.warn(`DynamicPhosphorIcon: Received empty or invalid name. Falling back to QuestionIcon.`);
    return <QuestionIcon size={size} {...props} />;
  }

  // Log available keys for debugging - one time only
  if (typeof window !== 'undefined' && !(window as any).__PHOSPHOR_KEYS_LOGGED__) {
    // console.log("DynamicPhosphorIcon: Top-level PhosphorIcons keys (sample):", Object.keys(PhosphorIcons).slice(0, 30));
    // if (PhosphorIcons.default && typeof PhosphorIcons.default === 'object') {
    //   console.log("DynamicPhosphorIcon: PhosphorIcons.default keys (sample):", Object.keys(PhosphorIcons.default).slice(0, 30));
    // }
    (window as any).__PHOSPHOR_KEYS_LOGGED__ = true;
  }

  let IconComponent: PhosphorIcons.Icon | React.ForwardRefExoticComponent<any> | undefined | null = null;

  // Try direct access
  if (Object.prototype.hasOwnProperty.call(PhosphorIcons, name)) {
    IconComponent = (PhosphorIcons as any)[name];
  }

  // If not found directly, try under 'default' if it exists and is an object
  if (!IconComponent && PhosphorIcons.default && typeof PhosphorIcons.default === 'object') {
    if (Object.prototype.hasOwnProperty.call(PhosphorIcons.default, name)) {
      IconComponent = (PhosphorIcons.default as any)[name];
      // if (IconComponent) {
      //   console.log(`DynamicPhosphorIcon: Found icon "${name}" under PhosphorIcons.default.`);
      // }
    }
  }

  // If IconComponent is truthy, it's either a function or a forwardRef object, both are renderable
  if (IconComponent) {
    // console.log(`DynamicPhosphorIcon: Found icon component for "${name}". Rendering.`);
    return <IconComponent size={size} {...props} />;
  } else {
    // console.warn(`DynamicPhosphorIcon: Icon name "${name}" not found as a renderable component in PhosphorIcons (checked top-level and .default).`);
    return <QuestionIcon size={size} {...props} />;
  }
};

export default DynamicPhosphorIcon;
