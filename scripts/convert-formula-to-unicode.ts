#!/usr/bin/env tsx
/**
 * Convert HTML formula entities to Unicode characters
 * Handles subscripts, superscripts, and special characters
 *
 * Usage:
 *   npm run convert-formula
 *   or
 *   tsx scripts/convert-formula-to-unicode.ts [input-path] [output-path]
 */

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';

// Unicode mappings
const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'h': 'ₕ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'p': 'ₚ',
  's': 'ₛ', 't': 'ₜ'
};

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ'
};

// Special character replacements
const SPECIAL_CHARS: Record<string, string> = {
  '&middot;': '·',
  '&#183;': '·',
  '□': '☐',  // Box character - using ballot box
  '◻': '☐',
  '▫': '☐',
  '&square;': '☐',
  '&#9633;': '☐',
  '&bull;': '•',
  '&#8226;': '•',
  '&deg;': '°',
  '&#176;': '°',
  '&times;': '×',
  '&#215;': '×',
  '&divide;': '÷',
  '&#247;': '÷',
  '&alpha;': 'α',
  '&beta;': 'β',
  '&gamma;': 'γ',
  '&delta;': 'δ',
  '&Delta;': 'Δ',
  '&micro;': 'μ',
  '&Omega;': 'Ω',
  '&omega;': 'ω'
};

function convertFormula(formula: string): string {
  if (!formula) return formula;

  let result = formula;

  // Replace subscripts: <sub>...</sub>
  result = result.replace(/<sub>([^<]+)<\/sub>/g, (_, content) => {
    return content.split('').map((char: string) => SUBSCRIPT_MAP[char] || char).join('');
  });

  // Replace superscripts: <sup>...</sup>
  result = result.replace(/<sup>([^<]+)<\/sup>/g, (_, content) => {
    return content.split('').map((char: string) => SUPERSCRIPT_MAP[char] || char).join('');
  });

  // Replace numeric HTML entities (decimal): &#9723; -> character
  result = result.replace(/&#(\d+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });

  // Replace numeric HTML entities (hexadecimal): &#xB7; -> character
  result = result.replace(/&#x([0-9A-Fa-f]+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });

  // Replace named HTML entities
  for (const [html, unicode] of Object.entries(SPECIAL_CHARS)) {
    result = result.replace(new RegExp(html.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), unicode);
  }

  // Clean up any remaining HTML tags
  result = result.replace(/<[^>]+>/g, '');

  return result;
}

async function convertCSVFormulas(inputPath: string, outputPath: string) {
  console.log('=== Convert Formula HTML to Unicode ===\n');
  console.log(`📁 Input: ${inputPath}`);
  console.log(`📂 Output: ${outputPath}\n`);

  // Read input CSV
  const csvContent = fs.readFileSync(inputPath, 'utf-8');

  // Parse CSV with BOM handling
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
    trim: true
  }) as any[];

  console.log(`✅ Loaded ${records.length} records from CSV\n`);

  // Track conversions
  let convertedCount = 0;
  const examples: Array<{ name: string; before: string; after: string }> = [];

  // Convert formulas
  records.forEach(record => {
    if (record.Formula) {
      const original = record.Formula;
      const converted = convertFormula(original);

      if (original !== converted) {
        convertedCount++;
        if (examples.length < 10) {
          examples.push({
            name: record.Title || record.name || 'Unknown',
            before: original,
            after: converted
          });
        }
        record.Formula = converted;
      }
    }
  });

  console.log(`📊 Conversion Results:`);
  console.log(`   ✅ Formulas converted: ${convertedCount}`);
  console.log(`   ℹ️  Unchanged: ${records.length - convertedCount}\n`);

  if (examples.length > 0) {
    console.log(`🔍 Example conversions (first ${examples.length}):`);
    examples.forEach(({ name, before, after }) => {
      console.log(`   ${name}:`);
      console.log(`      Before: ${before}`);
      console.log(`      After:  ${after}`);
    });
    console.log();
  }

  // Write output CSV
  const outputCsv = stringify(records, {
    header: true,
    quoted: true,
    quoted_empty: true,
    bom: true
  });

  fs.writeFileSync(outputPath, outputCsv, 'utf-8');

  console.log(`✅ Wrote ${records.length} records to ${outputPath}`);
  console.log('\n✅ Conversion complete!\n');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Default: process both files
    const files = [
      {
        input: '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL.csv',
        output: '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL.csv'
      },
      {
        input: '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL_TEST.csv',
        output: '/tmp/phase1-enrichment/mindat_NEW_MINERALS_FINAL_TEST.csv'
      }
    ];

    for (const file of files) {
      if (fs.existsSync(file.input)) {
        await convertCSVFormulas(file.input, file.output);
      } else {
        console.log(`⚠️  Skipping ${file.input} (not found)\n`);
      }
    }
  } else {
    const inputPath = args[0];
    const outputPath = args[1] || inputPath;
    await convertCSVFormulas(inputPath, outputPath);
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
