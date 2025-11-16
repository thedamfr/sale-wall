/**
 * Test helper to build Fastify app instance.
 * 
 * Imports the real buildApp() function from server.js, ensuring tests
 * run against the actual production code (not duplicated test code).
 * 
 * The server.js file exports buildApp() but only starts listening when
 * executed directly, allowing tests to import without side effects.
 * 
 * ⚠️ DISABLE_WORKER=true prevents episodeQueue worker from starting
 * in buildApp() - tests that need the worker start it explicitly.
 */
export async function build() {
  // Désactiver worker pg-boss pour les tests (sauf episodeQueue.test.js qui le gère)
  process.env.DISABLE_WORKER = 'true';
  
  const { buildApp } = await import('../../server.js');
  return buildApp();
}
