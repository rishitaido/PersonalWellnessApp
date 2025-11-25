const express = require('express');
const router = express.Router();
const db = require('./database/db');
const {
    calculateCorrelation,
    movingAverage,
    calculateTrendLine,
    predictWeightLoss,
    calculateTDEE,
    analyzeBestWorstWeeks
} = require('../utils/calculations');

// Middleware to check authentication
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

// Get dashboard summary
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Get user profile
        const [users] = await db.query(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );
        const user = users[0];

        // Get all entries
        const [entries] = await db.query(
            `SELECT * FROM health_entries 
             WHERE user_id = ? 
             ORDER BY entry_date ASC`,
            [userId]
        );

        // Calculate current stats
        const recentEntries = entries.slice(-30); // Last 30 days
        const avgCalories = recentEntries
            .filter(e => e.calories_intake)
            .reduce((sum, e) => sum + e.calories_intake, 0) / recentEntries.filter(e => e.calories_intake).length || 0;

        const avgSleep = recentEntries
            .filter(e => e.sleep_hours)
            .reduce((sum, e) => sum + e.sleep_hours, 0) / recentEntries.filter(e => e.sleep_hours).length || 0;

        const avgExercise = recentEntries
            .filter(e => e.exercise_minutes)
            .reduce((sum, e) => sum + e.exercise_minutes, 0) / recentEntries.filter(e => e.exercise_minutes).length || 0;

        // Get weight data
        const weightEntries = entries.filter(e => e.weight);
        const currentWeight = weightEntries.length > 0 ?
            weightEntries[weightEntries.length - 1].weight * 2.20462 : user.weight_kg * 2.20462;
        const startingWeight = user.starting_weight_kg * 2.20462;
        const goalWeight = user.goal_weight_kg * 2.20462;
        const weightLost = startingWeight - currentWeight;
        const weightToGo = currentWeight - goalWeight;
        const progressPercent = ((startingWeight - currentWeight) / (startingWeight - goalWeight)) * 100;

        // Calculate TDEE
        const tdee = calculateTDEE(user.weight_kg, user.height_cm, user.age, user.gender);
        const avgDeficit = tdee - avgCalories;

        // Predict timeline to goal
        const weeksToGoal = avgDeficit > 0 ?
            Math.ceil((weightToGo * 3500) / (avgDeficit * 7)) : null;

        // Get weight trend
        const weightData = weightEntries.map(e => ({
            date: e.entry_date,
            weight: (e.weight * 2.20462).toFixed(1)
        }));

        // Calculate trend line
        const weights = weightEntries.map(e => e.weight * 2.20462);
        const trend = calculateTrendLine(weights);

        res.json({
            success: true,
            user: {
                username: user.username,
                age: user.age,
                gender: user.gender,
                height_ft: Math.floor(user.height_cm / 30.48),
                height_in: Math.round((user.height_cm % 30.48) / 2.54)
            },
            current: {
                weight: currentWeight.toFixed(1),
                avgCalories: Math.round(avgCalories),
                avgSleep: avgSleep.toFixed(1),
                avgExercise: Math.round(avgExercise)
            },
            goals: {
                startingWeight: startingWeight.toFixed(1),
                goalWeight: goalWeight.toFixed(1),
                weightLost: weightLost.toFixed(1),
                weightToGo: weightToGo.toFixed(1),
                progressPercent: progressPercent.toFixed(1)
            },
            predictions: {
                tdee: tdee,
                avgDeficit: Math.round(avgDeficit),
                weeksToGoal: weeksToGoal,
                projectedDate: weeksToGoal ?
                    new Date(Date.now() + weeksToGoal * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null
            },
            weightData: weightData,
            trend: {
                slope: trend.slope.toFixed(4),
                isLosing: trend.slope < 0
            },
            dataQuality: {
                totalDays: entries.length,
                daysWithCalories: entries.filter(e => e.calories_intake).length,
                daysWithSleep: entries.filter(e => e.sleep_hours).length,
                daysWithExercise: entries.filter(e => e.exercise_minutes).length,
                daysWithWeight: weightEntries.length
            }
        });

    } catch (error) {
        console.error('Dashboard analytics error:', error);
        res.status(500).json({ error: 'Server error calculating analytics' });
    }
});

