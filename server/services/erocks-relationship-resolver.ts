import { neon } from '@neondatabase/serverless';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import csv from 'csv-parser';
import { stringify } from 'csv-stringify/sync';

/**
 * Phase 2: Relationship Resolver
 *
 * Takes a complete e-Rocks CSV (post Phase 1 import) with all Nids
 * and resolves Mindat relationships to e-Rocks entity references.
 */

interface ERocksRecord {
  'Nid': string;
  'Title': string;
  'Mindat ID': string;
  'Variety Of': string;
  'Group Parent': string;
  'Synonym Of': string;
  'Polytype Of': string;
  [key: string]: string;
}

interface RelationshipOutput {
  'Nid': string;
  'Title': string;
  'Variety Of': string;          // e-Rocks Nid
  'Group Parent': string;         // e-Rocks Nid
  'Synonym Of': string;           // e-Rocks Nid
  'Polytype Of': string;          // e-Rocks Nid
  'Variety Of Name': string;      // Display name for review
  'Group Parent Name': string;    // Display name for review
  'Synonym Of Name': string;      // Display name for review
  'Polytype Of Name': string;     // Display name for review
  'Resolution Notes': string;     // Any warnings/notes
}

export class ERocksRelationshipResolver {
  private sql: ReturnType<typeof neon>;
  private mindatToNidMap: Map<number, string> = new Map();
  private mindatToNameMap: Map<number, string> = new Map();

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    this.sql = neon(process.env.DATABASE_URL);
  }

  /**
   * Load e-Rocks CSV and build Mindat ID → e-Rocks Nid lookup table
   */
  async buildNidLookupTable(erocksCSVPath: string): Promise<void> {
    console.log('🔄 Building Mindat ID → e-Rocks Nid lookup table...');

    const records: ERocksRecord[] = [];

    await new Promise<void>((resolve, reject) => {
      createReadStream(erocksCSVPath)
        .pipe(csv())
        .on('data', (data: ERocksRecord) => records.push(data))
        .on('end', () => resolve())
        .on('error', (error) => reject(error));
    });

    let mappedCount = 0;
    for (const record of records) {
      const mindatId = parseInt(record['Mindat ID']?.trim());
      const nid = record.Nid?.trim();
      const title = record.Title?.trim();

      if (mindatId && !isNaN(mindatId) && nid) {
        this.mindatToNidMap.set(mindatId, nid);
        this.mindatToNameMap.set(mindatId, title || '');
        mappedCount++;
      }
    }

    console.log(`✅ Built lookup table: ${mappedCount} Mindat IDs mapped to e-Rocks Nids`);
    console.log(`   Total e-Rocks records: ${records.length}`);
  }

  /**
   * Resolve a Mindat ID to e-Rocks Nid
   */
  private resolveToNid(mindatId: number | null): { nid: string | null; name: string | null } {
    if (!mindatId || mindatId === 0) {
      return { nid: null, name: null };
    }

    const nid = this.mindatToNidMap.get(mindatId) || null;
    const name = this.mindatToNameMap.get(mindatId) || null;

    return { nid, name };
  }

  /**
   * Resolve a Group ID (which is also a Mindat ID) to e-Rocks Nid
   */
  private resolveGroupToNid(groupId: number | null): { nid: string | null; name: string | null } {
    // Group IDs in Mindat are actually Mindat IDs of the group mineral
    return this.resolveToNid(groupId);
  }

  /**
   * Get Mindat relationship data for a mineral
   */
  private async getMindatRelationships(mindatId: number): Promise<{
    varietyOf: number | null;
    groupId: number | null;
    synId: number | null;
    polytypeOf: string | null;
  }> {
    try {
      const result = await this.sql`
        SELECT variety_of, group_id, syn_id, polytype_of
        FROM mindat_minerals
        WHERE mindat_id = ${mindatId}
        LIMIT 1
      `;

      if (result.length === 0) {
        return { varietyOf: null, groupId: null, synId: null, polytypeOf: null };
      }

      const record = result[0];
      return {
        varietyOf: record.variety_of || null,
        groupId: record.group_id || null,
        synId: record.syn_id || null,
        polytypeOf: record.polytype_of !== '0' ? record.polytype_of : null
      };
    } catch (error) {
      console.error(`Error fetching Mindat relationships for ID ${mindatId}:`, error);
      return { varietyOf: null, groupId: null, synId: null, polytypeOf: null };
    }
  }

  /**
   * Process all minerals and resolve relationships
   */
  async resolveRelationships(erocksCSVPath: string, outputPath: string): Promise<void> {
    console.log('\n🔄 Resolving relationships for all minerals...\n');

    // First, build the lookup table
    await this.buildNidLookupTable(erocksCSVPath);

    // Read all e-Rocks records
    const erocksRecords: ERocksRecord[] = [];
    await new Promise<void>((resolve, reject) => {
      createReadStream(erocksCSVPath)
        .pipe(csv())
        .on('data', (data: ERocksRecord) => erocksRecords.push(data))
        .on('end', () => resolve())
        .on('error', (error) => reject(error));
    });

    const relationshipOutputs: RelationshipOutput[] = [];
    let processedCount = 0;
    let resolvedCount = 0;

    for (const record of erocksRecords) {
      const mindatId = parseInt(record['Mindat ID']?.trim());
      const nid = record.Nid?.trim();
      const title = record.Title?.trim();

      if (!mindatId || isNaN(mindatId) || !nid) {
        // Skip records without Mindat ID or Nid
        continue;
      }

      processedCount++;

      // Get Mindat relationship data
      const mindatRels = await this.getMindatRelationships(mindatId);

      // Resolve to e-Rocks Nids
      const varietyOfResolved = this.resolveToNid(mindatRels.varietyOf);
      const groupResolved = this.resolveGroupToNid(mindatRels.groupId);
      const synOfResolved = this.resolveToNid(mindatRels.synId);

      // For polytype_of, try to resolve if it's a number
      let polytypeResolved = { nid: null as string | null, name: null as string | null };
      if (mindatRels.polytypeOf) {
        const polytypeId = parseInt(mindatRels.polytypeOf);
        if (!isNaN(polytypeId)) {
          polytypeResolved = this.resolveToNid(polytypeId);
        } else {
          // It's text, not an ID - store as name only
          polytypeResolved = { nid: null, name: mindatRels.polytypeOf };
        }
      }

      // Build notes
      const notes: string[] = [];
      if (mindatRels.varietyOf && !varietyOfResolved.nid) {
        notes.push(`Variety of Mindat ID ${mindatRels.varietyOf} not found in e-Rocks`);
      }
      if (mindatRels.groupId && !groupResolved.nid) {
        notes.push(`Group ID ${mindatRels.groupId} not found in e-Rocks`);
      }
      if (mindatRels.synId && !synOfResolved.nid) {
        notes.push(`Synonym of Mindat ID ${mindatRels.synId} not found in e-Rocks`);
      }

      // Count if any relationship was resolved
      if (varietyOfResolved.nid || groupResolved.nid || synOfResolved.nid || polytypeResolved.nid) {
        resolvedCount++;
      }

      relationshipOutputs.push({
        'Nid': nid,
        'Title': title || '',
        'Variety Of': varietyOfResolved.nid || '',
        'Group Parent': groupResolved.nid || '',
        'Synonym Of': synOfResolved.nid || '',
        'Polytype Of': polytypeResolved.nid || '',
        'Variety Of Name': varietyOfResolved.name || '',
        'Group Parent Name': groupResolved.name || '',
        'Synonym Of Name': synOfResolved.name || '',
        'Polytype Of Name': polytypeResolved.name || '',
        'Resolution Notes': notes.join(' | ')
      });

      // Progress indicator
      if (processedCount % 100 === 0) {
        console.log(`   Processed ${processedCount} minerals...`);
      }
    }

    console.log(`\n✅ Processed ${processedCount} minerals with Mindat IDs`);
    console.log(`   ${resolvedCount} minerals have at least one relationship resolved\n`);

    // Write output CSV
    const csvContent = stringify(relationshipOutputs, {
      header: true,
      quoted: true,
      quoted_empty: true,
      bom: true // UTF-8 BOM for Excel compatibility
    });

    await fs.writeFile(outputPath, csvContent, { encoding: 'utf8' });
    console.log(`✅ Wrote ${relationshipOutputs.length} records to ${outputPath}\n`);
  }

  /**
   * Generate statistics report
   */
  async generateReport(outputPath: string): Promise<void> {
    const stats = {
      totalMappings: this.mindatToNidMap.size,
      timestamp: new Date().toISOString()
    };

    await fs.writeFile(
      outputPath,
      JSON.stringify(stats, null, 2),
      { encoding: 'utf8' }
    );

    console.log('📊 Relationship Resolution Statistics:');
    console.log(`   Total Mindat → e-Rocks Nid mappings: ${stats.totalMappings}`);
  }
}
