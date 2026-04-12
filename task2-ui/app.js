// Solr Configuration
const SOLR_BASE_URL = 'http://localhost:8983/solr/sose';
const ENTRIES_PER_PAGE = 20;

// Global State
let currentQuery = '';
let solrResults = [];
let solrFacets = {};
let totalResults = 0;
let currentPage = 0;
let currentEntry = null;
let isFuzzyMode = false;

// Filter State
let activeFilters = {
  sentiment: [],
  subjectivity: [],
  device: [],
  type: [],
  dateFrom: null,
  dateTo: null
};

// Metrics State
let metricsVisible = false;
let sentimentChart = null;
let subjectivityChart = null;

// Initialize app
async function init() {
  try {
    setupEventListeners();
    populateDeviceFilter();

    // Load initial results (all documents)
    currentPage = 0;
    currentQuery = '';
    const success = await searchSolr('', 0);

    if (success) {
      document.getElementById('entryList').innerHTML = '';
      loadMoreEntries();
    }
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
}

// Build wildcard query by appending * to each token
function buildWildcardQuery(query) {
  if (!query.trim()) return '';
  return query.trim().split(/\s+/)
    .filter(t => t.length >= 2)
    .map(t => t.endsWith('*') ? t : `${t}*`)
    .join(' ');
}

// Build fuzzy query by appending ~ to each token
function buildFuzzyQuery(query) {
  if (!query.trim()) return '';
  return query.trim().split(/\s+/)
    .filter(t => t.length >= 3)
    .map(t => `${t}~`)
    .join(' ');
}

// Populate device filter with predefined values
function populateDeviceFilter() {
  const devices = [
    'iPhone 15',
    'iPhone 14',
    'iPhone 13',
    'Galaxy S24',
    'Galaxy S23',
    'Galaxy S22',
    'Galaxy S21',
    'OnePlus 12',
    'Xiaomi 14',
    'iPhone 17',
    'iPhone 17 Pro',
    'iPhone 17 Pro Max',
    'Xiaomi 15 Ultra',
    'Xiaomi 14 Ultra',
    'Galaxy Z Fold5',
    'Galaxy Z Flip5',
    'Galaxy S24 Ultra',
    'Galaxy S22 Ultra',
    'OnePlus 13',
    'iPhone 15 Pro',
    'iPhone 14 Pro Max',
    'iPhone 13 Pro',
    'iPhone 13 Pro Max',
    'iPhone 15 Pro Max',
    'Galaxy S21 Ultra',
    'iPhone 14 Pro',
    'Xiaomi 15',
    'Galaxy S23 Ultra',
    'Pixel 8',
    'Pixel 7',
    'Pixel 6'
  ].sort();

  const deviceSelect = document.getElementById('deviceFilter');
  if (!deviceSelect) {
    console.error('Device filter select element not found!');
    return;
  }

  devices.forEach(device => {
    const option = document.createElement('option');
    option.value = device;
    option.textContent = device;
    deviceSelect.appendChild(option);
  });
}

// Query Solr and get results
async function searchSolr(query, page = 0, isFuzzyRetry = false) {
  try {
    // Build filter queries
    const filterQueries = [];

    if (activeFilters.sentiment.length > 0) {
      const sentiments = activeFilters.sentiment.map(s => `"${s}"`).join(' OR ');
      filterQueries.push(`label_sentiment:(${sentiments})`);
    }

    if (activeFilters.subjectivity.length > 0) {
      filterQueries.push(`label_subjectivity:"${activeFilters.subjectivity[0]}"`);
    }

    if (activeFilters.device.length > 0) {
      const devices = activeFilters.device.map(d => `"${d}"`).join(' OR ');
      filterQueries.push(`device:(${devices})`);
    }

    if (activeFilters.type.length > 0) {
      filterQueries.push(`item_type:"${activeFilters.type[0]}"`);
    }

    if (activeFilters.dateFrom || activeFilters.dateTo) {
      const dateFrom = activeFilters.dateFrom || '*';
      const dateTo = activeFilters.dateTo || '*';
      filterQueries.push(`created_at:[${dateFrom} TO ${dateTo}]`);
    }

    // Build Solr URL
    let url = `${SOLR_BASE_URL}/select?`;

    // Query - search in title and text, boost title using edismax parser
    if (query.trim()) {
      let processedQuery = isFuzzyRetry ? buildFuzzyQuery(query) : buildWildcardQuery(query);
      const encodedQuery = encodeURIComponent(processedQuery);
      url += `q=${encodedQuery}&defType=edismax&qf=title^2 text`;
    } else {
      url += `q=*:*`;
    }

    // Pagination
    const start = page * ENTRIES_PER_PAGE;
    url += `&start=${start}&rows=${ENTRIES_PER_PAGE}`;

    // Filter queries
    filterQueries.forEach(fq => {
      url += `&fq=${encodeURIComponent(fq)}`;
    });

    // Facets for metrics
    url += `&facet=true&facet.field=label_sentiment&facet.field=label_subjectivity&facet.field=device`;

    // Response format
    url += `&wt=json`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.response) {
      solrResults = data.response.docs || [];
      totalResults = data.response.numFound || 0;

      // Store facets for charts
      if (data.facet_counts && data.facet_counts.facet_fields) {
        solrFacets = data.facet_counts.facet_fields;
      }

      // Fuzzy fallback: if no results and not already a fuzzy retry, try fuzzy search
      if (totalResults === 0 && !isFuzzyRetry && query.trim()) {
        console.log('No wildcard results found, retrying with fuzzy search...');
        isFuzzyMode = true;
        return await searchSolr(query, page, true);
      }

      // If this is a fuzzy retry and we got results, set fuzzy mode flag
      if (isFuzzyRetry && totalResults > 0) {
        isFuzzyMode = true;
      } else if (!isFuzzyRetry) {
        isFuzzyMode = false;
      }
    }

    return true;
  } catch (error) {
    console.error('Solr search error:', error);
    solrResults = [];
    totalResults = 0;
    solrFacets = {};
    isFuzzyMode = false;
    return false;
  }
}

