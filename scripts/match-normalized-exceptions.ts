#!/usr/bin/env tsx
/**
 * Match Exceptions with Character Normalization
 *
 * Finds minerals in exceptions that were added to e-rocks WITHOUT extended characters
 * (e.g., "Pribramite" in e-rocks vs "Příbramite" in Mindat)
 *
 * Uses comprehensive character normalization:
 * - Accents: á→a, é→e, í→i, ó→o, ú→u, ý→y
 * - Umlauts: ä→a, ö→o, ü→u
 * - Other: ř→r, š→s, č→c, ž→z, ñ→n, ç→c, ø→o, å→a, etc.
 * - Special symbols: ☐, □, ◻ removed
 * - Case insensitive
 */

import { neon } from '@neondatabase/serverless';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const exceptionsPath = '/tmp/phase1-enrichment/erocks_EXCEPTIONS_FILTERED.csv';

console.log('=== Match Exceptions with Character Normalization ===\n');

// Comprehensive character normalization
function normalizeChars(str: string): string {
  if (!str) return '';

  const charMap: { [key: string]: string } = {
    // Accented vowels
    'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a', 'ą': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'ę': 'e', 'ě': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o', 'ø': 'o', 'ő': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ů': 'u', 'ű': 'u',
    'ý': 'y', 'ÿ': 'y',

    // Czech/Slovak
    'ř': 'r', 'š': 's', 'č': 'c', 'ž': 'z', 'ď': 'd', 'ť': 't', 'ň': 'n',

    // Other special
    'ñ': 'n', 'ç': 'c', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe',

    // Special symbols (remove)
    '☐': '', '□': '', '◻': '', '◼': '', '■': '',

    // Uppercase versions
    'Á': 'A', 'À': 'A', 'Â': 'A', 'Ä': 'A', 'Ã': 'A', 'Å': 'A', 'Ą': 'A',
    'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E', 'Ę': 'E', 'Ě': 'E',
    'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
    'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Ö': 'O', 'Õ': 'O', 'Ø': 'O', 'Ő': 'O',
    'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U', 'Ů': 'U', 'Ű': 'U',
    'Ý': 'Y', 'Ÿ': 'Y',
    'Ř': 'R', 'Š': 'S', 'Č': 'C', 'Ž': 'Z', 'Ď': 'D', 'Ť': 'T', 'Ň': 'N',
    'Ñ': 'N', 'Ç': 'C', 'Æ': 'AE', 'Œ': 'OE'
  };

  let result = str;
  for (const [char, replacement] of Object.entries(charMap)) {
    result = result.replace(new RegExp(char, 'g'), replacement);
  }

  return result.toLowerCase().trim();
}

// Read exceptions
console.log('📁 Reading filtered exceptions...');
const exceptionsContent = fs.readFileSync(exceptionsPath, 'utf-8');
const exceptions = parse(exceptionsContent, {
  columns: true,
  skip_empty_lines: true,
  bom: true,
  relax_column_count: true,
  relax_quotes: true
});

console.log(`   Found ${exceptions.length} exception records\n`);

// Filter to only Class="Mineral" records WITHOUT existing Mindat ID
const mineralExceptions = exceptions.filter((exc: any) => {
  const hasClass = exc.Class === 'Mineral';
  const noMindatId = !exc['Mindat ID'] || exc['Mindat ID'].trim() === '';
  return hasClass && noMindatId;
});
console.log(`   Filtering to Class="Mineral" without Mindat ID: ${mineralExceptions.length} records\n`);

console.log('🔍 Matching against Mindat with character normalization...\n');

const matched: any[] = [];
const stillUnmatched: any[] = [];

