#!/usr/bin/env python3
"""
Script to explore all election data CSV files
"""

import csv
import os
from pathlib import Path
from collections import defaultdict

def explore_csv_file(filepath):
    """
    Read and display basic information about a CSV file
    """
    print(f"\n{'='*80}")
    print(f"FILE: {os.path.basename(filepath)}")
    print(f"{'='*80}")

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)

            # Get column names from header
            columns = reader.fieldnames
            print(f"\nColumns: {len(columns)}")
            print(f"\nColumn Names:")
            for i, col in enumerate(columns, 1):
                print(f"  {i}. {col}")

            # Read rows and collect data
            rows = []
            empty_counts = defaultdict(int)

            for row in reader:
                rows.append(row)
                # Count empty values
                for col in columns:
                    if not row[col] or row[col].strip() == '':
                        empty_counts[col] += 1

                # Only keep first 5 rows in memory for display
                if len(rows) > 5:
                    rows.pop(0)

            # Total row count (need to recount since we only kept last 5)
            f.seek(0)
            row_count = sum(1 for _ in f) - 1  # -1 for header

            print(f"\nTotal Rows: {row_count:,}")

            # Display first 5 rows
            print(f"\nFirst 5 rows:")
            f.seek(0)
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if i >= 5:
                    break
                print(f"\nRow {i+1}:")
                for col in columns:
                    value = row[col][:100] if row[col] else ''  # Truncate long values
                    print(f"  {col}: {value}")

            # Missing/empty values
            if empty_counts:
                print(f"\nEmpty/Missing Values:")
                for col, count in sorted(empty_counts.items(), key=lambda x: x[1], reverse=True):
                    if count > 0:
                        percentage = (count / row_count) * 100
                        print(f"  {col}: {count:,} ({percentage:.1f}%)")

    except Exception as e:
        print(f"Error reading file: {e}")

def main():
    """
    Main function to process all CSV files
    """
    # Get all CSV files in current directory
    csv_files = list(Path('.').glob('*.csv'))

    print(f"Found {len(csv_files)} CSV files")
    print("="*80)

    # Process each file
    for csv_file in sorted(csv_files):
        explore_csv_file(csv_file)

    print(f"\n{'='*80}")
    print("Summary Complete")
    print(f"{'='*80}")

if __name__ == "__main__":
    main()
