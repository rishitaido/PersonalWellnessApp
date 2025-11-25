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

// Get all entries for the logged-in user
router.get('/', requireAuth, async (req, res) => {
    try {
        const [entries] = await db.query(
            'SELECT * FROM entries WHERE user_id = ? ORDER BY date DESC',
            [req.session.userId]
        );
        res.json(entries);
    } catch (error) {
        console.error('Error fetching entries:', error);
        res.status(500).json({ error: 'Server error fetching entries' });
    }
});

// Get a specific entry
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const [entries] = await db.query(
            'SELECT * FROM entries WHERE id = ? AND user_id = ?',
            [req.params.id, req.session.userId]
        );

        if (entries.length === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        res.json(entries[0]);
    } catch (error) {
        console.error('Error fetching entry:', error);
        res.status(500).json({ error: 'Server error fetching entry' });
    }
});

// Create a new entry
router.post('/', requireAuth, async (req, res) => {
    try {
        const { date, mood, sleep_hours, exercise_minutes, notes } = req.body;

        const [result] = await db.query(
            `INSERT INTO entries (user_id, date, mood, sleep_hours, exercise_minutes, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.session.userId, date, mood, sleep_hours, exercise_minutes, notes]
        );

        res.json({ success: true, entryId: result.insertId });
    } catch (error) {
        console.error('Error creating entry:', error);
        res.status(500).json({ error: 'Server error creating entry' });
    }
});

// Update an entry
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { date, mood, sleep_hours, exercise_minutes, notes } = req.body;

        const [result] = await db.query(
            `UPDATE entries 
             SET date = ?, mood = ?, sleep_hours = ?, exercise_minutes = ?, notes = ?
             WHERE id = ? AND user_id = ?`,
            [date, mood, sleep_hours, exercise_minutes, notes, req.params.id, req.session.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating entry:', error);
        res.status(500).json({ error: 'Server error updating entry' });
    }
});

// Delete an entry
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const [result] = await db.query(
            'DELETE FROM entries WHERE id = ? AND user_id = ?',
            [req.params.id, req.session.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting entry:', error);
        res.status(500).json({ error: 'Server error deleting entry' });
    }
});

module.exports = router;
