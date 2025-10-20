#!/usr/bin/env tsx
/**
 * Create Orphans File
 *
 * Generates e-Rocks_UPDATE_4_Orphans.csv containing records without real
 * Mindat IDs (ER placeholders or empty) that couldn't be matched by name.
 *
 * - Searches Mindat API for potential matches by name
 * - If found: enriches with Mindat data + adds note
 * - If not found: preserves original + marks as true orphan
 * - Applies all formatting rules
 * - Includes ALL columns
 */

import 'dotenv/config';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
const MINDAT_API_KEY = process.env.MINDAT_API_KEY!;

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
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
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

// UK spelling
function convertToUkSpelling(text: string): string {
  if (!text || typeof text !== 'string') return text;

  const conversions: Array<[RegExp, string]> = [
    [/\bsulfate\b/gi, 'sulphate'], [/\bsulfide\b/gi, 'sulphide'],
    [/\bsulfur\b/gi, 'sulphur'], [/\bcolorless\b/gi, 'colourless'],
    [/\bcolor\b/gi, 'colour'], [/\bgray\b/gi, 'grey']
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

// Build strunz
function buildStrunz(ed1: string, ed2: string, ed3: string, ed4: string): string {
  if (!ed1 || ed1 === '0') return '';
  let strunz = ed1;
  if (ed2) {
    strunz += '.' + ed2;
    if (ed3) {
      strunz += ed3;
      if (ed4) strunz += '.' + ed4.toString().padStart(2, '0');
      else strunz += '.x';
    } else strunz += 'x';
  }
  return strunz;
}

// Comprehensive character normalization for matching
function normalizeChars(text: string): string {
  if (!text) return '';

  let normalized = text.toLowerCase();

  // First pass: normalize composed characters
  normalized = normalized.normalize('NFD');

  // Remove all combining diacritical marks
  normalized = normalized.replace(/[\u0300-\u036f]/g, '');

  // Handle specific characters that don't decompose well
  const charMap: Record<string, string> = {
    // Latin with various accents/marks
    'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a', 'ą': 'a', 'ă': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'ę': 'e', 'ě': 'e', 'ĕ': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o', 'ø': 'o', 'ő': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ů': 'u', 'ű': 'u',
    'ý': 'y', 'ÿ': 'y',
    'ñ': 'n', 'ň': 'n', 'ń': 'n',
    'ç': 'c', 'č': 'c', 'ć': 'c',
    'ř': 'r',
    'š': 's', 'ş': 's', 'ș': 's', 'ś': 's',
    'ž': 'z', 'ź': 'z', 'ż': 'z',
    'ť': 't', 'ț': 't',
    'ď': 'd',
    'ł': 'l',
    'ß': 'ss',
    'æ': 'ae',
    'œ': 'oe',
    '–': '', // en dash
    '—': '', // em dash
    '\u2019': '', // right single quotation mark
    '\u2018': '', // left single quotation mark
    '′': '', // prime symbol
    '☐': '', // box symbols
    '□': '',
    '◻': ''
  };

  // Apply character replacements
  for (const [char, replacement] of Object.entries(charMap)) {
    normalized = normalized.replace(new RegExp(char, 'g'), replacement);
  }

  // Remove all remaining non-alphanumeric characters
  normalized = normalized.replace(/[^a-z0-9]/g, '');

  return normalized;
}

// Search Mindat API
async function searchMindatAPI(name: string): Promise<any> {
  try {
    const searchUrl = `https://api.mindat.org/search_dyn/?format=json&name=${encodeURIComponent(name)}`;
    const response = await fetch(searchUrl, {
      headers: { 'Authorization': `Token ${MINDAT_API_KEY}` }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      // Get first exact match or closest match
      const exactMatch = data.results.find((r: any) => r.name?.toLowerCase() === name.toLowerCase());
      return exactMatch || data.results[0];
    }
  } catch (error) {
    return null;
  }
  return null;
}

// Fetch full mineral details
async function fetchMineralDetails(mindatId: number): Promise<any> {
  try {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit

    const url = `https://api.mindat.org/minerals/${mindatId}/?format=json&fields=id,name,ima_formula,mindat_formula,crystal_system,hardness_min,hardness_max,streak,colour,ima_status,strunz10ed1,strunz10ed2,strunz10ed3,strunz10ed4`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Token ${MINDAT_API_KEY}` }
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function createOrphansFile() {
  console.log('=== Create Orphans File ===\n');

  // Load ALL Mindat data for normalized matching
  console.log('📊 Loading Mindat database for character matching...');
  const allMindat = await sql`
    SELECT
      mindat_id, name, ima_formula, mindat_formula, crystal_system,
      hardness_min, hardness_max, streak, tenacity, colour,
      type_localities_data as type_locality,
      strunz10ed1, strunz10ed2, strunz10ed3, strunz10ed4,
      entry_type_text, ima_status
    FROM mindat_minerals
    WHERE (
      ima_status ILIKE '%APPROVED%'
      OR ima_status ILIKE '%PENDING%'
      OR ima_status ILIKE '%GRANDFATHERED%'
    )
  `;

  // Create normalized name lookup
  const mindatByNormalizedName = new Map();
  for (const m of allMindat) {
    const normalized = normalizeChars(m.name);
    mindatByNormalizedName.set(normalized, m);
  }
  console.log(`✅ Loaded ${allMindat.length} minerals from Neon\n`);

  // Load UPDATE_4_UK - contains ALL records
  console.log('📁 Loading UPDATE_4_UK.csv...');
  const allRecords = parse(fs.readFileSync('/tmp/phase1-enrichment/e-Rocks_UPDATE_4_UK.csv', 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    bom: true
  });
  console.log(`✅ Loaded ${allRecords.length} records from UPDATE_4_UK\n`);

  // Filter to orphans: ER/empty IDs with no Mindat Status (not enriched by name) AND Class="Mineral"
  console.log('🔍 Filtering to orphans (ER/empty IDs, not enriched, Class=Mineral)...');
  const orphans = allRecords.filter((r: any) => {
    const mindatId = r['Mindat ID']?.toString().trim();
    const mindatStatus = r['Mindat Status']?.toString().trim();
    const classValue = r.Class?.toString().trim();

    // Must be Class="Mineral"
    if (classValue !== 'Mineral') return false;

    // Must have ER or empty Mindat ID
    const hasNoRealId = !mindatId || mindatId === '' || mindatId.startsWith('ER');
    if (!hasNoRealId) return false;

    // Must NOT have Mindat Status (wasn't enriched by name match)
    if (mindatStatus && mindatStatus !== '') return false;

    return true;
  });

  console.log(`✅ Found ${orphans.length} orphan records\n`);

  // Search for each orphan with normalized character matching
  console.log('🔎 Searching for orphans with character normalization...\n');
  const enrichedRecords: any[] = [];
  let foundViaNormalized = 0;
  let foundViaAPI = 0;
  let trueOrphans = 0;

  for (let i = 0; i < orphans.length; i++) {
    const record = orphans[i];
    const title = record.Title?.toString().trim();

    console.log(`   [${i + 1}/${orphans.length}] Searching for: ${title}`);

    if (!title) {
      enrichedRecords.push({
        ...record,
        'Match Notes': 'No title to search'
      });
      trueOrphans++;
      continue;
    }

    // Try normalized character matching against Neon first
    const normalizedTitle = normalizeChars(title);
    const neonMatch = mindatByNormalizedName.get(normalizedTitle);

    if (neonMatch) {
      console.log(`      ✅ Found via character matching: ${neonMatch.name} (ID: ${neonMatch.mindat_id})`);
      foundViaNormalized++;

      const strunz = buildStrunz(
        neonMatch.strunz10ed1,
        neonMatch.strunz10ed2,
        neonMatch.strunz10ed3,
        neonMatch.strunz10ed4
      );

      let formula = neonMatch.ima_formula || neonMatch.mindat_formula || record.Formula || '';
      if (formula) formula = convertFormulaToUnicode(formula);

      let colour = neonMatch.colour || record.Colour || '';
      if (colour) colour = convertToUkSpelling(colour);

      let streak = neonMatch.streak || record.Streak || '';
      if (streak) streak = convertToUkSpelling(streak);

      let hardness = '';
      if (neonMatch.hardness_min && neonMatch.hardness_max) {
        hardness = neonMatch.hardness_min === neonMatch.hardness_max
          ? neonMatch.hardness_min.toString()
          : `${neonMatch.hardness_min}-${neonMatch.hardness_max}`;
      }

      let classValue = 'Mineral';
      if (neonMatch.entry_type_text === 'grouplist') classValue = 'Mineral Group';

      enrichedRecords.push({
        ...record,
        'Mindat ID': neonMatch.mindat_id,
        'Mindat URL': `https://www.mindat.org/min-${neonMatch.mindat_id}.html`,
        'Formula': formula,
        'Crystal System': neonMatch.crystal_system || record['Crystal System'] || '',
        'Hardness (Mohs)': hardness || record['Hardness (Mohs)'] || '',
        'Hardness Min': neonMatch.hardness_min || record['Hardness Min'] || '',
        'Hardness Max': neonMatch.hardness_max || record['Hardness Max'] || '',
        'Streak': streak,
        'Tenacity': neonMatch.tenacity || record.Tenacity || '',
        'Colour': colour,
        'Strunz Classification': strunz || record['Strunz Classification'] || '',
        'Strunz': strunz || record['Strunz'] || '',
        'Mindat Status': neonMatch.ima_status || '',
        'Type Locality': neonMatch.type_locality || record['Type Locality'] || '',
        'Class': classValue,
        'Match Notes': `Found via character normalization - "${title}" matched "${neonMatch.name}"`
      });
      continue;
    }

    // If not found via normalization, try API search
    const apiResult = await searchMindatAPI(title);

    if (apiResult && apiResult.id) {
      console.log(`      ✅ Found in API: ${apiResult.name} (ID: ${apiResult.id})`);
      foundViaAPI++;

      // Get full details
      const details = await fetchMineralDetails(apiResult.id);

      if (details) {
        const strunz = buildStrunz(
          details.strunz10ed1,
          details.strunz10ed2,
          details.strunz10ed3,
          details.strunz10ed4
        );

        let formula = details.ima_formula || details.mindat_formula || record.Formula || '';
        if (formula) formula = convertFormulaToUnicode(formula);

        let colour = details.colour || record.Colour || '';
        if (colour) colour = convertToUkSpelling(colour);

        let streak = details.streak || record.Streak || '';
        if (streak) streak = convertToUkSpelling(streak);

        let hardness = '';
        if (details.hardness_min && details.hardness_max) {
          hardness = details.hardness_min === details.hardness_max
            ? details.hardness_min.toString()
            : `${details.hardness_min}-${details.hardness_max}`;
        }

        enrichedRecords.push({
          ...record,
          'Mindat ID': details.id,
          'Mindat URL': `https://www.mindat.org/min-${details.id}.html`,
          'Formula': formula,
          'Crystal System': details.crystal_system || record['Crystal System'] || '',
          'Hardness (Mohs)': hardness || record['Hardness (Mohs)'] || '',
          'Streak': streak,
          'Colour': colour,
          'Strunz Classification': strunz || record['Strunz Classification'] || '',
          'Strunz': strunz || record['Strunz'] || '',
          'Mindat Status': details.ima_status || '',
          'Match Notes': `Found via Mindat API search - matched "${apiResult.name}"`
        });
      } else {
        enrichedRecords.push({
          ...record,
          'Mindat ID': apiResult.id,
          'Match Notes': 'Found via API but could not fetch full details'
        });
      }
    } else {
      console.log(`      ❌ Not found in API`);
      trueOrphans++;
      enrichedRecords.push({
        ...record,
        'Match Notes': 'True orphan - no Mindat match found via API search'
      });
    }
  }

  // Write output
  const outputPath = '/tmp/phase1-enrichment/e-Rocks_UPDATE_4_Orphans.csv';
  const output = stringify(enrichedRecords, {
    header: true,
    bom: true,
    quoted: true
  });
  fs.writeFileSync(outputPath, output, 'utf-8');

  console.log('\n📊 Results:');
  console.log(`   Total orphans: ${orphans.length}`);
  console.log(`   ✅ Found via character normalization: ${foundViaNormalized}`);
  console.log(`   ✅ Found via API search: ${foundViaAPI}`);
  console.log(`   ❌ True orphans (not found): ${trueOrphans}\n`);

  console.log(`✅ Wrote ${enrichedRecords.length} records to ${outputPath}\n`);
  console.log('✅ Complete!\n');
}

createOrphansFile().catch(console.error);
