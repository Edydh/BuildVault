import type { PushNavigationTarget, PushNotificationDiagnostics } from './pushNotifications';

export async function registerPushTokenForCurrentUser(): Promise<string | null> {
  return null;
}

export async function deactivateStoredPushTokenForCurrentUser(): Promise<void> {
  // Web fallback no-op.
}

export async function triggerProjectNotificationPushDispatch(_limit = 50): Promise<void> {
  // Web fallback no-op.
}

export async function setPendingPushProjectNavigationTarget(
  _projectId: string,
  _options?: { activityId?: string | null; notificationId?: string | null }
): Promise<void> {
  // Web fallback no-op.
}

export async function consumePendingPushProjectNavigationTarget(): Promise<PushNavigationTarget | null> {
  return null;
}

export async function subscribeToPushNotificationOpens(
  _onTarget: (target: PushNavigationTarget) => void | Promise<void>
): Promise<() => void> {
  return () => undefined;
}

export async function getPushNotificationDiagnostics(): Promise<PushNotificationDiagnostics> {
  return {
    runtime: 'web',
    modulesAvailable: false,
    easProjectIdConfigured: false,
    hasStoredToken: false,
    tokenPreview: null,
    lastDispatchAt: null,
    pendingNavigationTarget: null,
  };
}
