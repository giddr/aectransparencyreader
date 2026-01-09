#!/usr/bin/env python3
"""
Migrate SQLite database to PostgreSQL (Vercel Postgres)

This script:
1. Reads all tables from SQLite database
2. Creates equivalent PostgreSQL tables
3. Migrates all data with proper type conversion
4. Creates indexes for performance
5. Verifies data integrity

Usage:
    python migrate_to_postgres.py

Environment variables required:
    POSTGRES_URL - PostgreSQL connection string from Vercel
"""

import sqlite3
import psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_batch
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database paths
SQLITE_DB = 'election_data.db'
POSTGRES_URL = os.getenv('POSTGRES_URL')

def get_sqlite_connection():
    """Connect to SQLite database"""
    return sqlite3.connect(SQLITE_DB)

def get_postgres_connection():
    """Connect to PostgreSQL database"""
    if not POSTGRES_URL:
        raise ValueError("POSTGRES_URL environment variable not set")
    return psycopg2.connect(POSTGRES_URL)

def sqlite_type_to_postgres(sqlite_type):
    """Convert SQLite type to PostgreSQL type"""
    sqlite_type = sqlite_type.upper()

    type_mapping = {
        'INTEGER': 'BIGINT',
        'REAL': 'DOUBLE PRECISION',
        'TEXT': 'TEXT',
        'BLOB': 'BYTEA',
        'NUMERIC': 'NUMERIC',
        'NULL': 'TEXT'
    }

    # Check for exact matches
    for sqlite, postgres in type_mapping.items():
        if sqlite in sqlite_type:
            return postgres

    # Default to TEXT for unknown types
    return 'TEXT'

def get_sqlite_tables(sqlite_conn):
    """Get list of all tables in SQLite database"""
    cursor = sqlite_conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    return [row[0] for row in cursor.fetchall()]

def get_table_schema(sqlite_conn, table_name):
    """Get schema for a SQLite table"""
    cursor = sqlite_conn.cursor()
    cursor.execute(f"PRAGMA table_info({table_name})")
    return cursor.fetchall()

def create_postgres_table(pg_conn, table_name, schema):
    """Create PostgreSQL table from SQLite schema"""
    cursor = pg_conn.cursor()

    # Drop table if exists
    cursor.execute(sql.SQL("DROP TABLE IF EXISTS {} CASCADE").format(
        sql.Identifier(table_name)
    ))

    # Build CREATE TABLE statement
    columns = []
    for col in schema:
        col_id, col_name, col_type, not_null, default_val, is_pk = col
        pg_type = sqlite_type_to_postgres(col_type)

        col_def = sql.SQL("{} {}").format(
            sql.Identifier(col_name),
            sql.SQL(pg_type)
        )

        columns.append(col_def)

    create_stmt = sql.SQL("CREATE TABLE {} ({})").format(
        sql.Identifier(table_name),
        sql.SQL(", ").join(columns)
    )

    cursor.execute(create_stmt)
    pg_conn.commit()

def migrate_table_data(sqlite_conn, pg_conn, table_name, schema):
    """Migrate data from SQLite table to PostgreSQL"""
    sqlite_cursor = sqlite_conn.cursor()
    pg_cursor = pg_conn.cursor()

    # Get column names
    column_names = [col[1] for col in schema]

    # Get all data from SQLite
    sqlite_cursor.execute(f"SELECT * FROM {table_name}")
    rows = sqlite_cursor.fetchall()

    if not rows:
        print(f"  No data to migrate for {table_name}")
        return 0

    # Prepare INSERT statement
    insert_stmt = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
        sql.Identifier(table_name),
        sql.SQL(", ").join(map(sql.Identifier, column_names)),
        sql.SQL(", ").join(sql.Placeholder() * len(column_names))
    )

    # Insert data in batches
    batch_size = 1000
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        execute_batch(pg_cursor, insert_stmt, batch)
        pg_conn.commit()
        print(f"  Migrated {min(i + batch_size, len(rows)):,} / {len(rows):,} rows")

    return len(rows)

