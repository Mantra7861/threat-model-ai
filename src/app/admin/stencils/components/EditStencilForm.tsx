
"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { StencilData, InfrastructureStencilData, ProcessStencilData } from "@/types/stencil";
import { placeholderInfrastructureStencils, placeholderProcessStencils } from "@/lib/placeholder-stencils";
import * as LucideIcons from 'lucide-react'; // Import all icons

const ALL_LUCIDE_ICON_NAMES = Object.keys(LucideIcons).filter(key => key !== 'createLucideIcon' && key !== 'icons' && typeof LucideIcons[key as keyof typeof LucideIcons] === 'object') as (keyof typeof LucideIcons)[];


interface EditStencilFormProps {
  stencilType: 'infrastructure' | 'process';
}

export default function EditStencilForm({ stencilType }: EditStencilFormProps) {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const stencilId = params.stencilId as string;
  
  const isNew = stencilId === 'new';
  const [formData, setFormData] = useState<Partial<StencilData>>({
    name: "",
    iconName: "Package", // Default icon
    textColor: "#000000",
    staticPropertiesString: "",
    stencilType: stencilType,
    isBoundary: false,
    boundaryColor: "#ff0000",
  });
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    if (!isNew) {
      // In a real app, fetch stencil data from Firestore here.
      // For Phase 1, find in placeholder data.
      let foundStencil;
      if (stencilType === 'infrastructure') {
        foundStencil = placeholderInfrastructureStencils.find(s => s.id === stencilId);
      } else {
        foundStencil = placeholderProcessStencils.find(s => s.id === stencilId);
      }

      if (foundStencil) {
        setFormData(foundStencil);
      } else {
        toast({ title: "Error", description: "Stencil not found.", variant: "destructive" });
        router.back();
      }
    }
    setIsLoading(false);
  }, [stencilId, isNew, stencilType, router, toast]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox' && e.target instanceof HTMLInputElement) {
      setFormData(prev => ({ ...prev, [name]: e.target.checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // In Phase 1, just show a toast message. No actual saving to Firestore.
    console.log("Form data submitted:", formData);
    toast({
      title: "Stencil Saved (Locally)",
      description: `Stencil "${formData.name}" has been saved (simulated).`,
    });
    // Optionally, navigate back or to the list page
    // router.push(`/admin/stencils/${stencilType}`);
  };

  if (isLoading && !isNew) {
    return <p>Loading stencil data...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name">Stencil Name</Label>
        <Input
          id="name"
          name="name"
          value={formData.name || ""}
          onChange={handleChange}
          required
        />
      </div>

      <div>
        <Label htmlFor="iconName">Icon (Lucide Name)</Label>
        <select
          id="iconName"
          name="iconName"
          value={formData.iconName || "Package"}
          onChange={handleChange}
          className="w-full p-2 border rounded-md bg-background text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {ALL_LUCIDE_ICON_NAMES.map(iconKey => (
            <option key={iconKey} value={iconKey}>{iconKey}</option>
          ))}
        </select>
         {formData.iconName && React.createElement(LucideIcons[formData.iconName as keyof typeof LucideIcons] || LucideIcons.HelpCircle, { className: "w-8 h-8 mt-2 inline-block", style: {color: formData.textColor} })}
      </div>
      
      <div>
        <Label htmlFor="textColor">Text Color</Label>
        <Input
          id="textColor"
          name="textColor"
          type="color"
          value={formData.textColor || "#000000"}
          onChange={handleChange}
        />
      </div>

      {stencilType === 'infrastructure' && (
        <>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isBoundary"
              name="isBoundary"
              checked={(formData as InfrastructureStencilData).isBoundary || false}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isBoundary: Boolean(checked) }))}
            />
            <Label htmlFor="isBoundary">Is Trust Boundary</Label>
          </div>

          {(formData as InfrastructureStencilData).isBoundary && (
            <div>
              <Label htmlFor="boundaryColor">Boundary Color</Label>
              <Input
                id="boundaryColor"
                name="boundaryColor"
                type="color"
                value={(formData as InfrastructureStencilData).boundaryColor || "#ff0000"}
                onChange={handleChange}
              />
            </div>
          )}
        </>
      )}

      <div>
        <Label htmlFor="staticPropertiesString">Static Properties (key: value per line)</Label>
        <Textarea
          id="staticPropertiesString"
          name="staticPropertiesString"
          value={formData.staticPropertiesString || ""}
          onChange={handleChange}
          rows={5}
          placeholder="Example:\nOS: Linux\nVersion: Latest"
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit">Save Stencil</Button>
      </div>
    </form>
  );
}
