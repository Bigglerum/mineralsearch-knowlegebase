#!/usr/bin/env tsx

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';

async function createFullUpdate() {
  console.log('=== Create Full Update File with Approval Status ===\n');

  // Read the NEW_MINERALS_FINAL file
  const inputPath = '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL.csv';
  const inputContent = fs.readFileSync(inputPath, 'utf-8');
  const records = parse(inputContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    relax_quotes: true
  });

  console.log(`📁 Loaded ${records.length} NEW_MINERALS records\n`);

  // Keep ALL columns, just update "Approval status" and "Class"
  const updateRecords = records.map((record: any) => {
    return {
      ...record,  // Keep all existing fields
      'Approval status': 'Approved',  // Set to Approved
      'Class': 'Mineral'  // Set to Mineral
    };
  });

  console.log(`✅ Created ${updateRecords.length} update records with ALL fields\n`);

  // Write output file
  const outputPath = '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FULL_UPDATE.csv';
  const outputCSV = stringify(updateRecords, { header: true, bom: true });
  fs.writeFileSync(outputPath, outputCSV, 'utf-8');

  console.log(`📝 Wrote full update file to: mindat_NEW_MINERALS_FULL_UPDATE.csv`);
  console.log(`\nThis file contains ALL fields plus:`);
  console.log(`  - Approval status = "Approved"`);
  console.log(`  - Class = "Mineral"\n`);

  // Create test file with 5 records
  const testRecords = updateRecords.slice(0, 5);
  const testPath = '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FULL_UPDATE_TEST.csv';
  const testCSV = stringify(testRecords, { header: true, bom: true });
  fs.writeFileSync(testPath, testCSV, 'utf-8');

  console.log(`📝 Wrote TEST file (5 records) to: mindat_NEW_MINERALS_FULL_UPDATE_TEST.csv\n`);
  console.log(`Test records:`);
  testRecords.forEach((r: any) => console.log(`  - ${r.Title} (Mindat ID: ${r['Mindat ID']})`));

  console.log('\n✅ Files created! Test with the TEST file first.\n');
}

createFullUpdate().catch(console.error);
