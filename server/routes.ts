import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { MindatAPIService } from "./services/mindat-api-service";
import { MindatSyncService } from "./services/mindat-sync-service";
import { RruffImportService } from "./services/rruff-import-service";
import { MindatCSVImportV2 } from "./services/mindat-csv-import-v2";
import { MindatIncrementalSync } from "./services/mindat-incremental-sync";
import { triggerDailySync, triggerWeeklyValidation } from "./cron/sync-scheduler";

const mindatAPI = MindatAPIService.getInstance();
const mindatSync = MindatSyncService.getInstance();
const rruffImport = RruffImportService.getInstance();
const mindatCSVImport = MindatCSVImportV2.getInstance();
const incrementalSync = MindatIncrementalSync.getInstance();

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Mineral Search Routes (Mindat API -> Database)
  app.get('/api/minerals/search', async (req: Request, res: Response) => {
    try {
      const { 
        q, 
        name, 
        page = '1',
        page_size = '20'
      } = req.query;

      const searchName = (name || q) as string;
      
      if (!searchName) {
        return res.json({ 
          results: [],
          count: 0,
        });
      }

      const results = await mindatSync.searchAndSync(searchName, {
        page: parseInt(page as string),
        pageSize: parseInt(page_size as string),
      });

      return res.json(results);
    } catch (error) {
      console.error('Error searching minerals:', error);
      return res.status(500).json({ error: 'Failed to search minerals' });
    }
  });

  // Groups/Series Search Routes (RRUFF Database)
  app.get('/api/groups-series/search', async (req: Request, res: Response) => {
    try {
      const { 
        q, 
        name, 
        page = '1',
        page_size = '20'
      } = req.query;

      const searchName = (name || q) as string;
      
      if (!searchName) {
        return res.json({ 
          results: [],
          count: 0,
        });
      }

      const results = await storage.searchRruffGroups(searchName, {
        page: parseInt(page as string),
        pageSize: parseInt(page_size as string),
      });

      return res.json(results);
    } catch (error) {
      console.error('Error searching groups/series:', error);
      return res.status(500).json({ error: 'Failed to search groups/series' });
    }
  });

  // Get single mineral by ID (Live Mindat API)
  app.get('/api/minerals/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const mineral = await mindatAPI.getMineralById(parseInt(id));

      if (!mineral) {
        return res.status(404).json({ error: 'Mineral not found' });
      }

      return res.json(mineral);
    } catch (error) {
      console.error('Error getting mineral:', error);
      return res.status(500).json({ error: 'Failed to get mineral' });
    }
  });

  // Sync minerals from Mindat API
  app.post('/api/minerals/sync', async (req: Request, res: Response) => {
    try {
      const { 
        query = 'a', 
        pageSize = 100,
        maxPages = 5
      } = req.body;

      const job = await storage.createSyncJob({
        jobType: 'mineral_sync',
        status: 'running',
      });

      await storage.updateSyncJob(job.id, {
        startedAt: new Date(),
      });

      let totalProcessed = 0;
      let totalFailed = 0;

      try {
        for (let page = 1; page <= maxPages; page++) {
          const response = await mindatAPI.searchMinerals({
            name: query,
            page,
            page_size: pageSize,
            fields: 'id,name,ima_formula,formula,crystal_system,hardness_min,hardness_max,specific_gravity_min,specific_gravity_max,colour,diaphaneity,lustre,streak,fracture,cleavage,tenacity,ima_symbol,ima_status'
          });

          const minerals = response.results || [];
          
          for (const mineralData of minerals) {
            try {
              const existing = await storage.getMineralByMindatId(mineralData.id);
              
              if (!existing) {
                await storage.createMineral({
                  mindatId: mineralData.id,
                  name: mineralData.name,
                  formula: mineralData.formula || null,
                  imaFormula: mineralData.ima_formula || null,
                  imaSymbol: mineralData.ima_symbol || null,
                  imaStatus: mineralData.ima_status || null,
                  crystalSystem: mineralData.crystal_system || null,
                  hardnessMin: mineralData.hardness_min || null,
                  hardnessMax: mineralData.hardness_max || null,
                  specificGravityMin: mineralData.specific_gravity_min || null,
                  specificGravityMax: mineralData.specific_gravity_max || null,
                  colour: mineralData.colour || null,
                  diaphaneity: mineralData.diaphaneity || null,
                  lustre: mineralData.lustre || null,
                  streak: mineralData.streak || null,
                  fracture: mineralData.fracture || null,
                  cleavage: mineralData.cleavage || null,
                  tenacity: mineralData.tenacity || null,
                  rawData: mineralData,
                });
                totalProcessed++;
              }
            } catch (error) {
              console.error(`Error syncing mineral ${mineralData.id}:`, error);
              totalFailed++;
            }
          }

          // If we got fewer results than requested, we're done
          if (minerals.length < pageSize) {
            break;
          }
        }

        await storage.updateSyncJob(job.id, {
          status: 'completed',
          recordsProcessed: totalProcessed,
          recordsFailed: totalFailed,
          completedAt: new Date(),
        });

        return res.json({
          success: true,
          jobId: job.id,
          processed: totalProcessed,
          failed: totalFailed,
        });

      } catch (error: any) {
        await storage.updateSyncJob(job.id, {
          status: 'failed',
          errorMessage: error.message,
          recordsProcessed: totalProcessed,
          recordsFailed: totalFailed,
          completedAt: new Date(),
        });
        throw error;
      }

    } catch (error) {
      console.error('Error syncing minerals:', error);
      return res.status(500).json({ error: 'Failed to sync minerals' });
    }
  });

  // Locality Search Routes (Live API)
  app.get('/api/localities/search', async (req: Request, res: Response) => {
    try {
      const { 
        name,
        page = '1',
        page_size = '20'
      } = req.query;

      if (!name) {
        return res.status(400).json({ error: 'Name parameter is required' });
      }

      const response = await mindatAPI.searchLocalities({
        name: name as string,
        page: parseInt(page as string),
        page_size: parseInt(page_size as string),
      });

      return res.json(response);
    } catch (error) {
      console.error('Error searching localities:', error);
      return res.status(500).json({ error: 'Failed to search localities' });
    }
  });

  // Get single locality by Mindat ID (Live API)
  app.get('/api/localities/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const locality = await mindatAPI.getLocalityById(parseInt(id));

      if (!locality) {
        return res.status(404).json({ error: 'Locality not found' });
      }

      return res.json(locality);
    } catch (error) {
      console.error('Error getting locality:', error);
      return res.status(500).json({ error: 'Failed to get locality' });
    }
  });

  // Strunz Classification Routes
  app.get('/api/strunz', async (req: Request, res: Response) => {
    try {
      const classifications = await storage.getStrunzClassifications();
      return res.json({ results: classifications });
    } catch (error) {
      console.error('Error getting Strunz classifications:', error);
      return res.status(500).json({ error: 'Failed to get classifications' });
    }
  });

  app.get('/api/strunz/:code', async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const classification = await storage.getStrunzClassificationByCode(code);

      if (!classification) {
        return res.status(404).json({ error: 'Classification not found' });
      }

      return res.json(classification);
    } catch (error) {
      console.error('Error getting Strunz classification:', error);
      return res.status(500).json({ error: 'Failed to get classification' });
    }
  });

  // Sync job status
  app.get('/api/sync/jobs', async (req: Request, res: Response) => {
    try {
      const { limit = '10' } = req.query;
      const jobs = await storage.getRecentSyncJobs(parseInt(limit as string));
      return res.json({ results: jobs });
    } catch (error) {
      console.error('Error getting sync jobs:', error);
      return res.status(500).json({ error: 'Failed to get sync jobs' });
    }
  });

  // Validate Mindat credentials
  app.get('/api/mindat/validate', async (req: Request, res: Response) => {
    try {
      const isValid = await mindatAPI.validateCredentials();
      return res.json({ valid: isValid });
    } catch (error) {
      console.error('Error validating credentials:', error);
      return res.json({ valid: false });
    }
  });

  // Production Mindat sync to mindat_minerals table
  app.post('/api/mindat/sync/production', async (req: Request, res: Response) => {
    try {
      const {
        startPage = 1,
        maxPages = 10,
        pageSize = 100,
        imaOnly = false,
      } = req.body;

      console.log(`Starting production Mindat sync: pages ${startPage}-${maxPages}, pageSize: ${pageSize}, IMA only: ${imaOnly}`);

      const progress = await mindatSync.syncMinerals({
        startPage,
        maxPages,
        pageSize,
        imaOnly,
      });

      return res.json({
        success: true,
        totalProcessed: progress.totalProcessed,
        totalCreated: progress.totalCreated,
        totalUpdated: progress.totalUpdated,
        totalFailed: progress.totalFailed,
        errors: progress.errors.slice(0, 10),
      });
    } catch (error: any) {
      console.error('Error in production sync:', error);
      return res.status(500).json({
        error: 'Production sync failed',
        message: error.message,
      });
    }
  });

  // Sync single mineral by Mindat ID
  app.post('/api/mindat/sync/mineral/:id', async (req: Request, res: Response) => {
    try {
      const mindatId = parseInt(req.params.id);
      await mindatSync.syncSingleMineral(mindatId);
      return res.json({ success: true, mineralId: mindatId });
    } catch (error: any) {
      console.error(`Error syncing mineral ${req.params.id}:`, error);
      return res.status(500).json({
        error: 'Failed to sync mineral',
        message: error.message,
      });
    }
  });

  // Import RRUFF minerals from CSV
  app.post('/api/rruff/import', async (req: Request, res: Response) => {
    try {
      const csvPath = 'attached_assets/RRUFF_Export_20250908_091618_1759745369897.csv';
      console.log('Starting RRUFF CSV import...');
      
      const progress = await rruffImport.importFromCSV(csvPath);
      
      return res.json({
        success: true,
        totalProcessed: progress.totalProcessed,
        totalCreated: progress.totalCreated,
        totalFailed: progress.totalFailed,
        errors: progress.errors.slice(0, 10),
      });
    } catch (error: any) {
      console.error('Error importing RRUFF data:', error);
      return res.status(500).json({
        error: 'RRUFF import failed',
        message: error.message,
      });
    }
  });

  // Clear RRUFF data
  app.post('/api/rruff/clear', async (req: Request, res: Response) => {
    try {
      await rruffImport.clearRruffData();
      return res.json({ success: true, message: 'RRUFF data cleared' });
    } catch (error: any) {
      console.error('Error clearing RRUFF data:', error);
      return res.status(500).json({
        error: 'Failed to clear RRUFF data',
        message: error.message,
      });
    }
  });

  // Get RRUFF import stats
  app.get('/api/rruff/stats', async (req: Request, res: Response) => {
    try {
      const stats = await rruffImport.getImportStats();
      return res.json(stats);
    } catch (error: any) {
      console.error('Error getting RRUFF stats:', error);
      return res.status(500).json({
        error: 'Failed to get stats',
        message: error.message,
      });
    }
  });

  // Import Mindat minerals from CSV dump
  app.post('/api/mindat-csv/import', async (req: Request, res: Response) => {
    try {
      const {
        filePath = 'attached_assets/mindatdump.csv',
        batchSize = 100,
        skipExisting = false
      } = req.body;

      console.log(`Starting Mindat CSV import from: ${filePath}`);
      console.log(`Batch size: ${batchSize}, Skip existing: ${skipExisting}`);

      const progress = await mindatCSVImport.importFromCSV(filePath, {
        batchSize,
        skipExisting,
      });

      return res.json({
        success: true,
        totalProcessed: progress.totalProcessed,
        totalCreated: progress.totalCreated,
        totalUpdated: progress.totalUpdated,
        totalFailed: progress.totalFailed,
        errors: progress.errors.slice(0, 20),
      });
    } catch (error: any) {
      console.error('Error importing Mindat CSV:', error);
      return res.status(500).json({
        error: 'Mindat CSV import failed',
        message: error.message,
      });
    }
  });

  // Clear Mindat CSV data
  app.post('/api/mindat-csv/clear', async (req: Request, res: Response) => {
    try {
      await mindatCSVImport.clearMindatData();
      return res.json({ success: true, message: 'Mindat CSV data cleared' });
    } catch (error: any) {
      console.error('Error clearing Mindat CSV data:', error);
      return res.status(500).json({
        error: 'Failed to clear Mindat CSV data',
        message: error.message,
      });
    }
  });

  // Get Mindat CSV import stats
  app.get('/api/mindat-csv/stats', async (req: Request, res: Response) => {
    try {
      const stats = await mindatCSVImport.getImportStats();
      return res.json(stats);
    } catch (error: any) {
      console.error('Error getting Mindat CSV stats:', error);
      return res.status(500).json({
        error: 'Failed to get stats',
        message: error.message,
      });
    }
  });

  // Incremental Sync Endpoints

  // Sync new minerals from Mindat API
  app.post('/api/mindat/sync/incremental', async (req: Request, res: Response) => {
    try {
      const {
        startId,
        endId,
        batchSize = 100,
      } = req.body;

      console.log(`Starting incremental sync: ${startId || 'auto'} to ${endId || 'auto'}`);

      const progress = await incrementalSync.syncNewMinerals({
        startId,
        endId,
        batchSize,
      });

      return res.json({
        success: true,
        totalChecked: progress.totalChecked,
        newMinerals: progress.newMinerals,
        updatedMinerals: progress.updatedMinerals,
        deletedMinerals: progress.deletedMinerals,
        errors: progress.errors.slice(0, 20),
      });
    } catch (error: any) {
      console.error('Error in incremental sync:', error);
      return res.status(500).json({
        error: 'Incremental sync failed',
        message: error.message,
      });
    }
  });

  // Validate existing minerals for changes
  app.post('/api/mindat/sync/validate', async (req: Request, res: Response) => {
    try {
      const {
        sampleSize = 1000,
        olderThan,
      } = req.body;

      console.log(`Validating ${sampleSize} existing minerals for changes...`);

      const progress = await incrementalSync.validateExistingMinerals({
        sampleSize,
        olderThan: olderThan ? new Date(olderThan) : undefined,
      });

      return res.json({
        success: true,
        totalChecked: progress.totalChecked,
        updatedMinerals: progress.updatedMinerals,
        deletedMinerals: progress.deletedMinerals,
        errors: progress.errors.slice(0, 20),
      });
    } catch (error: any) {
      console.error('Error validating minerals:', error);
      return res.status(500).json({
        error: 'Validation failed',
        message: error.message,
      });
    }
  });

  // Get sync statistics
  app.get('/api/mindat/sync/stats', async (req: Request, res: Response) => {
    try {
      const stats = await incrementalSync.getSyncStats();
      return res.json(stats);
    } catch (error: any) {
      console.error('Error getting sync stats:', error);
      return res.status(500).json({
        error: 'Failed to get stats',
        message: error.message,
      });
    }
  });

  // Manual trigger endpoints for testing scheduled jobs

  // Manually trigger daily sync
  app.post('/api/mindat/sync/trigger/daily', async (req: Request, res: Response) => {
    try {
      console.log('📣 Manual trigger: daily sync');

      // Return immediately and run in background
      res.json({
        success: true,
        message: 'Daily sync triggered. Check server logs for progress.',
      });

      // Run sync in background
      triggerDailySync().catch(err => {
        console.error('Background daily sync error:', err);
      });
    } catch (error: any) {
      console.error('Error triggering daily sync:', error);
      return res.status(500).json({
        error: 'Failed to trigger daily sync',
        message: error.message,
      });
    }
  });

  // Manually trigger weekly validation
  app.post('/api/mindat/sync/trigger/weekly', async (req: Request, res: Response) => {
    try {
      console.log('📣 Manual trigger: weekly validation');

      // Return immediately and run in background
      res.json({
        success: true,
        message: 'Weekly validation triggered. Check server logs for progress.',
      });

      // Run validation in background
      triggerWeeklyValidation().catch(err => {
        console.error('Background validation error:', err);
      });
    } catch (error: any) {
      console.error('Error triggering weekly validation:', error);
      return res.status(500).json({
        error: 'Failed to trigger weekly validation',
        message: error.message,
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
