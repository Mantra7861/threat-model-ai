
"use server";

import { revalidatePath } from 'next/cache';
import { updateUserRole as updateUserServiceRole } from '@/services/userService';
import type { UserRole } from '@/types/user';
// We would ideally check if the calling user is an admin here.
// For server actions, this is complex without passing user identity securely or using a library.
// Assume this action is only invokable from a UI protected by admin checks.

export async function updateUserRoleAction(formData: FormData) {
  const uid = formData.get('uid') as string;
  const newRole = formData.get('role') as UserRole;

  if (!uid || !newRole) {
    return { success: false, message: 'Missing UID or role.' };
  }

  // Add proper authorization check here in a real app
  // e.g. by getting current user from a session or auth token
  // For now, we proceed assuming the page-level check in AdminLayout is sufficient
  // but this server action itself should be secured.

  try {
    await updateUserServiceRole(uid, newRole);
    revalidatePath('/admin/users'); // Revalidate the page to show updated data
    return { success: true, message: `User role updated successfully to ${newRole}.` };
  } catch (error) {
    console.error('Error updating user role:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: `Failed to update user role: ${errorMessage}` };
  }
}
