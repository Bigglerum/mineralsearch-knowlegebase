#!/usr/bin/env tsx

/**
 * Fix Strunz for minerals that got 500 errors by searching by name
 */

import { neon } from '@neondatabase/serverless';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const MINDAT_API_KEY = process.env.MINDAT_API_KEY;
const RATE_LIMIT_DELAY = 1000;

// List of minerals that got 500 errors
const errorMinerals = [
  { id: 55237, name: 'Alicewilsonite-(YCe)' },
  { id: 46490, name: 'Aspedamite' },
  { id: 54217, name: 'Bosoite' },
  { id: 46039, name: 'Chukotkaite' },
  { id: 54113, name: 'Downsite' },
  { id: 54361, name: 'Fluornatroroméite' },
  { id: 55106, name: 'Hydroxylbenyacarite' },
  { id: 55606, name: 'Lucabindiite' },
  { id: 54361, name: 'Nazarchukite' },
  { id: 470833, name: 'Pleysteinite' },
  { id: 52841, name: 'Seaborgite' }
];

function concatenateStrunz(p1?: string | null, p2?: string | null, p3?: string | null, p4?: string | null): string {
  const parts = [p1, p2, p3, p4].filter(p => p);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}.${parts[1]}`;
  if (parts.length === 3) return `${parts[0]}.${parts[1]}${parts[2]}`;
  return `${parts[0]}.${parts[1]}${parts[2]}.${parts[3]}`;
}

async function searchByName(name: string) {
  try {
    const response = await fetch(`https://api.mindat.org/v1/geomaterials/?name=${encodeURIComponent(name)}`, {
      headers: {
        'Authorization': `Token ${MINDAT_API_KEY}`
      }
    });

    if (!response.ok) {
      console.log(`  API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      // Find exact match
      const exactMatch = data.results.find((r: any) => r.name === name);
      return exactMatch || data.results[0];
    }

    return null;
  } catch (error) {
    console.log(`  Error: ${error}`);
    return null;
  }
}

async function main() {
  console.log('=== Fix Strunz by Name Search ===\n');

  const results = [];

  for (let i = 0; i < errorMinerals.length; i++) {
    const mineral = errorMinerals[i];
    console.log(`[${i + 1}/${errorMinerals.length}] ${mineral.name} (ID: ${mineral.id})`);

    // Get current Neon data
    const current = await sql`
      SELECT mindat_id, name, strunz10ed1, strunz10ed2, strunz10ed3, strunz10ed4
      FROM mindat_minerals
      WHERE mindat_id = ${mineral.id}
    `;

    if (current.length === 0) {
      console.log('  Not found in Neon database');
      continue;
    }

    const currentMineral = current[0];
    const oldStrunz = concatenateStrunz(
      currentMineral.strunz10ed1,
      currentMineral.strunz10ed2,
      currentMineral.strunz10ed3,
      currentMineral.strunz10ed4
    );

    console.log(`  Current: ${oldStrunz}`);

    // Search by name
    const mindatData = await searchByName(mineral.name);

    if (!mindatData) {
      console.log('  Not found in Mindat API');
      results.push({
        'Mindat ID': mineral.id,
        'Name': mineral.name,
        'Old Strunz': oldStrunz,
        'New Strunz': oldStrunz,
        'Status': 'not_found'
      });
    } else {
      // Check if has complete Strunz
      if (mindatData.strunz10ed4 && mindatData.strunz10ed4.trim() !== '') {
        const newStrunz = concatenateStrunz(
          mindatData.strunz10ed1,
          mindatData.strunz10ed2,
          mindatData.strunz10ed3,
          mindatData.strunz10ed4
        );

        console.log(`  → ${newStrunz}`);

        // Update database
        await sql`
          UPDATE mindat_minerals
          SET
            strunz10ed1 = ${mindatData.strunz10ed1 || null},
            strunz10ed2 = ${mindatData.strunz10ed2 || null},
            strunz10ed3 = ${mindatData.strunz10ed3 || null},
            strunz10ed4 = ${mindatData.strunz10ed4 || null},
            updated_at = NOW()
          WHERE mindat_id = ${mineral.id}
        `;

        results.push({
          'Mindat ID': mineral.id,
          'Name': mineral.name,
          'Old Strunz': oldStrunz,
          'New Strunz': newStrunz,
          'Status': 'updated'
        });
      } else {
        console.log('  No strunz10ed4 in Mindat');
        results.push({
          'Mindat ID': mineral.id,
          'Name': mineral.name,
          'Old Strunz': oldStrunz,
          'New Strunz': oldStrunz,
          'Status': 'no_change'
        });
      }
    }

    // Rate limit
    if (i < errorMinerals.length - 1) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  // Export to CSV
  const csvContent = '\ufeff' + stringify(results, {
    header: true,
    columns: ['Mindat ID', 'Name', 'Old Strunz', 'New Strunz', 'Status']
  });

  fs.writeFileSync('/tmp/strunz-fix/strunz_fixed_by_name.csv', csvContent, 'utf8');

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total: ${results.length}`);
  console.log(`Updated: ${results.filter(r => r.Status === 'updated').length}`);
  console.log(`No change: ${results.filter(r => r.Status === 'no_change').length}`);
  console.log(`Not found: ${results.filter(r => r.Status === 'not_found').length}`);

  console.log('\nResults saved to /tmp/strunz-fix/strunz_fixed_by_name.csv');
}

main();
