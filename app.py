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

def quote_identifiers_for_postgres(sql):
    """Quote table and column names in SQL for PostgreSQL case-sensitivity"""
    if not USE_POSTGRES:
        return sql

    # List of all table names that need quoting
    tables = [
        'election_Donor_Donations_Made', 'election_Donor_Donations_Received',
        'election_Donor_Return', 'election_Media_Advertisement_Details',
        'election_Media_Returns', 'election_Senate_Groups_and_Candidate_Return_Summary',
        'election_Senate_Groups_and_Candidate_Donations', 'election_Senate_Groups_and_Candidate_Expenses',
        'election_Senate_Groups_and_Candidate_Discretionary_Benefits',
        'election_Third_Party_Return_Donations_Made', 'election_Third_Party_Return_Donations_Received',
        'election_Third_Party_Return_Expenditure',
        'annual_Donations_Made', 'annual_Donor_Donations_Received', 'annual_Donor_Returns',
        'annual_Party_Returns', 'annual_MemberOfParliamentReturns',
        'annual_Significant_Third_Party_Returns', 'annual_Third_Party_Returns',
        'annual_Third_Party_Donations_Received', 'annual_Associated_Entity_Returns',
        'annual_Capital_Contributions', 'annual_Detailed_Debts',
        'annual_Detailed_Discretionary_Benefits', 'annual_Detailed_Receipts'
    ]

    # Common column names that need quoting (have mixed case with underscores)
    columns = [
        'Event', 'Name', 'Total_Receipts', 'Total_Payments', 'Total_Debts', 'Financial_Year',
        'Donor_Name', 'Donor_Code', 'Donated_To', 'Donated_To_Gift_Value', 'Donated_To_Date_Of_Gift',
        'Donation_Made_To', 'Donation_Received_From', 'Value', 'Date', 'Party_Name', 'Electorate_Name',
        'Total_Gift_Value', 'Number_Of_Donors', 'Total_Electoral_Expenditure',
        'Total_Donations_Received', 'Number_of_Donors', 'Total_Donations_Made',
        'Electoral_Expenditure', 'Advertiser', 'Advertiser_Type', 'Amount',
        'Received_From', 'Recipient_Name', 'Receipt_Type',
        'Gift_From_Name', 'Gift_From_Gift_Value', 'Gift_From_Date_Of_Gift',
        'Third_Party_Name', 'Third_Party_Code',
        'Donation_Value', 'Date_Of_Donation',
        'Gift_Value', 'Date_Of_Gift',
        'Return_Type_Candidate_Senate_Group'
    ]

    # Replace table names
    for table in tables:
        sql = sql.replace(f' {table}', f' "{table}"')
        sql = sql.replace(f'FROM {table}', f'FROM "{table}"')
        sql = sql.replace(f'from {table}', f'from "{table}"')

    # Replace column names (need to be careful not to quote string literals)
    import re
    for column in columns:
        # Quote column names that appear after SELECT, WHERE, GROUP BY, ORDER BY
        # But not inside string literals (single quotes)
        sql = re.sub(r'\b' + column + r'\b(?![^\']*\'(?:[^\']*\'[^\']*\')*[^\']*$)', f'"{column}"', sql)

    return sql

