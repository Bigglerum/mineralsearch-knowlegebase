#!/usr/bin/env tsx
/**
 * Enrich E-Rocks Data with ALL Rules Applied
 *
 * Comprehensive enrichment that applies all documented rules:
 * 1. Match by Mindat ID or name (ONLY update existing e-rocks records)
 * 2. Only use APPROVED/PENDING/GRANDFATHERED minerals from Mindat
 * 3. Strunz: concatenate with zero-padding (05 not 5) and 'x' placeholders
 * 4. Class field: Mineral vs Mineral Group based on entry_type_text
 * 5. Filter out invalid strunz codes (0.00.x)
 * 6. Formula: Unicode conversion (no HTML)
 * 7. Preserve e-rocks node titles (DO NOT overwrite)
 * 8. Include ALL 26 columns (Replace mode requirement)
 */

import 'dotenv/config';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Unicode conversion for formulas
function convertFormulaToUnicode(html: string): string {
  if (!html || typeof html !== 'string') return html;

  let result = html;

  // Subscript mappings
  const subscripts: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    'x': 'ₓ'
  };

  // Superscript mappings
  const superscripts: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', 'n': 'ⁿ'
  };

  // Convert subscripts
  result = result.replace(/<sub>([^<]+)<\/sub>/g, (_, content) => {
    return content.split('').map((c: string) => subscripts[c] || c).join('');
  });

  // Convert superscripts
  result = result.replace(/<sup>([^<]+)<\/sup>/g, (_, content) => {
    return content.split('').map((c: string) => superscripts[c] || c).join('');
  });

  // Convert HTML entities
  const entities: Record<string, string> = {
    '&middot;': '·',
    '&#183;': '·',
    '&#9723;': '☐',
    '&#x25FB;': '☐',
    '&#9723': '☐',
    '□': '☐',
    '◻': '☐',
    '&alpha;': 'α',
    '&beta;': 'β',
    '&gamma;': 'γ',
    '&delta;': 'δ'
  };

  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'g'), char);
  }

  // Convert numeric HTML entities
  result = result.replace(/&#(\d+);?/g, (_, code) =>
    String.fromCharCode(parseInt(code))
  );
  result = result.replace(/&#x([0-9A-Fa-f]+);?/g, (_, code) =>
    String.fromCharCode(parseInt(code, 16))
  );

  // Strip any remaining HTML tags
  result = result.replace(/<[^>]+>/g, '');

  return result;
}

// Build strunz with zero-padding and 'x' placeholders
function buildStrunz(ed1: string, ed2: string, ed3: string, ed4: string): string {
  // Filter out invalid strunz (ed1 = '0')
  if (!ed1 || ed1 === '0' || ed1 === '0.0' || ed1 === '0.00') {
    return '';
  }

  let strunz = ed1;

  if (ed2) {
    strunz += '.' + ed2;
    if (ed3) {
      strunz += ed3;
      if (ed4) {
        // Zero-pad ed4 to 2 digits: "5" → "05"
        const padded = ed4.toString().padStart(2, '0');
        strunz += '.' + padded;
      } else {
        strunz += '.x';
      }
    } else {
      strunz += 'x';
    }
  }

  return strunz;
}

