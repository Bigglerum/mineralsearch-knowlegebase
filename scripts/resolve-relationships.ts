#!/usr/bin/env tsx

import { ERocksRelationshipResolver } from '../server/services/erocks-relationship-resolver';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(`
╔════════════════════════════════════════════════════════════════╗
║           E-Rocks Relationship Resolver (Phase 2)             ║
╚════════════════════════════════════════════════════════════════╝

Usage: npm run resolve-relationships <input-csv> <output-directory>

Arguments:
  input-csv         Path to e-Rocks CSV (post Phase 1 import, with all Nids)
  output-directory  Directory where output files will be created

Example:
  npm run resolve-relationships /path/to/minerals-updated.csv /output/dir

Output Files:
  - erocks_RELATIONSHIPS.csv     Nid + relationship fields for import
  - relationship_report.json      Statistics and summary

Prerequisites:
  1. Phase 1 must be completed
  2. Phase 1 outputs imported into Drupal
  3. Fresh e-Rocks CSV exported with ALL minerals (including new ones)
  4. All minerals must have Nids in the CSV
    `);
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const outputDir = path.resolve(args[1]);

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           E-Rocks Relationship Resolver (Phase 2)             ║
╚════════════════════════════════════════════════════════════════╝

📁 Input CSV: ${inputPath}
📂 Output Directory: ${outputDir}
🗄️  Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Not configured'}

`);

  try {
    const resolver = new ERocksRelationshipResolver();

    console.log('🔄 Starting relationship resolution...\n');

    const relationshipsPath = path.join(outputDir, 'erocks_RELATIONSHIPS.csv');
    const reportPath = path.join(outputDir, 'relationship_report.json');

    // Resolve all relationships
    await resolver.resolveRelationships(inputPath, relationshipsPath);

    // Generate report
    await resolver.generateReport(reportPath);

    console.log('📄 Output files generated:');
    console.log(`   ${relationshipsPath}`);
    console.log(`   ${reportPath}\n`);

    console.log('✅ Relationship resolution completed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Review erocks_RELATIONSHIPS.csv');
    console.log('  2. Import into Drupal to populate relationship fields');
    console.log('  3. Verify entity references are working correctly\n');

  } catch (error) {
    console.error('\n❌ Error during relationship resolution:', error);
    process.exit(1);
  }
}

main();
