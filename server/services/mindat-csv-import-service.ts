import { db } from '../db';
import { mindatMinerals, mineralNameIndex, dataSources } from '@shared/schema';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

interface MindatCSVRow {
  [key: string]: string;
}

interface ImportProgress {
  totalProcessed: number;
  totalFailed: number;
  totalCreated: number;
  totalUpdated: number;
  errors: string[];
}

export class MindatCSVImportService {
  private static instance: MindatCSVImportService;
  private mindatDataSourceId: number | null = null;

  private constructor() {}

  static getInstance(): MindatCSVImportService {
    if (!MindatCSVImportService.instance) {
      MindatCSVImportService.instance = new MindatCSVImportService();
    }
    return MindatCSVImportService.instance;
  }

  private async ensureMindatDataSource(): Promise<number> {
    if (this.mindatDataSourceId !== null) {
      return this.mindatDataSourceId;
    }

    const existing = await db.select()
      .from(dataSources)
      .where(eq(dataSources.name, 'mindat_csv'))
      .limit(1);

    if (existing.length > 0) {
      this.mindatDataSourceId = existing[0].id;
      return existing[0].id;
    }

    const [newSource] = await db.insert(dataSources).values({
      name: 'mindat_csv',
      description: 'Mindat Database - CSV Dump Import',
      priority: 100,
      isActive: true,
      metadata: {
        source: 'csv_import',
        importDate: new Date().toISOString(),
      },
    }).returning();

    this.mindatDataSourceId = newSource.id;
    return newSource.id;
  }

  // Helper functions for data conversion
  private toInt(value: string | null | undefined): number | null {
    if (!value || value.trim() === '' || value === 'NULL') return null;
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  }

