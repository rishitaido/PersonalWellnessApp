const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('./database/db');

// Signup route
router.post('/signup', async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            height_ft,
            height_in,
            weight_lbs,
            age,
            gender,
            goal_weight_lbs,
            starting_weight_lbs
        } = req.body;

        // Check if user already exists
        const [existingUsers] = await db.query(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Convert imperial to metric for storage
        const height_cm = Math.round((height_ft * 12 + height_in) * 2.54);
        const weight_kg = (weight_lbs / 2.20462).toFixed(2);
        const goal_weight_kg = goal_weight_lbs ? (goal_weight_lbs / 2.20462).toFixed(2) : null;
        const starting_weight_kg = starting_weight_lbs ? (starting_weight_lbs / 2.20462).toFixed(2) : weight_kg;

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Insert new user
        const [result] = await db.query(
            `INSERT INTO users 
            (username, email, password_hash, height_cm, weight_kg, age, gender, 
             goal_weight_kg, starting_weight_kg, units_preference) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'imperial')`,
            [username, email, password_hash, height_cm, weight_kg, age, gender,
                goal_weight_kg, starting_weight_kg]
        );

        // Create session
        req.session.userId = result.insertId;
        req.session.username = username;

        res.json({ success: true, message: 'Account created successfully' });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error during signup' });
    }
});

// Login route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user
        const [users] = await db.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = users[0];

        // Compare password
        const isValid = await bcrypt.compare(password, user.password_hash);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Create session
        req.session.userId = user.id;
        req.session.username = user.username;

        res.json({ success: true, message: 'Login successful' });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Logout route
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Check if user is authenticated
router.get('/check', (req, res) => {
    if (req.session.userId) {
        res.json({
            authenticated: true,
            userId: req.session.userId,
            username: req.session.username
        });
    } else {
        res.json({ authenticated: false });
    }
});

module.exports = router;