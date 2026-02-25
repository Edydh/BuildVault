export async function registerPushTokenForCurrentUser(): Promise<string | null> {
  return null;
}

export async function deactivateStoredPushTokenForCurrentUser(): Promise<void> {
  // Web fallback no-op.
}

export async function triggerProjectNotificationPushDispatch(_limit = 50): Promise<void> {
  // Web fallback no-op.
}

export async function setPendingPushProjectNavigationTarget(_projectId: string): Promise<void> {
  // Web fallback no-op.
}

export async function consumePendingPushProjectNavigationTarget(): Promise<string | null> {
  return null;
}

export async function subscribeToPushNotificationOpens(
  _onProjectId: (projectId: string) => void | Promise<void>
): Promise<() => void> {
  return () => undefined;
}
