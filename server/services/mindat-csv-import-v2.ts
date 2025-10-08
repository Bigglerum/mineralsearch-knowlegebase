import { db } from '../db';
import { mindatMinerals, dataSources } from '@shared/schema';
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

export class MindatCSVImportV2 {
  private static instance: MindatCSVImportV2;

  private constructor() {}

  static getInstance(): MindatCSVImportV2 {
    if (!MindatCSVImportV2.instance) {
      MindatCSVImportV2.instance = new MindatCSVImportV2();
    }
    return MindatCSVImportV2.instance;
  }

  // Helper functions for data conversion
  private toInt(value: string | null | undefined): number | null {
    if (!value || value.trim() === '' || value.toUpperCase() === 'NULL') return null;
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  }

  private toReal(value: string | null | undefined): number | null {
    if (!value || value.trim() === '' || value.toUpperCase() === 'NULL') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  private toArray(value: string | null | undefined): string[] | null {
    if (!value || value.trim() === '' || value.toUpperCase() === 'NULL') return null;
    if (Array.isArray(value)) return value;
    return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
  }

  private toString(value: string | null | undefined): string | null {
    if (!value || value.trim() === '' || value.toUpperCase() === 'NULL') return null;
    return value.trim();
  }

  private toTimestamp(value: string | null | undefined): Date | null {
    if (!value || value.trim() === '' || value.toUpperCase() === 'NULL') return null;
    // Try parsing as date string first
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
    return null;
  }

  async importFromCSV(filePath: string, options: {
    batchSize?: number;
    skipExisting?: boolean;
  } = {}): Promise<ImportProgress> {
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
      console.log(`Processing 83,437 minerals with 152 fields each...`);

      const batch: any[] = [];

      for (const record of records) {
        try {
          progress.totalProcessed++;

          const mindatId = this.toInt(record.md_id);

          if (!mindatId) {
            progress.totalFailed++;
            progress.errors.push(`Row ${progress.totalProcessed}: Missing md_id`);
            continue;
          }

          // Skip if exists
          if (skipExisting) {
            const existing = await db.select()
              .from(mindatMinerals)
              .where(eq(mindatMinerals.mindatId, mindatId))
              .limit(1);

            if (existing.length > 0) continue;
          }

          // Map all CSV fields to database schema (md_* columns → database fields)
          const mineralData: any = {
            mindatId,
            name: this.toString(record.md_name),
            guid: this.toString(record.md_guid),
            longId: this.toString(record.md_longid),
            entryType: this.toInt(record.md_entrytype),
            entryTypeText: this.toString(record.md_entrytype_text),
            updtTime: this.toTimestamp(record.md_updttime),

            // Formula and IMA
            imaFormula: this.toString(record.md_ima_formula),
            mindatFormula: this.toString(record.md_mindat_formula),
            mindatFormulaNote: this.toString(record.md_mindat_formula_note),
            imaStatus: this.toString(record.md_ima_status),
            imaSymbol: this.toString(record.md_shortcode_ima),
            imaNotes: this.toString(record.md_ima_notes),
            imaHistory: this.toString(record.md_ima_history),
            approvalYear: this.toInt(record.md_approval_year),
            publicationYear: this.toInt(record.md_publication_year),
            discoveryYear: this.toInt(record.md_discovery_year),
            shortcodeIma: this.toString(record.md_shortcode_ima),

            // Descriptions
            aboutName: this.toString(record.md_aboutname),
            descriptionShort: this.toString(record.md_description_short),
            occurrence: this.toString(record.md_occurrence),
            otherOccurrence: this.toString(record.md_otheroccurrence),

            // Crystal system
            crystalSystem: this.toString(record.md_csystem),
            csMetamict: this.toString(record.md_csmetamict),
            spaceGroup: this.toString(record.md_spacegroup),
            spaceGroupSet: this.toString(record.md_spacegroupset),

            // Unit cell
            unitCellA: this.toReal(record.md_a),
            unitCellAError: this.toReal(record.md_aerror),
            unitCellB: this.toReal(record.md_b),
            unitCellBError: this.toReal(record.md_berror),
            unitCellC: this.toReal(record.md_c),
            unitCellCError: this.toReal(record.md_cerror),
            unitCellAlpha: this.toReal(record.md_alpha),
            unitCellAlphaError: this.toReal(record.md_alphaerror),
            unitCellBeta: this.toReal(record.md_beta),
            unitCellBetaError: this.toReal(record.md_betaerror),
            unitCellGamma: this.toReal(record.md_gamma),
            unitCellGammaError: this.toReal(record.md_gammaerror),
            unitCellVolume: this.toReal(record.md_va3),
            zValue: this.toReal(record.md_z),

            // Hardness
            hardnessMin: this.toReal(record.md_hmin),
            hardnessMax: this.toReal(record.md_hmax),
            hardType: this.toString(record.md_hardtype),
            vhnMin: this.toReal(record.md_vhnmin),
            vhnMax: this.toReal(record.md_vhnmax),
            vhns: this.toReal(record.md_vhns),
            vhng: this.toReal(record.md_vhng),
            vhnError: this.toReal(record.md_vhnerror),

            // Density
            densityMin: this.toReal(record.md_dmeas),
            densityMax: this.toReal(record.md_dmeas2),
            densityCalc: this.toReal(record.md_dcalc),
            densityCalcError: this.toReal(record.md_dcalcerror),
            densityMeas: this.toReal(record.md_dmeas),
            densityMeas2: this.toReal(record.md_dmeas2),
            densityMeasError: this.toReal(record.md_dmeaserror),

            // Physical properties
            colour: this.toString(record.md_colour),
            commentColor: this.toString(record.md_commentcolor),
            diaphaneity: this.toString(record.md_diapheny),
            lustre: this.toString(record.md_lustre),
            lustreType: this.toString(record.md_lustretype),
            commentLuster: this.toString(record.md_commentluster),
            streak: this.toString(record.md_streak),
            fracture: this.toString(record.md_cleavage),
            fractureType: this.toString(record.md_fracturetype),
            cleavage: this.toString(record.md_cleavage),
            cleavageType: this.toString(record.md_cleavagetype),
            tenacity: this.toString(record.md_tenacity),
            morphology: this.toString(record.md_morphology),
            parting: this.toString(record.md_parting),
            twinning: this.toString(record.md_twinning),
            commentCrystal: this.toString(record.md_commentcrystal),
            commentHard: this.toString(record.md_commenthard),
            commentDense: this.toString(record.md_commentdense),
            commentBreak: this.toString(record.md_commentbreak),

            // Optical properties
            optical2vCalc: this.toReal(record.md_optical2vcalc),
            optical2vCalc2: this.toReal(record.md_optical2vcalc2),
            optical2vCalcError: this.toReal(record.md_optical2vcalcerror),
            optical2vMeasured: this.toReal(record.md_optical2vmeasured),
            optical2vMeasured2: this.toReal(record.md_optical2vmeasured2),
            optical2vMeasuredError: this.toReal(record.md_optical2vmeasurederror),
            opticalSign: this.toString(record.md_opticalsign),
            opticalType: this.toString(record.md_opticaltype),
            opticalTropic: this.toString(record.md_opticaltropic),
            opticalAlpha: this.toReal(record.md_opticalalpha),
            opticalAlpha2: this.toReal(record.md_opticalalpha2),
            opticalAlphaError: this.toReal(record.md_opticalalphaerror),
            opticalBeta: this.toReal(record.md_opticalbeta),
            opticalBeta2: this.toReal(record.md_opticalbeta2),
            opticalBetaError: this.toReal(record.md_opticalbetaerror),
            opticalGamma: this.toReal(record.md_opticalgamma),
            opticalGamma2: this.toReal(record.md_opticalgamma2),
            opticalGammaError: this.toReal(record.md_opticalgammaerror),
            opticalOmega: this.toReal(record.md_opticalomega),
            opticalOmega2: this.toReal(record.md_opticalomega2),
            opticalOmegaError: this.toReal(record.md_opticalomegaerror),
            opticalEpsilon: this.toReal(record.md_opticalepsilon),
            opticalEpsilon2: this.toReal(record.md_opticalepsilon2),
            opticalEpsilonError: this.toReal(record.md_opticalepsilonerror),
            opticalN: this.toReal(record.md_opticaln),
            opticalN2: this.toReal(record.md_opticaln2),
            opticalNError: this.toReal(record.md_opticalnerror),
            opticalR: this.toString(record.md_opticalr),
            riMin: this.toReal(record.md_rimin),
            riMax: this.toReal(record.md_rimax),
            opticalBirefringence: this.toString(record.md_opticalbirefringence),
            opticalBireflectance: this.toString(record.md_opticalbireflectance),
            opticalDispersion: this.toString(record.md_opticaldispersion),
            opticalAnisotropism: this.toString(record.md_opticalanisotropism),
            opticalExtinction: this.toString(record.md_opticalextinction),
            opticalPleochroism: this.toString(record.md_opticalpleochroism),
            opticalPleochroismDesc: this.toString(record.md_opticalpleochorismdesc),
            opticalColour: this.toString(record.md_opticalcolour),
            opticalInternal: this.toString(record.md_opticalinternal),
            opticalComments: this.toString(record.md_opticalcomments),
            specDispm: this.toString(record.md_specdispm),

            // Classification
            strunz10ed1: this.toString(record.md_strunz10ed1),
            strunz10ed2: this.toString(record.md_strunz10ed2),
            strunz10ed3: this.toString(record.md_strunz10ed3),
            strunz10ed4: this.toString(record.md_strunz10ed4),
            dana8ed1: this.toString(record.md_dana8ed1),
            dana8ed2: this.toString(record.md_dana8ed2),
            dana8ed3: this.toString(record.md_dana8ed3),
            dana8ed4: this.toString(record.md_dana8ed4),
            cclass: this.toString(record.md_cclass),

            // Chemistry
            elements: this.toArray(record.md_elements),
            keyElements: this.toArray(record.md_key_elements),
            sigelements: this.toArray(record.md_sigelements),
            impurities: this.toString(record.md_impurities),

            // Groups and varieties
            groupId: this.toInt(record.md_groupid),
            varietyOf: this.toInt(record.md_varietyof),
            synId: this.toInt(record.md_synid),
            polytypeOf: this.toString(record.md_polytypeof),
            cim: this.toString(record.md_cim),
            tlform: this.toString(record.md_tlform),

            // Rocks
            rockBgsCode: this.toString(record.md_rock_bgs_code),
            rockParent: this.toString(record.md_rock_parent),
            rockParent2: this.toString(record.md_rock_parent2),
            rockRoot: this.toString(record.md_rock_root),

            // Meteorites
            meteoriticalCode: this.toString(record.md_meteoritical_code),

            // Localities (JSON)
            typeSpecimenStore: this.toString(record.md_type_specimen_store),
            noLocAdd: this.toString(record.md_nolocadd),

            // Other properties
            luminescence: this.toString(record.md_luminescence),
            magnetism: this.toString(record.md_magnetism),
            electrical: this.toString(record.md_electrical),
            thermalBehaviour: this.toString(record.md_thermalbehaviour),

            epitaxiDescription: this.toString(record.md_epitaxidescription),
            tranGlide: this.toString(record.md_tranglide),
            weighting: this.toString(record.md_weighting),

            uv: this.toString(record.md_uv),
            ir: this.toString(record.md_ir),
            other: this.toString(record.md_other),
            industrial: this.toString(record.md_industrial),

            // Metadata
            dataHash: crypto.createHash('sha256').update(JSON.stringify(record)).digest('hex'),
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
          if (progress.totalProcessed % 1000 === 0) {
            console.log(`Processed ${progress.totalProcessed}/${records.length} minerals (${Math.round(progress.totalProcessed/records.length*100)}%) - Created: ${progress.totalCreated}, Updated: ${progress.totalUpdated}, Failed: ${progress.totalFailed}`);
          }

        } catch (error: any) {
          progress.totalFailed++;
          const errorMsg = `Row ${progress.totalProcessed}: ${error.message}`;
          progress.errors.push(errorMsg);
          if (progress.errors.length <= 20) {
            console.error(errorMsg);
          }
        }
      }

      // Insert remaining batch
      if (batch.length > 0) {
        await this.insertBatch(batch, progress);
      }

      console.log(`\n✅ Import completed:`);
      console.log(`  📊 Total processed: ${progress.totalProcessed}`);
      console.log(`  ✨ Created: ${progress.totalCreated}`);
      console.log(`  🔄 Updated: ${progress.totalUpdated}`);
      console.log(`  ❌ Failed: ${progress.totalFailed}`);

      return progress;

    } catch (error: any) {
      console.error('❌ Fatal error during import:', error);
      throw error;
    }
  }

  private async insertBatch(batch: any[], progress: ImportProgress): Promise<void> {
    for (const item of batch) {
      try {
        const existing = await db.select()
          .from(mindatMinerals)
          .where(eq(mindatMinerals.mindatId, item.mindatId))
          .limit(1);

        if (existing.length > 0) {
          await db.update(mindatMinerals)
            .set({ ...item, updatedAt: new Date() })
            .where(eq(mindatMinerals.mindatId, item.mindatId));
          progress.totalUpdated++;
        } else {
          await db.insert(mindatMinerals).values(item);
          progress.totalCreated++;
        }
      } catch (error: any) {
        progress.totalFailed++;
        const errorMsg = `Failed mindat_id ${item.mindatId}: ${error.message}`;
        if (progress.errors.length < 20) {
          progress.errors.push(errorMsg);
        }
        // Always log to console for debugging
        console.error(`❌ ${errorMsg}`);
      }
    }
  }

  async clearMindatData(): Promise<void> {
    console.log('Clearing all Mindat CSV data...');
    await db.delete(mindatMinerals);
    console.log('Mindat data cleared.');
  }

  async getImportStats(): Promise<any> {
    const result = await db.select().from(mindatMinerals);
    return {
      totalMinerals: result.length,
    };
  }
}
