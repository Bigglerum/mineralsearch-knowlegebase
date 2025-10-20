#!/usr/bin/env tsx

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';

interface NewMineralRecord {
  Title: string;
  'Mindat ID': string;
  'Mindat Status': string;
  Class: string;
  [key: string]: string;
}

async function createNewMineralsUpdate() {
  console.log('=== Create NEW_MINERALS Update File ===\n');

  // Read the NEW_MINERALS_FINAL file
  const inputPath = '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL.csv';
  const inputContent = fs.readFileSync(inputPath, 'utf-8');
  const records = parse(inputContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true
  }) as NewMineralRecord[];

  console.log(`📁 Loaded ${records.length} NEW_MINERALS records\n`);

  // Create update records with Approval status = "Approved" and Class = "Mineral"
  const updateRecords = records.map(record => ({
    'Mindat ID': record['Mindat ID'],
    'Approval status': 'Approved',
    'Class': 'Mineral'
  }));

  console.log(`✅ Created ${updateRecords.length} update records\n`);

  // Write output file
  const outputPath = '/tmp/phase1-enrichment/mindat_NEW_MINERALS_UPDATE.csv';
  const outputCSV = stringify(updateRecords, { header: true, bom: true });
  fs.writeFileSync(outputPath, outputCSV, 'utf-8');

  console.log(`📝 Wrote update file to: mindat_NEW_MINERALS_UPDATE.csv`);
  console.log(`\nThis file contains:`);
  console.log(`  - Mindat ID (unique key for matching)`);
  console.log(`  - Approval status = "Approved"`);
  console.log(`  - Class = "Mineral"\n`);

  console.log('✅ Update file created!\n');
}

createNewMineralsUpdate().catch(console.error);