for (const exc of mineralExceptions) {
  const erocksTitle = exc.Title;
  const normalizedTitle = normalizeChars(erocksTitle);

  // Search Mindat for normalized match - ONLY APPROVED/PENDING/GRANDFATHERED
  const mindatMatches = await sql`
    SELECT
      mindat_id,
      name,
      ima_formula,
      crystal_system,
      hardness_min,
      hardness_max,
      streak,
      colour,
      strunz10ed1,
      strunz10ed2,
      strunz10ed3,
      strunz10ed4,
      entry_type_text,
      ima_status
    FROM mindat_minerals
    WHERE LOWER(REGEXP_REPLACE(name, '[áàâäãåąéèêëęěíìîïóòôöõøőúùûüůűýÿřščžďťňñçßæœ☐□◻Á ÀÂÄÃÅĄÉÈÊËĘĚÍÌÎÏÓÒÔÖÕØŐÚÙÛÜŮŰÝŸŘŠČŽĎŤŇÑÇÆŒ]', '', 'g')) = ${normalizedTitle}
    AND (
      ima_status ILIKE '%APPROVED%'
      OR ima_status ILIKE '%PENDING%'
      OR ima_status ILIKE '%GRANDFATHERED%'
    )
    LIMIT 5
  `;

  if (mindatMatches.length > 0) {
    const match = mindatMatches[0];

    // Build strunz with proper zero-padding for 4th element
    let strunz = '';
    if (match.strunz10ed1 && match.strunz10ed1 !== '0') {
      strunz = match.strunz10ed1;
      if (match.strunz10ed2) {
        strunz += '.' + match.strunz10ed2;
        if (match.strunz10ed3) {
          strunz += match.strunz10ed3;
          if (match.strunz10ed4) {
            // Zero-pad 4th element to 2 digits: "5" → "05"
            const padded = match.strunz10ed4.toString().padStart(2, '0');
            strunz += '.' + padded;
          } else {
            strunz += '.x';
          }
        } else {
          strunz += 'x';
        }
      }
    }

    matched.push({
      ...exc,
      'Mindat ID': match.mindat_id,
      'Mindat URL': `https://www.mindat.org/min-${match.mindat_id}.html`,
      'Formula': match.ima_formula || '',
      'Crystal System': match.crystal_system || '',
      'Hardness Min': match.hardness_min || '',
      'Hardness Max': match.hardness_max || '',
      'Streak': match.streak || '',
      'Colour': match.colour || '',
      'Strunz': strunz,
      'Class': match.entry_type_text === 'mineral' ? 'Mineral' : (match.entry_type_text === 'grouplist' ? 'Mineral Group' : ''),
      'Match Notes': `Matched by normalized name: "${erocksTitle}" → "${normalizedTitle}" = Mindat "${match.name}"`
    });

    console.log(`   ✅ ${erocksTitle} → ${match.name} (${match.mindat_id})`);
  } else {
    stillUnmatched.push(exc);
  }
}

console.log(`\n📊 Results:`);
console.log(`   Total mineral exceptions: ${mineralExceptions.length}`);
console.log(`   Matched with normalization: ${matched.length}`);
console.log(`   Still unmatched: ${stillUnmatched.length}`);
console.log(`   Success rate: ${((matched.length / mineralExceptions.length) * 100).toFixed(1)}%\n`);

// Write matched records (ready for enrichment update)
if (matched.length > 0) {
  const matchedOutput = stringify(matched, { header: true, bom: true });
  fs.writeFileSync('/tmp/phase1-enrichment/erocks_NORMALIZED_MATCHES.csv', matchedOutput, 'utf-8');
  console.log(`✅ Wrote ${matched.length} normalized matches to: erocks_NORMALIZED_MATCHES.csv\n`);
}

// Write remaining unmatched
if (stillUnmatched.length > 0) {
  const unmatchedOutput = stringify(stillUnmatched, { header: true, bom: true });
  fs.writeFileSync('/tmp/phase1-enrichment/erocks_EXCEPTIONS_FINAL.csv', unmatchedOutput, 'utf-8');
  console.log(`📝 Wrote ${stillUnmatched.length} still-unmatched to: erocks_EXCEPTIONS_FINAL.csv\n`);
}

console.log('✅ Done!\n');