  private toReal(value: string | null | undefined): number | null {
    if (!value || value.trim() === '' || value === 'NULL') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  private toArray(value: string | null | undefined): string[] | null {
    if (!value || value.trim() === '' || value === 'NULL') return null;
    // Handle both comma-separated and already-parsed arrays
    if (Array.isArray(value)) return value;
    return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
  }

  private toString(value: string | null | undefined): string | null {
    if (!value || value.trim() === '' || value === 'NULL') return null;
    return value.trim();
  }

  private toTimestamp(value: string | null | undefined): Date | null {
    if (!value || value.trim() === '' || value === 'NULL') return null;
    const timestamp = parseInt(value, 10);
    if (isNaN(timestamp)) return null;
    return new Date(timestamp * 1000); // Convert Unix timestamp to Date
  }

  private toBool(value: string | null | undefined): boolean | null {
    if (!value || value.trim() === '' || value === 'NULL') return null;
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
    return null;
  }

  private generateHash(data: any): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  async importFromCSV(filePath: string, options: {
    batchSize?: number;
    skipExisting?: boolean;
  } = {}): Promise<ImportProgress> {
    await this.ensureMindatDataSource();

    const { batchSize = 100, skipExisting = false } = options;

    const progress: ImportProgress = {
      totalProcessed: 0,
      totalFailed: 0,
      totalCreated: 0,
      totalUpdated: 0,
      errors: [],
    };

    try {
      console.log('Reading Mindat CSV file...');
      const fileContent = readFileSync(filePath, 'utf-8');

      console.log('Parsing CSV...');
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        relax_quotes: true,
      }) as MindatCSVRow[];

      console.log(`Parsed ${records.length} minerals from Mindat CSV`);
      console.log('Sample columns:', Object.keys(records[0]).slice(0, 20).join(', '));

      const batch: any[] = [];

      for (const record of records) {
        try {
          progress.totalProcessed++;

          // Extract mindat_id - try common column names
          const mindatId = this.toInt(
            record.mindat_id ||
            record.id ||
            record.mineral_id ||
            record.Id ||
            record.ID
          );

          if (!mindatId) {
            progress.totalFailed++;
            progress.errors.push(`Row ${progress.totalProcessed}: Missing mindat_id`);
            continue;
          }

          // Check if exists
          if (skipExisting) {
            const existing = await db.select()
              .from(mindatMinerals)
              .where(eq(mindatMinerals.mindatId, mindatId))
              .limit(1);

            if (existing.length > 0) {
              continue;
            }
          }

          // Map CSV fields to database schema
          // Adjust these mappings based on your actual CSV column names
          const mineralData: any = {
            mindatId,
            name: this.toString(record.name || record.mineral_name || record.Name),

            // Basic info
            guid: this.toString(record.guid || record.GUID),
            longId: this.toString(record.long_id || record.longid),
            entryType: this.toInt(record.entry_type || record.entrytype),
            entryTypeText: this.toString(record.entry_type_text || record.entrytypetext),
            updtTime: this.toTimestamp(record.updt_time || record.updttime),

            // Formula and IMA
            imaFormula: this.toString(record.ima_formula || record.imaformula),
            mindatFormula: this.toString(record.mindat_formula || record.formula),
            mindatFormulaNote: this.toString(record.mindat_formula_note),
            imaStatus: this.toString(record.ima_status || record.imastatus),
            imaSymbol: this.toString(record.ima_symbol || record.imasymbol),
            imaNotes: this.toString(record.ima_notes),
            imaHistory: this.toString(record.ima_history),
            imaYear: this.toInt(record.ima_year),
            approvalYear: this.toInt(record.approval_year),
            publicationYear: this.toInt(record.publication_year),
            discoveryYear: this.toInt(record.discovery_year || record.year_named),
            shortcodeIma: this.toString(record.shortcode_ima),

            // Descriptions
            aboutName: this.toString(record.about_name),
            descriptionShort: this.toString(record.description_short),
            description: this.toString(record.description),
            occurrence: this.toString(record.occurrence),

            // Crystal system
            crystalSystem: this.toString(record.crystal_system || record.crystalsystem),
            csMetamict: this.toString(record.cs_metamict),
            spaceGroup: this.toString(record.space_group || record.spacegroup),
            spaceGroupSet: this.toString(record.space_group_set),

            // Unit cell
            unitCellA: this.toReal(record.unit_cell_a),
            unitCellAError: this.toReal(record.unit_cell_a_error),
            unitCellB: this.toReal(record.unit_cell_b),
            unitCellBError: this.toReal(record.unit_cell_b_error),
            unitCellC: this.toReal(record.unit_cell_c),
            unitCellCError: this.toReal(record.unit_cell_c_error),
            unitCellAlpha: this.toReal(record.unit_cell_alpha),
            unitCellAlphaError: this.toReal(record.unit_cell_alpha_error),
            unitCellBeta: this.toReal(record.unit_cell_beta),
            unitCellBetaError: this.toReal(record.unit_cell_beta_error),
            unitCellGamma: this.toReal(record.unit_cell_gamma),
            unitCellGammaError: this.toReal(record.unit_cell_gamma_error),
            unitCellVolume: this.toReal(record.unit_cell_volume),
            zValue: this.toReal(record.z_value),

            // Hardness
            hardnessMin: this.toReal(record.hardness_min || record.hardnessmin),
            hardnessMax: this.toReal(record.hardness_max || record.hardnessmax),
            hardType: this.toString(record.hard_type),

            // Density
            densityMin: this.toReal(record.density_min),
            densityMax: this.toReal(record.density_max),
            densityCalc: this.toReal(record.density_calc),
            specificGravityMin: this.toReal(record.specific_gravity_min),
            specificGravityMax: this.toReal(record.specific_gravity_max),

            // Physical properties
            colour: this.toString(record.colour || record.color || record.colors),
            color: this.toString(record.color || record.colors),
            diaphaneity: this.toString(record.diaphaneity),
            lustre: this.toString(record.lustre || record.luster),
            lustreType: this.toString(record.lustre_type),
            streak: this.toString(record.streak),
            fracture: this.toString(record.fracture),
            fractureType: this.toString(record.fracture_type),
            cleavage: this.toString(record.cleavage),
            cleavageType: this.toString(record.cleavage_type),
            tenacity: this.toString(record.tenacity),
            habit: this.toString(record.habit),
            morphology: this.toString(record.morphology),

            // Classification
            strunz10ed1: this.toString(record.strunz10ed1),
            strunz10ed2: this.toString(record.strunz10ed2),
            strunz10ed3: this.toString(record.strunz10ed3),
            strunz10ed4: this.toString(record.strunz10ed4),
            strunzClass: this.toString(record.strunz_class || record.strunzclass),
            dana8ed1: this.toString(record.dana8ed1),
            dana8ed2: this.toString(record.dana8ed2),
            dana8ed3: this.toString(record.dana8ed3),
            dana8ed4: this.toString(record.dana8ed4),
            danaClass: this.toString(record.dana_class),

            // Chemistry
            elements: this.toArray(record.elements || record.formula_elements),
            keyElements: this.toArray(record.key_elements),

            // Metadata
            imageUrl: this.toString(record.image_url),
            imageCount: this.toInt(record.image_count),
            localityCount: this.toInt(record.locality_count),

            // Generate hash for change detection
            dataHash: this.generateHash(record),
            lastSyncedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          batch.push(mineralData);

          // Insert in batches
          if (batch.length >= batchSize) {
            await this.insertBatch(batch, progress);
            batch.length = 0;
          }

          // Progress logging
          if (progress.totalProcessed % 500 === 0) {
            console.log(`Processed ${progress.totalProcessed}/${records.length} minerals... (Created: ${progress.totalCreated}, Failed: ${progress.totalFailed})`);
          }

        } catch (error: any) {
          progress.totalFailed++;
          const errorMsg = `Row ${progress.totalProcessed}: ${error.message}`;
          progress.errors.push(errorMsg);
          if (progress.errors.length <= 10) {
            console.error(errorMsg);
          }
        }
      }

      // Insert remaining batch
      if (batch.length > 0) {
        await this.insertBatch(batch, progress);
      }

      console.log(`\nImport completed:`);
      console.log(`- Total processed: ${progress.totalProcessed}`);
      console.log(`- Created: ${progress.totalCreated}`);
      console.log(`- Updated: ${progress.totalUpdated}`);
      console.log(`- Failed: ${progress.totalFailed}`);

      return progress;

    } catch (error: any) {
      console.error('Fatal error during import:', error);
      throw error;
    }
  }

