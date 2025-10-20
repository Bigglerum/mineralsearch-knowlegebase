#!/usr/bin/env tsx

/**
 * Add 'x' placeholder to Strunz 4th part for minerals with 3 parts but no 4th part
 * Pattern: #.nn.[null] → #.nn.x
 * This helps discriminate between classification levels in search
 */

import { neon } from '@neondatabase/serverless';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

function concatenateStrunz(p1?: string | null, p2?: string | null, p3?: string | null, p4?: string | null): string {
  const parts = [p1, p2, p3, p4].filter(p => p);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}.${parts[1]}`;
  if (parts.length === 3) return `${parts[0]}.${parts[1]}${parts[2]}`;
  return `${parts[0]}.${parts[1]}${parts[2]}.${parts[3]}`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('=== Add Strunz Placeholder "x" ===\n');

  if (dryRun) {
    console.log('*** DRY RUN - No database changes will be made ***\n');
  }

  // Find minerals with 3 valid parts but no 4th part
  const minerals = await sql`
    SELECT mindat_id, name, strunz10ed1, strunz10ed2, strunz10ed3, strunz10ed4
    FROM mindat_minerals
    WHERE
      -- Exclude groups
      name NOT ILIKE '%Group%'
      -- Has valid 3 parts
      AND strunz10ed1 IS NOT NULL AND strunz10ed1 != '' AND strunz10ed1 != '0'
      AND strunz10ed2 IS NOT NULL AND strunz10ed2 != '' AND strunz10ed2 != '0'
      AND strunz10ed3 IS NOT NULL AND strunz10ed3 != '' AND strunz10ed3 != '0'
      -- Missing 4th part
      AND (strunz10ed4 IS NULL OR strunz10ed4 = '')
    ORDER BY name
  `;

  console.log(`Found ${minerals.length} minerals with 3-part Strunz classifications\n`);

  if (minerals.length === 0) {
    console.log('No minerals to update');
    return;
  }

  // Show first 10 examples
  console.log('First 10 examples:');
  minerals.slice(0, 10).forEach((m: any) => {
    const current = concatenateStrunz(m.strunz10ed1, m.strunz10ed2, m.strunz10ed3, m.strunz10ed4);
    const updated = concatenateStrunz(m.strunz10ed1, m.strunz10ed2, m.strunz10ed3, 'x');
    console.log(`  ${m.name}: ${current} → ${updated}`);
  });

  if (minerals.length > 10) {
    console.log(`  ... and ${minerals.length - 10} more`);
  }

  if (dryRun) {
    console.log('\nDRY RUN complete. Run without --dry-run to update database.');
    return;
  }

  // Update all minerals
  console.log('\nUpdating database...');

  const result = await sql`
    UPDATE mindat_minerals
    SET
      strunz10ed4 = 'x',
      updated_at = NOW()
    WHERE
      name NOT ILIKE '%Group%'
      AND strunz10ed1 IS NOT NULL AND strunz10ed1 != '' AND strunz10ed1 != '0'
      AND strunz10ed2 IS NOT NULL AND strunz10ed2 != '' AND strunz10ed2 != '0'
      AND strunz10ed3 IS NOT NULL AND strunz10ed3 != '' AND strunz10ed3 != '0'
      AND (strunz10ed4 IS NULL OR strunz10ed4 = '')
  `;

  console.log(`✓ Updated ${minerals.length} minerals`);

  // Export to CSV
  const csvData = minerals.map((m: any) => ({
    'Mindat ID': m.mindat_id,
    'Mineral Name': m.name,
    'Old Strunz': concatenateStrunz(m.strunz10ed1, m.strunz10ed2, m.strunz10ed3, m.strunz10ed4),
    'New Strunz': concatenateStrunz(m.strunz10ed1, m.strunz10ed2, m.strunz10ed3, 'x')
  }));

  const csvContent = '\ufeff' + stringify(csvData, {
    header: true,
    columns: ['Mindat ID', 'Mineral Name', 'Old Strunz', 'New Strunz']
  });

  const outputPath = '/tmp/strunz-fix/strunz_placeholder_added.csv';
  fs.writeFileSync(outputPath, csvContent, 'utf8');

  console.log(`\nResults exported to: ${outputPath}`);
  console.log('\nDone!');
}

main();
