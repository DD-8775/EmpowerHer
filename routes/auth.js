const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { getDb, prepare, saveDb } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function generateToken(user) {
  return jwt.sign(
    { id: user.id, fullName: user.fullName, mobile: user.mobile, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req, res) => {
  try {
    await getDb();
    const { fullName, mobile, password } = req.body;
    if (!fullName || !mobile || !password) return res.status(400).json({ error: 'Full name, mobile, and password are required.' });
    if (!/^\d{10}$/.test(mobile)) return res.status(400).json({ error: 'Mobile number must be exactly 10 digits.' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });

    const existing = prepare('SELECT id FROM users WHERE mobile = ?').get(mobile);
    if (existing) return res.status(409).json({ error: 'An account with this mobile number already exists.' });

    const hashed = bcrypt.hashSync(password, 10);
    const result = prepare('INSERT INTO users (fullName, mobile, password, profileCompletion) VALUES (?, ?, ?, ?)').run(fullName, mobile, hashed, 30);
    const user = prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(user);

    res.status(201).json({ message: 'Account created!', token, user: { id: user.id, fullName: user.fullName, mobile: user.mobile, profileCompletion: user.profileCompletion } });
  } catch (err) { console.error('Register error:', err); res.status(500).json({ error: 'Server error during registration.' }); }
});

router.post('/login', async (req, res) => {
  try {
    await getDb();
    const { mobile, password } = req.body;
    if (!mobile || !password) return res.status(400).json({ error: 'Mobile and password are required.' });

    const user = prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
    if (!user) return res.status(401).json({ error: 'No account found with this mobile number.' });
    if (!user.password) return res.status(401).json({ error: 'This account uses Google Sign-In.' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Incorrect password.' });

    const token = generateToken(user);
    res.json({ message: 'Login successful!', token, user: { id: user.id, fullName: user.fullName, mobile: user.mobile, profileCompletion: user.profileCompletion } });
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Server error during login.' }); }
});

router.post('/google', async (req, res) => {
  try {
    await getDb();
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Google credential is required.' });

    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    let user = prepare('SELECT * FROM users WHERE googleId = ?').get(googleId);
    if (!user) user = prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      const result = prepare('INSERT INTO users (fullName, email, googleId, avatar, profileCompletion) VALUES (?, ?, ?, ?, ?)').run(name, email, googleId, picture || '', 40);
      user = prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    } else if (!user.googleId) {
      prepare('UPDATE users SET googleId = ?, avatar = ? WHERE id = ?').run(googleId, picture || '', user.id);
      user = prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }

    const token = generateToken(user);
    res.json({ message: 'Google login successful!', token, user: { id: user.id, fullName: user.fullName, email: user.email, avatar: user.avatar, profileCompletion: user.profileCompletion } });
  } catch (err) { console.error('Google auth error:', err); res.status(401).json({ error: 'Google authentication failed.' }); }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    await getDb();
    const user = prepare('SELECT id, fullName, mobile, email, avatar, skills, profileCompletion, createdAt FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const appCount = prepare('SELECT COUNT(*) as count FROM applications WHERE userId = ?').get(req.user.id);
    const postCount = prepare('SELECT COUNT(*) as count FROM posts WHERE userId = ?').get(req.user.id);

    res.json({ user: { ...user, applicationCount: appCount?.count || 0, postCount: postCount?.count || 0 } });
  } catch (err) { console.error('Me error:', err); res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
