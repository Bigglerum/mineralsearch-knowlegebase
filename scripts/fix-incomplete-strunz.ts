#!/usr/bin/env tsx

/**
 * Fix Incomplete Strunz Classifications
 *
 * 1. Query Neon for minerals with incomplete Strunz data (missing strunz10ed4)
 * 2. Fetch complete Strunz from Mindat API
 * 3. Update Neon database with complete classification
 * 4. Export results to CSV
 */

import { neon } from '@neondatabase/serverless';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

interface IncompleteStrunz {
  mindat_id: number;
  name: string;
  strunz10ed1: string | null;
  strunz10ed2: string | null;
  strunz10ed3: string | null;
  strunz10ed4: string | null;
  current_strunz: string;
}

interface MindatStrunzResponse {
  id: number;
  name: string;
  strunz10ed1?: string;
  strunz10ed2?: string;
  strunz10ed3?: string;
  strunz10ed4?: string;
}

interface FixResult {
  mindat_id: number;
  name: string;
  old_strunz: string;
  new_strunz: string;
  strunz10ed1: string;
  strunz10ed2: string;
  strunz10ed3: string;
  strunz10ed4: string;
  status: 'updated' | 'no_change' | 'api_error' | 'not_found';
  error?: string;
}

const MINDAT_API_KEY = process.env.MINDAT_API_KEY;
const RATE_LIMIT_DELAY = 1000; // 1 second between API calls

/**
 * Concatenate Strunz parts into full classification
 */
function concatenateStrunz(p1?: string | null, p2?: string | null, p3?: string | null, p4?: string | null): string {
  const parts = [p1, p2, p3, p4].filter(p => p);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}.${parts[1]}`;
  if (parts.length === 3) return `${parts[0]}.${parts[1]}${parts[2]}`;
  return `${parts[0]}.${parts[1]}${parts[2]}.${parts[3]}`;
}

/**
 * Fetch Strunz data from Mindat API
 */
async function fetchMindatStrunz(mindatId: number): Promise<MindatStrunzResponse | null> {
  try {
    const response = await fetch(`https://api.mindat.org/minerals/${mindatId}`, {
      headers: {
        'Authorization': `Token ${MINDAT_API_KEY}`
      }
    });

    if (!response.ok) {
      console.error(`API error for ${mindatId}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Fetch error for ${mindatId}:`, error);
    return null;
  }
}

/**
 * Find minerals with incomplete Strunz (has parts 1-3 but missing part 4)
 */
async function findIncompleteStrunz(): Promise<IncompleteStrunz[]> {
  console.log('Querying Neon for minerals with incomplete Strunz classifications...');

  const results = await sql`
    SELECT
      mindat_id,
      name,
      strunz10ed1,
      strunz10ed2,
      strunz10ed3,
      strunz10ed4,
      CONCAT_WS('.',
        strunz10ed1,
        CASE
          WHEN strunz10ed2 IS NOT NULL AND strunz10ed3 IS NOT NULL
          THEN strunz10ed2 || strunz10ed3
          WHEN strunz10ed2 IS NOT NULL
          THEN strunz10ed2
          ELSE NULL
        END,
        strunz10ed4
      ) as current_strunz
    FROM mindat_minerals
    WHERE
      -- Exclude groups (filter by name containing "Group")
      name NOT ILIKE '%Group%'
      -- Has valid strunz10ed1 (not null, empty, or 0)
      AND strunz10ed1 IS NOT NULL
      AND strunz10ed1 != ''
      AND strunz10ed1 != '0'
      -- Has valid strunz10ed2 and strunz10ed3 (partial classification)
      AND strunz10ed2 IS NOT NULL
      AND strunz10ed2 != ''
      AND strunz10ed2 != '0'
      AND strunz10ed3 IS NOT NULL
      AND strunz10ed3 != ''
      AND strunz10ed3 != '0'
      -- Missing strunz10ed4 (incomplete)
      AND (strunz10ed4 IS NULL OR strunz10ed4 = '')
    ORDER BY name
  `;

  console.log(`Found ${results.length} minerals with incomplete Strunz classifications`);
  return results as IncompleteStrunz[];
}

/**
 * Update Neon database with complete Strunz
 */
async function updateStrunzInNeon(
  mindatId: number,
  p1: string,
  p2: string,
  p3: string,
  p4: string
): Promise<boolean> {
  try {
    await sql`
      UPDATE mindat_minerals
      SET
        strunz10ed1 = ${p1},
        strunz10ed2 = ${p2},
        strunz10ed3 = ${p3},
        strunz10ed4 = ${p4},
        updated_at = NOW()
      WHERE mindat_id = ${mindatId}
    `;
    return true;
  } catch (error) {
    console.error(`Database update error for ${mindatId}:`, error);
    return false;
  }
}

/**
 * Process minerals and fix incomplete Strunz
 */
