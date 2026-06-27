---
name: prisma-patterns
description: Prisma ORM patterns — schema design, relations, CRUD, filtering, pagination, transactions, nested writes, and migrations. Based on official Prisma docs. Use when designing database schemas, writing queries, or handling migrations in Node.js/TypeScript projects.
metadata:
  origin: custom
---

# Prisma ORM Patterns

Prisma is a type-safe ORM for Node.js/TypeScript. It auto-generates a fully-typed client from your schema, eliminating runtime type errors in database queries.

**Install:**
```bash
npm i prisma @prisma/client
npx prisma init          # creates prisma/schema.prisma + .env
```

## When to Activate

- Designing or modifying a database schema
- Writing database queries (CRUD, filtering, pagination)
- Handling relations between models
- Implementing transactions (transfer, saga, atomic updates)
- Running or debugging migrations
- Solving N+1 query problems

---

## Schema Design

### datasource + generator

```prisma
datasource db {
  provider = "postgresql"   // postgresql | mysql | sqlite | mongodb
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

### Model Definition

```prisma
model User {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  posts     Post[]
  profile   Profile?

  @@index([email])
  @@index([role, createdAt])
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  tags      Tag[]
  views     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([authorId])
  @@index([published, createdAt])   // composite for filtered+sorted queries
}

model Profile {
  id     String  @id @default(cuid())
  bio    String?
  userId String  @unique
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Implicit many-to-many (Prisma manages join table)
model Tag {
  id    String @id @default(cuid())
  name  String @unique
  posts Post[]
}

enum Role {
  USER
  ADMIN
  MODERATOR
}
```

### Key Attributes Reference

| Attribute | Purpose |
|---|---|
| `@id` | Primary key |
| `@unique` | Unique constraint |
| `@default(cuid())` | Client-generated ID (URL-safe, sortable) |
| `@default(uuid())` | UUID v4 |
| `@default(autoincrement())` | Auto-incrementing integer |
| `@default(now())` | Current timestamp on create |
| `@updatedAt` | Auto-update timestamp on every write |
| `@relation(...)` | Foreign key + cascade config |
| `@@index([fields])` | Composite index |
| `@@unique([fields])` | Composite unique constraint |

---

## Migrations

```bash
# Development: generate and apply migration
npx prisma migrate dev --name add_user_role

# Production: apply pending migrations (no prompt, CI-safe)
npx prisma migrate deploy

# Reset database (dev only — drops all data)
npx prisma migrate reset

# Regenerate Prisma Client after schema change
npx prisma generate

# Open visual data editor
npx prisma studio
```

---

## Client Setup — Singleton (Next.js)

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'warn', 'error']
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

The singleton pattern prevents connection pool exhaustion from hot-reload creating new clients in development.

---

## Create

```typescript
// Single record
const user = await prisma.user.create({
  data: { email: 'alice@example.com', name: 'Alice' },
});

// Many records
const result = await prisma.user.createMany({
  data: [
    { email: 'bob@example.com', name: 'Bob' },
    { email: 'carol@example.com', name: 'Carol' },
  ],
  skipDuplicates: true,
});
// result.count === 2

// Create and return (PostgreSQL/SQLite)
const users = await prisma.user.createManyAndReturn({
  data: [{ email: 'dan@example.com' }],
  select: { id: true, email: true },
});
```

---

## Read

```typescript
// By unique field — returns null if not found
const user = await prisma.user.findUnique({
  where: { email: 'alice@example.com' },
  select: { id: true, name: true, email: true },
});

// Many with filters, sort, pagination
const users = await prisma.user.findMany({
  where: { role: 'ADMIN' },
  orderBy: { createdAt: 'desc' },
  take: 20,
  skip: 0,
  select: { id: true, name: true, email: true, role: true },
});

// Include relations
const usersWithPosts = await prisma.user.findMany({
  include: {
    posts: {
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    },
    profile: true,
  },
});

// First matching record
const latest = await prisma.post.findFirst({
  where: { published: true },
  orderBy: { createdAt: 'desc' },
});

// Count
const total = await prisma.user.count({ where: { role: 'ADMIN' } });
```

---

## Filtering

```typescript
// String operators
await prisma.user.findMany({
  where: {
    email: { endsWith: '@example.com' },
    name: { contains: 'alice', mode: 'insensitive' },
  },
});

// Numeric operators
await prisma.post.findMany({
  where: { views: { gt: 100, lte: 10000 } },
});

// Logical operators
await prisma.user.findMany({
  where: {
    OR: [
      { name: { startsWith: 'A' } },
      { role: 'ADMIN' },
    ],
    AND: { createdAt: { gte: new Date('2024-01-01') } },
    NOT: { email: { contains: 'test' } },
  },
});

// Relation filters
await prisma.user.findMany({
  where: {
    posts: {
      some: { published: true, views: { gt: 100 } },
      // every: { published: true }    all posts match
      // none: { published: false }    no posts match
    },
  },
});
```

---

## Pagination

```typescript
// Offset-based — simple, works with page numbers
const page = 2;
const pageSize = 20;
const [users, total] = await prisma.$transaction([
  prisma.user.findMany({
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: 'desc' },
  }),
  prisma.user.count(),
]);

