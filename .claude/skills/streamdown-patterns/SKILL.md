---
name: streamdown-patterns
description: Streamdown — drop-in Markdown renderer for AI streaming. Handles unterminated chunks, interactive code blocks (Shiki), math (KaTeX), GFM, Tailwind typography, and security hardening. Use when building AI chat UIs or streaming Markdown renderers.
metadata:
  origin: custom
---

# Streamdown Patterns

Streamdown is a drop-in, composable Markdown renderer purpose-built for AI streaming. It handles unterminated chunks, interactive code blocks, math, and adversarial content that breaks standard Markdown packages.

**Install:**
```bash
npm i streamdown
# or via AI Elements
npx ai-elements@latest add message
```

## When to Activate

- Building AI chat interfaces with streaming Markdown responses
- Replacing `react-markdown` or `marked` in streaming contexts
- Adding interactive code blocks with syntax highlighting and copy buttons
- Rendering math (LaTeX) expressions from LLM output
- Implementing the AI Elements `<Response />` component pattern
- Hardening Markdown rendering against untrusted LLM-generated content

## Core Features

| Feature | Detail |
|---|---|
| Streaming-safe | Handles unterminated chunks — partial bold, open code fences, incomplete tables |
| Tailwind typography | Preconfigured `prose` classes for headings, lists, code blocks |
| GitHub Flavored Markdown | Tables, task lists, strikethrough, autolinks |
| Interactive code blocks | Shiki syntax highlighting + built-in copy button |
| Math | LaTeX via `remark-math` + KaTeX |
| Security | Restricted images and links, safe handling of untrusted content |

## Basic Usage — Standalone

```tsx
import { Streamdown } from 'streamdown';

// Static rendering
<Streamdown content={markdownString} />

// Streaming (append chunks as they arrive)
<Streamdown content={accumulatedContent} streaming={true} />
```

## Streaming Pattern with Fetch + ReadableStream

```tsx
'use client';
import { useState, useEffect } from 'react';
import { Streamdown } from 'streamdown';

export function StreamingResponse({ prompt }: { prompt: string }) {
  const [content, setContent] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let accumulated = '';
    const controller = new AbortController();

    fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    }).then(res => {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      function pump(): Promise<void> {
        return reader.read().then(({ done: d, value }) => {
          if (d) { setDone(true); return; }
          accumulated += decoder.decode(value, { stream: true });
          setContent(accumulated);
          return pump();
        });
      }
      return pump();
    }).catch(() => {});

    return () => controller.abort();
  }, [prompt]);

  return <Streamdown content={content} streaming={!done} />;
}
```

## Streaming Pattern with Vercel AI SDK

```tsx
'use client';
import { useChat } from 'ai/react';
import { Streamdown } from 'streamdown';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div>
      {messages.map(m => (
        <div key={m.id}>
          {m.role === 'assistant' ? (
            <Streamdown content={m.content} streaming={m.content === ''} />
          ) : (
            <p>{m.content}</p>
          )}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

## AI Elements Integration

```bash
npx ai-elements@latest add message
```

Scaffolds the `<Response />` component which wraps Streamdown with sensible defaults:

```tsx
import { Response } from '@/components/ai/response';

<Response content={streamedMarkdown} />
```

## Styling with Tailwind Typography

Streamdown ships with preconfigured Tailwind `prose` classes. Customize via the `className` prop:

```tsx
<Streamdown
  content={markdown}
  className="prose prose-gray max-w-none dark:prose-invert lg:prose-lg
             prose-code:before:content-none prose-code:after:content-none"
/>
```

Install the typography plugin if not present:
```bash
npm i -D @tailwindcss/typography
```

```ts
// tailwind.config.ts
export default {
  plugins: [require('@tailwindcss/typography')],
}
```

## Math Rendering

Include the KaTeX stylesheet in your app shell:

```tsx
// app/layout.tsx (Next.js)
import 'katex/dist/katex.min.css';
```

Inline math: `$E = mc^2$`

Block math:
```
$$
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
$$
```

## Code Blocks — Shiki + Copy Button

Interactive code blocks render automatically with Shiki. Built-in copy button copies raw code.

Customize the theme:

```tsx
<Streamdown
  content={markdown}
  codeTheme={{ light: 'github-light', dark: 'github-dark' }}
/>
```

## Why Streamdown Over `react-markdown`

Standard parsers fail on unterminated input mid-stream:

| Input (mid-chunk) | react-markdown | Streamdown |
|---|---|---|
| `**bold text` | renders `**bold text` | recovers as `bold text` |
| ` ```js\nconst x` | crashes / empty | renders partial block |
| `\| col1 \| col` | broken table | defers until complete |
| `$E = mc^` | parse error | defers math |

Streamdown buffers ambiguous tokens and flushes once the chunk resolves.

## Security Hardening

Default behavior on untrusted LLM content:
- **Images:** Only allowed-origin `src` renders; others stripped
- **Links:** `javascript:` and `data:` hrefs blocked; external links get `rel="noopener noreferrer"`
- **HTML:** Raw HTML sanitized — no `<script>`, `<iframe>`, event handlers

For fully trusted content (internal docs only):
```tsx
<Streamdown content={markdown} allowUnsafeHtml />
```

## Anti-Patterns

- Don't use `react-markdown` for streamed output — it re-parses the full string on every chunk
- Don't pass raw LLM output to `dangerouslySetInnerHTML` — use Streamdown's sanitization
- Don't render math without the KaTeX stylesheet — expressions display as raw LaTeX
- Don't forget `streaming={false}` once done — affects final rendering of deferred tokens
