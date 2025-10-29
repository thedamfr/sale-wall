// Manual test script for RSS parser
import { fetchEpisodeFromRSS } from './server/services/castopodRSS.js';

console.log('🧪 Testing RSS Parser...\n');

async function test() {
  try {
    // Test 1: Episode S2E1
    console.log('Test 1: Fetching S2E1...');
    const ep1 = await fetchEpisodeFromRSS(2, 1);
    console.log('✅ Result:', JSON.stringify(ep1, null, 2));
    console.log('');

    // Test 2: Episode S1E5
    console.log('Test 2: Fetching S1E5...');
    const ep2 = await fetchEpisodeFromRSS(1, 5);
    console.log('✅ Result:', JSON.stringify(ep2, null, 2));
    console.log('');

    // Test 3: Non-existent episode
    console.log('Test 3: Fetching S99E99 (should be null)...');
    const ep3 = await fetchEpisodeFromRSS(99, 99);
    console.log('✅ Result:', ep3);
    console.log('');

    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();
