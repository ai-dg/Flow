/**
 * Gmail MCP Integration
 *
 * Two paths to fetch inbox data:
 *
 *   1. converseWithGmail() — real Anthropic Messages API call with mcp_servers.
 *      Anthropic's infrastructure handles the OAuth-authenticated Gmail MCP
 *      server connection; Claude receives the inbox JSON automatically.
 *
 *   2. triggerMockGmailMCPResponse() — spawns 5 hardcoded emails in a staggered
 *      column for instant demo use (no API key / OAuth required).
 *
 * Column layout: 5 cards × 16% height, 2% gap, starting at y=4%, x=8%, w=42%.
 */

import { MODEL } from "./client";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { dispatchWidgetDeclarations, type WidgetDeclaration } from "./orchestrate";
import type { ModelMessage } from "ai";

// ─── Part 1 — MCP server configuration ───────────────────────────────────────
//
// Pass GMAIL_MCP_SERVERS as the `mcp_servers` field in any Anthropic Messages
// API call. Anthropic's backend authenticates to the Gmail MCP server using
// the user's OAuth token (supplied via authorization_token at call time).
//
// Required beta header: "mcp-client-2025-04-04"
//
// Example request body:
//   {
//     model:       "claude-sonnet-4-6",
//     max_tokens:  8096,
//     system:      SYSTEM_PROMPT,
//     mcp_servers: GMAIL_MCP_SERVERS,   // ← this is the key addition
//     messages:    [...]
//   }

export const GMAIL_MCP_SERVERS: Array<{
  type:                 "url";
  url:                  string;
  name:                 string;
  authorization_token?: string;
}> = [
  {
    type: "url",
    url:  "https://gmailmcp.googleapis.com/mcp/v1",
    name: "gmail",
    // authorization_token is injected at call time from the OAuth flow
  },
];

// ─── Column layout constants ──────────────────────────────────────────────────

const COL_LEFT  = 8;  // % from left edge
const COL_WIDTH = 42; // % width
const CARD_H    = 16; // % height per card
const CARD_GAP  = 2;  // % gap between cards
const START_Y   = 4;  // % from top
const MAX_CARDS = Math.floor((100 - START_Y) / (CARD_H + CARD_GAP)); // 5

function cardPosition(i: number) {
  return {
    top:    `${START_Y + i * (CARD_H + CARD_GAP)}%`,
    left:   `${COL_LEFT}%`,
    width:  `${COL_WIDTH}%`,
    height: `${CARD_H}%`,
  };
}

// ─── Part 2 — Mock Gmail MCP response ────────────────────────────────────────
//
// Simulates the structured data returned after Claude parses a Gmail MCP
// server response. Calling triggerMockGmailMCPResponse() from the DemoController
// button (or browser console) spawns five email-ui widgets with 200ms stagger.

interface MockEmail {
  id:        string;
  from:      string;
  subject:   string;
  snippet:   string; // ~150 chars — renderer truncates to exactly 100 + "…"
  timestamp: string; // ISO-8601 — renderer converts to "2h ago" etc.
  unread:    boolean;
}

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

const MOCK_EMAILS: MockEmail[] = [
  {
    id:        "e1",
    from:      "sarah@acme.com",
    subject:   "Re: Q3 Roadmap — Board Deck",
    snippet:   "Looks great! The canvas prototype is exactly what I had in mind. Let's sync Thursday at 3pm to walk through the demo flow before the board presentation. Sharing Figma now.",
    timestamp: ago(2 * 3_600_000),
    unread:    true,
  },
  {
    id:        "e2",
    from:      "alex@benchmark.vc",
    subject:   "Series A Term Sheet — Action Required",
    snippet:   "Hi Diego, I've attached the term sheet for your review. We're looking to move quickly — can you confirm receipt and flag any issues by EOD Friday? Our partners are fully aligned.",
    timestamp: ago(5 * 3_600_000),
    unread:    true,
  },
  {
    id:        "e3",
    from:      "notifications@github.com",
    subject:   "[OS-AI] PR #14 — feat: voice canvas integration",
    snippet:   "Pull request opened by @ai-dg: Adds real-time voice input via Web Speech API, connects to the canvas store, and renders queries as staggered ticker text with sentence-level streaming.",
    timestamp: ago(24 * 3_600_000),
    unread:    false,
  },
  {
    id:        "e4",
    from:      "team@anthropic.com",
    subject:   "Hackathon check-in: 8 hours remaining",
    snippet:   "Quick note from the Anthropic team. OS-AI has been flagged for its innovative MCP tool-calling and cinematic canvas system. Best of luck in the final stretch!",
    timestamp: ago(26 * 3_600_000),
    unread:    false,
  },
  {
    id:        "e5",
    from:      "yc@ycombinator.com",
    subject:   "YC Demo Day logistics — please read",
    snippet:   "Final reminder: your slot is 2:15 PM in Auditorium A. You have 4 minutes to demo and 2 minutes Q&A. Doors open at 1:30 PM. Please arrive 15 minutes early to test AV.",
    timestamp: ago(48 * 3_600_000),
    unread:    true,
  },
];

