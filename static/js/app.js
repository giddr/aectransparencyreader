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

// Enhanced search state variables
let sortState = {
    column: 'Amount',  // Default sort by amount
    direction: 'desc'  // 'asc' or 'desc'
};
let selectedRows = new Set();  // Store indices of selected rows
let allTransactions = [];  // Store unfiltered transactions for search-within-search
let currentQuery = '';  // Store original search query

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

// Parse search query to detect amount searches vs name searches
function parseSearchQuery(query) {
    // Detect if query is an amount search
    // Patterns: >50000, <100000, 50000-100000, >=50000, <=100000

    const greaterThanMatch = query.match(/^>=?(\d+)$/);
    const lessThanMatch = query.match(/^<=?(\d+)$/);
    const rangeMatch = query.match(/^(\d+)-(\d+)$/);

    if (greaterThanMatch) {
        return {
            type: 'amount',
            operator: 'gte',
            value: parseInt(greaterThanMatch[1])
        };
    } else if (lessThanMatch) {
        return {
            type: 'amount',
            operator: 'lte',
            value: parseInt(lessThanMatch[1])
        };
    } else if (rangeMatch) {
        return {
            type: 'amount',
            operator: 'range',
            min: parseInt(rangeMatch[1]),
            max: parseInt(rangeMatch[2])
        };
    } else {
        return {
            type: 'name',
            value: query
        };
    }
}

// Perform global search
async function performGlobalSearch(query) {
    const resultsContainer = document.getElementById('exploreResults');

    // Clear previous selection
    selectedRows.clear();

    // Show loading in main results area
    resultsContainer.innerHTML = '<div class="loading">Searching...</div>';

    try {
        // Parse the query to determine type
        const parsedQuery = parseSearchQuery(query);

        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.success && data.transactions) {
            let filteredTransactions = data.transactions;

            // If amount query, filter client-side
            if (parsedQuery.type === 'amount') {
                filteredTransactions = data.transactions.filter(txn => {
                    const amount = txn.Amount || txn.amount || 0;

                    if (parsedQuery.operator === 'gte') {
                        return amount >= parsedQuery.value;
                    } else if (parsedQuery.operator === 'lte') {
                        return amount <= parsedQuery.value;
                    } else if (parsedQuery.operator === 'range') {
                        return amount >= parsedQuery.min && amount <= parsedQuery.max;
                    }
                    return true;
                });

                // Recalculate summary for filtered results
                const total_amount = filteredTransactions.reduce((sum, t) => sum + (t.Amount || t.amount || 0), 0);
                const donors = new Set(filteredTransactions.map(t => t.Donor || t.donor).filter(Boolean));
                const recipients = new Set(filteredTransactions.map(t => t.Recipient || t.recipient).filter(Boolean));

                data.summary = {
                    total_transactions: filteredTransactions.length,
                    total_amount: total_amount,
                    unique_donors: donors.size,
                    unique_recipients: recipients.size
                };
            }

            if (filteredTransactions.length > 0) {
                displaySearchTransactions({
                    transactions: filteredTransactions,
                    summary: data.summary,
                    originalQuery: query  // Store original query for search-within-search
                });
            } else {
                resultsContainer.innerHTML = '<div class="loading">No results found</div>';
            }
        } else {
            resultsContainer.innerHTML = '<div class="loading">No results found</div>';
        }
    } catch (error) {
        resultsContainer.innerHTML = '<div class="loading">Error performing search</div>';
        console.error('Search error:', error);
    }
}

// Calculate summary statistics from transactions
function calculateSummary(transactions) {
    const total_amount = transactions.reduce((sum, t) => sum + (t.Amount || t.amount || 0), 0);
    const donors = new Set(transactions.map(t => t.Donor || t.donor).filter(Boolean));
    const recipients = new Set(transactions.map(t => t.Recipient || t.recipient).filter(Boolean));

    return {
        total_transactions: transactions.length,
        total_amount: total_amount,
        unique_donors: donors.size,
        unique_recipients: recipients.size
    };
}

// Setup search-within-results functionality
function setupSearchWithinResults() {
    const searchInput = document.getElementById('searchWithinResults');
    if (!searchInput) return;

    let timeout = null;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        const filterQuery = e.target.value.trim().toLowerCase();

        timeout = setTimeout(() => {
            applyAllFilters();
        }, 200);  // 200ms debounce for filtering
    });
}

