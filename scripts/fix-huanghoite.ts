#!/usr/bin/env tsx

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';

const csvPath = '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL_REFRESHED.csv';
const content = fs.readFileSync(csvPath, 'utf-8');
const records = parse(content, {
  columns: true,
  skip_empty_lines: true,
  bom: true,
  relax_column_count: true,
  relax_quotes: true
});

// Find and update Huanghoite-(Nd)
const record = records.find((r: any) => r['Mindat ID'] === '472236');
if (record) {
  record.Formula = ' BaNd(CO<sub>3</sub>)<sub>2</sub>F';
  record.Strunz = '5.AB.35';
  console.log('✅ Updated Huanghoite-(Nd) with formula and strunz');
}

// Write back
const output = stringify(records, { header: true, bom: true });
fs.writeFileSync(csvPath, output, 'utf-8');

console.log('✅ File updated');
