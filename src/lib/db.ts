import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Detect a stale cached client that's missing newer Prisma models (e.g. after a
// schema migration + `prisma generate` while the dev server kept running). In
// that case we drop the old instance and create a fresh one bound to the
// regenerated client. Safe no-op in production (no cached instance exists).
const cached = globalForPrisma.prisma
const isStale = cached && !(cached as unknown as { payment?: unknown }).payment

export const db =
  (!isStale && cached) ||
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
