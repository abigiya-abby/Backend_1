require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const app = express();

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));

/* =========================================================
   DATABASE CONNECTION
========================================================= */

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/* =========================================================
   DATABASE SETUP
========================================================= */

async function setupDatabase() {
  try {

    // USERS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('student', 'admin') DEFAULT 'student',
        department VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // CLUBS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clubs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        club_name VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        logo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // CATEGORIES TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
      
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL
      )
    `);

    // EVENTS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,

        title VARCHAR(255) NOT NULL,
        description TEXT,

        event_date DATETIME NOT NULL,

        venue VARCHAR(255),
        speaker VARCHAR(255),
        image TEXT,

        capacity INT DEFAULT 100,

        club_id INT,
        category_id INT,
        created_by INT,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (club_id)
        REFERENCES clubs(id)
        ON DELETE SET NULL,

        FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE SET NULL,

        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE SET NULL
      )
    `);

    // REGISTRATIONS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,

        user_id INT NOT NULL,
        event_id INT NOT NULL,

        registration_status ENUM('registered', 'cancelled')
        DEFAULT 'registered',

        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE(user_id, event_id),

        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

        FOREIGN KEY (event_id)
        REFERENCES events(id)
        ON DELETE CASCADE
      )
    `);

    // ATTENDANCE TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,

        registration_id INT UNIQUE,

        checked_in BOOLEAN DEFAULT FALSE,

        checked_in_at TIMESTAMP NULL,

        FOREIGN KEY (registration_id)
        REFERENCES registrations(id)
        ON DELETE CASCADE
      )
    `);

    console.log('✅ Database tables initialized successfully!');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
  }
}

setupDatabase();

/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function authenticateToken(req, res, next) {

  const authHeader = req.headers['authorization'];

  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Access denied. No token provided.'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {

    if (err) {
      return res.status(403).json({
        error: 'Invalid token.'
      });
    }

    req.user = user;

    next();
  });
}

/* =========================================================
   ADMIN MIDDLEWARE
========================================================= */

function isAdmin(req, res, next) {

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access only.'
    });
  }

  next();
}

/* =========================================================
   AUTH ROUTES
========================================================= */

// REGISTER USER
app.post('/api/auth/register', async (req, res) => {

  try {

    const {
      full_name,
      email,
      password,
      department
    } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({
        error: 'Missing required fields.'
      });
    }

    // CHECK IF USER EXISTS
    const [existingUser] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        error: 'Email already exists.'
      });
    }

    // HASH PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    // INSERT USER
    const sql = `
      INSERT INTO users
      (full_name, email, password, department)
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await pool.query(sql, [
      full_name,
      email,
      hashedPassword,
      department
    ]);

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      userId: result.insertId
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }
});

// LOGIN USER
app.post('/api/auth/login', async (req, res) => {

  try {

    const { email, password } = req.body;

    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    const user = users[0];

    const validPassword = password === user.password;
    if (!validPassword) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    // GENERATE TOKEN
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d'
      }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }
});

/* =========================================================
   EVENT ROUTES
========================================================= */

// GET ALL EVENTS
app.get('/api/events', async (req, res) => {

  try {

    const [events] = await pool.query(`
      SELECT 
        events.*,
        clubs.club_name,
        categories.name AS category_name
      FROM events
      LEFT JOIN clubs
      ON events.club_id = clubs.id
      LEFT JOIN categories
      ON events.category_id = categories.id
      ORDER BY event_date ASC
    `);

    res.json(events);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }
});

// GET SINGLE EVENT
app.get('/api/events/:id', async (req, res) => {

  try {

    const { id } = req.params;

    const [events] = await pool.query(
      'SELECT * FROM events WHERE id = ?',
      [id]
    );

    if (events.length === 0) {
      return res.status(404).json({
        error: 'Event not found.'
      });
    }

    res.json(events[0]);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }
});

// CREATE EVENT (ADMIN ONLY)
app.post(
  '/api/events',
  authenticateToken,
  isAdmin,
  async (req, res) => {

    try {

      const {
        title,
        description,
        event_date,
        venue,
        speaker,
        image,
        capacity,
        club_id,
        category_id
      } = req.body;

      if (!title || !event_date) {
        return res.status(400).json({
          error: 'Title and event date are required.'
        });
      }

      const sql = `
        INSERT INTO events
        (
          title,
          description,
          event_date,
          venue,
          speaker,
          image,
          capacity,
          club_id,
          category_id,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await pool.query(sql, [
        title,
        description,
        event_date,
        venue,
        speaker,
        image,
        capacity,
        club_id,
        category_id,
        req.user.id
      ]);

      res.status(201).json({
        success: true,
        message: 'Event created successfully.',
        eventId: result.insertId
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });

    }
  }
);

// DELETE EVENT
app.delete(
  '/api/events/:id',
  authenticateToken,
  isAdmin,
  async (req, res) => {

    try {

      const { id } = req.params;

      await pool.query(
        'DELETE FROM events WHERE id = ?',
        [id]
      );

      res.json({
        success: true,
        message: 'Event deleted successfully.'
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });

    }
  }
);

/* =========================================================
   REGISTRATION ROUTES
========================================================= */

// REGISTER FOR EVENT
app.post(
  '/api/registrations',
  authenticateToken,
  async (req, res) => {

    try {

      const { event_id } = req.body;

      if (!event_id) {
        return res.status(400).json({
          error: 'event_id is required.'
        });
      }

      const sql = `
        INSERT INTO registrations
        (user_id, event_id)
        VALUES (?, ?)
      `;

      const [result] = await pool.query(sql, [
        req.user.id,
        event_id
      ]);

      res.status(201).json({
        success: true,
        message: 'Registered successfully.',
        registrationId: result.insertId
      });

    } catch (error) {

      res.status(400).json({
        error: error.message
      });

    }
  }
);

// GET EVENT ATTENDEES
app.get(
  '/api/events/:id/attendees',
  authenticateToken,
  isAdmin,
  async (req, res) => {

    try {

      const { id } = req.params;

      const [rows] = await pool.query(`
        SELECT
          registrations.id,
          users.full_name,
          users.email,
          registrations.registered_at
        FROM registrations
        JOIN users
        ON registrations.user_id = users.id
        WHERE registrations.event_id = ?
      `, [id]);

      res.json(rows);

    } catch (error) {

      res.status(500).json({
        error: error.message
      });

    }
  }
);

/* =========================================================
   ATTENDANCE ROUTES
========================================================= */

// CHECK IN ATTENDANCE
app.post(
  '/api/attendance/checkin',
  authenticateToken,
  isAdmin,
  async (req, res) => {

    try {

      const { registration_id } = req.body;

      const sql = `
        INSERT INTO attendance
        (
          registration_id,
          checked_in,
          checked_in_at
        )
        VALUES (?, true, NOW())
      `;

      await pool.query(sql, [registration_id]);

      res.json({
        success: true,
        message: 'Attendance checked in successfully.'
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });

    }
  }
);
// USERS
app.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT id, full_name, email, role, department FROM users');
  res.json(rows);
});

// CLUBS
app.get('/api/clubs', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM clubs');
  res.json(rows);
});

// CATEGORIES
app.get('/api/categories', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM categories');
  res.json(rows);
});

/* =========================================================
   SERVER
========================================================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});