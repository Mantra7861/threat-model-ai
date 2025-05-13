
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Server, 
    Database, 
    Cloud, 
    Router, 
    ShieldCheck, 
    Square, // Used for Step/Action
    Circle, // Used for Start/End
    DiamondIcon as LucideDiamondIcon, // Default Lucide diamond, for Decision
    Archive, // New for Input/Output
    StickyNote, // New for Document
    TerminalSquare, // New for Manual Input
} from "lucide-react"; 
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
      <Icon className="w-6 h-6 mb-1 text-card-foreground group-data-[collapsible=icon]:w-5 group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:mb-0" />
       <span className="text-xs font-medium text-card-foreground text-center w-full truncate px-1 group-data-[collapsible=icon]:hidden">
        {label}
      </span>
    </div>
  );
};

// Custom SVG for DiamondIcon if Lucide's default isn't preferred or to ensure fill
const CustomDiamondIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" strokeWidth="0.1" className="text-card-foreground">
    <polygon points="12 2 22 12 12 22 2 12" />
  </svg>
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
    { type: "step", label: "Step/Action", icon: Square }, 
    { type: "start-end", label: "Start/End", icon: Circle }, 
    { type: "decision", label: "Decision", icon: CustomDiamondIcon }, // Using custom filled diamond
    { type: "input-output", label: "Input/Output", icon: Archive }, 
    { type: "document", label: "Document", icon: StickyNote }, 
    { type: "manual-input", label: "Manual Input", icon: TerminalSquare }, 
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
