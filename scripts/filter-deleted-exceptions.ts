#!/usr/bin/env tsx
/**
 * Filter Deleted Exceptions
 *
 * Compares erocks_EXCEPTIONS.csv with the current e-rocks export (minerals 4.csv)
 * to remove exceptions for minerals that have been deleted from e-rocks.
 *
 * This reduces the exceptions count by filtering out records that no longer exist.
 */

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';

const exceptionsPath = '/tmp/phase1-enrichment/erocks_EXCEPTIONS.csv';
const currentErocksPath = '/mnt/c/Users/halwh/Downloads/minerals (4).csv';
const outputPath = '/tmp/phase1-enrichment/erocks_EXCEPTIONS_FILTERED.csv';

console.log('=== Filter Deleted Exceptions ===\n');

// Read exceptions file
console.log('📁 Reading exceptions file...');
const exceptionsContent = fs.readFileSync(exceptionsPath, 'utf-8');
const exceptions = parse(exceptionsContent, {
  columns: true,
  skip_empty_lines: true,
  bom: true,
  relax_column_count: true,
  relax_quotes: true
});

console.log(`   Found ${exceptions.length} exception records\n`);

// Read current e-rocks export
console.log('📁 Reading current e-rocks export...');
const currentContent = fs.readFileSync(currentErocksPath, 'utf-8');
const currentRecords = parse(currentContent, {
  columns: true,
  skip_empty_lines: true,
  bom: true,
  relax_column_count: true,
  relax_quotes: true
});

console.log(`   Found ${currentRecords.length} current e-rocks records\n`);

// Create lookup by Nid
const currentNids = new Set(currentRecords.map((r: any) => r.Nid?.trim()));

console.log('🔍 Filtering exceptions...\n');

// Filter exceptions to only include those still in current export
const stillExists = exceptions.filter((exc: any) => {
  const nid = exc.Nid?.trim();
  return currentNids.has(nid);
});

const deleted = exceptions.length - stillExists.length;

console.log(`📊 Results:`);
console.log(`   Original exceptions: ${exceptions.length}`);
console.log(`   Still exist in e-rocks: ${stillExists.length}`);
console.log(`   Deleted from e-rocks: ${deleted}`);
console.log(`   Reduction: ${((deleted / exceptions.length) * 100).toFixed(1)}%\n`);

// Write filtered exceptions
const output = stringify(stillExists, { header: true, bom: true });
fs.writeFileSync(outputPath, output, 'utf-8');

console.log(`✅ Wrote filtered exceptions to: ${outputPath}\n`);

// Show sample of deleted records
if (deleted > 0) {
  const deletedRecords = exceptions.filter((exc: any) => !currentNids.has(exc.Nid?.trim()));
  console.log('📋 Sample of deleted records:');
  deletedRecords.slice(0, 10).forEach((rec: any) => {
    console.log(`   - ${rec.Title} (Nid: ${rec.Nid})`);
  });
  if (deleted > 10) {
    console.log(`   ... and ${deleted - 10} more\n`);
  }
}

console.log('✅ Done!\n');
