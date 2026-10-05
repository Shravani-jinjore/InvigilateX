# 📋 InvigilateX — AI-Based Invigilation Duty Allocation System

A full-stack production-ready web application for automated invigilation duty allocation using a greedy algorithm with constraint handling, role-based access, and fair workload distribution.

---

## 🏗️ Tech Stack

| Layer        | Technology                      |
|--------------|----------------------------------|
| Frontend     | React 18 + React Router v6       |
| Styling      | Inline styles + DM Sans font     |
| Backend      | Node.js + Express                |
| Database     | Supabase (PostgreSQL)            |
| Auth         | Supabase Auth (JWT)              |
| File Upload  | Multer + PapaParse + XLSX        |
| Toasts       | react-hot-toast                  |

---

## 📁 Project Structure

```
invigilation-system/
├── database.sql                    # Full Supabase schema + RLS policies
├── README.md
│
├── backend/
│   ├── server.js                   # Express entry point
│   ├── supabaseClient.js           # Supabase service-role client
│   ├── package.json
│   ├── .env.example
│   ├── middleware/
│   │   └── auth.js                 # JWT verification + role guards
│   ├── routes/
│   │   ├── auth.js                 # POST /login, /register
│   │   ├── faculty.js              # CRUD /faculty
│   │   ├── subjects.js             # CRUD /subjects
│   │   ├── availability.js         # /availability (+ bulk)
│   │   ├── exams.js                # CRUD /exams
│   │   ├── upload.js               # POST /upload (CSV/Excel)
│   │   ├── allocation.js           # POST /generate-allocation, GET /allocations
│   │   └── report.js               # GET /report (JSON + CSV export)
│   └── utils/
│       └── allocationAlgorithm.js  # Core greedy allocation engine
│
└── frontend/
    ├── package.json
    ├── .env.example
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        ├── App.js                  # Routes + ProtectedRoute guards
        ├── supabaseClient.js
        ├── context/
        │   └── AuthContext.js      # Auth state + role management
        ├── hooks/
        │   └── useApi.js           # Authenticated API call utility
        └── pages/
            ├── Login.js
            ├── admin/
            │   ├── AdminDashboard.js
            │   ├── FacultyManagement.js
            │   ├── ExamSchedule.js
            │   ├── UploadTimetable.js
            │   ├── AllocationsView.js
            │   └── ReportPage.js
            └── faculty/
                ├── FacultyDashboard.js
                ├── AvailabilityCalendar.js
                ├── SubjectsPage.js
                └── MyDuties.js
```

---

## ⚡ Setup Instructions

### Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL Editor, paste and run the entire contents of `database.sql`
3. Note your **Project URL** and **Anon Key** (Settings → API)
4. Note your **Service Role Key** (keep this secret — backend only)

### Step 2 — Create an Admin User

In Supabase Dashboard → Authentication → Users → "Invite user":
- Create `admin@yourdomain.com` with a strong password
- Then in SQL Editor, insert their role:

```sql
INSERT INTO public.users (id, email, role)
VALUES (
  '<paste-user-uuid-from-auth-users>',
  'admin@yourdomain.com',
  'admin'
);
```

