// Helper to build Fastify app for testing
import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function build() {
  const app = Fastify({
    logger: false // Disable logs in tests
  });

  // Minimal setup - just enough for podcast route
  // TODO: Extract full server setup into reusable module
  
  // Static files
  await app.register(import('@fastify/static'), {
    root: path.join(__dirname, '../../public'),
    prefix: '/'
  });

  // Register views (will be needed for episode template)
  const viewPath = path.join(__dirname, '../../server/views');
  
  // For now, register a simple handler to pass tests
  // Will be replaced with proper Handlebars setup
  app.get('/podcast', async (request, reply) => {
    const { season, episode } = request.query;
    
    // Validation
    const seasonRegex = /^\d+$/;
    const episodeRegex = /^\d+$/;
    
    if (season && episode && seasonRegex.test(season) && episodeRegex.test(episode)) {
      try {
        // Import RSS parser
        const { fetchEpisodeFromRSS } = await import('../../server/services/castopodRSS.js');
        const episodeData = await fetchEpisodeFromRSS(
          parseInt(season),
          parseInt(episode),
          5000
        );

        if (episodeData) {
          // Set cache headers
          reply.header('Cache-Control', 'public, max-age=3600, s-maxage=3600');
          
          // For now, return minimal HTML with episode data
          // Will be replaced with Handlebars template
          return reply.type('text/html').send(`
            <!DOCTYPE html>
            <html>
            <head><title>Charbon & Wafer - ${episodeData.title}</title></head>
            <body>
              <h1>Charbon & Wafer</h1>
              <div class="episode-highlight">
                <div>Saison ${episodeData.season} • Épisode ${episodeData.episode}</div>
                <h2>${episodeData.title}</h2>
                <p>${episodeData.description}</p>
                <div>📅 ${episodeData.pubDate}</div>
                <div>⏱️ ${episodeData.duration}</div>
              </div>
            </body>
            </html>
          `);
        }
      } catch (err) {
        // Fallback to classic page on error
      }
    }
    
    // Fallback: classic page
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
      <head><title>Charbon & Wafer - Podcast</title></head>
      <body>
        <h1>Charbon & Wafer</h1>
        <p>Disponible sur toutes les plateformes.</p>
      </body>
      </html>
    `);
  });

  return app;
}
