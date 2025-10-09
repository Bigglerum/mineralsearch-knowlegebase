import { neon } from '@neondatabase/serverless';
import fs from 'fs/promises';
import path from 'path';
import csv from 'csv-parser';
import { createReadStream, createWriteStream } from 'fs';
import { stringify } from 'csv-stringify/sync';

interface ERocksMineral {
  'Published status': string;
  'Approval status': string;
  'Created': string;
  'Updated': string;
  'Title': string;
  'Strunz': string;
  'Formula': string;
  'Mindat ID': string;
  'Class': string;
  'Colour': string;
  'Crystal System': string;
  'Dimorph Of': string;
  'Group Members': string;
  'Group Parent': string;
  'Habit Of': string;
  'Hardness Max': string;
  'Hardness Min': string;
  'Isostructural with': string;
  'Mindat Status': string;
  'Mindat URL': string;
  'Mixture Of': string;
  'Polymorph of': string;
  'Polytype Of': string;
  'Renamed To': string;
  'Streak': string;
  'Synonym Of': string;
  'Synonyms': string;
  'Type Locality': string;
  'Unnamed': string;
  'Variety Of': string;
  'Nid': string;
  'Source': string;
}

interface MatchResult {
  erocksRecord: ERocksMineral;
  mindatData: any | null;
  matchType: 'exact_id' | 'exact_name' | 'fuzzy_name' | 'formula' | 'no_match';
  confidence: number;
  notes: string[];
  conflicts: string[];
  needsReview: boolean; // Flag for manual review (confidence < 95%)
  isVariety: boolean;   // True if matched via parent mineral
  isSynonym: boolean;   // True if matched via synonym
  parentMineral?: string; // Name of parent if variety/synonym
}

