require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function createAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const hashedPassword = await bcrypt.hash('admin123', 10);

  await pool.query(`
    INSERT INTO users (full_name, email, password, role, department)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (email) DO NOTHING
  `, [
    'Admin User',
    'admin@aastu.edu.et',
    hashedPassword,
    'admin',
    'Software Engineering'
  ]);

  console.log('✅ Admin created: admin@aastu.edu.et / admin123');
  await pool.end();
}

createAdmin().catch(console.error);