function buildEmailColumn(emails: MockEmail[]): WidgetDeclaration[] {
  return emails.slice(0, MAX_CARDS).map((email, i) => ({
    id:       `gmail-${email.id}`,
    type:     "email-ui",
    position: cardPosition(i),
    props: {
      from:        email.from,
      subject:     email.subject,
      previewText: email.snippet,
      timestamp:   email.timestamp,
      unread:      email.unread,
    },
  }));
}

/**
 * Simulates a raw Gmail MCP server response and renders the result immediately.
 * Clears the canvas, then spawns email cards one by one with 200ms stagger.
 *
 * Call from:
 *   • [ GMAIL DEMO ] button in the DemoController
 *   • Browser console: import("/src/ai/gmailMCP").then(m => m.triggerMockGmailMCPResponse())
 */
export function triggerMockGmailMCPResponse(): void {
  const declarations = buildEmailColumn(MOCK_EMAILS);
  dispatchWidgetDeclarations(declarations, { staggerMs: 200 });
}

// ─── Part 3 — Real MCP call via fetch ────────────────────────────────────────
//
// The Vercel AI SDK's streamText() does not expose the mcp_servers parameter,
// so we call the Anthropic Messages API directly via fetch. Anthropic handles
// the Gmail MCP server connection server-side; Claude sees the inbox as context.
//
// Prerequisites:
//   • VITE_ANTHROPIC_API_KEY in .env
//   • A valid Gmail OAuth bearer token (read scope)

export interface GmailConverseResult {
  spoken:  string;
  rawJson: string;
}

/**
 * Sends one conversation turn to Claude with the Gmail MCP server attached.
 *
 * @param history     Conversation history in Vercel AI SDK ModelMessage format
 * @param gmailToken  Gmail OAuth bearer token (injected as authorization_token)
 * @param onDelta     Optional callback that fires once with the full response text
 */
export async function converseWithGmail(
  history:    ModelMessage[],
  gmailToken: string,
  onDelta?:   (raw: string) => void
): Promise<GmailConverseResult> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string;

  // Inject the OAuth token into the MCP server config
  const mcpServers = [{ ...GMAIL_MCP_SERVERS[0], authorization_token: gmailToken }];

  // Normalise Vercel AI SDK messages to Anthropic's format
  const messages = history.map((m) => ({
    role:    m.role as "user" | "assistant",
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));

  const ANTHROPIC_BASE = "/api/anthropic";
  const response = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type":                              "application/json",
      "x-api-key":                                 apiKey,
      "anthropic-version":                         "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "anthropic-beta":                            "mcp-client-2025-04-04",
    },
    body: JSON.stringify({
      model:       MODEL,
      max_tokens:  8096,
      system:      SYSTEM_PROMPT,
      mcp_servers: mcpServers,
      messages,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gmail MCP ${response.status}: ${errBody}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text?: string }>;
  };

  const rawJson = data.content.find((b) => b.type === "text")?.text ?? "";
  onDelta?.(rawJson);

  let spoken = "";
  try {
    const parsed = JSON.parse(rawJson) as {
      speech?:  string;
      widgets?: WidgetDeclaration[];
    };
    spoken = parsed.speech ?? "";

    if (Array.isArray(parsed.widgets) && parsed.widgets.length > 0) {
      // Apply stagger when Claude returns email-ui widgets from a Gmail query
      const hasEmails = parsed.widgets.some((w) => w.type === "email-ui");
      dispatchWidgetDeclarations(parsed.widgets, { staggerMs: hasEmails ? 200 : 0 });
    }
  } catch {
    spoken = rawJson.slice(0, 300);
  }

  return { spoken, rawJson };
}