// Cursor-based — better for infinite scroll / large datasets
const firstPage = await prisma.post.findMany({
  take: 20,
  orderBy: { id: 'asc' },
});

const lastCursor = firstPage.at(-1)?.id;

const nextPage = await prisma.post.findMany({
  take: 20,
  skip: 1,                      // skip the cursor item itself
  cursor: { id: lastCursor },
  orderBy: { id: 'asc' },
});
```

---

## Update

```typescript
// Single record
await prisma.user.update({
  where: { id: 'user_123' },
  data: { name: 'Alice Smith', role: 'ADMIN' },
});

// Atomic numeric operations (no race condition)
await prisma.post.update({
  where: { id: 'post_123' },
  data: {
    views: { increment: 1 },
    likes: { increment: 1 },
  },
});

// Upsert
const user = await prisma.user.upsert({
  where: { email: 'alice@example.com' },
  update: { name: 'Alice Updated' },
  create: { email: 'alice@example.com', name: 'Alice' },
});

// Many
await prisma.post.updateMany({
  where: { authorId: 'user_123', published: false },
  data: { published: true },
});
```

---

## Delete

```typescript
// Single
await prisma.user.delete({ where: { id: 'user_123' } });

// Many (with filter)
await prisma.post.deleteMany({
  where: { published: false, createdAt: { lt: new Date('2023-01-01') } },
});
```

---

## Nested Writes

Atomic create/update/connect across related models in a single query.

```typescript
// Create user with profile and posts in one operation
const user = await prisma.user.create({
  data: {
    email: 'alice@example.com',
    profile: {
      create: { bio: 'Software engineer' },
    },
    posts: {
      create: [{
        title: 'First post',
        tags: {
          connectOrCreate: [
            { where: { name: 'typescript' }, create: { name: 'typescript' } },
            { where: { name: 'react' }, create: { name: 'react' } },
          ],
        },
      }],
    },
  },
  include: { profile: true, posts: { include: { tags: true } } },
});

// Connect existing records
await prisma.post.update({
  where: { id: 'post_123' },
  data: {
    tags: {
      connect: [{ id: 'tag_1' }, { id: 'tag_2' }],
      disconnect: [{ id: 'tag_3' }],
    },
  },
});
```

---

## Transactions

### Sequential (batch atomic)

```typescript
const [deletedPosts, deletedUser] = await prisma.$transaction([
  prisma.post.deleteMany({ where: { authorId: userId } }),
  prisma.user.delete({ where: { id: userId } }),
]);
```

### Interactive (logic between queries)

```typescript
const result = await prisma.$transaction(async (tx) => {
  // Debit sender
  const sender = await tx.account.update({
    data: { balance: { decrement: amount } },
    where: { id: senderId },
  });

  // Validate — throw to trigger rollback
  if (sender.balance < 0) {
    throw new Error('Insufficient funds');
  }

  // Credit receiver
  return tx.account.update({
    data: { balance: { increment: amount } },
    where: { id: receiverId },
  });
}, {
  maxWait: 5000,    // wait up to 5s to acquire transaction
  timeout: 10000,   // transaction must complete within 10s
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
});
```

### Retry on Write Conflict

```typescript
import { Prisma } from '@prisma/client';

const MAX_RETRIES = 5;
let retries = 0;

while (retries < MAX_RETRIES) {
  try {
    await prisma.$transaction(operations, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    break;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
      retries++;
      continue;
    }
    throw e;
  }
}
```

**Rule:** Keep transactions short. No network calls or heavy computation inside `$transaction` — long transactions cause deadlocks.

---

## Error Handling

```typescript
import { Prisma } from '@prisma/client';

try {
  await prisma.user.create({ data: { email: 'duplicate@example.com' } });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P2002': throw new Error('Email already exists');       // unique violation
      case 'P2025': throw new Error('Record not found');           // update/delete missing
      case 'P2003': throw new Error('Foreign key violation');
      case 'P2034': throw new Error('Write conflict — retry');
    }
  }
  throw e;
}
```

---

## Anti-Patterns

### N+1 — Always use include/select

```typescript
// Bad — 1 query for users + N queries for posts
const users = await prisma.user.findMany();
for (const u of users) {
  const posts = await prisma.post.findMany({ where: { authorId: u.id } }); // N queries!
}

// Good — single JOIN query
const users = await prisma.user.findMany({ include: { posts: true } });
```

### Over-fetching — lean selects

```typescript
// Bad — fetches all columns including large text/json fields
const users = await prisma.user.findMany();

// Good
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true },
});
```

### Missing indexes

```prisma
// Add @@index for every field used in where/orderBy in findMany
model Post {
  @@index([authorId])             // FK always
  @@index([published, createdAt]) // composite for filtered+sorted
}
```

### Unbounded queries

```typescript
// Bad — returns all rows, breaks in production
const all = await prisma.post.findMany();

// Good — always paginate
const posts = await prisma.post.findMany({ take: 50, orderBy: { createdAt: 'desc' } });
```
