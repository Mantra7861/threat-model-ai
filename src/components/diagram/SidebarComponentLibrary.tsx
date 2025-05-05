"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Server, Database, Cloud, Router, ShieldCheck, ArrowRight } from "lucide-react"; // Example icons

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
      <Icon className="w-6 h-6 mb-1 text-muted-foreground group-data-[collapsible=icon]:w-5 group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:mb-0" />
       <span className="text-xs font-medium truncate max-w-[80px] group-data-[collapsible=icon]:hidden">
        {label}
      </span>
    </div>
  );
};


export function SidebarComponentLibrary() {
  const components = [
    { type: "server", label: "Server", icon: Server },
    { type: "database", label: "Database", icon: Database },
    { type: "service", label: "Cloud Service", icon: Cloud },
    { type: "router", label: "Router", icon: Router },
    { type: "boundary", label: "Trust Boundary", icon: ShieldCheck },
    { type: "flow", label: "Data Flow", icon: ArrowRight }, // Flow might be handled differently
     // Add more components as needed
  ];

  return (
    <ScrollArea className="h-full p-2">
       <div className="space-y-4">
         <h3 className="text-sm font-medium text-sidebar-foreground/80 px-2 group-data-[collapsible=icon]:hidden">Components</h3>
        <div className="grid grid-cols-2 gap-2 group-data-[collapsible=icon]:grid-cols-1">
          {components.map((comp) => (
            <DraggableComponent key={comp.type} {...comp} />
          ))}
        </div>
       </div>
        {/* Add document management section later */}
         {/* <div className="mt-6 pt-4 border-t border-sidebar-border">
             <h3 className="text-sm font-medium text-sidebar-foreground/80 px-2 group-data-[collapsible=icon]:hidden">Documents</h3>
             <div className="p-2 text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
               Document management coming soon.
             </div>
         </div> */}
    </ScrollArea>
  );
}
