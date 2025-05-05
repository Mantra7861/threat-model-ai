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
import { FileText, Workflow, Settings, Users, ShieldAlert, HelpCircle, LayoutDashboard, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DiagramHeader } from "@/components/layout/DiagramHeader";
import { SidebarComponentLibrary } from "@/components/diagram/SidebarComponentLibrary";
import { ProjectClientLayout } from "./ProjectClientLayout"; // Import the new client layout

export default function ProjectLayout({
  children, // children prop is now handled by ProjectClientLayout
  params,
}: {
  children: ReactNode; // Keep children for type consistency, though not directly used here
  params: { projectId: string };
}) {
  return (
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
        <DiagramHeader projectId={params.projectId} />
         {/* Render the client layout which handles state and renders Canvas/Sidebars */}
        <ProjectClientLayout projectId={params.projectId} />
      </SidebarInset>
    </SidebarProvider>
  );
}
