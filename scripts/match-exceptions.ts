#!/usr/bin/env tsx
/**
 * EXCEPTIONS Matching Script
 *
 * Re-matches the 317 minerals from erocks_EXCEPTIONS.csv using:
 * - Character normalization (ř→r, é→e, etc.)
 * - Case-insensitive matching
 * - Hyphenation/parentheses variants
 * - Mindat API search for remaining unmatched
 *
 * Output:
 * - erocks_UPDATE_TITLES.csv - Minerals with title corrections (Mindat as source of truth)
 * - erocks_EXCEPTIONS_REMAINING.csv - Still unmatched minerals
 * - title_corrections_review.txt - Human-readable review report
 *
 * Usage:
 *   npm run match-exceptions
 */

import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import fs from 'fs/promises';
import csv from 'csv-parser';
import { createReadStream } from 'fs';
import { stringify } from 'csv-stringify/sync';

dotenv.config();

interface ExceptionRecord {
  'Published status': string;
  'Approval status': string;
  'Created': string;
  'Updated': string;
  'Title': string;
  'Strunz': string;
  'Formula': string;
  'Mindat ID': string;
  'Class': string;
  'Nid': string;
  'Match Notes': string;
  [key: string]: string;
}

interface MindatMineral {
  id: number;
  mindat_id: number;
  name: string;
  ima_formula: string | null;
  crystal_system: string | null;
  long_id: string | null;
  strunz10ed1: string | null;
  strunz10ed2: string | null;
  strunz10ed3: string | null;
  strunz10ed4: string | null;
  hardness_min: string | null;
  hardness_max: string | null;
  colour: string | null;
  streak: string | null;
  type_localities: string | null;
  tenacity: string | null;
  ima_status: string | null;
  variety_of: string | null;
  group_id: number | null;
  variety_of_id: number | null;
  polymorph_of_id: number | null;
  polytype_of_id: number | null;
  synonym_of_id: number | null;
}

interface MatchedMineral {
  erocksRecord: ExceptionRecord;
  mindatData: MindatMineral;
  matchType: 'db_normalized' | 'api_search' | 'api_id';
  oldTitle: string;
  newTitle: string;
  confidence: number;
}

