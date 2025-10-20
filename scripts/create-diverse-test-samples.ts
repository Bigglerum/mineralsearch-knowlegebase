#!/usr/bin/env tsx
/**
 * Create Diverse Test Samples
 *
 * Extracts 10 diverse samples from e-Rocks_UPDATE_4_UK.csv that demonstrate:
 * 1. Zero-padded strunz (e.g., 2.HA.05)
 * 2. UK spelling (colour, sulphur, grey)
 * 3. Unicode formulas
 * 4. Different classes (Mineral, Mineral Group)
 * 5. Complete enrichment with Mindat data
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const inputFile = '/tmp/phase1-enrichment/e-Rocks_UPDATE_4_UK.csv';
const outputFile = '/tmp/phase1-enrichment/e-Rocks_UPDATE_4_UK_TEST.csv';

const csvContent = fs.readFileSync(inputFile, 'utf-8');
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  bom: true
});

console.log(`✅ Loaded ${records.length} records\n`);

// Select diverse samples
const samples: any[] = [];

// 1. Mineral with zero-padded strunz (*.*.05 or *.*.0x)
const zeroPadded = records.find((r: any) =>
  r['Strunz'] && /\.\d\d$/.test(r['Strunz']) && r['Mindat ID'] && r.Formula
);
if (zeroPadded) samples.push(zeroPadded);

// 2. Mineral with "colour" (UK spelling)
const withColour = records.find((r: any) =>
  r.Colour && r.Colour.toLowerCase().includes('colour') && r['Mindat ID']
);
if (withColour) samples.push(withColour);

// 3. Mineral with "grey" (UK spelling)
const withGrey = records.find((r: any) =>
  r.Colour && r.Colour.toLowerCase().includes('grey') && r['Mindat ID'] && !samples.includes(r)
);
if (withGrey) samples.push(withGrey);

// 4. Mineral with "sulphur" or "sulphate" (UK spelling)
const withSulphur = records.find((r: any) =>
  ((r.Colour && r.Colour.toLowerCase().includes('sulph')) ||
   (r.Formula && r.Formula.toLowerCase().includes('sulph'))) &&
  r['Mindat ID'] && !samples.includes(r)
);
if (withSulphur) samples.push(withSulphur);

// 5. Mineral Group (Class = "Mineral Group")
const mineralGroup = records.find((r: any) =>
  r.Class === 'Mineral Group' && r['Mindat ID']
);
if (mineralGroup) samples.push(mineralGroup);

// 6. Mineral with Unicode formula (subscripts/superscripts)
const withUnicode = records.find((r: any) =>
  r.Formula && (/[₀-₉]/.test(r.Formula) || /[⁰-⁹⁺⁻]/.test(r.Formula)) &&
  r['Mindat ID'] && !samples.includes(r)
);
if (withUnicode) samples.push(withUnicode);

// 7. Mineral with hardness range
const withHardness = records.find((r: any) =>
  r['Hardness (Mohs)'] && r['Hardness (Mohs)'].includes('-') &&
  r['Mindat ID'] && !samples.includes(r)
);
if (withHardness) samples.push(withHardness);

// 8. Mineral with complete data (formula, strunz, colour, crystal system)
const withCompleteData = records.find((r: any) =>
  r.Formula && r['Strunz'] && r.Colour && r['Crystal System'] &&
  r['Mindat ID'] && !samples.includes(r)
);
if (withCompleteData) samples.push(withCompleteData);

// 9 & 10. Fill remaining slots with interesting enriched minerals
for (const record of records) {
  if (samples.length >= 10) break;
  if (record['Mindat ID'] && record.Formula && record['Strunz'] && !samples.includes(record)) {
    samples.push(record);
  }
}

console.log(`📝 Selected ${samples.length} diverse samples:\n`);
samples.forEach((s, i) => {
  console.log(`   ${i + 1}. ${s.Title}`);
  console.log(`      - Class: ${s.Class}`);
  console.log(`      - Strunz: ${s['Strunz'] || s['Strunz Classification']}`);
  console.log(`      - Formula: ${s.Formula?.substring(0, 50)}${s.Formula?.length > 50 ? '...' : ''}`);
  console.log(`      - Colour: ${s.Colour?.substring(0, 40)}${s.Colour?.length > 40 ? '...' : ''}`);
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
