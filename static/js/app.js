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

// Global search with debouncing
function setupGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');

    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        if (query.length < 2) {
            // Show default message
            const resultsContainer = document.getElementById('exploreResults');
            if (resultsContainer) {
                resultsContainer.innerHTML = '<div class="loading">Type at least 2 characters to search...</div>';
            }
            return;
        }

        // Debounce search
        searchTimeout = setTimeout(() => {
            performGlobalSearch(query);
        }, 300);
    });
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
        html += `<td>${escapeHtml(txn.Donor || '')}</td>`;
        html += `<td>${escapeHtml(txn.Recipient || '')}</td>`;
        html += `<td>${formatCurrency(txn.Amount)}</td>`;
        html += `<td>${escapeHtml(txn.Date || '')}</td>`;
        html += `<td>${escapeHtml(txn.Period || '')}</td>`;
        html += `<td>${escapeHtml(txn.Type || '')}</td>`;
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
    if (compareCheckbox && compareCheckbox.checked) {
        // TODO: Implement comparison view
        console.log('Compare mode enabled');
    }
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
