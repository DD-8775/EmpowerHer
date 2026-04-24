const { getDb, prepare, saveDb } = require('./database');

async function seed() {
  console.log('🌱 Seeding database...');
  const db = await getDb();

  // Check if already seeded
  const result = db.exec("SELECT COUNT(*) as count FROM jobs");
  const jobCount = result.length > 0 ? result[0].values[0][0] : 0;
  if (jobCount > 0) {
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
    db.run("INSERT INTO jobs (title, category, pay, description, time, location, requirements, icon, badgeClass) VALUES (?,?,?,?,?,?,?,?,?)", j);
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
    db.run("INSERT INTO courses (title, category, duration, level, color) VALUES (?,?,?,?,?)", c);
  }
  console.log(`  ✅ Inserted ${courses.length} courses`);

  // --- Seed Mentors ---
  const mentors = [
    ['Dr. S. Rao', 'Business Guide', '👩‍🏫'],
    ['Meena Ji', 'Craft Expert', '🎨'],
  ];

  for (const m of mentors) {
    db.run("INSERT INTO mentors (name, specialty, icon) VALUES (?,?,?)", m);
  }
  console.log(`  ✅ Inserted ${mentors.length} mentors`);

  // --- Seed Demo Users ---
  const bcrypt = require('bcryptjs');
  const hashedPassword = bcrypt.hashSync('demo1234', 10);

  db.run("INSERT INTO users (fullName, mobile, password, skills, profileCompletion) VALUES (?,?,?,?,?)",
    ['Anita Sharma', '9876543210', hashedPassword, 'Cooking', 70]);
  db.run("INSERT INTO users (fullName, mobile, password, skills, profileCompletion) VALUES (?,?,?,?,?)",
    ['Riya Kapoor', '9876543211', hashedPassword, 'Teaching', 55]);

  // Get user IDs
  const u1 = db.exec("SELECT id FROM users WHERE mobile='9876543210'")[0].values[0][0];
  const u2 = db.exec("SELECT id FROM users WHERE mobile='9876543211'")[0].values[0][0];

  db.run("INSERT INTO posts (userId, content, likes) VALUES (?,?,?)",
    [u1, 'I just delivered my first bulk order of 20 Tiffins! 😍 Thank you to the mentors here who helped me with packaging tips.', 24]);
  db.run("INSERT INTO posts (userId, content, likes) VALUES (?,?,?)",
    [u2, 'Question: How do you handle payments from parents? Do you ask for advance or end of month?', 8]);

  console.log('  ✅ Inserted 2 demo users and 2 sample posts');

  saveDb();
  console.log('🎉 Seeding complete!');
}

seed().catch(err => console.error('Seed error:', err));

module.exports = seed;