async function enrichErocksWithAllRules(inputPath: string, outputPath: string) {
  console.log('=== Enrich E-Rocks Data with ALL Rules ===\n');
  console.log(`📁 Input:  ${inputPath}`);
  console.log(`📂 Output: ${outputPath}\n`);

  // Read input CSV
  const csvContent = fs.readFileSync(inputPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true
  });

  console.log(`✅ Loaded ${records.length} records from e-rocks export\n`);

  // Process ALL records (don't filter by Class - it's inconsistent in this export)
  const minerals = records;

  // Statistics
  let matched = 0;
  let matchedById = 0;
  let matchedByName = 0;
  let unmatched = 0;
  let enriched = 0;
  let skipped = 0;

  const enrichedRecords: any[] = [];

  console.log('🔄 Processing records...\n');

  for (let i = 0; i < minerals.length; i++) {
    const erocks = minerals[i];

    if ((i + 1) % 500 === 0) {
      console.log(`   Processed ${i + 1}/${minerals.length} records...`);
    }

    // Skip non-minerals (Rock, Fossil, Man Made, etc.)
    const classValue = erocks.Class?.toString().trim() || '';
    if (classValue && !['Mineral', 'Mineral Group', ''].includes(classValue)) {
      enrichedRecords.push(erocks);
      skipped++;
      continue;
    }

    let mindatData: any = null;

    // Try to match by Mindat ID first
    const mindatIdRaw = erocks['Mindat ID']?.toString().trim() || '';
    const mindatId = mindatIdRaw.replace(/['"]/g, ''); // Remove quotes
    if (mindatId && mindatId !== '' && !mindatId.startsWith('ER') && /^\d+$/.test(mindatId)) {
      try {
        const results = await sql`
          SELECT
            mindat_id,
            name,
            ima_formula,
            mindat_formula,
            crystal_system,
            mohs_hardness_min,
            mohs_hardness_max,
            streak,
            tenacity,
            colour,
            type_locality,
            strunz10ed1,
            strunz10ed2,
            strunz10ed3,
            strunz10ed4,
            entry_type_text,
            ima_status
          FROM mindat_minerals
          WHERE mindat_id = ${parseInt(mindatId)}
            AND (
              ima_status ILIKE '%APPROVED%'
              OR ima_status ILIKE '%PENDING%'
              OR ima_status ILIKE '%GRANDFATHERED%'
            )
          LIMIT 1
        `;

        if (results.length > 0) {
          mindatData = results[0];
          matchedById++;
        }
      } catch (error) {
        // Continue without match
      }
    }

    // Try to match by name if no ID match
    if (!mindatData) {
      const title = erocks.Title?.toString().trim();
      if (title) {
        try {
          const results = await sql`
            SELECT
              mindat_id,
              name,
              ima_formula,
              mindat_formula,
              crystal_system,
              mohs_hardness_min,
              mohs_hardness_max,
              streak,
              tenacity,
              colour,
              type_locality,
              strunz10ed1,
              strunz10ed2,
              strunz10ed3,
              strunz10ed4,
              entry_type_text,
              ima_status
            FROM mindat_minerals
            WHERE LOWER(name) = LOWER(${title})
              AND (
                ima_status ILIKE '%APPROVED%'
                OR ima_status ILIKE '%PENDING%'
                OR ima_status ILIKE '%GRANDFATHERED%'
              )
            LIMIT 1
          `;

          if (results.length > 0) {
            mindatData = results[0];
            matchedByName++;
          }
        } catch (error) {
          // Continue without match
        }
      }
    }

    // Build enriched record
    if (mindatData) {
      matched++;

      // Build strunz with zero-padding
      const strunz = buildStrunz(
        mindatData.strunz10ed1,
        mindatData.strunz10ed2,
        mindatData.strunz10ed3,
        mindatData.strunz10ed4
      );

      // Get formula (prefer IMA, fallback to Mindat)
      let formula = mindatData.ima_formula || mindatData.mindat_formula || erocks.Formula || '';

      // Convert formula to Unicode
      if (formula) {
        formula = convertFormulaToUnicode(formula);
      }

      // Determine Class field
      let classValue = 'Mineral';
      if (mindatData.entry_type_text === 'grouplist') {
        classValue = 'Mineral Group';
      }

      // Build hardness
      let hardness = '';
      if (mindatData.mohs_hardness_min && mindatData.mohs_hardness_max) {
        if (mindatData.mohs_hardness_min === mindatData.mohs_hardness_max) {
          hardness = mindatData.mohs_hardness_min.toString();
        } else {
          hardness = `${mindatData.mohs_hardness_min}-${mindatData.mohs_hardness_max}`;
        }
      } else if (mindatData.mohs_hardness_min) {
        hardness = mindatData.mohs_hardness_min.toString();
      }

      enrichedRecords.push({
        ...erocks,
        'Mindat ID': mindatData.mindat_id,
        'Mindat URL': `https://www.mindat.org/min-${mindatData.mindat_id}.html`,
        'Formula': formula,
        'Crystal System': mindatData.crystal_system || erocks['Crystal System'] || '',
        'Hardness (Mohs)': hardness || erocks['Hardness (Mohs)'] || '',
        'Streak': mindatData.streak || erocks.Streak || '',
        'Tenacity': mindatData.tenacity || erocks.Tenacity || '',
        'Colour': mindatData.colour || erocks.Colour || '',
        'Strunz Classification': strunz || erocks['Strunz Classification'] || '',
        'Mindat Status': mindatData.ima_status || '',
        'Type Locality': mindatData.type_locality || erocks['Type Locality'] || '',
        'Class': classValue
      });

      enriched++;
    } else {
      // No match - keep original record
      enrichedRecords.push(erocks);
      unmatched++;
    }
  }

  console.log(`\n✅ Processing complete!\n`);

  // Write output
  const output = stringify(enrichedRecords, {
    header: true,
    bom: true,
    quoted: true
  });

  fs.writeFileSync(outputPath, output, 'utf-8');

  // Report statistics
  const mineralsProcessed = minerals.length - skipped;
  console.log('📊 Enrichment Results:');
  console.log(`   Total records: ${minerals.length}`);
  console.log(`   ⏭️  Skipped (non-minerals): ${skipped}`);
  console.log(`   🔍 Minerals processed: ${mineralsProcessed}`);
  console.log(`   ✅ Matched: ${matched} (${mineralsProcessed > 0 ? ((matched/mineralsProcessed)*100).toFixed(1) : 0}%)`);
  console.log(`      - By Mindat ID: ${matchedById}`);
  console.log(`      - By name: ${matchedByName}`);
  console.log(`   ❌ Unmatched: ${unmatched} (${mineralsProcessed > 0 ? ((unmatched/mineralsProcessed)*100).toFixed(1) : 0}%)`);
  console.log(`   📝 Enriched with data: ${enriched}\n`);

  console.log(`✅ Wrote ${enrichedRecords.length} records to ${outputPath}\n`);
  console.log('✅ Enrichment complete!\n');
  console.log('⚠️  Next step: Run UK spelling conversion on this file\n');
}

// Main execution
const inputFile = process.argv[2] || '/mnt/c/Users/halwh/Downloads/minerals (4).csv';
const outputFile = process.argv[3] || '/tmp/phase1-enrichment/e-Rocks_UPDATE_4.csv';

enrichErocksWithAllRules(inputFile, outputFile).catch(console.error);
