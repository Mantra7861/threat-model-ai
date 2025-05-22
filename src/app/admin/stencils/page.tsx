
"use client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StencilData, InfrastructureStencilData } from "@/types/stencil";
import Link from "next/link";
import { PlusCircle, PencilSimple, Trash, Spinner, Warning } from "phosphor-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getStencils, deleteStencil, addPlaceholderStencils } from "@/services/stencilService";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from '@/contexts/AuthContext';

type StencilType = 'infrastructure' | 'process';

export default function StencilsManagementPage() {
  const { firebaseReady, isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<StencilType>('infrastructure');
  const [stencils, setStencils] = useState<StencilData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchStencilsData = useCallback(async (type: StencilType) => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedStencils = await getStencils(type);
      setStencils(fetchedStencils);
    } catch (err) {
      console.error(`Error fetching ${type} stencils:`, err);
      let message = err instanceof Error ? err.message : `Failed to load ${type} stencils.`;
      if (message.includes("permission-denied") || message.includes("Missing or insufficient permissions")) {
         message = "You do not have permission to view the stencil list.";
      }
      setError(message);
      toast({ title: "Error", description: `Could not fetch ${type} stencils. ${message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (firebaseReady && !authLoading && isAdmin) {
      fetchStencilsData(activeTab);
    } else if (!authLoading && !isAdmin && firebaseReady) {
        setError("Access Denied: Administrator privileges required to view stencils.");
        setIsLoading(false);
    } else if (!firebaseReady && !authLoading) {
        setError("Failed to connect to the database. Please check configuration or network.");
        setIsLoading(false);
    } else {
        // This case handles when authLoading is true, so we set isLoading to true.
        setIsLoading(true);
    }
  }, [activeTab, fetchStencilsData, firebaseReady, isAdmin, authLoading]);


  const handleDelete = async (stencilId: string, stencilName: string) => {
    try {
      await deleteStencil(stencilId);
      fetchStencilsData(activeTab); // Refetch after delete
      toast({ title: "Stencil Deleted", description: `Stencil "${stencilName}" has been removed.` });
    } catch (err) {
      console.error("Error deleting stencil:", err);
      const message = err instanceof Error ? err.message : "Could not delete stencil.";
      toast({ title: "Error", description: `Could not delete stencil "${stencilName}". ${message}`, variant: "destructive" });
    }
  };

  const handleAddPlaceholders = async () => {
    const toastIdObj = toast({ title: "Processing...", description: "Adding placeholder stencils." });
    try {
      const result = await addPlaceholderStencils();
      let description = `Added ${result.infraAdded} infrastructure and ${result.processAdded} process stencils.`;
      if (result.errors.length > 0) {
        description += ` ${result.errors.length} error(s) occurred. Check console.`;
        console.error("Errors during placeholder stencil addition:", result.errors);
      }
      toast({
        id: toastIdObj.id,
        title: "Placeholders Processed",
        description: description,
        variant: result.errors.length > 0 ? "destructive" : "default",
      });
      fetchStencilsData(activeTab); // Refresh the list
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      console.error("Error adding placeholder stencils from UI:", e);
      toast({
        id: toastIdObj.id,
        title: "Error Adding Placeholders",
        description: `Could not add placeholder stencils: ${errorMsg}`,
        variant: "destructive",
      });
    }
  };


  const renderStencilTable = (type: StencilType) => {
    if (authLoading || isLoading) {
      return (
        <div className="flex items-center justify-center py-10">
          <Spinner className="h-6 w-6 animate-spin text-primary mr-2" />
          {authLoading ? "Verifying permissions..." : `Loading ${type} stencils...`}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-destructive">
          <Warning className="h-8 w-8 mb-2" />
          <p className="font-semibold">Error loading stencils</p>
          <p className="text-sm mb-2">{error}</p>
          {isAdmin && firebaseReady && <Button onClick={() => fetchStencilsData(type)} className="mt-4">Try Again</Button>}
        </div>
      );
    }

    if (!isAdmin && firebaseReady) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-destructive">
                <Warning className="h-8 w-8 mb-2" />
                <p className="font-semibold">Access Denied</p>
                <p className="text-sm mb-2">You do not have permission to manage stencils.</p>
            </div>
        );
    }

    return (
      <>
        <div className="flex justify-end mb-4">
          <Button asChild>
            <Link href={`/admin/stencils/${type}/edit/new`}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New {type.charAt(0).toUpperCase() + type.slice(1)} Stencil
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
                {type === 'infrastructure' && <TableHead>Is Boundary?</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stencils.map((stencil) => (
                <TableRow key={stencil.id}>
                  <TableCell>
                     <DynamicPhosphorIcon
                        name={stencil.iconName || 'Question'}
                        className="h-5 w-5" // Tailwind class for basic sizing
                        size={20} // Explicit size prop for Phosphor
                        style={{ color: stencil.textColor || '#000000' }}
                      />
                  </TableCell>
                  <TableCell className="font-medium">{stencil.name}</TableCell>
                  <TableCell>{stencil.stencilType}</TableCell>
                  {type === 'infrastructure' && (
                    <TableCell>
                      {(stencil as InfrastructureStencilData).isBoundary ? 'Yes' : 'No'}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild className="mr-2">
                      <Link href={`/admin/stencils/${type}/edit/${stencil.id}`}>
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
        {stencils.length === 0 && !isLoading && !error && (
          <p className="text-center text-muted-foreground mt-4">No {type} stencils found. Click "Add New" or "Add Placeholder Stencils" to create some.</p>
        )}
      </>
    );
  };

  return (
    <Card className="w-full">
        <CardHeader>
            <CardTitle>Stencil Management</CardTitle>
            <CardDescription>Manage stencils for infrastructure and process threat models.</CardDescription>
            {isAdmin && firebaseReady && (
                <Button onClick={handleAddPlaceholders} variant="outline" size="sm" className="mt-2 w-full sm:w-auto">
                    Add Placeholder Stencils (Dev Only)
                </Button>
            )}
        </CardHeader>
        <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as StencilType)}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="infrastructure">Infrastructure Stencils</TabsTrigger>
                    <TabsTrigger value="process">Process Stencils</TabsTrigger>
                </TabsList>
                <TabsContent value="infrastructure">
                    {renderStencilTable('infrastructure')}
                </TabsContent>
                <TabsContent value="process">
                    {renderStencilTable('process')}
                </TabsContent>
            </Tabs>
        </CardContent>
    </Card>
  );
}
