#!/usr/bin/env python3
"""
Flask web application for querying Australian election data
Supports both SQLite (local) and PostgreSQL (Vercel)
"""

from flask import Flask, render_template, request, jsonify
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Database configuration
# Use PostgreSQL if POSTGRES_URL is set, otherwise use SQLite
POSTGRES_URL = os.getenv('POSTGRES_URL')
USE_POSTGRES = POSTGRES_URL is not None
DB_PATH = 'election_data.db'

# Import appropriate database library
if USE_POSTGRES:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    print("Using PostgreSQL database")
else:
    import sqlite3
    print("Using SQLite database")

# Pre-defined example queries
EXAMPLE_QUERIES = {
    'top_donors_2025': {
        'name': 'Top 10 Donors - 2025 Election',
        'description': 'Shows the biggest donors in the 2025 Federal Election',
        'sql': '''
            SELECT
                Donor_Name,
                SUM(Donated_To_Gift_Value) as Total_Donated,
                COUNT(*) as Number_of_Donations
            FROM election_Donor_Donations_Made
            WHERE Event = '2025 Federal Election'
            GROUP BY Donor_Name
            ORDER BY Total_Donated DESC
            LIMIT 10
        '''
    },
    'party_funding_2023_24': {
        'name': 'Party Funding Summary - 2023-24',
        'description': 'Total receipts and payments by political party',
        'sql': '''
            SELECT
                Name,
                Total_Receipts,
                Total_Payments,
                Total_Debts,
                (Total_Receipts - Total_Payments) as Net_Position
            FROM annual_Party_Returns
            WHERE Financial_Year = '2023-24'
            ORDER BY Total_Receipts DESC
        '''
    },
    'media_spending_2025': {
        'name': 'Media Advertisement Spending - 2025',
        'description': 'Media spending by advertiser in 2025 election',
        'sql': '''
            SELECT
                Advertiser,
                Advertiser_Type,
                COUNT(*) as Ad_Count,
                SUM(Amount) as Total_Spent
            FROM election_Media_Advertisement_Details
            WHERE Event = '2025 Federal Election'
            GROUP BY Advertiser, Advertiser_Type
            ORDER BY Total_Spent DESC
            LIMIT 20
        '''
    },
    'candidate_donations_2025': {
        'name': 'Top Funded Candidates - 2025',
        'description': 'Candidates with highest donation totals',
        'sql': '''
            SELECT
                Name,
                Party_Name,
                Electorate_Name,
                Total_Gift_Value,
                Number_Of_Donors,
                Total_Electoral_Expenditure
            FROM election_Senate_Groups_and_Candidate_Return_Summary
            WHERE Event = '2025 Federal Election'
                AND Total_Gift_Value > 0
            ORDER BY Total_Gift_Value DESC
            LIMIT 20
        '''
    },
    'mp_donations': {
        'name': 'Member of Parliament Donations - 2023-24',
        'description': 'Independent MPs and their donation receipts',
        'sql': '''
            SELECT
                Name,
                Total_Donations_Received,
                Number_of_Donors
            FROM annual_MemberOfParliamentReturns
            WHERE Financial_Year = '2023-24'
            ORDER BY Total_Donations_Received DESC
        '''
    },
    'third_party_spending': {
        'name': 'Third Party Electoral Spending - 2023-24',
        'description': 'Organizations that spent on electoral activities',
        'sql': '''
            SELECT
                Name,
                Total_Receipts,
                Total_Payments,
                Electoral_Expenditure
            FROM annual_Significant_Third_Party_Returns
            WHERE Financial_Year = '2023-24'
                AND Electoral_Expenditure > 0
            ORDER BY Electoral_Expenditure DESC
        '''
    },
    'donor_recipients': {
        'name': 'Climate 200 Donations - 2025',
        'description': 'Who received donations from Climate 200',
        'sql': '''
            SELECT
                Donated_To,
                Donated_To_Date_Of_Gift as Date,
                Donated_To_Gift_Value as Amount
            FROM election_Donor_Donations_Made
            WHERE Donor_Name = 'Climate 200 Pty Limited'
                AND Event = '2025 Federal Election'
            ORDER BY Donated_To_Gift_Value DESC
        '''
    },
    'party_debts': {
        'name': 'Party Debts - 2023-24',
        'description': 'Political parties with outstanding debts',
        'sql': '''
            SELECT
                Name,
                Total_Receipts,
                Total_Payments,
                Total_Debts
            FROM annual_Party_Returns
            WHERE Financial_Year = '2023-24'
                AND Total_Debts > 0
            ORDER BY Total_Debts DESC
        '''
    },
    'all_tables': {
        'name': 'List All Database Tables',
        'description': 'Shows all available tables in the database',
        'sql': '''
            SELECT
                name as Table_Name,
                type as Type
            FROM sqlite_master
            WHERE type='table'
            ORDER BY name
        '''
    }
}