async function fixIncompleteStrunz(dryRun: boolean = false): Promise<FixResult[]> {
  const incomplete = await findIncompleteStrunz();
  const results: FixResult[] = [];

  console.log(`\nProcessing ${incomplete.length} minerals...`);
  if (dryRun) {
    console.log('DRY RUN - No changes will be made to database\n');
  }

  for (let i = 0; i < incomplete.length; i++) {
    const mineral = incomplete[i];
    const progress = `[${i + 1}/${incomplete.length}]`;

    console.log(`${progress} Checking ${mineral.name} (ID: ${mineral.mindat_id})`);
    console.log(`  Current: ${mineral.current_strunz}`);

    // Fetch from Mindat API
    const mindatData = await fetchMindatStrunz(mineral.mindat_id);

    if (!mindatData) {
      results.push({
        mindat_id: mineral.mindat_id,
        name: mineral.name,
        old_strunz: mineral.current_strunz,
        new_strunz: mineral.current_strunz,
        strunz10ed1: mineral.strunz10ed1 || '',
        strunz10ed2: mineral.strunz10ed2 || '',
        strunz10ed3: mineral.strunz10ed3 || '',
        strunz10ed4: mineral.strunz10ed4 || '',
        status: 'api_error',
        error: 'Failed to fetch from Mindat API'
      });
      continue;
    }

    // Check if Mindat has strunz10ed4
    if (!mindatData.strunz10ed4 || mindatData.strunz10ed4.trim() === '') {
      console.log(`  Mindat also missing strunz10ed4 - no update needed`);
      results.push({
        mindat_id: mineral.mindat_id,
        name: mineral.name,
        old_strunz: mineral.current_strunz,
        new_strunz: mineral.current_strunz,
        strunz10ed1: mineral.strunz10ed1 || '',
        strunz10ed2: mineral.strunz10ed2 || '',
        strunz10ed3: mineral.strunz10ed3 || '',
        strunz10ed4: mineral.strunz10ed4 || '',
        status: 'no_change',
        error: 'Mindat also has incomplete Strunz'
      });
    } else {
      // Found complete Strunz in Mindat
      const newStrunz = concatenateStrunz(
        mindatData.strunz10ed1,
        mindatData.strunz10ed2,
        mindatData.strunz10ed3,
        mindatData.strunz10ed4
      );

      console.log(`  Updated: ${newStrunz}`);
      console.log(`  Parts: [${mindatData.strunz10ed1}] [${mindatData.strunz10ed2}] [${mindatData.strunz10ed3}] [${mindatData.strunz10ed4}]`);

      // Update database (unless dry run)
      let updateSuccess = true;
      if (!dryRun) {
        updateSuccess = await updateStrunzInNeon(
          mineral.mindat_id,
          mindatData.strunz10ed1 || '',
          mindatData.strunz10ed2 || '',
          mindatData.strunz10ed3 || '',
          mindatData.strunz10ed4 || ''
        );
      }

      results.push({
        mindat_id: mineral.mindat_id,
        name: mineral.name,
        old_strunz: mineral.current_strunz,
        new_strunz: newStrunz,
        strunz10ed1: mindatData.strunz10ed1 || '',
        strunz10ed2: mindatData.strunz10ed2 || '',
        strunz10ed3: mindatData.strunz10ed3 || '',
        strunz10ed4: mindatData.strunz10ed4 || '',
        status: updateSuccess ? 'updated' : 'api_error',
        error: updateSuccess ? undefined : 'Database update failed'
      });
    }

    // Rate limiting
    if (i < incomplete.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  return results;
}

/**
 * Export results to CSV
 */
async function exportToCSV(results: FixResult[], outputPath: string): Promise<void> {
  const csvData = results.map(r => ({
    'Mindat ID': r.mindat_id,
    'Mineral Name': r.name,
    'Old Strunz': r.old_strunz,
    'New Strunz': r.new_strunz,
    'Part 1': r.strunz10ed1,
    'Part 2': r.strunz10ed2,
    'Part 3': r.strunz10ed3,
    'Part 4': r.strunz10ed4,
    'Status': r.status,
    'Error': r.error || ''
  }));

  const csvContent = '\ufeff' + stringify(csvData, {
    header: true,
    columns: ['Mindat ID', 'Mineral Name', 'Old Strunz', 'New Strunz', 'Part 1', 'Part 2', 'Part 3', 'Part 4', 'Status', 'Error']
  });

  fs.writeFileSync(outputPath, csvContent, 'utf8');
  console.log(`\nResults exported to: ${outputPath}`);
}

/**
 * Print summary statistics
 */
function printSummary(results: FixResult[]): void {
  const updated = results.filter(r => r.status === 'updated').length;
  const noChange = results.filter(r => r.status === 'no_change').length;
  const errors = results.filter(r => r.status === 'api_error').length;

  console.log('\n=== SUMMARY ===');
  console.log(`Total minerals processed: ${results.length}`);
  console.log(`Updated with complete Strunz: ${updated}`);
  console.log(`No change (Mindat also incomplete): ${noChange}`);
  console.log(`Errors: ${errors}`);

  if (updated > 0) {
    console.log('\nSample updates:');
    results.filter(r => r.status === 'updated').slice(0, 5).forEach(r => {
      console.log(`  ${r.name}: ${r.old_strunz} → ${r.new_strunz}`);
    });
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const outputDir = args.find(arg => !arg.startsWith('--')) || '/tmp/strunz-fix';

  console.log('=== Fix Incomplete Strunz Classifications ===\n');

  if (!MINDAT_API_KEY) {
    console.error('ERROR: MINDAT_API_KEY environment variable not set');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Find and fix incomplete Strunz
    const results = await fixIncompleteStrunz(dryRun);

    // Export to CSV
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const csvPath = path.join(outputDir, `strunz_fix_${timestamp}.csv`);
    await exportToCSV(results, csvPath);

    // Print summary
    printSummary(results);

    console.log('\nDone!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
