
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Server, Database, Cloud, Router, ShieldCheck, ArrowRight, Circle, FileTextIcon, KeyboardIcon, SigmaIcon, MinusIcon, Square, ChevronsUpDownIcon, CaseSensitiveIcon, WorkflowIcon, RectangleHorizontalIcon, EllipsisIcon, DiamondIcon, FileInputIcon, WaypointsIcon } from "lucide-react"; 
import { useProjectContext } from "@/contexts/ProjectContext";

interface DraggableComponentProps {
  type: string;
  label: string;
  icon: React.ElementType;
}

const DraggableComponent = ({ type, label, icon: Icon }: DraggableComponentProps) => {
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("application/reactflow", type);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className="flex flex-col items-center p-3 border rounded-lg shadow-sm cursor-grab bg-card hover:shadow-md transition-shadow active:cursor-grabbing group-data-[collapsible=icon]:p-2"
      draggable
      onDragStart={handleDragStart}
      title={label} 
    >
      <Icon className="w-6 h-6 mb-1 text-sidebar-foreground group-data-[collapsible=icon]:w-5 group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:mb-0" />
       <span className="text-xs font-medium text-card-foreground text-center w-full truncate px-1 group-data-[collapsible=icon]:hidden">
        {label}
      </span>
    </div>
  );
};

// SVG Icons for custom shapes (if Lucide doesn't cover them)
const ParallelogramLucideIcon = () => ( // Using Waypoints as a stand-in
  <WaypointsIcon />
);

const TrapezoidLucideIcon = () => ( // Using RectangleHorizontal with a slight modification idea
  <RectangleHorizontalIcon transform="skewX(-10)"/>
);

const DocumentLucideIcon = () => ( // Using FileTextIcon, as it's close
    <FileTextIcon />
);


export function SidebarComponentLibrary() {
  const { modelType } = useProjectContext();

  const infrastructureComponents = [
    { type: "server", label: "Server", icon: Server },
    { type: "database", label: "Database", icon: Database },
    { type: "service", label: "Cloud Service", icon: Cloud },
    { type: "router", label: "Router", icon: Router },
    { type: "boundary", label: "Trust Boundary", icon: ShieldCheck },
  ];

  const processComponents = [
    { type: "step", label: "Step/Action", icon: Square }, // Rectangle
    { type: "start-end", label: "Start/End", icon: Circle }, // Circle or Oval
    { type: "decision", label: "Decision", icon: DiamondIcon }, // Diamond
    { type: "input-output", label: "Input/Output", icon: ParallelogramLucideIcon }, // Parallelogram
    { type: "document", label: "Document", icon: DocumentLucideIcon }, // Rectangle with wavy bottom (using FileText for now)
    { type: "manual-input", label: "Manual Input", icon: TrapezoidLucideIcon }, // Trapezoid
    // "flow" for process models is handled by connections, not a draggable stencil
  ];

  const componentsToDisplay = modelType === 'process' ? processComponents : infrastructureComponents;
  const title = modelType === 'process' ? 'Process Stencils' : 'Infrastructure Stencils';

  return (
    <ScrollArea className="h-full p-2">
       <div className="space-y-4">
         <h3 className="text-sm font-medium text-sidebar-foreground/80 px-2 group-data-[collapsible=icon]:hidden">{title}</h3>
        <div className="grid grid-cols-2 gap-2 group-data-[collapsible=icon]:grid-cols-1">
          {componentsToDisplay.map((comp) => (
            <DraggableComponent key={comp.type} {...comp} />
          ))}
        </div>
       </div>
    </ScrollArea>
  );
}

