import 'dotenv/config'
import path from "node:path";
import fs from "node:fs";
import Fastify from "fastify";
import fastifyView from "@fastify/view";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import fastifyFormbody from "@fastify/formbody";
import fastifyPostgres from "@fastify/postgres";
import fastifyRateLimit from "@fastify/rate-limit";
import handlebars from "handlebars";
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { uploadLimiter, voteLimiter, pageLimiter, apiLimiter, newsletterLimiter, newsletterActionLimiter } from "./server/middleware/rateLimiter.js";
import { validateAudio, audioValidationMiddleware } from "./server/validators/audioValidator.js";
import { setupSecurityHeaders, setupErrorHandler } from "./server/middleware/security.js";
import newsletterRoutes from "./server/newsletter/routes.js";
import { fetchEpisodeFromRSS } from "./server/services/castopodRSS.js";
import { initQueue, startWorker, queueEpisodeResolution } from "./server/queues/episodeQueue.js";
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: true });

// S3/Cellar configuration with performance optimizations
const s3Config = {
  endpoint: process.env.CELLAR_ADDON_HOST 
    ? `https://${process.env.CELLAR_ADDON_HOST}` 
    : process.env.S3_ENDPOINT || 'http://localhost:9000',
  credentials: {
    accessKeyId: process.env.CELLAR_ADDON_KEY_ID || process.env.S3_ACCESS_KEY || 'salete',
    secretAccessKey: process.env.CELLAR_ADDON_KEY_SECRET || process.env.S3_SECRET_KEY || 'salete123',
  },
  region: 'us-east-1', // Région par défaut pour Cellar
  forcePathStyle: true, // Important pour MinIO/Cellar
  // Performance optimizations for MinIO
  maxAttempts: 2, // Reduce retry attempts
  requestTimeout: 8000, // 8 second timeout
  connectTimeout: 3000, // 3 second connection timeout
  // Force signature v4 for MinIO compatibility
  signatureVersion: 'v4'
};

const s3Client = new S3Client(s3Config);
const bucketName = process.env.S3_BUCKET || 'salete-media';
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.CELLAR_ADDON_HOST;

// Ensure bucket exists
async function ensureBucketExists() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    if (!isProduction) {
      console.log(`✅ Bucket ${bucketName} already exists`);
    }
  } catch (error) {
    if (error.name === 'NotFound') {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
        if (!isProduction) {
          console.log(`✅ Bucket ${bucketName} created successfully`);
        }
      } catch (createError) {
        console.error(`❌ Failed to create bucket ${bucketName}:`, createError);
      }
    } else {
      console.error(`❌ Error checking bucket ${bucketName}:`, error);
    }
  }
}

// Initialize bucket and public policy for audio folder
await ensureBucketExists();

