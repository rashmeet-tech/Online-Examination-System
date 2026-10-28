# OS Lab — Examination and Evaluation System

A classroom demonstration app that combines a small online examination workflow with interactive Operating Systems algorithm simulators. The project uses the original React/Vite frontend, Express backend, and local JSON storage; it does not require a database server.

## Project overview

**Problem statement:** A classroom exam demo needs to show the student experience and give an instructor a way to manage tests, inspect results, and demonstrate OS topics using understandable examples.

**Objectives**

- Let students register, sign in, take a timed multiple-choice exam, and review their result.
- Give an administrator exam management, result summaries, and a live view of exam-related process records.
- Demonstrate CPU scheduling, contiguous memory allocation, page replacement, and the Banker safety algorithm.
- Keep setup small enough to run locally on a Windows laptop for a college presentation.

## Roles and features

### Administrator

- Dashboard with student, exam, question, submission, score, and pass-rate totals.
- Create exams with four options per question and an A–D correct answer.
- View submissions and inspect the simulated process monitor.
- Run the OS algorithm demonstrations.
- Delete an exam only while it has no submissions or active attempts, preserving result history.

### Student

- Register a student account or use the included demo account.
- View available exams and previous results.
- Take a countdown-timed exam; selected answers are saved as they are chosen.
- Resume an unfinished attempt after a page refresh while the backend is still running.
- Receive a result with score, pass/fail status, and correct/wrong/unanswered counts.

### OS algorithm demonstrations

- **CPU scheduling:** FCFS, non-preemptive SJF, non-preemptive priority (lower number is higher priority), and Round Robin. Results include a Gantt timeline and CT/TAT/WT/RT values.
- **Memory allocation:** First Fit, Best Fit, and Worst Fit over splittable free holes, with assignments and internal/external fragmentation totals.
- **Page replacement:** FIFO, LRU, and Optimal, with frame-by-frame steps and hit/fault totals.
- **Banker’s algorithm:** calculates Need and tests whether a safe process sequence exists.

## Operating Systems concepts: what is and is not simulated

The four algorithm panels run their algorithms in JavaScript against the entered sample data. They are educational simulations; they do not schedule real operating-system processes or allocate physical memory.

The live monitor is also a simulation: the application records an `EXAM` process state when an exam begins, then records terminated evaluation/result process entries when a submission is scored. These records are not operating-system processes or threads. The web server does **not** implement semaphores, worker threads, multiprocess synchronization, or production deadlock handling. Its JSON file is intended for a single local demo instance, not multiple server processes writing concurrently.

## Technologies and architecture

- **Frontend:** React 18, Vite 5, plain CSS.
- **Backend:** Node.js, Express 4, CORS middleware.
- **Storage:** local `backend/db.json`, created with demo data on first run. Writes use a temporary file followed by a rename to reduce the chance of a partial JSON file.
- **Authentication:** simple in-memory demo sessions. A session token survives a page refresh in the current browser tab, but signing in again is required after restarting the backend.
- **API:** JSON endpoints under `/api`; Vite forwards local development requests from port 5173 to port 5000.
- **Tests:** Node’s built-in test runner; no test framework installation is needed.

## Folder structure

```text
OS-EXAMINATION-SYSTEM-FINAL/
├── README.md
├── .gitignore
├── backend/
│   ├── package.json
│   ├── server.js
│   └── test/
│       └── algorithms.test.mjs
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── index.css
        ├── main.jsx
        └── utils/
            └── osAlgorithms.js
```

## Requirements

- Windows 10 or 11 (or another OS with Node support).
- Node.js 18 or later; Node.js 20 LTS is recommended.
- npm, installed with Node.js.
- VS Code is recommended but not required.
- Two free local ports: 5000 (API) and 5173 (frontend).

## Windows / VS Code setup

1. Extract `OS-EXAMINATION-SYSTEM-FINAL.zip` to a writable folder, for example `C:\College\OS-EXAMINATION-SYSTEM-FINAL`.
2. In VS Code, select **File → Open Folder…** and open that extracted folder.
3. Open **Terminal → New Terminal**. Start the backend:

   ```powershell
   cd backend
   npm install
   npm run dev
   ```

   Keep this terminal open. The API starts at `http://localhost:5000`.

4. Open a **second** VS Code terminal at the project root. Start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

5. Open the local URL Vite prints (normally `http://localhost:5173`).

If PowerShell blocks the `npm` command, use **Command Prompt** as the VS Code terminal profile, then run the same commands. Do not delete `backend/db.json` unless you intentionally want to reset all local demo data.

## Demo accounts

| Role | ID | Password |
|---|---|---|
| Administrator | `admin` | `admin123` |
| Student | `S101` (also `S102`–`S105`) | `student123` |

These credentials are intentionally public demo credentials. This app is for a local classroom demonstration—not a production examination service. Do not expose it to the public internet or use real student records or passwords.

## Suggested demonstration

1. Start both servers and sign in as `admin`.
2. Open **Manage Exams** and create a short exam. Enter one question per line using:

   ```text
   Question text | Option A | Option B | Option C | Option D | correct letter | marks
   ```

   Example:

   ```text
   What is a process? | Program in execution | A file on disk | A compiler | A cable | A | 2
   ```

3. Open the student portal in a private/incognito browser window, sign in as `S101`, start the exam, answer a question, and submit. Refresh during an attempt to show that the saved answers and remaining time are restored.
4. Return to the administrator window to show the submission and live process records.
5. Demonstrate the CPU, memory, paging, and Banker’s algorithm panels with their built-in sample inputs.

## Run tests and build

From the project root, run the OS algorithm tests:

```powershell
cd backend
npm test
```

Build the frontend:

```powershell
cd ..\frontend
npm install
npm run build
```

Vite writes the production frontend to `frontend/dist/`. The repository does not include compiled output or installed dependencies; both are recreated by the commands above.

## Data and configuration

- The backend uses a path relative to `backend/server.js`, so it does not depend on the current working directory.
- `backend/db.json` is generated on first backend launch and excluded from source control. The final source ZIP does not include this runtime data file. Back up `backend/db.json` before making changes if it contains data you need.
- No `.env` file or external database setup is required. The backend uses port 5000 and the Vite development server uses port 5173. If you change either port, update the corresponding Vite proxy or server setting.
- The data file is designed for one local Node.js server process. Do not run multiple backend instances against the same file.

## Testing performed and limitations

- Automated tests cover representative FCFS and Round Robin calculations, all memory-fit strategies, page-replacement counts, Banker’s safe/unsafe states, and invalid algorithm inputs. Run them with `cd backend && npm test`.
- Frontend production compilation can be verified with `cd frontend && npm install && npm run build`.
- The application is designed for local browser testing with both servers running; there is no automated browser/E2E suite in this package.
- Demo authentication uses in-memory sessions and SHA-256 password hashes for simplicity, not production-grade credential storage. Session records are lost when the backend restarts.
- The process monitor and OS algorithm panels simulate concepts within the app; they are not a substitute for a real OS process/thread demonstration.
