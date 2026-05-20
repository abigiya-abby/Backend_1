require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: false  // disabled so inline scripts in HTML pages work
}));
app.use(morgan('dev'));

// Serve the frontend folder as static files
// → http://localhost:5000/frontend/index.html
app.use(express.static('.'));

/* =========================================================
   DATABASE CONNECTION (Supabase / PostgreSQL)
========================================================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* =========================================================
   DATABASE SETUP
========================================================= */

async function setupDatabase() {
  try {

    // USERS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         SERIAL PRIMARY KEY,
        full_name  VARCHAR(255) NOT NULL,
        email      VARCHAR(255) UNIQUE NOT NULL,
        password   VARCHAR(255) NOT NULL,
        role       VARCHAR(20) NOT NULL DEFAULT 'student'
                   CHECK (role IN ('student', 'admin')),
        department VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // CLUBS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clubs (
        id          SERIAL PRIMARY KEY,
        club_name   VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        logo        TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // CATEGORIES TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id   SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL
      )
    `);

    // EVENTS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id          SERIAL PRIMARY KEY,
        title       VARCHAR(255) NOT NULL,
        description TEXT,
        event_date  TIMESTAMPTZ NOT NULL,
        venue       VARCHAR(255),
        speaker     VARCHAR(255),
        image       TEXT,
        capacity    INT DEFAULT 100,
        club_id     INT REFERENCES clubs(id) ON DELETE SET NULL,
        category_id INT REFERENCES categories(id) ON DELETE SET NULL,
        created_by  INT REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // REGISTRATIONS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id                  SERIAL PRIMARY KEY,
        user_id             INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id            INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        registration_status VARCHAR(20) NOT NULL DEFAULT 'registered'
                            CHECK (registration_status IN ('registered', 'cancelled')),
        registered_at       TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, event_id)
      )
    `);

    // ATTENDANCE TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id              SERIAL PRIMARY KEY,
        registration_id INT UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
        checked_in      BOOLEAN DEFAULT FALSE,
        checked_in_at   TIMESTAMPTZ NULL
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

    const { full_name, email, password, department } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password, department)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [full_name, email, hashedPassword, department]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      userId: result.rows[0].id
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LOGIN USER
app.post('/api/auth/login', async (req, res) => {

  try {

    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
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
    res.status(500).json({ error: error.message });
  }
});

/* =========================================================
   EVENT ROUTES
========================================================= */

