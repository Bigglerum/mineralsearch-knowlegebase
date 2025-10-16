#!/usr/bin/env tsx

import { neon } from '@neondatabase/serverless';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

// Get list of Mindat IDs from original NEW_MINERALS file
import { parse } from 'csv-parse/sync';

async function exportFromNeon() {
  console.log('=== Export NEW_MINERALS from Neon ===\n');

  // Read original file to get the list of Mindat IDs and other fields
  const originalPath = '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL.csv';
  const originalContent = fs.readFileSync(originalPath, 'utf-8');
  const originalRecords = parse(originalContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    relax_quotes: true
  });

  console.log(`📁 Loaded ${originalRecords.length} records from original file\n`);

  const mindatIds = originalRecords
    .map((r: any) => parseInt(r['Mindat ID']))
    .filter((id: number) => !isNaN(id));

  console.log(`🔍 Fetching ${mindatIds.length} minerals from Neon...\n`);

  // Fetch from Neon and concatenate strunz fields
  const neonData = await sql`
    SELECT
      mindat_id,
      name,
      ima_formula,
      CASE
        WHEN strunz10ed1 IS NOT NULL AND strunz10ed1 != '0' AND strunz10ed2 IS NOT NULL AND strunz10ed3 IS NOT NULL AND strunz10ed4 IS NOT NULL
        THEN strunz10ed1 || '.' || strunz10ed2 || strunz10ed3 || '.' || strunz10ed4
        WHEN strunz10ed1 IS NOT NULL AND strunz10ed1 != '0' AND strunz10ed2 IS NOT NULL AND strunz10ed3 IS NOT NULL
        THEN strunz10ed1 || '.' || strunz10ed2 || strunz10ed3 || '.x'
        WHEN strunz10ed1 IS NOT NULL AND strunz10ed1 != '0' AND strunz10ed2 IS NOT NULL
        THEN strunz10ed1 || '.' || strunz10ed2 || 'x'
        WHEN strunz10ed1 IS NOT NULL AND strunz10ed1 != '0'
        THEN strunz10ed1
        ELSE NULL
      END as strunz_full,
      crystal_system,
      hardness_min,
      hardness_max,
      streak,
      colour,
      entry_type_text
    FROM mindat_minerals
    WHERE mindat_id = ANY(${mindatIds})
    ORDER BY mindat_id
  `;

  console.log(`✅ Fetched ${neonData.length} records from Neon\n`);

  // Create lookup
  const neonLookup = new Map();
  neonData.forEach(row => {
    neonLookup.set(row.mindat_id, row);
  });

  // Merge with original records
  const outputRecords = originalRecords.map((orig: any) => {
    const mindatId = parseInt(orig['Mindat ID']);
    const neon = neonLookup.get(mindatId);

    if (neon) {
      // Use Neon data for formula and strunz, keep original for other fields
      return {
        'Title': orig.Title || neon.name,
        'Short Description': orig['Short Description'] || '',
        'Synonyms': orig.Synonyms || '',
        'Mindat ID': orig['Mindat ID'],
        'Mindat URL': orig['Mindat URL'],
        'Formula': neon.ima_formula || orig.Formula || '',
        'Crystal System': neon.crystal_system || orig['Crystal System'] || '',
        'Hardness Min': neon.hardness_min || orig['Hardness Min'] || '',
        'Hardness Max': neon.hardness_max || orig['Hardness Max'] || '',
        'Streak': neon.streak || orig.Streak || '',
        'Tenacity': orig.Tenacity || '',
        'Colour': neon.colour || orig.Colour || '',
        'Type Locality': orig['Type Locality'] || '',
        'Strunz': neon.strunz_full || (orig.Strunz && !orig.Strunz.startsWith('0.00') ? orig.Strunz : '') || '',
        'Mindat Status': orig['Mindat Status'] || '',
        'Approval status': 'Approved',
        'Variety Of': orig['Variety Of'] || '',
        'Group Parent': orig['Group Parent'] || '',
        'Polymorph of': orig['Polymorph of'] || '',
        'Polytype Of': orig['Polytype Of'] || '',
        'Mixture of': orig['Mixture of'] || '',
        'Synonym of': orig['Synonym of'] || '',
        'Habit of': orig['Habit of'] || '',
        'Renamed To': orig['Renamed To'] || '',
        'Unnamed': orig.Unnamed || '',
        'Class': neon.entry_type_text === 'mineral' ? 'Mineral' : (neon.entry_type_text === 'grouplist' ? 'Mineral Group' : (orig.Class || ''))
      };
    } else {
      return orig;
    }
  });

  // Write output
  const outputPath = '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FROM_NEON.csv';
  const outputCSV = stringify(outputRecords, { header: true, bom: true });
  fs.writeFileSync(outputPath, outputCSV, 'utf-8');

  console.log(`📝 Wrote ${outputRecords.length} records to: mindat_NEW_MINERALS_FROM_NEON.csv\n`);
  console.log('✅ Export complete!\n');
}

exportFromNeon().catch(console.error);
