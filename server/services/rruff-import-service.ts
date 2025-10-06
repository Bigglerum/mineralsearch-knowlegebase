import { db } from '../db';
import { rruffMinerals, dataSources } from '@shared/schema';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { eq } from 'drizzle-orm';

interface RruffCSVRow {
  'Mineral Name': string;
  'Mineral Name (plain)': string;
  'IMA Chemistry (HTML)': string;
  'Chemistry Elements': string;
  'Year First Published': string;
  'IMA Status': string;
  'Structural Groupname': string;
  'Crystal Systems': string;
  'Valence Elements': string;
  'IMA Mineral Symbol': string;
}

interface ImportProgress {
  totalProcessed: number;
  totalFailed: number;
  totalCreated: number;
  errors: string[];
}

export class RruffImportService {
  private static instance: RruffImportService;
  private rruffDataSourceId: number | null = null;

  private constructor() {}

  static getInstance(): RruffImportService {
    if (!RruffImportService.instance) {
      RruffImportService.instance = new RruffImportService();
    }
    return RruffImportService.instance;
  }

  private async ensureRruffDataSource(): Promise<number> {
    if (this.rruffDataSourceId !== null) {
      return this.rruffDataSourceId;
    }

    const existing = await db.select()
      .from(dataSources)
      .where(eq(dataSources.name, 'rruff'))
      .limit(1);

    if (existing.length > 0) {
      this.rruffDataSourceId = existing[0].id;
      return existing[0].id;
    }

    const [newSource] = await db.insert(dataSources).values({
      name: 'rruff',
      description: 'RRUFF Database - Core mineral data for search index',
      priority: 80,
      isActive: true,
      metadata: {
        url: 'https://rruff.info',
        exportDate: '2025-09-08',
      },
    }).returning();

    this.rruffDataSourceId = newSource.id;
    return newSource.id;
  }

  async importFromCSV(filePath: string): Promise<ImportProgress> {
    await this.ensureRruffDataSource();

    const progress: ImportProgress = {
      totalProcessed: 0,
      totalFailed: 0,
      totalCreated: 0,
      errors: [],
    };

    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as RruffCSVRow[];

      console.log(`Parsed ${records.length} minerals from RRUFF CSV`);

      for (const record of records) {
        try {
          progress.totalProcessed++;

          const mineralData = {
            mineralName: record['Mineral Name (plain)'] || record['Mineral Name'],
            mineralNameHtml: record['Mineral Name'],
            imaChemistry: record['IMA Chemistry (HTML)'],
            chemistryElements: record['Chemistry Elements'],
            yearFirstPublished: record['Year First Published'] 
              ? parseInt(record['Year First Published'], 10) 
              : null,
            imaStatus: record['IMA Status'],
            structuralGroupname: record['Structural Groupname'],
            crystalSystems: record['Crystal Systems'],
            valenceElements: record['Valence Elements'],
            imaSymbol: record['IMA Mineral Symbol'],
            enrichmentStatus: 'not_enriched' as const,
          };

          await db.insert(rruffMinerals).values(mineralData);
          progress.totalCreated++;

          if (progress.totalProcessed % 500 === 0) {
            console.log(`Imported ${progress.totalProcessed}/${records.length} minerals...`);
          }
        } catch (error: any) {
          progress.totalFailed++;
          const errorMsg = `Failed to import ${record['Mineral Name (plain)']}: ${error.message}`;
          progress.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      console.log(`RRUFF import completed. Created: ${progress.totalCreated}, Failed: ${progress.totalFailed}`);
      return progress;
    } catch (error: any) {
      console.error('Error reading or parsing CSV file:', error);
      throw new Error(`CSV import failed: ${error.message}`);
    }
  }

  async clearRruffData(): Promise<void> {
    await db.delete(rruffMinerals);
    console.log('Cleared all RRUFF minerals');
  }

  async getImportStats() {
    const result = await db.select()
      .from(rruffMinerals)
      .limit(1);
    
    const count = result.length > 0 
      ? await db.select({ count: rruffMinerals.id })
          .from(rruffMinerals)
      : [];

    return {
      totalMinerals: count.length,
      enrichedCount: 0,
      notEnrichedCount: 0,
    };
  }
}
