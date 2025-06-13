
"use client";

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import Link from 'next/link';
import { Users, Layout, ShieldWarning, SignOut, UserCircle, Spinner, SquaresFour, Warning, Cpu } from '@phosphor-icons/react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { userProfile, loading: authLoading, isAdmin, firebaseReady, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (firebaseReady && !authLoading && !isAdmin) {
      router.replace('/');
    }
  }, [firebaseReady, authLoading, isAdmin, router]);

  let mainContent: ReactNode;

  if (!firebaseReady) {
    mainContent = (
        <div className="flex items-center justify-center h-full p-4">
             <Alert variant="destructive" className="w-full max-w-md">
               <Warning className="h-4 w-4" /> 
               <AlertTitle>Initialization Error</AlertTitle>
               <AlertDescription>
                 Could not connect to backend services. Please ensure Firebase is configured correctly or check your network connection. Admin section cannot be loaded.
               </AlertDescription>
             </Alert>
        </div>
    );
  } else if (authLoading) {
    mainContent = (
        <div className="flex items-center justify-center h-full">
            <Spinner className="h-8 w-8 animate-spin text-primary mr-2" />
            Loading admin section...
        </div>
    );
  } else if (!isAdmin) {
    mainContent = (
        <div className="flex items-center justify-center h-full p-4">
             <Alert variant="destructive" className="w-full max-w-md">
               <Warning className="h-4 w-4" /> 
               <AlertTitle>Access Denied</AlertTitle>
               <AlertDescription>
                 You do not have administrator privileges to access this section. Redirecting...
               </AlertDescription>
             </Alert>
        </div>
    );
  } else {
    mainContent = children;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar side="left" variant="sidebar" collapsible="icon">
        <SidebarHeader className="p-2">
            <div className="flex items-center gap-2 justify-between">
              <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                  <ShieldWarning weight="fill" className="text-primary-foreground size-6" />
                  <h1 className="text-xl font-semibold text-primary-foreground">ThreatMapperAI</h1>
              </Link>
              <SidebarTrigger className="text-primary-foreground hover:bg-sidebar-accent" />
            </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
            <SidebarMenu>
                <SidebarMenuItem>
                    <Link href="/admin/users">
                        <SidebarMenuButton tooltip="User Management" className="justify-start">
                            <Users />
                            <span className="group-data-[collapsible=icon]:hidden">User Management</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <Link href="/admin/stencils">
                        <SidebarMenuButton tooltip="Stencil Management" className="justify-start">
                            <SquaresFour />
                            <span className="group-data-[collapsible=icon]:hidden">Stencil Management</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <Link href="/admin/ai-config">
                        <SidebarMenuButton tooltip="AI Configuration" className="justify-start">
                            <Cpu />
                            <span className="group-data-[collapsible=icon]:hidden">AI Configuration</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <Link href="/">
                        <SidebarMenuButton tooltip="Back to App" className="justify-start">
                            <Layout />
                            <span className="group-data-[collapsible=icon]:hidden">Back to App</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="mt-auto p-2 border-t border-sidebar-border group-data-[collapsible=icon]:border-none">
           <SidebarMenu>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 p-2 rounded-md group-data-[collapsible=icon]:justify-center text-sidebar-foreground">
                    <Avatar className="size-7 group-data-[collapsible=icon]:size-6">
                        <AvatarImage src={userProfile?.photoURL || undefined} data-ai-hint="admin avatar" alt={userProfile?.displayName || 'Admin Avatar'} />
                        <AvatarFallback>{userProfile?.displayName?.charAt(0).toUpperCase() || 'A'}</AvatarFallback>
                    </Avatar>
                    <span className="group-data-[collapsible=icon]:hidden text-sm truncate max-w-[120px]">{userProfile?.displayName || 'Admin'}</span>
                </div>
              </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Log Out"
                    className="justify-start group-data-[collapsible=icon]:justify-center"
                    onClick={signOut}
                  >
                    <SignOut />
                    <span className="group-data-[collapsible=icon]:hidden">Log Out</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex-1 flex flex-col !p-0">
        <main className="flex-1 p-6 bg-background overflow-auto">
          {mainContent}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