// Setup receipt type filter functionality
function setupReceiptTypeFilter() {
    const filterSelect = document.getElementById('receiptTypeFilter');
    if (!filterSelect) return;

    filterSelect.addEventListener('change', (e) => {
        applyAllFilters();
    });
}

// Apply all filters (search-within-results + receipt type filter)
function applyAllFilters() {
    const searchQuery = document.getElementById('searchWithinResults')?.value.trim().toLowerCase() || '';
    const receiptTypeFilter = document.getElementById('receiptTypeFilter')?.value || '';

    let filtered = allTransactions;

    // Apply search-within-results filter
    if (searchQuery.length > 0) {
        filtered = filtered.filter(txn => {
            const donor = (txn.Donor || txn.donor || '').toLowerCase();
            const recipient = (txn.Recipient || txn.recipient || '').toLowerCase();
            const period = (txn.Period || txn.period || '').toLowerCase();
            const type = (txn.Type || txn.type || '').toLowerCase();
            const receiptType = (txn.Receipt_Type || txn.receipt_type || '').toLowerCase();
            const amount = String(txn.Amount || txn.amount || '');

            return donor.includes(searchQuery) ||
                   recipient.includes(searchQuery) ||
                   period.includes(searchQuery) ||
                   type.includes(searchQuery) ||
                   receiptType.includes(searchQuery) ||
                   amount.includes(searchQuery);
        });
    }

    // Apply receipt type filter
    if (receiptTypeFilter) {
        filtered = filtered.filter(txn => {
            const receiptType = txn.Receipt_Type || txn.receipt_type || '';
            return receiptType === receiptTypeFilter;
        });
    }

    displaySearchTransactions({
        transactions: filtered,
        summary: calculateSummary(filtered),
        originalQuery: currentQuery
    });
}

// Sort table by column
function sortTable(column) {
    // Toggle direction if clicking same column, otherwise default to descending
    if (sortState.column === column) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.column = column;
        sortState.direction = 'desc';  // Default to descending for new column
    }

    // Get the current transactions data
    if (!currentDisplayedData || !currentDisplayedData.data) return;

    const transactions = currentDisplayedData.data;

    // Sort the transactions array
    transactions.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        // Handle null/undefined values
        if (valA == null) return 1;
        if (valB == null) return -1;

        // Special handling for Amount (numeric)
        if (column === 'Amount') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        } else {
            // String comparison for text fields
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }

        let comparison = 0;
        if (valA > valB) comparison = 1;
        if (valA < valB) comparison = -1;

        return sortState.direction === 'asc' ? comparison : -comparison;
    });

    // Re-render the table with sorted data
    displaySearchTransactions({
        transactions: transactions,
        summary: currentDisplayedData.summary,
        originalQuery: currentQuery
    });
}

// Update sort indicators
function updateSortIndicators() {
    // Remove all existing indicators
    document.querySelectorAll('.sort-indicator').forEach(indicator => {
        indicator.textContent = '';
    });

    // Add indicator to current sorted column
    const header = document.querySelector(`th[data-column="${sortState.column}"] .sort-indicator`);
    if (header) {
        header.textContent = sortState.direction === 'asc' ? ' ▲' : ' ▼';
    }
}

// Toggle individual row selection
function toggleRowSelection(index) {
    if (selectedRows.has(index)) {
        selectedRows.delete(index);
    } else {
        selectedRows.add(index);
    }

    // Update the row highlighting
    const row = document.querySelector(`tr[data-index="${index}"]`);
    if (row) {
        if (selectedRows.has(index)) {
            row.classList.add('selected-row');
        } else {
            row.classList.remove('selected-row');
        }
    }

    // Update the "select all" checkbox state
    updateSelectAllCheckbox();

    // Update the tally display
    updateSelectionTally();
}

// Toggle select all rows
function toggleSelectAll() {
    const checkbox = document.getElementById('selectAllRows');
    const isChecked = checkbox.checked;

    if (isChecked) {
        // Select all rows
        if (currentDisplayedData && currentDisplayedData.data) {
            selectedRows.clear();
            currentDisplayedData.data.forEach((_, index) => {
                selectedRows.add(index);
            });
        }
    } else {
        // Deselect all rows
        selectedRows.clear();
    }

    // Re-render to update all checkboxes and row highlighting
    displaySearchTransactions({
        transactions: currentDisplayedData.data,
        summary: currentDisplayedData.summary,
        originalQuery: currentQuery
    });
}

