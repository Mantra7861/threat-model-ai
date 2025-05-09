
"use client"; 

import type { ReactNode } from "react";
import { use } from 'react'; 
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
import { Settings, ShieldAlert, HelpCircle, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarComponentLibrary } from "@/components/diagram/SidebarComponentLibrary";
import { ProjectClientLayout } from "./ProjectClientLayout"; 
import { ProjectProvider } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext"; 
import Link from "next/link";


export default function ProjectLayout({
  children, 
  params: paramsPromise, 
}: {
  children: ReactNode; 
  params: Promise<{ projectId: string }>; 
}) {
  const params = use(paramsPromise); 
  const { currentUser, userProfile, isAdmin, signOut } = useAuth(); 

  return (
    <ProjectProvider initialProjectId={params.projectId}>
      <SidebarProvider defaultOpen={true}>
        {/* Left Sidebar (Component Library) */}
        <Sidebar side="left" variant="sidebar" collapsible="icon">
          <SidebarHeader className="p-2">
            <div className="flex items-center gap-2 justify-between">
              <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                  <ShieldAlert className="text-primary-foreground size-6" />
                  <h1 className="text-xl font-semibold text-primary-foreground">ThreatMapperAI</h1>
              </Link>
              <SidebarTrigger className="text-primary-foreground hover:bg-sidebar-accent" />
            </div>
          </SidebarHeader>
          <SidebarContent className="p-0">
            <SidebarComponentLibrary />
          </SidebarContent>
          <SidebarFooter className="mt-auto p-2 border-t border-sidebar-border group-data-[collapsible=icon]:border-none">
            <SidebarMenu>
              {isAdmin && (
                <SidebarMenuItem>
                  <Link href="/admin/users" legacyBehavior passHref>
                    <SidebarMenuButton tooltip="Admin Panel" className="justify-start group-data-[collapsible=icon]:justify-center">
                      <Settings />
                      <span className="group-data-[collapsible=icon]:hidden">Admin Panel</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Help" className="justify-start group-data-[collapsible=icon]:justify-center">
                  <HelpCircle />
                  <span className="group-data-[collapsible=icon]:hidden">Help</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                {/* User Avatar and Name Display */}
                 <div className="flex items-center gap-2 p-2 rounded-md group-data-[collapsible=icon]:justify-center text-sidebar-foreground">
                    <Avatar className="size-7 group-data-[collapsible=icon]:size-6">
                        <AvatarImage src={userProfile?.photoURL || undefined} data-ai-hint="user avatar" alt={userProfile?.displayName || currentUser?.email || 'User Avatar'} />
                        <AvatarFallback>{userProfile?.displayName?.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="group-data-[collapsible=icon]:hidden text-sm truncate max-w-[100px]">{userProfile?.displayName || currentUser?.email}</span>
                </div>
              </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    tooltip="Log Out" 
                    className="justify-start group-data-[collapsible=icon]:justify-center"
                    onClick={signOut}
                  >
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

