
"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SavedModelInfo } from '@/services/diagram'; // Assuming type is exported from diagram service
import { formatDistanceToNow } from 'date-fns'; // For relative dates

interface LoadModelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  models: SavedModelInfo[];
  onLoadModel: (modelId: string) => void;
}

export function LoadModelDialog({ isOpen, onClose, models, onLoadModel }: LoadModelDialogProps) {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const handleSelect = (modelId: string) => {
    setSelectedModelId(modelId);
  };

  const handleLoad = () => {
    if (selectedModelId) {
      onLoadModel(selectedModelId);
    }
    onClose(); // Close dialog after attempting load
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Load Saved Threat Model</DialogTitle>
          <DialogDescription>
            Select a model to load onto the canvas. Unsaved changes will be lost.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh]">
            {models.length === 0 ? (
                 <p className="text-center text-muted-foreground">No saved models found.</p>
            ) : (
                <ScrollArea className="h-[40vh] border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Last Modified</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {models.map((model) => (
                                <TableRow
                                    key={model.id}
                                    data-state={selectedModelId === model.id ? 'selected' : undefined}
                                    className="cursor-pointer"
                                    onClick={() => handleSelect(model.id)}
                                >
                                    <TableCell className="font-medium">{model.name}</TableCell>
                                    <TableCell>
                                        {model.modifiedDate
                                            ? formatDistanceToNow(model.modifiedDate, { addSuffix: true })
                                            : 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent row click handler
                                                handleSelect(model.id);
                                                handleLoad(); // Directly load on button click for convenience
                                            }}
                                        >
                                            Load
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {/* Optionally keep the "Load Selected" button if direct button click isn't preferred */}
          {/* <Button onClick={handleLoad} disabled={!selectedModelId}>Load Selected</Button> */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
