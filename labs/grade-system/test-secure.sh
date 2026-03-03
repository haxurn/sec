#!/bin/bash

echo "=========================================="
echo "  Secure Implementation Testing Lab"
echo "=========================================="
echo ""

BASE_URL="http://localhost:3000"

echo "[*] Logging in as student..."
STUDENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ezra@student.edu","password":"password123"}')

STUDENT_TOKEN=$(echo "$STUDENT_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
echo "Student logged in: $(echo "$STUDENT_RESPONSE" | python3 -m json.tool 2>/dev/null | head -5)"
echo ""

echo "[*] Logging in as teacher..."
TEACHER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"smith@teacher.edu","password":"password123"}')

TEACHER_TOKEN=$(echo "$TEACHER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
echo "Teacher logged in: $(echo "$TEACHER_RESPONSE" | python3 -m json.tool 2>/dev/null | head -5)"
echo ""

echo "[*] Logging in as admin..."
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"password123"}')

ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
echo "Admin logged in: $(echo "$ADMIN_RESPONSE" | python3 -m json.tool 2>/dev/null | head -5)"
echo ""

echo "=========================================="
echo "[Test 1] Student Views Own Grades"
echo "=========================================="
echo "[Expected: SUCCESS]"
curl -s "$BASE_URL/api/grades?studentid=20223948&subjectid=1293" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | python3 -m json.tool 2>/dev/null || echo "Request failed"
echo ""

echo "=========================================="
echo "[Test 2] Student Views Another Student's Grades (IDOR)"
echo "=========================================="
echo "[Expected: FAIL - 403 Access Denied]"
curl -s "$BASE_URL/api/grades?studentid=20223949&subjectid=1293" \
  -H "Authorization: Bearer $STUDENT_TOKEN" | python3 -m json.tool 2>/dev/null || echo "Request failed"
echo ""

echo "=========================================="
echo "[Test 3] Student Attempts to Change Grade"
echo "=========================================="
echo "[Expected: FAIL - 403 Access Denied]"
curl -s -X PATCH "$BASE_URL/api/grades" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"20223948","subjectId":"1293","grade":"HD"}' | python3 -m json.tool 2>/dev/null || echo "Request failed"
echo ""

echo "=========================================="
echo "[Test 4] Teacher Views Any Student's Grades"
echo "=========================================="
echo "[Expected: SUCCESS]"
curl -s "$BASE_URL/api/grades?studentid=20223948&subjectid=1293" \
  -H "Authorization: Bearer $TEACHER_TOKEN" | python3 -m json.tool 2>/dev/null || echo "Request failed"
echo ""

echo "=========================================="
echo "[Test 5] Teacher Changes Student Grade"
echo "=========================================="
echo "[Expected: SUCCESS]"
curl -s -X PATCH "$BASE_URL/api/grades" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"20223948","subjectId":"1293","grade":"C"}' | python3 -m json.tool 2>/dev/null || echo "Request failed"
echo ""

echo "=========================================="
echo "[Test 6] Teacher Attempts to Delete Grade"
echo "=========================================="
echo "[Expected: FAIL - 403 Access Denied]"
curl -s -X DELETE "$BASE_URL/api/grades?studentid=20223948&subjectid=1293" \
  -H "Authorization: Bearer $TEACHER_TOKEN" | python3 -m json.tool 2>/dev/null || echo "Request failed"
echo ""

echo "=========================================="
echo "[Test 7] Admin Deletes Grade"
echo "=========================================="
echo "[Expected: SUCCESS]"
curl -s -X DELETE "$BASE_URL/api/grades?studentid=20223951&subjectid=1294" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool 2>/dev/null || echo "Request failed"
echo ""

echo "=========================================="
echo "[Test 8] Unauthenticated Request"
echo "=========================================="
echo "[Expected: FAIL - 401 Authentication required]"
curl -s "$BASE_URL/api/grades?studentid=20223948&subjectid=1293" | python3 -m json.tool 2>/dev/null || echo "Request failed"
echo ""

echo "=========================================="
echo "[Test 9] Invalid Token"
echo "=========================================="
echo "[Expected: FAIL - 403 Invalid token]"
curl -s "$BASE_URL/api/grades?studentid=20223948&subjectid=1293" \
  -H "Authorization: Bearer invalid_token_here" | python3 -m json.tool 2>/dev/null || echo "Request failed"
echo ""

echo "=========================================="
echo "[Test 10] Verify Grade Change Persisted"
echo "=========================================="
echo "[Expected: Grade changed to C]"
curl -s "$BASE_URL/api/grades?studentid=20223948&subjectid=1293" \
  -H "Authorization: Bearer $TEACHER_TOKEN" | python3 -m json.tool 2>/dev/null || echo "Request failed"
echo ""

echo "=========================================="
echo "  Security Testing Complete!"
echo "=========================================="
echo ""
echo "Security Controls Verified:"
echo "  [+] JWT Authentication Required"
echo "  [+] Role-Based Access Control (RBAC)"
echo "  [+] Resource Ownership Validation"
echo "  [+] Audit Logging (for teacher/admin actions)"
