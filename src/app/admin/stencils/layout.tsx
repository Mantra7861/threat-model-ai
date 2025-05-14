
"use client"; // Make it a client component

import type { ReactNode } from 'react';

// This is the simplest possible layout component.
// It just passes through its children.
export default function StencilsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
