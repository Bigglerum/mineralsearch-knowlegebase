# Mindat Incremental Sync Guide

## Overview

The MineralSearch application includes a comprehensive incremental sync system to keep the database up-to-date with Mindat.org's mineral database.

**Current Status:**
- Database minerals: 54,788
- Highest mineral ID: 470,960
- Current Mindat.org max: 471,698
- **Gap: 738 minerals behind**

## Features

### 1. Incremental Sync
- Automatically fetches new minerals from Mindat API
- Starts from highest ID in database
- Rate-limited to comply with Mindat API limits (30 req/min)
- Batch processing for efficiency

### 2. Change Detection
- Uses SHA-256 hash comparison to detect data changes
- Updates existing minerals when Mindat data changes
- Tracks `lastSyncedAt` timestamp for each mineral

### 3. Deletion/Merge Tracking
- Detects when minerals are deleted or merged on Mindat
- Stores changes in `mineral_changes` table
- Tracks `changeType`: deleted, merged, or modified

### 4. Deduplication
- Checks for duplicate minerals by name and IMA formula
- Prioritizes IMA-approved minerals
- Uses `mineral_name_index` for canonical naming

## API Endpoints

### Sync New Minerals

```bash
POST /api/mindat/sync/incremental
Content-Type: application/json

{
  "startId": 470961,      # Optional: start from specific ID (defaults to max+1)
  "endId": 471698,        # Optional: end at specific ID (defaults to startId+10000)
  "batchSize": 100        # Optional: minerals per batch (default: 100)
}
```

**Response:**
```json
{
  "success": true,
  "totalChecked": 738,
  "newMinerals": 735,
  "updatedMinerals": 2,
  "deletedMinerals": 1,
  "errors": []
}
```

### Validate Existing Minerals

Re-checks existing minerals for changes:

```bash
POST /api/mindat/sync/validate
Content-Type: application/json

{
  "sampleSize": 1000,                    # How many to check
  "olderThan": "2025-01-01T00:00:00Z"   # Optional: only check older than date
}
```

### Get Sync Statistics

```bash
GET /api/mindat/sync/stats
```

**Response:**
```json
{
  "totalMinerals": 54788,
  "maxMindatId": 470960,
  "lastSyncDate": "2025-10-06T20:00:00Z",
  "knownMaxId": 471698,
  "mineralsBehind": 738
}
```

## Usage Examples

### Quick Scripts

**1. Sync all missing minerals (automatic):**
```bash
node sync-new-minerals.js
```

**2. Sync specific range:**
```bash
node sync-new-minerals.js 470961 471698
```

**3. Check current status:**
```bash
curl http://localhost:5000/api/mindat/sync/stats | jq
```

### Manual API Calls

**Sync next 100 minerals:**
```bash
curl -X POST http://localhost:5000/api/mindat/sync/incremental \
  -H "Content-Type: application/json" \
  -d '{
    "batchSize": 100
  }'
```

**Sync to catch up to current Mindat max:**
```bash
curl -X POST http://localhost:5000/api/mindat/sync/incremental \
  -H "Content-Type: application/json" \
  -d '{
    "startId": 470961,
    "endId": 471698,
    "batchSize": 100
  }'
```

**Validate 500 oldest minerals:**
```bash
curl -X POST http://localhost:5000/api/mindat/sync/validate \
  -H "Content-Type: application/json" \
  -d '{
    "sampleSize": 500
  }'
```

## Rate Limiting

The Mindat API typically allows **~30 requests per minute**. The sync service:
- Adds 2-second delay between requests (30 req/min = 2s each)
- Processes ~30 minerals per minute
- **Est. time for 738 minerals: ~25 minutes**

## Automated Sync (Cron)

### Option 1: Node-Cron (Recommended)

Install:
```bash
npm install node-cron
```

