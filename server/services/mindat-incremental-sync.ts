import { db } from '../db';
import { mindatMinerals, mineralChanges } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { MindatAPIService } from './mindat-api-service';
import crypto from 'crypto';

interface SyncProgress {
  totalChecked: number;
  newMinerals: number;
  updatedMinerals: number;
  deletedMinerals: number;
  mergedMinerals: number;
  errors: string[];
}

interface SyncOptions {
  startId?: number;
  endId?: number;
  batchSize?: number;
  checkExisting?: boolean; // Re-validate existing minerals for changes
}

export class MindatIncrementalSync {
  private static instance: MindatIncrementalSync;
  private mindatAPI: MindatAPIService;

  private constructor() {
    this.mindatAPI = MindatAPIService.getInstance();
  }

  static getInstance(): MindatIncrementalSync {
    if (!MindatIncrementalSync.instance) {
      MindatIncrementalSync.instance = new MindatIncrementalSync();
    }
    return MindatIncrementalSync.instance;
  }

  private generateHash(data: any): string {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Sync new minerals from Mindat API
   * Fetches minerals with IDs greater than current max
   */
  async syncNewMinerals(options: SyncOptions = {}): Promise<SyncProgress> {
    const { batchSize = 100, endId } = options;

    const progress: SyncProgress = {
      totalChecked: 0,
      newMinerals: 0,
      updatedMinerals: 0,
      deletedMinerals: 0,
      mergedMinerals: 0,
      errors: [],
    };

    try {
      // Get current max mindat_id
      const maxResult = await db.execute(
        sql`SELECT MAX(mindat_id) as max_id FROM mindat_minerals`
      );
      const startId = options.startId || (maxResult.rows[0]?.max_id as number || 0) + 1;
      const targetEndId = endId || startId + 10000; // Default: check next 10k

      console.log(`🔄 Starting incremental sync from mineral ${startId} to ${targetEndId}`);

      // Fetch minerals in batches
      for (let currentId = startId; currentId <= targetEndId; currentId += batchSize) {
        const endBatchId = Math.min(currentId + batchSize - 1, targetEndId);

        console.log(`📦 Processing batch: ${currentId}-${endBatchId}`);

        // Fetch batch from API
        for (let id = currentId; id <= endBatchId; id++) {
          try {
            progress.totalChecked++;

            const mineralData = await this.mindatAPI.getMineralById(id);

            if (!mineralData) {
              // Mineral doesn't exist (404)
              continue;
            }

            // Check if mineral exists in database
            const existing = await db.select()
              .from(mindatMinerals)
              .where(eq(mindatMinerals.mindatId, id))
              .limit(1);

            const dataHash = this.generateHash(mineralData);

            if (existing.length === 0) {
              // New mineral - insert
              await this.insertMineral(mineralData, dataHash);
              progress.newMinerals++;
            } else {
              // Check if data changed
              if (existing[0].dataHash !== dataHash) {
                await this.updateMineral(id, mineralData, dataHash);
                progress.updatedMinerals++;
              }
            }

            // Rate limiting - Mindat API typically allows ~30 requests/min
            await this.delay(2000); // 2 seconds between requests

            if (progress.totalChecked % 50 === 0) {
              console.log(`✅ Progress: ${progress.totalChecked} checked, ${progress.newMinerals} new, ${progress.updatedMinerals} updated`);
            }

          } catch (error: any) {
            if (error.message.includes('404')) {
              // Mineral was deleted or merged
              await this.trackDeletion(id);
              progress.deletedMinerals++;
            } else {
              progress.errors.push(`ID ${id}: ${error.message}`);
              if (progress.errors.length <= 10) {
                console.error(`❌ Error processing mineral ${id}:`, error.message);
              }
            }
          }
        }
      }

      console.log(`\n✅ Sync completed:`);
      console.log(`  📊 Total checked: ${progress.totalChecked}`);
      console.log(`  ✨ New minerals: ${progress.newMinerals}`);
      console.log(`  🔄 Updated: ${progress.updatedMinerals}`);
      console.log(`  🗑️  Deleted: ${progress.deletedMinerals}`);
      console.log(`  ❌ Errors: ${progress.errors.length}`);

      return progress;

    } catch (error: any) {
      console.error('❌ Fatal sync error:', error);
      throw error;
    }
  }

  /**
   * Re-validate existing minerals for changes
   * Useful for detecting edits in already-imported minerals
   */
  async validateExistingMinerals(options: {
    sampleSize?: number;
    olderThan?: Date;
  } = {}): Promise<SyncProgress> {
    const { sampleSize = 1000, olderThan } = options;

    const progress: SyncProgress = {
      totalChecked: 0,
      newMinerals: 0,
      updatedMinerals: 0,
      deletedMinerals: 0,
      mergedMinerals: 0,
      errors: [],
    };

    try {
      console.log(`🔍 Validating ${sampleSize} existing minerals for changes...`);

      // Get sample of minerals to check (oldest first if olderThan specified)
      let query = db.select({ mindatId: mindatMinerals.mindatId })
        .from(mindatMinerals)
        .orderBy(mindatMinerals.lastSyncedAt)
        .limit(sampleSize);

      if (olderThan) {
        query = query.where(sql`${mindatMinerals.lastSyncedAt} < ${olderThan}`) as any;
      }

      const minerals = await query;

      console.log(`Found ${minerals.length} minerals to validate`);

      for (const mineral of minerals) {
        try {
          progress.totalChecked++;

          const mineralData = await this.mindatAPI.getMineralById(mineral.mindatId);

          if (!mineralData) {
            // Mineral was deleted
            await this.trackDeletion(mineral.mindatId);
            progress.deletedMinerals++;
            continue;
          }

          // Check for changes
          const [existing] = await db.select()
            .from(mindatMinerals)
            .where(eq(mindatMinerals.mindatId, mineral.mindatId))
            .limit(1);

          const newHash = this.generateHash(mineralData);

          if (existing.dataHash !== newHash) {
            await this.updateMineral(mineral.mindatId, mineralData, newHash);
            progress.updatedMinerals++;
            console.log(`🔄 Updated mineral ${mineral.mindatId} - data changed`);
          }

          // Rate limiting
          await this.delay(2000);

          if (progress.totalChecked % 50 === 0) {
            console.log(`✅ Progress: ${progress.totalChecked}/${minerals.length} checked, ${progress.updatedMinerals} updated`);
          }

        } catch (error: any) {
          progress.errors.push(`ID ${mineral.mindatId}: ${error.message}`);
        }
      }

      console.log(`\n✅ Validation completed:`);
      console.log(`  📊 Total checked: ${progress.totalChecked}`);
      console.log(`  🔄 Updated: ${progress.updatedMinerals}`);
      console.log(`  🗑️  Deleted: ${progress.deletedMinerals}`);

      return progress;

    } catch (error: any) {
      console.error('❌ Validation error:', error);
      throw error;
    }
  }

  private async insertMineral(mineralData: any, dataHash: string): Promise<void> {
    await db.insert(mindatMinerals).values({
      mindatId: mineralData.id,
      name: mineralData.name,
      guid: mineralData.guid || null,
      longId: mineralData.longid || null,

      // IMA info
      imaFormula: mineralData.ima_formula || null,
      mindatFormula: mineralData.formula || null,
      imaStatus: mineralData.ima_status || null,
      imaSymbol: mineralData.ima_symbol || null,

      // Crystal system
      crystalSystem: mineralData.crystal_system || null,

      // Physical properties
      hardnessMin: mineralData.hardness_min || null,
      hardnessMax: mineralData.hardness_max || null,
      specificGravityMin: mineralData.specific_gravity_min || null,
      specificGravityMax: mineralData.specific_gravity_max || null,
      colour: mineralData.colour || null,
      diaphaneity: mineralData.diaphaneity || null,
      lustre: mineralData.lustre || null,
      streak: mineralData.streak || null,

      // Metadata
      dataHash,
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  private async updateMineral(mindatId: number, mineralData: any, dataHash: string): Promise<void> {
    await db.update(mindatMinerals)
      .set({
        name: mineralData.name,
        imaFormula: mineralData.ima_formula || null,
        mindatFormula: mineralData.formula || null,
        imaStatus: mineralData.ima_status || null,
        crystalSystem: mineralData.crystal_system || null,
        hardnessMin: mineralData.hardness_min || null,
        hardnessMax: mineralData.hardness_max || null,
        specificGravityMin: mineralData.specific_gravity_min || null,
        specificGravityMax: mineralData.specific_gravity_max || null,
        colour: mineralData.colour || null,
        dataHash,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mindatMinerals.mindatId, mindatId));
  }

  private async trackDeletion(mindatId: number): Promise<void> {
    // Check if already tracked
    const existing = await db.select()
      .from(mineralChanges)
      .where(eq(mineralChanges.mindatId, mindatId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(mineralChanges).values({
        mindatId,
        changeType: 'deleted',
        detectedAt: new Date(),
      });
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<any> {
    const maxResult = await db.execute(
      sql`SELECT MAX(mindat_id) as max_id FROM mindat_minerals`
    );

    const countResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM mindat_minerals`
    );

    const lastSyncResult = await db.execute(
      sql`SELECT MAX(last_synced_at) as last_sync FROM mindat_minerals`
    );

    return {
      totalMinerals: countResult.rows[0]?.count || 0,
      maxMindatId: maxResult.rows[0]?.max_id || 0,
      lastSyncDate: lastSyncResult.rows[0]?.last_sync || null,
      knownMaxId: 471698, // Current max on Mindat.org
      mineralsBehind: 471698 - (maxResult.rows[0]?.max_id || 0),
    };
  }
}
