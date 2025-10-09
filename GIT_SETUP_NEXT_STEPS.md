# Git Repository Setup - Next Steps

## Current Status ✅

- ✅ All changes committed locally
- ✅ Old Bigglerum remote removed
- ✅ .gitignore configured (excludes .env, node_modules, etc.)
- ✅ Ready to push to your own repository

## What You Need to Do Next

### 1. Create New GitHub Repository

Go to GitHub and create a new repository. Suggested names:
- `MineralSearch-Production`
- `erocks-mineral-database`
- `mindat-sync-system`

**Important:**
- Do NOT initialize with README, .gitignore, or license (we already have these)
- Choose Public or Private based on your preference

### 2. Add Your Remote and Push

Once you've created the repo, run these commands:

```bash
# Replace <YOUR-USERNAME> and <YOUR-REPO-NAME> with your values
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git

# Push your code
git push -u origin main

# Or if your branch is called master:
git push -u origin master
```

### 3. Verify the Push

Check on GitHub that all files are there, especially:
- ✅ Documentation files (README.md, SCHEDULER.md, etc.)
- ✅ New services (server/cron/, server/services/mindat-*.ts)
- ✅ .gitignore is working (no .env file should be visible!)

### 4. Optional: Enable Auto-Start on Server Reboot

If you want PM2 to auto-start on server reboot:

```bash
sudo env PATH=$PATH:/home/halwh/.nvm/versions/node/v22.18.0/bin \
  /home/halwh/.nvm/versions/node/v22.18.0/lib/node_modules/pm2/bin/pm2 startup systemd -u halwh --hp /home/halwh
```

## What's Protected

The `.gitignore` file ensures these sensitive files are **never** committed:

- `.env` - Contains your API keys and database credentials
- `node_modules/` - Dependencies
- `dist/` - Build artifacts
- `.pm2/` - PM2 logs and state
- `*.log` - All log files

## Current Commit

```
Production setup: Complete Mindat.org synchronization system

Major Features Added:
- Automatic daily sync at 3 AM
- Weekly validation on Sundays at 4 AM
- PM2 production deployment
- CSV import system (54,788+ minerals)
- Incremental sync with change detection
- Rate-limited API calls (~30/min)

Database: 55,908 minerals synced (max ID: 473,099)

Originally based on: https://github.com/Bigglerum/MineralSearch
```

## Quick Commands Reference

```bash
# Check what remotes are configured
git remote -v

# Add your new remote
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git

# Check current branch name
git branch

# Push to your repo (use 'main' or 'master' based on your branch)
git push -u origin main

# Check PM2 status
pm2 status

# View server logs
pm2 logs mineral-search

# Check sync stats
curl http://localhost:5000/api/mindat/sync/stats
```

## Future Commits

When you make changes:

```bash
# See what's changed
git status

# Stage changes
git add .

# Commit with message
git commit -m "Your commit message"

# Push to GitHub
git push
```

## Troubleshooting

**If push is rejected:**
- Make sure the GitHub repo is completely empty (no README or .gitignore)
- Or use: `git push -u origin main --force` (only for initial push!)

**If .env appears in git:**
- It shouldn't! The .gitignore prevents it
- If you see it: `git rm --cached .env` then commit and push

---

**All set!** Just create the GitHub repo and push your code.
