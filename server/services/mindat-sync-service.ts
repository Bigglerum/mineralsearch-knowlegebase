import { db } from '../db';
import { mindatMinerals, mineralNameIndex, syncJobs, dataSources } from '@shared/schema';
import { MindatAPIService } from './mindat-api-service';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

interface SyncProgress {
  totalProcessed: number;
  totalFailed: number;
  totalUpdated: number;
  totalCreated: number;
  errors: string[];
}

export class MindatSyncService {
  private static instance: MindatSyncService;
  private mindatAPI: MindatAPIService;
  private mindatDataSourceId: number | null = null;

  private constructor() {
    this.mindatAPI = MindatAPIService.getInstance();
  }

  static getInstance(): MindatSyncService {
    if (!MindatSyncService.instance) {
      MindatSyncService.instance = new MindatSyncService();
    }
    return MindatSyncService.instance;
  }

  private async ensureMindatDataSource(): Promise<number> {
    if (this.mindatDataSourceId !== null) {
      return this.mindatDataSourceId;
    }

    const existing = await db.select()
      .from(dataSources)
      .where(eq(dataSources.name, 'mindat'))
      .limit(1);

    if (existing.length > 0) {
      this.mindatDataSourceId = existing[0].id;
      return existing[0].id;
    }

    const [newSource] = await db.insert(dataSources).values({
      name: 'mindat',
      description: 'Mindat.org - The primary source of truth for mineral data',
      priority: 100,
      isActive: true,
      metadata: {
        url: 'https://mindat.org',
        apiVersion: 'v1',
      },
    }).returning();

    this.mindatDataSourceId = newSource.id;
    return newSource.id;
  }

  private calculateHash(data: any): string {
    const str = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  private calculateFieldHashes(data: any): Record<string, string> {
    const hashes: Record<string, string> = {};
    const criticalFields = [
      'name', 'ima_formula', 'mindat_formula', 'ima_status', 'crystal_system',
      'hardness_min', 'hardness_max', 'density_min', 'density_max',
      'colour', 'ima_year', 'elements'
    ];

    for (const field of criticalFields) {
      if (data[field] !== undefined && data[field] !== null) {
        hashes[field] = crypto.createHash('md5')
          .update(JSON.stringify(data[field]))
          .digest('hex');
      }
    }

    return hashes;
  }

  private toInt(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseInt(String(value));
    return isNaN(parsed) ? null : parsed;
  }

  private toReal(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? null : parsed;
  }

  private toArray(value: any): string[] | null {
    if (!value) return null;
    if (Array.isArray(value)) {
      return value.map(v => String(v));
    }
    if (typeof value === 'string') {
      return [value];
    }
    return null;
  }

  private toString(value: any): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return String(value);
  }