// Configure public read policy for /audio/ folder in development
async function ensurePublicAudioPolicy() {
  if (isProduction) return; // Don't modify production policies
  
  try {
    const { PutBucketPolicyCommand } = await import('@aws-sdk/client-s3');
    
    const policy = {
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: '*',
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${bucketName}/audio/*`
      }]
    };

    await s3Client.send(new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(policy)
    }));

    console.log(`✅ Public read policy set for ${bucketName}/audio/`);
  } catch (error) {
    console.warn(`⚠️ Could not set public policy (normal in dev):`, error.message);
  }
}

await ensurePublicAudioPolicy();

// Phase 3: Logs détaillés uniquement en dev
if (!isProduction) {
  console.log('🪣 S3/Cellar Configuration:');
  console.log('  Endpoint:', s3Config.endpoint);
  console.log('  Bucket:', bucketName);
  console.log('  Production mode:', isProduction);
  console.log('  Access Key:', s3Config.credentials.accessKeyId ? `${s3Config.credentials.accessKeyId.substring(0, 8)}...` : 'NOT SET');
}

// Database
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRESQL_ADDON_URI || 'postgresql://salete:salete@localhost:5432/salete';

if (!isProduction) {
  console.log('🔗 Available DB env vars:');
  console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  console.log('  POSTGRESQL_ADDON_URI:', process.env.POSTGRESQL_ADDON_URI ? 'SET' : 'NOT SET');
  console.log('  POSTGRESQL_ADDON_HOST:', process.env.POSTGRESQL_ADDON_HOST || 'NOT SET');
  console.log('🔗 Using Database URL:', databaseUrl.replace(/\/\/[^@]+@/, '//***:***@')); // Log sans password
}

try {
  await app.register(fastifyPostgres, {
    connectionString: databaseUrl,
    max: 1 // Une seule connexion suffit (pas de requêtes longues)
  });
  console.log('✅ Database connected successfully');
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
  console.error('💡 Make sure PostgreSQL addon is created and env vars are set');
  
  // En production, on peut vouloir continuer sans DB pour debugger
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  Running without database in production mode');
  } else {
    throw error;
  }
}

// Multipart forms
await app.register(fastifyMultipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  }
});

// Form body parser (for application/x-www-form-urlencoded)
await app.register(fastifyFormbody);

// Rate limiting
await app.register(fastifyRateLimit, {
  global: false, // Pas de limite globale, on configure par route
});

// Phase 3: Configuration de sécurité
setupSecurityHeaders(app);
setupErrorHandler(app);

// Custom 404 handler
app.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    success: false,
    message: 'Page non trouvée'
  });
});

// Register Handlebars helpers
handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

// Register Handlebars partials manually
const headerPartial = fs.readFileSync(
  path.join(__dirname, "server/views/partials/header.hbs"),
  "utf-8"
);
handlebars.registerPartial('header', headerPartial);

// Views (Handlebars)
await app.register(fastifyView, {
  engine: { handlebars },
  root: path.join(__dirname, "server/views")
});

// Static files (CSS, JS, images)
app.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/"
});

// Audio files (only in development - in production they're served from S3)
if (!isProduction) {
  app.register(fastifyStatic, {
    root: path.join(__dirname, "uploads"),
    prefix: "/audio/",
    decorateReply: false
  });
}

// Newsletter Routes
await app.register(newsletterRoutes, { prefix: '/newsletter' });

// API Routes
// Create new post (avec rate limiting)
app.post("/api/posts", {
  config: {
    rateLimit: uploadLimiter
  }
}, async (req, reply) => {
  if (!isProduction) {
    console.log('📥 POST /api/posts - Starting request processing');
  }
  
  try {
    if (!isProduction) {
      console.log('📋 Parsing multipart form data...');
    }
    
    const parts = req.parts();
    const data = {};
    let audioFile = null;
    
    try {
      if (!isProduction) {
        console.log('⏳ Starting multipart parsing...');
      }
      
      let partCount = 0;
      const maxParts = 10; // Safety limit
      
      for await (const part of parts) {
        partCount++;
        
        if (!isProduction) {
          console.log(`🔍 Processing part ${partCount}:`, part.fieldname, 'type:', part.type);
        }
        
        if (part.type === 'file') {
          // Handle audio file
          if (part.fieldname === 'audio') {
            if (!isProduction) {
              console.log('🎵 Audio file found:', part.filename, 'mimetype:', part.mimetype);
            }
            // Convert to buffer immediately to consume the stream and allow parsing to continue
            if (!isProduction) {
              console.log('🔄 Converting audio to buffer to consume stream...');
            }
            const audioBuffer = await part.toBuffer();
            // Store both the buffer and metadata
            audioFile = {
              buffer: audioBuffer,
              filename: part.filename,
              mimetype: part.mimetype
            };
            if (!isProduction) {
              console.log('✅ Audio stream consumed, buffer size:', audioBuffer.length);
            }
          }
        } else {
          // Handle text fields
          data[part.fieldname] = part.value;
          if (!isProduction) {
            console.log(`📝 Form field ${part.fieldname}:`, part.value);
          }
        }
        
        if (!isProduction) {
          console.log('✅ Part processed:', part.fieldname);
          console.log('📊 Current data so far:', Object.keys(data));
        }
        
        // Safety break to avoid infinite loops
        if (partCount >= maxParts) {
          if (!isProduction) {
            console.log('⚠️ Reached maximum parts limit, breaking');
          }
          break;
        }
      }
      
      if (!isProduction) {
        console.log('🎊 Finished processing multipart data');
        console.log('📋 Final data fields:', Object.keys(data));
        console.log('📋 Final data values:', data);
        console.log('📁 Audio file present:', !!audioFile);
      }
    } catch (parsingError) {
      if (!isProduction) {
        console.error('❌ Error during multipart parsing:', parsingError);
        console.error('  Error message:', parsingError.message);
        console.error('  Error stack:', parsingError.stack);
      }
      throw parsingError;
    }
    
    if (!isProduction) {
      console.log('✅ Form parsing completed');
    }
    
    // Validate required fields
    if (!isProduction) {
      console.log('🔍 Validating required fields...');
    }
    
    if (!data.title || !data.transcription || !data.badge || !audioFile) {
      if (!isProduction) {
        console.log('❌ Missing fields:', { 
          title: !!data.title, 
          transcription: !!data.transcription, 
          badge: !!data.badge, 
          audioFile: !!audioFile 
        });
      }
      return reply.code(400).send({
        success: false,
        message: 'Informations manquantes'
      });
    }
    
    if (!isProduction) {
      console.log('✅ All required fields present');
    }
    
    // Validate badge value
    if (!['wafer', 'charbon'].includes(data.badge)) {
      return reply.code(400).send({
        success: false,
        message: 'Données invalides'
      });
    }
    
    // Generate unique filename
    if (!isProduction) {
      console.log('🏷️ Generating filename...');
    }
    
    const timestamp = Date.now();
    const filename = `audio_${timestamp}.webm`;
    
    if (!isProduction) {
      console.log('📁 Generated filename:', filename);
    }
    
    const buffer = audioFile.buffer;
    
    if (!isProduction) {
      console.log('✅ Using pre-converted buffer, size:', buffer.length, 'bytes');
    }
    
    // Phase 2: Validate audio with new validator
    if (!isProduction) {
      console.log('🎧 Starting audio validation...');
    }
    
    const recordingDuration = data.duration ? parseInt(data.duration) : null;
    
    if (!isProduction) {
      console.log('⏱️ Recording duration from form:', recordingDuration);
    }
    
    const validation = validateAudio(buffer, audioFile.mimetype, recordingDuration);
    
    if (!validation.isValid) {
      if (!isProduction) {
        console.log('❌ Audio validation failed:', validation);
      }
      return reply.code(400).send({
        success: false,
        message: 'Enregistrement audio invalide'
      });
    }
    
    // Phase 3: Supprimer les logs détaillés en production
    if (!isProduction) {
      console.log(`✅ Audio validation passed: ${validation.validatedData.duration}ms, ${validation.validatedData.size} bytes`);
    }
    
    let audioUrl = null;
    
    // Always use MinIO/S3 storage (both dev and production)
    if (!isProduction) {
      console.log('🚀 Starting MinIO upload process...');
    }
    
    try {
      const s3Key = `audio/${filename}`;
      
      if (!isProduction) {
        console.log('🔄 Starting MinIO upload...');
        console.log('  S3 Key:', s3Key);
        console.log('  Buffer size:', buffer.length);
        console.log('  Endpoint:', s3Config.endpoint);
        console.log('  Bucket:', bucketName);
        console.log('  Access Key:', s3Config.credentials.accessKeyId);
        console.log('📦 Creating PutObjectCommand...');
      }
      
      const uploadCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: 'audio/webm'
        // Removed ACL for better performance and MinIO compatibility
      });
      
      if (!isProduction) {
        console.log('✅ PutObjectCommand created successfully');
        console.log('⏳ Sending command to S3 client...');
      }
      
      // Performance optimization: upload with timeout
      const uploadPromise = s3Client.send(uploadCommand);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Upload timeout')), 10000) // 10s timeout
      );
      
      if (!isProduction) {
        console.log('🔄 Waiting for upload or timeout (10s)...');
      }
      
      await Promise.race([uploadPromise, timeoutPromise]);
      
      if (!isProduction) {
        console.log('🎉 Upload completed successfully!');
      }
      
      // Generate public URL for MinIO
      if (!isProduction) {
        console.log('🔗 Generating public URL...');
      }
      
      if (isProduction) {
        audioUrl = `${s3Config.endpoint}/${bucketName}/${s3Key}`;
      } else {
        // In development, use localhost MinIO URL
        audioUrl = `http://localhost:9000/${bucketName}/${s3Key}`;
      }
      
      if (!isProduction) {
        console.log('✅ Audio uploaded to MinIO:', audioUrl);
      }
      
    } catch (s3Error) {
      console.error('❌ MinIO upload failed:', s3Error);
      if (!isProduction) {
        console.error('  Error details:', s3Error.message);
        console.error('  Error name:', s3Error.name);
        console.error('  Error code:', s3Error.code);
        console.error('  Error stack:', s3Error.stack);
        console.error('  Full error object:', JSON.stringify(s3Error, null, 2));
      }
      return reply.code(500).send({
        success: false,
        message: 'Erreur lors de l\'upload vers MinIO'
      });
    }
    
    // Save to database
    if (!isProduction) {
      console.log('💾 Starting database save...');
    }
    const client = await app.pg.connect();
    try {
      if (!isProduction) {
        console.log('📝 Inserting post into database...');
      }
      
      const result = await client.query(
        `INSERT INTO posts (title, transcription, badge, audio_filename, audio_url, duration_seconds, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
         RETURNING id, created_at`,
        [data.title, data.transcription, data.badge, filename, audioUrl, Math.floor(validation.validatedData.duration / 1000)]
      );
      
      if (!isProduction) {
        console.log('✅ Post saved to database with ID:', result.rows[0].id);
      }
      
      reply.send({
        success: true,
        message: 'Post créé avec succès',
        data: {
          id: result.rows[0].id,
          created_at: result.rows[0].created_at
        }
      });
      
      if (!isProduction) {
        console.log('🎉 POST /api/posts completed successfully!');
      }
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('💥 Fatal error in POST /api/posts:', error);
    if (!isProduction) {
      console.error('  Error message:', error.message);
      console.error('  Error stack:', error.stack);
    }
    app.log.error(error);
    reply.code(500).send({
      success: false,
      message: 'Erreur serveur lors de la création du post'
    });
  }
});

// Vote for a post (avec rate limiting)
app.post("/api/posts/:id/vote", {
  config: {
    rateLimit: voteLimiter
  }
}, async (req, reply) => {
  try {
    const postId = req.params.id;
    const voterHash = req.headers['x-forwarded-for'] || req.ip || 'anonymous';
    
    const client = await app.pg.connect();
    try {
      // Check if user already voted
      const existingVote = await client.query(
        'SELECT id FROM votes WHERE post_id = $1 AND voter_hash = $2',
        [postId, voterHash]
      );
      
      if (existingVote.rows.length > 0) {
        return reply.code(400).send({
          success: false,
          message: 'Déjà voté'
        });
      }
      
      // Add vote
      await client.query(
        'INSERT INTO votes (post_id, voter_hash, created_at) VALUES ($1, $2, NOW())',
        [postId, voterHash]
      );
      
      // Get updated vote count
      const voteResult = await client.query(
        'SELECT COUNT(*) as vote_count FROM votes WHERE post_id = $1',
        [postId]
      );
      
      reply.send({
        success: true,
        message: 'Vote ajouté',
        data: {
          votes: parseInt(voteResult.rows[0].vote_count)
        }
      });
    } finally {
      client.release();
    }
    
  } catch (error) {
    // L'error handler global va s'en occuper
    throw error;
  }
});

// Route home (avec rate limiting)
app.get("/", {
  config: {
    rateLimit: pageLimiter
  }
}, async (req, reply) => {
  try {
    const client = await app.pg.connect();
    try {
      // Get posts with vote counts
      const result = await client.query(`
        SELECT 
          p.id,
          p.title,
          p.transcription,
          p.badge,
          p.audio_filename,
          p.audio_url,
          p.duration_seconds,
          p.created_at,
          COALESCE(v.vote_count, 0) as votes,
          EXTRACT(EPOCH FROM (NOW() - p.created_at)) as age_seconds
        FROM posts p
        LEFT JOIN (
          SELECT post_id, COUNT(*) as vote_count
          FROM votes
          GROUP BY post_id
        ) v ON p.id = v.post_id
        WHERE p.status = 'published'
        ORDER BY p.created_at DESC
        LIMIT 20
      `);
      
      const posts = result.rows.map(post => ({
        ...post,
        // Use real duration from database
        duration: formatDuration(post.duration_seconds),
        // Format creation time
        timeAgo: formatTimeAgo(post.age_seconds)
      }));
      
      // Calculate total stats
      const statsResult = await client.query(`
        SELECT 
          COUNT(*) as total_posts,
          SUM(COALESCE(v.vote_count, 0)) as total_listens
        FROM posts p
        LEFT JOIN (
          SELECT post_id, COUNT(*) as vote_count
          FROM votes
          GROUP BY post_id
        ) v ON p.id = v.post_id
        WHERE p.status = 'published'
      `);
      
      const stats = statsResult.rows[0];
      
      return reply.view("index.hbs", { 
        title: "Saleté Sincère",
        isPodcastBanner: true,
        posts,
        stats: {
          total_posts: stats.total_posts || 0,
          total_listens: stats.total_listens || 0
        }
      });
      
    } finally {
      client.release();
    }
  } catch (error) {
    app.log.error(error);
    return reply.view("index.hbs", { 
      title: "Saleté Sincère",
      isPodcastBanner: true,
      posts: [],
      stats: { total_posts: 0, total_listens: 0 }
    });
  }
});

// Helper function to format time ago
function formatTimeAgo(seconds) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `il y a ${days} jour${days > 1 ? 's' : ''}`;
  if (hours > 0) return `il y a ${hours} heure${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
  return 'à l\'instant';
}

// Helper function to format duration
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Route manifeste (avec rate limiting)
app.get("/manifeste", {
  config: {
    rateLimit: pageLimiter
  }
}, (req, reply) =>
  reply.view("manifeste.hbs", { title: "Manifeste" })
);

// Route podcast générale (liens show)
app.get("/podcast", {
  config: {
    rateLimit: pageLimiter
  }
}, async (req, reply) => {
  // Redirect old query params to new path-based route
  const { season, episode } = req.query;
  if (season && episode) {
    return reply.code(301).redirect(`/podcast/${season}/${episode}`);
  }
  
  reply.header('Cache-Control', 'public, max-age=3600');
  return reply.view("podcast.hbs", { episodeData: null });
});

/**
 * Vérifie si l'OG Image doit être régénérée (ADR-0012)
 * 
 * @param {string|null} ogImageUrl - URL actuelle de l'OG Image
 * @param {string|null} cachedFeedLastBuild - feed_last_build en BDD
 * @param {string|null} generatedAt - Timestamp génération OG Image
 * @param {string|Date} rssFeedLastBuildDate - lastBuildDate du RSS
 * @returns {boolean} true si OG Image doit être régénérée
 */
function checkOGImageNeeds(ogImageUrl, cachedFeedLastBuild, generatedAt, rssFeedLastBuildDate) {
  // Condition 1: Pas d'OG Image → doit générer
  if (!ogImageUrl) return true;
  
  // Condition 2: RSS lastBuildDate a changé → doit régénérer
  if (cachedFeedLastBuild && rssFeedLastBuildDate) {
    const cachedDate = new Date(cachedFeedLastBuild);
    const rssDate = new Date(rssFeedLastBuildDate);
    
    if (rssDate > cachedDate) {
      return true; // RSS plus récent que cache
    }
  }
  
  // Condition 3: OG Image > 7 jours (fallback staleness)
  if (generatedAt) {
    const daysSinceGeneration = (Date.now() - new Date(generatedAt)) / (1000 * 60 * 60 * 24);
    if (daysSinceGeneration > 7) {
      return true; // Image trop ancienne
    }
  }
  
  // Sinon, OG Image up-to-date
  return false;
}

// Route smartlink multiplateforme /podcast/:season/:episode (ADR-0011)
app.get("/podcast/:season/:episode", {
  config: {
    rateLimit: pageLimiter
  }
}, async (req, reply) => {
  const season = parseInt(req.params.season, 10);
  const episode = parseInt(req.params.episode, 10);
  
  // Validation
  if (isNaN(season) || isNaN(episode) || season < 1 || episode < 1) {
    return reply.redirect('/podcast');
  }
  
  // 1. Fetch episode metadata from RSS
  const episodeData = await fetchEpisodeFromRSS(season, episode, 5000).catch(() => null);
  
  if (!episodeData) {
    return reply.redirect('/podcast'); // Épisode introuvable
  }
  
  // 2. Check cache BDD (episode_links) pour liens plateformes + OG Image
  const client = await app.pg.connect();
  let platformLinks = null;
  let shouldQueueJob = false;
  
  try {
    const cacheResult = await client.query(
      `SELECT spotify_url, apple_url, deezer_url, podcast_addict_url,
              og_image_url, feed_last_build, generated_at 
       FROM episode_links WHERE season = $1 AND episode = $2`,
      [season, episode]
    );
    
    if (cacheResult.rows.length > 0) {
      platformLinks = cacheResult.rows[0];
      
      // Check si OG Image doit être régénérée (ADR-0012)
      const needsOGRegeneration = checkOGImageNeeds(
        platformLinks.og_image_url,
        platformLinks.feed_last_build,
        platformLinks.generated_at,
        episodeData.feedLastBuildDate
      );
      
      // Queue job si liens manquants OU OG Image manquante/obsolète
      shouldQueueJob = !platformLinks.spotify_url || needsOGRegeneration;
    } else {
      // Pas de cache du tout → queue job
      shouldQueueJob = true;
    }
  } finally {
    client.release();
  }
  
  // 3. Si pas en cache OU OG Image obsolète, queue job pour résolution asynchrone
  if (shouldQueueJob) {
    await queueEpisodeResolution(
      season, 
      episode, 
      episodeData.rawPubDate, 
      episodeData.title, 
      episodeData.image,
      episodeData.feedLastBuildDate, // Cache invalidation OG
      episodeData.audioUrl // Podcast Addict deeplink
    );
  }
  
  // 4. Render page avec données épisode + liens plateformes (ou null si pas encore résolus)
  reply.header('Cache-Control', 'public, max-age=3600');
  return reply.view("podcast.hbs", { 
    episodeData: {
      ...episodeData,
      season,
      episode
    },
    platformLinks 
  });
});

// Health
app.get("/health", () => ({ ok: true }));

// Initialize pg-boss queue and worker before starting server
// Fail-hard par défaut : Si worker échoue, déploiement bloqué (sécurité)
// Bypass explicite : ALLOW_DEGRADED_MODE=true pour autoriser mode dégradé
// CleverCloud : Utiliser DATABASE_URL OU POSTGRESQL_ADDON_URI (comme fastify-postgres)
const hasDatabase = !!(process.env.DATABASE_URL || process.env.POSTGRESQL_ADDON_URI);
const WORKER_ENABLED = process.env.DISABLE_WORKER !== 'true' && hasDatabase;
const ALLOW_DEGRADED = process.env.ALLOW_DEGRADED_MODE === 'true';

if (WORKER_ENABLED) {
  try {
    console.log('🚀 Initializing pg-boss queue...');
    console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✓ defined' : '✗ missing');
    console.log('   POSTGRESQL_ADDON_URI:', process.env.POSTGRESQL_ADDON_URI ? '✓ defined' : '✗ missing');
    
    await initQueue();
    console.log('✅ pg-boss queue initialized');
    
    console.log('🚀 Starting episode resolution worker...');
    await startWorker(app);
    console.log('✅ Worker started and ready to process jobs');
  } catch (err) {
    console.error('❌ Worker initialization failed:', err.message);
    console.error('   Stack:', err.stack);
    
    if (ALLOW_DEGRADED) {
      console.warn('⚠️  ALLOW_DEGRADED_MODE=true: Starting in degraded mode');
      console.warn('   Server will run WITHOUT background job processing');
      console.warn('   Episode resolution will be synchronous (slower)');
    } else {
      console.error('💥 Deployment BLOCKED: Worker initialization failed');
      console.error('   To bypass this check (not recommended), set: ALLOW_DEGRADED_MODE=true');
      console.error('   Or disable worker entirely with: DISABLE_WORKER=true');
      process.exit(1); // Fail-hard : CleverCloud garde la version précédente
    }
  }
} else {
  const reason = process.env.DISABLE_WORKER === 'true' 
    ? 'DISABLE_WORKER=true' 
    : 'No database connection (DATABASE_URL or POSTGRESQL_ADDON_URI missing)';
  console.log(`⚠️  Worker disabled (${reason})`);
  console.log('   Episode resolution will be synchronous (slower)');
}

await app.listen({ host: "0.0.0.0", port: process.env.PORT || 3000 });

// Graceful shutdown pour déploiements CleverCloud
// Libère les connexions DB rapidement quand SIGTERM reçu
const gracefulShutdown = async (signal) => {
  console.log(`\n📡 ${signal} received, closing gracefully...`);
  
  try {
    // 1. Arrêter d'accepter nouvelles requêtes
    await app.close();
    console.log('✅ HTTP server closed');
    
    // 2. Arrêter le worker pg-boss (si actif)
    if (boss) {
      await boss.stop();
      console.log('✅ Worker stopped');
    }
    
    // 3. Fermer pool PostgreSQL (fastify-postgres le fait automatiquement)
    console.log('✅ Database connections released');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
