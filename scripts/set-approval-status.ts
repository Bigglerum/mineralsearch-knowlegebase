#!/usr/bin/env tsx

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';

const inputPath = '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL_FIXED.csv';
const outputPath = '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL_FIXED.csv';

console.log('Setting Approval status to "Approved" for all records...\n');

const content = fs.readFileSync(inputPath, 'utf-8');
const records = parse(content, {
  columns: true,
  skip_empty_lines: true,
  bom: true,
  relax_column_count: true,
  relax_quotes: true
});

console.log(`Total records: ${records.length}\n`);

let updated = 0;
records.forEach((record: any) => {
  if (!record['Approval status'] || record['Approval status'].trim() === '') {
    record['Approval status'] = 'Approved';
    updated++;
  }
});

console.log(`Updated ${updated} records to "Approved"\n`);

const output = stringify(records, { header: true, bom: true });
fs.writeFileSync(outputPath, output, 'utf-8');

console.log('✅ Done!\n');
