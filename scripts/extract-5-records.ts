#!/usr/bin/env tsx

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';

const inputPath = '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL.csv';
const outputPath = '/tmp/phase1-enrichment/RESTORE_5_RECORDS_CLEAN.csv';

const content = fs.readFileSync(inputPath, 'utf-8');
const records = parse(content, {
  columns: true,
  skip_empty_lines: true,
  bom: true,
  relax_column_count: true,
  relax_quotes: true
});

const mindatIds = ['54113', '472206', '472209', '75', '54361'];
const filtered = records.filter((r: any) => mindatIds.includes(r['Mindat ID']));

console.log(`Found ${filtered.length} records`);
filtered.forEach((r: any) => console.log(`  - ${r.Title} (${r['Mindat ID']})`));

const csv = stringify(filtered, { header: true, bom: true });
fs.writeFileSync(outputPath, csv, 'utf-8');

console.log(`\nWrote to: ${outputPath}`);
