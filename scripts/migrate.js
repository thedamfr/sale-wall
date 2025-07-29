#!/usr/bin/env node
import 'dotenv/config'
import path from "node:path";
import fs from "node:fs";
import pg from "pg";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Configuration base de données
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRESQL_ADDON_URI || 'postgresql://salete:salete@localhost:5432/salete';

// Table pour tracker les migrations
const MIGRATIONS_TABLE = 'schema_migrations';

// Créer le client PostgreSQL
const client = new pg.Client({
  connectionString: databaseUrl
});

async function runMigrations() {
  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    
    // Créer la table de migrations si elle n'existe pas
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log('📋 Checking for migrations to apply...');
    
    // Lire tous les fichiers de migration
    const sqlDir = path.join(__dirname, '..', 'sql');
    const migrationFiles = fs.readdirSync(sqlDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Important : ordre alphabétique
    
    console.log(`📁 Found ${migrationFiles.length} migration files:`, migrationFiles);
    
    for (const file of migrationFiles) {
      const version = file.replace('.sql', '');
      
      // Vérifier si cette migration a déjà été appliquée
      const { rows } = await client.query(
        `SELECT version FROM ${MIGRATIONS_TABLE} WHERE version = $1`,
        [version]
      );
      
      if (rows.length > 0) {
        console.log(`⏭️  Migration ${version} already applied, skipping`);
        continue;
      }
      
      console.log(`🚀 Applying migration: ${version}`);
      
      // Lire et exécuter le fichier SQL
      const sqlPath = path.join(sqlDir, file);
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');
      
      try {
        // Exécuter la migration dans une transaction
        await client.query('BEGIN');
        
        // Exécuter le fichier SQL complet (sans le diviser)
        // PostgreSQL peut gérer plusieurs statements dans une seule query
        try {
          await client.query(sqlContent);
        } catch (stmtError) {
          // Ignorer certaines erreurs "attendues" en cas de réapplication
          if (
            stmtError.message.includes('already exists') ||
            stmtError.message.includes('extension') && stmtError.message.includes('already exists')
          ) {
            console.log(`⚠️  Some elements already exist (expected for existing DB)`);
          } else {
            throw stmtError;
          }
        }
        
        // Marquer comme appliquée
        await client.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (version) VALUES ($1)`,
          [version]
        );
        
        await client.query('COMMIT');
        console.log(`✅ Migration ${version} applied successfully`);
        
      } catch (migrationError) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to apply migration ${version}:`, migrationError.message);
        throw migrationError;
      }
    }
    
    console.log('🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Exécuter les migrations
runMigrations();
