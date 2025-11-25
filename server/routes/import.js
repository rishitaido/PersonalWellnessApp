const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { XMLParser } = require('fast-xml-parser');
const db = require('./database/db');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware to check authentication
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

// Parse CSV calories file - Updated for Food Diary format
async function parseCaloriesCSV(filePath, userId) {
    return new Promise((resolve, reject) => {
        const results = [];
        let foundDataSection = false;

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
                // Skip header/summary lines - look for actual date entries
                const dateField = data.Date || data.date;

                if (!dateField || dateField.includes('#') || dateField.includes('Daily Average')) {
                    return; // Skip non-data rows
                }

                // Parse the date (format: "Friday, August 1, 2025")
                let entryDate;
                try {
                    // Remove day of week if present
                    const dateStr = dateField.replace(/^[A-Za-z]+,\s*/, '');
                    entryDate = new Date(dateStr);

                    // Convert to YYYY-MM-DD format for MySQL
                    const year = entryDate.getFullYear();
                    const month = String(entryDate.getMonth() + 1).padStart(2, '0');
                    const day = String(entryDate.getDate()).padStart(2, '0');
                    entryDate = `${year}-${month}-${day}`;
                } catch (e) {
                    console.error('Date parse error:', dateField);
                    return;
                }

                // Get calories (the format is "Cals ( kcal)" with a space)
                const calories = parseInt(data['Cals ( kcal)'] || data['Cals (kcal)'] || data.Calories || 0);

                // Only add if we have valid data
                if (entryDate && calories > 0) {
                    results.push({
                        date: entryDate,
                        calories: calories,
                        fat: parseFloat(data['Fat( g)'] || 0),
                        carbs: parseFloat(data['Carbs( g)'] || 0),
                        protein: parseFloat(data['Prot( g)'] || 0)
                    });
                }
            })
            .on('end', () => {
                console.log(`Parsed ${results.length} entries from CSV`);
                resolve(results);
            })
            .on('error', reject);
    });
}

// Parse Apple Health XML
async function parseAppleHealthXML(filePath, userId) {
    const xmlData = fs.readFileSync(filePath, 'utf8');
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: ''
    });

    const result = parser.parse(xmlData);
    const records = result.HealthData?.Record || [];

    // Group data by date
    const entriesByDate = {};

    records.forEach(record => {
        if (!record.startDate) return;

        const date = record.startDate.split(' ')[0]; // Get just the date part (YYYY-MM-DD)

        if (!entriesByDate[date]) {
            entriesByDate[date] = {
                sleep_hours: 0,
                calories_burned: 0,
                exercise_minutes: 0,
                weight_lbs: null
            };
        }

        // Parse different record types
        switch (record.type) {
            case 'HKCategoryTypeIdentifierSleepAnalysis':
                // Calculate sleep duration
                const start = new Date(record.startDate);
                const end = new Date(record.endDate);
                const hours = (end - start) / (1000 * 60 * 60);
                if (record.value === 'HKCategoryValueSleepAnalysisAsleep' ||
                    record.value === 'HKCategoryValueSleepAnalysisInBed') {
                    entriesByDate[date].sleep_hours += hours;
                }
                break;

            case 'HKQuantityTypeIdentifierActiveEnergyBurned':
                entriesByDate[date].calories_burned += parseFloat(record.value || 0);
                break;

            case 'HKQuantityTypeIdentifierAppleExerciseTime':
                entriesByDate[date].exercise_minutes += parseFloat(record.value || 0);
                break;

            case 'HKQuantityTypeIdentifierBodyMass':
                // Weight in pounds
                if (record.unit === 'lb') {
                    entriesByDate[date].weight_lbs = parseFloat(record.value);
                } else if (record.unit === 'kg') {
                    entriesByDate[date].weight_lbs = parseFloat(record.value) * 2.20462;
                }
                break;

            // Add more cases as needed for your specific data
        }
    });

    return entriesByDate;
}