  private async insertBatch(batch: any[], progress: ImportProgress): Promise<void> {
    try {
      // Use INSERT ... ON CONFLICT DO UPDATE for upsert behavior
      for (const item of batch) {
        try {
          const existing = await db.select()
            .from(mindatMinerals)
            .where(eq(mindatMinerals.mindatId, item.mindatId))
            .limit(1);

          if (existing.length > 0) {
            // Update existing
            await db.update(mindatMinerals)
              .set({
                ...item,
                updatedAt: new Date(),
              })
              .where(eq(mindatMinerals.mindatId, item.mindatId));
            progress.totalUpdated++;
          } else {
            // Insert new
            await db.insert(mindatMinerals).values(item);
            progress.totalCreated++;
          }
        } catch (error: any) {
          progress.totalFailed++;
          progress.errors.push(`Failed to insert mindat_id ${item.mindatId}: ${error.message}`);
        }
      }
    } catch (error: any) {
      console.error('Batch insert error:', error);
      throw error;
    }
  }

  async clearMindatData(): Promise<void> {
    console.log('Clearing all Mindat CSV data...');
    await db.delete(mindatMinerals);
    console.log('Mindat data cleared.');
  }

  async getImportStats(): Promise<any> {
    const [stats] = await db.select({
      count: mindatMinerals.id,
    })
    .from(mindatMinerals);

    return {
      totalMinerals: stats?.count || 0,
    };
  }
}