// Debounce helper
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Fetch autocomplete suggestions from Solr Suggest API
async function fetchSuggestions(query) {
  if (!query || query.trim().length < 2) {
    hideAutocomplete();
    return;
  }
  try {
    const url = `${SOLR_BASE_URL}/suggest?suggest=true&suggest.dictionary=titleSuggester&suggest.q=${encodeURIComponent(query)}&wt=json`;
    const response = await fetch(url);
    const data = await response.json();

    const suggesterData = data?.suggest?.titleSuggester;
    const key = Object.keys(suggesterData || {})[0];
    const suggestions = suggesterData?.[key]?.suggestions || [];

    // Convert HTML bold tags to highlights, deduplicate, limit to 3
    const seen = new Set();
    const unique = [];
    for (const s of suggestions) {
      const plain = s.term.replace(/<\/?b>/g, '').trim();
      if (!seen.has(plain)) {
        seen.add(plain);

        // Convert <b> tags to highlighted spans safely
        const html = s.term
          .replace(/<b>/g, '\x00OPEN\x00')
          .replace(/<\/b>/g, '\x00CLOSE\x00')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\x00OPEN\x00/g, '<span class="autocomplete-highlight">')
          .replace(/\x00CLOSE\x00/g, '</span>');

        unique.push({ html, plain });
      }
      if (unique.length === 3) break;
    }

    renderAutocomplete(unique);
  } catch (e) {
    hideAutocomplete();
  }
}

// Render autocomplete dropdown
function renderAutocomplete(suggestions) {
  const list = document.getElementById('autocompleteList');
  list.innerHTML = '';

  if (suggestions.length === 0) {
    hideAutocomplete();
    return;
  }

  suggestions.forEach(({ html, plain }) => {
    const li = document.createElement('li');
    li.className = 'autocomplete-item';
    li.innerHTML = html;
    li.addEventListener('mousedown', (e) => {
      // mousedown fires before blur so we can safely set the value
      e.preventDefault();
      document.getElementById('searchInput').value = plain;
      hideAutocomplete();
      handleSearch();
    });
    list.appendChild(li);
  });

  list.classList.add('visible');
}

