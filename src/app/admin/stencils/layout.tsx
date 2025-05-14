
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
// import { usePathname } from 'next/navigation'; // Temporarily remove

export default function StencilsLayout({ children }: { children: ReactNode }) {
  // const pathname = usePathname(); // Temporarily remove
  // const isProcessPage = pathname.startsWith('/admin/stencils/process');
  // const isInfrastructurePage = pathname.startsWith('/admin/stencils/infrastructure') || (!isProcessPage && !pathname.includes('/edit/'));

  // Using static class names for links now
  const linkClassName = 'text-muted-foreground hover:text-primary';
  // If you want to highlight the active tab, you might need a different approach later
  // or accept no active styling while debugging this specific hook error.

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
        <h1 className="text-2xl font-semibold leading-none tracking-tight mb-4">Stencil Management</h1>
        <nav className="flex space-x-4 mb-6 pb-4 border-b">
          <Link
            href="/admin/stencils/infrastructure"
            className={linkClassName} // Use static class
          >
            Infrastructure Stencils
          </Link>
          <Link
            href="/admin/stencils/process"
            className={linkClassName} // Use static class
          >
            Process Stencils
          </Link>
        </nav>
        {children}
      </div>
    </div>
  );
}
