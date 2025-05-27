
"use client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProcessStencilData } from "@/types/stencil";
import Link from "next/link";
import { PlusCircle, PencilSimple, Trash, Spinner, Warning } from "@phosphor-icons/react"; // Corrected import
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getStencils, deleteStencil } from "@/services/stencilService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import DynamicPhosphorIcon from '@/components/ui/DynamicPhosphorIcon'; 


export default function ProcessStencilsPage() {
  const [stencils, setStencils] = useState<ProcessStencilData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchStencils();
  }, []);

  const fetchStencils = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedStencils = await getStencils('process') as ProcessStencilData[];
      setStencils(fetchedStencils);
    } catch (err) {
      console.error("Error fetching process stencils:", err);
      setError(err instanceof Error ? err.message : "Failed to load stencils.");
      toast({ title: "Error", description: "Could not fetch process stencils.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (stencilId: string, stencilName: string) => {
    try {
      await deleteStencil(stencilId);
      setStencils(prev => prev.filter(s => s.id !== stencilId));
      toast({ title: "Stencil Deleted", description: `Stencil "${stencilName}" has been removed.` });
    } catch (err) {
      console.error("Error deleting stencil:", err);
      toast({ title: "Error", description: `Could not delete stencil "${stencilName}".`, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="h-6 w-6 animate-spin text-primary mr-2" />
        Loading process stencils...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-destructive">
        <Warning className="h-8 w-8 mb-2" /> 
        <p className="font-semibold">Error loading stencils</p>
        <p className="text-sm">{error}</p>
        <Button onClick={fetchStencils} className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button asChild>
          <Link href="/admin/stencils/process/edit/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Process Stencil
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
                   <DynamicPhosphorIcon name={stencil.iconName || 'Question'} className="h-5 w-5" style={{ color: stencil.textColor || '#000000' }} />
                </TableCell>
                <TableCell className="font-medium">{stencil.name}</TableCell>
                <TableCell>{stencil.stencilType}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" asChild className="mr-2">
                    <Link href={`/admin/stencils/process/edit/${stencil.id}`}>
                      <PencilSimple className="h-4 w-4" />
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the stencil "{stencil.name}".
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(stencil.id, stencil.name)}
                          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {stencils.length === 0 && !isLoading && (
        <p className="text-center text-muted-foreground mt-4">No process stencils found. Click "Add New" to create one.</p>
      )}
    </div>
  );
}