  private mapMindatToSchema(mindatData: any): any {
    return {
      mindatId: this.toInt(mindatData.id),
      name: mindatData.name,
      guid: this.toString(mindatData.guid),
      longId: this.toString(mindatData.longid),
      entryType: this.toInt(mindatData.entrytype),
      entryTypeText: this.toString(mindatData.entrytype_text),
      updtTime: mindatData.updttime ? new Date(mindatData.updttime) : null,

      imaFormula: this.toString(mindatData.ima_formula),
      mindatFormula: this.toString(mindatData.mindat_formula),
      mindatFormulaNote: this.toString(mindatData.mindat_formula_note),
      imaStatus: this.toString(mindatData.ima_status),
      imaSymbol: this.toString(mindatData.shortcode_ima),
      imaNotes: this.toString(mindatData.ima_notes),
      imaHistory: this.toString(mindatData.ima_history),
      imaYear: this.toInt(mindatData.approval_year) ?? this.toInt(mindatData.ima_year),
      approvalYear: this.toInt(mindatData.approval_year),
      publicationYear: this.toInt(mindatData.publication_year),
      discoveryYear: this.toInt(mindatData.discovery_year),
      shortcodeIma: this.toString(mindatData.shortcode_ima),

      aboutName: this.toString(mindatData.aboutname),
      descriptionShort: this.toString(mindatData.description_short),

      crystalSystem: this.toString(mindatData.csystem),
      csMetamict: this.toString(mindatData.csmetamict),
      spaceGroup: this.toString(mindatData.spacegroup),
      spaceGroupSet: this.toString(mindatData.spacegroupset),
      unitCellA: this.toReal(mindatData.a),
      unitCellAError: this.toReal(mindatData.aerror),
      unitCellB: this.toReal(mindatData.b),
      unitCellBError: this.toReal(mindatData.berror),
      unitCellC: this.toReal(mindatData.c),
      unitCellCError: this.toReal(mindatData.cerror),
      unitCellAlpha: this.toReal(mindatData.alpha),
      unitCellAlphaError: this.toReal(mindatData.alphaerror),
      unitCellBeta: this.toReal(mindatData.beta),
      unitCellBetaError: this.toReal(mindatData.betaerror),
      unitCellGamma: this.toReal(mindatData.gamma),
      unitCellGammaError: this.toReal(mindatData.gammaerror),
      unitCellVolume: this.toReal(mindatData.va3),
      zValue: this.toReal(mindatData.z),

      hardnessMin: this.toReal(mindatData.hmin),
      hardnessMax: this.toReal(mindatData.hmax),
      hardType: this.toString(mindatData.hardtype),
      vhnMin: this.toReal(mindatData.vhnmin),
      vhnMax: this.toReal(mindatData.vhnmax),
      vhns: this.toReal(mindatData.vhns),
      vhng: this.toReal(mindatData.vhng),
      vhnError: this.toReal(mindatData.vhnerror),

      densityMin: this.toReal(mindatData.dmeas),
      densityMax: this.toReal(mindatData.dmeas2),
      densityCalc: this.toReal(mindatData.dcalc),
      densityCalcError: this.toReal(mindatData.dcalcerror),
      densityMeas: this.toReal(mindatData.dmeas),
      densityMeas2: this.toReal(mindatData.dmeas2),
      densityMeasError: this.toReal(mindatData.dmeaserror),
      specificGravityMin: this.toReal(mindatData.dmeas),
      specificGravityMax: this.toReal(mindatData.dmeas2),

      colour: this.toString(mindatData.colour),
      color: this.toString(mindatData.colour),
      commentColor: this.toString(mindatData.commentcolor),
      diaphaneity: this.toString(mindatData.diapheny),
      lustre: this.toString(mindatData.lustre),
      lustreType: this.toString(mindatData.lustretype),
      commentLuster: this.toString(mindatData.commentluster),
      streak: this.toString(mindatData.streak),
      fracture: this.toString(mindatData.fracturetype),
      fractureType: this.toString(mindatData.fracturetype),
      cleavage: this.toString(mindatData.cleavage),
      cleavageType: this.toString(mindatData.cleavagetype),
      tenacity: this.toString(mindatData.tenacity),
      habit: this.toString(mindatData.morphology),
      morphology: this.toString(mindatData.morphology),
      parting: this.toString(mindatData.parting),
      twinning: this.toString(mindatData.twinning),
      commentCrystal: this.toString(mindatData.commentcrystal),
      commentHard: this.toString(mindatData.commenthard),
      commentDense: this.toString(mindatData.commentdense),
      commentBreak: this.toString(mindatData.commentbreak),

      optical2vCalc: this.toReal(mindatData.optical2vcalc),
      optical2vCalc2: this.toReal(mindatData.optical2vcalc2),
      optical2vCalcError: this.toReal(mindatData.optical2vcalcerror),
      optical2vMeasured: this.toReal(mindatData.optical2vmeasured),
      optical2vMeasured2: this.toReal(mindatData.optical2vmeasured2),
      optical2vMeasuredError: this.toReal(mindatData.optical2vmeasurederror),
      opticalSign: this.toString(mindatData.opticalsign),
      opticalType: this.toString(mindatData.opticaltype),
      opticalTropic: this.toString(mindatData.opticaltropic),
      opticalAlpha: this.toReal(mindatData.opticalalpha),
      opticalAlpha2: this.toReal(mindatData.opticalalpha2),
      opticalAlphaError: this.toReal(mindatData.opticalalphaerror),
      opticalBeta: this.toReal(mindatData.opticalbeta),
      opticalBeta2: this.toReal(mindatData.opticalbeta2),
      opticalBetaError: this.toReal(mindatData.opticalbetaerror),
      opticalGamma: this.toReal(mindatData.opticalgamma),
      opticalGamma2: this.toReal(mindatData.opticalgamma2),
      opticalGammaError: this.toReal(mindatData.opticalgammaerror),
      opticalOmega: this.toReal(mindatData.opticalomega),
      opticalOmega2: this.toReal(mindatData.opticalomega2),
      opticalOmegaError: this.toReal(mindatData.opticalomegaerror),
      opticalEpsilon: this.toReal(mindatData.opticalepsilon),
      opticalEpsilon2: this.toReal(mindatData.opticalepsilon2),
      opticalEpsilonError: this.toReal(mindatData.opticalepsilonerror),
      opticalN: this.toReal(mindatData.opticaln),
      opticalN2: this.toReal(mindatData.opticaln2),
      opticalNError: this.toReal(mindatData.opticalnerror),
      opticalR: this.toString(mindatData.opticalr),
      riMin: this.toReal(mindatData.rimin),
      riMax: this.toReal(mindatData.rimax),
      riAlpha: this.toReal(mindatData.opticalalpha),
      riBeta: this.toReal(mindatData.opticalbeta),
      riGamma: this.toReal(mindatData.opticalgamma),
      riOmega: this.toReal(mindatData.opticalomega),
      riEpsilon: this.toReal(mindatData.opticalepsilon),
      opticalBirefringence: this.toString(mindatData.opticalbirefringence),
      opticalBireflectance: this.toString(mindatData.opticalbireflectance),
      opticalDispersion: this.toString(mindatData.opticaldispersion),
      opticalAnisotropism: this.toString(mindatData.opticalanisotropism),
      opticalExtinction: this.toString(mindatData.opticalextinction),
      opticalPleochroism: this.toString(mindatData.opticalpleochroism),
      opticalPleochroismDesc: this.toString(mindatData.opticalpleochorismdesc),
      opticalColour: this.toString(mindatData.opticalcolour),
      opticalInternal: this.toString(mindatData.opticalinternal),
      opticalComments: this.toString(mindatData.opticalcomments),
      specDispm: this.toString(mindatData.specdispm),

      pleochroism: this.toString(mindatData.opticalpleochroism),

      strunz10ed1: this.toString(mindatData.strunz10ed1),
      strunz10ed2: this.toString(mindatData.strunz10ed2),
      strunz10ed3: this.toString(mindatData.strunz10ed3),
      strunz10ed4: this.toString(mindatData.strunz10ed4),
      strunzClass: this.toString(mindatData.strunz10ed4),
      dana8ed1: this.toString(mindatData.dana8ed1),
      dana8ed2: this.toString(mindatData.dana8ed2),
      dana8ed3: this.toString(mindatData.dana8ed3),
      dana8ed4: this.toString(mindatData.dana8ed4),
      danaClass: this.toString(mindatData.dana8ed4),
      heyClass: null,
      cclass: this.toString(mindatData.cclass),

      elements: this.toArray(mindatData.elements),
      keyElements: this.toArray(mindatData.key_elements),
      sigelements: this.toArray(mindatData.sigelements),
      elementsInc: null,
      elementsExc: null,
      impurities: this.toString(mindatData.impurities),

      groupId: this.toInt(mindatData.groupid),
      varietyOf: this.toInt(mindatData.varietyof),
      synId: this.toInt(mindatData.synid),
      polytypeOf: this.toString(mindatData.polytypeof),
      structuralGroupName: null,
      cim: this.toString(mindatData.cim),
      tlform: this.toString(mindatData.tlform),

      meteoriteCode: this.toString(mindatData.meteoritical_code),
      meteoriticalCode: this.toString(mindatData.meteoritical_code),
      meteoriteCodeExists: false,

      rockBgsCode: this.toString(mindatData.rock_bgs_code),
      rockParent: this.toString(mindatData.rock_parent),
      rockParent2: this.toString(mindatData.rock_parent2),
      rockRoot: this.toString(mindatData.rock_root),

      typeLocalitiesData: null,
      localityData: null,
      typeSpecimenStore: this.toString(mindatData.type_specimen_store),
      noLocAdd: this.toString(mindatData.nolocadd),

      description: this.toString(mindatData.description_short),
      occurrence: this.toString(mindatData.occurrence) ?? this.toString(mindatData.otheroccurrence),
      otherOccurrence: this.toString(mindatData.otheroccurrence),
      formationEnvironment: null,
      geologyNotes: null,

      imageUrl: null,
      imageCount: this.toInt(mindatData.image_count),
      alternateImages: null,

      luminescence: this.toString(mindatData.luminescence),
      fluorescence: null,
      magnetism: this.toString(mindatData.magnetism),
      radioactivity: null,
      arsenicContent: null,
      electrical: this.toString(mindatData.electrical),
      thermalBehaviour: this.toString(mindatData.thermalbehaviour),

      solubility: null,
      fusibility: null,

      epitaxiDescription: this.toString(mindatData.epitaxidescription),
      tranGlide: this.toString(mindatData.tranglide),
      weighting: this.toString(mindatData.weighting),

      uv: this.toString(mindatData.uv),
      ir: this.toString(mindatData.ir),
      other: this.toString(mindatData.other),
      industrial: this.toString(mindatData.industrial),

      localityCount: this.toInt(mindatData.locality_count),
      licenseInfo: null,

      nonUtf: false,

      fieldHashes: this.calculateFieldHashes(mindatData),
      dataHash: this.calculateHash(mindatData),
      lastSyncedAt: new Date(),
    };
  }

