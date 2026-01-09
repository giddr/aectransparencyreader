# Deployment Guide: Vercel

This guide covers deploying the Australian Election Transparency tool to Vercel with PostgreSQL.

## Prerequisites

- Vercel account ([signup here](https://vercel.com/signup))
- Vercel CLI installed: `npm install -g vercel`
- PostgreSQL database migrated from SQLite (see Migration section below)

## Quick Start

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Create PostgreSQL Database**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Navigate to Storage tab
   - Click "Create Database"
   - Select "Postgres"
   - Choose a name (e.g., "election-data-db")
   - Select region closest to your users (e.g., Sydney for Australia)
   - Click "Create"

4. **Get Database Connection String**
   - Click on your database
   - Go to "Settings" tab
   - Copy the `POSTGRES_URL` connection string
   - It looks like: `postgres://username:password@host:port/database`

5. **Migrate Data from SQLite to PostgreSQL**
   ```bash
   # Create .env file with your database URL
   cp .env.example .env
   # Edit .env and add your POSTGRES_URL

   # Install Python dependencies
   pip install -r requirements.txt

   # Run migration script
   python migrate_to_postgres.py
   ```

6. **Deploy to Vercel**
   ```bash
   # Preview deployment
   vercel

   # Production deployment
   vercel --prod
   ```

## Detailed Setup

### 1. Database Migration

The migration script (`migrate_to_postgres.py`) handles:
- Converting all 25 tables from SQLite to PostgreSQL
- Mapping SQLite types to PostgreSQL types
- Migrating 269,521 records
- Creating performance indexes
- Verifying data integrity

**Steps:**

```bash
# 1. Install dependencies
pip install psycopg2-binary python-dotenv

# 2. Set environment variable
export POSTGRES_URL="postgres://username:password@host:port/database"
# OR create .env file with POSTGRES_URL

# 3. Run migration
python migrate_to_postgres.py
```

**Expected output:**
```
================================================================================
SQLite to PostgreSQL Migration
================================================================================

SQLite database: election_data.db
PostgreSQL URL: postgres://...

Connecting to databases...
  ✓ Connected

Getting table list...
  Found 25 tables

[1/25] Migrating: annual_Associated_Entity_Returns
--------------------------------------------------------------------------------
  Columns: 10
  ✓ Created table
  Migrated 1,000 / 1,234 rows
  ✓ Verified: 1,234 rows

...

Creating indexes...
  Created index: idx_election_Donor_Donations_Made_Donor_Name
  Created index: idx_election_Donor_Donations_Made_Event
  ...

================================================================================
Migration Complete!
================================================================================
Tables migrated: 25/25
Total rows: 269,521

Next steps:
1. Update app.py to use PostgreSQL connection
2. Test all API endpoints
3. Deploy to Vercel with `vercel --prod`
================================================================================
```

### 2. Vercel Configuration

The `vercel.json` file configures the deployment:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "app.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/static/(.*)",
      "dest": "/static/$1"
    },
    {
      "src": "/(.*)",
      "dest": "app.py"
    }
  ],
  "env": {
    "POSTGRES_URL": "@postgres_url"
  }
}
```

### 3. Environment Variables

Set environment variables in Vercel dashboard:

1. Go to your project in Vercel
2. Click "Settings"
3. Click "Environment Variables"
4. Add the following:

| Variable | Value | Environment |
|----------|-------|-------------|
| `POSTGRES_URL` | Your PostgreSQL connection string | Production, Preview, Development |
| `SECRET_KEY` | Random secret key for Flask sessions | Production, Preview, Development |

**Generate a secret key:**
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 4. Deploy

**Preview Deployment (testing):**
```bash
vercel
```
This creates a preview URL like `https://your-project-abc123.vercel.app`

**Production Deployment:**
```bash
vercel --prod
```
This deploys to your production URL like `https://your-project.vercel.app`

### 5. Custom Domain (Optional)

1. Go to Vercel dashboard
2. Select your project
3. Click "Settings" → "Domains"
4. Add your domain (e.g., `election-transparency.org`)
5. Configure DNS according to Vercel's instructions