// Upload and import multiple CSV files (monthly calorie data)
router.post('/csv/calories', requireAuth, upload.array('files', 24), async (req, res) => {
    try {
        const files = req.files;
        let totalImported = 0;
        let totalUpdated = 0;
        let errors = [];

        for (const file of files) {
            try {
                const calorieData = await parseCaloriesCSV(file.path, req.session.userId);

                // Insert each entry into database
                for (const entry of calorieData) {
                    try {
                        // Convert date format if needed (depends on your CSV)
                        const formattedDate = entry.date; // Assume YYYY-MM-DD format

                        const [result] = await db.query(
                            `INSERT INTO health_entries (user_id, entry_date, calories_intake, data_source)
                             VALUES (?, ?, ?, 'csv_import')
                             ON DUPLICATE KEY UPDATE 
                             calories_intake = VALUES(calories_intake),
                             data_source = 'csv_import'`,
                            [req.session.userId, formattedDate, entry.calories]
                        );

                        if (result.affectedRows === 1) {
                            totalImported++;
                        } else {
                            totalUpdated++;
                        }
                    } catch (dbError) {
                        console.error('DB insert error:', dbError);
                        errors.push({ date: entry.date, error: 'Database error' });
                    }
                }

                // Clean up uploaded file
                fs.unlinkSync(file.path);

            } catch (fileError) {
                errors.push({ file: file.originalname, error: fileError.message });
                // Try to clean up even on error
                try { fs.unlinkSync(file.path); } catch (e) { }
            }
        }

        res.json({
            success: true,
            imported: totalImported,
            updated: totalUpdated,
            errors: errors.length > 0 ? errors : null,
            message: `Imported ${totalImported} new entries, updated ${totalUpdated} existing entries`
        });

    } catch (error) {
        console.error('Import CSV error:', error);
        res.status(500).json({ error: 'Server error importing CSV files' });
    }
});

// Upload and import Apple Health XML
router.post('/xml/health', requireAuth, upload.single('file'), async (req, res) => {
    try {
        const entriesByDate = await parseAppleHealthXML(req.file.path, req.session.userId);
        let imported = 0;
        let updated = 0;

        // Insert each date's aggregated data
        for (const [date, data] of Object.entries(entriesByDate)) {
            try {
                // Convert weight to kg for storage
                const weight_kg = data.weight_lbs ? (data.weight_lbs / 2.20462).toFixed(2) : null;

                const [result] = await db.query(
                    `INSERT INTO health_entries 
                     (user_id, entry_date, sleep_hours, calories_burned, exercise_minutes, weight, data_source)
                     VALUES (?, ?, ?, ?, ?, ?, 'apple_health')
                     ON DUPLICATE KEY UPDATE 
                     sleep_hours = COALESCE(VALUES(sleep_hours), sleep_hours),
                     calories_burned = COALESCE(VALUES(calories_burned), calories_burned),
                     exercise_minutes = COALESCE(VALUES(exercise_minutes), exercise_minutes),
                     weight = COALESCE(VALUES(weight), weight),
                     data_source = 'apple_health'`,
                    [req.session.userId, date, data.sleep_hours, data.calories_burned,
                    data.exercise_minutes, weight_kg]
                );

                if (result.affectedRows === 1) {
                    imported++;
                } else {
                    updated++;
                }
            } catch (dbError) {
                console.error('DB insert error for date:', date, dbError);
            }
        }

        // Clean up
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            imported,
            updated,
            message: `Imported ${imported} new days, updated ${updated} existing days of health data`
        });

    } catch (error) {
        console.error('Import XML error:', error);
        res.status(500).json({ error: 'Server error importing XML file' });
    }
});

// Get import status/statistics
router.get('/status', requireAuth, async (req, res) => {
    try {
        const [stats] = await db.query(
            `SELECT 
                COUNT(*) as total_entries,
                COUNT(DISTINCT entry_date) as days_tracked,
                MIN(entry_date) as first_entry,
                MAX(entry_date) as last_entry,
                SUM(CASE WHEN calories_intake IS NOT NULL THEN 1 ELSE 0 END) as days_with_calories,
                SUM(CASE WHEN sleep_hours IS NOT NULL THEN 1 ELSE 0 END) as days_with_sleep,
                SUM(CASE WHEN exercise_minutes IS NOT NULL THEN 1 ELSE 0 END) as days_with_exercise,
                SUM(CASE WHEN weight IS NOT NULL THEN 1 ELSE 0 END) as days_with_weight
             FROM health_entries 
             WHERE user_id = ?`,
            [req.session.userId]
        );

        res.json({ success: true, stats: stats[0] });

    } catch (error) {
        console.error('Get import status error:', error);
        res.status(500).json({ error: 'Server error fetching import status' });
    }
});

module.exports = router;