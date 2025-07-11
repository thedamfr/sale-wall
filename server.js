import 'dotenv/config'
import path from "node:path";
import fs from "node:fs";
import Fastify from "fastify";
import fastifyView from "@fastify/view";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import fastifyPostgres from "@fastify/postgres";
import pug from "pug";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const app = Fastify({ logger: true });

// Database
await app.register(fastifyPostgres, {
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/salewall_dev'
});

// Multipart forms
await app.register(fastifyMultipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  }
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

// Audio files
app.register(fastifyStatic, {
  root: path.join(__dirname, "uploads"),
  prefix: "/audio/",
  decorateReply: false
});

// API Routes
// Create new post
app.post("/api/posts", async (req, reply) => {
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
    const audioPath = path.join(__dirname, 'uploads', filename);
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Save audio file
    const buffer = await audioFile.toBuffer();
    fs.writeFileSync(audioPath, buffer);
    
    // Save to database
    const client = await app.pg.connect();
    try {
      const result = await client.query(
        `INSERT INTO posts (title, transcription, badge, audio_filename, audio_path, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING id, created_at`,
        [data.title, data.transcription, data.badge, filename, audioPath]
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

// Vote for a post
app.post("/api/posts/:id/vote", async (req, reply) => {
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

// Route home
app.get("/", async (req, reply) => {
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

// Route manifeste
app.get("/manifeste", (req, reply) =>
  reply.view("manifeste.pug", { title: "Manifeste" })
);

// Health
app.get("/health", () => ({ ok: true }));

await app.listen({ host: "0.0.0.0", port: process.env.PORT || 3000 });