  private async upsertMineral(mineralData: any, progress: SyncProgress): Promise<void> {
    try {
      const mapped = this.mapMindatToSchema(mineralData);

      const existing = await db.select()
        .from(mindatMinerals)
        .where(eq(mindatMinerals.mindatId, mapped.mindatId))
        .limit(1);

      if (existing.length > 0) {
        if (existing[0].dataHash !== mapped.dataHash) {
          await db.update(mindatMinerals)
            .set(mapped)
            .where(eq(mindatMinerals.mindatId, mapped.mindatId));
          progress.totalUpdated++;
        }
      } else {
        await db.insert(mindatMinerals).values(mapped);
        progress.totalCreated++;

        const imaStatusArray = Array.isArray(mineralData.ima_status) 
          ? mineralData.ima_status 
          : (mineralData.ima_status ? [String(mineralData.ima_status)] : []);
        
        const isApproved = imaStatusArray.some((status: any) => 
          String(status).toUpperCase() === 'APPROVED'
        );
        
        if (isApproved) {
          const nameIndexExists = await db.select()
            .from(mineralNameIndex)
            .where(eq(mineralNameIndex.canonicalName, mineralData.name))
            .limit(1);

          if (nameIndexExists.length === 0) {
            await db.insert(mineralNameIndex).values({
              canonicalName: mineralData.name,
              imaApproved: true,
              mindatId: mineralData.id,
              aliases: [],
              varietyOf: mineralData.varietyof ? String(mineralData.varietyof) : null,
            });
          }
        }
      }

      progress.totalProcessed++;
    } catch (error) {
      progress.totalFailed++;
      progress.errors.push(`Failed to process mineral ${mineralData.name} (ID: ${mineralData.id}): ${error}`);
      console.error(`Error upserting mineral ${mineralData.id}:`, error);
    }
  }

