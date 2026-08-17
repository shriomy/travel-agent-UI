/**
 * API client for the travel agent backend.
 *
 * This module centralizes all backend communication so the three core
 * operations — fetch thread history, send a message, resume an interrupt —
 * each live in one place.
 *
 * BACKEND STATUS: The backend endpoints are NOT yet defined. The functions
 * below use a mock implementation that simulates streaming responses and
 * interrupt payloads. Each function is clearly marked with a TODO comment
 * showing where the real endpoint should be wired in. Replace the mock body
 * with a fetch() call to the actual backend when it's available.
 *
 * Expected backend contract (assumed):
 *   POST /chat/send     — body: { message, thread_id, user_id }
 *                         response: SSE stream of StreamEvent chunks
 *   POST /chat/resume   — body: { thread_id, user_id, selection_id, selected_options }
 *                         response: SSE stream of StreamEvent chunks
 */

import type {
  ResumeInterruptRequest,
  SendMessageRequest,
  StreamEvent,
  InterruptData,
} from './types';

// --- Configuration ----------------------------------------------------------

// TODO: Replace with the actual backend base URL when the backend is deployed.
const BACKEND_URL = ''; // e.g. 'https://your-backend.example.com'

// Set to true once the real backend is available.
const BACKEND_ENABLED = false;

// --- Mock simulation helpers ------------------------------------------------

const MOCK_DELAY = 800;

const MOCK_INTERRUPT: InterruptData = {
  reason: 'I found several hotel options that match your criteria. Which ones would you like me to book?',
  selection_id: 'sel_hotels_001',
  options: [
    { id: 'opt_1', label: 'Grand Hyatt Tokyo', description: '$320/night — 4.8★, Shinjuku' },
    { id: 'opt_2', label: 'Park Hotel Tokyo', description: '$210/night — 4.5★, Shiodome' },
    { id: 'opt_3', label: 'Henn na Hotel Ginza', description: '$180/night — 4.3★, Ginza' },
  ],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function* mockStream(includeInterrupt: boolean): AsyncGenerator<StreamEvent> {
  const phrases = [
    'I can help you with that. ',
    'Let me look into the best options for your trip.\n\n',
    includeInterrupt ? 'Searching for available hotels...' : 'Here\'s what I found:\n\n',
  ];

  if (includeInterrupt) {
    yield { type: 'tool', content: 'Searching hotels in Tokyo for Oct 15–18...' };
    await sleep(MOCK_DELAY);
  }

  for (const phrase of phrases) {
    yield { type: 'text', content: phrase };
    await sleep(300);
  }

  if (includeInterrupt) {
    await sleep(MOCK_DELAY);
    yield { type: 'interrupt', data: MOCK_INTERRUPT };
    return;
  }

  await sleep(MOCK_DELAY);
  yield {
    type: 'text',
    content:
      '**Tokyo Trip Summary**\n\n' +
      '- **Flights:** Round-trip from JFK to HND, $850\n' +
      '- **Hotels:** 3 nights, avg $250/night\n' +
      '- **Activities:** TeamLab Planets, Shibuya Crossing, Meiji Shrine\n\n' +
      'Would you like me to finalize any of these?',
  };
  yield { type: 'done' };
}

// --- Public API -------------------------------------------------------------

/**
 * Send a message to the backend and receive a stream of events.
 *
 * TODO: Replace the mock with a real fetch to POST `${BACKEND_URL}/chat/send`.
 * The backend should return an SSE stream or chunked response where each chunk
 * is a JSON-encoded StreamEvent.
 */
export async function* sendMessage(
  req: SendMessageRequest,
): AsyncGenerator<StreamEvent> {
  if (BACKEND_ENABLED && BACKEND_URL) {
    // Real implementation (template):
    // const res = await fetch(`${BACKEND_URL}/chat/send`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(req),
    // });
    // if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    // yield* parseSSEStream(res.body!);
  }

  // --- Mock ---
  await sleep(MOCK_DELAY);
  const messageCount = Math.random();
  const includeInterrupt = messageCount > 0.4;
  yield* mockStream(includeInterrupt);
}

/**
 * Resume a paused turn after the user selects from an interrupt.
 *
 * TODO: Replace the mock with a real fetch to POST `${BACKEND_URL}/chat/resume`.
 * The backend should return a stream of StreamEvent chunks, and may itself
 * emit additional interrupts (which the caller should handle in a loop).
 */
export async function* resumeInterrupt(
  req: ResumeInterruptRequest,
): AsyncGenerator<StreamEvent> {
  if (BACKEND_ENABLED && BACKEND_URL) {
    // Real implementation (template):
    // const res = await fetch(`${BACKEND_URL}/chat/resume`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(req),
    // });
    // if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    // yield* parseSSEStream(res.body!);
  }

  // --- Mock ---
  await sleep(MOCK_DELAY);
  yield { type: 'tool', content: `Booking selected options (${req.selected_options.length})...` };
  await sleep(MOCK_DELAY);
  yield {
    type: 'text',
    content:
      `**Booking confirmed!**\n\nI've reserved ${req.selected_options.length} hotel(s) for your trip. ` +
      'You\'ll receive a confirmation email shortly.\n\nHave a great trip!',
  };
  yield { type: 'done' };
}

// --- SSE parser (for real backend) -----------------------------------------

// TODO: Uncomment and use this when the real backend is available.
// async function* parseSSEStream(
//   body: ReadableStream<Uint8Array>,
// ): AsyncGenerator<StreamEvent> {
//   const reader = body.getReader();
//   const decoder = new TextDecoder();
//   let buffer = '';
//
//   while (true) {
//     const { done, value } = await reader.read();
//     if (done) break;
//     buffer += decoder.decode(value, { stream: true });
//
//     const lines = buffer.split('\n');
//     buffer = lines.pop() ?? '';
//
//     for (const line of lines) {
//       const trimmed = line.trim();
//       if (!trimmed || !trimmed.startsWith('data:')) continue;
//       const json = trimmed.slice(5).trim();
//       try {
//         yield JSON.parse(json) as StreamEvent;
//       } catch {
//         // skip malformed lines
//       }
//     }
//   }
// }
