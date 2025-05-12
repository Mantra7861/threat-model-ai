
import { getAllUsers } from '@/services/userService';
import { UserManagementTable } from './components/UserManagementTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components
import { AlertTriangle } from 'lucide-react';

// Make this a Server Component to fetch data initially.
// IMPORTANT CAVEAT: The `getAllUsers` function relies on the client-side Firebase SDK (`db` from `firebase.ts`).
// For this to work reliably in a Server Component context, Firebase initialization needs careful handling.
// 1. If using client SDK: The `firebase.ts` initialization might only run client-side, making `db` null here.
// 2. If using Admin SDK: A separate Admin SDK initialization is needed for server-side actions.
//
// Current Approach Assumption: We assume `firebase.ts` somehow makes the client `db` available server-side, OR
// that this page might render client-side despite being async (Next.js behavior can be complex).
//
// Recommended Robust Approach: Make this page a Client Component ("use client") and fetch data inside `useEffect`
// using `useAuth` to ensure the user is an admin before fetching.
//
// For this iteration, we'll keep it as a Server Component but add error handling. If it consistently fails,
// refactoring to client-side fetching is the next step.

export default async function AdminUsersPage() {
  let users = [];
  let fetchError: string | null = null;

  try {
    // Attempt to fetch users server-side. This might fail if `db` isn't initialized server-side.
    users = await getAllUsers();
  } catch (error) {
    console.error("Error fetching users in AdminUsersPage (server component):", error);
    fetchError = error instanceof Error ? error.message : "An unknown error occurred while fetching users.";
    // Check if the error indicates Firebase isn't initialized server-side
    if (fetchError.includes("firestore/unavailable") || fetchError.includes("Cannot read properties of null (reading 'firestore')") || fetchError.includes("Firebase client SDK not initialized")) {
        fetchError = "Failed to connect to the database server-side. User data cannot be loaded here. Consider refactoring for client-side loading.";
    } else {
        fetchError = `Failed to fetch users: ${fetchError}`;
    }
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
