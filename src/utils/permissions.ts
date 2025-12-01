import { UserRole } from '@/types/roles';

export const MAX_NOTEBOOKS_FOR_ADMINISTRATOR = 10;

export interface PermissionCheck {
  canViewAllUsers: boolean;
  canViewAllNotebooks: boolean;
  canCreateNotebooks: boolean;
  canManageOrganization: boolean;
  canAssignNotebooks: boolean;
  canEditOrganizationPrompt: boolean;
}

export const getPermissions = (role: UserRole | null): PermissionCheck => {
  switch (role) {
    case 'superadministrator':
      return {
        canViewAllUsers: true,
        canViewAllNotebooks: true,
        canCreateNotebooks: true,
        canManageOrganization: true,
        canAssignNotebooks: true,
        canEditOrganizationPrompt: true,
      };
    case 'administrator':
      return {
        canViewAllUsers: false,
        canViewAllNotebooks: false, // Only their organization's notebooks
        canCreateNotebooks: true,
        canManageOrganization: true,
        canAssignNotebooks: true,
        canEditOrganizationPrompt: true,
      };
    case 'reader':
      return {
        canViewAllUsers: false,
        canViewAllNotebooks: false, // Only assigned notebooks
        canCreateNotebooks: false,
        canManageOrganization: false,
        canAssignNotebooks: false,
        canEditOrganizationPrompt: false,
      };
    default:
      return {
        canViewAllUsers: false,
        canViewAllNotebooks: false,
        canCreateNotebooks: false,
        canManageOrganization: false,
        canAssignNotebooks: false,
        canEditOrganizationPrompt: false,
      };
  }
};

export const canCreateNotebook = (
  role: UserRole | null,
  currentNotebookCount: number
): boolean => {
  if (role === 'superadministrator') {
    return true;
  }

  if (role === 'administrator') {
    return currentNotebookCount < MAX_NOTEBOOKS_FOR_ADMINISTRATOR;
  }

  return false;
};

