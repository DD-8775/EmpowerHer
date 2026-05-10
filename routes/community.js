const express = require('express');
const { query, queryOne } = require('../db/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    const posts = await query(`
      SELECT p.*, u."fullName", u.avatar, u.skills,
        (SELECT COUNT(*) FROM post_likes WHERE "postId" = p.id) as "likeCount",
        (SELECT COUNT(*) FROM comments WHERE "postId" = p.id) as "commentCount"
      FROM posts p JOIN users u ON p."userId" = u.id ORDER BY p."createdAt" DESC
    `);
    if (req.user) {
      const liked = await query('SELECT "postId" FROM post_likes WHERE "userId" = $1', [req.user.id]);
      const likedSet = new Set(liked.map(l => l.postId));
      posts.forEach(p => { p.userLiked = likedSet.has(p.id); });
    }
    res.json({ posts });
  } catch (err) { console.error('Posts error:', err); res.status(500).json({ error: 'Server error.' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Post content cannot be empty.' });
    const result = await queryOne(
      `INSERT INTO posts ("userId", content) VALUES ($1, $2) RETURNING *`,
      [req.user.id, content.trim()]
    );
    const post = await queryOne(`
      SELECT p.*, u."fullName", u.avatar, u.skills, 0 as "likeCount", 0 as "commentCount"
      FROM posts p JOIN users u ON p."userId" = u.id WHERE p.id = $1
    `, [result.id]);
    await query('UPDATE users SET "profileCompletion" = LEAST("profileCompletion" + 5, 100) WHERE id = $1', [req.user.id]);
    res.status(201).json({ message: 'Post created!', post });
  } catch (err) { console.error('Create post error:', err); res.status(500).json({ error: 'Server error.' }); }
});

router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const userId = req.user.id;
    const post = await queryOne('SELECT * FROM posts WHERE id = $1', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    const existing = await queryOne('SELECT id FROM post_likes WHERE "postId" = $1 AND "userId" = $2', [postId, userId]);
    if (existing) {
      await query('DELETE FROM post_likes WHERE "postId" = $1 AND "userId" = $2', [postId, userId]);
    } else {
      await query('INSERT INTO post_likes ("postId", "userId") VALUES ($1, $2)', [postId, userId]);
    }
    const count = await queryOne('SELECT COUNT(*) as count FROM post_likes WHERE "postId" = $1', [postId]);
    res.json({ liked: !existing, likeCount: parseInt(count?.count) || 0 });
  } catch (err) { console.error('Like error:', err); res.status(500).json({ error: 'Server error.' }); }
});

router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await query(
      `SELECT c.*, u."fullName", u.avatar FROM comments c JOIN users u ON c."userId" = u.id WHERE c."postId" = $1 ORDER BY c."createdAt" ASC`,
      [parseInt(req.params.id)]
    );
    res.json({ comments });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    const postId = parseInt(req.params.id);
    if (!content || !content.trim()) return res.status(400).json({ error: 'Comment cannot be empty.' });
    const post = await queryOne('SELECT * FROM posts WHERE id = $1', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found.' });
    const result = await queryOne(
      `INSERT INTO comments ("postId", "userId", content) VALUES ($1, $2, $3) RETURNING *`,
      [postId, req.user.id, content.trim()]
    );
    const comment = await queryOne(
      `SELECT c.*, u."fullName", u.avatar FROM comments c JOIN users u ON c."userId" = u.id WHERE c.id = $1`,
      [result.id]
    );
    res.status(201).json({ message: 'Comment added!', comment });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/mentors/all', async (req, res) => {
  try {
    const mentors = await query('SELECT * FROM mentors');
    res.json({ mentors });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
