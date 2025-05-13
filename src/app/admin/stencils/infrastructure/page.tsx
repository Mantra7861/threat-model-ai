"use client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InfrastructureStencilData } from "@/types/stencil";
import Link from "next/link";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import * as LucideIcons from 'lucide-react';
import { placeholderInfrastructureStencils } from "@/lib/placeholder-stencils";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Dynamically get the Lucide icon component by name
const DynamicLucideIcon = ({ name, ...props }: { name: keyof typeof LucideIcons; [key: string]: any }) => {
  // Ensure the name is a valid key and it points to a function (React component)
  if (Object.prototype.hasOwnProperty.call(LucideIcons, name) && typeof LucideIcons[name] === 'function') {
    const IconComponent = LucideIcons[name] as LucideIcons.LucideIcon;
    return <IconComponent {...props} />;
  }
  // console.warn(`DynamicLucideIcon: Icon "${String(name)}" not found or not a function. Using fallback.`);
  return <LucideIcons.HelpCircle {...props} />; // Fallback icon
};


export default function InfrastructureStencilsPage() {
  // For Phase 1, use placeholder data. Later, this will come from Firestore.
  const [stencils, setStencils] = useState<InfrastructureStencilData[]>(placeholderInfrastructureStencils);
  const { toast } = useToast();

  const handleDelete = (stencilId: string) => {
    // Placeholder delete logic
    setStencils(prev => prev.filter(s => s.id !== stencilId));
    toast({ title: "Stencil Deleted", description: `Stencil ID ${stencilId} has been removed (locally).` });
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button asChild>
          <Link href="/admin/stencils/infrastructure/edit/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Infrastructure Stencil
          </Link>
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Icon</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stencils.map((stencil) => (
              <TableRow key={stencil.id}>
                <TableCell>
                  <DynamicLucideIcon name={stencil.iconName} className="h-5 w-5" style={{ color: stencil.textColor }} />
                </TableCell>
                <TableCell className="font-medium">{stencil.name}</TableCell>
                <TableCell>{stencil.stencilType}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" asChild className="mr-2">
                    <Link href={`/admin/stencils/infrastructure/edit/${stencil.id}`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(stencil.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {stencils.length === 0 && (
        <p className="text-center text-muted-foreground mt-4">No infrastructure stencils found.</p>
      )}
    </div>
  );
}
