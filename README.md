# MineralSearch - e-Rocks Mineral Explorer

A production-ready web application for searching and exploring comprehensive mineral data, integrating Mindat API and RRUFF database.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database (Neon recommended for cloud)
- Mindat API key (get from https://www.mindat.org/)

### ⚡ Automatic Sync Enabled
The application now includes **automatic daily synchronization** with Mindat.org:
- **Daily at 3 AM**: Fetches new minerals
- **Sundays at 4 AM**: Validates existing minerals
- See [SCHEDULER.md](SCHEDULER.md) for details

### Installation

```bash
# Clone repository
git clone https://github.com/Bigglerum/MineralSearch.git
cd MineralSearch

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and MINDAT_API_KEY

# Initialize database
npm run db:push

# Start development server
npm run dev
```

Application will be available at http://localhost:5000

## 📊 Current Status

### ✅ Working
- ✅ Server running on port 5000
- ✅ Neon PostgreSQL database connected
- ✅ Database schema initialized (13 tables)
- ✅ RRUFF mineral data imported (5,844+ minerals)
- ✅ Groups/Series search working
- ✅ Frontend serving correctly
- ✅ API endpoints operational

### ⏳ Pending
- ⚠️ Mindat API key required for live mineral search
- 📋 Optional: Import additional data sources

## 🔧 Configuration

### Environment Variables

```bash
# Database (Required)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Mindat API (Required for live mineral data)
MINDAT_API_KEY=your_key_here

# Application
NODE_ENV=development|production
PORT=5000
```

### Database Setup Options

#### Option 1: Neon Cloud (Recommended)
Free tier with 3GB storage, perfect for development and production.

1. Sign up at https://neon.tech
2. Create new project
3. Copy connection string to .env

#### Option 2: Local Docker
```bash
docker-compose up -d
# Uses: postgresql://mineral_user:mineral_pass@localhost:5432/mineral_search
```

#### Option 3: Local PostgreSQL
```bash
sudo apt install postgresql-16
sudo -u postgres createdb mineral_search
# Update .env with local connection string
```

## 📚 API Endpoints

### Mineral Search (RRUFF Database)
```bash
GET /api/groups-series/search?q=feldspar&page=1&page_size=20
```

### Mindat Mineral Search (Requires API Key)
```bash
GET /api/minerals/search?q=quartz&page=1&page_size=20
```

### Data Import
```bash
# Import RRUFF minerals (5,844 minerals)
POST /api/rruff/import

# Sync Mindat minerals (requires API key)
POST /api/mindat/sync/production
Content-Type: application/json
{
  "startPage": 1,
  "maxPages": 10,
  "pageSize": 100,
  "imaOnly": false
}
```

### Stats & Status
```bash
GET /api/rruff/stats
GET /api/sync/jobs
GET /api/mindat/validate
```

## 🗃️ Database Schema

**Production Tables:**
- `mindat_minerals` - Complete Mindat data (146 fields)
- `mineral_name_index` - Canonical names with IMA approval
- `rruff_minerals` - RRUFF database (5,844+ minerals)
- `ionic_chemistry` - Ionic chemistry breakdowns
- `data_sources` - Source registry with priorities
- `data_conflicts` - Conflict tracking
- `minerals` - Legacy/search table
- `localities` - Geographic data
- `strunz_classifications` - Mineral classifications
- `users` - Authentication
- `sync_jobs` - Background job tracking
- `favorites` - User favorites

## 🚢 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment options:

- **Replit**: Easiest (2 minutes)
- **Vercel + Neon**: Recommended for production (5 minutes)
- **Railway**: Full-stack with Postgres ($5/month)
- **Docker + VPS**: Full control (15 minutes)

### Quick Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel
# Add environment variables in Vercel dashboard
```

## 🏗️ Architecture

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + Shadcn/ui components
- TanStack Query (data fetching)
- Wouter (routing)

### Backend
- Express.js + TypeScript
- Drizzle ORM
- Neon Serverless PostgreSQL
- RESTful API design

### Data Sources
- **Mindat API**: 150,000+ minerals
- **RRUFF Database**: 5,844 minerals (imported)
- **Ionic Chemistry**: Custom datasets

## 📖 Documentation

- [SETUP.md](SETUP.md) - Detailed setup instructions
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment guide
- [design_guidelines.md](design_guidelines.md) - UI/UX design system
- [replit.md](replit.md) - Project architecture overview

## 🧪 Testing

```bash
# Test RRUFF search
curl 'http://localhost:5000/api/groups-series/search?q=quartz'

# Test Mindat search (requires API key)
curl 'http://localhost:5000/api/minerals/search?q=gold'

# Check database stats
curl 'http://localhost:5000/api/rruff/stats'

# Validate Mindat API key
curl 'http://localhost:5000/api/mindat/validate'
```

## 🔑 Getting API Keys

### Mindat API Key
1. Visit https://www.mindat.org/
2. Create account or log in
3. Go to Profile > API
4. Generate API key
5. Add to `.env`: `MINDAT_API_KEY=your_key_here`

## 📊 Data Import Status

```bash
# Check current data
curl http://localhost:5000/api/rruff/stats

# Response:
# {
#   "totalMinerals": 5844,
#   "enrichedCount": 0,
#   "notEnrichedCount": 5844
# }
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start dev server (auto-reload)
npm run dev

# Type checking
npm run check

# Build for production
npm run build

# Start production server
npm start

# Database migrations
npm run db:push
```

## 🐛 Troubleshooting

### Database Connection Errors
```bash
# Test Neon connection
node -e "const { Pool } = require('@neondatabase/serverless'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT NOW()').then(r => console.log('Connected:', r.rows[0])).catch(e => console.error('Error:', e));"
```

### Port Already in Use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

### RRUFF Import Not Working
```bash
# Check CSV file exists
ls -lh attached_assets/RRUFF_Export_*.csv

# Clear and re-import
curl -X POST http://localhost:5000/api/rruff/clear
curl -X POST http://localhost:5000/api/rruff/import
```

## 📈 Performance

- **RRUFF Search**: ~400-600ms (5,844 minerals)
- **Database queries**: PostgreSQL indexed
- **Frontend**: Vite HMR < 50ms
- **API response**: Paginated (default 20 items)

## 🔐 Security

- Environment variables via dotenv
- PostgreSQL SSL connections (Neon)
- Session-based authentication ready
- API key validation
- Input sanitization via Zod

## 📝 License

MIT

## 🤝 Contributing

This project is under active development. Key areas:

1. Frontend UI components
2. Advanced search filters
3. Data visualization
4. Elasticsearch integration
5. Mobile app

## 📞 Support

- GitHub Issues: https://github.com/Bigglerum/MineralSearch/issues
- Mindat API Docs: https://www.mindat.org/api
- RRUFF Database: https://rruff.info/

---

**Status**: Production-ready with Neon PostgreSQL and RRUFF data. Mindat API integration requires API key.
