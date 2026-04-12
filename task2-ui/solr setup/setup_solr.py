#!/usr/bin/env python3
"""
Setup script to index corpus_full_annotated.csv into Apache Solr.
Configures the schema and loads all documents into the 'sose' core.
"""

import csv
import json
import requests
import sys
from pathlib import Path

SOLR_BASE_URL = "http://localhost:8983/solr/sose"
CSV_FILE = Path(__file__).parent / "corpus_full_annotated.csv"
BATCH_SIZE = 500


def check_solr_connection():
    """Verify Solr is running and the core exists."""
    try:
        response = requests.get(f"{SOLR_BASE_URL}/admin/ping", timeout=5)
        if response.status_code == 200:
            print("[OK] Solr is running and core 'sose' is accessible")
            return True
    except Exception as e:
        print(f"[ERROR] Failed to connect to Solr: {e}")
        print(f"  Make sure Solr is running at http://localhost:8983")
        return False


def index_csv():
    """Read CSV and index documents into Solr in batches."""
    if not CSV_FILE.exists():
        print(f"✗ CSV file not found: {CSV_FILE}")
        return False

    print(f"\nIndexing {CSV_FILE.name}...")
    documents = []
    skipped = 0
    total = 0

    try:
        with open(CSV_FILE, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)

            for row in reader:
                total += 1

                # Skip rows without doc_id
                if not row.get('doc_id', '').strip():
                    skipped += 1
                    continue

                # Build document with all CSV columns
                doc = {
                    'doc_id': row.get('doc_id', '').strip(),
                    'title': row.get('title', '').strip(),
                    'text': row.get('text', '').strip(),
                    'text_no_title': row.get('text_no_title', '').strip(),
                    'text_ml': row.get('text_ml', '').strip(),
                    'text_transformer': row.get('text_transformer', '').strip(),
                    'label_sentiment': row.get('label_sentiment', '').strip() or None,
                    'label_subjectivity': row.get('label_subjectivity', '').strip() or None,
                    'device': row.get('device', '').strip() or None,
                    'created_at': row.get('created_at', '').strip() or None,
                    'author': row.get('author', '').strip() or None,
                    'source_url': row.get('source_url', '').strip() or None,
                    'item_type': row.get('item_type', '').strip() or None,
                    'score_val': float(row.get('score', 0)) if row.get('score', '').strip() else None,
                    'query': row.get('query', '').strip() or None,
                    'tags': row.get('tags', '').strip() or None,
                    'deleted': row.get('deleted', '').strip() or None,
                    'descendants': int(row.get('descendants', 0)) if row.get('descendants', '').strip() else None,
                }

                # Remove None values
                doc = {k: v for k, v in doc.items() if v is not None}
                documents.append(doc)

                # Index in batches
                if len(documents) >= BATCH_SIZE:
                    if not post_batch(documents):
                        return False
                    documents = []

        # Index remaining documents
        if documents:
            if not post_batch(documents):
                return False

        indexed = total - skipped
        print(f"[OK] Indexed {indexed:,} documents ({skipped} skipped)")
        return True

    except Exception as e:
        print(f"[ERROR] Error reading CSV: {e}")
        return False


def post_batch(documents):
    """Post a batch of documents to Solr."""
    try:
        response = requests.post(
            f"{SOLR_BASE_URL}/update?commit=true",
            json=documents,
            headers={"Content-Type": "application/json"},
            timeout=30
        )

        if response.status_code != 200:
            print(f"[ERROR] Solr error (status {response.status_code}): {response.text}")
            return False

        result = response.json()
        if result.get('responseHeader', {}).get('status') != 0:
            print(f"[ERROR] Solr error: {result}")
            return False

        return True

    except Exception as e:
        print(f"[ERROR] Failed to post batch to Solr: {e}")
        return False


def verify_index():
    """Check that documents were indexed."""
    try:
        response = requests.get(
            f"{SOLR_BASE_URL}/select?q=*:*&rows=0",
            timeout=5
        )

        if response.status_code == 200:
            result = response.json()
            count = result.get('response', {}).get('numFound', 0)
            print(f"[OK] Index contains {count:,} documents")
            return True
        else:
            print(f"[ERROR] Failed to verify index: {response.status_code}")
            return False

    except Exception as e:
        print(f"[ERROR] Failed to verify index: {e}")
        return False


def main():
    print("=" * 60)
    print("Apache Solr Setup for SOSE Search Engine")
    print("=" * 60)

    # Check Solr connection
    if not check_solr_connection():
        sys.exit(1)

    # Index CSV
    if not index_csv():
        sys.exit(1)

    # Verify
    if not verify_index():
        sys.exit(1)

    print("\n" + "=" * 60)
    print("[OK] Setup complete!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Start the app: python -m http.server 8000")
    print("2. Open http://localhost:8000 in your browser")
    print("3. Search queries now use Solr instead of CSV")


if __name__ == "__main__":
    main()
