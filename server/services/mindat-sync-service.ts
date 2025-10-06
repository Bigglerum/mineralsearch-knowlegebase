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

  private mapMindatToSchema(mindatData: any): any {
    return {
      mindatId: mindatData.id,
      name: mindatData.name,
      guid: mindatData.guid ?? null,
      longId: mindatData.longid ?? null,
      entryType: mindatData.entrytype ?? null,
      entryTypeText: mindatData.entrytype_text ?? null,
      updtTime: mindatData.updttime ? new Date(mindatData.updttime) : null,

      imaFormula: mindatData.ima_formula ?? null,
      mindatFormula: mindatData.mindat_formula ?? null,
      mindatFormulaNote: mindatData.mindat_formula_note ?? null,
      imaStatus: mindatData.ima_status ?? null,
      imaSymbol: mindatData.shortcode_ima ?? null,
      imaNotes: mindatData.ima_notes ?? null,
      imaHistory: mindatData.ima_history ?? null,
      imaYear: mindatData.approval_year ?? mindatData.ima_year ?? null,
      approvalYear: mindatData.approval_year ?? null,
      publicationYear: mindatData.publication_year ?? null,
      discoveryYear: mindatData.discovery_year ?? null,
      shortcodeIma: mindatData.shortcode_ima ?? null,

      aboutName: mindatData.aboutname ?? null,
      descriptionShort: mindatData.description_short ?? null,

      crystalSystem: mindatData.csystem ?? null,
      csMetamict: mindatData.csmetamict ?? null,
      spaceGroup: mindatData.spacegroup ?? null,
      spaceGroupSet: mindatData.spacegroupset ?? null,
      unitCellA: mindatData.a ?? null,
      unitCellAError: mindatData.aerror ?? null,
      unitCellB: mindatData.b ?? null,
      unitCellBError: mindatData.berror ?? null,
      unitCellC: mindatData.c ?? null,
      unitCellCError: mindatData.cerror ?? null,
      unitCellAlpha: mindatData.alpha ?? null,
      unitCellAlphaError: mindatData.alphaerror ?? null,
      unitCellBeta: mindatData.beta ?? null,
      unitCellBetaError: mindatData.betaerror ?? null,
      unitCellGamma: mindatData.gamma ?? null,
      unitCellGammaError: mindatData.gammaerror ?? null,
      unitCellVolume: mindatData.va3 ?? null,
      zValue: mindatData.z ?? null,

      hardnessMin: mindatData.hmin ?? null,
      hardnessMax: mindatData.hmax ?? null,
      hardType: mindatData.hardtype ?? null,
      vhnMin: mindatData.vhnmin ?? null,
      vhnMax: mindatData.vhnmax ?? null,
      vhns: mindatData.vhns ?? null,
      vhng: mindatData.vhng ?? null,
      vhnError: mindatData.vhnerror ?? null,

      densityMin: mindatData.dmeas ?? null,
      densityMax: mindatData.dmeas2 ?? null,
      densityCalc: mindatData.dcalc ?? null,
      densityCalcError: mindatData.dcalcerror ?? null,
      densityMeas: mindatData.dmeas ?? null,
      densityMeas2: mindatData.dmeas2 ?? null,
      densityMeasError: mindatData.dmeaserror ?? null,
      specificGravityMin: mindatData.dmeas ?? null,
      specificGravityMax: mindatData.dmeas2 ?? null,

      colour: mindatData.colour ?? null,
      color: mindatData.colour ?? null,
      commentColor: mindatData.commentcolor ?? null,
      diaphaneity: mindatData.diapheny ?? null,
      lustre: mindatData.lustre ?? null,
      lustreType: mindatData.lustretype ?? null,
      commentLuster: mindatData.commentluster ?? null,
      streak: mindatData.streak ?? null,
      fracture: mindatData.fracturetype ?? null,
      fractureType: mindatData.fracturetype ?? null,
      cleavage: mindatData.cleavage ?? null,
      cleavageType: mindatData.cleavagetype ?? null,
      tenacity: mindatData.tenacity ?? null,
      habit: mindatData.morphology ?? null,
      morphology: mindatData.morphology ?? null,
      parting: mindatData.parting ?? null,
      twinning: mindatData.twinning ?? null,
      commentCrystal: mindatData.commentcrystal ?? null,
      commentHard: mindatData.commenthard ?? null,
      commentDense: mindatData.commentdense ?? null,
      commentBreak: mindatData.commentbreak ?? null,

      optical2vCalc: mindatData.optical2vcalc ?? null,
      optical2vCalc2: mindatData.optical2vcalc2 ?? null,
      optical2vCalcError: mindatData.optical2vcalcerror ?? null,
      optical2vMeasured: mindatData.optical2vmeasured ?? null,
      optical2vMeasured2: mindatData.optical2vmeasured2 ?? null,
      optical2vMeasuredError: mindatData.optical2vmeasurederror ?? null,
      opticalSign: mindatData.opticalsign ?? null,
      opticalType: mindatData.opticaltype ?? null,
      opticalTropic: mindatData.opticaltropic ?? null,
      opticalAlpha: mindatData.opticalalpha ?? null,
      opticalAlpha2: mindatData.opticalalpha2 ?? null,
      opticalAlphaError: mindatData.opticalalphaerror ?? null,
      opticalBeta: mindatData.opticalbeta ?? null,
      opticalBeta2: mindatData.opticalbeta2 ?? null,
      opticalBetaError: mindatData.opticalbetaerror ?? null,
      opticalGamma: mindatData.opticalgamma ?? null,
      opticalGamma2: mindatData.opticalgamma2 ?? null,
      opticalGammaError: mindatData.opticalgammaerror ?? null,
      opticalOmega: mindatData.opticalomega ?? null,
      opticalOmega2: mindatData.opticalomega2 ?? null,
      opticalOmegaError: mindatData.opticalomegaerror ?? null,
      opticalEpsilon: mindatData.opticalepsilon ?? null,
      opticalEpsilon2: mindatData.opticalepsilon2 ?? null,
      opticalEpsilonError: mindatData.opticalepsilonerror ?? null,
      opticalN: mindatData.opticaln ?? null,
      opticalN2: mindatData.opticaln2 ?? null,
      opticalNError: mindatData.opticalnerror ?? null,
      opticalR: mindatData.opticalr ?? null,
      riMin: mindatData.rimin ?? null,
      riMax: mindatData.rimax ?? null,
      riAlpha: mindatData.opticalalpha ?? null,
      riBeta: mindatData.opticalbeta ?? null,
      riGamma: mindatData.opticalgamma ?? null,
      riOmega: mindatData.opticalomega ?? null,
      riEpsilon: mindatData.opticalepsilon ?? null,
      opticalBirefringence: mindatData.opticalbirefringence ?? null,
      opticalBireflectance: mindatData.opticalbireflectance ?? null,
      opticalDispersion: mindatData.opticaldispersion ?? null,
      opticalAnisotropism: mindatData.opticalanisotropism ?? null,
      opticalExtinction: mindatData.opticalextinction ?? null,
      opticalPleochroism: mindatData.opticalpleochroism ?? null,
      opticalPleochroismDesc: mindatData.opticalpleochorismdesc ?? null,
      opticalColour: mindatData.opticalcolour ?? null,
      opticalInternal: mindatData.opticalinternal ?? null,
      opticalComments: mindatData.opticalcomments ?? null,
      specDispm: mindatData.specdispm ?? null,

      pleochroism: mindatData.opticalpleochroism ?? null,

      strunz10ed1: mindatData.strunz10ed1 ?? null,
      strunz10ed2: mindatData.strunz10ed2 ?? null,
      strunz10ed3: mindatData.strunz10ed3 ?? null,
      strunz10ed4: mindatData.strunz10ed4 ?? null,
      strunzClass: mindatData.strunz10ed4 ?? null,
      dana8ed1: mindatData.dana8ed1 ?? null,
      dana8ed2: mindatData.dana8ed2 ?? null,
      dana8ed3: mindatData.dana8ed3 ?? null,
      dana8ed4: mindatData.dana8ed4 ?? null,
      danaClass: mindatData.dana8ed4 ?? null,
      heyClass: null,
      cclass: mindatData.cclass ?? null,

      elements: mindatData.elements ?? null,
      keyElements: mindatData.key_elements ?? null,
      sigelements: mindatData.sigelements ?? null,
      elementsInc: null,
      elementsExc: null,
      impurities: mindatData.impurities ?? null,

      groupId: mindatData.groupid ?? null,
      varietyOf: mindatData.varietyof ?? null,
      synId: mindatData.synid ?? null,
      polytypeOf: mindatData.polytypeof ?? null,
      structuralGroupName: null,
      cim: mindatData.cim ?? null,
      tlform: mindatData.tlform ?? null,

      meteoriteCode: mindatData.meteoritical_code ?? null,
      meteoriticalCode: mindatData.meteoritical_code ?? null,
      meteoriteCodeExists: false,

      rockBgsCode: mindatData.rock_bgs_code ?? null,
      rockParent: mindatData.rock_parent ?? null,
      rockParent2: mindatData.rock_parent2 ?? null,
      rockRoot: mindatData.rock_root ?? null,

      typeLocalitiesData: null,
      localityData: null,
      typeSpecimenStore: mindatData.type_specimen_store ?? null,
      noLocAdd: mindatData.nolocadd ?? null,

      description: mindatData.description_short ?? null,
      occurrence: mindatData.occurrence ?? mindatData.otheroccurrence ?? null,
      otherOccurrence: mindatData.otheroccurrence ?? null,
      formationEnvironment: null,
      geologyNotes: null,

      imageUrl: null,
      imageCount: null,
      alternateImages: null,

      luminescence: mindatData.luminescence ?? null,
      fluorescence: null,
      magnetism: mindatData.magnetism ?? null,
      radioactivity: null,
      arsenicContent: null,
      electrical: mindatData.electrical ?? null,
      thermalBehaviour: mindatData.thermalbehaviour ?? null,

      solubility: null,
      fusibility: null,

      epitaxiDescription: mindatData.epitaxidescription ?? null,
      tranGlide: mindatData.tranglide ?? null,
      weighting: mindatData.weighting ?? null,

      uv: mindatData.uv ?? null,
      ir: mindatData.ir ?? null,
      other: mindatData.other ?? null,
      industrial: mindatData.industrial ?? null,

      localityCount: null,
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