// Update select all checkbox state
function updateSelectAllCheckbox() {
    const checkbox = document.getElementById('selectAllRows');
    if (!checkbox) return;

    const totalRows = currentDisplayedData ? currentDisplayedData.data.length : 0;
    const selectedCount = selectedRows.size;

    if (selectedCount === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
    } else if (selectedCount === totalRows) {
        checkbox.checked = true;
        checkbox.indeterminate = false;
    } else {
        checkbox.checked = false;
        checkbox.indeterminate = true;  // Partial selection
    }
}

// Update selection tally display
function updateSelectionTally() {
    const tallyDiv = document.getElementById('selectionTally');
    const countSpan = document.getElementById('selectedCount');
    const totalSpan = document.getElementById('selectedTotal');
    const averageSpan = document.getElementById('selectedAverage');

    if (!tallyDiv || !currentDisplayedData) return;

    const selectedCount = selectedRows.size;

    if (selectedCount === 0) {
        // Hide tally when nothing selected
        tallyDiv.style.display = 'none';
        return;
    }

    // Show tally
    tallyDiv.style.display = 'block';

    // Calculate totals from selected rows
    let totalAmount = 0;
    const transactions = currentDisplayedData.data;

    selectedRows.forEach(index => {
        const txn = transactions[index];
        if (txn) {
            totalAmount += (txn.Amount || txn.amount || 0);
        }
    });

    const averageAmount = selectedCount > 0 ? totalAmount / selectedCount : 0;

    // Update display
    countSpan.textContent = selectedCount;
    totalSpan.textContent = formatCurrency(totalAmount);
    averageSpan.textContent = formatCurrency(averageAmount);
}

// Clear all selections
function clearSelection() {
    selectedRows.clear();

    // Re-render to update checkboxes and highlighting
    displaySearchTransactions({
        transactions: currentDisplayedData.data,
        summary: currentDisplayedData.summary,
        originalQuery: currentQuery
    });
}

// Detect entity groups client-side for investigative search
function detectEntityGroupsClientSide(transactions, query) {
    /**
     * Pattern match on recipient/donor names to find related entities
     * Returns: {
     *   main_entity: [...transactions...],
     *   branches: {
     *     'NSW Branch': [...],
     *     'Victorian Branch': [...]
     *   },
     *   associated: [...transactions with Pty Ltd, Holdings, etc...]
     * }
     */
    const groups = {
        main_entity: [],
        branches: {},
        associated: []
    };

    const queryLower = query.toLowerCase();

    transactions.forEach(txn => {
        const recipient = (txn.Recipient || '').toLowerCase();
        const donor = (txn.Donor || '').toLowerCase();
        const name = recipient.includes(queryLower) ? txn.Recipient : txn.Donor;
        const nameLower = name.toLowerCase();

        // Detect branch patterns: "Australian Labor Party (NSW Branch)"
        if (nameLower.includes(queryLower) && nameLower.includes('branch')) {
            const branchMatch = name.match(/\(([^)]+)\)/);
            if (branchMatch) {
                const branchName = branchMatch[1];
                if (!groups.branches[branchName]) {
                    groups.branches[branchName] = [];
                }
                groups.branches[branchName].push(txn);
                return;
            }
        }

        // Detect associated entity patterns: contains query + "Pty Ltd", "Holdings", "Campaign"
        if (nameLower.includes(queryLower) &&
            (nameLower.includes('pty ltd') || nameLower.includes('limited') ||
             nameLower.includes('holdings') || nameLower.includes('campaign'))) {
            groups.associated.push(txn);
            return;
        }

        // Main entity: exact or close match to query
        if (nameLower.includes(queryLower)) {
            groups.main_entity.push(txn);
        }
    });

    return groups;
}

