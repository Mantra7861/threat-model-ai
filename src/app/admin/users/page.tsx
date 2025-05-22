
"use client"; 

import { useState, useEffect } from 'react';
import { getAllUsers } from '@/services/userService';
import { UserManagementTable } from './components/UserManagementTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Warning, Spinner } from "phosphor-react"; // Updated icon
import { useAuth } from '@/contexts/AuthContext'; 
import type { UserProfile } from '@/types/user';

export default function AdminUsersPage() {
  const { firebaseReady, isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); 

  useEffect(() => {
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
        setFetchError("Access Denied: Administrator privileges required.");
        setLoading(false);
    } else if (!firebaseReady && !authLoading) {
        setFetchError("Failed to connect to the database. Please check configuration or network.");
        setLoading(false);
    } else {
        setLoading(true);
    }
  }, [firebaseReady, isAdmin, authLoading]); 

  if (authLoading || loading) {
    return (
        <div className="flex items-center justify-center h-full py-10">
            <Spinner className="h-6 w-6 animate-spin text-primary mr-2" />
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
              <Warning className="h-4 w-4" /> {/* Updated icon */}
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
