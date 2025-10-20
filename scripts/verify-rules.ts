#!/usr/bin/env tsx
/**
 * Verify All Rules Applied
 *
 * Checks that enrichment rules were properly applied:
 * 1. UK spelling (colour, sulphur, grey)
 * 2. Unicode formulas (subscripts/superscripts)
 * 3. Zero-padded strunz (e.g., 2.HA.05)
 * 4. Complete enrichment
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';

console.log('=== Verify Enrichment Rules ===\n');

// Check Unmatched file
console.log('📁 Checking e-Rocks_UPDATE_4_UK_Unmatched.csv...\n');
const unmatchedRecords = parse(
  fs.readFileSync('/tmp/phase1-enrichment/e-Rocks_UPDATE_4_UK_Unmatched.csv', 'utf-8'),
  { columns: true, bom: true, skip_empty_lines: true }
);

console.log(`Total records: ${unmatchedRecords.length}\n`);

// Find records with complete data
const withFormula = unmatchedRecords.filter((r: any) => r.Formula);
const withColour = unmatchedRecords.filter((r: any) => r.Colour);
const withStrunz = unmatchedRecords.filter((r: any) => r['Strunz']);
const withStatus = unmatchedRecords.filter((r: any) => r['Mindat Status']);

console.log('📊 Field Coverage:');
console.log(`   Formulas: ${withFormula.length}/${unmatchedRecords.length}`);
console.log(`   Colours: ${withColour.length}/${unmatchedRecords.length}`);
console.log(`   Strunz: ${withStrunz.length}/${unmatchedRecords.length}`);
console.log(`   Mindat Status: ${withStatus.length}/${unmatchedRecords.length}\n`);

// Check UK spelling in Colour fields
let ukSpellingCount = 0;
for (const r of withColour) {
  const colour = r.Colour?.toLowerCase() || '';
  if (colour.includes('colour') || colour.includes('grey') || colour.includes('sulph')) {
    ukSpellingCount++;
  }
}

// Check Unicode in formulas
let unicodeCount = 0;
for (const r of withFormula) {
  if (/[₀-₉⁰-⁹⁺⁻]/.test(r.Formula)) {
    unicodeCount++;
  }
}

// Check zero-padded strunz
let zeroPaddedCount = 0;
for (const r of withStrunz) {
  if (/\.\d\d$/.test(r['Strunz'])) {
    zeroPaddedCount++;
  }
}

console.log('✓ Rule Verification:');
console.log(`   UK Spelling (colour/grey/sulph): ${ukSpellingCount} records`);
console.log(`   Unicode Formulas: ${unicodeCount}/${withFormula.length} (${((unicodeCount/withFormula.length)*100).toFixed(1)}%)`);
console.log(`   Zero-padded Strunz (*.*.NN): ${zeroPaddedCount}/${withStrunz.length} (${((zeroPaddedCount/withStrunz.length)*100).toFixed(1)}%)\n`);

// Show sample enriched record
const sample = unmatchedRecords.find((r: any) =>
  r.Formula && r.Colour && r['Strunz'] && r['Mindat Status']
);

if (sample) {
  console.log('📝 Sample Enriched Record:\n');
  console.log(`   Title: ${sample.Title}`);
  console.log(`   Mindat ID: ${sample['Mindat ID']}`);
  console.log(`   Formula: ${sample.Formula}`);
  console.log(`   Colour: ${sample.Colour}`);
  console.log(`   Strunz: ${sample['Strunz']}`);
  console.log(`   Mindat Status: ${sample['Mindat Status']}`);
  console.log(`   Crystal System: ${sample['Crystal System']}\n`);
}

// Check Orphans file
console.log('\n📁 Checking e-Rocks_UPDATE_4_Orphans.csv...\n');
const orphansRecords = parse(
  fs.readFileSync('/tmp/phase1-enrichment/e-Rocks_UPDATE_4_Orphans.csv', 'utf-8'),
  { columns: true, bom: true, skip_empty_lines: true }
);

const enrichedOrphans = orphansRecords.filter((r: any) =>
  r['Mindat ID'] && /^\d+$/.test(r['Mindat ID'].toString().trim())
);

console.log(`Total orphans: ${orphansRecords.length}`);
console.log(`Enriched via character matching: ${enrichedOrphans.length}`);
console.log(`True orphans (not found): ${orphansRecords.length - enrichedOrphans.length}\n`);

// Check enriched orphans have all fields
if (enrichedOrphans.length > 0) {
  const orphanWithData = enrichedOrphans.find((r: any) => r.Formula && r['Strunz']);
  if (orphanWithData) {
    console.log('📝 Sample Character-Matched Orphan:\n');
    console.log(`   Title: ${orphanWithData.Title}`);
    console.log(`   Mindat ID: ${orphanWithData['Mindat ID']}`);
    console.log(`   Formula: ${orphanWithData.Formula}`);
    console.log(`   Strunz: ${orphanWithData['Strunz']}`);
    console.log(`   Match Notes: ${orphanWithData['Match Notes']}\n`);
  }
}

console.log('✅ Verification complete!\n');
