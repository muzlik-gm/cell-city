import { PrismaClient } from '@prisma/client'
import { createClient } from '@libsql/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import path from 'path'

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DATABASE CLIENT - Turso (Production) / SQLite (Local Development)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ARCHITECTURE:
 * - Uses STATIC imports for @libsql/client and @prisma/adapter-libsql
 * - Singleton pattern prevents connection leaks during hot-reload
 * - Turso: Remote libSQL database for production/staging
 * - SQLite: Local file-based database for offline development
 *
 * ENVIRONMENT VARIABLES:
 * - TURSO_DATABASE_URL: libsql://your-db-name.turso.io (required for Turso)
 * - TURSO_AUTH_TOKEN: Your Turso database auth token (required for Turso)
 * - DATABASE_URL: file:./dev.db (auto-configured for SQLite fallback)
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ─── Global Singleton Pattern ────────────────────────────────────────
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ─── Configuration ──────────────────────────────────────────────────
interface DatabaseConfig {
  provider: 'turso' | 'sqlite'
  url: string
  authToken?: string
}

function getDatabaseConfig(): DatabaseConfig {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim()
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN?.trim()
  
  // Validate Turso configuration
  if (tursoUrl && tursoAuthToken && tursoUrl.startsWith('libsql://')) {
    return {
      provider: 'turso',
      url: tursoUrl,
      authToken: tursoAuthToken,
    }
  }
  
  // Fallback to local SQLite
  const localUrl = process.env.DATABASE_URL?.trim()
  if (localUrl && localUrl.startsWith('file:')) {
    return {
      provider: 'sqlite',
      url: localUrl,
    }
  }
  
  // Default local database path
  return {
    provider: 'sqlite',
    url: `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`,
  }
}

// ─── Client Factory ─────────────────────────────────────────────────
function createPrismaClient(): PrismaClient {
  const config = getDatabaseConfig()
  
  console.log('[DB] ════════════════════════════════════════════════')
  console.log('[DB] Initializing database client...')
  console.log(`[DB] Provider: ${config.provider.toUpperCase()}`)
  console.log(`[DB] URL: ${config.url.substring(0, 60)}${config.url.length > 60 ? '...' : ''}`)
  
  if (config.provider === 'turso') {
    console.log('[DB] Auth Token: ✓ Configured (' + (config.authToken?.length || 0) + ' chars)')
    
    // Create libsql client with explicit URL and auth
    const libsql = createClient({
      url: config.url,        // ← EXPLICIT URL (this was becoming undefined!)
      authToken: config.authToken!,
    })
    
    // Create Prisma adapter from libsql client
    const adapter = new PrismaLibSQL(libsql)
    
    // Create PrismaClient with the adapter
    const client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' 
        ? ['error', 'warn', 'query'] 
        : ['error'],
    })
    
    console.log('[DB] ✅ Turso Prisma client created successfully')
    console.log('[DB] ════════════════════════════════════════════════')
    
    return client
  }
  
  // SQLite client (no adapter needed)
  console.log('[DB] Using local SQLite database')
  
  // Ensure DATABASE_URL is set for Prisma schema validation
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = config.url
  }
  
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn', 'query'] 
      : ['error'],
  })
  
  console.log('[DB] ✅ SQLite Prisma client created successfully')
  console.log('[DB] ════════════════════════════════════════════════')
  
  return client
}

// ─── Initialize & Export ────────────────────────────────────────────
// Use cached instance in development to avoid connection leaks on hot-reload
function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV !== 'production') {
    // Development: use global singleton
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient()
    }
    return globalForPrisma.prisma
  }
  
  // Production: always create fresh client (serverless)
  return createPrismaClient()
}

export const db = getPrismaClient()

// ─── Connection Test Helper ─────────────────────────────────────────
export async function testConnection(): Promise<{
  success: boolean
  message: string
  provider: string
  details?: any
}> {
  try {
    const config = getDatabaseConfig()
    
    if (config.provider === 'turso') {
      // Direct test of libsql connection
      const testClient = createClient({
        url: config.url,
        authToken: config.authToken!,
      })
      
      const result = await testClient.execute('SELECT 1 as test')
      await testClient.close()
      
      return {
        success: true,
        message: 'Turso connection successful',
        provider: 'turso',
        details: result,
      }
    }
    
    // SQLite test
    const result = await db.$queryRaw`SELECT 1 as test`
    
    return {
      success: true,
      message: 'SQLite connection successful',
      provider: 'sqlite',
      details: result,
    }
  } catch (error: any) {
    console.error('[DB] ❌ Connection test failed:', error)
    return {
      success: false,
      message: error?.message || 'Connection failed',
      provider: getDatabaseConfig().provider,
      details: {
        code: error?.code,
        stack: error?.stack,
      },
    }
  }
}

// ─── Health Check Endpoint Helper ───────────────────────────────────
export async function healthCheck() {
  const config = getDatabaseConfig()
  const test = await testConnection()
  
  return {
    status: test.success ? 'healthy' : 'unhealthy',
    database: {
      provider: config.provider,
      url: config.provider === 'turso' 
        ? config.url.replace(new RegExp('//[^:]+:'), '//***:')  // Mask auth in logs
        : config.url,
      connected: test.success,
      error: test.success ? undefined : test.message,
    },
    timestamp: new Date().toISOString(),
  }
}
