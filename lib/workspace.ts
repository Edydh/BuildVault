import AsyncStorage from '@react-native-async-storage/async-storage';

export type WorkspaceSelection =
  | { type: 'personal' }
  | { type: 'organization'; organizationId: string };

export const WORKSPACE_STORAGE_KEY = '@buildvault/active-workspace';

function normalizeWorkspace(value: unknown): WorkspaceSelection {
  if (typeof value !== 'object' || value === null) {
    return { type: 'personal' };
  }

  const candidate = value as { type?: unknown; organizationId?: unknown };
  if (
    candidate.type === 'organization' &&
    typeof candidate.organizationId === 'string' &&
    candidate.organizationId.trim().length > 0
  ) {
    return {
      type: 'organization',
      organizationId: candidate.organizationId.trim(),
    };
  }
  return { type: 'personal' };
}

export async function getStoredWorkspace(): Promise<WorkspaceSelection> {
  try {
    const raw = await AsyncStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return { type: 'personal' };
    return normalizeWorkspace(JSON.parse(raw));
  } catch {
    return { type: 'personal' };
  }
}

export async function setStoredWorkspace(workspace: WorkspaceSelection): Promise<void> {
  await AsyncStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
}

export function isWorkspaceEqual(a: WorkspaceSelection, b: WorkspaceSelection): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'personal') return true;
  if (b.type !== 'organization') return false;
  return a.organizationId === b.organizationId;
}