### Step 3 — Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your Supabase credentials
npm install
npm run dev    # Starts on http://localhost:4000
```

### Step 4 — Frontend Setup

```bash
cd frontend
cp .env.example .env
# Edit .env with your Supabase URL and anon key
npm install
npm start      # Starts on http://localhost:3000
```

---

## 🔑 API Routes Reference

| Method | Route                        | Role    | Description                         |
|--------|------------------------------|---------|-------------------------------------|
| POST   | /api/login                   | Public  | Sign in, returns JWT + role         |
| POST   | /api/register                | Admin   | Create a new auth user              |
| GET    | /api/faculty                 | Auth    | List all faculty with subjects      |
| POST   | /api/faculty                 | Admin   | Add faculty (+ optional auth user)  |
| PUT    | /api/faculty/:id             | Admin   | Update faculty record               |
| DELETE | /api/faculty/:id             | Admin   | Delete faculty                      |
| GET    | /api/subjects?faculty_id=    | Auth    | Get subjects for a faculty member   |
| POST   | /api/subjects                | Auth    | Add a subject                       |
| DELETE | /api/subjects/:id            | Auth    | Remove a subject                    |
| GET    | /api/availability?faculty_id=| Auth    | Get availability records            |
| POST   | /api/availability            | Auth    | Upsert a single date's availability |
| POST   | /api/availability/bulk       | Auth    | Bulk upsert availability dates      |
| DELETE | /api/availability/:id        | Auth    | Remove an availability record       |
| GET    | /api/exams                   | Auth    | List all exam slots                 |
| POST   | /api/exams                   | Admin   | Add exam slot                       |
| PUT    | /api/exams/:id               | Admin   | Update exam slot                    |
| DELETE | /api/exams/:id               | Admin   | Delete exam slot                    |
| POST   | /api/upload                  | Admin   | Upload CSV/Excel timetable          |
| POST   | /api/generate-allocation     | Admin   | Run greedy allocation algorithm     |
| GET    | /api/allocations             | Auth    | Get allocations (filterable)        |
| GET    | /api/report?format=json/csv  | Auth    | Full allocation report              |
| GET    | /api/report/summary          | Auth    | Per-faculty duty count summary      |

---

## 🧠 Allocation Algorithm

**File:** `backend/utils/allocationAlgorithm.js`

```
generateInvigilationDuty()
│
├── Load all exams (ordered by date + session)
├── Load all faculty (with their subjects)
├── Load all availability records
├── Clear existing allocations + reset duty counts
│
└── FOR each exam:
    ├── Filter eligible faculty:
    │   ✗ Skip if duty_count >= max_duty
    │   ✗ Skip if already assigned this date+session
    │   ✗ Skip if marked "unavailable" on this date
    │
    ├── Sort eligible faculty by:
    │   1. Subject match (teaches this course → priority)
    │   2. duty_count ASC (least duties first)
    │   3. employment_type priority (type1 > type2 > ... > type6)
    │
    └── Assign top N faculty (N = rooms_required)
        └── Update duty_count + assignedDates
```

---

## 📤 CSV Upload Format

Your CSV/Excel file must include these columns (header row required):

```csv
date,session,subject_name,course_code,rooms_required
2024-05-10,FN,Data Structures,CS301,3
2024-05-10,AN,Database Management,CS302,2
2024-05-11,FN,Operating Systems,CS303,4
```

- **date**: YYYY-MM-DD format
- **session**: `FN` (Forenoon) or `AN` (Afternoon)
- **rooms_required**: Number of invigilators needed

---

## 👥 Employment Type Priority

| Type  | Label                      | Priority |
|-------|----------------------------|----------|
| type1 | Professor                  | Highest  |
| type2 | Associate Professor        | 2        |
| type3 | Asst. Prof Senior Grade    | 3        |
| type4 | Assistant Professor        | 4        |
| type5 | Lecturer                   | 5        |
| type6 | Guest Faculty              | Lowest   |

---

## 🔒 Security Features

- JWT verification on every protected route
- Role-based access control (Admin / Faculty)
- Supabase Row Level Security (RLS) on all tables
- Service role key used only on server-side
- Rate limiting (200 req/15min per IP)
- Helmet.js security headers
- File upload validation (type + size limits)

---

## 🌟 Features Summary

### Admin Portal
- ✅ Dashboard with stats & quick actions
- ✅ Faculty CRUD (with optional auth account creation)
- ✅ Exam schedule management
- ✅ CSV/Excel timetable upload
- ✅ One-click allocation generation
- ✅ Allocation view with filters
- ✅ Workload distribution chart
- ✅ CSV report export

### Faculty Portal
- ✅ Personal dashboard with upcoming duties
- ✅ Interactive calendar (Blue=Available, Red=Unavailable)
- ✅ Bulk "mark all weekdays" action
- ✅ Subject management (influences algorithm priority)
- ✅ Duty list with past/upcoming filter

---

## 🛠️ Environment Variables

### Backend `.env`
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Frontend `.env`
```
REACT_APP_SUPABASE_URL=https://xxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGc...
REACT_APP_API_URL=http://localhost:4000/api
```
