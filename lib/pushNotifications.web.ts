export async function registerPushTokenForCurrentUser(): Promise<string | null> {
  return null;
}

export async function deactivateStoredPushTokenForCurrentUser(): Promise<void> {
  // Web fallback no-op.
}

export async function triggerProjectNotificationPushDispatch(_limit = 50): Promise<void> {
  // Web fallback no-op.
}
