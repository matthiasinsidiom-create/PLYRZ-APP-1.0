import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { processFixtureRatings } from './matchProcessor.ts';

let hasResultsProcessedColumn = true;

/**
 * Checks if the fixtures table has the results_processed_at column
 */
export async function checkSchema() {
  console.log('DEBUG: [AUTOMATION] Checking fixtures table schema...');
  try {
    const { data, error } = await supabaseAdmin.from('fixtures').select('*').limit(1);
    if (error) {
      console.error('DEBUG: [AUTOMATION] Error fetching fixtures for schema check:', JSON.stringify(error, null, 2));
      return;
    }
    if (data && data.length > 0) {
      if (!('results_processed_at' in data[0])) {
        console.warn('DEBUG: [AUTOMATION] WARNING: results_processed_at column is MISSING in Supabase fixtures table!');
        hasResultsProcessedColumn = false;
      } else {
        console.log('DEBUG: [AUTOMATION] results_processed_at column is present.');
        hasResultsProcessedColumn = true;
      }
    } else {
      console.log('DEBUG: [AUTOMATION] No fixtures found to check schema. Assuming column exists.');
    }
  } catch (err) {
    console.error('DEBUG: [AUTOMATION] Unexpected error checking schema:', err);
  }
}

/**
 * Finds and processes fixtures that have finished and their voting window has closed
 */
export async function runAutoProcessor() {
  try {
    const now = new Date().toISOString();
    console.log(`DEBUG: [AUTOMATION] Starting runAutoProcessor at ${now}`);
    
    // 1. Find finished fixtures where voting has closed and results haven't been processed
    const { data: fixtures, error } = await supabaseAdmin
      .from('fixtures')
      .select('id, voting_close_at, results_processed_at')
      .eq('status', 'finished')
      .is('results_processed_at', null)
      .not('voting_close_at', 'is', null)
      .lt('voting_close_at', now);
    
    if (error) {
      console.error('DEBUG: [AUTOMATION] Error fetching pending fixtures:', JSON.stringify(error, null, 2));
      throw error;
    }

    if (!fixtures || fixtures.length === 0) {
      console.log('DEBUG: [AUTOMATION] No pending fixtures found to process.');
      return;
    }

    console.log(`DEBUG: [AUTOMATION] Found ${fixtures.length} fixtures to auto-process:`, fixtures.map(f => f.id));
    
    for (const fixture of fixtures) {
      try {
        console.log(`DEBUG: [AUTOMATION] Processing fixture: ${fixture.id}`);
        const results = await processFixtureRatings(supabaseAdmin, fixture.id);
        console.log(`DEBUG: [AUTOMATION] Successfully processed fixture: ${fixture.id}. Results count: ${results.length}`);
      } catch (err) {
        console.error(`DEBUG: [AUTOMATION] FAILED to process fixture ${fixture.id}:`, err);
        // We continue with other fixtures even if one fails
      }
    }
    
    console.log('DEBUG: [AUTOMATION] runAutoProcessor completed.');
  } catch (err) {
    console.error('DEBUG: [AUTOMATION] Fatal error in runAutoProcessor:', err);
    throw err;
  }
}
