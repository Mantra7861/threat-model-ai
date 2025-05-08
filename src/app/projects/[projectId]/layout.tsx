
import type { ReactNode } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { FileText, Workflow, Settings, Users, ShieldAlert, HelpCircle, LayoutDashboard, LogOut, SigmaIcon, Circle, FileTextIcon, KeyboardIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarComponentLibrary } from "@/components/diagram/SidebarComponentLibrary";
import { ProjectClientLayout } from "./ProjectClientLayout"; 
import { ProjectProvider } from "@/contexts/ProjectContext";

// Placeholder SVGs for custom shapes in stencil list (can be more elaborate)
const DiamondIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 22 12 12 22 2 12" />
  </svg>
);

const ParallelogramIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="1 6 23 6 20 18 0 18" /> {/* Simplified parallelogram */}
  </svg>
);
const TrapezoidIcon = () => (
 <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 21 6 17 18 7 18" /> {/* Simplified trapezoid */}
  </svg>
);


export default function ProjectLayout({
  children, 
  params,
}: {
  children: ReactNode; 
  params: { projectId: string };
}) {

  return (
    <ProjectProvider initialProjectId={params.projectId}>
      <SidebarProvider defaultOpen={true}>
        {/* Left Sidebar (Component Library) */}
        <Sidebar side="left" variant="sidebar" collapsible="icon">
          <SidebarHeader className="p-2">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                  <ShieldAlert className="text-primary-foreground size-6" />
                  <h1 className="text-xl font-semibold text-primary-foreground">ThreatMapperAI</h1>
              </div>
              <SidebarTrigger className="text-primary-foreground hover:bg-sidebar-accent" />
            </div>
          </SidebarHeader>
          <SidebarContent className="p-0">
            {/* SidebarComponentLibrary now consumes context, no direct prop needed here */}
            <SidebarComponentLibrary />
          </SidebarContent>
          <SidebarFooter className="mt-auto p-2 border-t border-sidebar-border group-data-[collapsible=icon]:border-none">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Help" className="justify-center group-data-[collapsible=icon]:justify-center">
                  <HelpCircle />
                  <span className="group-data-[collapsible=icon]:hidden">Help</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Account Settings" className="justify-center group-data-[collapsible=icon]:justify-center">
                      <Avatar className="size-7 group-data-[collapsible=icon]:size-6">
                          <AvatarImage src="https://picsum.photos/40/40" data-ai-hint="user avatar" alt="User Avatar" />
                          <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                      <span className="group-data-[collapsible=icon]:hidden">User Name</span>
                  </SidebarMenuButton>
              </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Log Out" className="justify-center group-data-[collapsible=icon]:justify-center">
                    <LogOut />
                    <span className="group-data-[collapsible=icon]:hidden">Log Out</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content Area managed by ProjectClientLayout */}
        <SidebarInset className="flex flex-col !p-0">
          <ProjectClientLayout projectId={params.projectId} />
        </SidebarInset>
      </SidebarProvider>
    </ProjectProvider>
  );
}
