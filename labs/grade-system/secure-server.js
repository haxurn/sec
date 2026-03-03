const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, 'grade_system.db');
const db = new sqlite3.Database(dbPath);

const JWT_SECRET = 'your-secret-key-change-in-production';
const PORT = 3000;

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function authorizeResourceAccess(req, res, next) {
  const requestedStudentId = req.query.studentid || req.body.studentId;
  
  if (req.user.id === requestedStudentId) {
    return next();
  }
  
  if (['teacher', 'admin'].includes(req.user.role)) {
    return next();
  }
  
  return res.status(403).json({ 
    error: 'Access Denied: You can only access your own grades' 
  });
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access Denied: ${req.user.role} role cannot perform this action` 
      });
    }
    next();
  };
}

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  });
});

app.get('/api/grades', 
  authenticateToken, 
  authorizeResourceAccess,
  (req, res) => {
    const { studentid, subjectid } = req.query;

    if (!studentid || !subjectid) {
      return res.status(400).json({ error: 'Missing studentid or subjectid' });
    }

    db.get(`
      SELECT g.*, u.name as student_name 
      FROM grades g 
      JOIN users u ON g.student_id = u.id 
      WHERE g.student_id = ? AND g.subject_id = ?
    `, [studentid, subjectid], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Grade not found' });
      }
      res.json(row);
    });
  }
);

app.patch('/api/grades',
  authenticateToken,
  requireRole(['teacher', 'admin']),
  (req, res) => {
    const { studentId, subjectId, grade } = req.body;

    if (!studentId || !subjectId || !grade) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const validGrades = ['HD', 'D', 'C', 'P', 'F'];
    if (!validGrades.includes(grade)) {
      return res.status(400).json({ error: 'Invalid grade value' });
    }

    db.run(`
      UPDATE grades 
      SET grade = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? 
      WHERE student_id = ? AND subject_id = ?
    `, [grade, req.user.id, studentId, subjectId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Grade not found' });
      }

      db.run(`
        INSERT INTO audit_log (user_id, student_id, subject_id, action)
        VALUES (?, ?, ?, ?)
      `, [req.user.id, studentId, subjectId, `Changed grade to ${grade}`]);

      res.json({ success: true, message: 'Grade updated successfully', newGrade: grade });
    });
  }
);

app.delete('/api/grades',
  authenticateToken,
  requireRole(['admin']),
  (req, res) => {
    const { studentid, subjectid } = req.query;

    if (!studentid || !subjectid) {
      return res.status(400).json({ error: 'Missing studentid or subjectid' });
    }

    db.run('DELETE FROM grades WHERE student_id = ? AND subject_id = ?', [studentid, subjectid], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Grade not found' });
      }

      db.run(`
        INSERT INTO audit_log (user_id, student_id, subject_id, action)
        VALUES (?, ?, ?, ?)
      `, [req.user.id, studentid, subjectid, 'Deleted grade']);

      res.json({ success: true, message: 'Grade deleted' });
    });
  }
);

app.get('/', (req, res) => {
  res.json({
    message: 'Grade Management System API (SECURE)',
    endpoints: {
      'POST /api/login': 'Login (body: email, password) - returns JWT token',
      'GET /api/grades?studentid=X&subjectid=Y': 'View grade (requires auth + authorization)',
      'PATCH /api/grades': 'Update grade (requires teacher/admin role)',
      'DELETE /api/grades?studentid=X&subjectid=Y': 'Delete grade (requires admin role)'
    },
    security: 'JWT Authentication + Role-Based Access Control + Ownership Validation'
  });
});

app.listen(PORT, () => {
  console.log(`Secure server running on http://localhost:${PORT}`);
  console.log('Security: JWT Auth + RBAC + Authorization');
});