  async syncMinerals(options: {
    startPage?: number;
    maxPages?: number;
    pageSize?: number;
    imaOnly?: boolean;
  } = {}): Promise<SyncProgress> {
    const {
      startPage = 1,
      maxPages = 10,
      pageSize = 100,
      imaOnly = false,
    } = options;

    await this.ensureMindatDataSource();

    const [job] = await db.insert(syncJobs).values({
      jobType: 'mindat_full_sync',
      status: 'running',
      startedAt: new Date(),
    }).returning();

    const progress: SyncProgress = {
      totalProcessed: 0,
      totalFailed: 0,
      totalUpdated: 0,
      totalCreated: 0,
      errors: [],
    };

    try {
      const allFields = '*';

      for (let page = startPage; page <= maxPages; page++) {
        console.log(`Fetching page ${page} of ${maxPages}...`);

        const searchParams: any = {
          page,
          page_size: pageSize,
          fields: allFields,
          ordering: 'id',
        };

        if (imaOnly) {
          searchParams.entrytype = 0;
        }

        const response = await this.mindatAPI.searchMinerals(searchParams);

        if (!response.results || response.results.length === 0) {
          console.log('No more results, stopping sync');
          break;
        }

        for (const mineralData of response.results) {
          await this.upsertMineral(mineralData, progress);
        }

        await db.update(syncJobs)
          .set({
            recordsProcessed: progress.totalProcessed,
            recordsFailed: progress.totalFailed,
          })
          .where(eq(syncJobs.id, job.id));

        if (!response.next) {
          console.log('Reached end of results');
          break;
        }
      }

      await db.update(syncJobs)
        .set({
          status: 'completed',
          recordsProcessed: progress.totalProcessed,
          recordsFailed: progress.totalFailed,
          completedAt: new Date(),
        })
        .where(eq(syncJobs.id, job.id));

      console.log(`Sync completed: ${progress.totalCreated} created, ${progress.totalUpdated} updated, ${progress.totalFailed} failed`);

    } catch (error) {
      await db.update(syncJobs)
        .set({
          status: 'failed',
          errorMessage: String(error),
          recordsProcessed: progress.totalProcessed,
          recordsFailed: progress.totalFailed,
          completedAt: new Date(),
        })
        .where(eq(syncJobs.id, job.id));

      throw error;
    }

    return progress;
  }