class ExceptionsMatchingService {
  private sql: ReturnType<typeof neon>;
  private apiKey: string;
  private matched: MatchedMineral[] = [];
  private stillUnmatched: ExceptionRecord[] = [];
  private invalidRecords: ExceptionRecord[] = [];

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not set');
    }
    if (!process.env.MINDAT_API_KEY) {
      throw new Error('MINDAT_API_KEY not set');
    }
    this.sql = neon(process.env.DATABASE_URL);
    this.apiKey = process.env.MINDAT_API_KEY;
  }

  /**
   * Normalize name for matching (strip accents, lowercase, etc.)
   */
  private normalizeName(name: string): string {
    if (!name) return '';

    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
      .trim();
  }

  /**
   * Generate name variants for matching
   */
  private generateNameVariants(name: string): string[] {
    const variants: string[] = [];
    const normalized = this.normalizeName(name);

    // ONLY use the full normalized name
    // DO NOT strip suffixes - that causes false matches to group names
    variants.push(normalized);

    return variants;
  }

  /**
   * Check if record is likely invalid (not a real mineral) or has been deleted
   */
  private isInvalidRecord(record: ExceptionRecord): boolean {
    const title = record.Title?.toLowerCase() || '';
    const nid = record.Nid;

    // E-rocks records that have been deleted (junk)
    const deletedNids = [
      '2283562', // Fluoralforsite-(☐) - deleted
      '2283318'  // Rinmanite-(Zn) - deleted
    ];

    if (deletedNids.includes(nid)) {
      return true;
    }

    // Non-mineral entries
    const invalidPatterns = [
      'lava bomb', 'dvd', 'hardness scale', 'volcanic memorabilia',
      'cockscomb', 'reticulated', 'orbicular', 'polygonal', 'petrified',
      'fern', 'trilobite', 'brachiopod', 'clypeaster', 'insect', 'spider', 'ant',
      'hopper quartz', 'picasso jasper', 'wegler agate', 'lithophysis agate',
      'caesium', 'samarium', 'lanthanum', 'scandium', 'thulium', 'yttrium',
      'man made', 'fossil', 'animal'
    ];

    return invalidPatterns.some(pattern => title.includes(pattern));
  }

  /**
   * Try to match via Neon database using normalized name
   */
  private async matchViaDatabase(record: ExceptionRecord): Promise<MindatMineral | null> {
    const variants = this.generateNameVariants(record.Title);

    for (const variant of variants) {
      try {
        // Search using PostgreSQL's unaccent-like normalization
        // IMPORTANT: Lowercase FIRST, then translate special characters
        // Comprehensive character map for Czech, Slovak, and other European diacritics
        const results = await this.sql<MindatMineral[]>`
          SELECT * FROM mindat_minerals
          WHERE REGEXP_REPLACE(
            TRANSLATE(LOWER(name),
              'àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿāăąćčďđēĕėęěğħĩīĭįıĵķĺļľŀłńņňŋōŏőœŕŗřśŝşšţťŧũūŭůűųŵŷźżž',
              'aaaaaaeceeeeiiiidnoooooouuuuybyyaaaaccddeeeeeghiiiiijklllllnnnnoooorrrssssttuuuuuuwyzzzz'
            ),
            '[^a-z0-9]', '', 'g'
          ) = ${variant}
          LIMIT 5
        `;

        if (results && results.length > 0) {
          // Return first result (could add confidence scoring here)
          return results[0];
        }
      } catch (error) {
        console.log(`  Database search error for "${variant}": ${error}`);
      }
    }

    return null;
  }

  /**
   * Try to match via Mindat API by ID (if record has Mindat ID)
   */
  private async matchViaAPIById(mindatId: string): Promise<MindatMineral | null> {
    try {
      const response = await fetch(`https://api.mindat.org/minerals/${mindatId}`, {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      // Transform API response to match our MindatMineral interface
      return {
        id: data.id,
        name: data.name,
        ima_formula: data.ima_formula || null,
        crystal_system: data.crystal_system || null,
        mindat_longid: data.mindat_longid || null,
        strunz10ed1: data.strunz10ed_class_1 || null,
        strunz10ed2: data.strunz10ed_class_2 || null,
        strunz10ed3: data.strunz10ed_class_3 || null,
        strunz10ed4: data.strunz10ed_class_4 || null,
        hardness_min: data.hardness_min || null,
        hardness_max: data.hardness_max || null,
        colour: data.colour || null,
        streak: data.streak || null,
        type_localities: data.type_localities || null,
        tenacity: data.tenacity || null,
        ima_status: data.ima_status || null,
        variety_of: data.variety_of || null,
        group_id: data.group_id || null,
        variety_of_id: data.variety_of_id || null,
        polymorph_of_id: data.polymorph_of_id || null,
        polytype_of_id: data.polytype_of_id || null,
        synonym_of_id: data.synonym_of_id || null
      };
    } catch (error) {
      console.log(`  API ID search error: ${error}`);
      return null;
    }
  }

  /**
   * Try to match via Mindat API search
   */
  private async matchViaAPISearch(title: string): Promise<MindatMineral | null> {
    try {
      const response = await fetch(`https://api.mindat.org/search/?q=${encodeURIComponent(title)}`, {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const firstResult = data.results[0];

        // Check if it's a mineral (not locality, etc.)
        if (firstResult._source?.name) {
          // Fetch full mineral details
          return await this.matchViaAPIById(firstResult._source.id.toString());
        }
      }

      return null;
    } catch (error) {
      console.log(`  API search error: ${error}`);
      return null;
    }
  }

  /**
   * Try to match a single exception record
   */
  private async matchRecord(record: ExceptionRecord): Promise<void> {
    console.log(`\n🔍 Matching: ${record.Title} (Nid: ${record.Nid})`);

    // Skip invalid/non-mineral records
    if (this.isInvalidRecord(record)) {
      console.log(`  ⏭️  Skipped: Invalid/non-mineral record`);
      this.invalidRecords.push(record);
      return;
    }

    let mindatData: MindatMineral | null = null;
    let matchType: 'db_normalized' | 'api_search' | 'api_id' | null = null;

    // Strategy 1: If has Mindat ID, try API lookup
    if (record['Mindat ID'] && record['Mindat ID'] !== '') {
      console.log(`  Trying Mindat ID: ${record['Mindat ID']}`);
      mindatData = await this.matchViaAPIById(record['Mindat ID']);
      if (mindatData) {
        matchType = 'api_id';
        console.log(`  ✅ Matched via API ID: ${mindatData.name}`);
      }

      // Rate limit: 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Strategy 2: Try database with normalized name
    if (!mindatData) {
      console.log(`  Trying database search...`);
      mindatData = await this.matchViaDatabase(record);
      if (mindatData) {
        matchType = 'db_normalized';
        console.log(`  ✅ Matched via database: ${mindatData.name}`);
      }
    }

    // Strategy 3: Try Mindat API search
    if (!mindatData) {
      console.log(`  Trying API search...`);
      mindatData = await this.matchViaAPISearch(record.Title);
      if (mindatData) {
        matchType = 'api_search';
        console.log(`  ✅ Matched via API search: ${mindatData.name}`);
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (mindatData && matchType) {
      this.matched.push({
        erocksRecord: record,
        mindatData,
        matchType,
        oldTitle: record.Title,
        newTitle: mindatData.name,
        confidence: matchType === 'api_id' ? 100 : matchType === 'db_normalized' ? 90 : 75
      });
    } else {
      console.log(`  ❌ No match found`);
      this.stillUnmatched.push(record);
    }
  }

  /**
   * Load EXCEPTIONS CSV
   */
  private async loadExceptions(filePath: string): Promise<ExceptionRecord[]> {
    return new Promise((resolve, reject) => {
      const records: ExceptionRecord[] = [];

      createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => records.push(data))
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  /**
   * Generate formatted Strunz classification
   */
  private formatStrunz(mineral: MindatMineral): string {
    const parts = [
      mineral.strunz10ed1,
      mineral.strunz10ed2,
      mineral.strunz10ed3,
      mineral.strunz10ed4
    ].filter(p => p && p !== '');

    if (parts.length === 0) return '';
    return parts.join('.');
  }

  /**
   * Generate erocks_UPDATE_TITLES.csv
   */
  private async generateTitleUpdateCSV(outputDir: string): Promise<void> {
    const rows = this.matched.map(match => ({
      'Title': match.newTitle, // Mindat title (source of truth)
      'Short Description': '', // We don't have this from Mindat
      'Synonyms': '',
      'Mindat ID': match.mindatData.mindat_id.toString(), // Use mindat_id, not sequential db id
      'Mindat URL': `https://www.mindat.org/min-${match.mindatData.mindat_id}.html`,
      'Formula': match.mindatData.ima_formula || '',
      'Crystal System': match.mindatData.crystal_system || '',
      'Hardness Min': match.mindatData.hardness_min || '',
      'Hardness Max': match.mindatData.hardness_max || '',
      'Streak': match.mindatData.streak || '',
      'Tenacity': match.mindatData.tenacity || '',
      'Colour': match.mindatData.colour || '',
      'Type Locality': match.mindatData.type_localities || '',
      'Strunz': this.formatStrunz(match.mindatData),
      'Mindat Status': match.mindatData.ima_status || '',
      'Variety Of': '',
      'Group Parent': '',
      'Polymorph of': '',
      'Polytype Of': '',
      'Mixture of': '',
      'Synonym of': '',
      'Habit of': '',
      'Renamed To': '',
      'Unnamed': '',
      'Class': 'Mineral',
      'Nid': match.erocksRecord.Nid // CRITICAL: This is how Drupal knows which record to update
    }));

    const csvContent = stringify(rows, {
      header: true,
      bom: true,
      quoted: true
    });

    const filePath = `${outputDir}/erocks_UPDATE_TITLES.csv`;
    await fs.writeFile(filePath, csvContent, 'utf-8');
    console.log(`\n✅ Created: ${filePath} (${rows.length} records)`);
  }

  /**
   * Generate remaining exceptions CSV
   */
  private async generateRemainingExceptionsCSV(outputDir: string): Promise<void> {
    const csvContent = stringify(this.stillUnmatched, {
      header: true,
      bom: true,
      quoted: true
    });

    const filePath = `${outputDir}/erocks_EXCEPTIONS_REMAINING.csv`;
    await fs.writeFile(filePath, csvContent, 'utf-8');
    console.log(`✅ Created: ${filePath} (${this.stillUnmatched.length} records)`);
  }

  /**
   * Generate review report
   */
  private async generateReviewReport(outputDir: string): Promise<void> {
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('  EXCEPTIONS MATCHING REVIEW REPORT');
    lines.push('═══════════════════════════════════════════════════════════════\n');

    lines.push(`Total EXCEPTIONS processed: ${this.matched.length + this.stillUnmatched.length + this.invalidRecords.length}`);
    lines.push(`✅ Successfully matched: ${this.matched.length}`);
    lines.push(`❌ Still unmatched: ${this.stillUnmatched.length}`);
    lines.push(`⏭️  Invalid/skipped: ${this.invalidRecords.length}\n`);

    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('  TITLE CORRECTIONS (OLD → NEW)');
    lines.push('───────────────────────────────────────────────────────────────\n');

    for (const match of this.matched) {
      if (match.oldTitle !== match.newTitle) {
        lines.push(`"${match.oldTitle}" → "${match.newTitle}"`);
        lines.push(`  Nid: ${match.erocksRecord.Nid} | Match: ${match.matchType} | Confidence: ${match.confidence}%`);
        lines.push(`  Mindat ID: ${match.mindatData.mindat_id} | URL: https://www.mindat.org/min-${match.mindatData.mindat_id}.html\n`);
      }
    }

    lines.push('\n───────────────────────────────────────────────────────────────');
    lines.push('  MATCH TYPE BREAKDOWN');
    lines.push('───────────────────────────────────────────────────────────────\n');

    const byType = {
      'api_id': this.matched.filter(m => m.matchType === 'api_id').length,
      'db_normalized': this.matched.filter(m => m.matchType === 'db_normalized').length,
      'api_search': this.matched.filter(m => m.matchType === 'api_search').length
    };

    lines.push(`API ID lookup:         ${byType.api_id}`);
    lines.push(`Database normalized:   ${byType.db_normalized}`);
    lines.push(`API search:            ${byType.api_search}`);

    lines.push('\n───────────────────────────────────────────────────────────────');
    lines.push('  STILL UNMATCHED');
    lines.push('───────────────────────────────────────────────────────────────\n');

    for (const record of this.stillUnmatched) {
      lines.push(`"${record.Title}" (Nid: ${record.Nid})`);
    }

    lines.push('\n───────────────────────────────────────────────────────────────');
    lines.push('  INVALID/SKIPPED RECORDS');
    lines.push('───────────────────────────────────────────────────────────────\n');

    for (const record of this.invalidRecords) {
      lines.push(`"${record.Title}" (Nid: ${record.Nid})`);
    }

    lines.push('\n═══════════════════════════════════════════════════════════════');
    lines.push('  END OF REPORT');
    lines.push('═══════════════════════════════════════════════════════════════');

    const filePath = `${outputDir}/title_corrections_review.txt`;
    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
    console.log(`✅ Created: ${filePath}\n`);
  }

  /**
   * Main processing function
   */
  async process(inputFile: string, outputDir: string): Promise<void> {
    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║        EXCEPTIONS Matching & Title Correction Tool            ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝\n`);

    console.log(`📁 Input: ${inputFile}`);
    console.log(`📂 Output: ${outputDir}\n`);

    // Load exceptions
    console.log(`📖 Loading EXCEPTIONS...`);
    const records = await this.loadExceptions(inputFile);
    console.log(`✅ Loaded ${records.length} exception records\n`);

    // Match each record
    for (const record of records) {
      await this.matchRecord(record);
    }

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Generate output files
    console.log(`\n📝 Generating output files...`);
    await this.generateTitleUpdateCSV(outputDir);
    await this.generateRemainingExceptionsCSV(outputDir);
    await this.generateReviewReport(outputDir);

    console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
    console.log(`║  Summary:`);
    console.log(`║  • Matched: ${this.matched.length}`);
    console.log(`║  • Unmatched: ${this.stillUnmatched.length}`);
    console.log(`║  • Invalid/Skipped: ${this.invalidRecords.length}`);
    console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  }
}

// Main execution
async function main() {
  const inputFile = '/tmp/phase1-enrichment/erocks_EXCEPTIONS.csv';
  const outputDir = '/tmp/phase1-enrichment';

  const service = new ExceptionsMatchingService();
  await service.process(inputFile, outputDir);
}

main().catch(console.error);
