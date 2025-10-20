#!/usr/bin/env tsx
/**
 * Create Orphans Test Samples
 *
 * Extracts 10 diverse samples from e-Rocks_UPDATE_4_Orphans.csv demonstrating:
 * 1. Character-matched minerals (Giuscaite → Giuşcăite, etc.)
 * 2. True orphans (not found in Mindat)
 * 3. Various mineral types and classes
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const inputFile = '/tmp/phase1-enrichment/e-Rocks_UPDATE_4_Orphans.csv';
const outputFile = '/tmp/phase1-enrichment/e-Rocks_UPDATE_4_Orphans_TEST.csv';

const csvContent = fs.readFileSync(inputFile, 'utf-8');
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  bom: true
});

console.log(`✅ Loaded ${records.length} records\n`);

// Select diverse samples
const samples: any[] = [];

// 1-5: Character-matched minerals (enriched from Neon) - have Mindat ID
const characterMatched = records.filter((r: any) =>
  r['Mindat ID'] && r['Mindat ID'].toString().trim() && /^\d+$/.test(r['Mindat ID'].toString().trim())
);
console.log(`📝 Found ${characterMatched.length} character-matched minerals`);

for (let i = 0; i < Math.min(5, characterMatched.length); i++) {
  samples.push(characterMatched[i]);
}

// 6-10: True orphans (not found) - no Mindat ID or ER ID
const trueOrphans = records.filter((r: any) => {
  const mindatId = r['Mindat ID']?.toString().trim();
  return !mindatId || mindatId === '' || mindatId.startsWith('ER');
});
console.log(`📝 Found ${trueOrphans.length} true orphans\n`);

for (let i = 0; i < Math.min(5, trueOrphans.length); i++) {
  samples.push(trueOrphans[i]);
}

console.log(`📝 Selected ${samples.length} diverse samples:\n`);
samples.forEach((s, i) => {
  console.log(`   ${i + 1}. ${s.Title}`);
  console.log(`      - Mindat ID: ${s['Mindat ID'] || 'None'}`);
  console.log(`      - Match Notes: ${s['Match Notes'] || 'None'}`);
  console.log(`      - Formula: ${s.Formula?.substring(0, 50) || 'None'}`);
  console.log();
});

// Write output
const output = stringify(samples, {
  header: true,
  bom: true,
  quoted: true
});

fs.writeFileSync(outputFile, output, 'utf-8');

console.log(`✅ Wrote ${samples.length} test samples to ${outputFile}\n`);
