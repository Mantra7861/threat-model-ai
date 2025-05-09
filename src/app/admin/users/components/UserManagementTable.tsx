
"use client";

import type { UserProfile } from "@/types/user";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RoleSelector } from "./RoleSelector";
import { format } from 'date-fns';

interface UserManagementTableProps {
  users: UserProfile[];
}

export function UserManagementTable({ users }: UserManagementTableProps) {
  if (!users || users.length === 0) {
    return <p>No users found.</p>;
  }

  return (
    <div className="rounded-lg border shadow-sm bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Avatar</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Display Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Registration Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.uid}>
              <TableCell>
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || 'User Avatar'} data-ai-hint="user avatar" />
                  <AvatarFallback>{(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell className="font-medium">{user.email}</TableCell>
              <TableCell>{user.displayName || 'N/A'}</TableCell>
              <TableCell>
                <RoleSelector user={user} />
              </TableCell>
              <TableCell>
                {user.registrationDate ? format(new Date(user.registrationDate), 'PPpp') : 'N/A'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
