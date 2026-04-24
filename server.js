require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Serve static frontend files ---
app.use(express.static(path.join(__dirname)));

// --- API Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/posts', require('./routes/community'));
app.use('/api/courses', require('./routes/learn'));

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Error handling middleware ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// --- Initialize DB, seed, and start server ---
async function start() {
  const { getDb } = require('./db/database');
  const db = await getDb();

  // Auto-seed if empty
  const result = db.exec("SELECT COUNT(*) as count FROM jobs");
  const jobCount = result.length > 0 ? result[0].values[0][0] : 0;
  if (jobCount === 0) {
    console.log('📦 First run detected. Seeding database...');
    const seed = require('./db/seed');
    // Wait a moment for seed to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 EmpowerHer server running at http://localhost:${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
    console.log(`🌐 Frontend at http://localhost:${PORT}/index.html\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
