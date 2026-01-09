// Global variable to store current results
let currentResults = null;

// Navigation
function showSection(sectionName, eventTarget) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    if (eventTarget) {
        eventTarget.classList.add('active');
    }

    // Load dashboard data if switching to dashboard
    if (sectionName === 'dashboard') {
        loadDashboardData();
    }
}

// Load dashboard data
async function loadDashboardData() {
    // Load summary stats
    try {
        const response = await fetch('/api/dashboard/stats');
        const data = await response.json();

        if (data.success) {
            document.getElementById('total-donations').textContent = formatCurrency(data.data.total_donations);
            document.getElementById('total-parties').textContent = data.data.total_parties;
            document.getElementById('total-donors').textContent = data.data.total_donors.toLocaleString();
            document.getElementById('total-candidates').textContent = data.data.total_candidates.toLocaleString();
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }

    // Load all dashboard sections
    refreshData('top-donors');
    refreshData('party-funding');
    refreshData('recent-donations');
    refreshData('top-candidates');
    refreshData('third-party');
    refreshData('mp-donations');
}

// Refresh specific dashboard section
async function refreshData(section) {
    const container = document.getElementById(`${section}-content`);
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const response = await fetch(`/api/dashboard/${section}`);
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
            displayDashboardTable(container, data, section);
        } else {
            container.innerHTML = '<div class="loading">No data available</div>';
        }
    } catch (error) {
        container.innerHTML = '<div class="loading">Error loading data</div>';
        console.error(`Error loading ${section}:`, error);
    }
}

