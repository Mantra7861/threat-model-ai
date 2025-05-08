
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ModelType } from '@/services/diagram';

interface NewModelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateModel: (name: string, type: ModelType) => void;
}

export function NewModelDialog({ isOpen, onClose, onCreateModel }: NewModelDialogProps) {
  const [modelName, setModelName] = useState("Untitled Model");
  const [modelType, setModelType] = useState<ModelType>('infrastructure');

  const handleSubmit = () => {
    if (modelName.trim() === "") {
      // Basic validation, can be enhanced
      alert("Model name cannot be empty.");
      return;
    }
    onCreateModel(modelName.trim(), modelType);
    onClose();
    // Reset for next time
    setModelName("Untitled Model");
    setModelType('infrastructure');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Threat Model</DialogTitle>
          <DialogDescription>
            Choose the type of model and give it a name.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="model-name" className="text-right">
              Name
            </Label>
            <Input
              id="model-name"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Payment Gateway Process"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Type</Label>
            <RadioGroup
              value={modelType}
              onValueChange={(value) => setModelType(value as ModelType)}
              className="col-span-3 flex flex-col space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="infrastructure" id="type-infra" />
                <Label htmlFor="type-infra">Infrastructure Model</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="process" id="type-process" />
                <Label htmlFor="type-process">Process Model</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Create Model</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
