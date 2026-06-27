---
name: vercel-ai-sdk
description: Vercel AI SDK patterns for frontend and backend — useChat, useCompletion, useObject, generateText, streamText, generateObject, tool calling, multi-step agents, RAG, streaming UI, and provider setup. Use when building AI-powered features with Next.js, React, or Node.js.
metadata:
  origin: custom
---

# Vercel AI SDK Patterns

The AI SDK standardizes LLM integration across providers (OpenAI, Anthropic, Google, Groq, Mistral, xAI, 15+) with a unified API for text, structured data, streaming, tool calling, and agentic workflows.

**Install:**
```bash
npm i ai @ai-sdk/anthropic     # Anthropic
npm i ai @ai-sdk/openai        # OpenAI
npm i ai @ai-sdk/google        # Google
npm i @ai-sdk/react            # React UI hooks
```

## When to Activate

- Building chat interfaces, completion inputs, or AI-generated UI
- Streaming LLM responses to the frontend
- Generating structured/typed data from LLMs
- Building tool-calling agents or multi-step workflows
- Implementing RAG (retrieval-augmented generation)
- Switching or abstracting across LLM providers

---

## Provider Setup

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

// All providers share the same API surface
const model = anthropic('claude-sonnet-4-6');
const model = openai('gpt-4o');
const model = google('gemini-2.0-flash');
```

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

Centralize model config:
```typescript
// lib/ai.ts
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

export const chatModel = anthropic('claude-sonnet-4-6');
export const fastModel = anthropic('claude-haiku-4-5-20251001');
export const embeddingModel = openai.embedding('text-embedding-3-small');
```

---

## Core Backend Functions

### generateText — Non-Streaming

For automation, background jobs, batch processing, or any task where real-time output isn't needed.

```typescript
import { generateText } from 'ai';
import { chatModel } from '@/lib/ai';

const { text, usage, finishReason } = await generateText({
  model: chatModel,
  system: 'You are a helpful assistant.',
  prompt: 'Summarize this document in 3 bullet points.',
  maxTokens: 500,
  temperature: 0.3,
});

// usage: { promptTokens, completionTokens, totalTokens }
// finishReason: 'stop' | 'length' | 'tool-calls' | 'error'
if (finishReason === 'length') {
  // response was truncated — increase maxTokens or handle gracefully
}
```

### streamText — Streaming Backend

For chat endpoints and any user-facing real-time output.

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { chatModel } from '@/lib/ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: chatModel,
    system: 'You are a helpful assistant.',
    messages,
    maxTokens: 2048,
    onFinish: async ({ text, usage }) => {
      // Persist to DB after stream completes — not before
      await saveMessage({ role: 'assistant', content: text, usage });
    },
  });

  return result.toDataStreamResponse();
}
```

### generateObject — Structured Output

Generate type-safe structured data validated against a Zod schema. Retries automatically on schema mismatch.

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: chatModel,
  schema: z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    confidence: z.number().min(0).max(1),
    topics: z.array(z.string()),
    summary: z.string().max(200),
  }),
  prompt: `Analyze this review: "${reviewText}"`,
});

// object is fully typed — no JSON.parse, no runtime errors
```

### streamObject — Stream Structured Data

Stream a structured object incrementally as fields are generated.

```typescript
import { streamObject } from 'ai';

const { partialObjectStream } = streamObject({
  model: chatModel,
  schema: z.object({
    steps: z.array(z.object({
      title: z.string(),
      description: z.string(),
      duration: z.string(),
    })),
  }),
  prompt: 'Create a 5-step plan to launch a SaaS product.',
});

for await (const partial of partialObjectStream) {
  // partial.steps may be undefined or partially filled while streaming
  console.log(partial);
}
```

---

## Tool Calling

### Defining Tools

```typescript
import { tool, generateText } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name or coordinates'),
    unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  }),
  execute: async ({ location, unit }) => {
    const data = await fetchWeather(location, unit);
    return { temperature: data.temp, condition: data.condition, location };
  },
});

const dbQueryTool = tool({
  description: 'Query the product database',
  inputSchema: z.object({
    filter: z.string(),
    limit: z.number().max(50).default(10),
  }),
  execute: async ({ filter, limit }) => {
    return prisma.product.findMany({ where: { name: { contains: filter } }, take: limit });
  },
});

const { text, toolCalls, toolResults } = await generateText({
  model: chatModel,
  tools: { weather: weatherTool, dbQuery: dbQueryTool },
  prompt: 'What is the weather in Paris and what products do we have matching "blue"?',
});
```

### Multi-Step Agent Loop

```typescript
import { generateText, isStepCount, isLoopFinished } from 'ai';

const { text, steps } = await generateText({
  model: chatModel,
  tools: {
    searchWeb: searchTool,
    readPage: readPageTool,
    writeReport: writeFileTool,
  },
  stopWhen: isStepCount(10),     // max 10 tool calls
  // stopWhen: isLoopFinished()  // let model decide when done
  prompt: 'Research the top 5 AI startups of 2025 and write a structured report.',
  onStepEnd: ({ stepNumber, usage }) => {
    console.log(`Step ${stepNumber} — tokens used: ${usage.totalTokens}`);
  },
});