// Get correlations
router.get('/correlations', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Get entries with all data points
        const [entries] = await db.query(
            `SELECT * FROM health_entries 
             WHERE user_id = ? 
             AND sleep_hours IS NOT NULL 
             AND exercise_minutes IS NOT NULL
             ORDER BY entry_date ASC`,
            [userId]
        );

        if (entries.length < 10) {
            return res.json({
                success: true,
                message: 'Need at least 10 complete days of data for correlation analysis',
                correlations: []
            });
        }

        const sleep = entries.map(e => e.sleep_hours);
        const exercise = entries.map(e => e.exercise_minutes);
        const calories = entries.filter(e => e.calories_intake).map(e => e.calories_intake);

        const correlations = [
            {
                name: 'Sleep vs Exercise',
                value: calculateCorrelation(sleep, exercise).toFixed(3),
                interpretation: interpretCorrelation(calculateCorrelation(sleep, exercise))
            }
        ];

        // Add more correlations if we have the data
        if (calories.length >= 10) {
            const sleepWithCalories = entries.filter(e => e.calories_intake).map(e => e.sleep_hours);
            correlations.push({
                name: 'Sleep vs Calorie Intake',
                value: calculateCorrelation(sleepWithCalories, calories).toFixed(3),
                interpretation: interpretCorrelation(calculateCorrelation(sleepWithCalories, calories))
            });
        }

        res.json({
            success: true,
            correlations,
            sampleSize: entries.length
        });

    } catch (error) {
        console.error('Correlation calculation error:', error);
        res.status(500).json({ error: 'Server error calculating correlations' });
    }
});

function interpretCorrelation(r) {
    const abs = Math.abs(r);
    if (abs > 0.7) return 'Strong';
    if (abs > 0.4) return 'Moderate';
    if (abs > 0.2) return 'Weak';
    return 'Very Weak';
}

// Get weekly summary
router.get('/weekly', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Get last 8 weeks of data
        const [entries] = await db.query(
            `SELECT * FROM health_entries 
             WHERE user_id = ? 
             AND entry_date >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
             ORDER BY entry_date ASC`,
            [userId]
        );

        // Group by week
        const weeks = {};
        entries.forEach(entry => {
            const date = new Date(entry.entry_date);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
            const weekKey = weekStart.toISOString().split('T')[0];

            if (!weeks[weekKey]) {
                weeks[weekKey] = {
                    weekStart: weekKey,
                    entries: []
                };
            }
            weeks[weekKey].entries.push(entry);
        });

        // Calculate weekly summaries
        const weeklySummaries = Object.values(weeks).map(week => {
            const entries = week.entries;
            const withCalories = entries.filter(e => e.calories_intake);
            const withSleep = entries.filter(e => e.sleep_hours);
            const withExercise = entries.filter(e => e.exercise_minutes);
            const withWeight = entries.filter(e => e.weight);

            return {
                weekStart: week.weekStart,
                daysLogged: entries.length,
                avgCalories: withCalories.length > 0 ?
                    Math.round(withCalories.reduce((sum, e) => sum + e.calories_intake, 0) / withCalories.length) : null,
                avgSleep: withSleep.length > 0 ?
                    (withSleep.reduce((sum, e) => sum + e.sleep_hours, 0) / withSleep.length).toFixed(1) : null,
                avgExercise: withExercise.length > 0 ?
                    Math.round(withExercise.reduce((sum, e) => sum + e.exercise_minutes, 0) / withExercise.length) : null,
                weightChange: withWeight.length >= 2 ?
                    ((withWeight[withWeight.length - 1].weight - withWeight[0].weight) * 2.20462).toFixed(1) : null
            };
        });

        res.json({
            success: true,
            weeks: weeklySummaries
        });

    } catch (error) {
        console.error('Weekly summary error:', error);
        res.status(500).json({ error: 'Server error calculating weekly summary' });
    }
});

module.exports = router;