const express = require('express');
const { getDb, prepare } = require('../db/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    await getDb();
    const { category } = req.query;
    let query = 'SELECT * FROM courses';
    const params = [];
    if (category && category !== 'All Skills') { query += ' WHERE category = ?'; params.push(category); }

    const courses = prepare(query).all(...params);

    if (req.user) {
      const progress = prepare('SELECT courseId, completed FROM user_progress WHERE userId = ?').all(req.user.id);
      const map = {};
      progress.forEach(p => { map[p.courseId] = p.completed; });
      courses.forEach(c => { c.completed = map[c.id] || 0; });
    }
    res.json({ courses });
  } catch (err) { console.error('Courses error:', err); res.status(500).json({ error: 'Server error.' }); }
});

router.get('/progress', authenticateToken, async (req, res) => {
  try {
    await getDb();
    const total = prepare('SELECT COUNT(*) as count FROM courses').get();
    const completed = prepare('SELECT COUNT(*) as count FROM user_progress WHERE userId = ? AND completed = 1').get(req.user.id);
    const totalCount = total?.count || 0;
    const completedCount = completed?.count || 0;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const recent = prepare("SELECT DISTINCT date(completedAt) as completionDate FROM user_progress WHERE userId = ? AND completed = 1 AND completedAt IS NOT NULL ORDER BY completionDate DESC").all(req.user.id);

    let streak = 0;
    const today = new Date();
    for (let i = 0; i < recent.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      if (recent[i].completionDate === expected.toISOString().split('T')[0]) streak++;
      else break;
    }

    res.json({ totalCourses: totalCount, completedCourses: completedCount, percentage, streak });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    await getDb();
    const courseId = parseInt(req.params.id);
    const userId = req.user.id;

    const course = prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    const existing = prepare('SELECT * FROM user_progress WHERE userId = ? AND courseId = ?').get(userId, courseId);
    if (existing && existing.completed) return res.json({ message: 'Already completed.', alreadyCompleted: true });

    if (existing) {
      prepare('UPDATE user_progress SET completed = 1, completedAt = datetime("now") WHERE userId = ? AND courseId = ?').run(userId, courseId);
    } else {
      prepare('INSERT INTO user_progress (userId, courseId, completed, completedAt) VALUES (?, ?, 1, datetime("now"))').run(userId, courseId);
    }

    prepare('UPDATE users SET profileCompletion = MIN(profileCompletion + 5, 100) WHERE id = ?').run(userId);

    const total = prepare('SELECT COUNT(*) as count FROM courses').get();
    const completed = prepare('SELECT COUNT(*) as count FROM user_progress WHERE userId = ? AND completed = 1').get(userId);
    const percentage = (total?.count || 0) > 0 ? Math.round(((completed?.count || 0) / (total?.count || 1)) * 100) : 0;

    res.json({ message: `Completed "${course.title}"!`, percentage, completedCourses: completed?.count || 0, totalCourses: total?.count || 0 });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
