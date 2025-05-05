"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { suggestComponentProperties } from '@/ai/flows/suggest-component-properties';
import { useToast } from '@/hooks/use-toast';
import { Sparkles } from 'lucide-react';

// Mock component data - replace with actual selected component state
const mockSelectedComponent = {
  id: '1',
  type: 'server',
  properties: {
    name: 'Web Server 01',
    os: 'Ubuntu 22.04',
    ipAddress: '192.168.1.100',
    description: 'Main customer-facing web server.',
  }
};

export function SidebarPropertiesPanel() {
  // TODO: Replace mock data with state management (e.g., Zustand, Context API)
  // to get the actual selected component from the canvas
  const [selectedComponent, setSelectedComponent] = useState<any>(mockSelectedComponent);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const { toast } = useToast();


  const handleInputChange = (propName: string, value: any) => {
    setSelectedComponent((prev: any) => ({
      ...prev,
      properties: {
        ...prev.properties,
        [propName]: value,
      },
    }));
    // TODO: Update the actual component data in the diagram state
  };

   const handleSuggestProperties = async () => {
    if (!selectedComponent) return;

    setIsSuggesting(true);
    toast({
      title: "AI Suggesting Properties",
      description: "Analyzing component type and context...",
    });

    try {
      const suggestedProps = await suggestComponentProperties({
        component: {
            id: selectedComponent.id,
            type: selectedComponent.type,
            properties: selectedComponent.properties,
        },
        // Optionally pass diagram description if available
        // diagramDescription: "A web application for e-commerce",
      });

      // Merge suggested properties (avoid overwriting existing ones explicitly modified)
      setSelectedComponent((prev: any) => ({
        ...prev,
        properties: {
          ...suggestedProps, // Place suggested first
          ...prev.properties, // Existing properties take precedence if keys match
        },
      }));

      toast({
        title: "Properties Suggested",
        description: "AI suggested relevant properties.",
      });

    } catch (error) {
      console.error("Error suggesting properties:", error);
      toast({
        title: "Suggestion Error",
        description: "Could not get AI property suggestions.",
        variant: "destructive",
      });
    } finally {
      setIsSuggesting(false);
    }
  };


  if (!selectedComponent) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
        Select a component on the canvas to view and edit its properties.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">Component Properties</h3>
          <p className="text-sm text-muted-foreground">Edit details for '{selectedComponent.properties?.name || selectedComponent.type}'</p>
        </div>

        <div className="space-y-4">
          {Object.entries(selectedComponent.properties).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`prop-${key}`} className="capitalize">
                {key.replace(/([A-Z])/g, ' $1')} {/* Add space before caps */}
              </Label>
              {typeof value === 'string' && value.length > 50 ? (
                 <Textarea
                  id={`prop-${key}`}
                  value={value}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  className="text-sm"
                  rows={3}
                />
              ) : typeof value === 'boolean' ? (
                 <Input
                    type="checkbox"
                    id={`prop-${key}`}
                    checked={value}
                    onChange={(e) => handleInputChange(key, e.target.checked)}
                    className="w-4 h-4 accent-primary" // Simple checkbox styling
                  />
              ) : (
                <Input
                  id={`prop-${key}`}
                  value={String(value)} // Handle non-string values
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  className="text-sm"
                  type={typeof value === 'number' ? 'number' : 'text'}
                />
               )}
            </div>
          ))}
        </div>

         <Button onClick={handleSuggestProperties} disabled={isSuggesting} variant="outline" size="sm" className="w-full">
             <Sparkles className="mr-2 h-4 w-4" />
             {isSuggesting ? "Suggesting..." : "AI Suggest Properties"}
        </Button>

        {/* Placeholder for saving changes - In a real app, changes might auto-save or have a dedicated save button */}
        {/* <Button size="sm" className="w-full">Save Properties</Button> */}
      </div>
    </ScrollArea>
  );
}
