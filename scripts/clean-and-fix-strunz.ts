#!/usr/bin/env tsx

/**
 * Clean and Fix Strunz Classifications
 *
 * 1. Clean: Convert '0' values to NULL in all strunz10ed fields (only where ALL parts are 0)
 * 2. Fix: Fetch complete Strunz from Mindat API for incomplete classifications
 * 3. Export results to CSV
 */

import { neon } from '@neondatabase/serverless';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

const MINDAT_API_KEY = process.env.MINDAT_API_KEY;
const RATE_LIMIT_DELAY = 1000; // 1 second between API calls

interface CleanResult {
  mindat_id: number;
  name: string;
  before: string;
  after: string;
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
 * Step 1: Clean '0' values - only clear if ALL parts are '0'
 */
async function cleanZeroStrunz(dryRun: boolean = false): Promise<CleanResult[]> {
  console.log('\n=== STEP 1: Clean Zero Strunz Values ===\n');

  // Find minerals where ALL strunz parts are '0'
  const minerals = await sql`
    SELECT mindat_id, name, strunz10ed1, strunz10ed2, strunz10ed3, strunz10ed4
    FROM mindat_minerals
    WHERE
      (strunz10ed1 = '0' OR strunz10ed1 IS NULL OR strunz10ed1 = '')
      AND (strunz10ed2 = '0' OR strunz10ed2 IS NULL OR strunz10ed2 = '')
      AND (strunz10ed3 = '0' OR strunz10ed3 IS NULL OR strunz10ed3 = '')
      AND (strunz10ed4 = '0' OR strunz10ed4 IS NULL OR strunz10ed4 = '')
      -- At least one field is '0' (not all NULL)
      AND (strunz10ed1 = '0' OR strunz10ed2 = '0' OR strunz10ed3 = '0' OR strunz10ed4 = '0')
  `;

  console.log(`Found ${minerals.length} minerals with all-zero Strunz values`);

  const results: CleanResult[] = [];

  if (minerals.length > 0 && !dryRun) {
    console.log('Setting all fields to NULL...');

    for (const mineral of minerals) {
      const before = concatenateStrunz(
        mineral.strunz10ed1,
        mineral.strunz10ed2,
        mineral.strunz10ed3,
        mineral.strunz10ed4
      );

      await sql`
        UPDATE mindat_minerals
        SET
          strunz10ed1 = NULL,
          strunz10ed2 = NULL,
          strunz10ed3 = NULL,
          strunz10ed4 = NULL,
          updated_at = NOW()
        WHERE mindat_id = ${mineral.mindat_id}
      `;

      results.push({
        mindat_id: mineral.mindat_id,
        name: mineral.name,
        before: before || '0.00',
        after: ''
      });
    }

    console.log(`✓ Cleaned ${minerals.length} minerals`);
  } else if (dryRun) {
    console.log('DRY RUN - Would clean these minerals:');
    minerals.slice(0, 10).forEach((m: any) => {
      console.log(`  ${m.mindat_id}: ${m.name}`);
    });
    if (minerals.length > 10) {
      console.log(`  ... and ${minerals.length - 10} more`);
    }
  }

  return results;
}

/**
 * Step 2: Fix incomplete Strunz from Mindat API
 */
async function fixIncompleteStrunz(dryRun: boolean = false): Promise<FixResult[]> {
  console.log('\n=== STEP 2: Fix Incomplete Strunz Classifications ===\n');

  const incomplete = await sql`
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
      -- Exclude groups
      name NOT ILIKE '%Group%'
      -- Has valid strunz10ed1 (not null, empty, or 0)
      AND strunz10ed1 IS NOT NULL
      AND strunz10ed1 != ''
      AND strunz10ed1 != '0'
      -- Has valid strunz10ed2 and strunz10ed3
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

  console.log(`Found ${incomplete.length} minerals with incomplete Strunz`);

  if (dryRun) {
    console.log('\nDRY RUN - Sample minerals to be fixed:');
    incomplete.slice(0, 10).forEach((m: any) => {
      console.log(`  ${m.mindat_id}: ${m.name} (${m.current_strunz})`);
    });
    if (incomplete.length > 10) {
      console.log(`  ... and ${incomplete.length - 10} more`);
    }
    return [];
  }

  const results: FixResult[] = [];

  console.log(`\nProcessing ${incomplete.length} minerals...`);

  for (let i = 0; i < incomplete.length; i++) {
    const mineral = incomplete[i];
    const progress = `[${i + 1}/${incomplete.length}]`;

    console.log(`${progress} ${mineral.name} (${mineral.current_strunz})`);

    // Fetch from Mindat API
    try {
      const response = await fetch(`https://api.mindat.org/v1/geomaterials/${mineral.mindat_id}/`, {
        headers: {
          'Authorization': `Token ${MINDAT_API_KEY}`
        }
      });

      if (!response.ok) {
        console.log(`  API error: ${response.status}`);
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
          error: `HTTP ${response.status}`
        });
        continue;
      }

      const data = await response.json();

      // Check if Mindat has strunz10ed4
      if (!data.strunz10ed4 || data.strunz10ed4.trim() === '') {
        console.log(`  No strunz10ed4 in Mindat`);
        results.push({
          mindat_id: mineral.mindat_id,
          name: mineral.name,
          old_strunz: mineral.current_strunz,
          new_strunz: mineral.current_strunz,
          strunz10ed1: mineral.strunz10ed1 || '',
          strunz10ed2: mineral.strunz10ed2 || '',
          strunz10ed3: mineral.strunz10ed3 || '',
          strunz10ed4: mineral.strunz10ed4 || '',
          status: 'no_change'
        });
      } else {
        // Found complete Strunz - update database
        const newStrunz = concatenateStrunz(
          data.strunz10ed1,
          data.strunz10ed2,
          data.strunz10ed3,
          data.strunz10ed4
        );

        console.log(`  → ${newStrunz}`);

        await sql`
          UPDATE mindat_minerals
          SET
            strunz10ed1 = ${data.strunz10ed1 || null},
            strunz10ed2 = ${data.strunz10ed2 || null},
            strunz10ed3 = ${data.strunz10ed3 || null},
            strunz10ed4 = ${data.strunz10ed4 || null},
            updated_at = NOW()
          WHERE mindat_id = ${mineral.mindat_id}
        `;

        results.push({
          mindat_id: mineral.mindat_id,
          name: mineral.name,
          old_strunz: mineral.current_strunz,
          new_strunz: newStrunz,
          strunz10ed1: data.strunz10ed1 || '',
          strunz10ed2: data.strunz10ed2 || '',
          strunz10ed3: data.strunz10ed3 || '',
          strunz10ed4: data.strunz10ed4 || '',
          status: 'updated'
        });
      }
    } catch (error) {
      console.log(`  Error: ${error}`);
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
        error: String(error)
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
async function exportResults(cleanResults: CleanResult[], fixResults: FixResult[], outputDir: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];

  // Export clean results
  if (cleanResults.length > 0) {
    const cleanData = cleanResults.map(r => ({
      'Mindat ID': r.mindat_id,
      'Mineral Name': r.name,
      'Before': r.before,
      'After': r.after
    }));

    const cleanCsv = '\ufeff' + stringify(cleanData, {
      header: true,
      columns: ['Mindat ID', 'Mineral Name', 'Before', 'After']
    });

    const cleanPath = path.join(outputDir, `strunz_cleaned_${timestamp}.csv`);
    fs.writeFileSync(cleanPath, cleanCsv, 'utf8');
    console.log(`\nCleaned zeros exported to: ${cleanPath}`);
  }

  // Export fix results
  if (fixResults.length > 0) {
    const fixData = fixResults.map(r => ({
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

    const fixCsv = '\ufeff' + stringify(fixData, {
      header: true,
      columns: ['Mindat ID', 'Mineral Name', 'Old Strunz', 'New Strunz', 'Part 1', 'Part 2', 'Part 3', 'Part 4', 'Status', 'Error']
    });

    const fixPath = path.join(outputDir, `strunz_fixed_${timestamp}.csv`);
    fs.writeFileSync(fixPath, fixCsv, 'utf8');
    console.log(`Fixed incomplete exported to: ${fixPath}`);
  }
}

/**
 * Print summary
 */
function printSummary(cleanResults: CleanResult[], fixResults: FixResult[]): void {
  console.log('\n=== SUMMARY ===');
  console.log(`\nCleaned (zeros → NULL): ${cleanResults.length}`);

  const updated = fixResults.filter(r => r.status === 'updated').length;
  const noChange = fixResults.filter(r => r.status === 'no_change').length;
  const errors = fixResults.filter(r => r.status === 'api_error').length;

  console.log(`\nFixed (incomplete → complete):`);
  console.log(`  Updated: ${updated}`);
  console.log(`  No change (Mindat incomplete): ${noChange}`);
  console.log(`  Errors: ${errors}`);

  if (updated > 0) {
    console.log('\nSample fixes:');
    fixResults.filter(r => r.status === 'updated').slice(0, 5).forEach(r => {
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

  console.log('=== Clean and Fix Strunz Classifications ===');

  if (!MINDAT_API_KEY) {
    console.error('ERROR: MINDAT_API_KEY environment variable not set');
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n*** DRY RUN - No database changes will be made ***');
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Step 1: Clean zeros
    const cleanResults = await cleanZeroStrunz(dryRun);

    // Step 2: Fix incomplete
    const fixResults = await fixIncompleteStrunz(dryRun);

    // Export to CSV
    if (!dryRun) {
      await exportResults(cleanResults, fixResults, outputDir);
    }

    // Print summary
    printSummary(cleanResults, fixResults);

    console.log('\nDone!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
