let weightChart = null;

// Check authentication - improved version
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();

        console.log('Auth check result:', data); // Debug logging

        if (!data.authenticated) {
            console.log('Not authenticated, redirecting to login...');
            window.location.href = '/index.html';
            return false;
        } else {
            console.log('Authenticated as:', data.username);
            document.getElementById('username').textContent = data.username;
            return true;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/index.html';
        return false;
    }
}

// Load dashboard data
async function loadDashboard() {
    try {
        const response = await fetch('/api/analytics/dashboard');
        const data = await response.json();

        if (data.success) {
            updateDashboard(data);
            createWeightChart(data.weightData, data.goals);
        } else {
            console.error('Failed to load dashboard:', data.error);
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

// Update dashboard elements
function updateDashboard(data) {
    // Current stats
    document.getElementById('current-weight').textContent = `${data.current.weight} lbs`;
    document.getElementById('goal-weight').textContent = `${data.goals.goalWeight} lbs`;
    document.getElementById('weight-lost').textContent = `${data.goals.weightLost} lbs`;
    document.getElementById('weight-to-go').textContent = `${data.goals.weightToGo} lbs to go`;
    document.getElementById('progress-percent').textContent = `${data.goals.progressPercent}% progress`;

    // Weight change indicator
    const weightChange = document.getElementById('weight-change');
    if (data.trend.isLosing) {
        weightChange.textContent = `↓ Trending down`;
        weightChange.style.color = '#28a745';
    } else {
        weightChange.textContent = `↑ Trending up`;
        weightChange.style.color = '#dc3545';
    }

    // Goal date
    if (data.predictions.weeksToGoal) {
        document.getElementById('goal-date').textContent =
            new Date(data.predictions.projectedDate).toLocaleDateString();
        document.getElementById('weeks-to-goal').textContent =
            `${data.predictions.weeksToGoal} weeks away`;
    } else {
        document.getElementById('goal-date').textContent = 'N/A';
        document.getElementById('weeks-to-goal').textContent = 'Increase deficit';
    }

    // Averages
    document.getElementById('avg-calories').textContent = `${data.current.avgCalories} cal`;
    document.getElementById('avg-sleep').textContent = `${data.current.avgSleep} hrs`;
    document.getElementById('avg-exercise').textContent = `${data.current.avgExercise} min`;
    document.getElementById('avg-deficit').textContent = `${data.predictions.avgDeficit} cal`;

    // Your numbers
    document.getElementById('tdee').textContent = `${data.predictions.tdee} cal`;
    document.getElementById('height').textContent = `${data.user.height_ft}'${data.user.height_in}"`;
    document.getElementById('age').textContent = data.user.age;
    document.getElementById('gender').textContent =
        data.user.gender.charAt(0).toUpperCase() + data.user.gender.slice(1);

    // Data quality
    const quality = data.dataQuality;
    const caloriesPct = ((quality.daysWithCalories / quality.totalDays) * 100).toFixed(0);
    const sleepPct = ((quality.daysWithSleep / quality.totalDays) * 100).toFixed(0);
    const exercisePct = ((quality.daysWithExercise / quality.totalDays) * 100).toFixed(0);
    const weightPct = ((quality.daysWithWeight / quality.totalDays) * 100).toFixed(0);

    document.getElementById('data-quality').innerHTML = `
        <div class="quality-stats">
            <div class="quality-item">
                <span>Total Days Tracked:</span>
                <strong>${quality.totalDays}</strong>
            </div>
            <div class="quality-item">
                <span>Calories:</span>
                <strong>${caloriesPct}%</strong>
            </div>
            <div class="quality-item">
                <span>Sleep:</span>
                <strong>${sleepPct}%</strong>
            </div>
            <div class="quality-item">
                <span>Exercise:</span>
                <strong>${exercisePct}%</strong>
            </div>
            <div class="quality-item">
                <span>Weight:</span>
                <strong>${weightPct}%</strong>
            </div>
        </div>
    `;
}

// Create weight chart
function createWeightChart(weightData, goals) {
    const ctx = document.getElementById('weightChart').getContext('2d');

    // Destroy existing chart if it exists
    if (weightChart) {
        weightChart.destroy();
    }

    const labels = weightData.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const weights = weightData.map(d => parseFloat(d.weight));

    // Create goal line (flat line at goal weight)
    const goalLine = new Array(weights.length).fill(parseFloat(goals.goalWeight));

    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Weight',
                    data: weights,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Goal',
                    data: goalLine,
                    borderColor: '#28a745',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function (value) {
                            return value + ' lbs';
                        }
                    }
                }
            }
        }
    });
}

// Logout handler
document.getElementById('logout-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/index.html';
});

// Initialize
checkAuth();
loadDashboard();