// Calculate client-side aggregations for investigative search
function calculateClientSideAggregations(transactions) {
    /**
     * Calculate summary statistics from transactions
     */
    const aggregations = {
        total_amount: 0,
        total_transactions: transactions.length,
        by_receipt_type: {},
        by_period: {},
        by_type: {},
        top_donors: {},
        top_recipients: {}
    };

    transactions.forEach(txn => {
        const amount = txn.Amount || 0;
        aggregations.total_amount += amount;

        // By receipt type
        const receiptType = txn.Receipt_Type || 'Unspecified';
        aggregations.by_receipt_type[receiptType] =
            (aggregations.by_receipt_type[receiptType] || 0) + amount;

        // By period
        const period = txn.Period || 'Unknown';
        aggregations.by_period[period] =
            (aggregations.by_period[period] || 0) + amount;

        // By type (Election Donation, Annual Return, etc.)
        const type = txn.Type || 'Other';
        aggregations.by_type[type] =
            (aggregations.by_type[type] || 0) + amount;

        // Track top donors
        const donor = txn.Donor;
        if (donor) {
            aggregations.top_donors[donor] =
                (aggregations.top_donors[donor] || 0) + amount;
        }

        // Track top recipients
        const recipient = txn.Recipient;
        if (recipient) {
            aggregations.top_recipients[recipient] =
                (aggregations.top_recipients[recipient] || 0) + amount;
        }
    });

    // Sort top donors/recipients
    aggregations.top_donors = Object.entries(aggregations.top_donors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    aggregations.top_recipients = Object.entries(aggregations.top_recipients)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    return aggregations;
}

// Render intelligence summary card (Tier 1)
function renderIntelligenceSummary(query, aggregations, entityGroups) {
    /**
     * Render Tier 1: Intelligence Summary Card
     */
    let html = '<div class="intelligence-summary">';

    // Header
    html += `<h2>${escapeHtml(query.toUpperCase())} - COMPLETE PROFILE</h2>`;

    // Key stats
    html += '<div class="summary-stats">';
    html += `<div class="stat-large">`;
    html += `<span class="value">${formatCurrency(aggregations.total_amount)}</span>`;
    html += `<span class="label">Total</span>`;
    html += `</div>`;
    html += `<div class="stat-large">`;
    html += `<span class="value">${aggregations.total_transactions}</span>`;
    html += `<span class="label">Transactions</span>`;
    html += `</div>`;
    html += '</div>';

    // Breakdowns
    html += '<div class="summary-breakdowns">';

    // By Receipt Type
    if (Object.keys(aggregations.by_receipt_type).length > 0) {
        html += '<div class="breakdown-section">';
        html += '<h4>By Source Type</h4>';
        html += '<ul class="breakdown-list">';
        Object.entries(aggregations.by_receipt_type)
            .sort((a, b) => b[1] - a[1])
            .forEach(([type, amount]) => {
                const percentage = ((amount / aggregations.total_amount) * 100).toFixed(1);
                html += `<li><strong>${type}:</strong> ${formatCurrency(amount)} (${percentage}%)</li>`;
            });
        html += '</ul></div>';
    }

    // By Period
    if (Object.keys(aggregations.by_period).length > 0) {
        html += '<div class="breakdown-section">';
        html += '<h4>By Period</h4>';
        html += '<ul class="breakdown-list">';
        Object.entries(aggregations.by_period)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([period, amount]) => {
                html += `<li><strong>${period}:</strong> ${formatCurrency(amount)}</li>`;
            });
        html += '</ul></div>';
    }

    html += '</div>'; // end summary-breakdowns

    // Entity relationships summary
    if (Object.keys(entityGroups.branches).length > 0) {
        const branchCount = Object.keys(entityGroups.branches).length;
        const branchTotal = Object.values(entityGroups.branches)
            .flat()
            .reduce((sum, txn) => sum + (txn.Amount || 0), 0);
        html += `<div class="relationship-summary">`;
        html += `<strong>Branches:</strong> ${branchCount} entities, ${formatCurrency(branchTotal)} total`;
        html += `</div>`;
    }

    if (entityGroups.associated.length > 0) {
        const associatedTotal = entityGroups.associated
            .reduce((sum, txn) => sum + (txn.Amount || 0), 0);
        html += `<div class="relationship-summary">`;
        html += `<strong>Associated Entities:</strong> ${formatCurrency(associatedTotal)} total`;
        html += `</div>`;
    }

    html += '</div>'; // end intelligence-summary

    return html;
}

