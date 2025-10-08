# Automatic Sync Scheduler

## Overview

The MineralSearch application now includes **automatic background synchronization** that runs daily to keep your database up-to-date with Mindat.org.

## Schedule

The scheduler runs **automatically** when the server starts:

| Task | Schedule | Description |
|------|----------|-------------|
| **Daily Sync** | Every day at 3:00 AM | Fetches new minerals from Mindat API (470961+) |
| **Weekly Validation** | Every Sunday at 4:00 AM | Re-checks 5,000 existing minerals for changes |

## How It Works

### 1. Daily Sync (3 AM)
- Automatically detects highest mineral ID in database
- Fetches all new minerals from Mindat API
- Rate-limited to ~30 minerals/minute (Mindat API compliance)
- Logs progress to server console
- **Estimated time**: 25-30 minutes for 738 missing minerals

### 2. Weekly Validation (Sunday 4 AM)
- Selects 5,000 oldest minerals (by `last_synced_at`)
- Re-fetches data from Mindat API
- Detects changes using SHA-256 hash comparison
- Updates minerals that have changed
- Tracks deletions/merges in `mineral_changes` table
- **Estimated time**: 3-4 hours

## Manual Triggers

You can manually trigger the scheduled jobs for testing:

### Trigger Daily Sync
```bash
curl -X POST http://localhost:5000/api/mindat/sync/trigger/daily
```

**Response:**
```json
{
  "success": true,
  "message": "Daily sync triggered. Check server logs for progress."
}
```

### Trigger Weekly Validation
```bash
curl -X POST http://localhost:5000/api/mindat/sync/trigger/weekly
```

**Response:**
```json
{
  "success": true,
  "message": "Weekly validation triggered. Check server logs for progress."
}
```

## Monitoring

### Check Sync Status
```bash
curl http://localhost:5000/api/mindat/sync/stats
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

### Watch Server Logs

```bash
# Follow server logs
tail -f /path/to/server.log

# Or if running in foreground
npm run dev
```

**Expected log output:**
```
🕐 Initializing sync scheduler...
✅ Sync scheduler initialized:
  - Daily sync: 3:00 AM (new minerals)
  - Weekly validation: Sunday 4:00 AM (existing minerals)

[3:00 AM]
🔄 [SCHEDULED] Running daily incremental sync...
📦 Processing batch: 470961-471060
✅ Progress: 50 checked, 50 new, 0 updated
...
✅ [SCHEDULED] Daily sync completed:
  - New minerals: 738
  - Updated: 2
  - Deleted: 0
  - Errors: 0
```

## Configuration

### Customize Schedule

Edit `/home/halwh/MineralSearch/server/cron/sync-scheduler.ts`:

```typescript
// Change daily sync time (currently 3 AM)
cron.schedule('0 3 * * *', async () => {
  // ...
});

