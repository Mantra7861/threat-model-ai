
"use client";

import type { ChangeEvent } from 'react';
import { useTransition } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserProfile, UserRole } from "@/types/user";
import { updateUserRoleAction } from '../actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button'; // Import Button

interface RoleSelectorProps {
  user: UserProfile;
}

const availableRoles: UserRole[] = ['admin', 'editor', 'viewer'];

export function RoleSelector({ user }: RoleSelectorProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleRoleChange = async (newRole: UserRole) => {
    if (newRole === user.role) return;

    const formData = new FormData();
    formData.append('uid', user.uid);
    formData.append('role', newRole);

    startTransition(async () => {
      const result = await updateUserRoleAction(formData);
      if (result.success) {
        toast({ title: "Success", description: result.message });
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    });
  };

  return (
    <form onSubmit={(e) => e.preventDefault()}> {/* Wrap in form for FormData to work, prevent default submission */}
      <input type="hidden" name="uid" value={user.uid} />
      <Select
        name="role"
        defaultValue={user.role}
        onValueChange={(value) => handleRoleChange(value as UserRole)}
        disabled={isPending}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent>
          {availableRoles.map((role) => (
            <SelectItem key={role} value={role}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* The Select component's onValueChange now triggers the action.
          A submit button is not strictly necessary if we use onValueChange.
          If a submit button was desired, it would trigger the form submission
          which then calls updateUserRoleAction.
      */}
      {/* Example of how a submit button might look if used with onSubmit on the form */}
      {/* <Button type="submit" disabled={isPending} className="ml-2">
        {isPending ? 'Saving...' : 'Save'}
      </Button> */}
    </form>
  );
}
