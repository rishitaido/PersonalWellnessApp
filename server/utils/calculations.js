// Helper functions for statistical calculations and predictions

// Calculate correlation coefficient between two arrays
function calculateCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    return numerator / denominator;
}

// Calculate moving average
function movingAverage(data, windowSize) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const window = data.slice(start, i + 1);
        const avg = window.reduce((a, b) => a + b, 0) / window.length;
        result.push(avg);
    }
    return result;
}

// Calculate trend line (linear regression)
function calculateTrendLine(data) {
    const n = data.length;
    if (n === 0) return { slope: 0, intercept: 0 };

    const x = data.map((_, i) => i);
    const y = data;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

// Predict weight loss based on calorie deficit
function predictWeightLoss(currentWeight, dailyDeficit, weeks, userHistory = null) {
    // Basic calculation: 3500 calories = 1 lb
    const totalDeficit = dailyDeficit * 7 * weeks;
    const expectedLoss = totalDeficit / 3500;

    // If we have user history, adjust based on their actual results
    if (userHistory && userHistory.length > 0) {
        // Calculate user's actual deficit-to-loss ratio
        const actualRatio = userHistory.actualLoss / userHistory.totalDeficit;
        const standardRatio = 1 / 3500;
        const adjustmentFactor = actualRatio / standardRatio;

        return currentWeight - (expectedLoss * adjustmentFactor);
    }

    return currentWeight - expectedLoss;
}

// Calculate TDEE (Total Daily Energy Expenditure)
function calculateTDEE(weight_kg, height_cm, age, gender, activityLevel = 1.55) {
    // Mifflin-St Jeor Equation
    let bmr;
    if (gender.toLowerCase() === 'male') {
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
    } else {
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161;
    }

    // Activity multipliers:
    // 1.2 = sedentary, 1.375 = light, 1.55 = moderate, 1.725 = very active, 1.9 = extra active
    return Math.round(bmr * activityLevel);
}

// Calculate data completeness score
function calculateDataCompleteness(entries, dateRange) {
    const totalDays = Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24));
    const daysWithData = entries.length;

    return {
        score: (daysWithData / totalDays * 100).toFixed(1),
        daysTracked: daysWithData,
        totalDays: totalDays
    };
}

// Find best and worst weeks
function analyzeBestWorstWeeks(weeklyData) {
    if (weeklyData.length === 0) return { best: null, worst: null };

    // Sort by weight change (most loss = best)
    const sorted = [...weeklyData].sort((a, b) => a.weight_change - b.weight_change);

    return {
        best: sorted[0], // Most weight lost
        worst: sorted[sorted.length - 1] // Most weight gained or least lost
    };
}

// Calculate weekly deficit vs actual loss
function analyzeDeficitEfficiency(weekData) {
    const expectedLoss = (weekData.avg_deficit * 7) / 3500; // in lbs
    const actualLoss = weekData.weight_change;
    const efficiency = (actualLoss / expectedLoss) * 100;

    return {
        expectedLoss,
        actualLoss,
        efficiency: efficiency.toFixed(1)
    };
}

module.exports = {
    calculateCorrelation,
    movingAverage,
    calculateTrendLine,
    predictWeightLoss,
    calculateTDEE,
    calculateDataCompleteness,
    analyzeBestWorstWeeks,
    analyzeDeficitEfficiency
};