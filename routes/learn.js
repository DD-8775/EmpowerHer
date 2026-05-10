const express = require('express');
const { query, queryOne } = require('../db/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM courses';
    const params = [];
    if (category && category !== 'All Skills') {
      sql += ' WHERE category = $1';
      params.push(category);
    }
    const courses = await query(sql, params);
    if (req.user) {
      const progress = await query('SELECT "courseId", completed FROM user_progress WHERE "userId" = $1', [req.user.id]);
      const map = {};
      progress.forEach(p => { map[p.courseId] = p.completed; });
      courses.forEach(c => { c.completed = map[c.id] || 0; });
    }
    res.json({ courses });
  } catch (err) { console.error('Courses error:', err); res.status(500).json({ error: 'Server error.' }); }
});

router.get('/progress', authenticateToken, async (req, res) => {
  try {
    const total = await queryOne('SELECT COUNT(*) as count FROM courses');
    const completed = await queryOne('SELECT COUNT(*) as count FROM user_progress WHERE "userId" = $1 AND completed = 1', [req.user.id]);
    const totalCount = parseInt(total?.count) || 0;
    const completedCount = parseInt(completed?.count) || 0;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const recent = await query(
      `SELECT DISTINCT DATE("completedAt") as "completionDate" FROM user_progress WHERE "userId" = $1 AND completed = 1 AND "completedAt" IS NOT NULL ORDER BY "completionDate" DESC`,
      [req.user.id]
    );

    let streak = 0;
    const today = new Date();
    for (let i = 0; i < recent.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().split('T')[0];
      const actualStr = recent[i].completionDate instanceof Date
        ? recent[i].completionDate.toISOString().split('T')[0]
        : String(recent[i].completionDate);
      if (actualStr === expectedStr) streak++;
      else break;
    }
    res.json({ totalCourses: totalCount, completedCourses: completedCount, percentage, streak });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    const userId = req.user.id;
    const course = await queryOne('SELECT * FROM courses WHERE id = $1', [courseId]);
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    const existing = await queryOne('SELECT * FROM user_progress WHERE "userId" = $1 AND "courseId" = $2', [userId, courseId]);
    if (existing && existing.completed) return res.json({ message: 'Already completed.', alreadyCompleted: true });

    if (existing) {
      await query('UPDATE user_progress SET completed = 1, "completedAt" = NOW() WHERE "userId" = $1 AND "courseId" = $2', [userId, courseId]);
    } else {
      await query('INSERT INTO user_progress ("userId", "courseId", completed, "completedAt") VALUES ($1, $2, 1, NOW())', [userId, courseId]);
    }
    await query('UPDATE users SET "profileCompletion" = LEAST("profileCompletion" + 5, 100) WHERE id = $1', [userId]);

    const total = await queryOne('SELECT COUNT(*) as count FROM courses');
    const completed = await queryOne('SELECT COUNT(*) as count FROM user_progress WHERE "userId" = $1 AND completed = 1', [userId]);
    const totalCount = parseInt(total?.count) || 0;
    const completedCount = parseInt(completed?.count) || 0;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    res.json({ message: `Completed "${course.title}"!`, percentage, completedCourses: completedCount, totalCourses: totalCount });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