  async syncSingleMineral(mindatId: number): Promise<void> {
    const mineralData = await this.mindatAPI.getMineralById(mindatId);
    const progress: SyncProgress = {
      totalProcessed: 0,
      totalFailed: 0,
      totalUpdated: 0,
      totalCreated: 0,
      errors: [],
    };

    await this.upsertMineral(mineralData, progress);
  }

  async searchAndSync(searchQuery: string, options: { page?: number; pageSize?: number } = {}): Promise<{ results: any[]; count: number }> {
    const { page = 1, pageSize = 20 } = options;

    await this.ensureMindatDataSource();

    const searchResponse = await this.mindatAPI.searchMinerals({
      name: searchQuery,
      page,
      page_size: pageSize,
      fields: '*',
    });

    const results: any[] = [];
    const progress: SyncProgress = {
      totalProcessed: 0,
      totalFailed: 0,
      totalUpdated: 0,
      totalCreated: 0,
      errors: [],
    };

    if (searchResponse.results && searchResponse.results.length > 0) {
      for (const searchResult of searchResponse.results) {
        try {
          const mineralData = await this.mindatAPI.getMineralById(searchResult.id);
          
          await this.upsertMineral(mineralData, progress);
          
          const stored = await db.select()
            .from(mindatMinerals)
            .where(eq(mindatMinerals.mindatId, searchResult.id))
            .limit(1);
          
          if (stored.length > 0) {
            results.push(stored[0]);
          }
        } catch (error) {
          console.error(`Error syncing mineral ${searchResult.id}:`, error);
          progress.errors.push(`Failed to sync mineral ${searchResult.id}: ${error}`);
        }
      }
    }

    return {
      results,
      count: searchResponse.count || results.length,
    };
  }
}
