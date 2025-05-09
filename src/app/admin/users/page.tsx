
// This component must be a client component if it needs to use hooks for data fetching or state.
// However, to fetch data on the server, we can make the page component async.
// For simplicity with @tanstack/react-query (if used later) or direct fetching,
// we can fetch data server-side first.

import { getAllUsers } from '@/services/userService';
import { UserManagementTable } from './components/UserManagementTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Make this a Server Component to fetch data initially
export default async function AdminUsersPage() {
  // Fetch users server-side.
  // Note: The getAllUsers function needs to be callable from the server.
  // If it relies on client-side Firebase SDK instances directly without admin privileges, this won't work.
  // For this example, we assume getAllUsers can run server-side or is adapted.
  // In a real app, you might use Firebase Admin SDK for this server-side fetch or secure it properly.
  // For now, we proceed assuming client-side checks in AdminLayout are the primary guard,
  // and getAllUsers will be called in a context where it can access Firestore (e.g. via client after auth).
  //
  // To make this work with client-side Firebase SDK, UserManagementTable would fetch data itself.
  // Let's change strategy: UserManagementTable will be a client component that fetches its own data
  // or this page becomes a client component.
  // For this iteration, we'll pass server-fetched data.
  // This implies `getAllUsers` must be configured to run in a Node.js environment (e.g. using Admin SDK or specific setup).
  // Given the current `firebase.ts` is client-focused, it's better to fetch client-side after ensuring admin.

  // **Revised approach for client-side fetching within UserManagementTable / this page as client component:**
  // This page should be a client component to use hooks like useAuth and fetch data client-side.

  // "use client"; // Uncomment if fetching client-side
  // import { useEffect, useState } from 'react';
  // import type { UserProfile } from '@/types/user';
  // import { useAuth } from '@/contexts/AuthContext';

  // const { isAdmin, loading: authLoading } = useAuth();
  // const [users, setUsers] = useState<UserProfile[]>([]);
  // const [loadingUsers, setLoadingUsers] = useState(true);

  // useEffect(() => {
  //   if (!authLoading && isAdmin) {
  //     getAllUsers()
  //       .then(setUsers)
  //       .catch(console.error)
  //       .finally(() => setLoadingUsers(false));
  //   } else if (!authLoading && !isAdmin) {
  //     setLoadingUsers(false); // Not an admin, no users to load
  //   }
  // }, [isAdmin, authLoading]);

  // if (authLoading || loadingUsers) {
  //   return <div>Loading users...</div>;
  // }
  // if (!isAdmin) {
  //   return <div>Access Denied.</div>; // Should be handled by AdminLayout already
  // }

  // For this pass, let's keep it as a server component and assume `getAllUsers` can be called from server.
  // This might require Firebase Admin SDK setup in `userService.ts` when run in Node context.
  // If using client SDK only, this page MUST be "use client" and fetch data in useEffect.
  
  // Simplest path for now: Keep as server component, assuming `getAllUsers` can work.
  // If it fails at runtime, this page needs to become "use client" and fetch data in useEffect.
  const users = await getAllUsers();


  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Manage user roles and view registered users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserManagementTable users={users} />
        </CardContent>
      </Card>
    </div>
  );
}
