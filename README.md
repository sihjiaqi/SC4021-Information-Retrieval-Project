# SOSE Search Engine

SOSE (Smartphone Opinion Search Engine) is a high-performance search engine interface built on an Apache Solr backend, designed to search and analyse opinions on popular smartphones. This domain was chosen for its high volume of opinionated data and clear sentiment polarity. SOSE also provides advanced search capabilities including wildcard/fuzzy matching, real-time autocomplete, and deep metric filtering across Sentiment, Subjectivity, Device Type, and Date Range, paired with visual data distribution charts.

## Prerequisites

Before setting up the environment, ensure you have the following installed:

*   **Apache Solr 9.x**: Must be running on `http://localhost:8983`.
*   **Python 3.x**: Required for running the local frontend server and setup scripts.
*   **Python Libraries**: The setup and testing scripts require the `requests` library. Install all dependencies via the provided `requirements.txt`:
    ```bash
    pip install -r requirements.txt
    ```

## Python Scripts & `requests` Usage

The `requests` library is used across two scripts for backend communication:

*   `setup_solr.py`: Uses `requests` to verify the Solr connection (`check_solr_connection`) and to validate that the index is correctly populated (`verify_index`).
*   `test_solr_integration.py`: Uses `requests` to perform integration tests, including verifying Solr search functionality, facets, filters, and the connectivity of the application.

## Solr Configuration & Setup

The project includes a directory named `sose/` which contains the pre-configured Solr configuration for your specific setup.

### 1. Configure the Solr Core
1.  Ensure your Solr instance is running.
2.  The `sose` core is the primary index used by this application.
3.  (Note: Since the `sose` configuration folder is provided, ensure this configuration is active in your Solr instance).

### 2. Indexing Data
To populate the search engine with data, use the provided Python script. This script reads the annotated CSV corpus and posts it to the Solr core in batches.

1.  Ensure your dataset (`corpus_full_annotated.csv`) is in the same directory as the script.
2.  Run the indexing script:
    ```bash
    python setup_solr.py
    ```
    *This will automate the process of connecting to the `sose` core and importing all documents.*

### 3. Verification
After indexing, you can verify that the Solr integration, facets, and filters are working correctly by running the integration test suite:

```bash
python test_solr_integration.py
```

This script validates:

*   Basic Solr search functionality — `test_solr_integration.py`
*   Solr filter queries (e.g., filtering by Positive sentiment) — `test_solr_integration.py`
*   App connectivity to the Solr backend — `test_solr_integration.py`

## Running the Application

The frontend is a static web application served via a lightweight Python server. **Both the frontend server and the Solr server must be running simultaneously for the application to work.**

1.  Ensure your Solr server is running at `http://localhost:8983` (start it via your Solr installation if not already active).
2.  Navigate to the project root directory in your terminal.
3.  Start the local web server:
    ```bash
    python -m http.server
    ```
4.  Open your web browser and navigate to: `http://localhost:8000`

## Key Features

### Autocomplete
Real-time suggestions are driven by the Solr Suggest API. The `fetchSuggestions(query)` function in `app.js` sends an asynchronous request to the Solr endpoint using the `titleSuggester` dictionary. When a user types at least 2 characters, the Suggest API is called with the `suggest.dictionary=titleSuggester` parameter, and the results are displayed in a dropdown list styled via the `.autocomplete-list` class in `styles.css`.

### Partial Matches (Wildcard Search)
Partial matches are handled via wildcard queries. The `buildWildcardQuery(query)` function in `app.js` transforms a standard input string into a wildcard-compatible query by appending the `*` character to query tokens. This allows Solr to match any text beginning with those characters, so users can find results even when entering only a fragment of a title.

### Typo Tolerance (Fuzzy Search)
Typos and spelling errors are handled through fuzzy search combined with a retry logic mechanism, managed by the `searchSolr` function in `app.js` via a `isFuzzyMode` state and `isFuzzyRetry` flag. If an initial search returns no results, the application automatically triggers a fuzzy retry. If that retry is successful (`isFuzzyRetry && totalResults > 0`), `isFuzzyMode` is set to `true`, causing the UI to inform the user they are viewing "similar results" rather than exact matches — effectively masking the original typo.

### Search Result Entries
Each search result entry displays the following attributes at a glance: **Source**, **Date**, **Sentiment**, **Subjectivity**, and **Type**. Additionally, each entry includes a **Show More** toggle that expands to reveal both the original text and the processed text for that document.

### Deep Filtering
Results can be narrowed using the following filters,:

*   **Sentiment**: Filter by Negative, Neutral, or Positive
*   **Subjectivity**: Filter by Objective or Subjective
*   **Entry Type**: Filter by Comment, Story, etc.
*   **Device Type**: Filter by iPhone, Samsung etc.
*   **Date Range**: Filter results between specific "From" and "To" dates

### Advanced Metrics
Interactive pie charts provide overview visualization of the distribution of Sentiment and Subjectivity across the current set of search results, implemented in `app.js`.