## Testing Deployment

After deployment, test all features:

### 1. Dashboard
- Visit your Vercel URL
- Check all summary cards load
- Verify donation amounts display correctly

### 2. Search
- Go to "Explore Data" tab
- Search for "Climate 200"
- Should return donation results

### 3. Filters
- Apply time period filter (2025 vs 2023-24)
- Apply amount filter (> $50K)
- Should filter results correctly

### 4. Upload (if enabled)
- Click "Upload New Data"
- Upload a test CSV
- Verify it creates new table

## Troubleshooting

### Error: "Module not found: psycopg2"

**Solution:** Ensure `requirements.txt` includes:
```
psycopg2-binary==2.9.9
```

### Error: "POSTGRES_URL not set"

**Solution:**
1. Check environment variables in Vercel dashboard
2. Redeploy after adding environment variable

### Error: "relation does not exist"

**Solution:**
- Migration may have failed
- Re-run `python migrate_to_postgres.py`
- Check table names match exactly (case-sensitive in PostgreSQL)

### Slow Queries

**Solution:**
- Check indexes were created during migration
- Run `CREATE INDEX` on frequently queried columns
- Consider upgrading Vercel Postgres tier

### Cold Starts (1-2 second delay)

**Expected behavior:** Vercel serverless functions have cold starts
**Solutions:**
- Upgrade to Vercel Pro for faster cold starts
- Use Vercel Edge Functions for instant response
- Cache frequently accessed data

## Monitoring

### Vercel Analytics

1. Go to your project dashboard
2. Click "Analytics" tab
3. View:
   - Request volume
   - Response times
   - Error rates
   - Top endpoints

### Database Monitoring

1. Go to Vercel Storage
2. Select your database
3. View:
   - Connection count
   - Query performance
   - Storage usage
   - Compute hours (free tier: 60 hours/month)

## Cost Optimization

### Vercel Free Tier Limits

- **Bandwidth:** 100 GB/month
- **Serverless function executions:** Unlimited
- **Build minutes:** 6,000 minutes/month

### Vercel Postgres Free Tier

- **Storage:** 256 MB (current DB is 41.8 MB - plenty of room)
- **Compute:** 60 hours/month
- **Rows:** No limit (our 269k rows fit easily)

### Tips to Stay Within Free Tier

1. **Cache frequently accessed data**
   - Use Flask caching for dashboard stats
   - Cache search results client-side

2. **Optimize queries**
   - Use indexes (already created by migration script)
   - Limit result sets (already limited to 100 rows)

3. **Monitor usage**
   - Check Vercel dashboard weekly
   - Set up usage alerts

## Updating After February Disclosures

When new AEC data drops in February:

1. **Upload via UI**
   - Go to "Explore Data" tab
   - Click "Upload New Data"
   - Select CSV file
   - System automatically creates timestamped table

2. **Manual migration**
   ```bash
   # Add CSV to local folder
   # Run import script
   python import_to_sqlite.py

   # Re-run migration to update PostgreSQL
   python migrate_to_postgres.py
   ```

3. **Verify**
   - Check dashboard shows updated totals
   - Search for new donors/candidates
   - Generate fresh insights

## Rollback

If deployment fails or has issues:

```bash
# Revert to previous deployment
vercel rollback
```

Or use Vercel dashboard:
1. Go to "Deployments" tab
2. Find previous working deployment
3. Click "Promote to Production"

## Support

- **Vercel Docs:** https://vercel.com/docs
- **Vercel Support:** https://vercel.com/support
- **PostgreSQL Docs:** https://www.postgresql.org/docs/

## Next Steps

After successful deployment:

1. **Share URL with team**
   - Add team members in Vercel dashboard
   - Share production URL

2. **Set up monitoring**
   - Enable Vercel Analytics
   - Set up error tracking (optional: Sentry)

3. **Prepare for February data drop**
   - Document upload process
   - Create data validation checklist
   - Plan media response strategy

4. **Consider enhancements**
   - Add automated insights generation
   - Create PDF export for reports
   - Implement email alerts for large donations
