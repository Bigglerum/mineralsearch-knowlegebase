#!/usr/bin/env tsx

import { MindatAPIService } from '../server/services/mindat-api-service';
import { neon } from '@neondatabase/serverless';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const apiService = MindatAPIService.getInstance();

interface NewMineralRecord {
  Title: string;
  'Mindat ID': string;
  Formula: string;
  Strunz: string;
  [key: string]: string;
}

async function refreshIncompleteMinerals() {
  console.log('=== Refresh Incomplete Minerals from Mindat API ===\n');

  // Read the NEW_MINERALS file
  const csvPath = '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    relax_quotes: true
  }) as NewMineralRecord[];

  console.log(`📁 Loaded ${records.length} NEW_MINERALS records\n`);

  // Find records with missing formula or strunz
  const incomplete = records.filter(r => {
    const mindatId = r['Mindat ID']?.trim();
    const formula = r.Formula?.trim();
    const strunz = r.Strunz?.trim();

    return mindatId && (!formula || !strunz);
  });

  console.log(`🔍 Found ${incomplete.length} records with missing formula or strunz\n`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < incomplete.length; i++) {
    const record = incomplete[i];
    const mindatId = parseInt(record['Mindat ID']);

    console.log(`[${i + 1}/${incomplete.length}] Checking ${record.Title} (${mindatId})...`);

    try {
      // Fetch from API
      const apiData = await apiService.getMineralById(mindatId);

      // Use mindat_formula as fallback if ima_formula is empty
      const formula = apiData.ima_formula || apiData.mindat_formula || null;
      const strunz = apiData.strunz10ed1 || apiData.strunz10ed2 || apiData.strunz10ed3 || apiData.strunz10ed4 || null;

      if (formula || strunz) {
        console.log(`  ✅ Found data - Formula: ${formula ? 'Yes' : 'No'}, Strunz: ${strunz ? 'Yes' : 'No'}`);

        // Update Neon database
        await sql`
          UPDATE mindat_minerals
          SET
            ima_formula = ${formula},
            strunz10ed1 = ${apiData.strunz10ed1 || null},
            strunz10ed2 = ${apiData.strunz10ed2 || null},
            strunz10ed3 = ${apiData.strunz10ed3 || null},
            strunz10ed4 = ${apiData.strunz10ed4 || null}
          WHERE mindat_id = ${mindatId}
        `;

        // Update CSV record
        if (formula) record.Formula = formula;
        if (strunz) record.Strunz = strunz;

        updated++;
      } else {
        console.log(`  ⚠️  No formula or strunz data available`);
        notFound++;
      }

      // Rate limit - wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      if (error.message?.includes('404')) {
        console.log(`  ❌ Not found in API`);
        notFound++;
      } else {
        console.log(`  ❌ Error: ${error.message}`);
        errors++;
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('REFRESH SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n✅ Updated: ${updated}`);
  console.log(`⚠️  Not found/No data: ${notFound}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📊 Total checked: ${incomplete.length}\n`);

  // Write updated CSV
  const outputPath = '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL_REFRESHED.csv';
  const outputCSV = stringify(records, { header: true, bom: true });
  fs.writeFileSync(outputPath, outputCSV, 'utf-8');

  console.log(`📝 Wrote refreshed CSV to: mindat_NEW_MINERALS_FINAL_REFRESHED.csv`);
  console.log(`   You can review and replace the original file if satisfied.\n`);

  console.log('✅ Refresh complete!\n');
}

refreshIncompleteMinerals().catch(console.error);
