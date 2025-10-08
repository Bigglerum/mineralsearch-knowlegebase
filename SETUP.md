# MineralSearch Setup Guide

## Quick Setup (5 minutes)

### 1. Database Setup (Neon PostgreSQL - Free Tier)

1. Visit https://neon.tech and sign up
2. Click "Create Project"
3. Choose a project name (e.g., "mineral-search")
4. Select a region close to you
5. Copy the connection string (looks like: `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb`)

### 2. Mindat API Key

1. Visit https://www.mindat.org/
2. Create an account or log in
3. Go to your profile settings
4. Navigate to API section
5. Generate or copy your API key

### 3. Environment Configuration

Update the `.env` file with your credentials:

```bash
DATABASE_URL=postgresql://your-connection-string-here
MINDAT_API_KEY=your-mindat-api-key-here
NODE_ENV=development
PORT=5000
```

### 4. Initialize Database Schema

```bash
npm run db:push
```

This will create all required tables in your Neon database.

### 5. Start the Application

```bash
npm run dev
```

The app will be available at http://localhost:5000

## Optional: Import Initial Data

### Import RRUFF Mineral Data (5,000+ minerals)

```bash
curl -X POST http://localhost:5000/api/rruff/import
```

### Sync Mindat Data (requires API key)

```bash
curl -X POST http://localhost:5000/api/mindat/sync/production \
  -H "Content-Type: application/json" \
  -d '{
    "startPage": 1,
    "maxPages": 10,
    "pageSize": 100,
    "imaOnly": false
  }'
```

## Production Deployment

### Environment Variables Required

- `DATABASE_URL` - Neon PostgreSQL connection string
- `MINDAT_API_KEY` - Mindat API key
- `NODE_ENV=production`
- `PORT` - Port number (default: 5000)

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (via Neon Serverless)
- **ORM**: Drizzle ORM
- **APIs**: Mindat API, RRUFF Database

## Free Tier Limits

**Neon PostgreSQL (Free)**
- 3 GB storage
- 0.5 GB RAM
- Auto-suspend after 5 minutes of inactivity
- Perfect for development and small production apps

**Mindat API**
- Rate limits apply
- Check https://www.mindat.org/api for current limits

## Scaling to Production

When ready to scale:

1. **Upgrade Neon Plan**: $19/month for Pro (more storage, no auto-suspend)
2. **Add Caching**: Redis/Upstash for API response caching
3. **Add CDN**: Cloudflare for static assets
4. **Monitoring**: Add error tracking (Sentry) and analytics
5. **Elasticsearch**: For advanced search (as per architecture docs)

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
node -e "const { Pool } = require('@neondatabase/serverless'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT NOW()').then(r => console.log('Connected:', r.rows[0])).catch(e => console.error('Error:', e));"
```

### API Issues

```bash
# Validate Mindat API key
curl http://localhost:5000/api/mindat/validate
```

### Clear Data

```bash
# Clear RRUFF data
curl -X POST http://localhost:5000/api/rruff/clear
```
