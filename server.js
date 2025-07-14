import 'dotenv/config'
import path from "node:path";
import fs from "node:fs";
import Fastify from "fastify";
import fastifyView from "@fastify/view";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import fastifyPostgres from "@fastify/postgres";
import fastifyRateLimit from "@fastify/rate-limit";
import pug from "pug";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { uploadLimiter, voteLimiter, pageLimiter, apiLimiter } from "./middleware/rateLimiter.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const app = Fastify({ logger: true });

// S3/Cellar configuration
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
};

const s3Client = new S3Client(s3Config);
const bucketName = process.env.S3_BUCKET || 'salete-media';
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.CELLAR_ADDON_HOST;

console.log('🪣 S3/Cellar Configuration:');
console.log('  Endpoint:', s3Config.endpoint);
console.log('  Bucket:', bucketName);
console.log('  Production mode:', isProduction);
console.log('  Access Key:', s3Config.credentials.accessKeyId ? `${s3Config.credentials.accessKeyId.substring(0, 8)}...` : 'NOT SET');

// Database
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRESQL_ADDON_URI || 'postgresql://salete:salete@localhost:5432/salete';
console.log('🔗 Available DB env vars:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('  POSTGRESQL_ADDON_URI:', process.env.POSTGRESQL_ADDON_URI ? 'SET' : 'NOT SET');
console.log('  POSTGRESQL_ADDON_HOST:', process.env.POSTGRESQL_ADDON_HOST || 'NOT SET');
console.log('🔗 Using Database URL:', databaseUrl.replace(/\/\/[^@]+@/, '//***:***@')); // Log sans password

try {
  await app.register(fastifyPostgres, {
    connectionString: databaseUrl
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

// Rate limiting
await app.register(fastifyRateLimit, {
  global: false, // Pas de limite globale, on configure par route
});

// Views (Pug)
await app.register(fastifyView, {
  engine: { pug },
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

// API Routes
// Create new post (avec rate limiting)
app.post("/api/posts", {
  config: {
    rateLimit: uploadLimiter
  }
}, async (req, reply) => {
  try {
    const parts = req.parts();
    const data = {};
    let audioFile = null;
    
    for await (const part of parts) {
      if (part.type === 'file') {
        // Handle audio file
        if (part.fieldname === 'audio') {
          audioFile = part;
        }
      } else {
        // Handle text fields
        data[part.fieldname] = part.value;
      }
    }
    
    // Validate required fields
    if (!data.title || !data.transcription || !data.badge || !audioFile) {
      return reply.code(400).send({
        success: false,
        message: 'Tous les champs sont obligatoires (titre, transcription, badge, audio)'
      });
    }
    
    // Validate badge value
    if (!['wafer', 'charbon'].includes(data.badge)) {
      return reply.code(400).send({
        success: false,
        message: 'Badge invalide'
      });
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `audio_${timestamp}.webm`;
    const buffer = await audioFile.toBuffer();
    
    let audioPath = null;
    let audioUrl = null;
    
    if (isProduction) {
      // Upload to S3/Cellar in production
      try {
        const s3Key = `audio/${filename}`;
        const uploadCommand = new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: buffer,
          ContentType: 'audio/webm',
          ACL: 'public-read'
        });
        
        await s3Client.send(uploadCommand);
        audioUrl = `${s3Config.endpoint}/${bucketName}/${s3Key}`;
        console.log('✅ Audio uploaded to S3:', audioUrl);
        
      } catch (s3Error) {
        console.error('❌ S3 upload failed:', s3Error);
        return reply.code(500).send({
          success: false,
          message: 'Erreur lors de l\'upload du fichier audio'
        });
      }
    } else {
      // Save locally in development
      const uploadsDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      audioPath = path.join(__dirname, 'uploads', filename);
      fs.writeFileSync(audioPath, buffer);
      audioUrl = `/audio/${filename}`;
    }
    
    // Save to database
    const client = await app.pg.connect();
    try {
      const result = await client.query(
        `INSERT INTO posts (title, transcription, badge, audio_filename, audio_path, audio_url, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
         RETURNING id, created_at`,
        [data.title, data.transcription, data.badge, filename, audioPath, audioUrl]
      );
      
      reply.send({
        success: true,
        message: 'Post créé avec succès',
        data: {
          id: result.rows[0].id,
          created_at: result.rows[0].created_at
        }
      });
    } finally {
      client.release();
    }
    
  } catch (error) {
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
          message: 'Vous avez déjà voté pour ce post'
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
        message: 'Vote ajouté avec succès',
        data: {
          votes: parseInt(voteResult.rows[0].vote_count)
        }
      });
    } finally {
      client.release();
    }
    
  } catch (error) {
    app.log.error(error);
    reply.code(500).send({
      success: false,
      message: 'Erreur serveur lors du vote'
    });
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
        // Calculate duration placeholder (we'll implement real duration later)
        duration: `0:${Math.floor(Math.random() * 50) + 10}`,
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
      
      return reply.view("index.pug", { 
        title: "Saleté Sincère",
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
    return reply.view("index.pug", { 
      title: "Saleté Sincère",
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

// Route manifeste (avec rate limiting)
app.get("/manifeste", {
  config: {
    rateLimit: pageLimiter
  }
}, (req, reply) =>
  reply.view("manifeste.pug", { title: "Manifeste" })
);

// Health
app.get("/health", () => ({ ok: true }));

await app.listen({ host: "0.0.0.0", port: process.env.PORT || 3000 });