// Change to 2 AM:
cron.schedule('0 2 * * *', async () => {

// Change to run every 6 hours:
cron.schedule('0 */6 * * *', async () => {
```

### Cron Schedule Format

```
*    *    *    *    *
┬    ┬    ┬    ┬    ┬
│    │    │    │    │
│    │    │    │    └─── Day of Week (0-7, 0 and 7 = Sunday)
│    │    │    └──────── Month (1-12)
│    │    └───────────── Day of Month (1-31)
│    └────────────────── Hour (0-23)
└─────────────────────── Minute (0-59)
```

**Examples:**
- `0 3 * * *` - Every day at 3:00 AM
- `0 */6 * * *` - Every 6 hours
- `0 4 * * 0` - Every Sunday at 4:00 AM
- `30 2 * * 1-5` - Monday-Friday at 2:30 AM
- `0 0 1 * *` - First day of every month at midnight

### Adjust Sample Size

Change how many minerals are validated weekly:

```typescript
// Current: 5,000 minerals
const progress = await sync.validateExistingMinerals({
  sampleSize: 5000,
});

// Validate 10,000 minerals (takes longer):
const progress = await sync.validateExistingMinerals({
  sampleSize: 10000,
});

// Validate only 1,000 minerals (faster):
const progress = await sync.validateExistingMinerals({
  sampleSize: 1000,
});
```

## Disable Scheduler

To disable automatic syncing, comment out the initialization in `server/index.ts`:

```typescript
server.listen({
  port,
  host: "0.0.0.0",
  reusePort: true,
}, () => {
  log(`serving on port ${port}`);

  // Initialize automatic sync scheduler
  // initializeSyncScheduler();  // <-- Comment this line
});
```

## Production Deployment

### Environment Variables

Ensure `.env` contains a valid Mindat API key:

```bash
MINDAT_API_KEY=your_actual_api_key_here
DATABASE_URL=your_database_url
```

### Process Managers

#### PM2 (Recommended for production)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "mineral-search" -- start

# View logs
pm2 logs mineral-search

# Monitor
pm2 monit

# Enable auto-restart on server reboot
pm2 startup
pm2 save
```

#### systemd (Linux)

Create `/etc/systemd/system/mineral-search.service`:

```ini
[Unit]
Description=MineralSearch API Server
After=network.target

[Service]
Type=simple
User=halwh
WorkingDirectory=/home/halwh/MineralSearch
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable mineral-search
sudo systemctl start mineral-search
sudo journalctl -u mineral-search -f  # Follow logs
```

## Troubleshooting

### Scheduler Not Running

**Check server logs for initialization:**
```
🕐 Initializing sync scheduler...
✅ Sync scheduler initialized:
```

If missing, ensure `initializeSyncScheduler()` is called in `server/index.ts`.

### Jobs Not Executing

**Verify cron expressions:**
```bash
# Test cron schedule online
https://crontab.guru/
```

**Check server timezone:**
```bash
date
TZ=America/New_York date  # Check specific timezone
```

The scheduler uses **server local time**. Adjust schedules accordingly.

### API Rate Limiting

**Error:** "429 Too Many Requests"

**Solution:** Increase delay in `mindat-incremental-sync.ts`:
```typescript
await this.delay(3000); // 3 seconds instead of 2
```

### Memory Issues

For servers with limited memory, reduce batch size:

```typescript
const progress = await sync.syncNewMinerals({
  batchSize: 50,  // Default is 100
});
```

### Sync Taking Too Long

**Reduce validation sample size:**
```typescript
const progress = await sync.validateExistingMinerals({
  sampleSize: 1000,  // Default is 5000
});
```

## Database Monitoring

### Check Sync Progress

```sql
-- Latest synced minerals
SELECT mindat_id, name, last_synced_at
FROM mindat_minerals
ORDER BY last_synced_at DESC
LIMIT 10;

-- Minerals never synced (from CSV import)
SELECT COUNT(*)
FROM mindat_minerals
WHERE last_synced_at IS NULL;

-- Recent changes detected
SELECT * FROM mineral_changes
ORDER BY detected_at DESC
LIMIT 20;
```

### Sync History

```sql
-- Minerals added in last 24 hours
SELECT COUNT(*)
FROM mindat_minerals
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Recent updates
SELECT COUNT(*)
FROM mindat_minerals
WHERE updated_at > NOW() - INTERVAL '24 hours'
  AND created_at < NOW() - INTERVAL '24 hours';
```

## Performance Tips

1. **Run during off-peak hours** (3-5 AM recommended)
2. **Monitor API quota** if you have Mindat premium access
3. **Increase rate limit** if allowed by your API tier
4. **Use smaller validation samples** on slower servers
5. **Consider running validation monthly** instead of weekly

## Support

For issues with the scheduler:
1. Check server logs
2. Verify Mindat API key validity
3. Test manual triggers
4. Review cron schedule syntax
5. Check database connectivity

---

**Status:** Automated sync active
**Next Daily Sync:** 3:00 AM (server time)
**Next Weekly Validation:** Sunday 4:00 AM (server time)
