
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getUserThreatModels, type SavedModelInfo } from '@/services/diagram';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, PlusCircle, FolderOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link'; // Import Link for navigation

export default function DashboardPage() {
  const { currentUser, loading: authLoading, firebaseReady } = useAuth();
  const [models, setModels] = useState<SavedModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && firebaseReady && currentUser) {
      setLoadingModels(true);
      setError(null);
      getUserThreatModels(currentUser.uid)
        .then(fetchedModels => {
          setModels(fetchedModels);
        })
        .catch(err => {
          console.error("Error fetching models:", err);
          setError("Failed to load your threat models.");
          toast({ title: "Error", description: "Could not fetch saved models.", variant: "destructive" });
        })
        .finally(() => {
          setLoadingModels(false);
        });
    } else if (!authLoading && !currentUser) {
      // User is not logged in, AuthProvider should handle redirect, but handle state here too
      setLoadingModels(false);
    } else if (!authLoading && !firebaseReady) {
       setError("Database connection not available.");
       setLoadingModels(false);
    }
    // Keep loading if auth is still loading or Firebase not ready
  }, [currentUser, authLoading, firebaseReady, toast]);

  const handleLoadModel = (modelId: string) => {
    router.push(`/projects/${modelId}`); // Navigate to the project page
  };

   const handleNewModel = () => {
     // Navigate to the project page with a special identifier or query param for 'new'?
     // Or just navigate to a generic project route which starts blank.
     // For simplicity, let's assume `/projects/new` or similar route could handle it,
     // or just redirect to `/projects/default` which ProjectClientLayout treats as new.
     // Let's use the existing logic: redirect to a dummy ID that ProjectClientLayout ignores
     // and starts fresh.
     router.push(`/projects/new`); // ProjectClientLayout will treat this as new
   };


  if (authLoading || loadingModels) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        Loading dashboard...
      </div>
    );
  }

   if (!currentUser) {
     // Should be redirected by AuthProvider, but render fallback message
     return (
        <div className="flex items-center justify-center h-screen p-4 text-center">
            <p>Redirecting to login...</p>
        </div>
     );
   }

  return (
    <div className="container mx-auto py-10">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
             <div>
                <CardTitle>Threat Models Dashboard</CardTitle>
                <CardDescription>View, load, or create new threat models.</CardDescription>
             </div>
             <Button onClick={handleNewModel}>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Model
            </Button>
          </div>

        </CardHeader>
        <CardContent>
          {error && <p className="text-destructive mb-4">{error}</p>}
          {models.length === 0 && !loadingModels && !error ? (
            <p className="text-center text-muted-foreground py-8">You haven't saved any threat models yet. Click "New Model" to start.</p>
          ) : (
            <ScrollArea className="h-[60vh] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model Name</TableHead>
                    <TableHead>Last Modified</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell className="font-medium">{model.name}</TableCell>
                      <TableCell>
                        {model.modifiedDate
                          ? formatDistanceToNow(model.modifiedDate, { addSuffix: true })
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                         <Button variant="outline" size="sm" onClick={() => handleLoadModel(model.id)}>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Open
                         </Button>
                         {/* Add Delete button later */}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
