
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
// import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Temporarily removed
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Temporarily removed
// import { useMemo } from 'react'; // Temporarily removed

export default function StencilsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isProcessPage = pathname.startsWith('/admin/stencils/process');
  const isInfrastructurePage = pathname.startsWith('/admin/stencils/infrastructure') || (!isProcessPage && !pathname.includes('/edit/')); // Default to infra if not process or edit

  // Simplified navigation without Tabs
  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 p-6 border rounded-lg bg-card text-card-foreground shadow-sm"> {/* Basic card styling */}
        <h1 className="text-2xl font-semibold leading-none tracking-tight mb-4">Stencil Management</h1> {/* Basic title */}
        <nav className="flex space-x-4 mb-6 pb-4 border-b">
          <Link 
            href="/admin/stencils/infrastructure" 
            className={isInfrastructurePage && !isProcessPage ? 'font-bold text-primary' : 'text-muted-foreground hover:text-primary'}
          >
            Infrastructure Stencils
          </Link>
          <Link 
            href="/admin/stencils/process" 
            className={isProcessPage ? 'font-bold text-primary' : 'text-muted-foreground hover:text-primary'}
          >
            Process Stencils
          </Link>
        </nav>
        {/* The content for each tab will be rendered by the respective page.tsx */}
        {children}
      </div>
    </div>
  );
}
