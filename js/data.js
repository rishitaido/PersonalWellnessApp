let allEntries = [];
let filteredEntries = [];
let currentPage = 1;
const entriesPerPage = 50;

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();

        if (!data.authenticated) {
            window.location.href = '/index.html';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/index.html';
    }
}

// Load all entries
async function loadEntries() {
    try {
        const response = await fetch('/api/entries');
        const data = await response.json();

        if (data.success) {
            allEntries = data.entries;
            filteredEntries = [...allEntries];
            updateSummary();
            renderTable();
        }
    } catch (error) {
        console.error('Failed to load entries:', error);
    }
}

// Update summary statistics
function updateSummary() {
    const entries = filteredEntries;

    document.getElementById('total-entries').textContent = entries.length;

    if (entries.length > 0) {
        const dates = entries.map(e => new Date(e.entry_date));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        document.getElementById('date-range').textContent =
            `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`;

        // Calculate averages
        const withCalories = entries.filter(e => e.calories_intake);
        const avgCalories = withCalories.length > 0 ?
            Math.round(withCalories.reduce((sum, e) => sum + e.calories_intake, 0) / withCalories.length) : 0;
        document.getElementById('summary-calories').textContent = avgCalories;

        const withSleep = entries.filter(e => e.sleep_hours);
        const avgSleep = withSleep.length > 0 ?
            (withSleep.reduce((sum, e) => sum + e.sleep_hours, 0) / withSleep.length).toFixed(1) : 0;
        document.getElementById('summary-sleep').textContent = avgSleep;
    } else {
        document.getElementById('date-range').textContent = 'No data';
        document.getElementById('summary-calories').textContent = '--';
        document.getElementById('summary-sleep').textContent = '--';
    }
}

// Render table
function renderTable() {
    const tbody = document.getElementById('data-tbody');
    const start = (currentPage - 1) * entriesPerPage;
    const end = start + entriesPerPage;
    const pageEntries = filteredEntries.slice(start, end);

    if (pageEntries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No entries found</td></tr>';
        return;
    }

    tbody.innerHTML = pageEntries.map(entry => {
        const date = new Date(entry.entry_date).toLocaleDateString();
        const weight = entry.weight ? (entry.weight * 2.20462).toFixed(1) : '--';
        const calories = entry.calories_intake || '--';
        const sleep = entry.sleep_hours ? entry.sleep_hours.toFixed(1) : '--';
        const exercise = entry.exercise_minutes || '--';
        const source = entry.data_source || 'manual';

        return `
            <tr>
                <td>${date}</td>
                <td>${weight}</td>
                <td>${calories}</td>
                <td>${sleep}</td>
                <td>${exercise}</td>
                <td><span class="badge">${source}</span></td>
                <td>
                    <button onclick="viewEntry(${entry.id})" class="btn-small">View</button>
                    <button onclick="deleteEntry(${entry.id})" class="btn-small btn-danger">Delete</button>
                </td>
            </tr>
        `;
    }).join('');

    renderPagination();
}

// Render pagination
function renderPagination() {
    const totalPages = Math.ceil(filteredEntries.length / entriesPerPage);
    const pagination = document.getElementById('pagination');

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    pagination.innerHTML = html;
}

// Filter data
function filterData() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    filteredEntries = allEntries.filter(entry => {
        const entryDate = entry.entry_date;
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        return true;
    });

    currentPage = 1;
    updateSummary();
    renderTable();
}

// Clear filters
function clearFilters() {
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
    filteredEntries = [...allEntries];
    currentPage = 1;
    updateSummary();
    renderTable();
}

// Go to page
function goToPage(page) {
    currentPage = page;
    renderTable();
}

// View entry details
function viewEntry(id) {
    const entry = allEntries.find(e => e.id === id);
    if (entry) {
        alert(`Entry Details:\n\nDate: ${entry.entry_date}\nCalories: ${entry.calories_intake || 'N/A'}\nSleep: ${entry.sleep_hours || 'N/A'} hrs\nExercise: ${entry.exercise_minutes || 'N/A'} min\nNotes: ${entry.notes || 'None'}`);
    }
}

// Delete entry
async function deleteEntry(id) {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
        const response = await fetch(`/api/entries/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            alert('Entry deleted successfully');
            loadEntries(); // Reload data
        } else {
            alert('Failed to delete entry: ' + data.error);
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Error deleting entry');
    }
}

// Logout handler
document.getElementById('logout-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/index.html';
});

// Initialize
checkAuth();
loadEntries();