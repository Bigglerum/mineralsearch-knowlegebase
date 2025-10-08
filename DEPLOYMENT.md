# MineralSearch - Production Deployment Guide

## Deployment Options (Ranked by Ease)

### Option 1: Replit (Easiest - 2 minutes)
**Best for**: Quick demos, development, testing
**Cost**: Free tier available

1. Fork/Import the repo to Replit
2. Replit auto-detects `.replit` config
3. Add Secrets in Replit:
   - `DATABASE_URL`: Provision Neon database in Replit
   - `MINDAT_API_KEY`: Your Mindat API key
4. Click "Run"
5. Run database migrations: `npm run db:push`

**Pros**: Zero configuration, auto-scaling, free HTTPS
**Cons**: Sleeps on free tier, limited resources

---

### Option 2: Vercel + Neon (Recommended for Production - 5 minutes)
**Best for**: Production apps, scalability
**Cost**: Free for small apps, scales with usage

#### Setup Steps:

1. **Create Neon Database** (https://neon.tech)
   ```bash
   # Free tier: 3GB storage, 0.5GB RAM
   # Pro: $19/month - 10GB storage, 2GB RAM
   ```
   - Create project
   - Copy connection string

2. **Deploy to Vercel** (https://vercel.com)
   ```bash
   npm install -g vercel
   vercel login
   vercel
   ```

3. **Environment Variables** (Vercel Dashboard > Project > Settings > Environment Variables)
   ```
   DATABASE_URL=postgresql://...@ep-xxx.neon.tech/neondb
   MINDAT_API_KEY=your_key_here
   NODE_ENV=production
   ```

4. **Initialize Database**
   ```bash
   # Locally with Neon connection
   DATABASE_URL=your_neon_url npm run db:push
   ```

5. **Deploy**
   ```bash
   vercel --prod
   ```

**Pros**: Auto-scaling, CDN, serverless functions, free SSL
**Cons**: Serverless limitations (10s timeout on hobby tier)

---

### Option 3: Railway (Great Alternative - 5 minutes)
**Best for**: Full-stack apps, background jobs
**Cost**: $5/month minimum

1. **Sign up**: https://railway.app
2. **Create New Project** → Deploy from GitHub
3. **Add PostgreSQL Service** (built-in)
4. **Environment Variables** (auto-configured for Railway Postgres)
   ```
   MINDAT_API_KEY=your_key_here
   ```
5. **Deploy**: Automatic on git push

**Pros**: Includes Postgres, no serverless limits, simple pricing
**Cons**: Minimum $5/month

---

### Option 4: Docker + Any VPS (Most Control - 15 minutes)
**Best for**: Full control, custom infrastructure
**Cost**: $5-20/month (DigitalOcean, Linode, AWS, etc.)

#### 1. Server Setup (Ubuntu 22.04)

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin
```

#### 2. Clone and Configure

```bash
git clone https://github.com/Bigglerum/MineralSearch.git
cd MineralSearch
cp .env.example .env
```

Edit `.env`:
```bash
DATABASE_URL=postgresql://mineral_user:mineral_pass@postgres:5432/mineral_search
MINDAT_API_KEY=your_key_here
NODE_ENV=production
```

#### 3. Production Docker Setup

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    container_name: mineral-search-app
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://mineral_user:mineral_pass@postgres:5432/mineral_search
      MINDAT_API_KEY: ${MINDAT_API_KEY}
      NODE_ENV: production
      PORT: 5000
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    container_name: mineral-search-db
    environment:
      POSTGRES_USER: mineral_user
      POSTGRES_PASSWORD: mineral_pass
      POSTGRES_DB: mineral_search
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mineral_user"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: mineral-search-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
```

#### 4. Create Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared

EXPOSE 5000
CMD ["npm", "start"]
```

#### 5. Deploy

```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d

# Initialize database
docker-compose exec app npm run db:push

# View logs
docker-compose logs -f
```

**Pros**: Full control, no vendor lock-in, predictable costs
**Cons**: Requires server management, security updates

---

### Option 5: Render (Easy Alternative - 5 minutes)
**Best for**: Simple deployment, managed Postgres
**Cost**: Free tier + $7/month for Postgres

1. **Sign up**: https://render.com
2. **Create PostgreSQL** → Copy internal connection string
3. **Create Web Service** → Connect GitHub repo
4. **Environment Variables**:
   ```
   DATABASE_URL=<internal postgres connection>
   MINDAT_API_KEY=your_key_here
   NODE_ENV=production
   ```
5. **Build Command**: `npm install && npm run build`
6. **Start Command**: `npm start`

**Pros**: Simple, managed Postgres, free SSL
**Cons**: Slower cold starts on free tier

---

## Local Development

### With Docker (Recommended)

```bash
# Start PostgreSQL
docker-compose up -d

# Initialize database
npm run db:push

# Start dev server
npm run dev
```

### Without Docker (Requires local PostgreSQL)

```bash
# Install PostgreSQL 16
sudo apt install postgresql-16

# Create database
sudo -u postgres psql -c "CREATE DATABASE mineral_search;"
sudo -u postgres psql -c "CREATE USER mineral_user WITH PASSWORD 'mineral_pass';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mineral_search TO mineral_user;"

# Update .env
DATABASE_URL=postgresql://mineral_user:mineral_pass@localhost:5432/mineral_search

# Initialize database
npm run db:push

# Start dev server
npm run dev
```

---

## Database Migration Strategy

### Development → Production

1. **Schema Changes**: Always use Drizzle migrations
   ```bash
   npm run db:push  # Push schema to database
   ```

2. **Data Migration**: Use SQL scripts
   ```bash
   psql $DATABASE_URL < migrations/data_migration.sql
   ```

3. **Backup Strategy**:
   ```bash
   # Neon: Automatic daily backups (Pro plan)
   # Self-hosted: Use pg_dump
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
   ```

---

## Monitoring & Observability

### Recommended Tools

1. **Error Tracking**: Sentry (sentry.io)
2. **Uptime Monitoring**: UptimeRobot (free)
3. **Performance**: Vercel Analytics / New Relic
4. **Database**: Neon Dashboard / pgAdmin

### Basic Health Check Endpoint

Add to `server/routes.ts`:
```typescript
app.get('/health', async (req, res) => {
  try {
    await storage.db.execute('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});
```

---

## Cost Comparison (Monthly)

| Option | Compute | Database | Total |
|--------|---------|----------|-------|
| Replit | Free-$20 | $0 (Neon free) | $0-20 |
| Vercel + Neon | $0-$20 | $0-$19 | $0-39 |
| Railway | Included | Included | $5+ |
| VPS + Docker | $5-20 | Included | $5-20 |
| Render | $0-$7 | $7 | $7-14 |

**Recommendation**: Start with Vercel + Neon (free), upgrade when needed.

---

## SSL/HTTPS

- **Vercel/Railway/Render**: Automatic, free SSL
- **VPS**: Use Let's Encrypt (Certbot)
  ```bash
  sudo certbot --nginx -d yourdomain.com
  ```

---

## Scaling Considerations

### When to scale:

1. **>10K requests/day**: Move to paid tier
2. **>1GB database**: Upgrade Neon to Pro
3. **Background jobs**: Add Redis + Bull queue
4. **Search performance**: Add Elasticsearch
5. **Multiple regions**: Use CDN + regional databases

### Architecture Evolution:

```
Small (0-10K users):
  Vercel → Neon

Medium (10K-100K users):
  Vercel → Neon Pro → Redis → CDN

Large (100K+ users):
  Load Balancer → Multiple Nodes → Postgres Primary/Replica → Redis Cluster → Elasticsearch
```
