# Australian Election Transparency Tool

A rapid-response web application for analyzing Australian political donations, party funding, and electoral spending. Built for political staffers and researchers to quickly investigate donation disclosures.

## Features

- **Real-time Dashboard** - Summary statistics and key insights at a glance
- **Global Search** - Instantly search donors, candidates, parties, and entities
- **Advanced Filtering** - Filter by time period, entity type, and donation amounts
- **Data Upload** - Import new AEC CSV files directly through the web interface
- **Auto-generated Insights** - Automatically identifies key narratives and patterns
- **Export Capabilities** - Download filtered data and reports

## Database Overview

- **269,521 records** across 25 tables
- **Elections:** 2004-2025 Federal Elections
- **Annual Returns:** 1998-2024 Financial Years
- **Coverage:**
  - Political party funding
  - Donor donations
  - Independent candidate funding
  - Third-party electoral spending
  - Associated entities (unions, etc.)

## Key Insights

**2025 Federal Election:**
- 97.8% of donations went to independent candidates
- $29.75M total donations
- Dramatic shift from traditional party-dominated funding

## Tech Stack

- **Backend:** Flask (Python 3.11+)
- **Database:** SQLite (local) / PostgreSQL (production)
- **Frontend:** Vanilla JavaScript + CSS
- **Deployment:** Vercel
- **Data Source:** Australian Electoral Commission (AEC)

## Local Development

### Prerequisites

- Python 3.11 or higher
- SQLite3 (included with Python)

### Setup

1. **Clone/Download the project**
   ```bash
   cd AllElectionsData
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Import data** (if not already done)
   ```bash
   python import_to_sqlite.py
   ```

4. **Run the application**
   ```bash
   python app.py
   ```

5. **Open in browser**
   ```
   http://localhost:5001
   ```

## Production Deployment (Vercel)

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide.

### Quick Deploy

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Create PostgreSQL database in Vercel dashboard
# Get POSTGRES_URL from Vercel Storage settings

# 3. Migrate data
export POSTGRES_URL="your-postgres-url"
python migrate_to_postgres.py

# 4. Deploy
vercel --prod
```

## Project Structure

```
AllElectionsData/
├── app.py                      # Flask application (supports SQLite + PostgreSQL)
├── migrate_to_postgres.py      # Database migration script
├── import_to_sqlite.py         # Initial SQLite import script
├── election_data.db            # SQLite database (local only)
├── vercel.json                 # Vercel deployment configuration
├── requirements.txt            # Python dependencies
├── .env.example                # Environment variables template
├── DEPLOYMENT.md               # Deployment guide
├── templates/
│   └── index.html              # Main dashboard template
├── static/
│   ├── css/
│   │   └── style.css           # Application styles
│   └── js/
│       └── app.js              # Client-side JavaScript
└── data/                       # CSV source files (optional)
```

## API Endpoints

### Dashboard
- `GET /` - Main dashboard
- `GET /api/dashboard/stats` - Summary statistics
- `GET /api/dashboard/<section>` - Section-specific data
  - `top-donors` - Top 10 donors (2025)
  - `party-funding` - Party funding (2023-24)
  - `recent-donations` - Recent large donations
  - `top-candidates` - Top funded candidates
  - `third-party` - Third party spending
  - `mp-donations` - MP donations

### Search & Explore
- `GET /api/search?q=<query>` - Global search
- `GET /api/explore?period=<period>&minAmount=<amount>` - Filtered exploration

### Insights
- `GET /api/insights` - Auto-generated insights

### Data Management
- `POST /api/upload` - Upload CSV file (multipart/form-data)
- `GET /tables` - List all database tables
- `GET /schema/<table_name>` - Get table schema

## Usage

### Dashboard View

The dashboard shows:
- **Summary cards** - Total donations, parties, donors, candidates
- **Key insights** - Independent surge, top donors, dark money
- **Data tables** - Top donors, party funding, candidates, etc.

### Search

1. Navigate to "Explore Data" tab
2. Type in search box (minimum 2 characters)
3. Results show across donors, candidates, and third parties
4. Click result to filter view

### Filters

**Time Period:**
- 2025 Election
- 2023-24 Annual
- 2022 Election
- Last 2 Years
- All Time

**Entity Type:**
- Political Parties
- Independents
- Third Parties
- Associated Entities

**Amount Range:**
- Preset buttons: >$10K, >$50K, >$100K, >$1M
- Custom slider: $0 - $10M+

### Upload New Data

1. Click "Upload New Data" button
2. Drag & drop CSV or click to browse
3. File must be AEC-format CSV
4. System validates and imports automatically
5. Creates timestamped table (e.g., `uploaded_donations_20250109_143022`)

## Data Sources

All data sourced from the [Australian Electoral Commission (AEC)](https://transparency.aec.gov.au/):

- **Election Returns** - Candidate and donor returns for federal elections
- **Annual Returns** - Political party, donor, and third party annual returns
- **Media Spending** - Electoral advertisement details

## Security

- **Read-only queries** - Only SELECT statements allowed
- **SQL injection prevention** - Parameterized queries, table name validation
- **No authentication required** - Public transparency data
- **Optional upload protection** - Can require password for uploads

## Performance

- **Database indexes** on frequently queried columns (donor names, events, financial years)
- **Result limits** - Queries limited to 100-1000 rows
- **Client-side debouncing** - Search requests delayed 300ms
- **Efficient queries** - Optimized joins and aggregations

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers supported

## Contributing

This is a rapid-response tool for the February 2025 disclosure period. Key areas for enhancement:

1. **Red flags filtering** - Identify dark money patterns (deferred from Sprint 1)
2. **Automated reports** - PDF/Word export
3. **Email alerts** - Notifications for large donations
4. **Visualizations** - Charts for funding trends
5. **Cross-year comparison** - Side-by-side period analysis

## License

Data: Public domain (AEC transparency data)
Code: MIT License

## Contact

For questions or support, refer to [DEPLOYMENT.md](DEPLOYMENT.md) for troubleshooting.

## Acknowledgments

- Australian Electoral Commission for transparency data
- Climate 200 for independent funding advocacy
- Political researchers and staffers providing requirements
