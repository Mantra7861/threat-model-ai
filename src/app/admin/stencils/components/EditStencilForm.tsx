
"use client";

import React from "react"; // Ensure React is imported
import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { StencilData, InfrastructureStencilData, StencilFirestoreData } from "@/types/stencil";
import * as PhosphorIcons from '@phosphor-icons/react'; // Corrected import
import { addStencil, getStencilById, updateStencil, parseStaticPropertiesString, formatStaticPropertiesToString } from "@/services/stencilService";
import { Spinner, Question as QuestionIcon, Warning } from "@phosphor-icons/react"; // Corrected import


interface EditStencilFormProps {
  stencilType: 'infrastructure' | 'process';
}

export default function EditStencilForm({ stencilType }: EditStencilFormProps) {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const stencilId = params.stencilId as string;

  const isNew = stencilId === 'new';

  const [name, setName] = useState("");
  const [iconName, setIconName] = useState<string>(isNew ? "Package" : ""); // Default for new, load for existing
  const [textColor, setTextColor] = useState("#000000");
  const [staticPropertiesString, setStaticPropertiesString] = useState("");
  const [isBoundary, setIsBoundary] = useState(false);
  const [boundaryColor, setBoundaryColor] = useState("#ff0000");

  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const loadStencilData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const stencil = await getStencilById(stencilId);
        if (stencil) {
          setName(stencil.name);
          setIconName(stencil.iconName || "Package"); 
          setTextColor(stencil.textColor || "#000000");
          const formattedProps = await formatStaticPropertiesToString(stencil.properties);
          setStaticPropertiesString(formattedProps);
          if (stencil.stencilType === 'infrastructure') {
            const infraStencil = stencil as InfrastructureStencilData;
            setIsBoundary(infraStencil.isBoundary || false);
            setBoundaryColor(infraStencil.boundaryColor || "#ff0000");
          }
        } else {
          toast({ title: "Error", description: "Stencil not found.", variant: "destructive" });
          router.replace(`/admin/stencils`);
        }
      } catch (err) {
        console.error("Error fetching stencil:", err);
        setError(err instanceof Error ? err.message : "Failed to load stencil data.");
        toast({ title: "Error", description: "Could not load stencil data.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    if (!isNew && stencilId) {
      loadStencilData();
    } else {
      setIsLoading(false);
    }
  }, [stencilId, isNew, router, toast]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    if (!name.trim()) {
        toast({ title: "Validation Error", description: "Stencil name cannot be empty.", variant: "destructive" });
        setIsSaving(false);
        return;
    }

    const finalIconName = iconName.trim() || "Package"; 

    if (!(PhosphorIcons as any)[finalIconName as keyof typeof PhosphorIcons]) {
        toast({ title: "Validation Warning", description: `Icon name "${finalIconName}" might not be a valid Phosphor icon. Preview will show fallback. Please check Phosphor Icons website.`, variant: "default" });
    }


    const properties = await parseStaticPropertiesString(staticPropertiesString);

    let stencilPayload: Omit<StencilData, 'id' | 'createdDate' | 'modifiedDate'> = {
      name: name.trim(),
      iconName: finalIconName as keyof typeof PhosphorIcons,
      textColor,
      properties,
      stencilType,
    };

    if (stencilType === 'infrastructure') {
      (stencilPayload as Omit<InfrastructureStencilData, 'id' | 'createdDate' | 'modifiedDate'>).isBoundary = isBoundary;
      if (isBoundary) {
        (stencilPayload as Omit<InfrastructureStencilData, 'id' | 'createdDate' | 'modifiedDate'>).boundaryColor = boundaryColor;
      }
    }

    try {
      if (isNew) {
        await addStencil(stencilPayload as StencilFirestoreData);
        toast({ title: "Stencil Created", description: `Stencil "${name}" has been created.` });
      } else {
        await updateStencil(stencilId, stencilPayload);
        toast({ title: "Stencil Updated", description: `Stencil "${name}" has been updated.` });
      }
      router.push(`/admin/stencils`);
    } catch (err) {
      console.error("Error saving stencil:", err);
      const errorMsg = err instanceof Error ? err.message : "Failed to save stencil.";
      setError(errorMsg);
      toast({ title: "Error Saving Stencil", description: errorMsg, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center py-10">
            <Spinner className="h-6 w-6 animate-spin text-primary mr-2" />
            Loading stencil data...
        </div>
    );
  }

  if (error && !isNew) {
      return (
          <div className="flex flex-col items-center justify-center py-10 text-destructive">
              <Warning className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error loading stencil</p>
              <p className="text-sm mb-4">{error}</p>
              <Button onClick={() => router.back()} variant="outline">Go Back</Button>
          </div>
      );
  }

  const IconComponentToPreview = (PhosphorIcons as any)[iconName as keyof typeof PhosphorIcons] || QuestionIcon;


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && isSaving && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive border border-destructive/50">
              <p className="font-medium text-sm">Failed to save: {error}</p>
          </div>
      )}
      <div>
        <Label htmlFor="name">Stencil Name</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isSaving}
        />
      </div>

      <div>
        <Label htmlFor="iconName">Icon Name (Phosphor Icons)</Label>
        <Input
          id="iconName"
          name="iconName"
          value={iconName}
          onChange={(e) => setIconName(e.target.value)}
          placeholder="e.g., HardDrive, Circle, Diamond (PascalCase)"
          disabled={isSaving}
        />
         <p className="text-xs text-muted-foreground mt-1">
            Enter the PascalCase name of an icon from {' '}
            <a href="https://phosphoricons.com/" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                Phosphor Icons
            </a>.
            The preview below will update. If the name is invalid, a question mark icon will be shown.
        </p>
        <IconComponentToPreview 
            size={32} 
            className="w-8 h-8 mt-2 inline-block" 
            style={{color: textColor || '#000000'}} 
            title={iconName && (PhosphorIcons as any)[iconName as keyof typeof PhosphorIcons] ? `Preview: ${iconName}` : `Icon "${iconName}" not found. Defaulting to question mark.`}
        />
      </div>

      <div>
        <Label htmlFor="textColor">Icon/Text Color</Label>
        <Input
          id="textColor"
          name="textColor"
          type="color"
          value={textColor}
          onChange={(e) => setTextColor(e.target.value)}
          disabled={isSaving}
          className="h-10 p-1"
        />
      </div>

      {stencilType === 'infrastructure' && (
        <>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isBoundary"
              name="isBoundary"
              checked={isBoundary}
              onCheckedChange={(checked) => setIsBoundary(Boolean(checked))}
              disabled={isSaving}
            />
            <Label htmlFor="isBoundary" className="font-normal">Is Trust Boundary</Label>
          </div>

          {isBoundary && (
            <div>
              <Label htmlFor="boundaryColor">Boundary Color</Label>
              <Input
                id="boundaryColor"
                name="boundaryColor"
                type="color"
                value={boundaryColor}
                onChange={(e) => setBoundaryColor(e.target.value)}
                disabled={isSaving}
                className="h-10 p-1"
              />
            </div>
          )}
        </>
      )}

      <div>
        <Label htmlFor="staticPropertiesString">Default Properties (key:value per line)</Label>
        <Textarea
          id="staticPropertiesString"
          name="staticPropertiesString"
          value={staticPropertiesString}
          onChange={(e) => setStaticPropertiesString(e.target.value)}
          rows={5}
          placeholder="Example:\nOS: Linux\nVersion: Latest\nIsEncrypted: true"
          disabled={isSaving}
        />
        <p className="text-xs text-muted-foreground mt-1">These are default properties added to new instances of this stencil on the canvas. Values will be stored as strings, booleans, or numbers based on parsing.</p>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <PhosphorIcons.Spinner className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSaving ? (isNew ? 'Creating...' : 'Saving...') : (isNew ? 'Create Stencil' : 'Save Changes')}
        </Button>
      </div>
    </form>
  );
}
