#!/usr/bin/env tsx

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as path from 'path';

interface UpdateRecord {
  Title: string;
  'Mindat ID': string;
  'Mindat URL': string;
  Nid: string;
  [key: string]: string;
}

interface NewMineralRecord {
  Title: string;
  'Mindat ID': string;
  'Mindat URL': string;
  [key: string]: string;
}

async function crossCheckDuplicates() {
  console.log('=== Cross-Check for Duplicate Minerals ===\n');

  // Read the UPDATE_TITLES file (46 matches)
  const updatePath = '/tmp/phase1-enrichment/erocks_UPDATE_TITLES_UNICODE.csv';
  const updateContent = fs.readFileSync(updatePath, 'utf-8');
  const updateRecords = parse(updateContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true
  }) as UpdateRecord[];

  console.log(`📁 Loaded ${updateRecords.length} records from erocks_UPDATE_TITLES_UNICODE.csv\n`);

  // Read the NEW_MINERALS file (already uploaded)
  const newMineralsPath = '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL.csv';
  const newMineralsContent = fs.readFileSync(newMineralsPath, 'utf-8');
  const newMineralsRecords = parse(newMineralsContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true
  }) as NewMineralRecord[];

  console.log(`📁 Loaded ${newMineralsRecords.length} records from mindat_NEW_MINERALS_FINAL.csv\n`);

  // Build a Set of Mindat IDs from NEW_MINERALS for fast lookup
  const newMineralsIds = new Set(
    newMineralsRecords
      .map(r => r['Mindat ID']?.trim())
      .filter(id => id && id !== '')
  );

  console.log(`🔍 Found ${newMineralsIds.size} unique Mindat IDs in NEW_MINERALS file\n`);

  // Cross-check
  const duplicates: UpdateRecord[] = [];
  const unique: UpdateRecord[] = [];

  for (const record of updateRecords) {
    const mindatId = record['Mindat ID']?.trim();

    if (!mindatId || mindatId === '') {
      console.log(`⚠️  No Mindat ID for: ${record.Title} (Nid: ${record.Nid})`);
      unique.push(record);
      continue;
    }

    if (newMineralsIds.has(mindatId)) {
      duplicates.push(record);
      console.log(`🔁 DUPLICATE: ${record.Title} (Mindat ID: ${mindatId}, Nid: ${record.Nid})`);
    } else {
      unique.push(record);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n✅ Unique minerals (not in NEW_MINERALS): ${unique.length}`);
  console.log(`🔁 Duplicates (already in NEW_MINERALS): ${duplicates.length}`);
  console.log(`📊 Total checked: ${updateRecords.length}\n`);

  // Write output files
  const outputDir = '/tmp/phase1-enrichment';

  // Write UNIQUE minerals (these should be uploaded)
  const uniquePath = path.join(outputDir, 'erocks_UPDATE_TITLES_UNIQUE.csv');
  const uniqueCSV = stringify(unique, { header: true, bom: true });
  fs.writeFileSync(uniquePath, uniqueCSV, 'utf-8');
  console.log(`📝 Wrote ${unique.length} unique records to: erocks_UPDATE_TITLES_UNIQUE.csv`);

  // Write DUPLICATES for review
  const duplicatesPath = path.join(outputDir, 'erocks_UPDATE_TITLES_DUPLICATES.csv');
  const duplicatesCSV = stringify(duplicates, { header: true, bom: true });
  fs.writeFileSync(duplicatesPath, duplicatesCSV, 'utf-8');
  console.log(`📝 Wrote ${duplicates.length} duplicate records to: erocks_UPDATE_TITLES_DUPLICATES.csv`);

  // Create a detailed report
  const reportPath = path.join(outputDir, 'duplicate_check_report.txt');
  let report = '═══════════════════════════════════════════════════════════════\n';
  report += '  DUPLICATE CHECK REPORT\n';
  report += '═══════════════════════════════════════════════════════════════\n\n';
  report += `Total UPDATE_TITLES records checked: ${updateRecords.length}\n`;
  report += `Total NEW_MINERALS records: ${newMineralsRecords.length}\n\n`;
  report += `✅ UNIQUE minerals (not in NEW_MINERALS): ${unique.length}\n`;
  report += `🔁 DUPLICATES (already in NEW_MINERALS): ${duplicates.length}\n\n`;

  if (duplicates.length > 0) {
    report += '───────────────────────────────────────────────────────────────\n';
    report += '  DUPLICATE MINERALS (Already Uploaded)\n';
    report += '───────────────────────────────────────────────────────────────\n\n';

    for (const dup of duplicates) {
      report += `"${dup.Title}"\n`;
      report += `  Nid: ${dup.Nid} | Mindat ID: ${dup['Mindat ID']}\n`;
      report += `  URL: ${dup['Mindat URL']}\n\n`;
    }
  }

  if (unique.length > 0) {
    report += '───────────────────────────────────────────────────────────────\n';
    report += '  UNIQUE MINERALS (Should Be Uploaded)\n';
    report += '───────────────────────────────────────────────────────────────\n\n';

    for (const uniq of unique) {
      report += `"${uniq.Title}"\n`;
      report += `  Nid: ${uniq.Nid} | Mindat ID: ${uniq['Mindat ID']}\n`;
      report += `  URL: ${uniq['Mindat URL']}\n\n`;
    }
  }

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`📝 Wrote detailed report to: duplicate_check_report.txt\n`);

  console.log('✅ Cross-check complete!\n');
}

crossCheckDuplicates().catch(console.error);