export class ERocksDataEnrichment {
  private sql: ReturnType<typeof neon>;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    this.sql = neon(process.env.DATABASE_URL);
  }

  /**
   * Check if e-Rocks record should be processed
   */
  private shouldProcessRecord(record: ERocksMineral): boolean {
    const classValue = record.Class?.trim().toLowerCase();

    // Process Minerals, Mineral Groups, and Mineral Supergroups
    if (classValue === 'mineral' ||
        classValue === 'mineral group' ||
        classValue === 'mineral supergroup') {
      return true;
    }

    // Process null/empty class values (from original import)
    if (!classValue || classValue === '') {
      return true;
    }

    // Skip rocks, fossils, man-made items, etc.
    return false;
  }

  /**
   * Normalize mineral name for comparison
   * Handles UTF-8 special characters, diacritics, and variations
   */
  private normalizeName(name: string): string {
    if (!name) return '';

    return name
      .toLowerCase()
      // Normalize Unicode (decompose accented characters)
      .normalize('NFD')
      // Remove diacritics/accents
      .replace(/[\u0300-\u036f]/g, '')
      // Handle special mineral name characters
      .replace(/[-()\s]/g, '')
      .replace(/['']/g, '') // Remove quotes
      // Remove common prefixes
      .replace(/^var\.|^variety\s+|^type\s+/i, '')
      // Handle Greek letters that might appear
      .replace(/α/g, 'alpha')
      .replace(/β/g, 'beta')
      .replace(/γ/g, 'gamma')
      .replace(/δ/g, 'delta')
      // Remove any remaining non-alphanumeric except essential chars
      .replace(/[^\w]/g, '')
      .trim();
  }

  /**
   * Normalize chemical formula for comparison
   * Handles UTF-8 subscripts, superscripts, and special characters
   */
  private normalizeFormula(formula: string): string {
    if (!formula) return '';

    return formula
      // Normalize Unicode
      .normalize('NFD')
      // Remove spaces
      .replace(/\s+/g, '')
      // Convert subscript numbers to regular
      .replace(/₀/g, '0').replace(/₁/g, '1').replace(/₂/g, '2')
      .replace(/₃/g, '3').replace(/₄/g, '4').replace(/₅/g, '5')
      .replace(/₆/g, '6').replace(/₇/g, '7').replace(/₈/g, '8')
      .replace(/₉/g, '9')
      // Convert superscript numbers to regular (for charges)
      .replace(/⁰/g, '0').replace(/¹/g, '1').replace(/²/g, '2')
      .replace(/³/g, '3').replace(/⁴/g, '4').replace(/⁵/g, '5')
      .replace(/⁶/g, '6').replace(/⁷/g, '7').replace(/⁸/g, '8')
      .replace(/⁹/g, '9')
      // Handle special charge symbols
      .replace(/⁺/g, '+').replace(/⁻/g, '-')
      // Standardize hydration notation
      .replace(/·/g, '.').replace(/•/g, '.')
      .trim();
  }

  /**
   * Create multiple normalized variants of a name for better matching
   */
  private getNameVariants(name: string): string[] {
    const variants = new Set<string>();

    // Original normalized
    variants.add(this.normalizeName(name));

    // Without numbers
    variants.add(this.normalizeName(name).replace(/\d+/g, ''));

    // Without common suffixes like -(Ce), -(Nd), etc.
    const withoutSuffix = name.replace(/[-‐]\([A-Z][a-z]?\)$/i, '');
    if (withoutSuffix !== name) {
      variants.add(this.normalizeName(withoutSuffix));
    }

    // Handle cases like "Fergusonite-(Nd)" → "Fergusonite"
    const baseName = name.split(/[-‐(]/)[0];
    if (baseName !== name) {
      variants.add(this.normalizeName(baseName));
    }

    return Array.from(variants).filter(v => v.length > 0);
  }

  /**
   * Calculate simple similarity score between two strings
   */
  private similarityScore(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 100;

    // Levenshtein distance approximation
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 100;

    const editDistance = this.getEditDistance(s1, s2);
    return ((longer.length - editDistance) / longer.length) * 100;
  }

  private getEditDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * Resolve Mindat ID to mineral name
   */
  private async resolveMindatId(mindatId: number | null): Promise<string | null> {
    if (!mindatId || mindatId === 0) return null;

    try {
      const result = await this.sql`
        SELECT name FROM mindat_minerals
        WHERE mindat_id = ${mindatId}
        LIMIT 1
      `;
      return result.length > 0 ? result[0].name : null;
    } catch (error) {
      console.error(`Error resolving Mindat ID ${mindatId}:`, error);
      return null;
    }
  }

  /**
   * Resolve Group ID to group name
   * Note: Group names may need to be looked up from a separate groups table
   * For now, returning the group ID as string
   */
  private async resolveGroupId(groupId: number | null): Promise<string | null> {
    if (!groupId || groupId === 0) return null;

    // TODO: If we have a separate groups table, query it here
    // For now, return the group_id as a reference
    return `Group ${groupId}`;
  }

  /**
   * Extract relationship data from Mindat mineral record
   */
  private async extractRelationshipData(mindatRecord: any): Promise<{
    varietyOf: string | null;
    polytypeOf: string | null;
    groupParent: string | null;
    synonymOf: string | null;
  }> {
    const relationships = {
      varietyOf: null as string | null,
      polytypeOf: null as string | null,
      groupParent: null as string | null,
      synonymOf: null as string | null
    };

    if (!mindatRecord) return relationships;

    // Resolve variety_of ID to name
    if (mindatRecord.variety_of) {
      relationships.varietyOf = await this.resolveMindatId(mindatRecord.variety_of);
    }

    // Polytype_of is already text
    if (mindatRecord.polytype_of && mindatRecord.polytype_of !== '0') {
      relationships.polytypeOf = mindatRecord.polytype_of;
    }

    // Resolve group_id to group name
    if (mindatRecord.group_id) {
      relationships.groupParent = await this.resolveGroupId(mindatRecord.group_id);
    }

    // Resolve syn_id to name
    if (mindatRecord.syn_id) {
      relationships.synonymOf = await this.resolveMindatId(mindatRecord.syn_id);
    }

    return relationships;
  }

  /**
   * Match e-Rocks record to Mindat database
   */
  async matchMineral(erocksRecord: ERocksMineral): Promise<MatchResult> {
    const result: MatchResult = {
      erocksRecord,
      mindatData: null,
      matchType: 'no_match',
      confidence: 0,
      notes: [],
      conflicts: [],
      needsReview: false,
      isVariety: false,
      isSynonym: false
    };

    // Check if this is a variety or synonym - handle parent matching
    const varietyOf = erocksRecord['Variety Of']?.trim();
    const synonymOf = erocksRecord['Synonym Of']?.trim();

    if (varietyOf) {
      result.isVariety = true;
      result.parentMineral = varietyOf;
      result.notes.push(`This is a variety of: ${varietyOf}`);
    }

    if (synonymOf) {
      result.isSynonym = true;
      result.parentMineral = synonymOf;
      result.notes.push(`This is a synonym of: ${synonymOf}`);
    }

    const mindatId = erocksRecord['Mindat ID']?.trim();
    const title = erocksRecord['Title']?.trim();
    const formula = erocksRecord['Formula']?.trim();

    // Determine search name (use parent if variety/synonym, otherwise use title)
    const searchName = (varietyOf || synonymOf || title)?.trim();

    // Strategy 1: Exact Mindat ID match
    if (mindatId && mindatId !== '') {
      // Handle "ER" prefix - these were not originally on Mindat but can be checked now
      if (mindatId.toUpperCase().startsWith('ER')) {
        result.notes.push(`ER-prefixed ID detected (${mindatId}). Will try name/formula matching instead.`);
        // Skip to other matching strategies - don't try to parse ER IDs
      } else {
        try {
          const parsedId = parseInt(mindatId);
          if (!isNaN(parsedId)) {
            const mineralById = await this.sql`
              SELECT * FROM mindat_minerals
              WHERE mindat_id = ${parsedId}
              LIMIT 1
            `;

            if (mineralById.length > 0) {
              result.mindatData = mineralById[0];
              result.matchType = 'exact_id';
              result.confidence = 100;
              result.needsReview = false; // Always accept ID matches
              result.notes.push(`Matched by Mindat ID: ${mindatId}`);

              // Check for conflicts
              this.checkDataConflicts(erocksRecord, mineralById[0], result);
              return result;
            } else {
              result.notes.push(`Mindat ID ${mindatId} not found in approved minerals`);
            }
          }
        } catch (error) {
          result.notes.push(`Error querying by ID: ${error}`);
        }
      }
    }

    // Strategy 2: Exact name match (case-insensitive)
    // Use searchName to handle varieties/synonyms
    if (searchName) {
      try {
        const mineralByName = await this.sql`
          SELECT * FROM mindat_minerals
          WHERE LOWER(name) = ${searchName.toLowerCase()}
          LIMIT 1
        `;

        if (mineralByName.length > 0) {
          result.mindatData = mineralByName[0];
          result.matchType = 'exact_name';
          result.confidence = 95;
          result.needsReview = false; // Always accept exact name matches
          result.notes.push(`Matched by exact name: ${searchName}`);
          if (varietyOf || synonymOf) {
            result.notes.push(`Matched parent mineral for variety/synonym`);
          }
          this.checkDataConflicts(erocksRecord, mineralByName[0], result);
          return result;
        }
      } catch (error) {
        result.notes.push(`Error querying by name: ${error}`);
      }

      // Strategy 3: Try all name variants (normalized)
      const nameVariants = this.getNameVariants(searchName);
      result.notes.push(`Trying ${nameVariants.length} name variants: ${nameVariants.slice(0, 3).join(', ')}...`);

      for (const variant of nameVariants) {
        try {
          // Search for minerals where normalized name matches
          const minerals = await this.sql`
            SELECT *,
              LOWER(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(name, '[\\-()\\ ]', '', 'g'), '[''']', '', 'g'), '[^a-z0-9]', '', 'g')) as normalized_name
            FROM mindat_minerals
            WHERE LOWER(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(name, '[\\-()\\ ]', '', 'g'), '[''']', '', 'g'), '[^a-z0-9]', '', 'g')) = ${variant}
            LIMIT 5
          `;

          if (minerals.length > 0) {
            result.mindatData = minerals[0];
            result.matchType = 'fuzzy_name';
            result.confidence = 88;
            result.needsReview = true; // Fuzzy matches need review
            result.notes.push(`Matched by normalized variant: "${searchName}" → "${minerals[0].name}"`);
            if (minerals.length > 1) {
              result.notes.push(`Note: ${minerals.length} minerals match this pattern`);
            }
            this.checkDataConflicts(erocksRecord, minerals[0], result);
            return result;
          }
        } catch (error) {
          result.notes.push(`Variant search error for "${variant}": ${error}`);
        }
      }

      // Strategy 4: Fuzzy name search (using LIKE)
      try {
        const fuzzySearch = await this.sql`
          SELECT *, similarity(name, ${searchName}) as sim_score
          FROM mindat_minerals
          WHERE name ILIKE ${'%' + searchName.substring(0, Math.min(searchName.length, 10)) + '%'}
          ORDER BY char_length(name) ASC
          LIMIT 10
        `;

        for (const mineral of fuzzySearch) {
          const score = this.similarityScore(searchName, mineral.name);
          if (score > 80) {
            result.mindatData = mineral;
            result.matchType = 'fuzzy_name';
            result.confidence = score;
            result.needsReview = true; // Fuzzy matches need review
            result.notes.push(`Fuzzy match: "${searchName}" → "${mineral.name}" (${score.toFixed(1)}% similar)`);
            this.checkDataConflicts(erocksRecord, mineral, result);
            return result;
          }
        }
      } catch (error) {
        result.notes.push(`Fuzzy search error: ${error}`);
      }
    }

    // Strategy 5: Formula match (normalized to handle UTF-8 variations)
    if (formula && formula !== '') {
      const normalizedFormula = this.normalizeFormula(formula);
      result.notes.push(`Searching by formula: ${formula} (normalized: ${normalizedFormula})`);

      try {
        // First try exact match
        const exactFormulaMatch = await this.sql`
          SELECT * FROM mindat_minerals
          WHERE formula = ${formula}
          LIMIT 5
        `;

        if (exactFormulaMatch.length > 0) {
          result.mindatData = exactFormulaMatch[0];
          result.matchType = 'formula';
          result.confidence = 80;
          result.needsReview = true; // Formula matches need review
          result.notes.push(`Exact formula match: ${formula}`);
          if (exactFormulaMatch.length > 1) {
            result.notes.push(`Note: ${exactFormulaMatch.length} minerals share this formula`);
          }
          this.checkDataConflicts(erocksRecord, exactFormulaMatch[0], result);
          return result;
        }

        // Try normalized formula match (handles UTF-8 variations)
        if (normalizedFormula) {
          const normalizedFormulaMatch = await this.sql`
            SELECT * FROM mindat_minerals
            WHERE REPLACE(REPLACE(REPLACE(formula, ' ', ''), '·', '.'), '•', '.') = ${normalizedFormula}
            LIMIT 5
          `;

          if (normalizedFormulaMatch.length > 0) {
            result.mindatData = normalizedFormulaMatch[0];
            result.matchType = 'formula';
            result.confidence = 75;
            result.needsReview = true; // Formula matches need review
            result.notes.push(`Normalized formula match: "${formula}" → "${normalizedFormulaMatch[0].formula}"`);
            if (normalizedFormulaMatch.length > 1) {
              result.notes.push(`Note: ${normalizedFormulaMatch.length} minerals match normalized formula`);
            }
            this.checkDataConflicts(erocksRecord, normalizedFormulaMatch[0], result);
            return result;
          }
        }
      } catch (error) {
        result.notes.push(`Formula search error: ${error}`);
      }
    }

    result.notes.push('No match found in Mindat database');
    return result;
  }

  /**
   * Check for data conflicts between e-Rocks and Mindat
   */
  private checkDataConflicts(erocksRecord: ERocksMineral, mindatData: any, result: MatchResult): void {
    // Compare formula
    if (erocksRecord.Formula && mindatData.formula) {
      if (erocksRecord.Formula.trim() !== mindatData.formula.trim()) {
        result.conflicts.push(`Formula differs: e-Rocks="${erocksRecord.Formula}" vs Mindat="${mindatData.formula}"`);
      }
    }

    // Compare crystal system
    if (erocksRecord['Crystal System'] && mindatData.crystal_system) {
      const eCrystal = erocksRecord['Crystal System'].toLowerCase().trim();
      const mCrystal = mindatData.crystal_system.toLowerCase().trim();
      if (eCrystal !== mCrystal && eCrystal !== '' && mCrystal !== '') {
        result.conflicts.push(`Crystal System differs: e-Rocks="${erocksRecord['Crystal System']}" vs Mindat="${mindatData.crystal_system}"`);
      }
    }

    // Compare Strunz classification
    if (erocksRecord.Strunz && mindatData.strunz_id) {
      if (erocksRecord.Strunz.trim() !== mindatData.strunz_id.trim()) {
        result.conflicts.push(`Strunz differs: e-Rocks="${erocksRecord.Strunz}" vs Mindat="${mindatData.strunz_id}"`);
      }
    }
  }

  /**
   * Process entire e-Rocks CSV and generate enriched output
   */
  async processCSV(inputPath: string, outputDir: string): Promise<void> {
    console.log(`\n🔄 Starting e-Rocks data enrichment...`);
    console.log(`📁 Input: ${inputPath}`);
    console.log(`📂 Output: ${outputDir}\n`);

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    const matches: MatchResult[] = [];
    const allRecords: ERocksMineral[] = [];
    const skippedRecords: ERocksMineral[] = [];

    // Read and parse CSV with UTF-8 encoding
    await new Promise<void>((resolve, reject) => {
      createReadStream(inputPath, { encoding: 'utf8' })
        .pipe(csv())
        .on('data', (row) => {
          allRecords.push(row as ERocksMineral);
        })
        .on('end', () => {
          console.log(`✅ Loaded ${allRecords.length} total records from CSV\n`);
          resolve();
        })
        .on('error', reject);
    });

    // Filter for Class="Mineral" only
    const mineralRecords = allRecords.filter(record => {
      if (this.shouldProcessRecord(record)) {
        return true;
      } else {
        skippedRecords.push(record);
        return false;
      }
    });

    console.log(`   ${mineralRecords.length} minerals to process`);
    console.log(`   ${skippedRecords.length} non-minerals skipped\n`);

    // Process each mineral record
    console.log(`🔍 Matching minerals to Mindat database...\n`);
    let processed = 0;

    for (const record of mineralRecords) {
      try {
        const match = await this.matchMineral(record);
        matches.push(match);

        processed++;
        if (processed % 100 === 0) {
          console.log(`Progress: ${processed}/${mineralRecords.length} (${((processed/mineralRecords.length)*100).toFixed(1)}%)`);
        }
      } catch (error) {
        console.error(`Error processing "${record.Title}":`, error);
        matches.push({
          erocksRecord: record,
          mindatData: null,
          matchType: 'no_match',
          confidence: 0,
          notes: [`Processing error: ${error}`],
          conflicts: [],
          needsReview: false,
          isVariety: false,
          isSynonym: false
        });
      }
    }

    console.log(`\n✅ Processed all ${matches.length} mineral records\n`);

    // Generate statistics
    const stats = this.generateMatchReport(matches);
    stats.skippedNonMinerals = skippedRecords.length;
    stats.needsReviewCount = matches.filter(m => m.needsReview).length;

    console.log('📊 Match Statistics:');
    console.log(`   Total CSV records: ${allRecords.length}`);
    console.log(`   Minerals processed: ${matches.length}`);
    console.log(`   Non-minerals skipped: ${stats.skippedNonMinerals}`);
    console.log(`   ✅ Exact ID matches: ${stats.exactIdMatches}`);
    console.log(`   ✅ Exact name matches: ${stats.exactNameMatches}`);
    console.log(`   🔍 Fuzzy matches: ${stats.fuzzyMatches}`);
    console.log(`   🧪 Formula matches: ${stats.formulaMatches}`);
    console.log(`   ❌ No matches: ${stats.noMatches}`);
    console.log(`   ⚠️  Needs review: ${stats.needsReviewCount}`);
    console.log(`   ⚠️  With conflicts: ${stats.withConflicts}`);
    console.log(`   📝 Varieties: ${stats.varieties}`);
    console.log(`   📝 Synonyms: ${stats.synonyms}\n`);

    // Generate 5 output files
    const updatePath = path.join(outputDir, 'erocks_UPDATE.csv');
    const exceptionsPath = path.join(outputDir, 'erocks_EXCEPTIONS.csv');
    const skippedPath = path.join(outputDir, 'erocks_SKIPPED.csv');
    const newMineralsPath = path.join(outputDir, 'mindat_NEW_MINERALS.csv');
    const reportPath = path.join(outputDir, 'match_report.json');

    // Split matches into categories
    const matched = matches.filter(m => m.matchType !== 'no_match');
    const exceptions = matches.filter(m => m.matchType === 'no_match');

    await this.generateUpdateCSV(matched, updatePath);
    await this.generateExceptionsCSV(exceptions, exceptionsPath);
    await this.generateSkippedCSV(skippedRecords, skippedPath);
    await this.generateNewMineralsCSV(matched, newMineralsPath);

    // Write statistics report
    await fs.writeFile(reportPath, JSON.stringify({
      stats,
      timestamp: new Date().toISOString(),
      inputFile: inputPath,
      totalCSVRecords: allRecords.length,
      mineralRecords: matches.length,
      skippedRecords: skippedRecords.length,
      matchedRecords: matched.length,
      exceptionRecords: exceptions.length,
      needsReview: stats.needsReviewCount,
      newMindatMinerals: '(calculated in NEW_MINERALS file)'
    }, null, 2));

    console.log(`📄 Output files generated:`);
    console.log(`   ${updatePath} (${matched.length} records)`);
    console.log(`   ${exceptionsPath} (${exceptions.length} records)`);
    console.log(`   ${skippedPath} (${skippedRecords.length} records)`);
    console.log(`   ${newMineralsPath} (check file for count)`);
    console.log(`   ${reportPath}\n`);
    console.log(`✅ Enrichment complete!\n`);
  }

  /**
   * Generate UPDATE CSV with e-Rocks field names (Mindat as source of truth)
   */
  async generateUpdateCSV(matches: MatchResult[], outputPath: string): Promise<void> {
    if (matches.length === 0) {
      console.log(`⚠️  No records to write to ${outputPath}`);
      return;
    }

    // Prepare CSV rows with consistent field order
    const rows = await Promise.all(matches.map(async match => {
      const erocks = match.erocksRecord;
      const mindat = match.mindatData;

      // Extract relationship data from Mindat
      const relationships = await this.extractRelationshipData(mindat);

      // Concatenate Strunz parts: strunz10ed1.strunz10ed2+strunz10ed3.strunz10ed4 (e.g., 5.BE.45)
      const parts = [mindat?.strunz10ed1, mindat?.strunz10ed2, mindat?.strunz10ed3, mindat?.strunz10ed4].filter(p => p);
      let strunz = '';
      if (parts.length === 1) {
        strunz = parts[0];
      } else if (parts.length === 2) {
        strunz = parts[0] + '.' + parts[1];
      } else if (parts.length === 3) {
        strunz = parts[0] + '.' + parts[1] + parts[2];
      } else if (parts.length === 4) {
        strunz = parts[0] + '.' + parts[1] + parts[2] + '.' + parts[3];
      }
      const cleanStrunz = (strunz === '0' || strunz === 0 || !strunz) ? (erocks.Strunz || '') : strunz;

      // Title: Preserve e-Rocks title for varieties/synonyms, otherwise use Mindat
      const title = (match.isVariety || match.isSynonym) ? erocks.Title : (mindat?.name || erocks.Title || '');

      // For varieties/synonyms: preserve e-Rocks data, only update Mindat ID/URL and relationships
      // For normal minerals: use Mindat data as source of truth
      const isVarietyOrSynonym = match.isVariety || match.isSynonym;

      // Hardness: convert 0 to empty
      const hardnessMax = isVarietyOrSynonym ? erocks['Hardness Max'] || '' : (mindat?.hardness_max?.toString() || mindat?.hardness?.split('-')?.[1]?.trim() || erocks['Hardness Max'] || '');
      const hardnessMin = isVarietyOrSynonym ? erocks['Hardness Min'] || '' : (mindat?.hardness_min?.toString() || mindat?.hardness?.split('-')?.[0]?.trim() || erocks['Hardness Min'] || '');
      const cleanHardnessMax = hardnessMax === '0' ? '' : hardnessMax;
      const cleanHardnessMin = hardnessMin === '0' ? '' : hardnessMin;

      return {
        'Title': title,
        'Short Description': isVarietyOrSynonym ? '' : (mindat?.description_short || ''),
        'Synonyms': erocks.Synonyms || '',
        'Mindat ID': mindat?.mindat_id?.toString() || erocks['Mindat ID'] || '',
        'Mindat URL': mindat?.mindat_id ? `https://www.mindat.org/min-${mindat.mindat_id}.html` : erocks['Mindat URL'] || '',
        'Formula': isVarietyOrSynonym ? erocks.Formula || '' : (mindat?.formula || mindat?.ima_formula || erocks.Formula || ''),
        'Crystal System': isVarietyOrSynonym ? erocks['Crystal System'] || '' : (mindat?.crystal_system || erocks['Crystal System'] || ''),
        'Hardness Min': cleanHardnessMin,
        'Hardness Max': cleanHardnessMax,
        'Streak': isVarietyOrSynonym ? erocks.Streak || '' : (mindat?.streak || erocks.Streak || ''),
        'Tenacity': isVarietyOrSynonym ? erocks.Tenacity || '' : (mindat?.tenacity || erocks.Tenacity || ''),
        'Colour': isVarietyOrSynonym ? erocks.Colour || '' : (mindat?.colour || mindat?.color || erocks.Colour || ''),
        'Type Locality': erocks['Type Locality'] || '',
        'Strunz': cleanStrunz,
        'Mindat Status': mindat?.ima_status || '',
        'Variety Of': relationships.varietyOf || erocks['Variety Of'] || '',
        'Group Parent': relationships.groupParent || erocks['Group Parent'] || '',
        'Polymorph of': erocks['Polymorph of'] || '',
        'Polytype Of': relationships.polytypeOf || erocks['Polytype Of'] || '',
        'Mixture of': erocks['Mixture Of'] || '',
        'Synonym of': relationships.synonymOf || erocks['Synonym Of'] || '',
        'Habit of': erocks['Habit Of'] || '',
        'Renamed To': erocks['Renamed To'] || '',
        'Unnamed': erocks.Unnamed || '',
        'Class': 'Mineral',
        'Nid': erocks.Nid || ''  // MANDATORY for e-Rocks UPDATE
      };
    }));

    // Convert to CSV using csv-stringify
    const csvContent = stringify(rows, {
      header: true,
      quoted: true,
      quoted_empty: true,
      bom: true // Add UTF-8 BOM for Excel compatibility
    });

    // Write to file
    await fs.writeFile(outputPath, csvContent, { encoding: 'utf8' });
    console.log(`✅ Wrote ${rows.length} records to ${outputPath}`);
  }

  /**
   * Generate EXCEPTIONS CSV (unmatched e-Rocks minerals)
   */
  async generateExceptionsCSV(matches: MatchResult[], outputPath: string): Promise<void> {
    if (matches.length === 0) {
      console.log(`⚠️  No exceptions to write`);
      return;
    }

    const rows = matches.map(match => {
      const erocks = match.erocksRecord;
      return {
        ...erocks,  // Keep all original e-Rocks fields
        'Mindat Status': erocks['Mindat Status'] || '',  // Preserve if exists, empty otherwise
        'Tenacity': erocks.Tenacity || '',  // Preserve if exists
        'Match Notes': match.notes.join(' | ')
      };
    });

    const csvContent = stringify(rows, {
      header: true,
      quoted: true,
      quoted_empty: true,
      bom: true
    });

    await fs.writeFile(outputPath, csvContent, { encoding: 'utf8' });
    console.log(`✅ Wrote ${rows.length} exception records to ${outputPath}`);
  }

  /**
   * Generate SKIPPED CSV (non-mineral records)
   */
  async generateSkippedCSV(records: ERocksMineral[], outputPath: string): Promise<void> {
    if (records.length === 0) {
      console.log(`⚠️  No skipped records`);
      return;
    }

    const csvContent = stringify(records, {
      header: true,
      quoted: true,
      quoted_empty: true,
      bom: true
    });

    await fs.writeFile(outputPath, csvContent, { encoding: 'utf8' });
    console.log(`✅ Wrote ${records.length} skipped records to ${outputPath}`);
  }

  /**
   * Generate NEW MINERALS CSV (Mindat minerals not in e-Rocks)
   */
  async generateNewMineralsCSV(matchedRecords: MatchResult[], outputPath: string): Promise<void> {
    console.log(`\n🔍 Finding new Mindat minerals not in e-Rocks...`);

    // Get all Mindat IDs and names already in e-Rocks
    const eRocksIds = new Set(
      matchedRecords
        .map(m => m.erocksRecord['Mindat ID']?.trim())
        .filter(id => id && id !== '')
        .map(id => parseInt(id))
        .filter(id => !isNaN(id))  // Filter out NaN values from ER-prefixed IDs
    );

    const eRocksNames = new Set(
      matchedRecords
        .map(m => m.erocksRecord.Title?.toLowerCase().trim())
        .filter(name => name)
    );

    console.log(`   e-Rocks has ${eRocksIds.size} Mindat IDs and ${eRocksNames.size} unique names`);

    // Query for NEW approved minerals not in e-Rocks
    // Exclude minerals with NULL or empty IMA status
    const eRocksIdArray = Array.from(eRocksIds);
    const eRocksNameArray = Array.from(eRocksNames);

    const newMinerals = eRocksIdArray.length > 0 && eRocksNameArray.length > 0
      ? await this.sql`
          SELECT * FROM mindat_minerals
          WHERE mindat_id != ALL(${eRocksIdArray})
            AND LOWER(name) != ALL(${eRocksNameArray})
            AND ima_status IS NOT NULL
            AND ima_status != ''
            AND ima_status != '{}'
          ORDER BY name
          LIMIT 5000
        `
      : await this.sql`
          SELECT * FROM mindat_minerals
          WHERE ima_status IS NOT NULL
            AND ima_status != ''
            AND ima_status != '{}'
          ORDER BY name
          LIMIT 5000
        `;

    console.log(`   Found ${newMinerals.length} new minerals to import\n`);

    if (newMinerals.length === 0) {
      console.log(`⚠️  No new minerals to write`);
      return;
    }

    // Map Mindat fields to consistent field order
    const rows = newMinerals.map(mindat => {
      // Concatenate Strunz parts: strunz10ed1.strunz10ed2+strunz10ed3.strunz10ed4 (e.g., 5.BE.45)
      const parts = [mindat.strunz10ed1, mindat.strunz10ed2, mindat.strunz10ed3, mindat.strunz10ed4].filter(p => p);
      let strunz = '';
      if (parts.length === 1) {
        strunz = parts[0];
      } else if (parts.length === 2) {
        strunz = parts[0] + '.' + parts[1];
      } else if (parts.length === 3) {
        strunz = parts[0] + '.' + parts[1] + parts[2];
      } else if (parts.length === 4) {
        strunz = parts[0] + '.' + parts[1] + parts[2] + '.' + parts[3];
      }
      const cleanStrunz = (strunz === '0' || strunz === 0 || !strunz) ? '' : strunz;

      // Hardness: convert 0 to empty
      const hardnessMax = mindat.hardness_max?.toString() || mindat.hardness?.split('-')?.[1]?.trim() || '';
      const hardnessMin = mindat.hardness_min?.toString() || mindat.hardness?.split('-')?.[0]?.trim() || '';
      const cleanHardnessMax = hardnessMax === '0' ? '' : hardnessMax;
      const cleanHardnessMin = hardnessMin === '0' ? '' : hardnessMin;

      // Type Locality: not available in current Neon schema
      const typeLocality = '';

      return {
        'Title': mindat.name || '',
        'Short Description': mindat.description_short || '',
        'Synonyms': '',
        'Mindat ID': mindat.mindat_id?.toString() || '',
        'Mindat URL': `https://www.mindat.org/min-${mindat.mindat_id}.html`,
        'Formula': mindat.formula || mindat.ima_formula || '',
        'Crystal System': mindat.crystal_system || '',
        'Hardness Min': cleanHardnessMin,
        'Hardness Max': cleanHardnessMax,
        'Streak': mindat.streak || '',
        'Tenacity': mindat.tenacity || '',
        'Colour': mindat.colour || mindat.color || '',
        'Type Locality': typeLocality,
        'Strunz': cleanStrunz,
        'Mindat Status': mindat.ima_status || '',
        'Variety Of': '',
        'Group Parent': '',
        'Polymorph of': '',
        'Polytype Of': '',
        'Mixture of': '',
        'Synonym of': '',
        'Habit of': '',
        'Renamed To': '',
        'Unnamed': '',
        'Class': 'Mineral'
      };
    });

    const csvContent = stringify(rows, {
      header: true,
      quoted: true,
      quoted_empty: true,
      bom: true
    });

    await fs.writeFile(outputPath, csvContent, { encoding: 'utf8' });
    console.log(`✅ Wrote ${rows.length} new mineral records to ${outputPath}`);
  }

  /**
   * Generate match statistics report
   */
  generateMatchReport(matches: MatchResult[]): any {
    const stats = {
      total: matches.length,
      exactIdMatches: 0,
      exactNameMatches: 0,
      fuzzyMatches: 0,
      formulaMatches: 0,
      noMatches: 0,
      withConflicts: 0,
      varieties: 0,
      synonyms: 0
    };

    matches.forEach(match => {
      switch (match.matchType) {
        case 'exact_id':
          stats.exactIdMatches++;
          break;
        case 'exact_name':
          stats.exactNameMatches++;
          break;
        case 'fuzzy_name':
          stats.fuzzyMatches++;
          break;
        case 'formula':
          stats.formulaMatches++;
          break;
        case 'no_match':
          stats.noMatches++;
          break;
      }

      if (match.conflicts.length > 0) {
        stats.withConflicts++;
      }

      if (match.erocksRecord['Variety Of']) {
        stats.varieties++;
      }

      if (match.erocksRecord['Synonym Of']) {
        stats.synonyms++;
      }
    });

    return stats;
  }
}
