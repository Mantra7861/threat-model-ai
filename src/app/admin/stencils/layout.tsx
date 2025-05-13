
"use client";

import type { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function StencilsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const getCurrentTab = () => {
    if (pathname.startsWith('/admin/stencils/process')) {
      return 'process';
    }
    return 'infrastructure';
  };

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Stencil Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={getCurrentTab()} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="infrastructure" asChild>
                <Link href="/admin/stencils/infrastructure">Infrastructure Stencils</Link>
              </TabsTrigger>
              <TabsTrigger value="process" asChild>
                <Link href="/admin/stencils/process">Process Stencils</Link>
              </TabsTrigger>
            </TabsList>
            {/* The content for each tab will be rendered by the respective page.tsx */}
            {children}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
