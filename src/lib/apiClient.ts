/**
 * API client for the trip agent backend.
 *
 * Backend contract (implemented in trip-agent/src/main.py):
 *
 *   POST /chat/send    { message, thread_id?, user_id? }  -> SSE StreamEvent
 *   POST /chat/resume  { thread_id, selection_id, selected_options } -> SSE StreamEvent
 *   GET  /conversations
 *   GET  /conversations/:id/messages
 *   GET  /favorites?destination=&section=
 *   DELETE /favorites/:destination?section=
 *
 * Every request carries the Supabase access token as a bearer token. The
 * backend verifies it and derives the acting user from the token's `sub` claim —
 * a user_id in the body is only a cross-check and is rejected on mismatch.
 *
 * A note on streaming: the backend streams progress events ("Searching the
 * web…") but sends the assistant's prose as one `text` event rather than
 * token-by-token. That is deliberate — its output guardrail has to inspect a
 * complete reply before any of it is shown, which streaming tokens would defeat.
 */

import { supabase } from './supabaseClient';
import type {
  ResumeInterruptRequest,
  SendMessageRequest,
  StreamEvent,
} from './types';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000';

/** Fetch the current access token, refreshing it if it has expired. */
async function authHeaders(): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.session.access_token}`,
  };
}

async function errorFrom(res: Response): Promise<Error> {
  let detail = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') detail = body.detail;
  } catch {
    // Non-JSON error body; keep the status-based message.
  }
  if (res.status === 401) return new Error('Your session has expired. Please sign in again.');
  return new Error(detail);
}

/** Parse an SSE body into StreamEvents. */
async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line; keep the trailing partial frame.
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        for (const line of frame.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          try {
            yield JSON.parse(trimmed.slice(5).trim()) as StreamEvent;
          } catch {
            // Skip a malformed frame rather than aborting the stream.
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function* streamPost(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    yield {
      type: 'error',
      message: err instanceof Error ? err.message : "Couldn't reach the travel agent.",
    };
    return;
  }

  if (!res.ok) {
    yield { type: 'error', message: (await errorFrom(res)).message };
    return;
  }
  if (!res.body) {
    yield { type: 'error', message: 'The server sent an empty response.' };
    return;
  }

  yield* parseSSEStream(res.body);
}

/** Send a message and stream the turn. May end in an `interrupt` instead of `text`. */
export function sendMessage(
  req: SendMessageRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  return streamPost('/chat/send', req, signal);
}

/**
 * Answer a pending selection and let the same turn continue.
 *
 * The turn can pause again, so callers should keep handling `interrupt` events
 * until a `text` event arrives.
 */
export function resumeInterrupt(
  req: ResumeInterruptRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  return streamPost('/chat/resume', req, signal);
}

// --- Plain JSON endpoints ---------------------------------------------------

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, { headers: await authHeaders() });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as T;
}

export interface SavedTrip {
  favorite_id: string;
  destination: { name: string; country?: string; lat?: number; lon?: number };
  places: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  accommodations: Array<Record<string, unknown>>;
  notes?: string | null;
  updated_at?: string;
}

export async function fetchFavorites(destination?: string): Promise<SavedTrip[]> {
  const query = destination ? `?destination=${encodeURIComponent(destination)}` : '';
  const data = await getJSON<{ favorites: SavedTrip[] }>(`/favorites${query}`);
  return data.favorites ?? [];
}

/** Delete a saved trip, or with `section` just one part of it (e.g. 'hotels'). */
export async function deleteFavorite(destination: string, section?: string): Promise<void> {
  const query = section ? `?section=${encodeURIComponent(section)}` : '';
  const res = await fetch(`${BACKEND_URL}/favorites/${encodeURIComponent(destination)}${query}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) throw await errorFrom(res);
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
