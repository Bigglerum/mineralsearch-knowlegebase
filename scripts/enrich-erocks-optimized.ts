#!/usr/bin/env tsx
/**
 * Optimized E-Rocks Enrichment with ALL Rules
 *
 * Fast version: Loads all Mindat data into memory first, then matches in-memory
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

  const subscripts: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', 'x': 'ₓ'
  };

  const superscripts: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', 'n': 'ⁿ'
  };

  result = result.replace(/<sub>([^<]+)<\/sub>/g, (_, content) => {
    return content.split('').map((c: string) => subscripts[c] || c).join('');
  });

  result = result.replace(/<sup>([^<]+)<\/sup>/g, (_, content) => {
    return content.split('').map((c: string) => superscripts[c] || c).join('');
  });

  const entities: Record<string, string> = {
    '&middot;': '·', '&#183;': '·', '&#9723;': '☐', '&#x25FB;': '☐',
    '□': '☐', '◻': '☐', '&alpha;': 'α', '&beta;': 'β', '&gamma;': 'γ', '&delta;': 'δ'
  };

  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'g'), char);
  }

  result = result.replace(/&#(\d+);?/g, (_, code) => String.fromCharCode(parseInt(code)));
  result = result.replace(/&#x([0-9A-Fa-f]+);?/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  result = result.replace(/<[^>]+>/g, '');

  return result;
}

// Build strunz with zero-padding
function buildStrunz(ed1: string, ed2: string, ed3: string, ed4: string): string {
  if (!ed1 || ed1 === '0' || ed1 === '0.0' || ed1 === '0.00') return '';

  let strunz = ed1;
  if (ed2) {
    strunz += '.' + ed2;
    if (ed3) {
      strunz += ed3;
      if (ed4) {
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

async function enrichErocksOptimized(inputPath: string, outputPath: string) {
  console.log('=== Optimized E-Rocks Enrichment with ALL Rules ===\n');

  // Step 1: Load ALL Mindat data into memory
  console.log('📊 Loading Mindat database into memory...');
  const mindatRecords = await sql`
    SELECT
      mindat_id,
      name,
      ima_formula,
      mindat_formula,
      crystal_system,
      hardness_min,
      hardness_max,
      streak,
      tenacity,
      colour,
      type_localities_data as type_locality,
      strunz10ed1,
      strunz10ed2,
      strunz10ed3,
      strunz10ed4,
      entry_type_text,
      ima_status
    FROM mindat_minerals
    WHERE (
      ima_status ILIKE '%APPROVED%'
      OR ima_status ILIKE '%PENDING%'
      OR ima_status ILIKE '%GRANDFATHERED%'
    )
  `;

  console.log(`✅ Loaded ${mindatRecords.length} approved minerals from Mindat\n`);

  // Create lookup maps
  const byId = new Map();
  const byName = new Map();

  for (const record of mindatRecords) {
    byId.set(record.mindat_id.toString(), record);
    byName.set(record.name.toLowerCase(), record);
  }

  // Step 2: Load e-rocks CSV
  console.log('📁 Loading e-rocks export...');
  const csvContent = fs.readFileSync(inputPath, 'utf-8');
  const erocksRecords = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true  // Handle inconsistent column counts
  });

  console.log(`✅ Loaded ${erocksRecords.length} records from e-rocks\n`);

  // Step 3: Enrich records
  console.log('🔄 Enriching records...\n');

  let matched = 0, matchedById = 0, matchedByName = 0, unmatched = 0, skipped = 0, enriched = 0;
  const enrichedRecords: any[] = [];

  for (let i = 0; i < erocksRecords.length; i++) {
    const erocks = erocksRecords[i];

    if ((i + 1) % 1000 === 0) {
      console.log(`   Processed ${i + 1}/${erocksRecords.length} records...`);
    }

    // Skip non-minerals
    const classValue = erocks.Class?.toString().trim() || '';
    if (classValue && !['Mineral', 'Mineral Group', ''].includes(classValue)) {
      enrichedRecords.push(erocks);
      skipped++;
      continue;
    }

    let mindatData: any = null;

    // Try match by Mindat ID
    const mindatIdRaw = erocks['Mindat ID']?.toString().trim() || '';
    const mindatId = mindatIdRaw.replace(/['"]/g, '');
    if (mindatId && /^\d+$/.test(mindatId) && !mindatId.startsWith('ER')) {
      mindatData = byId.get(mindatId);
      if (mindatData) matchedById++;
    }

    // Try match by name
    if (!mindatData) {
      const title = erocks.Title?.toString().trim();
      if (title) {
        mindatData = byName.get(title.toLowerCase());
        if (mindatData) matchedByName++;
      }
    }

    // Build enriched record
    if (mindatData) {
      matched++;

      const strunz = buildStrunz(
        mindatData.strunz10ed1,
        mindatData.strunz10ed2,
        mindatData.strunz10ed3,
        mindatData.strunz10ed4
      );

      let formula = mindatData.ima_formula || mindatData.mindat_formula || erocks.Formula || '';
      if (formula) formula = convertFormulaToUnicode(formula);

      let classValue = 'Mineral';
      if (mindatData.entry_type_text === 'grouplist') classValue = 'Mineral Group';

      let hardness = '';
      if (mindatData.hardness_min && mindatData.hardness_max) {
        hardness = mindatData.hardness_min === mindatData.hardness_max
          ? mindatData.hardness_min.toString()
          : `${mindatData.hardness_min}-${mindatData.hardness_max}`;
      } else if (mindatData.hardness_min) {
        hardness = mindatData.hardness_min.toString();
      }

      enrichedRecords.push({
        ...erocks,
        'Mindat ID': mindatData.mindat_id,
        'Mindat URL': `https://www.mindat.org/min-${mindatData.mindat_id}.html`,
        'Formula': formula,
        'Crystal System': mindatData.crystal_system || erocks['Crystal System'] || '',
        'Hardness (Mohs)': hardness || erocks['Hardness (Mohs)'] || '',
        'Hardness Min': mindatData.hardness_min || erocks['Hardness Min'] || '',
        'Hardness Max': mindatData.hardness_max || erocks['Hardness Max'] || '',
        'Streak': mindatData.streak || erocks.Streak || '',
        'Tenacity': mindatData.tenacity || erocks.Tenacity || '',
        'Colour': mindatData.colour || erocks.Colour || '',
        'Strunz Classification': strunz || erocks['Strunz Classification'] || erocks['Strunz'] || '',
        'Strunz': strunz || erocks['Strunz'] || erocks['Strunz Classification'] || '',
        'Mindat Status': mindatData.ima_status || '',
        'Type Locality': mindatData.type_locality || erocks['Type Locality'] || '',
        'Class': classValue
      });

      enriched++;
    } else {
      enrichedRecords.push(erocks);
      unmatched++;
    }
  }

  // Write output
  const output = stringify(enrichedRecords, {
    header: true,
    bom: true,
    quoted: true
  });

  fs.writeFileSync(outputPath, output, 'utf-8');

  // Report
  const mineralsProcessed = erocksRecords.length - skipped;
  console.log('\n📊 Enrichment Results:');
  console.log(`   Total records: ${erocksRecords.length}`);
  console.log(`   ⏭️  Skipped (non-minerals): ${skipped}`);
  console.log(`   🔍 Minerals processed: ${mineralsProcessed}`);
  console.log(`   ✅ Matched: ${matched} (${mineralsProcessed > 0 ? ((matched/mineralsProcessed)*100).toFixed(1) : 0}%)`);
  console.log(`      - By Mindat ID: ${matchedById}`);
  console.log(`      - By name: ${matchedByName}`);
  console.log(`   ❌ Unmatched: ${unmatched}`);
  console.log(`   📝 Enriched: ${enriched}\n`);

  console.log(`✅ Wrote ${enrichedRecords.length} records to ${outputPath}\n`);
  console.log('⚠️  Next step: Run UK spelling conversion\n');
}

const inputFile = process.argv[2] || '/mnt/c/Users/halwh/Downloads/minerals (4).csv';
const outputFile = process.argv[3] || '/tmp/phase1-enrichment/e-Rocks_UPDATE_4.csv';

enrichErocksOptimized(inputFile, outputFile).catch(console.error);
