const express = require('express');
const router = express.Router();
const db = require('./database/db');

// Middleware to check authentication
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

// Helper function to convert units
function convertUnits(data, toUnit) {
    if (toUnit === 'imperial') {
        return {
            ...data,
            weight_lbs: data.weight_kg ? (data.weight_kg * 2.20462).toFixed(1) : null,
            goal_weight_lbs: data.goal_weight_kg ? (data.goal_weight_kg * 2.20462).toFixed(1) : null,
            starting_weight_lbs: data.starting_weight_kg ? (data.starting_weight_kg * 2.20462).toFixed(1) : null,
            height_ft: data.height_cm ? Math.floor(data.height_cm / 30.48) : null,
            height_in: data.height_cm ? Math.round((data.height_cm % 30.48) / 2.54) : null
        };
    }
    return data;
}

// Get user profile
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const [users] = await db.query(
            `SELECT id, username, email, height_cm, weight_kg, age, gender, 
                    goal_weight_kg, starting_weight_kg, goal_date, units_preference, created_at 
             FROM users WHERE id = ?`,
            [req.session.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];
        const unitsPreference = user.units_preference || 'imperial';
        const userData = convertUnits(user, unitsPreference);

        res.json({ success: true, user: userData });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Server error fetching profile' });
    }
});

// Update user profile
router.put('/profile', requireAuth, async (req, res) => {
    try {
        const {
            height_ft,
            height_in,
            weight_lbs,
            age,
            gender,
            goal_weight_lbs,
            goal_date,
            units_preference
        } = req.body;

        // Convert to metric for storage
        const height_cm = height_ft && height_in ? Math.round((height_ft * 12 + height_in) * 2.54) : null;
        const weight_kg = weight_lbs ? (weight_lbs / 2.20462).toFixed(2) : null;
        const goal_weight_kg = goal_weight_lbs ? (goal_weight_lbs / 2.20462).toFixed(2) : null;

        const [result] = await db.query(
            `UPDATE users 
             SET height_cm = ?, weight_kg = ?, age = ?, gender = ?, 
                 goal_weight_kg = ?, goal_date = ?, units_preference = ?
             WHERE id = ?`,
            [height_cm, weight_kg, age, gender, goal_weight_kg, goal_date,
                units_preference || 'imperial', req.session.userId]
        );

        res.json({ success: true, message: 'Profile updated successfully' });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Server error updating profile' });
    }
});

module.exports = router;