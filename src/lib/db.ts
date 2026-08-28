import { PrismaClient } from '@prisma/client'
import path from 'path'

/**
 * ═══════════════════════════════════════════════════════════
 * DATABASE CLIENT - Turso (Production) / SQLite (Development)
 * ═══════════════════════════════════════════════════════════
 * 
 * PRODUCTION: Uses Turso/libSQL remote database via adapter
 * DEVELOPMENT: Uses SQLite local database
 * 
 * ⚠️ CRITICAL: When using Turso adapter, do NOT pass datasources option!
 *    Prisma schema still needs DATABASE_URL but adapter overrides connection.
 * ═══════════════════════════════════════════════════════════
 */

// ─── Global Singleton Pattern ──────────────────────────────
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Get local database URL with fallback
function getLocalDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes('/home/z/my-project/db/')) {
    return `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`;
  }
  return url;
}

// Create appropriate Prisma client based on environment
async function createPrismaClient(): Promise<PrismaClient> {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN?.trim();
  
  console.log('[DB] Initializing database client...');
  console.log('[DB] Environment:', {
    nodeEnv: process.env.NODE_ENV,
    hasTursoUrl: !!tursoUrl,
    tursoUrlLength: tursoUrl?.length || 0,
    hasTursoAuth: !!tursoAuthToken,
    authLength: tursoAuthToken?.length || 0,
  });
  
  // ─── Use Turso if BOTH variables are set and valid ──────────
  if (tursoUrl && tursoAuthToken && tursoUrl.startsWith('libsql://')) {
    console.log(`[DB] ✅ Using Turso: ${tursoUrl.substring(0, 50)}...`);
    
    try {
      // Import Turso packages dynamically
      const libsqlModule = await import('@libsql/client');
      const prismaAdapterModule = await import('@prisma/adapter-libsql');
      
      const { createClient } = libsqlModule as any;
      const { PrismaLibSQL } = prismaAdapterModule as any;
      
      if (!createClient || !PrismaLibSQL) {
        throw new Error('Failed to load Turso packages');
      }
      
      // Create libsql client FIRST
      const libsql = createClient({
        url: tursoUrl,
        authToken: tursoAuthToken,
      });
      
      // Test the connection immediately
      console.log('[DB] Testing Turso connection...');
      try {
        await libsql.execute('SELECT 1');
        console.log('[DB] ✅ Turso connection test successful');
      } catch (testError) {
        console.error('[DB] ❌ Turso connection test failed:', testError);
        throw testError;
      }
      
      // Create adapter from working client
      const adapter = new PrismaLibSQL(libsql);
      
      // Create PrismaClient WITH adapter but WITHOUT datasource override
      // This is critical - adapter handles all connections
      const client = new PrismaClient({
        adapter,
        log: ['error', 'warn', 'query'],
      });
      
      console.log('[DB] ✅ Turso Prisma client ready');
      return client;
      
    } catch (error) {
      console.error('[DB] ❌ Turso initialization failed:', error);
      console.warn('[DB] Falling back to SQLite...');
      // Continue to fallback below
    }
  } else {
    if (tursoUrl && !tursoAuthToken) {
      console.warn('[DB] ⚠️ TURSO_DATABASE_URL set but TURSO_AUTH_TOKEN missing!');
    } else if (!tursoUrl) {
      console.log('[DB] No Turso configuration, using SQLite');
    } else {
      console.warn('[DB] ⚠️ Invalid TURSO_DATABASE_URL format (must start with libsql://)');
    }
  }
  
  // ─── Fallback to SQLite ──────────────────────────────────
  const dbUrl = getLocalDatabaseUrl();
  
  // IMPORTANT: Set DATABASE_URL so Prisma schema validation passes
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('file:')) {
    process.env.DATABASE_URL = dbUrl;
  }
  
  console.log(`[DB] Using SQLite: ${dbUrl}`);
  
  return new PrismaClient({
    log: ['error', 'warn', 'query'],
  });
}

// Initialize and export the database client
export const db = await createPrismaClient();

// Cache in development to avoid multiple connections during hot-reload
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

// Test connection helper
export async function testConnection() {
  try {
    const result = await db.$queryRaw`SELECT 1 as test`;
    return {
      success: true,
      message: 'Database connection successful',
      provider: process.env.TURSO_DATABASE_URL?.startsWith('libsql://') ? 'Turso' : 'SQLite',
      result,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Connection failed',
      code: error?.code,
      stack: error?.stack,
    };
  }
}
