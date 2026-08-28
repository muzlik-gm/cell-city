import { PrismaClient } from '@prisma/client'
import path from 'path'

/**
 * ═══════════════════════════════════════════════════════════
 * DATABASE CLIENT - Turso (Production) / SQLite (Development)
 * ═══════════════════════════════════════════════════════════
 * 
 * PRODUCTION: Uses Turso/libSQL remote database
 *   → Requires: TURSO_DATABASE_URL + TURSO_AUTH_TOKEN env vars
 *
 * DEVELOPMENT: Uses SQLite local database  
 *   → Requires: DATABASE_URL or defaults to ./prisma/dev.db
 * 
 * ⚠️ Vercel CANNOT use local SQLite (read-only filesystem)
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
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
  
  console.log('[DB] Environment:', {
    nodeEnv: process.env.NODE_ENV,
    hasTursoUrl: !!tursoUrl,
    hasTursoAuth: !!tursoAuthToken,
    tursoUrlPreview: tursoUrl ? `${tursoUrl.substring(0, 40)}...` : null,
    localDbUrl: getLocalDatabaseUrl()
  });
  
  // ─── Use Turso if BOTH variables are set ─────────────────
  if (tursoUrl && tursoAuthToken) {
    console.log(`[DB] Initializing Turso client for: ${tursoUrl}`);
    
    try {
      // Import Turso packages dynamically
      const { createClient } = await import('@libsql/client') as any;
      const { PrismaLibSQL } = await import('@prisma/adapter-libsql') as any;
      
      console.log('[DB] Turso packages imported successfully');
      
      // Create libsql client with EXPLICIT url parameter
      const libsql = createClient({
        url: tursoUrl,  // Must be explicit!
        authToken: tursoAuthToken,
      });
      
      console.log('[DB] libsql client created');
      
      // Create Prisma adapter
      const adapter = new PrismaLibSQL(libsql);
      
      console.log('[DB] PrismaLibSQL adapter created');
      
      // Create and return Prisma client with adapter
      const client = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' 
          ? ['query', 'error', 'warn'] 
          : ['error', 'warn'],
      });
      
      console.log('[DB] ✅ Turso Prisma client created successfully');
      return client;
      
    } catch (error) {
      console.error('[DB] ❌ Failed to initialize Turso:', error);
      console.warn('[DB] Falling back to SQLite...');
      // Don't throw - fall through to SQLite
    }
  }
  
  // ─── Fallback to SQLite ──────────────────────────────────
  if (tursoUrl && !tursoAuthToken) {
    console.warn('[DB] ⚠️ TURSO_DATABASE_URL set but TURSO_AUTH_TOKEN is missing!');
  }
  
  if (!tursoUrl && process.env.NODE_ENV === 'production') {
    console.warn('[DB] ⚠️ No TURSO_DATABASE_URL in production! Using SQLite.');
  }
  
  const dbUrl = getLocalDatabaseUrl();
  console.log(`[DB] Using SQLite: ${dbUrl}`);
  
  return new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error', 'warn'],
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
    await db.$queryRaw`SELECT 1 as test`;
    return {
      success: true,
      message: 'Database connection successful',
      provider: process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN ? 'Turso' : 'SQLite',
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Connection failed',
      code: error?.code,
    };
  }
}
