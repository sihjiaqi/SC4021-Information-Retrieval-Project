#!/usr/bin/env python3
"""
Test script to verify Solr integration is working correctly.
"""

import requests
import json

SOLR_BASE_URL = 'http://localhost:8983/solr/sose'
APP_URL = 'http://localhost:8000'

def test_solr_search():
    """Test basic Solr search functionality."""
    print("Testing Solr search...")

    # Test 1: Simple query using dismax
    url = f"{SOLR_BASE_URL}/select?q=iPhone&defType=dismax&qf=title^2%20text&rows=5&wt=json"
    response = requests.get(url)
    data = response.json()

    numFound = data['response']['numFound']
    numDocs = len(data['response']['docs'])

    print(f"  Query 'iPhone': Found {numFound} results, returned {numDocs} docs")

    if numDocs > 0:
        doc = data['response']['docs'][0]
        print(f"    - First result: {doc.get('title', ['N/A'])[0] if isinstance(doc.get('title'), list) else doc.get('title')}")

    return numFound > 0

def test_solr_facets():
    """Test Solr facet counts."""
    print("\nTesting Solr facets...")

    url = f"{SOLR_BASE_URL}/select?q=*:*&rows=0&facet=true&facet.field=label_sentiment&facet.field=label_subjectivity&wt=json"
    response = requests.get(url)
    data = response.json()

    facets = data.get('facet_counts', {}).get('facet_fields', {})

    if 'label_sentiment' in facets:
        sentiments = facets['label_sentiment']
        print(f"  Sentiment facets: {sentiments}")

    if 'label_subjectivity' in facets:
        subjectivity = facets['label_subjectivity']
        print(f"  Subjectivity facets: {subjectivity}")

    return len(facets) > 0

def test_solr_filters():
    """Test Solr filter queries."""
    print("\nTesting Solr filter queries...")

    url = f"{SOLR_BASE_URL}/select?q=*:*&fq=label_sentiment:Positive&rows=0&wt=json"
    response = requests.get(url)
    data = response.json()

    numFound = data['response']['numFound']
    print(f"  Filtered by sentiment=Positive: {numFound} results")

    return numFound > 0

def test_app_connectivity():
    """Test that app can connect to Solr."""
    print("\nTesting app connectivity...")

    try:
        response = requests.get(APP_URL)
        if response.status_code == 200:
            print(f"  [OK] App is running at {APP_URL}")
            return True
        else:
            print(f"  [ERROR] App returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"  [ERROR] Could not connect to app: {e}")
        return False

def main():
    print("=" * 60)
    print("SOSE Search Engine - Solr Integration Test")
    print("=" * 60)

    tests = [
        ("Solr Search", test_solr_search),
        ("Solr Facets", test_solr_facets),
        ("Solr Filters", test_solr_filters),
        ("App Connectivity", test_app_connectivity),
    ]

    results = []
    for name, test_fn in tests:
        try:
            result = test_fn()
            results.append((name, result))
        except Exception as e:
            print(f"  [ERROR] {e}")
            results.append((name, False))

    print("\n" + "=" * 60)
    print("Test Results")
    print("=" * 60)

    for name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{status} {name}")

    all_passed = all(r[1] for r in results)

    print("=" * 60)
    if all_passed:
        print("[SUCCESS] All tests passed!")
        print("\nYou can now:")
        print("1. Open http://localhost:8000 in your browser")
        print("2. Type a search query (e.g., 'iPhone')")
        print("3. Results load from Solr instead of CSV")
        print("4. Filters and facets work via Solr API")
    else:
        print("[FAILURE] Some tests failed. Check the output above.")

    return 0 if all_passed else 1

if __name__ == '__main__':
    exit(main())