def execute_query(sql):
    """Execute SQL query and return results (SQLite or PostgreSQL)"""
    try:
        conn = get_db_connection()

        if USE_POSTGRES:
            # PostgreSQL execution - quote identifiers for case sensitivity
            sql = quote_identifiers_for_postgres(sql)
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

    # Search for detailed transactions across ALL periods
    all_transactions = []

    # Use ILIKE for case-insensitive search in PostgreSQL
    like_op = 'ILIKE' if USE_POSTGRES else 'LIKE'

    # Split query into words for intelligent matching (all words must match)
    words = query.split()

    # Helper function to build WHERE clause requiring ALL query words to match
    def build_where_clause(donor_col, recipient_col):
        """Build WHERE clause requiring all query words to match in either donor or recipient"""
        word_conditions = []
        for word in words:
            # Each word must match in EITHER donor OR recipient
            word_condition = f"({donor_col} {like_op} '%{word}%' OR {recipient_col} {like_op} '%{word}%')"
            word_conditions.append(word_condition)
        # ALL words must match (AND between word conditions)
        return " AND ".join(word_conditions)

    # Search ALL election donations (all years) - sorted by amount to get most significant
    where_clause_elections = build_where_clause('Donor_Name', 'Donated_To')
    sql_elections = f"""
        SELECT
            Donor_Name as Donor,
            Donated_To as Recipient,
            Donated_To_Gift_Value as Amount,
            Donated_To_Date_Of_Gift as Date,
            Event as Period,
            'Election Donation' as Type,
            NULL as Receipt_Type
        FROM election_Donor_Donations_Made
        WHERE {where_clause_elections}
        ORDER BY Donated_To_Gift_Value DESC
        LIMIT 200
    """
    results_elections = execute_query(sql_elections)
    if results_elections['success'] and results_elections['data']:
        all_transactions.extend(results_elections['data'])

    # Search ALL annual donations (all financial years) - sorted by amount to get most significant
    where_clause_annual = build_where_clause('Donor_Name', 'Donation_Made_To')
    sql_annual = f"""
        SELECT
            Donor_Name as Donor,
            Donation_Made_To as Recipient,
            Value as Amount,
            Date,
            Financial_Year as Period,
            'Annual Return' as Type,
            NULL as Receipt_Type
        FROM annual_Donations_Made
        WHERE {where_clause_annual}
        ORDER BY Value DESC
        LIMIT 200
    """
    results_annual = execute_query(sql_annual)
    if results_annual['success'] and results_annual['data']:
        all_transactions.extend(results_annual['data'])

    # Search ALL annual donations received (donations TO parties/entities) - sorted by amount
    where_clause_annual_received = build_where_clause('Donation_Received_From', 'Name')
    sql_annual_received = f"""
        SELECT
            Donation_Received_From as Donor,
            Name as Recipient,
            Value as Amount,
            Date,
            Financial_Year as Period,
            'Annual Return (Received)' as Type,
            NULL as Receipt_Type
        FROM annual_Donor_Donations_Received
        WHERE {where_clause_annual_received}
        ORDER BY Value DESC
        LIMIT 200
    """
    results_annual_received = execute_query(sql_annual_received)
    if results_annual_received['success'] and results_annual_received['data']:
        all_transactions.extend(results_annual_received['data'])

    # Search annual detailed receipts (party annual returns) - sorted by amount
    where_clause_detailed_receipts = build_where_clause('Received_From', 'Recipient_Name')
    sql_detailed_receipts = f"""
        SELECT
            Received_From as Donor,
            Recipient_Name as Recipient,
            Value as Amount,
            Financial_Year as Period,
            'Party Annual Return' as Type,
            Receipt_Type
        FROM annual_Detailed_Receipts
        WHERE {where_clause_detailed_receipts}
        ORDER BY Value DESC
        LIMIT 200
    """
    results_detailed_receipts = execute_query(sql_detailed_receipts)
    if results_detailed_receipts['success'] and results_detailed_receipts['data']:
        all_transactions.extend(results_detailed_receipts['data'])

    # Search election donations received (donations TO donors/entities) - sorted by amount
    where_clause_election_received = build_where_clause('Gift_From_Name', 'Donor_Name')
    sql_election_received = f"""
        SELECT
            Gift_From_Name as Donor,
            Donor_Name as Recipient,
            Gift_From_Gift_Value as Amount,
            Gift_From_Date_Of_Gift as Date,
            Event as Period,
            'Election Donation (Received)' as Type,
            NULL as Receipt_Type
        FROM election_Donor_Donations_Received
        WHERE {where_clause_election_received}
        ORDER BY Gift_From_Gift_Value DESC
        LIMIT 200
    """
    results_election_received = execute_query(sql_election_received)
    if results_election_received['success'] and results_election_received['data']:
        all_transactions.extend(results_election_received['data'])

    # Search third party donations made (elections) - sorted by amount
    where_clause_tp_made = build_where_clause('Third_Party_Name', 'Name')
    sql_tp_donations_made = f"""
        SELECT
            Third_Party_Name as Donor,
            Name as Recipient,
            Donation_Value as Amount,
            Date_Of_Donation as Date,
            Event as Period,
            'Third Party Donation (Made)' as Type,
            NULL as Receipt_Type
        FROM election_Third_Party_Return_Donations_Made
        WHERE {where_clause_tp_made}
        ORDER BY Donation_Value DESC
        LIMIT 200
    """
    results_tp_made = execute_query(sql_tp_donations_made)
    if results_tp_made['success'] and results_tp_made['data']:
        all_transactions.extend(results_tp_made['data'])

    # Search third party donations received (elections) - sorted by amount
    where_clause_tp_received = build_where_clause('Donor_Name', 'Third_Party_Name')
    sql_tp_donations_received = f"""
        SELECT
            Donor_Name as Donor,
            Third_Party_Name as Recipient,
            Gift_Value as Amount,
            Date_Of_Gift as Date,
            Event as Period,
            'Third Party Donation (Received)' as Type,
            NULL as Receipt_Type
        FROM election_Third_Party_Return_Donations_Received
        WHERE {where_clause_tp_received}
        ORDER BY Gift_Value DESC
        LIMIT 200
    """
    results_tp_received = execute_query(sql_tp_donations_received)
    if results_tp_received['success'] and results_tp_received['data']:
        all_transactions.extend(results_tp_received['data'])

    # Search candidate/senate group donations (elections) - sorted by amount
    where_clause_candidate = build_where_clause('Donor_Name', 'Name')
    sql_candidate_donations = f"""
        SELECT
            Donor_Name as Donor,
            Name as Recipient,
            Gift_Value as Amount,
            Date_Of_Gift as Date,
            Event as Period,
            'Candidate Donation' as Type,
            NULL as Receipt_Type
        FROM election_Senate_Groups_and_Candidate_Donations
        WHERE {where_clause_candidate}
        ORDER BY Gift_Value DESC
        LIMIT 200
    """
    results_candidate = execute_query(sql_candidate_donations)
    if results_candidate['success'] and results_candidate['data']:
        all_transactions.extend(results_candidate['data'])

    # Search annual third party donations received - sorted by amount
    where_clause_annual_tp = build_where_clause('Donation_Received_From', 'Name')
    sql_annual_tp_received = f"""
        SELECT
            Donation_Received_From as Donor,
            Name as Recipient,
            Value as Amount,
            Date,
            Financial_Year as Period,
            'Third Party Annual Donation' as Type,
            NULL as Receipt_Type
        FROM annual_Third_Party_Donations_Received
        WHERE {where_clause_annual_tp}
        ORDER BY Value DESC
        LIMIT 200
    """
    results_annual_tp = execute_query(sql_annual_tp_received)
    if results_annual_tp['success'] and results_annual_tp['data']:
        all_transactions.extend(results_annual_tp['data'])

    # Calculate summary statistics
    total_amount = sum(t.get('Amount') or 0 for t in all_transactions)
    transaction_count = len(all_transactions)

    # Get unique donors and recipients
    donors = set(t.get('Donor') for t in all_transactions if t.get('Donor'))
    recipients = set(t.get('Recipient') for t in all_transactions if t.get('Recipient'))

    # Sort all transactions by amount (descending) to show most significant first
    all_transactions.sort(key=lambda x: x.get('Amount') or 0, reverse=True)

    return jsonify({
        'success': True,
        'transactions': all_transactions[:200],  # Return up to 200 transactions
        'summary': {
            'total_transactions': transaction_count,
            'total_amount': total_amount,
            'unique_donors': len(donors),
            'unique_recipients': len(recipients)
        }
    })

