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
      updtTime: mindatData.updttime ? new Date(mindatData.updttime) : null,

      imaFormula: mindatData.ima_formula ?? null,
      mindatFormula: mindatData.mindat_formula ?? null,
      imaStatus: mindatData.ima_status ?? null,
      imaSymbol: mindatData.ima_symbol ?? null,
      imaNotes: mindatData.ima_notes ?? null,
      imaYear: mindatData.ima_year ?? null,

      crystalSystem: mindatData.crystal_system ?? null,
      spaceGroup: mindatData.space_group ?? null,
      unitCellA: mindatData.unit_cell_a ?? null,
      unitCellB: mindatData.unit_cell_b ?? null,
      unitCellC: mindatData.unit_cell_c ?? null,
      unitCellAlpha: mindatData.unit_cell_alpha ?? null,
      unitCellBeta: mindatData.unit_cell_beta ?? null,
      unitCellGamma: mindatData.unit_cell_gamma ?? null,

      hardnessMin: mindatData.hardness_min ?? null,
      hardnessMax: mindatData.hardness_max ?? null,
      densityMin: mindatData.density_min ?? null,
      densityMax: mindatData.density_max ?? null,
      specificGravityMin: mindatData.specific_gravity_min ?? null,
      specificGravityMax: mindatData.specific_gravity_max ?? null,

      colour: mindatData.colour ?? null,
      color: mindatData.color ?? null,
      diaphaneity: mindatData.diaphaneity ?? null,
      lustre: mindatData.lustre ?? null,
      lustreType: mindatData.lustretype ?? null,
      streak: mindatData.streak ?? null,
      fracture: mindatData.fracture ?? null,
      fractureType: mindatData.fracturetype ?? null,
      cleavage: mindatData.cleavage ?? null,
      cleavageType: mindatData.cleavagetype ?? null,
      tenacity: mindatData.tenacity ?? null,
      habit: mindatData.habit ?? null,

      optical2vMin: mindatData.optical2v_min ?? null,
      optical2vMax: mindatData.optical2v_max ?? null,
      opticalSign: mindatData.opticalsign ?? null,
      opticalType: mindatData.opticaltype ?? null,
      biMin: mindatData.bi_min ?? null,
      biMax: mindatData.bi_max ?? null,
      riMin: mindatData.ri_min ?? null,
      riMax: mindatData.ri_max ?? null,
      riAlpha: mindatData.ri_alpha ?? null,
      riBeta: mindatData.ri_beta ?? null,
      riGamma: mindatData.ri_gamma ?? null,
      riOmega: mindatData.ri_omega ?? null,
      riEpsilon: mindatData.ri_epsilon ?? null,
      pleochroism: mindatData.pleochroism ?? null,

      strunzClass: mindatData.strunz_class ?? null,
      danaClass: mindatData.dana_class ?? null,
      heyClass: mindatData.hey_class ?? null,

      elements: mindatData.elements ?? null,
      elementsInc: mindatData.elements_inc ?? null,
      elementsExc: mindatData.elements_exc ?? null,

      groupId: mindatData.groupid ?? null,
      varietyOf: mindatData.varietyof ?? null,
      meteoriteCode: mindatData.meteoritical_code ?? null,
      meteoriteCodeExists: mindatData.meteoritical_code_exists ?? null,

      typeLocalitiesData: mindatData.type_localities ?? null,
      localityData: mindatData.locality ?? null,

      description: mindatData.description ?? null,
      occurrence: mindatData.occurrence ?? null,
      formationEnvironment: mindatData.formation_environment ?? null,
      geologyNotes: mindatData.geology_notes ?? null,

      imageUrl: mindatData.image_url ?? null,
      imageCount: mindatData.image_count ?? null,
      alternateImages: mindatData.alternate_images ?? null,

      luminescence: mindatData.luminescence ?? null,
      fluorescence: mindatData.fluorescence ?? null,
      magnetism: mindatData.magnetism ?? null,
      radioactivity: mindatData.radioactivity ?? null,
      arsenicContent: mindatData.arsenic_content ?? null,

      solubility: mindatData.solubility ?? null,
      fusibility: mindatData.fusibility ?? null,

      polytypeOf: mindatData.polytype_of ?? null,
      structuralGroupName: mindatData.structural_group_name ?? null,

      localityCount: mindatData.locality_count ?? null,
      licenseInfo: mindatData.license ?? null,

      nonUtf: mindatData.non_utf ?? false,

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
}