// GET ALL EVENTS (supports ?search=, ?category_id=, ?club_id=, ?upcoming=true)
app.get('/api/events', async (req, res) => {

  try {

    const { search, category_id, club_id, upcoming } = req.query;

    let conditions = [];
    let params = [];
    let i = 1;

    if (search) {
      conditions.push(`(events.title ILIKE $${i} OR events.description ILIKE $${i+1} OR events.speaker ILIKE $${i+2})`);
      const like = `%${search}%`;
      params.push(like, like, like);
      i += 3;
    }

    if (category_id) {
      conditions.push(`events.category_id = $${i}`);
      params.push(category_id);
      i++;
    }

    if (club_id) {
      conditions.push(`events.club_id = $${i}`);
      params.push(club_id);
      i++;
    }

    if (upcoming === 'true') {
      conditions.push(`events.event_date >= NOW()`);
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const result = await pool.query(`
      SELECT
        events.*,
        clubs.club_name,
        categories.name AS category_name,
        COUNT(registrations.id) AS registration_count
      FROM events
      LEFT JOIN clubs       ON events.club_id      = clubs.id
      LEFT JOIN categories  ON events.category_id  = categories.id
      LEFT JOIN registrations
        ON events.id = registrations.event_id
        AND registrations.registration_status = 'registered'
      ${whereClause}
      GROUP BY events.id, clubs.club_name, categories.name
      ORDER BY events.event_date ASC
    `, params);

    res.json(result.rows);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET SINGLE EVENT
app.get('/api/events/:id', async (req, res) => {

  try {

    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        events.*,
        clubs.club_name,
        categories.name AS category_name,
        COUNT(registrations.id) AS registration_count
      FROM events
      LEFT JOIN clubs       ON events.club_id     = clubs.id
      LEFT JOIN categories  ON events.category_id = categories.id
      LEFT JOIN registrations
        ON events.id = registrations.event_id
        AND registrations.registration_status = 'registered'
      WHERE events.id = $1
      GROUP BY events.id, clubs.club_name, categories.name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    res.status(500).json({ error: error.message });
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
        title, description, event_date, venue,
        speaker, image, capacity, club_id, category_id
      } = req.body;

      if (!title || !event_date) {
        return res.status(400).json({ error: 'Title and event date are required.' });
      }

      const result = await pool.query(`
        INSERT INTO events
          (title, description, event_date, venue, speaker, image, capacity, club_id, category_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [title, description, event_date, venue, speaker, image, capacity, club_id, category_id, req.user.id]);

      res.status(201).json({
        success: true,
        message: 'Event created successfully.',
        eventId: result.rows[0].id
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// UPDATE EVENT (ADMIN ONLY)
app.put(
  '/api/events/:id',
  authenticateToken,
  isAdmin,
  async (req, res) => {

    try {

      const { id } = req.params;
      const {
        title, description, event_date, venue,
        speaker, image, capacity, club_id, category_id
      } = req.body;

      const existing = await pool.query(
        'SELECT id FROM events WHERE id = $1', [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Event not found.' });
      }

      await pool.query(`
        UPDATE events SET
          title       = COALESCE($1,  title),
          description = COALESCE($2,  description),
          event_date  = COALESCE($3,  event_date),
          venue       = COALESCE($4,  venue),
          speaker     = COALESCE($5,  speaker),
          image       = COALESCE($6,  image),
          capacity    = COALESCE($7,  capacity),
          club_id     = COALESCE($8,  club_id),
          category_id = COALESCE($9,  category_id)
        WHERE id = $10
      `, [title, description, event_date, venue, speaker, image, capacity, club_id, category_id, id]);

      res.json({ success: true, message: 'Event updated successfully.' });

    } catch (error) {
      res.status(500).json({ error: error.message });
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
      await pool.query('DELETE FROM events WHERE id = $1', [id]);
      res.json({ success: true, message: 'Event deleted successfully.' });
    } catch (error) {
      res.status(500).json({ error: error.message });
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
        return res.status(400).json({ error: 'event_id is required.' });
      }

      const result = await pool.query(
        `INSERT INTO registrations (user_id, event_id)
         VALUES ($1, $2) RETURNING id`,
        [req.user.id, event_id]
      );

      res.status(201).json({
        success: true,
        message: 'Registered successfully.',
        registrationId: result.rows[0].id
      });

    } catch (error) {
      res.status(400).json({ error: error.message });
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

      const result = await pool.query(`
        SELECT
          registrations.id,
          users.full_name,
          users.email,
          users.department,
          registrations.registration_status,
          registrations.registered_at,
          attendance.checked_in,
          attendance.checked_in_at
        FROM registrations
        JOIN users       ON registrations.user_id       = users.id
        LEFT JOIN attendance ON attendance.registration_id = registrations.id
        WHERE registrations.event_id = $1
        ORDER BY registrations.registered_at ASC
      `, [id]);

      res.json(result.rows);

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// GET MY REGISTRATIONS (STUDENT)
app.get(
  '/api/registrations/my',
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          registrations.id          AS registration_id,
          registrations.registration_status,
          registrations.registered_at,
          events.id                 AS event_id,
          events.title,
          events.description,
          events.event_date,
          events.venue,
          events.speaker,
          events.image,
          clubs.club_name,
          categories.name           AS category_name,
          attendance.checked_in,
          attendance.checked_in_at
        FROM registrations
        JOIN events      ON registrations.event_id      = events.id
        LEFT JOIN clubs       ON events.club_id          = clubs.id
        LEFT JOIN categories  ON events.category_id      = categories.id
        LEFT JOIN attendance  ON attendance.registration_id = registrations.id
        WHERE registrations.user_id = $1
        ORDER BY events.event_date ASC
      `, [req.user.id]);

      res.json(result.rows);

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// CANCEL REGISTRATION
app.patch(
  '/api/registrations/:id/cancel',
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const check = await pool.query(
        'SELECT id FROM registrations WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );

      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Registration not found or not yours.' });
      }

      await pool.query(
        `UPDATE registrations SET registration_status = 'cancelled' WHERE id = $1`,
        [id]
      );

      res.json({ success: true, message: 'Registration cancelled successfully.' });

    } catch (error) {
      res.status(500).json({ error: error.message });
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

      await pool.query(
        `INSERT INTO attendance (registration_id, checked_in, checked_in_at)
         VALUES ($1, true, NOW())
         ON CONFLICT (registration_id)
         DO UPDATE SET checked_in = true, checked_in_at = NOW()`,
        [registration_id]
      );

      res.json({ success: true, message: 'Attendance checked in successfully.' });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);
// USERS — GET ALL (ADMIN)
app.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, role, department, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// USERS — GET MY PROFILE
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, role, department, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// USERS — UPDATE MY PROFILE
app.put('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const { full_name, department, password } = req.body;

    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    await pool.query(`
      UPDATE users SET
        full_name  = COALESCE($1, full_name),
        department = COALESCE($2, department),
        password   = COALESCE($3, password)
      WHERE id = $4
    `, [full_name || null, department || null, hashedPassword, req.user.id]);

    res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// USERS — DELETE USER (ADMIN)
app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =========================================================
   CLUBS ROUTES
========================================================= */

// GET ALL CLUBS
app.get('/api/clubs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clubs ORDER BY club_name ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE CLUB (ADMIN)
app.post('/api/clubs', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { club_name, description, logo } = req.body;

    if (!club_name) {
      return res.status(400).json({ error: 'club_name is required.' });
    }

    const result = await pool.query(
      'INSERT INTO clubs (club_name, description, logo) VALUES ($1, $2, $3) RETURNING id',
      [club_name, description, logo]
    );

    res.status(201).json({
      success: true,
      message: 'Club created successfully.',
      clubId: result.rows[0].id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE CLUB (ADMIN)
app.put('/api/clubs/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { club_name, description, logo } = req.body;

    await pool.query(`
      UPDATE clubs SET
        club_name   = COALESCE($1, club_name),
        description = COALESCE($2, description),
        logo        = COALESCE($3, logo)
      WHERE id = $4
    `, [club_name, description, logo, id]);

    res.json({ success: true, message: 'Club updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE CLUB (ADMIN)
app.delete('/api/clubs/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM clubs WHERE id = $1', [id]);
    res.json({ success: true, message: 'Club deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =========================================================
   CATEGORIES ROUTES
========================================================= */

// GET ALL CATEGORIES
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE CATEGORY (ADMIN)
app.post('/api/categories', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required.' });
    }

    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING id',
      [name]
    );

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      categoryId: result.rows[0].id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE CATEGORY (ADMIN)
app.delete('/api/categories/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =========================================================
   ANALYTICS ROUTES (ADMIN)
========================================================= */

// DASHBOARD STATS
app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { rows: [{ total_events }] }        = await pool.query('SELECT COUNT(*) AS total_events FROM events');
    const { rows: [{ total_users }] }         = await pool.query(`SELECT COUNT(*) AS total_users FROM users WHERE role = 'student'`);
    const { rows: [{ total_registrations }] } = await pool.query(`SELECT COUNT(*) AS total_registrations FROM registrations WHERE registration_status = 'registered'`);
    const { rows: [{ total_checkins }] }      = await pool.query('SELECT COUNT(*) AS total_checkins FROM attendance WHERE checked_in = true');

    const { rows: top_events } = await pool.query(`
      SELECT
        events.id,
        events.title,
        events.event_date,
        COUNT(registrations.id) AS registration_count
      FROM events
      LEFT JOIN registrations
        ON events.id = registrations.event_id
        AND registrations.registration_status = 'registered'
      GROUP BY events.id
      ORDER BY registration_count DESC
      LIMIT 5
    `);

    res.json({
      total_events:        Number(total_events),
      total_users:         Number(total_users),
      total_registrations: Number(total_registrations),
      total_checkins:      Number(total_checkins),
      top_events
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =========================================================
   SERVER
========================================================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});