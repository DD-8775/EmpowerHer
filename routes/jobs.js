const express = require('express');
const { query, queryOne } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { skill, time } = req.query;
    let sql = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (skill && skill !== 'Select Skill') {
      sql += ` AND category ILIKE $${paramIndex++}`;
      params.push(`%${skill}%`);
    }
    if (time && time !== 'Time Available') {
      if (time === '1 Hour') {
        sql += ` AND (time ILIKE $${paramIndex++} OR time ILIKE $${paramIndex++})`;
        params.push('%1:00%', '%1 hour%');
      } else if (time === '2-4 Hours') {
        sql += ` AND (time ILIKE $${paramIndex++} OR time ILIKE $${paramIndex++} OR time ILIKE $${paramIndex++})`;
        params.push('%2%', '%3%', '%4%');
      } else if (time === 'Full Day') {
        sql += ` AND (time ILIKE $${paramIndex++} OR time ILIKE $${paramIndex++})`;
        params.push('%Flexible%', '%Full%');
      }
    }
    sql += ' ORDER BY "createdAt" DESC';

    const jobs = await query(sql, params);
    res.json({ jobs, total: jobs.length });
  } catch (err) { console.error('Jobs error:', err); res.status(500).json({ error: 'Server error.' }); }
});

router.get('/user/applications', authenticateToken, async (req, res) => {
  try {
    const apps = await query(
      `SELECT a.*, j.title, j.category, j.pay, j.icon
       FROM applications a JOIN jobs j ON a."jobId" = j.id
       WHERE a."userId" = $1 ORDER BY a."appliedAt" DESC`,
      [req.user.id]
    );
    res.json({ applications: apps });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const job = await queryOne('SELECT * FROM jobs WHERE id = $1', [parseInt(req.params.id)]);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json({ job });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/:id/apply', authenticateToken, async (req, res) => {
  try {
    const jobId = parseInt(req.params.id);
    const userId = req.user.id;

    const job = await queryOne('SELECT * FROM jobs WHERE id = $1', [jobId]);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const existing = await queryOne('SELECT id FROM applications WHERE "userId" = $1 AND "jobId" = $2', [userId, jobId]);
    if (existing) return res.status(409).json({ error: 'You have already applied to this job.' });

    await query('INSERT INTO applications ("userId", "jobId") VALUES ($1, $2)', [userId, jobId]);

    const user = await queryOne('SELECT "profileCompletion" FROM users WHERE id = $1', [userId]);
    if (user && user.profileCompletion < 80) {
      await query('UPDATE users SET "profileCompletion" = LEAST("profileCompletion" + 10, 100) WHERE id = $1', [userId]);
    }

    res.status(201).json({ message: `Successfully applied to "${job.title}"!` });
  } catch (err) { console.error('Apply error:', err); res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
