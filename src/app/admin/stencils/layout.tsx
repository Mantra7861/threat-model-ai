
// "use client"; // Removed to make it a Server Component

import type { ReactNode } from 'react';
import Link from 'next/link';

export default function StencilsLayout({ children }: { children: ReactNode }) {
  const linkClassName = 'text-muted-foreground hover:text-primary';

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
        <h1 className="text-2xl font-semibold leading-none tracking-tight mb-4">Stencil Management</h1>
        <nav className="flex space-x-4 mb-6 pb-4 border-b">
          <Link
            href="/admin/stencils/infrastructure"
            className={linkClassName}
          >
            Infrastructure Stencils
          </Link>
          <Link
            href="/admin/stencils/process"
            className={linkClassName}
          >
            Process Stencils
          </Link>
        </nav>
        {children}
      </div>
    </div>
  );
}
