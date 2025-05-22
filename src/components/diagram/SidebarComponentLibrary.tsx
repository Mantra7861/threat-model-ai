
"use client";

import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Server, 
    Database, 
    Cloud, 
    Router, 
    ShieldCheck, 
    Square,
    Circle,
    Archive, 
    StickyNote,
    TerminalSquare,
    HelpCircle, // Fallback icon
    Loader2,
    AlertTriangle
} from "lucide-react"; 
import { useProjectContext } from "@/contexts/ProjectContext";
import { getStencils, type StencilData } from "@/services/stencilService";
import { useToast } from "@/hooks/use-toast";
import DynamicLucideIcon from '@/components/ui/DynamicLucideIcon';

// Custom SVG for DiamondIcon if Lucide's default isn't preferred or to ensure fill
// This is kept for local rendering in the palette if needed, CustomNode will use its own logic.
const CustomDiamondIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth="0.1" className="text-card-foreground">
    <polygon points="12 2 22 12 12 22 2 12" />
  </svg>
);

interface DraggableComponentProps {
  stencil: StencilData;
}

const DraggableComponent = ({ stencil }: DraggableComponentProps) => {
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("application/reactflow", JSON.stringify(stencil));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className="flex flex-col items-center p-3 border rounded-lg shadow-sm cursor-grab bg-card hover:shadow-md transition-shadow active:cursor-grabbing group-data-[collapsible=icon]:p-2"
      draggable
      onDragStart={handleDragStart}
      title={stencil.name} 
    >
      <DynamicLucideIcon 
        name={stencil.iconName || 'HelpCircle'} 
        className="w-6 h-6 mb-1 group-data-[collapsible=icon]:w-5 group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:mb-0"
        style={{ color: stencil.textColor || 'var(--card-foreground)' }}
      />
       <span className="text-xs font-medium text-card-foreground text-center w-full truncate px-1 group-data-[collapsible=icon]:hidden">
        {stencil.name}
      </span>
    </div>
  );
};


export function SidebarComponentLibrary() {
  const { modelType } = useProjectContext();
  const [stencils, setStencils] = useState<StencilData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchStencilsForType = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedStencils = await getStencils(modelType);
        setStencils(fetchedStencils);
      } catch (err) {
        console.error(`Error fetching ${modelType} stencils for library:`, err);
        setError(err instanceof Error ? err.message : `Failed to load ${modelType} stencils.`);
        toast({ title: "Error", description: `Could not load stencils for the library.`, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStencilsForType();
  }, [modelType, toast]);


  const title = modelType === 'process' ? 'Process Stencils' : 'Infrastructure Stencils';

  if (isLoading) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-sidebar-foreground/80">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <p className="text-sm">Loading {title}...</p>
        </div>
    );
  }

  if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-destructive">
            <AlertTriangle className="h-6 w-6 mb-2" />
            <p className="text-sm font-semibold">Error Loading Stencils</p>
            <p className="text-xs text-center">{error}</p>
        </div>
      );
  }

  if (stencils.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-sidebar-foreground/70">
            <HelpCircle className="h-8 w-8 mb-3" />
            <p className="text-sm text-center">No {title} available.</p>
            <p className="text-xs text-center mt-1">Please add some in Admin Panel.</p>
        </div>
    );
  }


  return (
    <ScrollArea className="h-full p-2">
       <div className="space-y-4">
         <h3 className="text-sm font-medium text-sidebar-foreground/80 px-2 group-data-[collapsible=icon]:hidden">{title}</h3>
        <div className="grid grid-cols-2 gap-2 group-data-[collapsible=icon]:grid-cols-1">
          {stencils.map((stencil) => (
            <DraggableComponent key={stencil.id} stencil={stencil} />
          ))}
        </div>
       </div>
    </ScrollArea>
  );
}
