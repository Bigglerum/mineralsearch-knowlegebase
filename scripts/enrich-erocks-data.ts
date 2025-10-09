#!/usr/bin/env tsx
/**
 * E-Rocks Data Enrichment Script
 *
 * Matches e-Rocks Drupal mineral data with Mindat database
 * Handles UTF-8 special characters and formula compatibility
 *
 * Usage:
 *   npm run enrich-erocks <input-csv-path> [output-directory]
 *
 * Example:
 *   npm run enrich-erocks "/mnt/c/Users/halwh/Downloads/minerals (1).csv" ./output
 */

import dotenv from 'dotenv';
import path from 'path';
import { ERocksDataEnrichment } from '../server/services/erocks-data-enrichment';

// Load environment variables
dotenv.config();

// Validate DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable is not set');
  console.error('Please ensure .env file exists with DATABASE_URL configured');
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║           E-Rocks Data Enrichment Tool                        ║
╚════════════════════════════════════════════════════════════════╝

Usage:
  npm run enrich-erocks <input-csv-path> [output-directory]

Arguments:
  input-csv-path     Path to e-Rocks CSV export (required)
  output-directory   Directory for output files (default: ./erocks-output)

Example:
  npm run enrich-erocks "/mnt/c/Users/halwh/Downloads/minerals (1).csv"
  npm run enrich-erocks "./minerals.csv" "./output"

Output Files:
  - erocks_enriched_clean.csv   Matched minerals with Mindat data
  - erocks_unmatched.csv         Minerals not found in Mindat
  - erocks_conflicts.csv         Minerals with data conflicts
  - match_report.json            Detailed statistics report

Features:
  ✓ UTF-8 character normalization (accents, Greek letters, etc.)
  ✓ Chemical formula compatibility (subscripts, superscripts)
  ✓ Multi-strategy matching (ID, name variants, formula)
  ✓ Conflict detection (formula, crystal system, etc.)
  ✓ Variety and synonym tracking
`);
    process.exit(0);
  }

  const inputPath = args[0];
  const outputDir = args[1] || './erocks-output';

  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║           E-Rocks Data Enrichment                             ║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

  console.log(`📁 Input CSV: ${inputPath}`);
  console.log(`📂 Output Directory: ${outputDir}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Connected'}\n`);

  const startTime = Date.now();

  try {
    const enrichment = new ERocksDataEnrichment();
    await enrichment.processCSV(inputPath, outputDir);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`⏱️  Total processing time: ${duration} seconds\n`);
    console.log(`✅ Data enrichment completed successfully!\n`);

  } catch (error) {
    console.error(`\n❌ Error during enrichment:`, error);
    process.exit(1);
  }
}

main();
