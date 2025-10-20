#!/usr/bin/env tsx
/**
 * Filter out discredited minerals from mindat_NEW_MINERALS.csv
 * Removes any minerals with Mindat Status = "DISCREDITED"
 *
 * Usage:
 *   npm run filter-discredited
 *   or
 *   tsx scripts/filter-discredited-minerals.ts [input-path] [output-path]
 */

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as path from 'path';

interface MineralRecord {
  'Title': string;
  'Short Description': string;
  'Synonyms': string;
  'Mindat ID': string;
  'Mindat URL': string;
  'Formula': string;
  'Crystal System': string;
  'Hardness Min': string;
  'Hardness Max': string;
  'Streak': string;
  'Tenacity': string;
  'Colour': string;
  'Type Locality': string;
  'Strunz': string;
  'Mindat Status': string;
  'Variety Of': string;
  'Group Parent': string;
  'Polymorph of': string;
  'Polytype Of': string;
  'Mixture of': string;
  'Synonym of': string;
  'Habit of': string;
  'Renamed To': string;
  'Unnamed': string;
  'Class': string;
}

async function filterDiscredited(inputPath: string, outputPath: string) {
  console.log('=== Filter Discredited Minerals ===\n');
  console.log(`📁 Input: ${inputPath}`);
  console.log(`📂 Output: ${outputPath}\n`);

  // Read input CSV
  const csvContent = fs.readFileSync(inputPath, 'utf-8');

  // Parse CSV with BOM handling
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: true
  }) as MineralRecord[];

  console.log(`✅ Loaded ${records.length} minerals from CSV\n`);

  // Filter out discredited minerals
  const approved = records.filter(record => {
    const status = record['Mindat Status']?.toUpperCase().trim();
    return status !== 'DISCREDITED';
  });

  const discredited = records.filter(record => {
    const status = record['Mindat Status']?.toUpperCase().trim();
    return status === 'DISCREDITED';
  });

  console.log(`📊 Filter Results:`);
  console.log(`   ✅ Approved minerals: ${approved.length}`);
  console.log(`   ❌ Discredited minerals: ${discredited.length}`);

  if (discredited.length > 0) {
    console.log(`\n🗑️  Discredited minerals removed:`);
    discredited.forEach(m => {
      console.log(`   - ${m.Title} (ID: ${m['Mindat ID']})`);
    });
  }

  // Write approved minerals to output CSV
  const outputCsv = stringify(approved, {
    header: true,
    quoted: true,
    quoted_empty: true,
    bom: true
  });

  fs.writeFileSync(outputPath, outputCsv, 'utf-8');

  console.log(`\n✅ Wrote ${approved.length} approved minerals to ${outputPath}`);
  console.log('\n✅ Filtering complete!\n');
}

// Main execution
const args = process.argv.slice(2);
const inputPath = args[0] || '/tmp/phase1-enrichment/mindat_NEW_MINERALS.csv';
const outputPath = args[1] || '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL.csv';

filterDiscredited(inputPath, outputPath).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