// Render entity group (Tier 2)
function renderEntityGroup(groupTitle, groupData, groupId) {
    /**
     * Render Tier 2: Collapsible Entity Group
     */
    const isMap = typeof groupData === 'object' && !Array.isArray(groupData);
    const transactions = isMap ? Object.values(groupData).flat() : groupData;
    const groupTotal = transactions.reduce((sum, txn) => sum + (txn.Amount || 0), 0);

    let html = `<div class="entity-group" data-group-id="${groupId}">`;

    // Group header (collapsible)
    html += `<div class="group-header" onclick="toggleEntityGroup('${groupId}')">`;
    html += `<span class="toggle-icon" id="toggle-${groupId}">▼</span>`;
    html += `<h3>${groupTitle}</h3>`;
    html += `<span class="group-stats">${formatCurrency(groupTotal)} (${transactions.length} transactions)</span>`;
    html += `</div>`;

    // Group content (initially expanded)
    html += `<div class="group-content" id="content-${groupId}">`;

    if (isMap) {
        // Render sub-entities (e.g., individual branches)
        Object.entries(groupData).forEach(([entityName, entityTransactions]) => {
            const entityTotal = entityTransactions.reduce((sum, txn) => sum + (txn.Amount || 0), 0);
            html += `<div class="entity-item">`;
            html += `<span class="entity-name">${escapeHtml(entityName)}</span>`;
            html += `<span class="entity-stats">${formatCurrency(entityTotal)} (${entityTransactions.length} txn)</span>`;
            html += `</div>`;
        });
    } else {
        // Render top donors/recipients for this group
        const topEntities = {};
        transactions.forEach(txn => {
            const key = txn.Donor || txn.Recipient;
            topEntities[key] = (topEntities[key] || 0) + (txn.Amount || 0);
        });

        html += '<div class="top-entities">';
        html += '<h5>Top 5:</h5>';
        Object.entries(topEntities)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([name, amount]) => {
                html += `<div class="entity-item">`;
                html += `<span class="entity-name">${escapeHtml(name)}</span>`;
                html += `<span class="entity-stats">${formatCurrency(amount)}</span>`;
                html += `</div>`;
            });
        html += '</div>';
    }

    html += `</div>`; // end group-content
    html += `</div>`; // end entity-group

    return html;
}

// Toggle entity group visibility
function toggleEntityGroup(groupId) {
    const content = document.getElementById(`content-${groupId}`);
    const toggle = document.getElementById(`toggle-${groupId}`);

    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '▼';
    } else {
        content.style.display = 'none';
        toggle.textContent = '▶';
    }
}