def create_indexes(pg_conn):
    """Create indexes on commonly queried columns"""
    cursor = pg_conn.cursor()

    print("\nCreating indexes...")

    # Index definitions (table, column)
    indexes = [
        # Election tables
        ('election_Donor_Donations_Made', 'Donor_Name'),
        ('election_Donor_Donations_Made', 'Event'),
        ('election_Donor_Donations_Made', 'Donated_To'),
        ('election_Senate_Groups_and_Candidate_Return_Summary', 'Event'),
        ('election_Senate_Groups_and_Candidate_Return_Summary', 'Name'),
        ('election_Senate_Groups_and_Candidate_Return_Summary', 'Party_Name'),

        # Annual tables
        ('annual_Donations_Made', 'Financial_Year'),
        ('annual_Donations_Made', 'Donor_Name'),
        ('annual_Donations_Made', 'Donation_Made_To'),
        ('annual_Party_Returns', 'Financial_Year'),
        ('annual_Party_Returns', 'Name'),
        ('annual_Significant_Third_Party_Returns', 'Financial_Year'),
        ('annual_Significant_Third_Party_Returns', 'Name'),
    ]

    for table_name, column_name in indexes:
        try:
            index_name = f"idx_{table_name}_{column_name}"
            cursor.execute(
                sql.SQL("CREATE INDEX IF NOT EXISTS {} ON {} ({})").format(
                    sql.Identifier(index_name),
                    sql.Identifier(table_name),
                    sql.Identifier(column_name)
                )
            )
            print(f"  Created index: {index_name}")
        except Exception as e:
            print(f"  Warning: Could not create index on {table_name}.{column_name}: {e}")

    pg_conn.commit()

def verify_migration(sqlite_conn, pg_conn, table_name):
    """Verify that data was migrated correctly"""
    sqlite_cursor = sqlite_conn.cursor()
    pg_cursor = pg_conn.cursor()

    # Count rows in both databases
    sqlite_cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    sqlite_count = sqlite_cursor.fetchone()[0]

    pg_cursor.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(
        sql.Identifier(table_name)
    ))
    pg_count = pg_cursor.fetchone()[0]

    if sqlite_count == pg_count:
        print(f"  ✓ Verified: {pg_count:,} rows")
        return True
    else:
        print(f"  ✗ ERROR: SQLite has {sqlite_count:,} rows, PostgreSQL has {pg_count:,} rows")
        return False

def main():
    """Main migration function"""
    print("="*80)
    print("SQLite to PostgreSQL Migration")
    print("="*80)

    if not os.path.exists(SQLITE_DB):
        print(f"ERROR: SQLite database not found at {SQLITE_DB}")
        return

    if not POSTGRES_URL:
        print("ERROR: POSTGRES_URL environment variable not set")
        print("Please set it in .env file or environment")
        return

    print(f"\nSQLite database: {SQLITE_DB}")
    print(f"PostgreSQL URL: {POSTGRES_URL[:30]}...")

    # Connect to databases
    print("\nConnecting to databases...")
    sqlite_conn = get_sqlite_connection()
    pg_conn = get_postgres_connection()
    print("  ✓ Connected")

    # Get list of tables
    print("\nGetting table list...")
    tables = get_sqlite_tables(sqlite_conn)
    print(f"  Found {len(tables)} tables")

    # Migrate each table
    total_rows = 0
    successful_tables = 0

    for i, table_name in enumerate(tables, 1):
        print(f"\n[{i}/{len(tables)}] Migrating: {table_name}")
        print("-" * 80)

        try:
            # Get schema
            schema = get_table_schema(sqlite_conn, table_name)
            print(f"  Columns: {len(schema)}")

            # Create table
            create_postgres_table(pg_conn, table_name, schema)
            print(f"  ✓ Created table")

            # Migrate data
            rows_migrated = migrate_table_data(sqlite_conn, pg_conn, table_name, schema)
            total_rows += rows_migrated

            # Verify
            if verify_migration(sqlite_conn, pg_conn, table_name):
                successful_tables += 1

        except Exception as e:
            print(f"  ✗ ERROR: {e}")

    # Create indexes
    create_indexes(pg_conn)

    # Summary
    print("\n" + "="*80)
    print("Migration Complete!")
    print("="*80)
    print(f"Tables migrated: {successful_tables}/{len(tables)}")
    print(f"Total rows: {total_rows:,}")
    print("\nNext steps:")
    print("1. Update app.py to use PostgreSQL connection")
    print("2. Test all API endpoints")
    print("3. Deploy to Vercel with `vercel --prod`")
    print("="*80)

    # Close connections
    sqlite_conn.close()
    pg_conn.close()

if __name__ == "__main__":
    main()
