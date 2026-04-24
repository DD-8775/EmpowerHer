const express = require('express');
const { getDb, prepare, saveDb } = require('../db/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, async (req, res) => {
  try {
    await getDb();
    const posts = prepare(`
      SELECT p.*, u.fullName, u.avatar, u.skills,
        (SELECT COUNT(*) FROM post_likes WHERE postId = p.id) as likeCount,
        (SELECT COUNT(*) FROM comments WHERE postId = p.id) as commentCount
      FROM posts p JOIN users u ON p.userId = u.id ORDER BY p.createdAt DESC
    `).all();

    if (req.user) {
      const liked = prepare('SELECT postId FROM post_likes WHERE userId = ?').all(req.user.id);
      const likedSet = new Set(liked.map(l => l.postId));
      posts.forEach(p => { p.userLiked = likedSet.has(p.id); });
    }
    res.json({ posts });
  } catch (err) { console.error('Posts error:', err); res.status(500).json({ error: 'Server error.' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    await getDb();
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Post content cannot be empty.' });

    const result = prepare('INSERT INTO posts (userId, content) VALUES (?, ?)').run(req.user.id, content.trim());
    const post = prepare(`
      SELECT p.*, u.fullName, u.avatar, u.skills, 0 as likeCount, 0 as commentCount
      FROM posts p JOIN users u ON p.userId = u.id WHERE p.id = ?
    `).get(result.lastInsertRowid);

    prepare('UPDATE users SET profileCompletion = MIN(profileCompletion + 5, 100) WHERE id = ?').run(req.user.id);
    res.status(201).json({ message: 'Post created!', post });
  } catch (err) { console.error('Create post error:', err); res.status(500).json({ error: 'Server error.' }); }
});

router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    await getDb();
    const postId = parseInt(req.params.id);
    const userId = req.user.id;

    const post = prepare('SELECT * FROM posts WHERE id = ?').get(postId);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const existing = prepare('SELECT id FROM post_likes WHERE postId = ? AND userId = ?').get(postId, userId);
    if (existing) {
      prepare('DELETE FROM post_likes WHERE postId = ? AND userId = ?').run(postId, userId);
    } else {
      prepare('INSERT INTO post_likes (postId, userId) VALUES (?, ?)').run(postId, userId);
    }

    const count = prepare('SELECT COUNT(*) as count FROM post_likes WHERE postId = ?').get(postId);
    res.json({ liked: !existing, likeCount: count?.count || 0 });
  } catch (err) { console.error('Like error:', err); res.status(500).json({ error: 'Server error.' }); }
});

router.get('/:id/comments', async (req, res) => {
  try {
    await getDb();
    const comments = prepare('SELECT c.*, u.fullName, u.avatar FROM comments c JOIN users u ON c.userId = u.id WHERE c.postId = ? ORDER BY c.createdAt ASC').all(parseInt(req.params.id));
    res.json({ comments });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    await getDb();
    const { content } = req.body;
    const postId = parseInt(req.params.id);
    if (!content || !content.trim()) return res.status(400).json({ error: 'Comment cannot be empty.' });

    const post = prepare('SELECT * FROM posts WHERE id = ?').get(postId);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const result = prepare('INSERT INTO comments (postId, userId, content) VALUES (?, ?, ?)').run(postId, req.user.id, content.trim());
    const comment = prepare('SELECT c.*, u.fullName, u.avatar FROM comments c JOIN users u ON c.userId = u.id WHERE c.id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Comment added!', comment });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

router.get('/mentors/all', async (req, res) => {
  try {
    await getDb();
    const mentors = prepare('SELECT * FROM mentors').all();
    res.json({ mentors });
  } catch (err) { res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
