
"use client";

import React from "react"; 
import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { StencilData, InfrastructureStencilData, ProcessStencilData, StencilFirestoreData } from "@/types/stencil";
import * as LucideIcons from 'lucide-react';
import { addStencil, getStencilById, updateStencil, parseStaticPropertiesString, formatStaticPropertiesToString } from "@/services/stencilService";
import { Loader2, AlertTriangle, HelpCircle as HelpCircleIcon } from "lucide-react";

// Dynamically get all icon names from lucide-react, filtering out non-component exports
const ALL_LUCIDE_ICON_NAMES = Object.keys(LucideIcons)
  .filter((key) => {
    const iconComponent = (LucideIcons as any)[key]; // Use 'as any' for simpler access in filter
    if (typeof iconComponent === 'function') {
      // Exclude known non-visual utility functions/types by name.
      // Also explicitly exclude 'icons' which is an object map.
      if (key === 'createLucideIcon' || key === 'IconNode' || key === 'LucideIcon' || key === 'LucideProps' || key === 'default' || key === 'icons') {
        return false;
      }
      // Most actual icon components are PascalCase. This is a good heuristic.
      return key[0] === key[0].toUpperCase();
    }
    return false;
  })
  .sort() as (keyof typeof LucideIcons)[];


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
  const [iconName, setIconName] = useState<keyof typeof LucideIcons>("Package"); // Default icon
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
          
          // Use ALL_LUCIDE_ICON_NAMES for validation here as well
          if (stencil.iconName && ALL_LUCIDE_ICON_NAMES.includes(stencil.iconName as keyof typeof LucideIcons)) {
            setIconName(stencil.iconName as keyof typeof LucideIcons);
          } else {
            if (stencil.iconName && ALL_LUCIDE_ICON_NAMES.length > 0) { // Only warn if an invalid iconName was actually set AND we have icons to compare against
                console.warn(`Invalid or non-component icon name "${stencil.iconName}" from Firestore for stencil ID ${stencilId}. Defaulting to "Package". Available icons: ${ALL_LUCIDE_ICON_NAMES.length}`);
            } else if (stencil.iconName) {
                console.warn(`Icon name "${stencil.iconName}" present in stencil data, but ALL_LUCIDE_ICON_NAMES is empty. Defaulting to "Package".`);
            }
            setIconName("Package"); 
          }
          
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
  }, [stencilId, isNew, router, toast]); // ALL_LUCIDE_ICON_NAMES is stable, no need to add as dependency

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    if (!name.trim()) {
        toast({ title: "Validation Error", description: "Stencil name cannot be empty.", variant: "destructive" });
        setIsSaving(false);
        return;
    }
    
    if (!iconName || (ALL_LUCIDE_ICON_NAMES.length > 0 && !ALL_LUCIDE_ICON_NAMES.includes(iconName))) {
        // If ALL_LUCIDE_ICON_NAMES is empty, we can't validate against it, so we trust iconName if present
        if (ALL_LUCIDE_ICON_NAMES.length > 0) {
             toast({ title: "Validation Error", description: `Invalid icon "${iconName}" selected. Please choose an icon from the list.`, variant: "destructive" });
        } else if (!iconName) {
             toast({ title: "Validation Error", description: `No icon selected.`, variant: "destructive" });
        }
        // If no icons are loaded, we might allow submission with the current iconName, or default.
        // For now, if the list is empty but an iconName is set, we proceed. If no iconName, error.
        if (!iconName && ALL_LUCIDE_ICON_NAMES.length > 0) setIconName("Package"); 
        if(!iconName) {
            setIsSaving(false);
            return;
        }
    }


    const properties = await parseStaticPropertiesString(staticPropertiesString);
    
    let stencilPayload: Omit<StencilData, 'id' | 'createdDate' | 'modifiedDate'> = { 
      name: name.trim(),
      iconName,
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
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            Loading stencil data...
        </div>
    );
  }

  if (error && !isNew) {
      return (
          <div className="flex flex-col items-center justify-center py-10 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error loading stencil</p>
              <p className="text-sm mb-4">{error}</p>
              <Button onClick={() => router.back()} variant="outline">Go Back</Button>
          </div>
      );
  }


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
        <Label htmlFor="iconName">Icon (Lucide Name)</Label>
        {ALL_LUCIDE_ICON_NAMES.length === 0 && <p className="text-sm text-destructive">No Lucide icons found or loaded.</p>}
        <select
          id="iconName"
          name="iconName"
          value={iconName}
          onChange={(e) => setIconName(e.target.value as keyof typeof LucideIcons)}
          disabled={isSaving || ALL_LUCIDE_ICON_NAMES.length === 0}
          className="w-full p-2 border rounded-md bg-background text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <option value="" disabled>Select an icon</option>
          {ALL_LUCIDE_ICON_NAMES.map(iconKey => (
            <option key={iconKey} value={iconKey}>{iconKey}</option>
          ))}
        </select>
         {iconName && (LucideIcons as any)[iconName] && React.createElement((LucideIcons as any)[iconName] as React.ElementType, { className: "w-8 h-8 mt-2 inline-block", style: {color: textColor || '#000000'} })}
         {iconName && !(LucideIcons as any)[iconName] && <HelpCircleIcon className="w-8 h-8 mt-2 inline-block text-muted-foreground" title="Selected icon not found or invalid in Lucide set" />}
         {!iconName && <HelpCircleIcon className="w-8 h-8 mt-2 inline-block text-muted-foreground" title="No icon selected" />}
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
            <Label htmlFor="isBoundary">Is Trust Boundary</Label>
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
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isSaving ? (isNew ? 'Creating...' : 'Saving...') : (isNew ? 'Create Stencil' : 'Save Changes')}
        </Button>
      </div>
    </form>
  );
}

