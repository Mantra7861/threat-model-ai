
"use client";

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
import { Loader2, AlertTriangle } from "lucide-react";

const ALL_LUCIDE_ICON_NAMES = Object.keys(LucideIcons).filter(key => 
    key !== 'createLucideIcon' && 
    key !== 'icons' && 
    typeof LucideIcons[key as keyof typeof LucideIcons] === 'function' // Ensure it's a component
) as (keyof typeof LucideIcons)[];


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
  const [iconName, setIconName] = useState<keyof typeof LucideIcons>("Package"); // Default to a common icon
  const [textColor, setTextColor] = useState("#000000");
  const [staticPropertiesString, setStaticPropertiesString] = useState("");
  const [isBoundary, setIsBoundary] = useState(false);
  const [boundaryColor, setBoundaryColor] = useState("#ff0000");
  
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (!isNew && stencilId) {
      setIsLoading(true);
      setError(null);
      getStencilById(stencilId)
        .then(async stencil => {
          if (stencil) {
            setName(stencil.name);
            setIconName(stencil.iconName as keyof typeof LucideIcons); // Cast as it's fetched
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
            router.replace(`/admin/stencils/${stencilType}`);
          }
        })
        .catch(err => {
          console.error("Error fetching stencil:", err);
          setError(err instanceof Error ? err.message : "Failed to load stencil data.");
          toast({ title: "Error", description: "Could not load stencil data.", variant: "destructive" });
        })
        .finally(() => setIsLoading(false));
    }
  }, [stencilId, isNew, stencilType, router, toast]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    if (!name.trim()) {
        toast({ title: "Validation Error", description: "Stencil name cannot be empty.", variant: "destructive" });
        setIsSaving(false);
        return;
    }

    const properties = await parseStaticPropertiesString(staticPropertiesString);
    
    let stencilPayload: Omit<StencilData, 'id'> = { // Use Omit for payload
      name: name.trim(),
      iconName,
      textColor,
      properties,
      stencilType,
    };

    if (stencilType === 'infrastructure') {
      (stencilPayload as Omit<InfrastructureStencilData, 'id'>).isBoundary = isBoundary;
      if (isBoundary) {
        (stencilPayload as Omit<InfrastructureStencilData, 'id'>).boundaryColor = boundaryColor;
      }
    }

    try {
      if (isNew) {
        await addStencil(stencilPayload as StencilFirestoreData); // Cast for addStencil
        toast({ title: "Stencil Created", description: `Stencil "${name}" has been created.` });
      } else {
        await updateStencil(stencilId, stencilPayload); // updateStencil takes Partial
        toast({ title: "Stencil Updated", description: `Stencil "${name}" has been updated.` });
      }
      router.push(`/admin/stencils/${stencilType}`);
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
        <select
          id="iconName"
          name="iconName"
          value={iconName}
          onChange={(e) => setIconName(e.target.value as keyof typeof LucideIcons)}
          disabled={isSaving}
          className="w-full p-2 border rounded-md bg-background text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {ALL_LUCIDE_ICON_NAMES.map(iconKey => (
            <option key={iconKey} value={iconKey}>{iconKey}</option>
          ))}
        </select>
         {iconName && LucideIcons[iconName] && React.createElement(LucideIcons[iconName] as React.ElementType, { className: "w-8 h-8 mt-2 inline-block", style: {color: textColor} })}
         {iconName && !LucideIcons[iconName] && <LucideIcons.HelpCircle className="w-8 h-8 mt-2 inline-block text-muted-foreground" title="Selected icon not found in Lucide set" />}

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
        <p className="text-xs text-muted-foreground mt-1">These are default properties added to new instances of this stencil on the canvas. Values will be stored as strings.</p>
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