// Render transactions table (Tier 3)
function renderTransactionsTable(transactions, summary) {
    /**
     * Render Tier 3: Individual Transactions Table
     * Keep existing table functionality (sorting, selection, filtering)
     */
    let html = '<div class="transactions-section">';
    html += '<h3>Individual Transactions</h3>';

    // Search-within-results input
    html += '<div style="margin-bottom: 1rem;">';
    html += '<input type="text" id="searchWithinResults" placeholder="Filter current results..." ';
    html += 'style="width: 100%; padding: 0.75rem; background: var(--bg-color); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; color: var(--text-primary); font-size: 1rem;">';
    html += '</div>';

    // Receipt Type filter dropdown
    html += '<div style="margin-bottom: 1rem;">';
    html += '<label style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.25rem; display: block;">Filter by Receipt Type:</label>';
    html += '<select id="receiptTypeFilter" ';
    html += 'style="width: 100%; padding: 0.75rem; background: var(--bg-color); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; color: var(--text-primary); font-size: 1rem;">';
    html += '<option value="">All Types</option>';
    html += '<option value="Donation Received">Donation Received</option>';
    html += '<option value="Other Receipt">Other Receipt</option>';
    html += '<option value="Subscription">Subscription</option>';
    html += '<option value="Public Funding">Public Funding</option>';
    html += '<option value="Unspecified">Unspecified</option>';
    html += '</select>';
    html += '</div>';

    // Selection tally section (hidden by default)
    html += '<div id="selectionTally" style="margin-bottom: 1rem; padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 0.5rem; color: white; display: none;">';
    html += '<div style="display: flex; justify-content: space-between; align-items: center;">';
    html += '<div style="font-weight: 600; font-size: 1rem;">Selected: <span id="selectedCount">0</span> transactions</div>';
    html += '<div style="display: flex; gap: 2rem; font-size: 0.95rem;">';
    html += '<div>Total: <span id="selectedTotal" style="font-weight: 600;">$0</span></div>';
    html += '<div>Average: <span id="selectedAverage" style="font-weight: 600;">$0</span></div>';
    html += '<div style="margin-left: 1rem;"><button onclick="clearSelection()" style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 0.25rem; color: white; cursor: pointer; font-size: 0.875rem;">Clear Selection</button></div>';
    html += '</div></div></div>';

    // Transactions table with sortable headers and checkboxes
    html += '<table><thead><tr>';
    html += '<th style="width: 40px;"><input type="checkbox" id="selectAllRows" onchange="toggleSelectAll()"></th>';
    html += '<th class="sortable" data-column="Donor" onclick="sortTable(\'Donor\')">Donor <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" data-column="Recipient" onclick="sortTable(\'Recipient\')">Recipient <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" data-column="Amount" onclick="sortTable(\'Amount\')">Amount <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" data-column="Date" onclick="sortTable(\'Date\')">Date <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" data-column="Period" onclick="sortTable(\'Period\')">Period <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" data-column="Type" onclick="sortTable(\'Type\')">Type <span class="sort-indicator"></span></th>';
    html += '<th class="sortable" data-column="Receipt_Type" onclick="sortTable(\'Receipt_Type\')">Receipt Type <span class="sort-indicator"></span></th>';
    html += '</tr></thead><tbody>';

    transactions.forEach((txn, index) => {
        const isSelected = selectedRows.has(index) ? 'checked' : '';
        const rowClass = selectedRows.has(index) ? 'class="selected-row"' : '';

        html += `<tr ${rowClass} data-index="${index}">`;
        html += `<td><input type="checkbox" class="row-checkbox" data-index="${index}" ${isSelected} onchange="toggleRowSelection(${index})"></td>`;
        html += `<td>${escapeHtml(txn.donor || txn.Donor || '')}</td>`;
        html += `<td>${escapeHtml(txn.recipient || txn.Recipient || '')}</td>`;
        html += `<td>${formatCurrency(txn.Amount || txn.amount || 0)}</td>`;
        html += `<td>${escapeHtml(txn.Date || txn.date || '')}</td>`;
        html += `<td>${escapeHtml(txn.period || txn.Period || '')}</td>`;
        html += `<td>${escapeHtml(txn.type || txn.Type || '')}</td>`;
        html += `<td>${escapeHtml(txn.receipt_type || txn.Receipt_Type || '')}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';

    if (transactions.length >= 100) {
        html += '<p style="margin-top: 1rem; text-align: center; color: var(--text-secondary);">Showing first 100 results. Refine your search for more specific results.</p>';
    }

    html += '</div>'; // end transactions-section

    return html;
}

// Display search transaction results with three-tier investigative structure
function displaySearchTransactions(data) {
    const resultsContainer = document.getElementById('exploreResults');
    const summary = data.summary;
    const transactions = data.transactions;
    const query = data.originalQuery || '';

    // Store unfiltered transactions for search-within-search
    allTransactions = transactions;
    currentQuery = query;

    // Store data for export
    currentDisplayedData = {
        columns: ['Donor', 'Recipient', 'Amount', 'Date', 'Period', 'Type', 'Receipt_Type'],
        data: transactions,
        summary: summary
    };

    // 1. Detect entity patterns client-side
    const entityGroups = detectEntityGroupsClientSide(transactions, query);

    // 2. Calculate aggregations
    const aggregations = calculateClientSideAggregations(transactions);

    // 3. Render three-tier structure
    let html = '';

    // TIER 1: Intelligence Summary Card
    html += renderIntelligenceSummary(query, aggregations, entityGroups);

    // TIER 2: Collapsible Entity Groups (if detected)
    const hasBranches = Object.keys(entityGroups.branches).length > 0;
    const hasAssociated = entityGroups.associated.length > 0;
    const hasMainEntity = entityGroups.main_entity.length > 0;

    if (hasBranches || hasAssociated || hasMainEntity) {
        html += '<div class="entity-groups-section">';

        // Main entity group
        if (hasMainEntity) {
            html += renderEntityGroup('Main Entity', entityGroups.main_entity, 'main');
        }

        // Branch entities
        if (hasBranches) {
            html += renderEntityGroup('State/Territory Branches', entityGroups.branches, 'branches');
        }

        // Associated entities
        if (hasAssociated) {
            html += renderEntityGroup('Associated Entities', entityGroups.associated, 'associated');
        }

        html += '</div>';
    }

    // TIER 3: Full Transaction Table (existing functionality)
    html += renderTransactionsTable(transactions, summary);

    resultsContainer.innerHTML = html;

    // Setup search-within-results after rendering
    setupSearchWithinResults();

    // Setup receipt type filter after rendering
    setupReceiptTypeFilter();

    // Update sort indicators
    updateSortIndicators();

    // Update selection tally
    updateSelectionTally();

    // Update select all checkbox state
    updateSelectAllCheckbox();
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
