#!/usr/bin/env tsx
/**
 * Create Unmatched File
 *
 * Generates e-rocks_UPDATE_4_UK_Unmatched.csv containing records with real
 * Mindat IDs that weren't matched in the main enrichment (likely due to
 * DISCREDITED/QUESTIONABLE status).
 *
 * - Queries Neon WITHOUT IMA status filter (includes ALL statuses)
 * - Enriches with complete Mindat data
 * - Applies all formatting rules (UK spelling, Unicode, zero-padded strunz)
 * - Includes ALL columns
 */

import 'dotenv/config';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Unicode conversion
function convertFormulaToUnicode(html: string): string {
  if (!html || typeof html !== 'string') return html;
  let result = html;

  const subscripts: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', 'x': 'ₓ'
  };
  const superscripts: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '₆', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', 'n': 'ⁿ'
  };

  result = result.replace(/<sub>([^<]+)<\/sub>/g, (_, content) =>
    content.split('').map((c: string) => subscripts[c] || c).join('')
  );
  result = result.replace(/<sup>([^<]+)<\/sup>/g, (_, content) =>
    content.split('').map((c: string) => superscripts[c] || c).join('')
  );

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

// UK spelling conversion
function convertToUkSpelling(text: string): string {
  if (!text || typeof text !== 'string') return text;

  const conversions: Array<[RegExp, string]> = [
    [/\bsulfate\b/gi, 'sulphate'],
    [/\bsulfide\b/gi, 'sulphide'],
    [/\bsulfite\b/gi, 'sulphite'],
    [/\bsulfur\b/gi, 'sulphur'],
    [/\bsulfuric\b/gi, 'sulphuric'],
    [/\bcolorless\b/gi, 'colourless'],
    [/\bcolored\b/gi, 'coloured'],
    [/\bcolor\b/gi, 'colour'],
    [/\bgray\b/gi, 'grey'],
    [/\bgrayish\b/gi, 'greyish']
  ];

  let result = text;
  for (const [pattern, replacement] of conversions) {
    result = result.replace(pattern, (match) => {
      if (match === match.toUpperCase()) return replacement.toUpperCase();
      if (match[0] === match[0].toUpperCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement.toLowerCase();
    });
  }
  return result;
}

// Build strunz with zero-padding
function buildStrunz(ed1: string, ed2: string, ed3: string, ed4: string): string {
  if (!ed1 || ed1 === '0' || ed1 === '0.0') return '';
  let strunz = ed1;
  if (ed2) {
    strunz += '.' + ed2;
    if (ed3) {
      strunz += ed3;
      if (ed4) {
        strunz += '.' + ed4.toString().padStart(2, '0');
      } else {
        strunz += '.x';
      }
    } else {
      strunz += 'x';
    }
  }
  return strunz;
}

async function createUnmatchedFile() {
  console.log('=== Create Unmatched File ===\n');

  // Load UPDATE_4_UK - contains ALL records (matched and unmatched)
  console.log('📁 Loading UPDATE_4_UK.csv...');
  const allRecords = parse(fs.readFileSync('/tmp/phase1-enrichment/e-Rocks_UPDATE_4_UK.csv', 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    bom: true
  });
  console.log(`✅ Loaded ${allRecords.length} records from UPDATE_4_UK\n`);

  // Filter to unmatched: have real Mindat ID but no Mindat Status (not enriched) AND Class="Mineral"
  console.log('🔍 Filtering to unmatched records with real Mindat IDs and Class=Mineral...');
  const unmatched = allRecords.filter((r: any) => {
    const mindatId = r['Mindat ID']?.toString().trim();
    const mindatStatus = r['Mindat Status']?.toString().trim();
    const classValue = r.Class?.toString().trim();

    // Must be Class="Mineral"
    if (classValue !== 'Mineral') return false;

    // Must have real Mindat ID (not empty, not ER)
    if (!mindatId || mindatId === '') return false;
    if (mindatId.startsWith('ER')) return false;
    if (!/^\d+$/.test(mindatId)) return false;

    // Must NOT have Mindat Status (meaning it wasn't enriched)
    if (mindatStatus && mindatStatus !== '') return false;

    return true;
  });

  console.log(`✅ Found ${unmatched.length} unmatched records with real Mindat IDs\n`);

  // Load ALL Mindat data (no IMA filter)
  console.log('📊 Loading ALL Mindat data from Neon...');
  const allMindat = await sql`
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
  `;
  console.log(`✅ Loaded ${allMindat.length} minerals from Neon (all statuses)\n`);

  // Create lookup
  const mindatById = new Map();
  for (const m of allMindat) {
    mindatById.set(m.mindat_id.toString(), m);
  }

  // Enrich unmatched records
  console.log('🔄 Enriching unmatched records...\n');
  const enrichedRecords: any[] = [];
  let foundInNeon = 0;
  let notFoundInNeon = 0;

  for (let i = 0; i < unmatched.length; i++) {
    const record = unmatched[i];
    const mindatId = record['Mindat ID']?.toString().trim();

    if ((i + 1) % 500 === 0) {
      console.log(`   Processed ${i + 1}/${unmatched.length} records...`);
    }

    const mindatData = mindatById.get(mindatId);

    if (mindatData) {
      foundInNeon++;

      // Build enriched record
      const strunz = buildStrunz(
        mindatData.strunz10ed1,
        mindatData.strunz10ed2,
        mindatData.strunz10ed3,
        mindatData.strunz10ed4
      );

      let formula = mindatData.ima_formula || mindatData.mindat_formula || record.Formula || '';
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

      // Apply UK spelling to colour fields
      let colour = mindatData.colour || record.Colour || '';
      if (colour) colour = convertToUkSpelling(colour);

      let streak = mindatData.streak || record.Streak || '';
      if (streak) streak = convertToUkSpelling(streak);

      enrichedRecords.push({
        ...record,
        'Mindat ID': mindatData.mindat_id,
        'Mindat URL': `https://www.mindat.org/min-${mindatData.mindat_id}.html`,
        'Formula': formula,
        'Crystal System': mindatData.crystal_system || record['Crystal System'] || '',
        'Hardness (Mohs)': hardness || record['Hardness (Mohs)'] || '',
        'Hardness Min': mindatData.hardness_min || record['Hardness Min'] || '',
        'Hardness Max': mindatData.hardness_max || record['Hardness Max'] || '',
        'Streak': streak,
        'Tenacity': mindatData.tenacity || record.Tenacity || '',
        'Colour': colour,
        'Strunz Classification': strunz || record['Strunz Classification'] || record['Strunz'] || '',
        'Strunz': strunz || record['Strunz'] || record['Strunz Classification'] || '',
        'Mindat Status': mindatData.ima_status || '',
        'Type Locality': mindatData.type_locality || record['Type Locality'] || '',
        'Class': classValue
      });
    } else {
      // Not found in Neon - keep original
      notFoundInNeon++;
      enrichedRecords.push(record);
    }
  }

  // Write output
  const outputPath = '/tmp/phase1-enrichment/e-Rocks_UPDATE_4_UK_Unmatched.csv';
  const output = stringify(enrichedRecords, {
    header: true,
    bom: true,
    quoted: true
  });
  fs.writeFileSync(outputPath, output, 'utf-8');

  console.log('\n📊 Results:');
  console.log(`   Total unmatched with real IDs: ${unmatched.length}`);
  console.log(`   ✅ Found in Neon (enriched): ${foundInNeon}`);
  console.log(`   ❌ Not found in Neon: ${notFoundInNeon}\n`);

  console.log(`✅ Wrote ${enrichedRecords.length} records to ${outputPath}\n`);
  console.log('✅ Complete!\n');
}

createUnmatchedFile().catch(console.error);