def get_db_connection():
    """Create database connection (SQLite or PostgreSQL)"""
    if USE_POSTGRES:
        return psycopg2.connect(POSTGRES_URL)
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def execute_query(sql):
    """Execute SQL query and return results (SQLite or PostgreSQL)"""
    try:
        conn = get_db_connection()

        if USE_POSTGRES:
            # PostgreSQL execution
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(sql)

            # Fetch all rows
            rows = cursor.fetchall()

            # Convert RealDictRow to regular dict
            results = [dict(row) for row in rows]

            # Get column names
            columns = list(results[0].keys()) if results else []
        else:
            # SQLite execution
            cursor = conn.cursor()
            cursor.execute(sql)

            # Get column names
            columns = [description[0] for description in cursor.description]

            # Fetch all rows
            rows = cursor.fetchall()

            # Convert to list of dictionaries
            results = []
            for row in rows:
                results.append(dict(zip(columns, row)))

        conn.close()

        return {
            'success': True,
            'columns': columns,
            'data': results,
            'row_count': len(results)
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

@app.route('/')
def index():
    """Home page"""
    return render_template('index.html', examples=EXAMPLE_QUERIES)

@app.route('/query', methods=['POST'])
def query():
    """Execute a SQL query"""
    data = request.get_json()
    sql = data.get('sql', '')

    if not sql:
        return jsonify({'success': False, 'error': 'No SQL query provided'})

    # Basic security: only allow SELECT statements
    sql_upper = sql.strip().upper()
    if not sql_upper.startswith('SELECT'):
        return jsonify({
            'success': False,
            'error': 'Only SELECT queries are allowed'
        })

    # Check for dangerous keywords
    dangerous = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE']
    for keyword in dangerous:
        if keyword in sql_upper:
            return jsonify({
                'success': False,
                'error': f'Keyword {keyword} is not allowed'
            })

    result = execute_query(sql)
    return jsonify(result)

@app.route('/example/<example_id>')
def get_example(example_id):
    """Get example query by ID"""
    if example_id in EXAMPLE_QUERIES:
        return jsonify({
            'success': True,
            'query': EXAMPLE_QUERIES[example_id]
        })
    else:
        return jsonify({
            'success': False,
            'error': 'Example not found'
        })

@app.route('/tables')
def get_tables():
    """Get list of all tables"""
    if USE_POSTGRES:
        sql = "SELECT tablename as name FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    else:
        sql = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    result = execute_query(sql)
    return jsonify(result)

@app.route('/schema/<table_name>')
def get_schema(table_name):
    """Get schema for a specific table"""
    # Validate table name to prevent SQL injection
    # Only allow alphanumeric characters and underscores
    if not table_name.replace('_', '').isalnum():
        return jsonify({
            'success': False,
            'error': 'Invalid table name'
        })

    if USE_POSTGRES:
        sql = f"""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = '{table_name}'
            ORDER BY ordinal_position
        """
    else:
        sql = f"PRAGMA table_info({table_name})"

    result = execute_query(sql)
    return jsonify(result)

@app.route('/api/dashboard/stats')
def dashboard_stats():
    """Get summary statistics for dashboard"""
    stats = {}

    # Total donations 2023-24
    sql = "SELECT SUM(Total_Donations_Made) as total FROM annual_Donor_Returns WHERE Financial_Year = '2023-24'"
    result = execute_query(sql)
    stats['total_donations'] = result['data'][0]['total'] if result['success'] and result['data'] else 0

    # Total parties
    sql = "SELECT COUNT(*) as count FROM annual_Party_Returns WHERE Financial_Year = '2023-24'"
    result = execute_query(sql)
    stats['total_parties'] = result['data'][0]['count'] if result['success'] and result['data'] else 0

    # Total donors
    sql = "SELECT COUNT(*) as count FROM annual_Donor_Returns WHERE Financial_Year = '2023-24'"
    result = execute_query(sql)
    stats['total_donors'] = result['data'][0]['count'] if result['success'] and result['data'] else 0

    # Total candidates 2025
    sql = "SELECT COUNT(*) as count FROM election_Senate_Groups_and_Candidate_Return_Summary WHERE Event = '2025 Federal Election'"
    result = execute_query(sql)
    stats['total_candidates'] = result['data'][0]['count'] if result['success'] and result['data'] else 0

    return jsonify({'success': True, 'data': stats})

@app.route('/api/insights')
def get_insights():
    """Generate key insights from the data"""
    insights = []

    # Insight 1: Party vs Independent split in 2025
    sql = """
        SELECT
            CASE
                WHEN Party_Name IS NULL OR Party_Name = '' THEN 'Independent'
                ELSE 'Party-Affiliated'
            END as Category,
            SUM(Total_Gift_Value) as Total,
            COUNT(*) as Count
        FROM election_Senate_Groups_and_Candidate_Return_Summary
        WHERE Event = '2025 Federal Election'
        GROUP BY Category
    """
    result = execute_query(sql)
    if result['success'] and result['data']:
        total_all = sum(row['Total'] or 0 for row in result['data'])
        for row in result['data']:
            if row['Category'] == 'Independent':
                independent_total = row['Total'] or 0
                independent_pct = (independent_total / total_all * 100) if total_all > 0 else 0
                insights.append({
                    'type': 'party_split',
                    'title': '2025 Election: Independent Surge',
                    'stats': {
                        'independent_pct': round(independent_pct, 1),
                        'independent_total': independent_total,
                        'total': total_all
                    },
                    'description': f'The 2025 Federal Election shows {round(independent_pct, 1)}% of candidate funding went to independents, totaling ${independent_total:,.0f}.'
                })

    # Insight 2: Top donor in 2025
    sql = """
        SELECT Donor_Name, SUM(Donated_To_Gift_Value) as Total
        FROM election_Donor_Donations_Made
        WHERE Event = '2025 Federal Election'
        GROUP BY Donor_Name
        ORDER BY Total DESC
        LIMIT 1
    """
    result = execute_query(sql)
    if result['success'] and result['data'] and len(result['data']) > 0:
        top_donor = result['data'][0]
        insights.append({
            'type': 'top_donor',
            'title': 'Largest Donor - 2025',
            'stats': {
                'donor': top_donor['Donor_Name'],
                'amount': top_donor['Total']
            },
            'description': f"{top_donor['Donor_Name']} contributed ${top_donor['Total']:,.0f} in the 2025 election."
        })

    # Insight 3: Third party spending
    sql = """
        SELECT SUM(Electoral_Expenditure) as Total, COUNT(*) as Count
        FROM annual_Significant_Third_Party_Returns
        WHERE Financial_Year = '2023-24' AND Electoral_Expenditure > 0
    """
    result = execute_query(sql)
    if result['success'] and result['data'] and len(result['data']) > 0:
        third_party = result['data'][0]
        if third_party['Total']:
            insights.append({
                'type': 'dark_money',
                'title': 'Third Party Electoral Spending',
                'stats': {
                    'total': third_party['Total'],
                    'count': third_party['Count']
                },
                'description': f"{third_party['Count']} third party entities spent ${third_party['Total']:,.0f} on electoral activities in 2023-24."
            })

    # Insight 4: Party debts
    sql = """
        SELECT Name, Total_Debts
        FROM annual_Party_Returns
        WHERE Financial_Year = '2023-24' AND Total_Debts > 0
        ORDER BY Total_Debts DESC
        LIMIT 1
    """
    result = execute_query(sql)
    if result['success'] and result['data'] and len(result['data']) > 0:
        top_debt = result['data'][0]
        insights.append({
            'type': 'party_debt',
            'title': 'Highest Party Debt',
            'stats': {
                'party': top_debt['Name'],
                'debt': top_debt['Total_Debts']
            },
            'description': f"{top_debt['Name']} carries the highest debt at ${top_debt['Total_Debts']:,.0f}."
        })

    return jsonify({'success': True, 'insights': insights})

@app.route('/api/dashboard/<section>')
def dashboard_section(section):
    """Get data for specific dashboard section"""
    queries = {
        'top-donors': '''
            SELECT
                Donor_Name as Name,
                SUM(Donated_To_Gift_Value) as Amount,
                COUNT(*) as Donations
            FROM election_Donor_Donations_Made
            WHERE Event = '2025 Federal Election'
            GROUP BY Donor_Name
            ORDER BY Amount DESC
            LIMIT 10
        ''',
        'party-funding': '''
            SELECT
                Name,
                Total_Receipts,
                Total_Payments,
                Total_Debts
            FROM annual_Party_Returns
            WHERE Financial_Year = '2023-24'
            ORDER BY Total_Receipts DESC
            LIMIT 10
        ''',
        'recent-donations': '''
            SELECT
                Donor_Name,
                Donation_Made_To as Recipient,
                Value as Amount,
                Date
            FROM annual_Donations_Made
            WHERE Financial_Year = '2023-24'
                AND Value > 10000
            ORDER BY Date DESC
            LIMIT 10
        ''',
        'top-candidates': '''
            SELECT
                Name,
                Party_Name,
                Total_Gift_Value as Amount,
                Number_Of_Donors as Donors
            FROM election_Senate_Groups_and_Candidate_Return_Summary
            WHERE Event = '2025 Federal Election'
                AND Total_Gift_Value > 0
            ORDER BY Total_Gift_Value DESC
            LIMIT 10
        ''',
        'third-party': '''
            SELECT
                Name,
                Electoral_Expenditure as Spending,
                Total_Receipts as Receipts
            FROM annual_Significant_Third_Party_Returns
            WHERE Financial_Year = '2023-24'
                AND Electoral_Expenditure > 0
            ORDER BY Electoral_Expenditure DESC
            LIMIT 10
        ''',
        'mp-donations': '''
            SELECT
                Name,
                Total_Donations_Received as Amount,
                Number_of_Donors as Donors
            FROM annual_MemberOfParliamentReturns
            WHERE Financial_Year = '2023-24'
            ORDER BY Total_Donations_Received DESC
        '''
    }

    if section not in queries:
        return jsonify({'success': False, 'error': 'Invalid section'})

    result = execute_query(queries[section])
    return jsonify(result)

@app.route('/api/search')
def search():
    """Global search across donors, recipients, and entities - returns detailed transactions"""
    query = request.args.get('q', '').strip()

    if not query or len(query) < 2:
        return jsonify({'success': False, 'error': 'Search query must be at least 2 characters'})

    # Search for detailed transactions across all periods
    all_transactions = []

    # Search in 2025 election donations
    sql_2025 = f"""
        SELECT
            Donor_Name as Donor,
            Donated_To as Recipient,
            Donated_To_Gift_Value as Amount,
            Donated_To_Date_Of_Gift as Date,
            '2025 Federal Election' as Period,
            'Election Donation' as Type
        FROM election_Donor_Donations_Made
        WHERE (Donor_Name LIKE '%{query}%' OR Donated_To LIKE '%{query}%')
            AND Event = '2025 Federal Election'
        ORDER BY Donated_To_Gift_Value DESC
        LIMIT 50
    """
    results_2025 = execute_query(sql_2025)
    if results_2025['success'] and results_2025['data']:
        all_transactions.extend(results_2025['data'])

    # Search in 2022 election donations
    sql_2022 = f"""
        SELECT
            Donor_Name as Donor,
            Donated_To as Recipient,
            Donated_To_Gift_Value as Amount,
            Donated_To_Date_Of_Gift as Date,
            '2022 Federal Election' as Period,
            'Election Donation' as Type
        FROM election_Donor_Donations_Made
        WHERE (Donor_Name LIKE '%{query}%' OR Donated_To LIKE '%{query}%')
            AND Event = '2022 Federal Election'
        ORDER BY Donated_To_Gift_Value DESC
        LIMIT 50
    """
    results_2022 = execute_query(sql_2022)
    if results_2022['success'] and results_2022['data']:
        all_transactions.extend(results_2022['data'])

    # Search in annual donations (2023-24)
    sql_annual = f"""
        SELECT
            Donor_Name as Donor,
            Donation_Made_To as Recipient,
            Value as Amount,
            Date,
            Financial_Year as Period,
            'Annual Donation' as Type
        FROM annual_Donations_Made
        WHERE (Donor_Name LIKE '%{query}%' OR Donation_Made_To LIKE '%{query}%')
            AND Financial_Year = '2023-24'
        ORDER BY Value DESC
        LIMIT 50
    """
    results_annual = execute_query(sql_annual)
    if results_annual['success'] and results_annual['data']:
        all_transactions.extend(results_annual['data'])

    # Calculate summary statistics
    total_amount = sum(t.get('Amount') or 0 for t in all_transactions)
    transaction_count = len(all_transactions)

    # Get unique donors and recipients
    donors = set(t.get('Donor') for t in all_transactions if t.get('Donor'))
    recipients = set(t.get('Recipient') for t in all_transactions if t.get('Recipient'))

    return jsonify({
        'success': True,
        'transactions': all_transactions[:100],  # Limit to 100 transactions
        'summary': {
            'total_transactions': transaction_count,
            'total_amount': total_amount,
            'unique_donors': len(donors),
            'unique_recipients': len(recipients)
        }
    })

@app.route('/api/explore')
def explore():
    """Explore data with filters"""
    period = request.args.get('period', '2025')
    entity_types = request.args.get('entityTypes', 'parties,independents,third-parties,associated').split(',')
    min_amount = int(request.args.get('minAmount', 0))
    red_flags = request.args.get('redFlags', '').split(',') if request.args.get('redFlags') else []

    # Build base query based on period
    if period == '2025':
        # 2025 Federal Election data
        sql = """
            SELECT
                Donor_Name as Name,
                Donated_To as Recipient,
                Donated_To_Gift_Value as Amount,
                Donated_To_Date_Of_Gift as Date,
                'Donation' as Type
            FROM election_Donor_Donations_Made
            WHERE Event = '2025 Federal Election'
        """

        # Apply amount filter
        if min_amount > 0:
            sql += f" AND Donated_To_Gift_Value >= {min_amount}"

        sql += " ORDER BY Donated_To_Gift_Value DESC LIMIT 100"

    elif period == '2023-24':
        # Annual returns data
        sql = """
            SELECT
                Donor_Name as Name,
                Donation_Made_To as Recipient,
                Value as Amount,
                Date,
                'Annual Donation' as Type
            FROM annual_Donations_Made
            WHERE Financial_Year = '2023-24'
        """

        # Apply amount filter
        if min_amount > 0:
            sql += f" AND Value >= {min_amount}"

        sql += " ORDER BY Value DESC LIMIT 100"

    elif period == '2022':
        # 2022 Federal Election data
        sql = """
            SELECT
                Donor_Name as Name,
                Donated_To as Recipient,
                Donated_To_Gift_Value as Amount,
                Donated_To_Date_Of_Gift as Date,
                'Donation' as Type
            FROM election_Donor_Donations_Made
            WHERE Event = '2022 Federal Election'
        """

        # Apply amount filter
        if min_amount > 0:
            sql += f" AND Donated_To_Gift_Value >= {min_amount}"

        sql += " ORDER BY Donated_To_Gift_Value DESC LIMIT 100"

    else:
        # Default to all donations with amount filter
        sql = f"""
            SELECT
                Donor_Name as Name,
                Donation_Made_To as Recipient,
                Value as Amount,
                Date,
                Financial_Year as Period
            FROM annual_Donations_Made
            WHERE Value >= {min_amount}
            ORDER BY Value DESC
            LIMIT 100
        """

    result = execute_query(sql)
    return jsonify(result)

@app.route('/api/top-stories')
def top_stories():
    """Generate algorithmic highlights - top stories from the data"""
    stories = []

    try:
        # Story 1: Biggest funding shift (2025 vs 2022 independents)
        sql_2025_indep = """
            SELECT SUM(Donated_To_Gift_Value) as total
            FROM election_Donor_Donations_Made
            WHERE Event = '2025 Federal Election'
                AND Donated_To NOT IN ('AUSTRALIAN LABOR PARTY', 'LIBERAL PARTY OF AUSTRALIA',
                                       'THE NATIONALS', 'THE GREENS')
        """
        result_2025 = execute_query(sql_2025_indep)
        total_2025_indep = result_2025['data'][0]['total'] if result_2025['data'] else 0

        sql_2022_indep = """
            SELECT SUM(Donated_To_Gift_Value) as total
            FROM election_Donor_Donations_Made
            WHERE Event = '2022 Federal Election'
                AND Donated_To NOT IN ('AUSTRALIAN LABOR PARTY', 'LIBERAL PARTY OF AUSTRALIA',
                                       'THE NATIONALS', 'THE GREENS')
        """
        result_2022 = execute_query(sql_2022_indep)
        total_2022_indep = result_2022['data'][0]['total'] if result_2022['data'] else 1  # Avoid division by zero

        if total_2025_indep and total_2022_indep:
            pct_change = ((total_2025_indep - total_2022_indep) / total_2022_indep) * 100
            stories.append({
                'title': 'Independent Funding Surge',
                'description': f'Independent candidates received ${total_2025_indep:,.0f} in 2025, a {pct_change:+.1f}% change from 2022',
                'type': 'shift',
                'amount': total_2025_indep,
                'change': pct_change
            })

        # Story 2: Largest new donor (first appeared in 2025)
        sql_new_donor = """
            SELECT
                Donor_Name,
                SUM(Donated_To_Gift_Value) as Total_Donated
            FROM election_Donor_Donations_Made
            WHERE Event = '2025 Federal Election'
                AND Donor_Name NOT IN (
                    SELECT DISTINCT Donor_Name
                    FROM election_Donor_Donations_Made
                    WHERE Event = '2022 Federal Election'
                )
            GROUP BY Donor_Name
            ORDER BY Total_Donated DESC
            LIMIT 1
        """
        result_new = execute_query(sql_new_donor)
        if result_new['data']:
            donor = result_new['data'][0]
            stories.append({
                'title': 'Largest New Donor',
                'description': f'{donor["Donor_Name"]} donated ${donor["Total_Donated"]:,.0f} in their first appearance',
                'type': 'new_donor',
                'donor': donor['Donor_Name'],
                'amount': donor['Total_Donated']
            })

        # Story 3: Most indebted party (2023-24 annual returns)
        sql_debt = """
            SELECT
                Name,
                Total_Debts
            FROM annual_Party_Returns
            WHERE Financial_Year = '2023-24'
                AND Total_Debts IS NOT NULL
            ORDER BY Total_Debts DESC
            LIMIT 1
        """
        result_debt = execute_query(sql_debt)
        if result_debt['data']:
            party = result_debt['data'][0]
            stories.append({
                'title': 'Highest Party Debt',
                'description': f'{party["Name"]} reported ${party["Total_Debts"]:,.0f} in debts for 2023-24',
                'type': 'debt',
                'party': party['Name'],
                'amount': party['Total_Debts']
            })

        # Story 4: Dark money (highest third party spending without disclosure)
        sql_dark = """
            SELECT
                Name,
                Total_Electoral_Expenditure
            FROM annual_Significant_Third_Party_Returns
            WHERE Financial_Year = '2023-24'
                AND Total_Electoral_Expenditure > 100000
            ORDER BY Total_Electoral_Expenditure DESC
            LIMIT 1
        """
        result_dark = execute_query(sql_dark)
        if result_dark['data']:
            entity = result_dark['data'][0]
            stories.append({
                'title': 'Highest Dark Money Spending',
                'description': f'{entity["Name"]} spent ${entity["Total_Electoral_Expenditure"]:,.0f} on electoral activities',
                'type': 'dark_money',
                'entity': entity['Name'],
                'amount': entity['Total_Electoral_Expenditure']
            })

        return jsonify({
            'success': True,
            'stories': stories,
            'generated_at': datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/api/upload', methods=['POST'])
def upload():
    """Upload and import CSV file"""
    import csv
    import io
    from datetime import datetime

    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file provided'})

    file = request.files['file']
    filename = request.form.get('filename', file.filename)

    if not filename.endswith('.csv'):
        return jsonify({'success': False, 'error': 'File must be a CSV'})

    try:
        # Read CSV file
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)

        # Get columns
        columns = csv_reader.fieldnames
        if not columns:
            return jsonify({'success': False, 'error': 'CSV file has no columns'})

        # Clean column names
        cleaned_columns = [clean_column_name(col) for col in columns]

        # Read all rows
        rows = list(csv_reader)
        if not rows:
            return jsonify({'success': False, 'error': 'CSV file has no data rows'})

        # Determine table name from filename
        base_name = filename.replace('.csv', '').replace(' ', '_')
        # Prefix with 'uploaded_' to distinguish from original tables
        table_name = f"uploaded_{clean_column_name(base_name)}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Infer column types
        column_types = {}
        for orig_col, clean_col in zip(columns, cleaned_columns):
            values = [row[orig_col] for row in rows if row.get(orig_col)]
            col_type = infer_column_type(values)
            column_types[clean_col] = col_type

        # Create table
        conn = get_db_connection()
        cursor = conn.cursor()

        columns_sql = ', '.join([f'"{col}" {column_types[col]}' for col in cleaned_columns])
        create_table_sql = f"CREATE TABLE {table_name} ({columns_sql})"
        cursor.execute(create_table_sql)

        # Insert data
        placeholders = ', '.join(['?' for _ in cleaned_columns])
        insert_sql = f"INSERT INTO {table_name} VALUES ({placeholders})"

        data_to_insert = []
        for row in rows:
            row_data = []
            for orig_col, clean_col in zip(columns, cleaned_columns):
                value = row.get(orig_col, '')
                # Convert empty strings to NULL
                if not value or value.strip() == '':
                    row_data.append(None)
                else:
                    # Try to convert to appropriate type
                    if column_types[clean_col] == 'INTEGER':
                        try:
                            row_data.append(int(value))
                        except ValueError:
                            row_data.append(None)
                    elif column_types[clean_col] == 'REAL':
                        try:
                            row_data.append(float(value))
                        except ValueError:
                            row_data.append(None)
                    else:
                        row_data.append(value)
            data_to_insert.append(tuple(row_data))

        cursor.executemany(insert_sql, data_to_insert)
        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'table_name': table_name,
            'rows_imported': len(data_to_insert),
            'columns': len(cleaned_columns),
            'message': f'Successfully imported {len(data_to_insert)} rows into {table_name}'
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error processing file: {str(e)}'
        })

