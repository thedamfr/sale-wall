/**
 * Test OP3 Service Integration (ADR-0015)
 * Sprint 1: Load initial stats into cache
 */

import 'dotenv/config';
import pg from 'pg';
import { updateOP3StatsCache, initOP3Service } from '../server/services/op3Service.js';

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRESQL_ADDON_URI;

if (!dbUrl) {
  console.error('❌ No DATABASE_URL or POSTGRESQL_ADDON_URI in .env');
  process.exit(1);
}

const pool = new Pool({ connectionString: dbUrl });

async function main() {
  console.log('🔍 OP3 Service Integration Test\n');
  
  // 1. Check table exists
  console.log('1️⃣  Checking op3_stats table...');
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'op3_stats'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('   ⚠️  Table op3_stats not found. Run migration 007 first:');
      console.log('   $ psql $DATABASE_URL < sql/007_op3_stats.sql\n');
      process.exit(1);
    }
    console.log('   ✅ Table exists\n');
  } catch (err) {
    console.error('   ❌ Database error:', err.message);
    process.exit(1);
  }
  
  // 2. Initialize OP3 service
  console.log('2️⃣  Initializing OP3 service (show UUID lookup)...');
  try {
    await initOP3Service();
    console.log('   ✅ OP3 service initialized\n');
  } catch (err) {
    console.error('   ❌ Init failed:', err.message);
    process.exit(1);
  }
  
  // 3. Fetch and cache episode stats
  console.log('3️⃣  Fetching episode stats from OP3 API...');
  try {
    const count = await updateOP3StatsCache(pool);
    console.log(`   ✅ Cached ${count} episodes\n`);
  } catch (err) {
    console.error('   ❌ Update failed:', err.message);
    process.exit(1);
  }
  
  // 4. Query cached data
  console.log('4️⃣  Reading cached stats from PostgreSQL...');
  try {
    const result = await pool.query(`
      SELECT item_guid, downloads_all, downloads_30, fetched_at
      FROM op3_stats
      ORDER BY downloads_all DESC
      LIMIT 5
    `);
    
    if (result.rows.length === 0) {
      console.log('   ⚠️  No stats cached\n');
    } else {
      console.log('   📊 Top 5 episodes:\n');
      result.rows.forEach((row, i) => {
        const guid = row.item_guid.substring(row.item_guid.lastIndexOf('/') + 1, row.item_guid.length - 5);
        console.log(`   ${i + 1}. ${guid}`);
        console.log(`      All-time: ${row.downloads_all} downloads`);
        console.log(`      30 days: ${row.downloads_30 || 'N/A'}`);
        console.log(`      Cached: ${new Date(row.fetched_at).toLocaleString('fr-FR')}\n`);
      });
    }
  } catch (err) {
    console.error('   ❌ Query failed:', err.message);
  }
  
  await pool.end();
  console.log('✅ Test completed successfully!');
}

main().catch(err => {
  console.error('💥 Test failed:', err);
  process.exit(1);
});