// steps: array of { text, toolCalls, toolResults, usage } per step
```

### Human-in-the-Loop

```typescript
const result = await generateText({
  model: chatModel,
  tools: {
    deployToProduction: tool({
      description: 'Deploy to production',
      inputSchema: z.object({ version: z.string() }),
      execute: async ({ version }) => deploy(version),
    }),
    readLogs: tool({
      description: 'Read application logs',
      inputSchema: z.object({ lines: z.number() }),
      execute: async ({ lines }) => getLogs(lines),
    }),
  },
  toolApproval: {
    deployToProduction: 'user-approval',  // pause, await human confirm
    readLogs: 'approved',                 // auto-approve read-only tools
  },
  prompt: 'Deploy version 2.1.0 to production.',
});
```

---

## Frontend Hooks (React)

### useChat — Conversational Interface

```tsx
'use client';
import { useChat } from '@ai-sdk/react';
import { Streamdown } from 'streamdown';

export function Chat({ conversationId }: { conversationId: string }) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    reload,
  } = useChat({
    api: '/api/chat',
    body: { conversationId },           // extra body params sent with every request
    initialMessages: [],
    onFinish: (message) => console.log('Stream complete:', message.id),
    onError: (error) => console.error('Chat error:', error),
  });

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            {m.role === 'assistant'
              ? <Streamdown content={m.content} streaming={isLoading} />
              : <p className="bg-blue-100 rounded-lg px-3 py-2 inline-block">{m.content}</p>
            }
          </div>
        ))}
        {isLoading && (
          <button onClick={stop} className="text-sm text-gray-500">Stop generating</button>
        )}
        {error && (
          <div className="text-red-500">
            Error: {error.message}
            <button onClick={reload}>Retry</button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          className="flex-1 border rounded-lg px-3 py-2"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>Send</button>
      </form>
    </div>
  );
}
```

### useCompletion — Single Prompt Completion

```tsx
'use client';
import { useCompletion } from '@ai-sdk/react';

export function TextCompleter() {
  const { completion, input, handleInputChange, handleSubmit, isLoading } =
    useCompletion({ api: '/api/complete' });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        value={input}
        onChange={handleInputChange}
        placeholder="Start typing..."
        className="w-full border rounded-lg p-3 h-32"
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Completing...' : 'Complete'}
      </button>
      {completion && (
        <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap">{completion}</div>
      )}
    </form>
  );
}
```

### useObject — Stream Structured Data to UI

```tsx
'use client';
import { useObject } from '@ai-sdk/react';
import { z } from 'zod';

const reportSchema = z.object({
  title: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.string(),
  })),
});

export function ReportGenerator() {
  const { object, submit, isLoading } = useObject({
    api: '/api/generate-report',
    schema: reportSchema,
  });

  return (
    <div>
      <button onClick={() => submit({ topic: 'AI in healthcare' })} disabled={isLoading}>
        {isLoading ? 'Generating...' : 'Generate Report'}
      </button>

      {object && (
        <article className="prose mt-6">
          <h1>{object.title}</h1>
          {object.sections?.map((s, i) => (
            <section key={i}>
              <h2>{s.heading}</h2>
              <p>{s.content}</p>
            </section>
          ))}
        </article>
      )}
    </div>
  );
}
```

---

## RAG (Retrieval-Augmented Generation)

```typescript
import { generateText, embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { chatModel, embeddingModel } from '@/lib/ai';

async function ragQuery(userQuery: string, vectorDb: VectorDB) {
  // 1. Embed the user query
  const { embedding } = await embed({
    model: embeddingModel,
    value: userQuery,
  });

  // 2. Retrieve semantically similar chunks
  const chunks = await vectorDb.similaritySearch(embedding, { topK: 5, minScore: 0.75 });

  if (chunks.length === 0) {
    return 'No relevant information found.';
  }

  // 3. Generate answer grounded in retrieved context
  const { text } = await generateText({
    model: chatModel,
    system: `Answer the user's question using ONLY the context below. If the answer is not in the context, say so.

Context:
${chunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n')}`,
    prompt: userQuery,
    maxTokens: 1024,
  });

  return text;
}
```

---

## Next.js Project Structure

```
app/
├── api/
│   ├── chat/route.ts              # streamText → toDataStreamResponse()
│   ├── generate/route.ts          # generateObject for structured tasks
│   └── embed/route.ts             # embed for RAG ingestion
├── chat/
│   ├── page.tsx                   # server component — load conversation
│   └── _components/
│       ├── ChatInterface.tsx      # 'use client' — useChat hook
│       ├── Message.tsx            # Streamdown renderer
│       └── ChatInput.tsx
└── lib/
    ├── ai.ts                      # model instances (centralized)
    ├── tools.ts                   # tool definitions
    └── prompts.ts                 # system prompts as constants
```

---

## Error Handling

```typescript
import { generateText, APICallError, RetryError } from 'ai';

try {
  const { text } = await generateText({
    model: chatModel,
    prompt,
    maxRetries: 3,                 // built-in exponential backoff
    maxTokens: 1024,
    abortSignal: controller.signal,
  });
} catch (error) {
  if (APICallError.isInstance(error)) {
    // Provider returned an error response
    console.error('API error:', error.statusCode, error.message);
    if (error.statusCode === 429) {
      // Rate limited — implement backoff or fallback provider
    }
  } else if (RetryError.isInstance(error)) {
    console.error('All retries exhausted');
  }
  throw error;
}
```

---

## Anti-Patterns

- **API keys on client** — all LLM calls go through your API routes, never expose keys to browser
- **Missing maxTokens** — unbounded generation causes timeout and cost overruns
- **Saving before stream ends** — save in `onFinish` callback, not before (abort = data loss)
- **Ignoring finishReason** — `'length'` means response was cut off, handle it
- **Hardcoded model strings** — centralize in `lib/ai.ts` for easy provider switching
- **Blocking generateText in UI routes** — use streamText for anything user-facing
- **No rate limiting** — add per-user rate limiting on all AI routes (cost protection)
- **Manual JSON parsing** — use `generateObject` with Zod, never `JSON.parse(text)`
