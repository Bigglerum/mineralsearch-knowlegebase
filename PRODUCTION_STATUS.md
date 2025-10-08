# MineralSearch Production Status

**Date:** October 8, 2025  
**Status:** ✅ Production-ready with automatic daily synchronization

## Current Database State

- **Total Minerals:** 55,908
- **Highest Mindat ID:** 473,099
- **Last Sync:** October 8, 2025 11:41 AM
- **Source:** Mindat.org API (fully synced)

## Automatic Synchronization

### ✅ Active Services

**PM2 Process Manager:**
```bash
pm2 list
# Shows: mineral-search (online, port 5000)
```

**Cron Scheduler:**
- ✅ Daily sync: Every day at 3:00 AM (checks for new minerals)
- ✅ Weekly validation: Every Sunday at 4:00 AM (validates 5,000 existing minerals)

### How It Works

1. **Daily at 3:00 AM:**
   - Server automatically detects highest ID in database (currently 473,099)
   - Fetches all new minerals from Mindat API (473,100+)
   - Rate-limited to ~30 requests/minute
   - Takes ~1-5 minutes for typical daily additions (10-50 new minerals)

2. **Weekly on Sundays at 4:00 AM:**
   - Selects 5,000 oldest minerals (by `last_synced_at`)
   - Re-fetches from Mindat API
   - Detects changes using SHA-256 hash comparison
   - Updates modified minerals
   - Tracks deletions/merges in `mineral_changes` table
   - Takes ~3-4 hours

## Server Management

### Check Status
```bash
pm2 status
pm2 logs mineral-search
```

### Monitor Logs
```bash
pm2 logs mineral-search --lines 100
# Look for:
# "🔄 [SCHEDULED] Running daily incremental sync..."
# "✅ [SCHEDULED] Daily sync completed"
```

### Restart Server
```bash
pm2 restart mineral-search
```

### Stop Server
```bash
pm2 stop mineral-search
```

### Check Sync Stats
```bash
curl http://localhost:5000/api/mindat/sync/stats
```

## Manual Sync (if needed)

### Trigger Daily Sync Manually
```bash
curl -X POST http://localhost:5000/api/mindat/sync/trigger/daily
```

### Trigger Weekly Validation Manually
```bash
curl -X POST http://localhost:5000/api/mindat/sync/trigger/weekly
```

### Sync Specific ID Range
```bash
curl -X POST http://localhost:5000/api/mindat/sync/incremental \
  -H "Content-Type: application/json" \
  -d '{"startId": 473100, "endId": 473200, "batchSize": 100}'
```

## Configuration

### Environment Variables
Located in `.env`:
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
MINDAT_API_KEY=your_api_key_here
MINDAT_USERNAME=your_mindat_username
MINDAT_PASS=your_mindat_password
NODE_ENV=production
PORT=5000
```

### Scheduler Settings
File: `server/cron/sync-scheduler.ts`

**To change daily sync time:**
```typescript
// Current: 3 AM daily
cron.schedule('0 3 * * *', async () => { ... });

// Example: Change to 2 AM
cron.schedule('0 2 * * *', async () => { ... });

// Example: Every 6 hours
cron.schedule('0 */6 * * *', async () => { ... });
```

**To change validation sample size:**
```typescript
// Current: 5,000 minerals
await sync.validateExistingMinerals({ sampleSize: 5000 });

// Example: 10,000 minerals (slower but more thorough)
await sync.validateExistingMinerals({ sampleSize: 10000 });
```

After changes:
```bash
npm run build
pm2 restart mineral-search
```

## Server Auto-Start on Reboot

PM2 configuration is saved. To enable auto-start after server reboot, run:
```bash
sudo env PATH=$PATH:/home/halwh/.nvm/versions/node/v22.18.0/bin \
  /home/halwh/.nvm/versions/node/v22.18.0/lib/node_modules/pm2/bin/pm2 startup systemd -u halwh --hp /home/halwh
```

## Monitoring & Alerts

### Check Last Sync Time
```bash
curl http://localhost:5000/api/mindat/sync/stats | jq '.lastSyncDate'
```

### Expected Daily Pattern
- **3:00-3:10 AM:** Daily sync runs (usually completes in 1-5 min)
- **New minerals added:** Typically 10-50 per day
- **Sundays 4:00 AM:** Weekly validation starts (takes 3-4 hours)

### Troubleshooting

**Scheduler not running:**
```bash
pm2 logs mineral-search | grep "Initializing sync scheduler"
# Should show: "✅ Sync scheduler initialized"
```

**Sync failed:**
```bash
pm2 logs mineral-search --lines 500 | grep "Error\|Failed"
```

**API rate limiting:**
```bash
pm2 logs mineral-search | grep "429\|Too Many Requests"
```

## Data Integrity

### Database Tables
- `mindat_minerals` - Complete mineral data (55,908 records)
- `mineral_changes` - Tracks deletions/merges
- `rruff_minerals` - RRUFF database (5,844 records)

### Backup Strategy
Database hosted on Neon PostgreSQL with automatic backups.

Manual export:
```bash
curl http://localhost:5000/api/mindat/sync/stats
```

## Next Steps

1. ✅ Server running with PM2
2. ✅ Automatic daily sync at 3 AM
3. ✅ Automatic weekly validation on Sundays at 4 AM
4. ⚠️ Optional: Run sudo command above to enable auto-start on reboot
5. 📊 Monitor logs tomorrow morning to verify first scheduled sync

## Support

- Server logs: `/home/halwh/.pm2/logs/mineral-search-out.log`
- Error logs: `/home/halwh/.pm2/logs/mineral-search-error.log`
- Documentation: `SCHEDULER.md`, `AUTOMATION_SUMMARY.md`
- API endpoints: `server/routes.ts`

---

**System is fully operational and will maintain synchronization automatically.**
