import { STUB_CREDENTIAL, calendarStubEnabled, stubEvent } from "@/lib/calendar/stub";
import { decrypt, encrypt, loadKey } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Google Calendar over plain fetch — three endpoints, no `googleapis` (the
 * package is several megabytes for what amounts to a token refresh, a
 * free/busy query and an event insert).
 *
 * The same OAuth client as admin sign-in (AUTH_GOOGLE_ID/SECRET), with the
 * calendar scope requested separately: the account that authorises the
 * calendar may differ from the one that signs into /admin.
 */
const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy", "openid", "email"];
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";

export const REDIRECT_PATH = "/api/google/callback";

/** Cookie carrying the OAuth `state` between the consent start and the callback. */
export const STATE_COOKIE = "google_oauth_state";

export function redirectUri(): string {
  return `${env.NEXT_PUBLIC_APP_URL}${REDIRECT_PATH}`;
}

/** Consent URL; `state` is checked on return to bind the flow to the admin session. */
export function consentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.AUTH_GOOGLE_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    // Force the consent screen so Google returns a refresh token even when
    // the account already authorised us once.
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
};

export async function exchangeCode(code: string): Promise<{ refreshToken: string; email: string }> {
  const body = new URLSearchParams({
    code,
    client_id: env.AUTH_GOOGLE_ID,
    client_secret: env.AUTH_GOOGLE_SECRET,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
  const response = await fetch(TOKEN_URL, { method: "POST", body });
  if (!response.ok) throw new Error(`Échange du code Google refusé (${response.status})`);

  const data = (await response.json()) as TokenResponse;
  if (!data.refresh_token) {
    throw new Error("Google n'a pas renvoyé de refresh token. Révoquez l'accès dans le compte Google et recommencez.");
  }

  return { refreshToken: data.refresh_token, email: emailFromIdToken(data.id_token) };
}

function emailFromIdToken(idToken: string | undefined): string {
  if (!idToken) return "";
  const payload = idToken.split(".")[1];
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string };
    return claims.email ?? "";
  } catch {
    return "";
  }
}

export async function saveCredential(input: { refreshToken: string; email: string }): Promise<void> {
  const key = loadKey(env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  const sealed = encrypt(input.refreshToken, key);

  await prisma.googleCredential.upsert({
    where: { id: 1 },
    create: { id: 1, accountEmail: input.email, refreshTokenSealed: sealed },
    update: { accountEmail: input.email, refreshTokenSealed: sealed, connectedAt: new Date() },
  });
}

export async function getCredential() {
  if (calendarStubEnabled()) return STUB_CREDENTIAL;
  return prisma.googleCredential.findUnique({ where: { id: 1 } });
}

/** Short-lived access token from the stored refresh token. */
async function accessToken(): Promise<{ token: string; calendarId: string; timeZone: string }> {
  const credential = await getCredential();
  if (!credential) throw new CalendarNotConnectedError();

  const key = loadKey(env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  const refreshToken = decrypt(credential.refreshTokenSealed, key);

  const body = new URLSearchParams({
    client_id: env.AUTH_GOOGLE_ID,
    client_secret: env.AUTH_GOOGLE_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch(TOKEN_URL, { method: "POST", body });
  if (!response.ok) {
    throw new Error(`Rafraîchissement du token Google refusé (${response.status}) — reconnecter l'agenda depuis l'admin.`);
  }
  const data = (await response.json()) as TokenResponse;

  return { token: data.access_token, calendarId: credential.calendarId, timeZone: credential.timeZone };
}

export class CalendarNotConnectedError extends Error {
  constructor() {
    super("Agenda Google non connecté");
    this.name = "CalendarNotConnectedError";
  }
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Calendar ${init.method ?? "GET"} ${path} → ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/** Busy intervals in the window, from the connected calendar. */
export async function fetchBusy(window: { start: Date; end: Date }): Promise<Array<{ start: Date; end: Date }>> {
  if (calendarStubEnabled()) return [];
  const { token, calendarId } = await accessToken();
  const data = await call<{ calendars: Record<string, { busy: Array<{ start: string; end: string }> }> }>(
    token,
    "/freeBusy",
    {
      method: "POST",
      body: JSON.stringify({
        timeMin: window.start.toISOString(),
        timeMax: window.end.toISOString(),
        items: [{ id: calendarId }],
      }),
    },
  );

  const busy = data.calendars[calendarId]?.busy ?? Object.values(data.calendars)[0]?.busy ?? [];
  return busy.map((interval) => ({ start: new Date(interval.start), end: new Date(interval.end) }));
}

export type CreatedEvent = { eventId: string; meetUrl: string | null };

/** Creates the call with a Meet link and invites the prospect. */
export async function createCallEvent(input: {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  attendeeEmail: string;
  attendeeName: string;
  requestId: string;
}): Promise<CreatedEvent> {
  if (calendarStubEnabled()) return stubEvent(input.requestId);
  const { token, calendarId } = await accessToken();
  const event = await call<{ id: string; hangoutLink?: string; conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> } }>(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start.toISOString() },
        end: { dateTime: input.end.toISOString() },
        attendees: [{ email: input.attendeeEmail, displayName: input.attendeeName }],
        conferenceData: {
          createRequest: { requestId: input.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
        reminders: { useDefault: true },
      }),
    },
  );

  const meet =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
    null;

  return { eventId: event.id, meetUrl: meet };
}

export async function moveCallEvent(eventId: string, start: Date, end: Date): Promise<void> {
  if (calendarStubEnabled()) return;
  const { token, calendarId } = await accessToken();
  await call(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "PATCH",
    body: JSON.stringify({ start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } }),
  });
}

export async function cancelCallEvent(eventId: string): Promise<void> {
  if (calendarStubEnabled()) return;
  const { token, calendarId } = await accessToken();
  await call(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "DELETE",
  });
}
