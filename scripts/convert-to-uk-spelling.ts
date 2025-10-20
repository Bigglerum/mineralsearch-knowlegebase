#!/usr/bin/env tsx
/**
 * Convert US English to UK English Spelling
 *
 * Converts American spellings to British spellings in CSV files:
 * - color → colour
 * - sulfur → sulphur (including compounds: sulfate → sulphate, sulfide → sulphide, etc.)
 *
 * IMPORTANT: Only converts text content, NOT chemical formulas or element symbols
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

interface ConversionRule {
  us: RegExp;
  uk: string;
  description: string;
}

// Conversion rules - order matters! More specific rules first
const CONVERSION_RULES: ConversionRule[] = [
  // Sulfur compounds (must come before generic 'sulfur')
  { us: /\bsulfate\b/gi, uk: 'sulphate', description: 'sulfate → sulphate' },
  { us: /\bsulfates\b/gi, uk: 'sulphates', description: 'sulfates → sulphates' },
  { us: /\bsulfide\b/gi, uk: 'sulphide', description: 'sulfide → sulphide' },
  { us: /\bsulfides\b/gi, uk: 'sulphides', description: 'sulfides → sulphides' },
  { us: /\bsulfite\b/gi, uk: 'sulphite', description: 'sulfite → sulphite' },
  { us: /\bsulfites\b/gi, uk: 'sulphites', description: 'sulfites → sulphites' },
  { us: /\bsulfosalt\b/gi, uk: 'sulphosalt', description: 'sulfosalt → sulphosalt' },
  { us: /\bsulfosalts\b/gi, uk: 'sulphosalts', description: 'sulfosalts → sulphosalts' },
  { us: /\bsulfuric\b/gi, uk: 'sulphuric', description: 'sulfuric → sulphuric' },
  { us: /\bsulfurous\b/gi, uk: 'sulphurous', description: 'sulfurous → sulphurous' },

  // Generic sulfur
  { us: /\bsulfur\b/gi, uk: 'sulphur', description: 'sulfur → sulphur' },

  // Color variations
  { us: /\bcolor\b/gi, uk: 'colour', description: 'color → colour' },
  { us: /\bcolored\b/gi, uk: 'coloured', description: 'colored → coloured' },
  { us: /\bcolorless\b/gi, uk: 'colourless', description: 'colorless → colourless' },
  { us: /\bcolors\b/gi, uk: 'colours', description: 'colors → colours' },

  // Other common US/UK differences in mineralogy
  { us: /\bgray\b/gi, uk: 'grey', description: 'gray → grey' },
  { us: /\bgrayish\b/gi, uk: 'greyish', description: 'grayish → greyish' },
];

function convertToUkSpelling(text: string): { converted: string; changes: string[] } {
  if (!text || typeof text !== 'string') {
    return { converted: text, changes: [] };
  }

  let converted = text;
  const changes: string[] = [];

  for (const rule of CONVERSION_RULES) {
    const matches = text.match(rule.us);
    if (matches) {
      // Preserve case of original
      converted = converted.replace(rule.us, (match) => {
        // Check if original was all caps
        if (match === match.toUpperCase()) {
          return rule.uk.toUpperCase();
        }
        // Check if original was title case
        if (match[0] === match[0].toUpperCase()) {
          return rule.uk.charAt(0).toUpperCase() + rule.uk.slice(1);
        }
        // Otherwise lowercase
        return rule.uk.toLowerCase();
      });
      changes.push(`${rule.description} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
    }
  }

  return { converted, changes };
}

async function convertCsvToUkSpelling(inputPath: string, outputPath: string) {
  console.log('=== Convert to UK English Spelling ===\n');
  console.log(`📁 Input:  ${inputPath}`);
  console.log(`📂 Output: ${outputPath}\n`);

  // Read CSV
  const csvContent = fs.readFileSync(inputPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true
  });

  console.log(`✅ Loaded ${records.length} records\n`);

  // Track statistics
  let totalChanges = 0;
  const changeStats: Record<string, number> = {};
  const exampleChanges: Array<{field: string; before: string; after: string}> = [];

  // Convert each record
  const convertedRecords = records.map((record: any) => {
    const converted: any = {};

    for (const [key, value] of Object.entries(record)) {
      // Skip chemical formula field - don't convert chemical notation
      if (key === 'Formula') {
        converted[key] = value;
        continue;
      }

      const result = convertToUkSpelling(value as string);
      converted[key] = result.converted;

      // Track changes
      if (result.changes.length > 0 && value !== result.converted) {
        totalChanges++;
        result.changes.forEach(change => {
          changeStats[change] = (changeStats[change] || 0) + 1;
        });

        // Store example (first 5)
        if (exampleChanges.length < 5) {
          exampleChanges.push({
            field: key,
            before: value as string,
            after: result.converted
          });
        }
      }
    }

    return converted;
  });

  // Write output
  const output = stringify(convertedRecords, {
    header: true,
    bom: true,
    quoted: true
  });

  fs.writeFileSync(outputPath, output, 'utf-8');

  // Report statistics
  console.log('📊 Conversion Results:');
  console.log(`   ✅ Records with changes: ${totalChanges}`);
  console.log(`   ℹ️  Unchanged: ${records.length - totalChanges}\n`);

  if (Object.keys(changeStats).length > 0) {
    console.log('📝 Changes by type:');
    Object.entries(changeStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([change, count]) => {
        console.log(`   • ${change}: ${count} record${count > 1 ? 's' : ''}`);
      });
    console.log();
  }

  if (exampleChanges.length > 0) {
    console.log('🔍 Example conversions:');
    exampleChanges.forEach(ex => {
      console.log(`   ${ex.field}:`);
      console.log(`      Before: ${ex.before}`);
      console.log(`      After:  ${ex.after}`);
    });
    console.log();
  }

  console.log(`✅ Wrote ${convertedRecords.length} records to ${outputPath}\n`);
  console.log('✅ Conversion complete!\n');
}

// Main execution
const inputFile = process.argv[2] || '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL_FIXED.csv';
const outputFile = process.argv[3] || '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL_FIXED_UK.csv';

convertCsvToUkSpelling(inputFile, outputFile).catch(console.error);
