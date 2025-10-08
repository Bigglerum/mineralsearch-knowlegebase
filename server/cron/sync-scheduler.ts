import cron from 'node-cron';
import { MindatIncrementalSync } from '../services/mindat-incremental-sync';

const sync = MindatIncrementalSync.getInstance();

export function initializeSyncScheduler() {
  console.log('🕐 Initializing sync scheduler...');

  // Daily incremental sync at 3 AM
  // Fetches new minerals from Mindat
  cron.schedule('0 3 * * *', async () => {
    console.log('\n🔄 [SCHEDULED] Running daily incremental sync...');
    try {
      const progress = await sync.syncNewMinerals({
        batchSize: 100,
      });

      console.log('✅ [SCHEDULED] Daily sync completed:');
      console.log(`  - New minerals: ${progress.newMinerals}`);
      console.log(`  - Updated: ${progress.updatedMinerals}`);
      console.log(`  - Deleted: ${progress.deletedMinerals}`);
      console.log(`  - Errors: ${progress.errors.length}`);
    } catch (error: any) {
      console.error('❌ [SCHEDULED] Daily sync failed:', error.message);
    }
  });

  // Weekly validation on Sundays at 4 AM
  // Re-checks 5000 existing minerals for changes
  cron.schedule('0 4 * * 0', async () => {
    console.log('\n🔍 [SCHEDULED] Running weekly validation...');
    try {
      const progress = await sync.validateExistingMinerals({
        sampleSize: 5000,
      });

      console.log('✅ [SCHEDULED] Weekly validation completed:');
      console.log(`  - Checked: ${progress.totalChecked}`);
      console.log(`  - Updated: ${progress.updatedMinerals}`);
      console.log(`  - Deleted: ${progress.deletedMinerals}`);
    } catch (error: any) {
      console.error('❌ [SCHEDULED] Weekly validation failed:', error.message);
    }
  });

  console.log('✅ Sync scheduler initialized:');
  console.log('  - Daily sync: 3:00 AM (new minerals)');
  console.log('  - Weekly validation: Sunday 4:00 AM (existing minerals)');
}

// Manual trigger functions for testing
export async function triggerDailySync() {
  console.log('🔄 Manually triggering daily sync...');
  try {
    const progress = await sync.syncNewMinerals({ batchSize: 100 });
    console.log('✅ Manual sync completed:', progress);
    return progress;
  } catch (error: any) {
    console.error('❌ Manual sync failed:', error.message);
    throw error;
  }
}

export async function triggerWeeklyValidation() {
  console.log('🔍 Manually triggering weekly validation...');
  try {
    const progress = await sync.validateExistingMinerals({ sampleSize: 5000 });
    console.log('✅ Manual validation completed:', progress);
    return progress;
  } catch (error: any) {
    console.error('❌ Manual validation failed:', error.message);
    throw error;
  }
}
