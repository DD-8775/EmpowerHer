require('dotenv').config();
const { query, queryOne, initDb } = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Seeding database...');

  // Ensure tables exist
  await initDb();

  // Check if already seeded
  const result = await queryOne('SELECT COUNT(*) as count FROM jobs');
  if (parseInt(result.count) > 0) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  // --- Seed Jobs ---
  const jobs = [
    ['Home Chef for Tiffins', 'Cooking', '₹8,000 / month', 'Prepare 5 vegetarian tiffins daily for office staff nearby.', '11:00 AM - 1:00 PM', 'From Home (Pickup arranged)', 'Clean Kitchen, Hygiene Cert', '🍲', 'cooking'],
    ['Hindi Tutor (Class 5)', 'Teaching', '₹300 / hour', 'Teach Hindi grammar to a student via Zoom call.', '4:00 PM - 5:00 PM', 'Online (Zoom)', 'Good Internet, Patience', '📚', 'teaching'],
    ['Handmade Diya Decoration', 'Art & Craft', '₹4,000 / order', 'Paint and decorate 50 earthen diyas for a festival order.', 'Deadline: 3 Days', 'Material delivered to you', 'Painting Skills', '🧶', 'craft'],
    ['Excel Data Entry', 'Data Entry', '₹500 / assignment', 'Type names and addresses from PDF into Excel sheets.', 'Flexible (Anytime)', 'Remote', 'Laptop/PC, Basic Excel', '💻', 'data'],
    ['Evening Snacks Order', 'Cooking', '₹1,500 One-time', 'Prepare 2kg Samosas for a birthday party.', 'Saturday 4 PM', 'From Home', 'Fresh Ingredients', '🥟', 'cooking'],
    ['Kurti Alterations', 'Stitching', '₹50 / piece', 'Basic fitting and hemming for 10 Kurtis.', 'Flexible', 'Nearby Boutique', 'Sewing Machine', '👗', 'craft'],
  ];

  for (const j of jobs) {
    await query(
      `INSERT INTO jobs (title, category, pay, description, time, location, requirements, icon, "badgeClass") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      j
    );
  }
  console.log(`  ✅ Inserted ${jobs.length} jobs`);

  // --- Seed Courses ---
  const courses = [
    ['How to use Google Pay safely', 'Digital Tools', '4 mins', 'Beginner', '#264653'],
    ['Pricing your Tiffin Service', 'Business', '8 mins', 'Intermediate', '#E76F51'],
    ['Eco-friendly Packing Ideas', 'Packaging', '5 mins', 'Creative', '#E9C46A'],
    ['Basic English for Client Calls', 'Soft Skills', '6 mins', 'Beginner', '#2A9D8F'],
  ];

  for (const c of courses) {
    await query(
      'INSERT INTO courses (title, category, duration, level, color) VALUES ($1,$2,$3,$4,$5)',
      c
    );
  }
  console.log(`  ✅ Inserted ${courses.length} courses`);

  // --- Seed Mentors ---
  const mentors = [
    ['Dr. S. Rao', 'Business Guide', '👩‍🏫'],
    ['Meena Ji', 'Craft Expert', '🎨'],
  ];

  for (const m of mentors) {
    await query(
      'INSERT INTO mentors (name, specialty, icon) VALUES ($1,$2,$3)',
      m
    );
  }
  console.log(`  ✅ Inserted ${mentors.length} mentors`);

  // --- Seed Demo Users ---
  const hashedPassword = bcrypt.hashSync('demo1234', 10);

  await query(
    `INSERT INTO users ("fullName", mobile, password, skills, "profileCompletion") VALUES ($1,$2,$3,$4,$5)`,
    ['Anita Sharma', '9876543210', hashedPassword, 'Cooking', 70]
  );
  await query(
    `INSERT INTO users ("fullName", mobile, password, skills, "profileCompletion") VALUES ($1,$2,$3,$4,$5)`,
    ['Riya Kapoor', '9876543211', hashedPassword, 'Teaching', 55]
  );

  // Get user IDs
  const u1 = await queryOne(`SELECT id FROM users WHERE mobile = $1`, ['9876543210']);
  const u2 = await queryOne(`SELECT id FROM users WHERE mobile = $1`, ['9876543211']);

  await query(
    `INSERT INTO posts ("userId", content, likes) VALUES ($1,$2,$3)`,
    [u1.id, 'I just delivered my first bulk order of 20 Tiffins! 😍 Thank you to the mentors here who helped me with packaging tips.', 24]
  );
  await query(
    `INSERT INTO posts ("userId", content, likes) VALUES ($1,$2,$3)`,
    [u2.id, 'Question: How do you handle payments from parents? Do you ask for advance or end of month?', 8]
  );

  console.log('  ✅ Inserted 2 demo users and 2 sample posts');
  console.log('🎉 Seeding complete!');
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});

module.exports = seed;
