
"use client"; // Make this a Client Component

import { useState, useEffect } from 'react';
import { getAllUsers } from '@/services/userService';
import { UserManagementTable } from './components/UserManagementTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import type { UserProfile } from '@/types/user';

export default function AdminUsersPage() {
  const { firebaseReady, isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // Local loading state for fetching users

  useEffect(() => {
    // Only attempt to fetch if Firebase is ready, auth check is done, and the user is an admin
    if (firebaseReady && !authLoading && isAdmin) {
      const fetchUsers = async () => {
        setLoading(true);
        setFetchError(null);
        try {
          const fetchedUsers = await getAllUsers();
          setUsers(fetchedUsers);
        } catch (error) {
          console.error("Error fetching users in AdminUsersPage (client component):", error);
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while fetching users.";
          // Check specific error types if needed, e.g., permissions
          if (errorMessage.includes("permission-denied") || errorMessage.includes("Missing or insufficient permissions")) {
             setFetchError("You do not have permission to view the user list.");
          } else {
             setFetchError(`Failed to fetch users: ${errorMessage}`);
          }
        } finally {
          setLoading(false);
        }
      };
      fetchUsers();
    } else if (!authLoading && !isAdmin) {
        // If auth is done but user is not admin (should be handled by layout, but good to check)
        setFetchError("Access Denied: Administrator privileges required.");
        setLoading(false);
    } else if (!firebaseReady && !authLoading) {
        // If auth is done but Firebase isn't ready
        setFetchError("Failed to connect to the database. Please check configuration or network.");
        setLoading(false);
    } else {
        // Still waiting for auth or Firebase readiness
        setLoading(true);
    }
  }, [firebaseReady, isAdmin, authLoading]); // Depend on auth state

  // Show loading indicator while auth is resolving or users are fetching
  if (authLoading || loading) {
    return (
        <div className="flex items-center justify-center h-full py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            Loading user data...
        </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Manage user roles and view registered users. Note: Requires Admin privileges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fetchError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error Loading Users</AlertTitle>
              <AlertDescription>{fetchError}</AlertDescription>
            </Alert>
          ) : users.length === 0 ? (
             <p className="text-muted-foreground">No users found in the database.</p>
          ) : (
            <UserManagementTable users={users} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

