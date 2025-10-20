#!/usr/bin/env tsx

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as path from 'path';

interface ValidatedRecord {
  Title: string;
  'Mindat ID': string;
  'Mindat URL': string;
  Formula: string;
  'Crystal System': string;
  'Mindat Status': string;
  Nid: string;
  [key: string]: string;
}

interface SourceRecord {
  'Published status': string;
  'Approval status': string;
  Title: string;
  'Mindat ID': string;
  Nid: string;
  [key: string]: string;
}

async function matchCorrectNids() {
  console.log('=== Match Validated Minerals to Correct Nids ===\n');

  // Read validated minerals (17 records)
  const validatedPath = '/tmp/phase1-enrichment/erocks_UPDATE_TITLES_VALIDATED.csv';
  const validatedContent = fs.readFileSync(validatedPath, 'utf-8');
  const validatedRecords = parse(validatedContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true
  }) as ValidatedRecord[];

  console.log(`📁 Loaded ${validatedRecords.length} validated records\n`);

  // Read source file minerals (4).csv
  const sourcePath = '/mnt/c/Users/halwh/Downloads/minerals (4).csv';
  const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
  const sourceRecords = parse(sourceContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true
  }) as SourceRecord[];

  console.log(`📁 Loaded ${sourceRecords.length} source records from minerals (4).csv\n`);

  // Build lookup by Mindat ID
  const sourceByMindatId = new Map<string, SourceRecord>();
  for (const record of sourceRecords) {
    const mindatId = record['Mindat ID']?.trim();
    if (mindatId && mindatId !== '') {
      sourceByMindatId.set(mindatId, record);
    }
  }

  console.log(`🔍 Built lookup with ${sourceByMindatId.size} Mindat IDs from source\n`);

  // Match validated records to source records
  const matched: Array<ValidatedRecord & { CorrectNid: string; SourceTitle: string }> = [];
  const unmatched: ValidatedRecord[] = [];

  for (const validated of validatedRecords) {
    const mindatId = validated['Mindat ID']?.trim();

    if (!mindatId || mindatId === '') {
      console.log(`⚠️  No Mindat ID for: ${validated.Title}`);
      unmatched.push(validated);
      continue;
    }

    const sourceRecord = sourceByMindatId.get(mindatId);

    if (sourceRecord) {
      const correctNid = sourceRecord.Nid?.trim() || '';
      matched.push({
        ...validated,
        CorrectNid: correctNid,
        SourceTitle: sourceRecord.Title
      });
      console.log(`✅ MATCHED: ${validated.Title}`);
      console.log(`   Validated Nid: ${validated.Nid} → Correct Nid: ${correctNid}`);
      console.log(`   Mindat ID: ${mindatId}\n`);
    } else {
      console.log(`❌ NOT FOUND: ${validated.Title} (Mindat ID: ${mindatId})`);
      unmatched.push(validated);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('MATCHING SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n✅ Matched with correct Nids: ${matched.length}`);
  console.log(`❌ Not found in source: ${unmatched.length}`);
  console.log(`📊 Total validated: ${validatedRecords.length}\n`);

  // Write output with correct Nids
  const outputDir = '/tmp/phase1-enrichment';

  const finalRecords = matched.map(item => ({
    'Title': item.Title,
    'Short Description': item['Short Description'] || '',
    'Synonyms': item.Synonyms || '',
    'Mindat ID': item['Mindat ID'],
    'Mindat URL': item['Mindat URL'],
    'Formula': item.Formula || '',
    'Crystal System': item['Crystal System'] || '',
    'Hardness Min': item['Hardness Min'] || '',
    'Hardness Max': item['Hardness Max'] || '',
    'Streak': item.Streak || '',
    'Tenacity': item.Tenacity || '',
    'Colour': item.Colour || '',
    'Type Locality': item['Type Locality'] || '',
    'Strunz': item.Strunz || '',
    'Mindat Status': item['Mindat Status'],
    'Variety Of': item['Variety Of'] || '',
    'Group Parent': item['Group Parent'] || '',
    'Polymorph of': item['Polymorph of'] || '',
    'Polytype Of': item['Polytype Of'] || '',
    'Mixture of': item['Mixture of'] || '',
    'Synonym of': item['Synonym of'] || '',
    'Habit of': item['Habit of'] || '',
    'Renamed To': item['Renamed To'] || '',
    'Unnamed': item.Unnamed || '',
    'Class': item.Class || '',
    'Nid': item.CorrectNid  // Use CORRECT Nid from source
  }));

  const finalPath = path.join(outputDir, 'erocks_UPDATE_TITLES_FINAL.csv');
  const finalCSV = stringify(finalRecords, { header: true, bom: true });
  fs.writeFileSync(finalPath, finalCSV, 'utf-8');
  console.log(`✅ Wrote ${finalRecords.length} records with CORRECT Nids to: erocks_UPDATE_TITLES_FINAL.csv\n`);

  // Write report
  const reportPath = path.join(outputDir, 'correct_nids_report.txt');
  let report = '═══════════════════════════════════════════════════════════════\n';
  report += '  CORRECT NIDS MATCHING REPORT\n';
  report += '═══════════════════════════════════════════════════════════════\n\n';
  report += `Total validated records: ${validatedRecords.length}\n`;
  report += `✅ Matched with correct Nids: ${matched.length}\n`;
  report += `❌ Not found in source: ${unmatched.length}\n\n`;

  if (matched.length > 0) {
    report += '───────────────────────────────────────────────────────────────\n';
    report += '  MATCHED RECORDS (With Correct Nids)\n';
    report += '───────────────────────────────────────────────────────────────\n\n';

    for (const item of matched) {
      report += `"${item.Title}"\n`;
      report += `  Mindat ID: ${item['Mindat ID']}\n`;
      report += `  Old Nid: ${item.Nid} → Correct Nid: ${item.CorrectNid}\n`;
      report += `  Source Title: "${item.SourceTitle}"\n\n`;
    }
  }

  if (unmatched.length > 0) {
    report += '───────────────────────────────────────────────────────────────\n';
    report += '  UNMATCHED RECORDS (Not Found in Source)\n';
    report += '───────────────────────────────────────────────────────────────\n\n';

    for (const item of unmatched) {
      report += `"${item.Title}"\n`;
      report += `  Mindat ID: ${item['Mindat ID']}\n`;
      report += `  Nid: ${item.Nid}\n\n`;
    }
  }

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`📝 Wrote detailed report to: correct_nids_report.txt\n`);

  console.log('✅ Matching complete!\n');
}

matchCorrectNids().catch(console.error);