def clean_column_name(name):
    """Clean column names to be SQL-friendly"""
    cleaned = name.strip()
    cleaned = cleaned.replace(' ', '_')
    cleaned = cleaned.replace('(', '')
    cleaned = cleaned.replace(')', '')
    cleaned = cleaned.replace('/', '_')
    cleaned = cleaned.replace('-', '_')
    cleaned = cleaned.replace('.', '_')
    cleaned = cleaned.replace(',', '')
    cleaned = cleaned.replace("'", '')

    while '__' in cleaned:
        cleaned = cleaned.replace('__', '_')

    cleaned = cleaned.strip('_')
    return cleaned

def infer_column_type(values):
    """Infer the SQL column type from sample values"""
    non_empty = [v for v in values if v and str(v).strip()]

    if not non_empty:
        return 'TEXT'

    # Try integer
    try:
        for v in non_empty[:100]:
            int(v)
        return 'INTEGER'
    except (ValueError, TypeError):
        pass

    # Try float
    try:
        for v in non_empty[:100]:
            float(v)
        return 'REAL'
    except (ValueError, TypeError):
        pass

    return 'TEXT'

if __name__ == '__main__':
    print("="*80)
    print("Australian Election Data Query App")
    print("="*80)

    if USE_POSTGRES:
        print(f"Database: PostgreSQL")
        print(f"Connection: {POSTGRES_URL[:30]}...")
    else:
        if not os.path.exists(DB_PATH):
            print(f"ERROR: Database not found at {DB_PATH}")
            print("Please run import_to_sqlite.py first")
            exit(1)
        print(f"Database: SQLite at {DB_PATH}")

    print("Starting Flask server...")
    print("="*80)

    app.run(debug=True, host='0.0.0.0', port=5001)
