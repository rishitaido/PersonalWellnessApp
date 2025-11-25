// Check authentication
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();

        if (!data.authenticated) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login.html';
    }
}

// Load import status
async function loadImportStatus() {
    try {
        const response = await fetch('/api/import/status');
        const data = await response.json();

        if (data.success) {
            const stats = data.stats;
            const statusDiv = document.getElementById('import-status');

            const firstEntry = stats.first_entry ? new Date(stats.first_entry).toLocaleDateString() : 'N/A';
            const lastEntry = stats.last_entry ? new Date(stats.last_entry).toLocaleDateString() : 'N/A';

            const caloriesPct = stats.total_entries > 0 ?
                Math.round((stats.days_with_calories / stats.days_tracked) * 100) : 0;
            const sleepPct = stats.total_entries > 0 ?
                Math.round((stats.days_with_sleep / stats.days_tracked) * 100) : 0;
            const exercisePct = stats.total_entries > 0 ?
                Math.round((stats.days_with_exercise / stats.days_tracked) * 100) : 0;
            const weightPct = stats.total_entries > 0 ?
                Math.round((stats.days_with_weight / stats.days_tracked) * 100) : 0;

            statusDiv.innerHTML = `
                <div class="stats-grid">
                    <div class="stat">
                        <div class="stat-value">${stats.days_tracked}</div>
                        <div class="stat-label">Days Tracked</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${firstEntry}</div>
                        <div class="stat-label">First Entry</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${lastEntry}</div>
                        <div class="stat-label">Last Entry</div>
                    </div>
                </div>
                
                <div class="data-completeness">
                    <h4>Data Completeness:</h4>
                    <div class="progress-bar">
                        <div class="progress-label">Calories: ${caloriesPct}%</div>
                        <div class="progress-fill" style="width: ${caloriesPct}%"></div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-label">Sleep: ${sleepPct}%</div>
                        <div class="progress-fill" style="width: ${sleepPct}%"></div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-label">Exercise: ${exercisePct}%</div>
                        <div class="progress-fill" style="width: ${exercisePct}%"></div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-label">Weight: ${weightPct}%</div>
                        <div class="progress-fill" style="width: ${weightPct}%"></div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load import status:', error);
        document.getElementById('import-status').innerHTML = '<p>No data imported yet</p>';
    }
}

// CSV Import
document.getElementById('csv-import-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const statusDiv = document.getElementById('csv-status');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    statusDiv.textContent = '⏳ Uploading and processing CSV files...';
    statusDiv.className = 'status-message info';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    const formData = new FormData();
    const files = document.getElementById('csv-files').files;

    if (files.length === 0) {
        statusDiv.textContent = '❌ Please select at least one file';
        statusDiv.className = 'status-message error';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Import CSV Files';
        return;
    }

    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }

    try {
        const response = await fetch('/api/import/csv/calories', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            statusDiv.innerHTML = `
                <p class="success">✅ ${result.message}</p>
                ${result.errors ? '<p class="warning">⚠️ Some files had errors (check console)</p>' : ''}
            `;
            statusDiv.className = 'status-message success';

            // Reload status
            await loadImportStatus();

            // Clear file input
            document.getElementById('csv-files').value = '';
        } else {
            statusDiv.innerHTML = `<p class="error">❌ Error: ${result.error}</p>`;
            statusDiv.className = 'status-message error';
        }
    } catch (error) {
        console.error('Import error:', error);
        statusDiv.innerHTML = `<p class="error">❌ Upload failed: ${error.message}</p>`;
        statusDiv.className = 'status-message error';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Import CSV Files';
    }
});

// XML Import
document.getElementById('xml-import-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const statusDiv = document.getElementById('xml-status');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    statusDiv.textContent = '⏳ Processing Apple Health XML... (this may take a minute)';
    statusDiv.className = 'status-message info';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    const formData = new FormData();
    const file = document.getElementById('xml-file').files[0];

    if (!file) {
        statusDiv.textContent = '❌ Please select a file';
        statusDiv.className = 'status-message error';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Import Apple Health XML';
        return;
    }

    formData.append('file', file);

    try {
        const response = await fetch('/api/import/xml/health', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            statusDiv.innerHTML = `<p class="success">✅ ${result.message}</p>`;
            statusDiv.className = 'status-message success';

            // Reload status
            await loadImportStatus();

            // Clear file input
            document.getElementById('xml-file').value = '';
        } else {
            statusDiv.innerHTML = `<p class="error">❌ Error: ${result.error}</p>`;
            statusDiv.className = 'status-message error';
        }
    } catch (error) {
        console.error('Import error:', error);
        statusDiv.innerHTML = `<p class="error">❌ Upload failed: ${error.message}</p>`;
        statusDiv.className = 'status-message error';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Import Apple Health XML';
    }
});

// Manual Entry
document.getElementById('manual-entry-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const statusDiv = document.getElementById('manual-status');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    const entryData = {
        entry_date: document.getElementById('entry-date').value,
        weight: document.getElementById('weight').value ?
            (parseFloat(document.getElementById('weight').value) / 2.20462).toFixed(2) : null, // Convert lbs to kg
        calories_intake: document.getElementById('calories').value || null,
        sleep_hours: document.getElementById('sleep').value || null,
        exercise_minutes: document.getElementById('exercise').value || null,
        exercise_type: document.getElementById('exercise-type').value || null,
        notes: document.getElementById('notes').value || null,
        data_source: 'manual'
    };

    // Validate at least one field is filled
    if (!entryData.weight && !entryData.calories_intake && !entryData.sleep_hours && !entryData.exercise_minutes) {
        statusDiv.textContent = '❌ Please fill in at least one field';
        statusDiv.className = 'status-message error';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
        const response = await fetch('/api/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entryData)
        });

        const result = await response.json();

        if (result.success) {
            statusDiv.innerHTML = '<p class="success">✅ Entry added successfully!</p>';
            statusDiv.className = 'status-message success';

            // Clear form
            document.getElementById('manual-entry-form').reset();

            // Set date to today
            document.getElementById('entry-date').valueAsDate = new Date();

            // Reload status
            await loadImportStatus();
        } else {
            statusDiv.innerHTML = `<p class="error">❌ ${result.error}</p>`;
            statusDiv.className = 'status-message error';
        }
    } catch (error) {
        console.error('Manual entry error:', error);
        statusDiv.innerHTML = `<p class="error">❌ Failed to add entry: ${error.message}</p>`;
        statusDiv.className = 'status-message error';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Entry';
    }
});

// Set today's date as default
document.getElementById('entry-date').valueAsDate = new Date();

// Logout handler
document.getElementById('logout-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
});

// Initialize
checkAuth();
loadImportStatus();