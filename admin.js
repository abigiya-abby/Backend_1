const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function createAdmin() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const hashedPassword = await bcrypt.hash('admin123', 10);

  await pool.query(`
    INSERT INTO users (full_name, email, password, role, department)
    VALUES (?, ?, ?, ?, ?)
  `, [
    'Admin User',
    'admin@aastu.edu.et',
    hashedPassword,
    'admin',
    'Software Engineering'
  ]);

  console.log("Admin created!");
}

createAdmin();