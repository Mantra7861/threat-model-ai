
"use client";

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarInset, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import Link from 'next/link';
import { Users, LayoutDashboard, ShieldAlert, LogOut } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { userProfile, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace('/'); // Redirect non-admins to home page
    }
  }, [userProfile, loading, isAdmin, router]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading admin section...</div>;
  }

  if (!isAdmin) {
    // This will be briefly shown before redirect or if redirect fails.
    return <div className="flex items-center justify-center h-screen">Access Denied. Admins only.</div>;
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
                    <Link href="/admin/users" legacyBehavior passHref>
                        <SidebarMenuButton tooltip="User Management" className="justify-start" isActive={false}>
                            <Users />
                            <span className="group-data-[collapsible=icon]:hidden">User Management</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <Link href="/" legacyBehavior passHref>
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
                <SidebarMenuButton tooltip="Account" className="justify-center group-data-[collapsible=icon]:justify-center">
                    <Avatar className="size-7 group-data-[collapsible=icon]:size-6">
                        <AvatarImage src={userProfile?.photoURL || "https://picsum.photos/40/40"} data-ai-hint="admin avatar" alt="Admin Avatar" />
                        <AvatarFallback>{userProfile?.displayName?.charAt(0).toUpperCase() || 'A'}</AvatarFallback>
                    </Avatar>
                    <span className="group-data-[collapsible=icon]:hidden">{userProfile?.displayName || 'Admin'}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    tooltip="Log Out" 
                    className="justify-center group-data-[collapsible=icon]:justify-center"
                    onClick={() => auth.signOut()} // Assuming auth is accessible or handle via context
                  >
                    <LogOut />
                    <span className="group-data-[collapsible=icon]:hidden">Log Out</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex-1 flex flex-col !p-0">
        <main className="flex-1 p-6 bg-muted/40 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
