#!/usr/bin/env python3
"""
Import all election and annual data CSV files into SQLite database
"""

import sqlite3
import csv
import os
from pathlib import Path

def clean_column_name(name):
    """
    Clean column names to be SQL-friendly
    """
    # Replace special characters with underscores
    cleaned = name.strip()
    cleaned = cleaned.replace(' ', '_')
    cleaned = cleaned.replace('(', '')
    cleaned = cleaned.replace(')', '')
    cleaned = cleaned.replace('/', '_')
    cleaned = cleaned.replace('-', '_')
    cleaned = cleaned.replace('.', '_')
    cleaned = cleaned.replace(',', '')
    cleaned = cleaned.replace("'", '')

    # Remove multiple consecutive underscores
    while '__' in cleaned:
        cleaned = cleaned.replace('__', '_')

    # Remove leading/trailing underscores
    cleaned = cleaned.strip('_')

    return cleaned

def infer_column_type(values):
    """
    Infer the SQL column type from sample values
    """
    # Remove empty values
    non_empty = [v for v in values if v and v.strip()]

    if not non_empty:
        return 'TEXT'

    # Try integer
    try:
        for v in non_empty[:100]:  # Check first 100 non-empty values
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

def import_csv_to_sqlite(csv_path, db_conn, table_name):
    """
    Import a CSV file into SQLite database
    """
    print(f"\nImporting: {os.path.basename(csv_path)}")
    print(f"Table name: {table_name}")

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        # Get columns and clean names
        original_columns = reader.fieldnames
        cleaned_columns = [clean_column_name(col) for col in original_columns]

        # Read all rows to infer types
        rows = list(reader)

        if not rows:
            print(f"  Warning: No data in {csv_path}")
            return

        # Infer column types
        column_types = {}
        for orig_col, clean_col in zip(original_columns, cleaned_columns):
            values = [row[orig_col] for row in rows]
            col_type = infer_column_type(values)
            column_types[clean_col] = col_type

        # Create table
        cursor = db_conn.cursor()

        # Drop table if exists
        cursor.execute(f"DROP TABLE IF EXISTS {table_name}")

        # Create table with inferred types
        columns_sql = ', '.join([f'"{col}" {column_types[col]}' for col in cleaned_columns])
        create_table_sql = f"CREATE TABLE {table_name} ({columns_sql})"
        cursor.execute(create_table_sql)

        print(f"  Created table with {len(cleaned_columns)} columns")

        # Insert data
        placeholders = ', '.join(['?' for _ in cleaned_columns])
        insert_sql = f"INSERT INTO {table_name} VALUES ({placeholders})"

        # Prepare data for insertion
        data_to_insert = []
        for row in rows:
            row_data = []
            for orig_col, clean_col in zip(original_columns, cleaned_columns):
                value = row[orig_col]
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
        db_conn.commit()

        print(f"  Inserted {len(data_to_insert):,} rows")

        return len(data_to_insert)

def main():
    """
    Main function to import all CSV files
    """
    # Database path
    db_path = 'election_data.db'

    print(f"Creating SQLite database: {db_path}")
    print("="*80)

    # Connect to database
    conn = sqlite3.connect(db_path)

    # Define directories and their table prefixes
    data_sources = [
        ('/Users/gideondavidsonreisner/Downloads/AllElectionsData', 'election'),
        ('/Users/gideondavidsonreisner/Downloads/AllAnnualData', 'annual')
    ]

    total_tables = 0
    total_rows = 0

    for directory, prefix in data_sources:
        print(f"\n{'='*80}")
        print(f"Processing: {os.path.basename(directory)}")
        print(f"{'='*80}")

        # Get all CSV files
        csv_files = sorted(Path(directory).glob('*.csv'))

        for csv_file in csv_files:
            # Create table name from filename
            base_name = csv_file.stem
            table_name = f"{prefix}_{clean_column_name(base_name)}"

            try:
                rows_imported = import_csv_to_sqlite(csv_file, conn, table_name)
                total_tables += 1
                total_rows += rows_imported if rows_imported else 0
            except Exception as e:
                print(f"  ERROR: {e}")

    # Create some useful indexes
    print(f"\n{'='*80}")
    print("Creating indexes...")
    print(f"{'='*80}")

    cursor = conn.cursor()

    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()

    for (table_name,) in tables:
        # Get columns for this table
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()

        # Create index on common columns if they exist
        common_index_cols = ['Financial_Year', 'Event', 'Name', 'Date', 'Donor_Name', 'Party_Name']

        for col_info in columns:
            col_name = col_info[1]
            if col_name in common_index_cols:
                index_name = f"idx_{table_name}_{col_name}"
                try:
                    cursor.execute(f"CREATE INDEX {index_name} ON {table_name}({col_name})")
                    print(f"  Created index: {index_name}")
                except Exception as e:
                    pass  # Index might already exist or error

    conn.commit()

    # Summary
    print(f"\n{'='*80}")
    print("Import Complete!")
    print(f"{'='*80}")
    print(f"Database: {db_path}")
    print(f"Total tables created: {total_tables}")
    print(f"Total rows imported: {total_rows:,}")

    # Show table list
    print(f"\n{'='*80}")
    print("Tables in database:")
    print(f"{'='*80}")

    cursor.execute("""
        SELECT name,
               (SELECT COUNT(*) FROM sqlite_master sm2
                WHERE sm2.type='table' AND sm2.name=sm1.name) as cnt
        FROM sqlite_master sm1
        WHERE type='table'
        ORDER BY name
    """)

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    for i, (table_name,) in enumerate(cursor.fetchall(), 1):
        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
        row_count = cursor.fetchone()[0]
        print(f"{i:2d}. {table_name:50s} ({row_count:>8,} rows)")

    conn.close()

    print(f"\n{'='*80}")
    print(f"Database ready! You can now query it with:")
    print(f"  sqlite3 {db_path}")
    print(f"{'='*80}")

if __name__ == "__main__":
    main()
