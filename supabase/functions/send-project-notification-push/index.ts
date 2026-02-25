import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

type DispatchPayload = {
  limit?: number;
};

type ProjectNotificationRow = {
  id: string;
  project_id: string;
  activity_id?: string | null;
  recipient_user_id: string;
  action_type: string;
  title: string | null;
  body: string | null;
  created_at: string;
  push_dispatch_attempts: number | null;
};

type UserPushTokenRow = {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: 'ios' | 'android' | 'unknown';
  is_active: boolean;
};

type ExpoPushTicket = {
  status?: 'ok' | 'error';
  message?: string;
  details?: {
    error?: string;
  };
};

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const MAX_PUSH_ATTEMPTS = 5;
const PENDING_LOOKBACK_HOURS = 48;
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function clampLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(value)));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function isExpoPushToken(value: string): boolean {
  return /^ExponentPushToken\[[^\]]+\]$/.test(value);
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function truncateError(value: string): string {
  return value.length > 400 ? `${value.slice(0, 397)}...` : value;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json(401, { ok: false, error: 'missing_authorization' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json(500, { ok: false, error: 'missing_supabase_environment' });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return json(401, { ok: false, error: 'unauthorized' });
  }

  let payload: DispatchPayload = {};
  try {
    payload = ((await req.json()) as DispatchPayload) || {};
  } catch {
    payload = {};
  }

  const safeLimit = clampLimit(payload.limit);
  const lookbackCutoffIso = new Date(Date.now() - PENDING_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: notificationRowsRaw, error: notificationError } = await serviceClient
    .from('project_notifications')
    .select(
      'id, project_id, activity_id, recipient_user_id, action_type, title, body, created_at, push_dispatch_attempts'
    )
    .is('push_dispatched_at', null)
    .lt('push_dispatch_attempts', MAX_PUSH_ATTEMPTS)
    .gte('created_at', lookbackCutoffIso)
    .order('created_at', { ascending: true })
    .limit(safeLimit);

  if (notificationError) {
    return json(500, {
      ok: false,
      error: 'notification_fetch_failed',
      details: notificationError.message,
    });
  }

  const notifications = toArray(notificationRowsRaw as ProjectNotificationRow[] | null).filter(
    (row) => !!row.id && !!row.recipient_user_id
  );

  if (notifications.length === 0) {
    return json(200, {
      ok: true,
      processed: 0,
      dispatched: 0,
      failed: 0,
      skippedNoToken: 0,
      deactivatedTokens: 0,
    });
  }

  const attemptsByNotificationId = new Map<string, number>();
  const recipientIds = new Set<string>();
  for (const row of notifications) {
    attemptsByNotificationId.set(row.id, Math.max(0, row.push_dispatch_attempts ?? 0));
    recipientIds.add(row.recipient_user_id);
  }

  const { data: tokenRowsRaw, error: tokenError } = await serviceClient
    .from('user_push_tokens')
    .select('id, user_id, expo_push_token, platform, is_active')
    .in('user_id', Array.from(recipientIds))
    .eq('is_active', true);

  if (tokenError) {
    return json(500, {
      ok: false,
      error: 'token_fetch_failed',
      details: tokenError.message,
    });
  }

  const validTokens = toArray(tokenRowsRaw as UserPushTokenRow[] | null).filter((token) =>
    isExpoPushToken(token.expo_push_token)
  );

  const tokensByUserId = new Map<string, UserPushTokenRow[]>();
  for (const token of validTokens) {
    const bucket = tokensByUserId.get(token.user_id);
    if (bucket) {
      bucket.push(token);
    } else {
      tokensByUserId.set(token.user_id, [token]);
    }
  }

  const messages: Array<{
    notificationId: string;
    tokenId: string;
    to: string;
    title: string;
    body: string;
    data: Record<string, string>;
  }> = [];

  const noTokenIds = new Set<string>();
  const firstFailureByNotificationId = new Map<string, string>();
  const tokenIdsToDeactivate = new Set<string>();

  for (const notification of notifications) {
    const userTokens = tokensByUserId.get(notification.recipient_user_id) || [];
    if (userTokens.length === 0) {
      noTokenIds.add(notification.id);
      firstFailureByNotificationId.set(notification.id, 'No active device tokens');
      continue;
    }

    const title = (notification.title || 'Project update').trim() || 'Project update';
    const body = (notification.body || 'You have a new update in BuildVault.').trim() ||
      'You have a new update in BuildVault.';

    for (const token of userTokens) {
      messages.push({
        notificationId: notification.id,
        tokenId: token.id,
        to: token.expo_push_token,
        title,
        body,
        data: {
          projectId: notification.project_id,
          activityId: notification.activity_id || '',
          notificationId: notification.id,
          actionType: notification.action_type,
        },
      });
    }
  }

  const successIds = new Set<string>();

  for (const messageChunk of chunkArray(messages, 100)) {
    const requestBody = messageChunk.map((message) => ({
      to: message.to,
      sound: 'default',
      title: message.title,
      body: message.body,
      data: message.data,
      priority: 'high',
    }));

    let response: Response;
    try {
      response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      const errorText = truncateError(error instanceof Error ? error.message : String(error));
      for (const message of messageChunk) {
        if (!firstFailureByNotificationId.has(message.notificationId)) {
          firstFailureByNotificationId.set(message.notificationId, `Expo push request failed: ${errorText}`);
        }
      }
      continue;
    }

    if (!response.ok) {
      const details = truncateError(await response.text());
      for (const message of messageChunk) {
        if (!firstFailureByNotificationId.has(message.notificationId)) {
          firstFailureByNotificationId.set(
            message.notificationId,
            `Expo push HTTP ${response.status}: ${details}`
          );
        }
      }
      continue;
    }

    const parsed = (await response.json()) as { data?: ExpoPushTicket[] };
    const tickets = toArray(parsed.data);

    for (let index = 0; index < messageChunk.length; index += 1) {
      const message = messageChunk[index];
      const ticket = tickets[index] || {};
      if (ticket.status === 'ok') {
        successIds.add(message.notificationId);
        continue;
      }

      const ticketError = ticket.details?.error || ticket.message || 'Unknown push delivery failure';
      if (ticket.details?.error === 'DeviceNotRegistered') {
        tokenIdsToDeactivate.add(message.tokenId);
      }

      if (!firstFailureByNotificationId.has(message.notificationId)) {
        firstFailureByNotificationId.set(message.notificationId, truncateError(ticketError));
      }
    }
  }

  if (tokenIdsToDeactivate.size > 0) {
    await serviceClient
      .from('user_push_tokens')
      .update({ is_active: false })
      .in('id', Array.from(tokenIdsToDeactivate));
  }

  for (const notification of notifications) {
    const id = notification.id;
    const currentAttempts = attemptsByNotificationId.get(id) || 0;

    if (successIds.has(id)) {
      await serviceClient
        .from('project_notifications')
        .update({
          push_attempted_at: nowIso,
          push_dispatched_at: nowIso,
          push_dispatch_error: null,
          push_dispatch_attempts: currentAttempts + 1,
        })
        .eq('id', id);
      continue;
    }

    const errorMessage = firstFailureByNotificationId.get(id) || (noTokenIds.has(id)
      ? 'No active device tokens'
      : 'Push delivery failed');

    await serviceClient
      .from('project_notifications')
      .update({
        push_attempted_at: nowIso,
        push_dispatch_error: truncateError(errorMessage),
        push_dispatch_attempts: currentAttempts + 1,
      })
      .eq('id', id);
  }

  const failedCount = notifications.filter((row) => !successIds.has(row.id)).length;

  return json(200, {
    ok: true,
    processed: notifications.length,
    dispatched: successIds.size,
    failed: failedCount,
    skippedNoToken: noTokenIds.size,
    deactivatedTokens: tokenIdsToDeactivate.size,
  });
});