// Hide autocomplete dropdown
function hideAutocomplete() {
  const list = document.getElementById('autocompleteList');
  list.classList.remove('visible');
  list.innerHTML = '';
}

// Setup event listeners
function setupEventListeners() {
  const searchBtn = document.getElementById('searchBtn');
  const filterBtn = document.getElementById('filterBtn');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  const backBtn = document.getElementById('backBtn');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const applyFilterBtn = document.getElementById('applyFilterBtn');
  const clearFilterBtn = document.getElementById('clearFilterBtn');
  const metricsBtn = document.getElementById('metricsBtn');
  const searchInput = document.getElementById('searchInput');

  const debouncedSuggest = debounce((value) => fetchSuggestions(value), 250);

  searchInput.addEventListener('input', (e) => {
    debouncedSuggest(e.target.value);
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      hideAutocomplete();
      handleSearch();
    }
  });

  searchInput.addEventListener('blur', () => {
    // Small delay so mousedown on item fires first
    setTimeout(hideAutocomplete, 150);
  });

  searchBtn.addEventListener('click', () => {
    hideAutocomplete();
    handleSearch();
  });
  filterBtn.addEventListener('click', openFilterModal);
  modalCloseBtn.addEventListener('click', closeFilterModal);
  applyFilterBtn.addEventListener('click', applyFilters);
  clearFilterBtn.addEventListener('click', clearFilters);
  loadMoreBtn.addEventListener('click', loadMoreEntries);
  backBtn.addEventListener('click', showListPage);
  metricsBtn.addEventListener('click', toggleMetrics);
}

// Handle search - query Solr and load first page
async function handleSearch() {
  const searchInput = document.getElementById('searchInput');
  currentQuery = searchInput.value.trim();
  currentPage = 0;

  const success = await searchSolr(currentQuery, 0);

  if (success) {
    document.getElementById('entryList').innerHTML = '';

    // Show/hide fuzzy notice
    const fuzzyNotice = document.getElementById('fuzzyNotice');
    if (isFuzzyMode && currentQuery.trim()) {
      fuzzyNotice.style.display = 'block';
    } else {
      fuzzyNotice.style.display = 'none';
    }

    loadMoreEntries();

    // Update charts if metrics panel is visible
    if (metricsVisible) {
      renderCharts();
    }
  }
}

// Load more entries (pagination via Solr)
async function loadMoreEntries() {
  const success = await searchSolr(currentQuery, currentPage);

  if (success && solrResults.length > 0) {
    const entryList = document.getElementById('entryList');
    solrResults.forEach(entry => {
      const cell = createEntryCell(entry);
      entryList.appendChild(cell);
    });

    currentPage++;

    // Show/hide load more button
    const hasMore = currentPage * ENTRIES_PER_PAGE < totalResults;
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    if (hasMore) {
      loadMoreContainer.style.display = 'flex';
    } else {
      loadMoreContainer.style.display = 'none';
    }
  } else if (solrResults.length === 0 && currentPage === 0) {
    // No results
    document.getElementById('entryList').innerHTML = '<p style="padding: 20px; text-align: center; color: var(--color-text-secondary);">No results found</p>';
    document.getElementById('loadMoreContainer').style.display = 'none';
  }
}