@app.route('/api/autocomplete')
def autocomplete():
    """Get autocomplete suggestions for donor/recipient names"""
    query = request.args.get('q', '').strip()

    if not query or len(query) < 2:
        return jsonify({'success': True, 'suggestions': []})

    # Use ILIKE for PostgreSQL, LIKE for SQLite
    like_op = 'ILIKE' if USE_POSTGRES else 'LIKE'

    suggestions = []

    # Remove duplicates and limit to 15 suggestions
    seen = set()
    unique_suggestions = []

    # Get unique donor names from election donations
    sql_election_donors = f"""
        SELECT DISTINCT Donor_Name as name
        FROM election_Donor_Donations_Made
        WHERE Donor_Name {like_op} '%{query}%'
        LIMIT 5
    """
    result_election_donors = execute_query(sql_election_donors)
    if result_election_donors['success'] and result_election_donors['data']:
        for r in result_election_donors['data']:
            if r['name'] and r['name'] not in seen:
                seen.add(r['name'])
                unique_suggestions.append({'name': r['name'], 'type': 'Donor'})
                if len(unique_suggestions) >= 15:
                    return jsonify({'success': True, 'suggestions': unique_suggestions})

    # Get unique recipient names from election donations
    sql_election_recipients = f"""
        SELECT DISTINCT Donated_To as name
        FROM election_Donor_Donations_Made
        WHERE Donated_To {like_op} '%{query}%'
        LIMIT 5
    """
    result_election_recipients = execute_query(sql_election_recipients)
    if result_election_recipients['success'] and result_election_recipients['data']:
        for r in result_election_recipients['data']:
            if r['name'] and r['name'] not in seen:
                seen.add(r['name'])
                unique_suggestions.append({'name': r['name'], 'type': 'Recipient'})
                if len(unique_suggestions) >= 15:
                    return jsonify({'success': True, 'suggestions': unique_suggestions})

    # Get unique donor names from annual returns
    sql_annual_donors = f"""
        SELECT DISTINCT Donor_Name as name
        FROM annual_Donations_Made
        WHERE Donor_Name {like_op} '%{query}%'
        LIMIT 5
    """
    result_annual_donors = execute_query(sql_annual_donors)
    if result_annual_donors['success'] and result_annual_donors['data']:
        for r in result_annual_donors['data']:
            if r['name'] and r['name'] not in seen:
                seen.add(r['name'])
                unique_suggestions.append({'name': r['name'], 'type': 'Donor'})
                if len(unique_suggestions) >= 15:
                    return jsonify({'success': True, 'suggestions': unique_suggestions})

    # Get unique recipient names from annual returns
    sql_annual_recipients = f"""
        SELECT DISTINCT Donation_Made_To as name
        FROM annual_Donations_Made
        WHERE Donation_Made_To {like_op} '%{query}%'
        LIMIT 5
    """
    result_annual_recipients = execute_query(sql_annual_recipients)
    if result_annual_recipients['success'] and result_annual_recipients['data']:
        for r in result_annual_recipients['data']:
            if r['name'] and r['name'] not in seen:
                seen.add(r['name'])
                unique_suggestions.append({'name': r['name'], 'type': 'Recipient'})
                if len(unique_suggestions) >= 15:
                    return jsonify({'success': True, 'suggestions': unique_suggestions})

    return jsonify({
        'success': True,
        'suggestions': unique_suggestions
    })

