
"use client";

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import Link from 'next/link';
import { Users, LayoutDashboard, ShieldAlert, LogOut, UserCircle, Loader2, Shapes } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from 'lucide-react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { userProfile, loading: authLoading, isAdmin, firebaseReady, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Redirect only if Firebase is ready and auth checks are complete, and user is not an admin
    if (firebaseReady && !authLoading && !isAdmin) {
      router.replace('/');
    }
  }, [firebaseReady, authLoading, isAdmin, router]);

  let mainContent: ReactNode;

  if (!firebaseReady) {
    mainContent = (
        <div className="flex items-center justify-center h-full p-4">
             <Alert variant="destructive" className="w-full max-w-md">
               <AlertTriangle className="h-4 w-4" />
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
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
            Loading admin section...
        </div>
    );
  } else if (!isAdmin) {
    // This state might be briefly visible if redirection is slow.
    mainContent = (
        <div className="flex items-center justify-center h-full p-4">
             <Alert variant="destructive" className="w-full max-w-md">
               <AlertTriangle className="h-4 w-4" />
               <AlertTitle>Access Denied</AlertTitle>
               <AlertDescription>
                 You do not have administrator privileges to access this section. Redirecting...
               </AlertDescription>
             </Alert>
        </div>
    );
  } else {
    // User is an admin, Firebase is ready, and loading is complete
    mainContent = children;
  }

  return (
    <SidebarProvider defaultOpen={true}>
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
        <SidebarContent className="p-2">
            <SidebarMenu>
                <SidebarMenuItem>
                    <Link href="/admin/users" passHref>
                        <SidebarMenuButton tooltip="User Management" className="justify-start" isActive={pathname === '/admin/users'}>
                            <Users />
                            <span className="group-data-[collapsible=icon]:hidden">User Management</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <Link href="/admin/stencils" passHref>
                        <SidebarMenuButton tooltip="Stencil Management" className="justify-start" isActive={pathname.startsWith('/admin/stencils')}>
                            <Shapes />
                            <span className="group-data-[collapsible=icon]:hidden">Stencil Management</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <Link href="/" passHref>
                        <SidebarMenuButton tooltip="Back to App" className="justify-start">
                            <LayoutDashboard />
                            <span className="group-data-[collapsible=icon]:hidden">Back to App</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="mt-auto p-2 border-t border-sidebar-border group-data-[collapsible=icon]:border-none">
           <SidebarMenu>
              <SidebarMenuItem>
                {/* User info */}
                <div className="flex items-center gap-2 p-2 rounded-md group-data-[collapsible=icon]:justify-center text-sidebar-foreground">
                    <Avatar className="size-7 group-data-[collapsible=icon]:size-6">
                        <AvatarImage src={userProfile?.photoURL || undefined} data-ai-hint="admin avatar" alt={userProfile?.displayName || 'Admin Avatar'} />
                        <AvatarFallback>{userProfile?.displayName?.charAt(0).toUpperCase() || 'A'}</AvatarFallback>
                    </Avatar>
                    <span className="group-data-[collapsible=icon]:hidden text-sm truncate max-w-[120px]">{userProfile?.displayName || 'Admin'}</span>
                </div>
              </SidebarMenuItem>
                <SidebarMenuItem>
                  {/* Logout button */}
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
      <SidebarInset className="flex-1 flex flex-col !p-0">
        <main className="flex-1 p-6 bg-background overflow-auto">
          {mainContent}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