// Build bubbles for an entry
function buildBubbles(entry) {
  const bubblesContainer = document.createElement('div');
  bubblesContainer.className = 'entry-bubbles';

  // Source URL bubble
  const sourceUrl = Array.isArray(entry.source_url) ? entry.source_url[0] : entry.source_url;
  if (sourceUrl) {
    let domain = sourceUrl;
    try {
      domain = new URL(sourceUrl).hostname.replace(/^www\./, '');
      domain = domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch (e) { /* keep raw value if URL is malformed */ }
    const urlBubble = document.createElement('div');
    urlBubble.className = 'entry-bubble entry-bubble--link-blue';
    urlBubble.innerHTML = `<a href="${sourceUrl}" target="_blank">${domain}</a>`;
    bubblesContainer.appendChild(urlBubble);
  }

  // Created at bubble
  const createdAt = Array.isArray(entry.created_at) ? entry.created_at[0] : entry.created_at;
  if (createdAt) {
    const datePart = createdAt.split(' ')[0];
    let formattedDate = datePart;
    if (datePart.includes('-')) {
      const [year, month, day] = datePart.split('-');
      formattedDate = `${day}/${month}/${year}`;
    } else if (datePart.includes('/')) {
      formattedDate = datePart;
    }
    const dateBubble = document.createElement('div');
    dateBubble.className = 'entry-bubble';
    dateBubble.innerHTML = `<span class="entry-bubble-value">${formattedDate}</span>`;
    bubblesContainer.appendChild(dateBubble);
  }

  // Subjectivity bubble
  const labelSubjectivity = Array.isArray(entry.label_subjectivity) ? entry.label_subjectivity[0] : entry.label_subjectivity;
  if (labelSubjectivity) {
    const subjBubble = document.createElement('div');
    const subj = labelSubjectivity.toLowerCase();
    subjBubble.className = 'entry-bubble entry-bubble--' + (subj === 'objective' ? 'yellow' : 'purple');
    subjBubble.innerHTML = `<span class="entry-bubble-value">${labelSubjectivity}</span>`;
    bubblesContainer.appendChild(subjBubble);
  }

  // Sentiment bubble
  const labelSentiment = Array.isArray(entry.label_sentiment) ? entry.label_sentiment[0] : entry.label_sentiment;
  if (labelSentiment) {
    const sentBubble = document.createElement('div');
    const sent = labelSentiment.toLowerCase();
    const sentColor = sent === 'positive' ? 'green' : sent === 'negative' ? 'red' : 'grey';
    sentBubble.className = 'entry-bubble entry-bubble--' + sentColor;
    sentBubble.innerHTML = `<span class="entry-bubble-value">${labelSentiment}</span>`;
    bubblesContainer.appendChild(sentBubble);
  }

  // Item type bubble
  const itemType = Array.isArray(entry.item_type) ? entry.item_type[0] : entry.item_type;
  if (itemType) {
    const typeBubble = document.createElement('div');
    typeBubble.className = 'entry-bubble';
    const capitalizedType = itemType.charAt(0).toUpperCase() + itemType.slice(1);
    typeBubble.innerHTML = `<span class="entry-bubble-label">Type:</span><span class="entry-bubble-value">${capitalizedType}</span>`;
    bubblesContainer.appendChild(typeBubble);
  }

  return bubblesContainer;
}

// Create entry cell
function createEntryCell(entry) {
  const cell = document.createElement('div');
  cell.className = 'entry-cell';

  const title = document.createElement('div');
  title.className = 'entry-title';
  const titleStr2 = Array.isArray(entry.title) ? entry.title[0] : entry.title;
  title.textContent = titleStr2 || 'Untitled';

  const text = document.createElement('div');
  text.className = 'entry-text';
  let bodyText = (Array.isArray(entry.text_no_title) ? entry.text_no_title[0] : entry.text_no_title) ||
                 (Array.isArray(entry.text) ? entry.text[0] : entry.text) || '';
  const titleStr = Array.isArray(entry.title) ? entry.title[0] : entry.title;
  const entryTitle = (titleStr || '').trim();
  if (entryTitle && bodyText.length > entryTitle.length * 0.8) {
    // Normalize unicode and compare (handles ½ vs 1⁄2 differences)
    const normalizeForCompare = (s) => (s || '').normalize('NFKD').toLowerCase();
    const bodyNorm = normalizeForCompare(bodyText);
    const titleNorm = normalizeForCompare(entryTitle);

    if (bodyNorm.startsWith(titleNorm)) {
      // Find where the title + following whitespace ends by tracking normalized position
      let normalizedIdx = titleNorm.length;
      // Skip whitespace and newlines in the normalized string
      while (normalizedIdx < bodyNorm.length && /[\s]/.test(bodyNorm[normalizedIdx])) {
        normalizedIdx++;
      }

      // Convert normalized position back to original string position
      let origIdx = 0;
      let normIdx = 0;
      while (origIdx < bodyText.length && normIdx < normalizedIdx) {
        const char = bodyText[origIdx];
        const normalized = normalizeForCompare(char);
        normIdx += normalized.length;
        origIdx++;
      }

      bodyText = bodyText.substring(origIdx).trim();
    }
  }
  text.textContent = bodyText;

  const bubblesContainer = buildBubbles(entry);

  const showMoreBtn = document.createElement('button');
  showMoreBtn.className = 'entry-show-more';
  showMoreBtn.textContent = 'Show More';
  showMoreBtn.addEventListener('click', () => showDetailPage(entry));

  cell.appendChild(title);
  cell.appendChild(text);
  cell.appendChild(bubblesContainer);
  cell.appendChild(showMoreBtn);

  return cell;
}

// Show detail page
function showDetailPage(entry) {
  currentEntry = entry;

  const titleStr3 = Array.isArray(entry.title) ? entry.title[0] : entry.title;
  document.getElementById('detailTitle').textContent = titleStr3 || 'Untitled';

  const detailBubbles = document.getElementById('detailBubbles');
  detailBubbles.innerHTML = '';
  const bubblesContainer = buildBubbles(entry);
  detailBubbles.appendChild(bubblesContainer);

  let detailText = (Array.isArray(entry.text) ? entry.text[0] : entry.text) || '';
  const titleStr = Array.isArray(entry.title) ? entry.title[0] : entry.title;
  const detailTitle = (titleStr || '').trim();
  if (detailTitle && detailText.length > detailTitle.length * 0.8) {
    // Normalize unicode and compare (handles ½ vs 1⁄2 differences)
    const normalizeForCompare = (s) => (s || '').normalize('NFKD').toLowerCase();
    const detailTextNorm = normalizeForCompare(detailText);
    const detailTitleNorm = normalizeForCompare(detailTitle);

    if (detailTextNorm.startsWith(detailTitleNorm)) {
      // Find where the title + following whitespace ends by tracking normalized position
      let normalizedIdx = detailTitleNorm.length;
      // Skip whitespace and newlines in the normalized string
      while (normalizedIdx < detailTextNorm.length && /[\s]/.test(detailTextNorm[normalizedIdx])) {
        normalizedIdx++;
      }

      // Convert normalized position back to original string position
      let origIdx = 0;
      let normIdx = 0;
      while (origIdx < detailText.length && normIdx < normalizedIdx) {
        const char = detailText[origIdx];
        const normalized = normalizeForCompare(char);
        normIdx += normalized.length;
        origIdx++;
      }

      detailText = detailText.substring(origIdx).trim();
    }
  }
  document.getElementById('detailOriginalText').textContent = detailText;
  const textMl = (Array.isArray(entry.text_ml) ? entry.text_ml[0] : entry.text_ml) || '';
  document.getElementById('detailProcessedText').textContent = textMl;

  document.getElementById('mainView').style.display = 'none';
  document.getElementById('detailView').classList.add('active');
}

// Show list page
function showListPage() {
  currentEntry = null;
  document.getElementById('mainView').style.display = 'block';
  document.getElementById('detailView').classList.remove('active');
}

// Open filter modal
function openFilterModal() {
  const modal = document.getElementById('filterModal');
  modal.classList.add('active');
}

// Close filter modal
function closeFilterModal() {
  const modal = document.getElementById('filterModal');
  modal.classList.remove('active');
}

// Apply filters
function applyFilters() {
  const sentimentSelect = document.getElementById('sentimentFilter');
  activeFilters.sentiment = Array.from(sentimentSelect.selectedOptions).map(opt => opt.value);

  const subjectivitySelect = document.getElementById('subjectivityFilter');
  activeFilters.subjectivity = subjectivitySelect.value ? [subjectivitySelect.value] : [];

  const deviceSelect = document.getElementById('deviceFilter');
  activeFilters.device = Array.from(deviceSelect.selectedOptions).map(opt => opt.value);

  const typeSelect = document.getElementById('typeFilter');
  activeFilters.type = typeSelect.value ? [typeSelect.value] : [];

  activeFilters.dateFrom = document.getElementById('dateFrom').value || null;
  activeFilters.dateTo = document.getElementById('dateTo').value || null;

  closeFilterModal();
  renderFilterBubbles();
  handleSearch();
}

// Clear filters
function clearFilters() {
  activeFilters = {
    sentiment: [],
    subjectivity: [],
    device: [],
    type: [],
    dateFrom: null,
    dateTo: null
  };

  document.getElementById('sentimentFilter').selectedIndex = -1;
  document.getElementById('subjectivityFilter').value = '';
  document.getElementById('deviceFilter').selectedIndex = -1;
  document.getElementById('typeFilter').value = '';
  document.getElementById('dateFrom').value = '';
  document.getElementById('dateTo').value = '';

  closeFilterModal();
  renderFilterBubbles();
  handleSearch();
}

// Render filter bubbles
function renderFilterBubbles() {
  const bubblesContainer = document.getElementById('activeFilterBubbles');
  bubblesContainer.innerHTML = '';

  if (activeFilters.sentiment.length > 0) {
    activeFilters.sentiment.forEach((sentimentValue, index) => {
      const sentimentBubble = document.createElement('div');
      const sentimentClass = sentimentValue.toLowerCase() === 'positive' ? '--sentiment-positive' :
                            sentimentValue.toLowerCase() === 'negative' ? '--sentiment-negative' :
                            '--sentiment-neutral';
      sentimentBubble.className = `active-filter-bubble active-filter-bubble${sentimentClass}`;
      sentimentBubble.textContent = sentimentValue;
      sentimentBubble.addEventListener('click', () => {
        activeFilters.sentiment.splice(index, 1);
        document.getElementById('sentimentFilter').selectedIndex = -1;
        Array.from(document.getElementById('sentimentFilter').options).forEach((opt, i) => {
          if (activeFilters.sentiment.includes(opt.value)) {
            opt.selected = true;
          }
        });
        renderFilterBubbles();
        handleSearch();
      });
      bubblesContainer.appendChild(sentimentBubble);
    });
  }

  if (activeFilters.subjectivity.length > 0) {
    const subjectivityValue = activeFilters.subjectivity[0];
    const subjectivityBubble = document.createElement('div');
    const subjectivityClass = subjectivityValue.toLowerCase() === 'objective' ? '--subjectivity-objective' :
                             '--subjectivity-subjective';
    subjectivityBubble.className = `active-filter-bubble active-filter-bubble${subjectivityClass}`;
    subjectivityBubble.textContent = subjectivityValue;
    subjectivityBubble.addEventListener('click', () => {
      activeFilters.subjectivity = [];
      document.getElementById('subjectivityFilter').value = '';
      renderFilterBubbles();
      handleSearch();
    });
    bubblesContainer.appendChild(subjectivityBubble);
  }

  if (activeFilters.device.length > 0) {
    activeFilters.device.forEach((deviceValue, index) => {
      const deviceBubble = document.createElement('div');
      deviceBubble.className = 'active-filter-bubble';
      deviceBubble.textContent = deviceValue;
      deviceBubble.addEventListener('click', () => {
        activeFilters.device.splice(index, 1);
        document.getElementById('deviceFilter').selectedIndex = -1;
        Array.from(document.getElementById('deviceFilter').options).forEach((opt, i) => {
          if (activeFilters.device.includes(opt.value)) {
            opt.selected = true;
          }
        });
        renderFilterBubbles();
        handleSearch();
      });
      bubblesContainer.appendChild(deviceBubble);
    });
  }

  if (activeFilters.type.length > 0) {
    const typeValue = activeFilters.type[0];
    const typeBubble = document.createElement('div');
    typeBubble.className = 'active-filter-bubble';
    typeBubble.textContent = typeValue.charAt(0).toUpperCase() + typeValue.slice(1);
    typeBubble.addEventListener('click', () => {
      activeFilters.type = [];
      document.getElementById('typeFilter').value = '';
      renderFilterBubbles();
      handleSearch();
    });
    bubblesContainer.appendChild(typeBubble);
  }

  if (activeFilters.dateFrom || activeFilters.dateTo) {
    const formatDate = (dateStr) => {
      if (!dateStr) return '...';
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    };
    const dateText = `${formatDate(activeFilters.dateFrom)}  to  ${formatDate(activeFilters.dateTo)}`;
    const dateBubble = document.createElement('div');
    dateBubble.className = 'active-filter-bubble';
    dateBubble.textContent = dateText;
    dateBubble.addEventListener('click', () => {
      activeFilters.dateFrom = null;
      activeFilters.dateTo = null;
      document.getElementById('dateFrom').value = '';
      document.getElementById('dateTo').value = '';
      renderFilterBubbles();
      handleSearch();
    });
    bubblesContainer.appendChild(dateBubble);
  }
}

// Toggle metrics panel
function toggleMetrics() {
  metricsVisible = !metricsVisible;
  const metricsPanel = document.getElementById('metricsPanel');
  const contentWrapper = document.querySelector('.content-wrapper');

  if (metricsVisible) {
    metricsPanel.classList.add('active');
    contentWrapper.classList.add('metrics-open');
    renderCharts();
  } else {
    metricsPanel.classList.remove('active');
    contentWrapper.classList.remove('metrics-open');
  }
}

// Render pie charts
function renderCharts() {
  renderSentimentChart();
  renderSubjectivityChart();
}

// Render sentiment pie chart from Solr facets
function renderSentimentChart() {
  const sentimentFacets = solrFacets.label_sentiment || [];
  const sentimentData = { Positive: 0, Neutral: 0, Negative: 0 };

  // Parse Solr facet array [name, count, name, count, ...]
  for (let i = 0; i < sentimentFacets.length; i += 2) {
    const label = sentimentFacets[i];
    const count = sentimentFacets[i + 1];
    if (sentimentData.hasOwnProperty(label)) {
      sentimentData[label] = count;
    }
  }

  const ctx = document.getElementById('sentimentChart').getContext('2d');

  if (sentimentChart) {
    sentimentChart.destroy();
  }

  sentimentChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Positive', 'Neutral', 'Negative'],
      datasets: [{
        data: [sentimentData.Positive, sentimentData.Neutral, sentimentData.Negative],
        backgroundColor: ['#10b981', '#a9a9ac', '#ef4444'],
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'var(--font)', size: 12 },
            color: 'var(--color-text-primary)',
            padding: 12
          }
        }
      }
    }
  });
}

// Render subjectivity pie chart from Solr facets
function renderSubjectivityChart() {
  const subjectivityFacets = solrFacets.label_subjectivity || [];
  const subjectivityData = { Objective: 0, Subjective: 0 };

  // Parse Solr facet array [name, count, name, count, ...]
  for (let i = 0; i < subjectivityFacets.length; i += 2) {
    const label = subjectivityFacets[i];
    const count = subjectivityFacets[i + 1];
    if (subjectivityData.hasOwnProperty(label)) {
      subjectivityData[label] = count;
    }
  }

  const ctx = document.getElementById('subjectivityChart').getContext('2d');

  if (subjectivityChart) {
    subjectivityChart.destroy();
  }

  subjectivityChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Objective', 'Subjective'],
      datasets: [{
        data: [subjectivityData.Objective, subjectivityData.Subjective],
        backgroundColor: ['#f59e0b', '#a855f7'],
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'var(--font)', size: 12 },
            color: 'var(--color-text-primary)',
            padding: 12
          }
        }
      }
    }
  });
}

// Start app
init();