@app.route('/api/explore')
def explore():
    """Explore data with filters"""
    period = request.args.get('period', '2025')
    entity_types = request.args.get('entityTypes', 'parties,independents,third-parties,associated').split(',')
    min_amount = int(request.args.get('minAmount', 0))
    red_flags = request.args.get('redFlags', '').split(',') if request.args.get('redFlags') else []

    # Map period values to database Event/Financial_Year names
    election_periods = {
        '2025': '2025 Federal Election',
        '2022': '2022 Federal election',  # Note: lowercase 'e' in database
        '2019': '2019 Federal election',  # Note: lowercase 'e' in database
        '2016': '2016 Federal election',  # Note: lowercase 'e' in database
        '2013': '2013 Federal election',  # Note: lowercase 'e' in database
        '2010': '2010 Federal election',  # Note: lowercase 'e' in database
        '2007': '2007 Federal Election'
    }

    annual_periods = {
        '2023-24': '2023-24',
        '2022-23': '2022-23',
        '2021-22': '2021-22',
        '2020-21': '2020-21',
        '2019-20': '2019-20'
    }

    # Build base query based on period
    if period in election_periods:
        # Federal Election data
        event_name = election_periods[period]
        sql = f"""
            SELECT
                Donor_Name as Name,
                Donated_To as Recipient,
                Donated_To_Gift_Value as Amount,
                Donated_To_Date_Of_Gift as Date,
                'Donation' as Type
            FROM election_Donor_Donations_Made
            WHERE Event = '{event_name}'
        """

        # Apply amount filter
        if min_amount > 0:
            sql += f" AND Donated_To_Gift_Value >= {min_amount}"

        sql += " ORDER BY Donated_To_Gift_Value DESC LIMIT 100"

    elif period in annual_periods:
        # Annual returns data
        fy = annual_periods[period]
        sql = f"""
            SELECT
                Donor_Name as Name,
                Donation_Made_To as Recipient,
                Value as Amount,
                Date,
                'Annual Donation' as Type
            FROM annual_Donations_Made
            WHERE Financial_Year = '{fy}'
        """

        # Apply amount filter
        if min_amount > 0:
            sql += f" AND Value >= {min_amount}"

        sql += " ORDER BY Value DESC LIMIT 100"

    elif period == 'last-2-years':
        # Last 2 years: combine recent annual returns and elections
        sql = """
            SELECT
                Donor_Name as Name,
                Donation_Made_To as Recipient,
                Value as Amount,
                Date,
                'Annual Donation' as Type
            FROM annual_Donations_Made
            WHERE Financial_Year IN ('2023-24', '2022-23')
        """

        if min_amount > 0:
            sql += f" AND Value >= {min_amount}"

        sql += """
            UNION ALL
            SELECT
                Donor_Name as Name,
                Donated_To as Recipient,
                Donated_To_Gift_Value as Amount,
                Donated_To_Date_Of_Gift as Date,
                'Election Donation' as Type
            FROM election_Donor_Donations_Made
            WHERE Event IN ('2025 Federal Election', '2022 Federal Election')
        """

        if min_amount > 0:
            sql += f" AND Donated_To_Gift_Value >= {min_amount}"

        sql += " ORDER BY Amount DESC LIMIT 100"

    elif period == 'all-time':
        # All time: everything
        sql = """
            SELECT
                Donor_Name as Name,
                Donation_Made_To as Recipient,
                Value as Amount,
                Date,
                'Annual Donation' as Type
            FROM annual_Donations_Made
        """

        if min_amount > 0:
            sql += f" WHERE Value >= {min_amount}"

        sql += """
            UNION ALL
            SELECT
                Donor_Name as Name,
                Donated_To as Recipient,
                Donated_To_Gift_Value as Amount,
                Donated_To_Date_Of_Gift as Date,
                'Election Donation' as Type
            FROM election_Donor_Donations_Made
        """

        if min_amount > 0:
            sql += f" WHERE Donated_To_Gift_Value >= {min_amount}"

        sql += " ORDER BY Amount DESC LIMIT 100"

    else:
        # Default fallback
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
        total_2025_indep = result_2025.get('data', [{}])[0].get('total', 0) if result_2025.get('success') else 0
        total_2025_indep = float(total_2025_indep) if total_2025_indep else 0

        sql_2022_indep = """
            SELECT SUM(Donated_To_Gift_Value) as total
            FROM election_Donor_Donations_Made
            WHERE Event = '2022 Federal Election'
                AND Donated_To NOT IN ('AUSTRALIAN LABOR PARTY', 'LIBERAL PARTY OF AUSTRALIA',
                                       'THE NATIONALS', 'THE GREENS')
        """
        result_2022 = execute_query(sql_2022_indep)
        total_2022_indep = result_2022.get('data', [{}])[0].get('total', 1) if result_2022.get('success') else 1  # Avoid division by zero
        total_2022_indep = float(total_2022_indep) if total_2022_indep else 1

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
        if result_new.get('success') and result_new.get('data'):
            donor = result_new['data'][0]
            donor_name = donor.get('Donor_Name') or donor.get('donor_name')
            total_donated = donor.get('total_donated') or donor.get('Total_Donated') or 0
            total_donated = float(total_donated) if total_donated else 0
            stories.append({
                'title': 'Largest New Donor',
                'description': f'{donor_name} donated ${total_donated:,.0f} in their first appearance',
                'type': 'new_donor',
                'donor': donor_name,
                'amount': total_donated
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
        if result_debt.get('success') and result_debt.get('data'):
            party = result_debt['data'][0]
            party_name = party.get('Name') or party.get('name')
            total_debts = party.get('Total_Debts') or party.get('total_debts') or 0
            total_debts = float(total_debts) if total_debts else 0
            stories.append({
                'title': 'Highest Party Debt',
                'description': f'{party_name} reported ${total_debts:,.0f} in debts for 2023-24',
                'type': 'debt',
                'party': party_name,
                'amount': total_debts
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
        if result_dark.get('success') and result_dark.get('data'):
            entity = result_dark['data'][0]
            entity_name = entity.get('Name') or entity.get('name')
            expenditure = entity.get('Total_Electoral_Expenditure') or entity.get('total_electoral_expenditure') or 0
            expenditure = float(expenditure) if expenditure else 0
            stories.append({
                'title': 'Highest Dark Money Spending',
                'description': f'{entity_name} spent ${expenditure:,.0f} on electoral activities',
                'type': 'dark_money',
                'entity': entity_name,
                'amount': expenditure
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
