const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'grade_system.db');
const db = new sqlite3.Database(dbPath);

console.log('Initializing database...');

db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS audit_log`);
  db.run(`DROP TABLE IF EXISTS grades`);
  db.run(`DROP TABLE IF EXISTS users`);

  db.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'teacher', 'admin'))
    )
  `);

  db.run(`
    CREATE TABLE grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      grade TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT,
      FOREIGN KEY (student_id) REFERENCES users(id),
      UNIQUE(student_id, subject_id)
    )
  `);

  db.run(`
    CREATE TABLE audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      student_id TEXT,
      subject_id TEXT,
      action TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const hashedPassword = bcrypt.hashSync('password123', 10);

  const users = [
    ['20223948', 'Ezra', 'ezra@student.edu', hashedPassword, 'student'],
    ['20223949', 'Alice', 'alice@student.edu', hashedPassword, 'student'],
    ['20223950', 'Bob', 'bob@student.edu', hashedPassword, 'student'],
    ['20223951', 'Carol', 'carol@student.edu', hashedPassword, 'student'],
    ['T001', 'Dr. Smith', 'smith@teacher.edu', hashedPassword, 'teacher'],
    ['T002', 'Prof. Johnson', 'johnson@teacher.edu', hashedPassword, 'teacher'],
    ['A001', 'Admin User', 'admin@school.edu', hashedPassword, 'admin']
  ];

  const insertUser = db.prepare(`INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)`);
  users.forEach(user => insertUser.run(...user));

  const grades = [
    ['20223948', '1293', 'F'],
    ['20223949', '1293', 'A'],
    ['20223950', '1293', 'B'],
    ['20223951', '1293', 'C'],
    ['20223948', '1294', 'D'],
    ['20223949', '1294', 'HD'],
    ['20223950', '1294', 'P'],
    ['20223951', '1294', 'F']
  ];

  const insertGrade = db.prepare(`INSERT INTO grades (student_id, subject_id, grade) VALUES (?, ?, ?)`);
  grades.forEach(grade => insertGrade.run(...grade));

  console.log('Database initialized successfully!');
  console.log('\nTest Accounts:');
  console.log('Student: ezra@student.edu / password123');
  console.log('Teacher: smith@teacher.edu / password123');
  console.log('Admin: admin@school.edu / password123');
});
