"use client";

import { useEffect, useState } from 'react';
import { getDiagram, type Diagram, type Component } from '@/services/diagram';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Server, Database, Cloud, Router, ShieldCheck, ArrowRight } from 'lucide-react'; // Example icons

interface DiagramCanvasProps {
  projectId: string;
}

// Map component types to icons and styles
const componentVisuals: Record<string, { icon: React.ElementType; style: string }> = {
  server: { icon: Server, style: "bg-blue-100 border-blue-300 text-blue-800" },
  database: { icon: Database, style: "bg-green-100 border-green-300 text-green-800" },
  service: { icon: Cloud, style: "bg-purple-100 border-purple-300 text-purple-800" },
  flow: { icon: ArrowRight, style: "text-gray-600" }, // Flow might be represented differently (line)
  boundary: { icon: ShieldCheck, style: "border-dashed border-red-400 text-red-600" }, // Boundary might be a container
  router: { icon: Router, style: "bg-yellow-100 border-yellow-300 text-yellow-800" },
  default: { icon: 'div', style: "bg-gray-100 border-gray-300 text-gray-800" },
};

export function DiagramCanvas({ projectId }: DiagramCanvasProps) {
  const [diagram, setDiagram] = useState<Diagram | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDiagram() {
      setLoading(true);
      setError(null);
      try {
        const data = await getDiagram(projectId);
        setDiagram(data);
      } catch (err) {
        setError('Failed to load diagram.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadDiagram();
  }, [projectId]);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Loading Diagram...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-full text-destructive">{error}</div>;
  }

  if (!diagram) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">No diagram data found.</div>;
  }

  // Basic rendering logic - A real canvas would use SVG/Canvas API or a library like react-flow
  const renderComponent = (component: Component) => {
     const visual = componentVisuals[component.type] || componentVisuals.default;
     const Icon = visual.icon;

     // Very basic positioning - replace with actual layout logic
     const style = {
         position: 'absolute' as 'absolute',
         left: `${Math.random() * 80 + 10}%`, // Random position for demo
         top: `${Math.random() * 80 + 10}%`,  // Random position for demo
         transform: 'translate(-50%, -50%)',
     };

     return (
         <div
           key={component.id}
           className={cn(
             "flex flex-col items-center p-3 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow",
             visual.style
           )}
           style={style}
           onClick={() => console.log(`Selected component: ${component.id}`)} // Add interaction later
         >
           <Icon className="w-8 h-8 mb-1" />
           <span className="text-xs font-medium truncate max-w-[80px]">
             {component.properties?.name || component.type}
           </span>
         </div>
     );
  }

  return (
    <ScrollArea className="h-full w-full bg-background rounded-lg border">
       {/* The div below acts as the canvas area */}
      <div className="relative w-[2000px] h-[1500px]"> {/* Large scrollable area */}
         {diagram.components.map(renderComponent)}
         {/* TODO: Render connections/flows */}
       </div>
       <p className="absolute bottom-2 right-2 text-xs text-muted-foreground p-2 bg-background/80 rounded">
         Placeholder Canvas - Drag & Drop and Connections not implemented.
       </p>
    </ScrollArea>
  );
}

// Helper function for conditional class names
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
