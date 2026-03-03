const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, 'grade_system.db');
const db = new sqlite3.Database(dbPath);

const PORT = 3000;

app.get('/api/grades', (req, res) => {
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
});

app.patch('/api/grades', (req, res) => {
  const { studentId, subjectId, grade } = req.body;

  if (!studentId || !subjectId || !grade) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(`
    UPDATE grades SET grade = ?, updated_at = CURRENT_TIMESTAMP WHERE student_id = ? AND subject_id = ?
  `, [grade, studentId, subjectId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Grade not found' });
    }
    res.json({ success: true, message: 'Grade updated successfully', newGrade: grade });
  });
});

app.delete('/api/grades', (req, res) => {
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
    res.json({ success: true, message: 'Grade deleted' });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const bcrypt = require('bcrypt');
    const validPassword = bcrypt.compareSync(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      message: 'Login successful (no token - this is vulnerable!)'
    });
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Grade Management System API (VULNERABLE)',
    endpoints: {
      'GET /api/grades?studentid=X&subjectid=Y': 'View grade',
      'PATCH /api/grades': 'Update grade (body: studentId, subjectId, grade)',
      'DELETE /api/grades?studentid=X&subjectid=Y': 'Delete grade',
      'POST /api/login': 'Login (body: email, password)'
    },
    vulnerability: 'NO ACCESS CONTROL - Anyone can view/modify any grade!'
  });
});

app.listen(PORT, () => {
  console.log(`Vulnerable server running on http://localhost:${PORT}`);
  console.log('WARNING: This server has NO access control!');
});