// Display dashboard table
function displayDashboardTable(container, data) {
    let html = '<table><thead><tr>';

    // Add headers
    data.columns.forEach(col => {
        html += `<th>${escapeHtml(col)}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Add rows
    data.data.forEach(row => {
        html += '<tr>';
        data.columns.forEach(col => {
            const value = row[col];
            let displayValue = '';

            // Format based on column name
            if (col === 'Amount' || col === 'Spending' || col === 'Receipts' || col === 'Total_Receipts' || col === 'Total_Payments' || col === 'Total_Debts') {
                displayValue = formatCurrency(value);
            } else if (col === 'Donations' || col === 'Donors') {
                displayValue = value ? value.toLocaleString() : '0';
            } else {
                displayValue = value === null ? '<em>NULL</em>' : escapeHtml(String(value));
            }

            html += `<td>${displayValue}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// Format currency
function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '$0';
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Load example query
async function loadExample(exampleId) {
    try {
        const response = await fetch(`/example/${exampleId}`);
        const data = await response.json();

        if (data.success) {
            document.getElementById('sqlEditor').value = data.query.sql.trim();
            updateStatus(`Loaded: ${data.query.name}`, 'success');
        } else {
            updateStatus(`Error loading example: ${data.error}`, 'error');
        }
    } catch (error) {
        updateStatus(`Error: ${error.message}`, 'error');
    }
}

// Execute SQL query
async function executeQuery() {
    const sql = document.getElementById('sqlEditor').value.trim();

    if (!sql) {
        updateStatus('Please enter a SQL query', 'error');
        return;
    }

    // Hide previous results/errors
    document.getElementById('resultsContainer').style.display = 'none';
    document.getElementById('errorContainer').style.display = 'none';
    document.getElementById('exportBtn').disabled = true;

    updateStatus('Executing query...', 'loading');

    try {
        const response = await fetch('/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql: sql })
        });

        const data = await response.json();

        if (data.success) {
            currentResults = data;
            displayResults(data);
            updateStatus(`Query executed successfully - ${data.row_count} rows returned`, 'success');
            document.getElementById('exportBtn').disabled = false;
        } else {
            displayError(data.error);
            updateStatus('Query failed', 'error');
        }
    } catch (error) {
        displayError(`Network error: ${error.message}`);
        updateStatus('Query failed', 'error');
    }
}

// Display query results
function displayResults(data) {
    const container = document.getElementById('resultsContainer');
    const metaDiv = document.getElementById('resultsMeta');
    const tableDiv = document.getElementById('resultsTable');

    // Show metadata
    metaDiv.innerHTML = `
        <strong>Rows:</strong> ${data.row_count.toLocaleString()} |
        <strong>Columns:</strong> ${data.columns.length}
    `;

    // Create table
    if (data.row_count === 0) {
        tableDiv.innerHTML = '<p style="padding: 20px; text-align: center;">No results found</p>';
    } else {
        let html = '<table><thead><tr>';

        // Add headers
        data.columns.forEach(col => {
            html += `<th>${escapeHtml(col)}</th>`;
        });
        html += '</tr></thead><tbody>';

        // Add rows
        data.data.forEach(row => {
            html += '<tr>';
            data.columns.forEach(col => {
                const value = row[col];
                const displayValue = value === null ? '<em>NULL</em>' : escapeHtml(String(value));
                html += `<td>${displayValue}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        tableDiv.innerHTML = html;
    }

    container.style.display = 'block';
}

// Display error message
function displayError(error) {
    const container = document.getElementById('errorContainer');
    const messageDiv = document.getElementById('errorMessage');

    messageDiv.textContent = error;
    container.style.display = 'block';
}

// Update status bar
function updateStatus(message, type = '') {
    const statusBar = document.getElementById('statusBar');
    if (!statusBar) return;

    statusBar.textContent = message;
    statusBar.className = 'status-bar';

    if (type) {
        statusBar.classList.add(type);
    }
}

// Clear query editor
function clearQuery() {
    document.getElementById('sqlEditor').value = '';
    document.getElementById('resultsContainer').style.display = 'none';
    document.getElementById('errorContainer').style.display = 'none';
    document.getElementById('exportBtn').disabled = true;
    updateStatus('');
    currentResults = null;
}

// Export results to CSV
function exportResults() {
    if (!currentResults || !currentResults.data || currentResults.data.length === 0) {
        updateStatus('No results to export', 'error');
        return;
    }

    const csv = convertToCSV(currentResults);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_results_${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    updateStatus('Results exported to CSV', 'success');
}

// Convert results to CSV
function convertToCSV(data) {
    const columns = data.columns;
    const rows = data.data;

    // Header row
    let csv = columns.map(col => `"${col}"`).join(',') + '\n';

    // Data rows
    rows.forEach(row => {
        const values = columns.map(col => {
            const value = row[col];
            if (value === null) return '';
            const stringValue = String(value).replace(/"/g, '""');
            return `"${stringValue}"`;
        });
        csv += values.join(',') + '\n';
    });

    return csv;
}

// Utility: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Explore Data Functions
let searchTimeout = null;
let currentFilters = {
    period: '2025',
    entityTypes: ['parties', 'independents', 'third-parties', 'associated'],
    minAmount: 0,
    redFlags: []
};

// Global search with debouncing and autocomplete
function setupGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');
    const autocompleteContainer = document.getElementById('autocompleteResults');

    if (!searchInput) return;

    // Create autocomplete container if it doesn't exist
    if (!autocompleteContainer) {
        const container = document.createElement('div');
        container.id = 'autocompleteResults';
        container.className = 'autocomplete-results';
        searchInput.parentNode.appendChild(container);
    }

    let currentSuggestions = [];
    let selectedIndex = -1;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        if (query.length < 2) {
            // Hide autocomplete and show default message
            hideAutocomplete();
            const resultsContainer = document.getElementById('exploreResults');
            if (resultsContainer) {
                resultsContainer.innerHTML = '<div class="loading">Type at least 2 characters to search...</div>';
            }
            return;
        }

        // Show loading indicator immediately
        const resultsContainer = document.getElementById('exploreResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
        }

        // Fetch autocomplete suggestions AND trigger search automatically (100ms debounce)
        searchTimeout = setTimeout(() => {
            fetchAutocompleteSuggestions(query);
            performGlobalSearch(query);
        }, 100);
    });

    // Handle keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        const container = document.getElementById('autocompleteResults');
        if (!container || container.style.display === 'none') return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
            highlightSuggestion(selectedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            highlightSuggestion(selectedIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && currentSuggestions[selectedIndex]) {
                selectSuggestion(currentSuggestions[selectedIndex].name);
            } else {
                performGlobalSearch(searchInput.value.trim());
                hideAutocomplete();
            }
        } else if (e.key === 'Escape') {
            hideAutocomplete();
        }
    });

    // Hide autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !document.getElementById('autocompleteResults')?.contains(e.target)) {
            hideAutocomplete();
        }
    });

    async function fetchAutocompleteSuggestions(query) {
        try {
            const response = await fetch(`/api/autocomplete?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.success && data.suggestions && data.suggestions.length > 0) {
                currentSuggestions = data.suggestions;
                selectedIndex = -1;
                displayAutocompleteSuggestions(data.suggestions);
            } else {
                hideAutocomplete();
            }
        } catch (error) {
            console.error('Autocomplete error:', error);
            hideAutocomplete();
        }
    }

    function displayAutocompleteSuggestions(suggestions) {
        const container = document.getElementById('autocompleteResults');
        if (!container) return;

        let html = '';
        suggestions.forEach((suggestion, index) => {
            const typeClass = suggestion.type === 'Donor' ? 'donor-badge' : 'recipient-badge';
            html += `<div class="autocomplete-item" data-index="${index}" data-name="${escapeHtml(suggestion.name)}">`;
            html += `<span class="suggestion-name">${escapeHtml(suggestion.name)}</span>`;
            html += `<span class="suggestion-type ${typeClass}">${suggestion.type}</span>`;
            html += '</div>';
        });

        container.innerHTML = html;
        container.style.display = 'block';

        // Add click handlers
        container.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const name = e.currentTarget.getAttribute('data-name');
                selectSuggestion(name);
            });
        });
    }

    function highlightSuggestion(index) {
        const container = document.getElementById('autocompleteResults');
        if (!container) return;

        const items = container.querySelectorAll('.autocomplete-item');
        items.forEach((item, i) => {
            if (i === index) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    function selectSuggestion(name) {
        searchInput.value = name;
        hideAutocomplete();
        performGlobalSearch(name);
    }

    function hideAutocomplete() {
        const container = document.getElementById('autocompleteResults');
        if (container) {
            container.style.display = 'none';
            container.innerHTML = '';
        }
        currentSuggestions = [];
        selectedIndex = -1;
    }
}

// Perform global search
async function performGlobalSearch(query) {
    const resultsContainer = document.getElementById('exploreResults');

    // Show loading in main results area
    resultsContainer.innerHTML = '<div class="loading">Searching...</div>';

    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.success && data.transactions && data.transactions.length > 0) {
            displaySearchTransactions(data);
        } else {
            resultsContainer.innerHTML = '<div class="loading">No results found</div>';
        }
    } catch (error) {
        resultsContainer.innerHTML = '<div class="loading">Error performing search</div>';
        console.error('Search error:', error);
    }
}

// Display search transaction results
function displaySearchTransactions(data) {
    const resultsContainer = document.getElementById('exploreResults');
    const summary = data.summary;
    const transactions = data.transactions;

    // Store data for export
    currentDisplayedData = {
        columns: ['Donor', 'Recipient', 'Amount', 'Date', 'Period', 'Type'],
        data: transactions
    };

    let html = '';

    // Summary header
    html += '<div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-color); border-radius: 0.5rem;">';
    html += '<h3 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">Search Results</h3>';
    html += '<div style="display: flex; gap: 2rem; font-size: 0.95rem; color: var(--text-secondary);">';
    html += `<span><strong>${summary.total_transactions}</strong> transactions</span>`;
    html += `<span><strong>${formatCurrency(summary.total_amount)}</strong> total</span>`;
    html += `<span><strong>${summary.unique_donors}</strong> donors</span>`;
    html += `<span><strong>${summary.unique_recipients}</strong> recipients</span>`;
    html += '</div>';
    html += '</div>';

    // Transactions table
    html += '<table><thead><tr>';
    html += '<th>Donor</th>';
    html += '<th>Recipient</th>';
    html += '<th>Amount</th>';
    html += '<th>Date</th>';
    html += '<th>Period</th>';
    html += '<th>Type</th>';
    html += '</tr></thead><tbody>';

    transactions.forEach(txn => {
        html += '<tr>';
        html += `<td>${escapeHtml(txn.donor || txn.Donor || '')}</td>`;
        html += `<td>${escapeHtml(txn.recipient || txn.Recipient || '')}</td>`;
        html += `<td>${formatCurrency(txn.Amount || txn.amount || 0)}</td>`;
        html += `<td>${escapeHtml(txn.Date || txn.date || '')}</td>`;
        html += `<td>${escapeHtml(txn.period || txn.Period || '')}</td>`;
        html += `<td>${escapeHtml(txn.type || txn.Type || '')}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';

    if (transactions.length >= 100) {
        html += '<p style="margin-top: 1rem; text-align: center; color: var(--text-secondary);">Showing first 100 results. Refine your search for more specific results.</p>';
    }

    resultsContainer.innerHTML = html;
}

// Apply filters
function applyFilters() {
    // Get period
    const periodSelect = document.getElementById('filterPeriod');
    if (periodSelect) {
        currentFilters.period = periodSelect.value;
    }

    // Get entity types
    const entityCheckboxes = document.querySelectorAll('.filter-card input[type="checkbox"][value]');
    currentFilters.entityTypes = [];
    entityCheckboxes.forEach(checkbox => {
        if (checkbox.checked && ['parties', 'independents', 'third-parties', 'associated'].includes(checkbox.value)) {
            currentFilters.entityTypes.push(checkbox.value);
        }
    });

    // Get amount range
    const amountSlider = document.getElementById('amountSlider');
    if (amountSlider) {
        currentFilters.minAmount = parseInt(amountSlider.value);
        document.getElementById('amountValue').textContent = currentFilters.minAmount.toLocaleString();
    }

    // Get red flags
    const redFlagCheckboxes = document.querySelectorAll('.filter-card input[type="checkbox"][value^="dark-"], .filter-card input[type="checkbox"][value^="first-"], .filter-card input[type="checkbox"][value^="passthrough"], .filter-card input[type="checkbox"][value^="high-"]');
    currentFilters.redFlags = [];
    redFlagCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            currentFilters.redFlags.push(checkbox.value);
        }
    });

    // Fetch filtered data
    fetchExploreData();
}

// Fetch explore data with filters
async function fetchExploreData() {
    const resultsContainer = document.getElementById('exploreResults');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '<div class="loading">Loading filtered data...</div>';

    try {
        const params = new URLSearchParams({
            period: currentFilters.period,
            entityTypes: currentFilters.entityTypes.join(','),
            minAmount: currentFilters.minAmount,
            redFlags: currentFilters.redFlags.join(',')
        });

        const response = await fetch(`/api/explore?${params}`);
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
            displayExploreResults(data);
        } else {
            resultsContainer.innerHTML = '<div class="loading">No results found with current filters</div>';
        }
    } catch (error) {
        resultsContainer.innerHTML = '<div class="loading">Error loading data</div>';
        console.error('Explore data error:', error);
    }
}

// Display explore results
function displayExploreResults(data) {
    const resultsContainer = document.getElementById('exploreResults');

    // Store data for export
    currentDisplayedData = {
        columns: data.columns,
        data: data.data
    };

    let html = '<table><thead><tr>';

    // Add headers
    data.columns.forEach(col => {
        html += `<th>${escapeHtml(col)}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Add rows
    data.data.forEach(row => {
        html += '<tr>';
        data.columns.forEach(col => {
            const value = row[col];
            let displayValue = '';

            // Format based on column name
            if (col === 'Amount' || col.includes('Total') || col.includes('Value')) {
                displayValue = formatCurrency(value);
            } else if (col === 'Donations' || col === 'Donors') {
                displayValue = value ? value.toLocaleString() : '0';
            } else {
                displayValue = value === null ? '<em>NULL</em>' : escapeHtml(String(value));
            }

            html += `<td>${displayValue}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    resultsContainer.innerHTML = html;
}

// Toggle compare mode
function toggleCompare() {
    const compareCheckbox = document.getElementById('compareMode');
    const resultsContainer = document.getElementById('exploreResults');

    if (compareCheckbox && compareCheckbox.checked) {
        // Show comparison interface
        resultsContainer.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h2 style="margin: 0 0 1rem 0; color: var(--text-primary);">Compare Time Periods</h2>
                <p style="color: var(--text-secondary);">Compare donation data side-by-side across different election cycles</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 500;">Period A</label>
                    <select id="comparePeriodA" style="width: 100%; padding: 0.75rem; background: var(--bg-color); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; color: var(--text-primary); font-size: 1rem;">
                        <optgroup label="Federal Elections">
                            <option value="2025">2025 Federal Election</option>
                            <option value="2022">2022 Federal Election</option>
                            <option value="2019">2019 Federal Election</option>
                            <option value="2016">2016 Federal Election</option>
                            <option value="2013">2013 Federal Election</option>
                            <option value="2010">2010 Federal Election</option>
                            <option value="2007">2007 Federal Election</option>
                        </optgroup>
                        <optgroup label="Annual Returns">
                            <option value="2023-24">2023-24 Financial Year</option>
                            <option value="2022-23">2022-23 Financial Year</option>
                            <option value="2021-22">2021-22 Financial Year</option>
                            <option value="2020-21">2020-21 Financial Year</option>
                            <option value="2019-20">2019-20 Financial Year</option>
                        </optgroup>
                    </select>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-primary); font-weight: 500;">Period B</label>
                    <select id="comparePeriodB" style="width: 100%; padding: 0.75rem; background: var(--bg-color); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; color: var(--text-primary); font-size: 1rem;">
                        <optgroup label="Federal Elections">
                            <option value="2025">2025 Federal Election</option>
                            <option value="2022" selected>2022 Federal Election</option>
                            <option value="2019">2019 Federal Election</option>
                            <option value="2016">2016 Federal Election</option>
                            <option value="2013">2013 Federal Election</option>
                            <option value="2010">2010 Federal Election</option>
                            <option value="2007">2007 Federal Election</option>
                        </optgroup>
                        <optgroup label="Annual Returns">
                            <option value="2023-24">2023-24 Financial Year</option>
                            <option value="2022-23">2022-23 Financial Year</option>
                            <option value="2021-22">2021-22 Financial Year</option>
                            <option value="2020-21">2020-21 Financial Year</option>
                            <option value="2019-20">2019-20 Financial Year</option>
                        </optgroup>
                    </select>
                </div>
            </div>

            <button onclick="runComparison()" style="padding: 0.75rem 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 0.5rem; font-size: 1rem; font-weight: 500; cursor: pointer; margin-bottom: 2rem;">
                Run Comparison
            </button>

            <div id="comparisonResults"></div>
        `;
    } else {
        // Reset to default view
        resultsContainer.innerHTML = '<div class="loading">Use filters or search to explore data...</div>';
    }
}

// Run comparison
async function runComparison() {
    const periodA = document.getElementById('comparePeriodA').value;
    const periodB = document.getElementById('comparePeriodB').value;
    const resultsDiv = document.getElementById('comparisonResults');

    resultsDiv.innerHTML = '<div class="loading">Comparing periods...</div>';

    try {
        // Fetch data for both periods
        const [responseA, responseB] = await Promise.all([
            fetch(`/api/explore?period=${periodA}`),
            fetch(`/api/explore?period=${periodB}`)
        ]);

        const dataA = await responseA.json();
        const dataB = await responseB.json();

        if (dataA.success && dataB.success) {
            displayComparison(periodA, dataA, periodB, dataB);
        } else {
            resultsDiv.innerHTML = '<div class="loading">Error loading comparison data</div>';
        }
    } catch (error) {
        resultsDiv.innerHTML = '<div class="loading">Error running comparison</div>';
        console.error('Comparison error:', error);
    }
}

// Display comparison results
function displayComparison(periodA, dataA, periodB, dataB) {
    const resultsDiv = document.getElementById('comparisonResults');

    // Calculate summary statistics
    const totalA = dataA.data.reduce((sum, row) => sum + (row.Amount || 0), 0);
    const totalB = dataB.data.reduce((sum, row) => sum + (row.Amount || 0), 0);
    const countA = dataA.data.length;
    const countB = dataB.data.length;

    const totalChange = ((totalA - totalB) / totalB) * 100;
    const countChange = ((countA - countB) / countB) * 100;

    let html = '';

    // Summary comparison cards
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">';

    // Period A summary
    html += '<div style="padding: 1.5rem; background: var(--bg-color); border-radius: 0.5rem; border-left: 4px solid #667eea;">';
    html += `<h3 style="margin: 0 0 1rem 0; color: var(--text-primary);">${getPeriodName(periodA)}</h3>`;
    html += `<div style="font-size: 2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">${formatCurrency(totalA)}</div>`;
    html += `<div style="color: var(--text-secondary);">${countA.toLocaleString()} transactions</div>`;
    html += '</div>';

    // Period B summary
    html += '<div style="padding: 1.5rem; background: var(--bg-color); border-radius: 0.5rem; border-left: 4px solid #764ba2;">';
    html += `<h3 style="margin: 0 0 1rem 0; color: var(--text-primary);">${getPeriodName(periodB)}</h3>`;
    html += `<div style="font-size: 2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">${formatCurrency(totalB)}</div>`;
    html += `<div style="color: var(--text-secondary);">${countB.toLocaleString()} transactions</div>`;
    html += '</div>';

    html += '</div>';

    // Change indicators
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">';

    html += '<div style="padding: 1rem; background: var(--bg-color); border-radius: 0.5rem; text-align: center;">';
    html += `<div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Total Amount Change</div>`;
    const totalColor = totalChange > 0 ? '#10b981' : '#ef4444';
    html += `<div style="font-size: 1.5rem; font-weight: 700; color: ${totalColor};">${totalChange > 0 ? '↑' : '↓'} ${Math.abs(totalChange).toFixed(1)}%</div>`;
    html += '</div>';

    html += '<div style="padding: 1rem; background: var(--bg-color); border-radius: 0.5rem; text-align: center;">';
    html += `<div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Transaction Count Change</div>`;
    const countColor = countChange > 0 ? '#10b981' : '#ef4444';
    html += `<div style="font-size: 1.5rem; font-weight: 700; color: ${countColor};">${countChange > 0 ? '↑' : '↓'} ${Math.abs(countChange).toFixed(1)}%</div>`;
    html += '</div>';

    html += '</div>';

    // Side-by-side tables (top 10 from each)
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">';

    // Period A top 10
    html += '<div>';
    html += `<h4 style="margin: 0 0 1rem 0; color: var(--text-primary);">Top 10 - ${getPeriodName(periodA)}</h4>`;
    html += '<table style="width: 100%;"><thead><tr><th>Name</th><th>Amount</th></tr></thead><tbody>';
    dataA.data.slice(0, 10).forEach(row => {
        html += '<tr>';
        html += `<td>${escapeHtml(row.Name || '')}</td>`;
        html += `<td>${formatCurrency(row.Amount)}</td>`;
        html += '</tr>';
    });
    html += '</tbody></table>';
    html += '</div>';

    // Period B top 10
    html += '<div>';
    html += `<h4 style="margin: 0 0 1rem 0; color: var(--text-primary);">Top 10 - ${getPeriodName(periodB)}</h4>`;
    html += '<table style="width: 100%;"><thead><tr><th>Name</th><th>Amount</th></tr></thead><tbody>';
    dataB.data.slice(0, 10).forEach(row => {
        html += '<tr>';
        html += `<td>${escapeHtml(row.Name || '')}</td>`;
        html += `<td>${formatCurrency(row.Amount)}</td>`;
        html += '</tr>';
    });
    html += '</tbody></table>';
    html += '</div>';

    html += '</div>';

    resultsDiv.innerHTML = html;
}

// Get period display name
function getPeriodName(period) {
    const names = {
        // Federal Elections
        '2025': '2025 Federal Election',
        '2022': '2022 Federal Election',
        '2019': '2019 Federal Election',
        '2016': '2016 Federal Election',
        '2013': '2013 Federal Election',
        '2010': '2010 Federal Election',
        '2007': '2007 Federal Election',
        // Annual Returns
        '2023-24': '2023-24 Financial Year',
        '2022-23': '2022-23 Financial Year',
        '2021-22': '2021-22 Financial Year',
        '2020-21': '2020-21 Financial Year',
        '2019-20': '2019-20 Financial Year',
        // Aggregates
        'last-2-years': 'Last 2 Years',
        'all-time': 'All Time'
    };
    return names[period] || period;
}

// Set amount filter
function setAmountFilter(amount, buttonElement) {
    const amountSlider = document.getElementById('amountSlider');
    const amountValue = document.getElementById('amountValue');

    if (amountSlider && amountValue) {
        amountSlider.value = amount;
        amountValue.textContent = amount.toLocaleString();
        currentFilters.minAmount = amount;

        // Update preset button styles
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        if (buttonElement) {
            buttonElement.classList.add('active');
        }

        applyFilters();
    }
}

// Show top stories
async function showTopStories() {
    const resultsContainer = document.getElementById('exploreResults');

    resultsContainer.innerHTML = '<div class="loading">Generating top stories...</div>';

    try {
        const response = await fetch('/api/top-stories');
        const data = await response.json();

        if (data.success && data.stories && data.stories.length > 0) {
            displayTopStories(data.stories);
        } else {
            resultsContainer.innerHTML = '<div class="loading">No stories available</div>';
        }
    } catch (error) {
        resultsContainer.innerHTML = '<div class="loading">Error loading top stories</div>';
        console.error('Top stories error:', error);
    }
}

// Display top stories
function displayTopStories(stories) {
    const resultsContainer = document.getElementById('exploreResults');

    let html = '';
    html += '<div style="margin-bottom: 2rem;">';
    html += '<h2 style="margin: 0 0 1rem 0; color: var(--text-primary);">Top Stories</h2>';
    html += '<p style="color: var(--text-secondary); margin: 0;">Algorithmic highlights from the election funding data</p>';
    html += '</div>';

    html += '<div style="display: grid; gap: 1.5rem;">';

    stories.forEach((story, index) => {
        // Story card
        html += '<div style="padding: 1.5rem; background: var(--bg-color); border-radius: 0.5rem; border-left: 4px solid ';

        // Color code by type
        if (story.type === 'shift') {
            html += '#3b82f6'; // Blue for shifts
        } else if (story.type === 'new_donor') {
            html += '#10b981'; // Green for new donors
        } else if (story.type === 'debt') {
            html += '#ef4444'; // Red for debt
        } else if (story.type === 'dark_money') {
            html += '#f59e0b'; // Orange for dark money
        } else {
            html += '#6b7280'; // Gray default
        }

        html += ';">';

        // Story number
        html += `<div style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem;">STORY ${index + 1}</div>`;

        // Story title
        html += `<h3 style="margin: 0 0 0.75rem 0; font-size: 1.25rem; color: var(--text-primary);">${escapeHtml(story.title)}</h3>`;

        // Story description
        html += `<p style="margin: 0; color: var(--text-secondary); line-height: 1.6;">${escapeHtml(story.description)}</p>`;

        // Additional details
        if (story.amount) {
            html += `<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.875rem; color: var(--text-secondary);">`;
            html += `<strong style="color: var(--text-primary);">Amount:</strong> ${formatCurrency(story.amount)}`;
            if (story.change !== undefined) {
                const changeColor = story.change > 0 ? '#10b981' : '#ef4444';
                html += ` <span style="color: ${changeColor};">(${story.change > 0 ? '+' : ''}${story.change.toFixed(1)}%)</span>`;
            }
            html += '</div>';
        }

        html += '</div>';
    });

    html += '</div>';

    resultsContainer.innerHTML = html;
}

// Store current displayed data for export
let currentDisplayedData = null;

// Export current view
function exportCurrentView() {
    // Check if we have data to export
    if (!currentDisplayedData || !currentDisplayedData.columns || !currentDisplayedData.data) {
        alert('No data to export. Please perform a search or apply filters first.');
        return;
    }

    try {
        // Generate CSV content
        const csv = convertToCSV(currentDisplayedData);

        // Create blob and download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');

        // Generate filename based on current view
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `election_data_export_${timestamp}.csv`;

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        console.log(`Exported ${currentDisplayedData.data.length} rows to ${filename}`);
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export data. Please try again.');
    }
}

// Share filters
function shareFilters() {
    // Create shareable URL with current filters
    const params = new URLSearchParams({
        period: currentFilters.period,
        entityTypes: currentFilters.entityTypes.join(','),
        minAmount: currentFilters.minAmount,
        redFlags: currentFilters.redFlags.join(',')
    });

    const shareUrl = `${window.location.origin}${window.location.pathname}#explore?${params}`;

    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Link copied to clipboard! Share this link to show others your current filters.');
    }).catch(() => {
        alert('Shareable link:\n\n' + shareUrl);
    });
}

// Upload Functions
function toggleUploadSection() {
    const uploadSection = document.getElementById('uploadSection');
    if (uploadSection.style.display === 'none') {
        uploadSection.style.display = 'block';
    } else {
        uploadSection.style.display = 'none';
    }
}

function setupDragAndDrop() {
    const uploadZone = document.getElementById('uploadZone');
    if (!uploadZone) return;

    uploadZone.addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleFileUpload(file);
    }
}

async function handleFileUpload(file) {
    // Validate file type
    if (!file.name.endsWith('.csv')) {
        showUploadResult('error', 'Invalid File', ['Please select a CSV file']);
        return;
    }

    // Show progress
    document.getElementById('uploadProgress').style.display = 'block';
    document.getElementById('uploadResult').style.display = 'none';
    document.getElementById('uploadZone').style.display = 'none';

    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    progressFill.style.width = '10%';
    progressText.textContent = 'Validating file...';

    try {
        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('filename', file.name);

        progressFill.style.width = '30%';
        progressText.textContent = 'Uploading...';

        // Upload file
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        progressFill.style.width = '90%';
        progressText.textContent = 'Processing...';

        const data = await response.json();

        progressFill.style.width = '100%';

        if (data.success) {
            showUploadResult('success', 'Upload Successful!', [
                `Table: ${data.table_name}`,
                `Rows imported: ${data.rows_imported.toLocaleString()}`,
                `Columns: ${data.columns}`,
                'Dashboard data will be refreshed automatically'
            ]);

            // Refresh dashboard if on dashboard view
            setTimeout(() => {
                loadDashboardData();
                // Reset upload section after 3 seconds
                setTimeout(() => {
                    resetUploadSection();
                }, 3000);
            }, 1000);
        } else {
            showUploadResult('error', 'Upload Failed', [data.error || 'Unknown error occurred']);
        }
    } catch (error) {
        showUploadResult('error', 'Upload Error', [
            'Failed to upload file',
            error.message
        ]);
    }
}

function showUploadResult(type, title, messages) {
    const resultDiv = document.getElementById('uploadResult');
    const progressDiv = document.getElementById('uploadProgress');

    progressDiv.style.display = 'none';
    resultDiv.style.display = 'block';
    resultDiv.className = `upload-result ${type}`;

    let html = `<h4>${title}</h4><ul>`;
    messages.forEach(msg => {
        html += `<li>${msg}</li>`;
    });
    html += '</ul>';

    resultDiv.innerHTML = html;
}

function resetUploadSection() {
    document.getElementById('uploadZone').style.display = 'block';
    document.getElementById('uploadProgress').style.display = 'none';
    document.getElementById('uploadResult').style.display = 'none';
    document.getElementById('fileInput').value = '';
    document.getElementById('progressFill').style.width = '0%';
}

// Handle keyboard shortcuts
document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('sqlEditor');

    if (editor) {
        editor.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                executeQuery();
            }
        });
    }

    // Load dashboard data on page load
    loadDashboardData();

    // Setup explore data functionality
    setupGlobalSearch();

    // Setup drag and drop
    setupDragAndDrop();

    // Setup amount slider
    const amountSlider = document.getElementById('amountSlider');
    if (amountSlider) {
        amountSlider.addEventListener('input', (e) => {
            document.getElementById('amountValue').textContent = parseInt(e.target.value).toLocaleString();
        });
    }
});
