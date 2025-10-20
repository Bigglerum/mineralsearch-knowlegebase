#!/usr/bin/env tsx

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as path from 'path';

interface UpdateRecord {
  Title: string;
  'Short Description': string;
  Synonyms: string;
  'Mindat ID': string;
  'Mindat URL': string;
  Formula: string;
  'Crystal System': string;
  'Hardness Min': string;
  'Hardness Max': string;
  Streak: string;
  Tenacity: string;
  Colour: string;
  'Type Locality': string;
  Strunz: string;
  'Mindat Status': string;
  'Variety Of': string;
  'Group Parent': string;
  'Polymorph of': string;
  'Polytype Of': string;
  'Mixture of': string;
  'Synonym of': string;
  'Habit of': string;
  'Renamed To': string;
  Unnamed: string;
  Class: string;
  Nid: string;
}

function isValidMindatStatus(statusField: string): boolean {
  if (!statusField || statusField.trim() === '') {
    return false;
  }

  const status = statusField.toLowerCase();

  // Valid statuses include APPROVED
  if (status.includes('approved')) {
    // Exclude questionable and grandfathered
    if (status.includes('questionable') || status.includes('grandfathered')) {
      return false;
    }
    return true;
  }

  return false;
}

function isInvalidMineral(record: UpdateRecord): { isInvalid: boolean; reason?: string } {
  const title = record.Title?.toLowerCase() || '';
  const mindatStatus = record['Mindat Status'] || '';

  // Check for non-minerals (organic materials, synthetic, etc.)
  const nonMineralKeywords = [
    'coal', 'coral', 'slag', 'stromatolite', 'amber',
    'petroleum', 'asphalt', 'plastic', 'synthetic'
  ];

  for (const keyword of nonMineralKeywords) {
    if (title.includes(keyword)) {
      return { isInvalid: true, reason: `Non-mineral: ${keyword}` };
    }
  }

  // Check for elements (usually not approved minerals)
  const elementKeywords = ['hafnium', 'gold amalgam'];
  for (const keyword of elementKeywords) {
    if (title.includes(keyword)) {
      return { isInvalid: true, reason: 'Element/alloy, not mineral' };
    }
  }

  // Check Mindat Status
  if (!isValidMindatStatus(mindatStatus)) {
    return { isInvalid: true, reason: `Invalid status: "${mindatStatus}"` };
  }

  return { isInvalid: false };
}

async function validateUniqueUpdates() {
  console.log('=== Validate Unique Update Records ===\n');

  // Read the UNIQUE file
  const uniquePath = '/tmp/phase1-enrichment/erocks_UPDATE_TITLES_UNIQUE.csv';
  const uniqueContent = fs.readFileSync(uniquePath, 'utf-8');
  const uniqueRecords = parse(uniqueContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true
  }) as UpdateRecord[];

  console.log(`📁 Loaded ${uniqueRecords.length} unique records\n`);

  // Validate each record
  const valid: UpdateRecord[] = [];
  const invalid: Array<{ record: UpdateRecord; reason: string }> = [];

  for (const record of uniqueRecords) {
    const validation = isInvalidMineral(record);

    if (validation.isInvalid) {
      invalid.push({ record, reason: validation.reason || 'Unknown' });
      console.log(`❌ INVALID: ${record.Title} (Nid: ${record.Nid})`);
      console.log(`   Reason: ${validation.reason}`);
      console.log(`   Status: "${record['Mindat Status']}"\n`);
    } else {
      valid.push(record);
      console.log(`✅ VALID: ${record.Title} (Nid: ${record.Nid})`);
      console.log(`   Status: ${record['Mindat Status']}\n`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n✅ Valid records (should be uploaded): ${valid.length}`);
  console.log(`❌ Invalid records (should be skipped): ${invalid.length}`);
  console.log(`📊 Total checked: ${uniqueRecords.length}\n`);

  // Write output files
  const outputDir = '/tmp/phase1-enrichment';

  // Write VALID minerals (ready for upload)
  const validPath = path.join(outputDir, 'erocks_UPDATE_TITLES_VALIDATED.csv');
  const validCSV = stringify(valid, { header: true, bom: true });
  fs.writeFileSync(validPath, validCSV, 'utf-8');
  console.log(`✅ Wrote ${valid.length} valid records to: erocks_UPDATE_TITLES_VALIDATED.csv`);

  // Write INVALID for review
  const invalidRecords = invalid.map(item => item.record);
  const invalidPath = path.join(outputDir, 'erocks_UPDATE_TITLES_INVALID.csv');
  const invalidCSV = stringify(invalidRecords, { header: true, bom: true });
  fs.writeFileSync(invalidPath, invalidCSV, 'utf-8');
  console.log(`❌ Wrote ${invalid.length} invalid records to: erocks_UPDATE_TITLES_INVALID.csv`);

  // Create a detailed report
  const reportPath = path.join(outputDir, 'validation_report.txt');
  let report = '═══════════════════════════════════════════════════════════════\n';
  report += '  VALIDATION REPORT - UNIQUE TITLE UPDATES\n';
  report += '═══════════════════════════════════════════════════════════════\n\n';
  report += `Total unique records checked: ${uniqueRecords.length}\n\n`;
  report += `✅ VALID (ready for upload): ${valid.length}\n`;
  report += `❌ INVALID (should skip): ${invalid.length}\n\n`;

  if (invalid.length > 0) {
    report += '───────────────────────────────────────────────────────────────\n';
    report += '  INVALID RECORDS (Should Be Skipped)\n';
    report += '───────────────────────────────────────────────────────────────\n\n';

    for (const item of invalid) {
      report += `"${item.record.Title}"\n`;
      report += `  Nid: ${item.record.Nid} | Mindat ID: ${item.record['Mindat ID']}\n`;
      report += `  Status: "${item.record['Mindat Status']}"\n`;
      report += `  Reason: ${item.reason}\n\n`;
    }
  }

  if (valid.length > 0) {
    report += '───────────────────────────────────────────────────────────────\n';
    report += '  VALID RECORDS (Ready for Upload)\n';
    report += '───────────────────────────────────────────────────────────────\n\n';

    for (const rec of valid) {
      report += `"${rec.Title}"\n`;
      report += `  Nid: ${rec.Nid} | Mindat ID: ${rec['Mindat ID']}\n`;
      report += `  Status: ${rec['Mindat Status']}\n`;
      report += `  URL: ${rec['Mindat URL']}\n\n`;
    }
  }

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`📝 Wrote detailed report to: validation_report.txt\n`);

  console.log('✅ Validation complete!\n');
}

validateUniqueUpdates().catch(console.error);
