const express = require('express');
const { getDb, prepare } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await getDb();
    const { skill, time } = req.query;
    let query = 'SELECT * FROM jobs WHERE 1=1';
    const params = [];

    if (skill && skill !== 'Select Skill') {
      query += ' AND category LIKE ?';
      params.push(`%${skill}%`);
    }
    if (time && time !== 'Time Available') {
      if (time === '1 Hour') { query += ' AND (time LIKE ? OR time LIKE ?)'; params.push('%1:00%', '%1 hour%'); }
      else if (time === '2-4 Hours') { query += ' AND (time LIKE ? OR time LIKE ? OR time LIKE ?)'; params.push('%2%', '%3%', '%4%'); }
      else if (time === 'Full Day') { query += ' AND (time LIKE ? OR time LIKE ?)'; params.push('%Flexible%', '%Full%'); }
    }
    query += ' ORDER BY createdAt DESC';

    const jobs = prepare(query).all(...params);
    res.json({ jobs, total: jobs.length });
  } catch (err) { console.error('Jobs error:', err); res.status(500).json({ error: 'Server error.' }); }
});

router.get('/:id', async (req, res) => {
  try {
    await getDb();
    const job = prepare('SELECT * FROM jobs WHERE id = ?').get(parseInt(req.params.id));
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json({ job });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/:id/apply', authenticateToken, async (req, res) => {
  try {
    await getDb();
    const jobId = parseInt(req.params.id);
    const userId = req.user.id;

    const job = prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const existing = prepare('SELECT id FROM applications WHERE userId = ? AND jobId = ?').get(userId, jobId);
    if (existing) return res.status(409).json({ error: 'You have already applied to this job.' });

    prepare('INSERT INTO applications (userId, jobId) VALUES (?, ?)').run(userId, jobId);

    const user = prepare('SELECT profileCompletion FROM users WHERE id = ?').get(userId);
    if (user && user.profileCompletion < 80) {
      prepare('UPDATE users SET profileCompletion = MIN(profileCompletion + 10, 100) WHERE id = ?').run(userId);
    }

    res.status(201).json({ message: `Successfully applied to "${job.title}"!` });
  } catch (err) { console.error('Apply error:', err); res.status(500).json({ error: 'Server error.' }); }
});

router.get('/user/applications', authenticateToken, async (req, res) => {
  try {
    await getDb();
    const apps = prepare('SELECT a.*, j.title, j.category, j.pay, j.icon FROM applications a JOIN jobs j ON a.jobId = j.id WHERE a.userId = ? ORDER BY a.appliedAt DESC').all(req.user.id);
    res.json({ applications: apps });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