Create `/home/halwh/MineralSearch/server/cron/sync-scheduler.ts`:
```typescript
import cron from 'node-cron';
import { MindatIncrementalSync } from '../services/mindat-incremental-sync';

const sync = MindatIncrementalSync.getInstance();

// Run daily at 3 AM
cron.schedule('0 3 * * *', async () => {
  console.log('🔄 Running daily Mindat sync...');
  try {
    await sync.syncNewMinerals();
    console.log('✅ Daily sync completed');
  } catch (error) {
    console.error('❌ Daily sync failed:', error);
  }
});

// Run weekly validation on Sundays at 4 AM
cron.schedule('0 4 * * 0', async () => {
  console.log('🔍 Running weekly validation...');
  try {
    await sync.validateExistingMinerals({ sampleSize: 5000 });
    console.log('✅ Weekly validation completed');
  } catch (error) {
    console.error('❌ Validation failed:', error);
  }
});
```

### Option 2: System Cron

Create `/home/halwh/sync-mindat.sh`:
```bash
#!/bin/bash
cd /home/halwh/MineralSearch
node sync-new-minerals.js
```

Add to crontab:
```bash
# Sync daily at 3 AM
0 3 * * * /home/halwh/sync-mindat.sh >> /var/log/mindat-sync.log 2>&1
```

## Database Tables

### `mindat_minerals`
- Main table with 146 fields
- 54,788 minerals currently
- Indexed on `mindat_id`, `name`, `ima_status`

### `mineral_changes`
- Tracks deletions and merges
- Fields:
  - `mindat_id`: Affected mineral ID
  - `change_type`: deleted | merged | modified
  - `merged_into_id`: Target mineral if merged
  - `detected_at`: When change was detected

## Troubleshooting

### API Rate Limit Errors

**Error:** "429 Too Many Requests"
**Fix:** Increase delay in `mindat-incremental-sync.ts`:
```typescript
await this.delay(3000); // 3 seconds instead of 2
```

### Missing API Key

**Error:** "401 Unauthorized"
**Fix:** Ensure `.env` contains valid Mindat API key:
```bash
MINDAT_API_KEY=your_actual_key_here
```

### Database Connection Timeout

**Error:** "Connection pool timeout"
**Fix:** Reduce batch size:
```json
{
  "batchSize": 50
}
```

## Monitoring

### Check Progress

```bash
# Watch server logs
tail -f /path/to/server.log

# Check stats every 30 seconds
watch -n 30 'curl -s http://localhost:5000/api/mindat/sync/stats | jq'
```

### Monitor Changes Table

```sql
-- Count changes by type
SELECT change_type, COUNT(*)
FROM mineral_changes
GROUP BY change_type;

-- Recent deletions
SELECT * FROM mineral_changes
WHERE change_type = 'deleted'
ORDER BY detected_at DESC
LIMIT 10;
```

## Performance

### Estimated Sync Times

| Minerals | Est. Time | Rate Limit |
|----------|-----------|------------|
| 100      | 3-4 min   | 30/min     |
| 738      | ~25 min   | 30/min     |
| 5,000    | 2.8 hours | 30/min     |

### Optimization Tips

1. **Run during off-peak hours** (3-5 AM recommended)
2. **Use larger batches** for initial catches up (100-500)
3. **Monitor API quota** if you have premium Mindat access
4. **Split large syncs** into chunks to avoid timeouts

## Future Enhancements

- [ ] Add Mindat webhook support for real-time updates
- [ ] Implement retry logic for failed minerals
- [ ] Add email notifications for large changes
- [ ] Create dashboard for sync monitoring
- [ ] Support for parallel API requests (with higher rate limits)
- [ ] Automatic merge resolution using IMA status

## Resources

- **Mindat API Docs**: https://www.mindat.org/api
- **Current Max Mineral**: https://www.mindat.org/min-471698.html
- **IMA Status Definitions**: https://www.ima-mineralogy.org/

---

**Last Updated:** 2025-10-06
**Database Status:** 54,788 minerals, 738 behind current
