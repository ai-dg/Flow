---
name: tailwind-patterns
description: Tailwind CSS v3/v4 patterns — utility-first composition, responsive design, dark mode, custom tokens, component variants with CVA/clsx, and performance. Use when writing or reviewing Tailwind-styled components.
metadata:
  origin: custom
---

# Tailwind CSS Patterns

Utility-first styling with Tailwind CSS v3/v4 for maintainable, performant, design-token-driven UIs.

## When to Activate

- Writing or reviewing components that use Tailwind utility classes
- Designing responsive layouts or dark mode support
- Setting up or extending `tailwind.config.ts` theme tokens
- Building reusable UI component variants
- Auditing bundle size or purge configuration
- Migrating from CSS modules or styled-components to Tailwind
- Using Tailwind with React, Next.js, or Vite

## Core Principles

### 1. Utilities Over Custom CSS

Reach for a utility class before writing any custom CSS. If you find yourself writing the same set of utilities three times, extract a component — not a CSS class.

```tsx
// Good: utilities inline
<button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
  Submit
</button>

// Bad: custom class that just wraps utilities
// .btn-primary { @apply rounded-lg bg-blue-600 px-4 py-2 ... }
```

### 2. Design Tokens via `theme.extend`

Never hardcode raw values. Extend the theme to name your tokens.

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'sans-serif'],
      },
    },
  },
}
```

### 3. Responsive Mobile-First

All responsive modifiers apply at the breakpoint **and above**. Design mobile layout first, then override upward.

```tsx
// mobile: stack / md: side-by-side / lg: constrained
<div className="flex flex-col gap-4 md:flex-row lg:max-w-5xl">
```

Breakpoints: `sm:640px` `md:768px` `lg:1024px` `xl:1280px` `2xl:1536px`

## Component Variants — CVA Pattern

Use `class-variance-authority` (CVA) for type-safe component variants. Never string-concatenate conditionally.

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const button = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:   'bg-brand-500 text-white hover:bg-brand-600',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
        ghost:     'hover:bg-gray-100 text-gray-700',
        danger:    'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm: 'h-8  px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button>;

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}
```

## `cn()` Utility

Always merge classes with `clsx` + `tailwind-merge` to avoid specificity conflicts.

```ts
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## Dark Mode

Configure `darkMode: 'class'` in `tailwind.config.ts`. Use `dark:` prefix.

```tsx
<div className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
```

Toggle by adding/removing the `dark` class on `<html>`. Persist preference in `localStorage`.

## Layout Patterns

### Sidebar Layout
```tsx
<div className="flex h-screen overflow-hidden">
  <aside className="w-64 shrink-0 border-r bg-gray-50 dark:bg-gray-900 overflow-y-auto" />
  <main className="flex-1 overflow-y-auto p-6" />
</div>
```

### Responsive Grid
```tsx
<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
```

### Centered Content
```tsx
<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
```

## Tailwind v4 (CSS-first config)

In v4, config moves from `tailwind.config.ts` to CSS using `@theme`:

```css
@import "tailwindcss";

@theme {
  --color-brand-500: #3b82f6;
  --font-sans: 'Inter Variable', sans-serif;
  --radius-lg: 0.5rem;
}
```

Use `@utility` for custom utilities instead of `@layer utilities`.

## Tailwind Typography Plugin (`@tailwindcss/typography`)

For prose content (Markdown, AI responses, articles):

```tsx
<article className="prose prose-gray max-w-none dark:prose-invert lg:prose-lg">
  {/* rendered HTML or MDX content */}
</article>
```

Customize via `prose-headings:`, `prose-a:`, `prose-code:` modifiers.

## Performance & Purge

- Tailwind scans `content` globs to purge unused classes at build time — never construct class names dynamically with string concatenation (purge will miss them)
- Safe pattern: full class name in source — `variant === 'danger' ? 'bg-red-600' : 'bg-blue-600'`
- Unsafe: `'bg-' + color + '-600'` — this will be purged

```ts
// tailwind.config.ts
export default {
  content: ['./src/**/*.{ts,tsx}', './app/**/*.{ts,tsx}'],
}
```

## Anti-Patterns

- `@apply` in CSS files — prefer component extraction in JSX/TSX instead
- Arbitrary values for values that should be design tokens: `w-[347px]` → add to theme
- Unconditional `!important` with `!` prefix — fix specificity instead
- Mixing Tailwind with CSS-in-JS (emotion, styled-components) in the same component
