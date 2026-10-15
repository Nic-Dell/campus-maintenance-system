# Campus Care — Campus Maintenance System

Campus Care gives students and faculty one secure place to submit campus requests and follow their progress. Technicians choose their maintenance specialties, receive eligible assignments, document work, and leave a visible progress history.

The documented users, stakeholders, requirements, and use cases are in [REQUIREMENTS.md](REQUIREMENTS.md).

## Project description

Campus Care is a browser-based campus maintenance system. It helps campus community members submit and follow facilities requests, while verified technical staff accept requests in their specialties and document the work. The application uses server-side validation, role-based access, private image storage, and persistent MySQL/MariaDB records.

## Assigned system

Campus Maintenance System, built for the Node.js and Express Round 1 campus-system project. Confirm the assigned system name with the instructor before submission if the team assignment differs.

## Users and stakeholders

- **Students and faculty** submit campus requests and check their own request timelines.
- **Technical team members** choose specialties, accept matching requests, and record progress and resolution.
- **Campus administrators** verify campus IDs, oversee maintenance operations, and access the campus-wide request queue.
- **Facilities leadership and the campus community** benefit from safer, more reliable spaces and earlier visibility into repeated issues.

## Features

- Formal, responsive sign-in and student/faculty/technical-team registration with a unique campus ID.
- Students and faculty can sign in immediately after registration; administrator-only campus-ID verification is required for technical team accounts.
- Secure password hashing, server-side sessions, private request ownership, admin verification, and specialty-scoped technician access.
- Validated campus requests with categories, CSPC locations, room/area, priority, and description.
- Automatic category-matched technician assignment balances active workload among administrator-verified technicians. Urgent and high-priority requests appear first in technician queues; when no eligible technician is available, a qualified technician can claim the unassigned request.
- Technician request acceptance and assignment, with status changes limited to the assigned technician or an administrator and a reporter-visible note required for every status change.
- User profiles with private profile photos; technicians can add, change, and remove their specialties.
- Optional issue-area photos and required technical-team before/after photos at work start and completion. Private images are authenticated and limited to JPEG, PNG, or WebP files of 5 MB each.
- Persistent MySQL/MariaDB storage, searchable/filterable request queues, summary counts, and request history.
- Urgent requests are visually highlighted in red.
- Students and faculty can withdraw their own requests while they are still open.
- **Unique feature — Campus Pulse:** automatically groups unresolved reports by building and category. When at least two reports identify the same hotspot, the dashboard surfaces it, prioritizing urgent/high-priority clusters. This helps facilities staff notice recurring problems before they become larger disruptions.
- **Campus SLA Watch:** monitors each unresolved request against a priority-based service target and highlights overdue requests and those due within 24 hours.
- Requesters can rate resolved services from 1–5 and update their feedback; ratings and optional comments appear in administrator analytics.
- Admin-only analytics summarize request totals, priorities, categories, building demand, and average feedback. Administrators can download request and feedback reports in CSV or PDF formats.

### Campus request locations

The request form offers the following campus locations:

- Office of the President
- Administration Building
- CSPC Broadcast Center
- Laboratory and Shop Building
- Gymnasium
- School Canteen
- Library Building
- Auditorium
- Villafuerte Hall
- PaxS Office
- Center for Research and Development
- CSPC Theater
- College of Engineering and Architecture - Acad I
- CSPC Chapel
- Information and Communications Technology Unit
- Information, Broadcast, and Alumni Affairs
- Green Building
- College of Tourism, Hospitality and Business Management - Acad II
- Pearl Function Hall
- College of Technological and Development Education - Acad III
- College of Computer Studies - Acad IV
- Academic Building V
- College of Nursing - Acad VI

## Technologies

- Node.js, Express 5, EJS, HTML, CSS, and client/server-side JavaScript
- MySQL/MariaDB via XAMPP, with a one-time SQLite import utility for existing installations
- SQLite (`sqlite3`) retained as an import source and for isolated workflow tests
- PDFKit for administrator PDF exports
- `express-session` for sessions, `bcrypt` for password hashing, and `dotenv` for configuration
- Native Node.js test runner (`node:test`) for application workflow tests

## Requirements

- Node.js 18 or newer and npm
- XAMPP MySQL/MariaDB for the default Windows setup; other MySQL-compatible servers are supported through `.env`

## Installation

1. Install dependencies with `npm.cmd install` in Windows PowerShell.
2. In the XAMPP Control Panel, start **MySQL**. Start **Apache** too if you want to use phpMyAdmin.

## Configuration

1. Copy `.env.example` to `.env` for a fresh setup. Preserve existing private admin values if `.env` already exists.
2. Configure `DB_DRIVER=mysql`, `MYSQL_HOST=127.0.0.1`, `MYSQL_PORT=3306`, `MYSQL_USER=root`, `MYSQL_PASSWORD=` (the default local XAMPP setup commonly has no root password), and `MYSQL_DATABASE=campus_maintenance`. If your MySQL root account has a password, set it privately in `.env`.
3. Keep a long, random `SESSION_SECRET` in `.env` and never commit that file.
4. To provision a first administrator, set `ADMIN_EMAIL`, `ADMIN_UNIQUE_ID` (4-32 digits), and an `ADMIN_PASSWORD` of at least 12 characters (optionally `ADMIN_NAME`). Public registration cannot create administrator accounts.
5. Optionally set `UPLOADS_PATH` to an absolute path to store private profile and request images outside the project folder.

## Database setup

The application creates the `campus_maintenance` MySQL database, tables, and indexes on first start. Private request images are stored outside the public web directory in `data/campus-maintenance-uploads/` by default and are excluded from Git. On upgrade, student and faculty accounts are set to Accepted; existing technician verification statuses are retained, and new technician accounts begin Pending. Older technician accounts without a campus ID cannot be accepted; ask those people to register again with their campus ID. An existing administrator without a campus ID must be matched to `ADMIN_EMAIL` and assigned `ADMIN_UNIQUE_ID` in `.env`; its existing password does not need to be changed. Keep `.env`, database backups, and uploaded photos private.

### Import the existing SQLite database once

If you already have records in `data/campus-maintenance.sqlite`, first back up that file and the matching `data/campus-maintenance-uploads/` folder. Ensure XAMPP **MySQL** is running and `.env` contains the MySQL settings above. From PowerShell in the project folder, run:

```powershell
npm.cmd run db:import-sqlite
```

The importer creates the MySQL database and copies account hashes, verification states, technician specialties, profile and request image references, requests, timelines, and service deadlines. It refuses to import if the target tables already contain records, and it leaves the SQLite source and image files untouched. By default it reads `data/campus-maintenance.sqlite`; set `SQLITE_IMPORT_PATH` in `.env` if your old SQLite file is elsewhere. Once imported, the MySQL database becomes the live application database.

### View Campus Care data in phpMyAdmin

1. Open **XAMPP Control Panel** and start **MySQL** and **Apache**.
2. Open [http://localhost/phpmyadmin/](http://localhost/phpmyadmin/).
3. In the left sidebar, select **campus_maintenance** (or the database name set by `MYSQL_DATABASE`).
4. Select a table such as `users`, `maintenance_requests`, or `request_updates`, then choose **Browse** to view its rows.

The app connects directly to MySQL/MariaDB; it does not connect through phpMyAdmin. phpMyAdmin is only a database browser/manager. If MySQL has a password on your installation, set the same credential in `.env` as `MYSQL_PASSWORD`. Avoid editing live records directly in phpMyAdmin while the app is running; back up first, because manual changes can bypass application validation and relationships.

## How to run

From PowerShell in the project directory, start Campus Care:

```powershell
npm.cmd start
```

Open [http://localhost:3000](http://localhost:3000). Run the automated workflow tests with `npm.cmd test`.

## User accounts

- **Students and faculty:** create an account at `/register` with a unique 4-32 digit campus ID. They can sign in immediately without administrator approval.
- **Technical team:** register as **Technical team** and select at least one maintenance specialty. After admin verification, the technician sees matching unassigned requests, accepts one to take responsibility, and then updates its status. Their specialty list and profile photo can be changed on **Profile**.
- **Administrators:** no public admin registration is available. The first administrator is bootstrapped from the private `ADMIN_EMAIL`, `ADMIN_UNIQUE_ID`, and `ADMIN_PASSWORD` settings in `.env`. The bootstrap password must be at least 12 characters. Existing administrator passwords are not reset by changing `.env`.

## Administrator sign-in

Open `http://localhost:3000/login` and use the administrator email and password configured in `.env` when the administrator account was first created. For a fresh installation, uncomment and set `ADMIN_EMAIL`, `ADMIN_UNIQUE_ID`, and `ADMIN_PASSWORD` in `.env`, then start the application; the bootstrap password must be at least 12 characters. After signing in, select **Admin verification** in the navigation.

If an administrator account already exists, changing the bootstrap values does not change its stored password. Sign in with the existing account password; there is no password-reset screen yet. Keep `.env` private and out of Git.

Students and faculty submit Campus Requests with their unique campus ID number. All roles can view and update their profile name, email, and private profile photo. Technical team accounts in Pending or Rejected status cannot sign in. Request and profile photos are stored privately outside the public web directory. Technician before-work evidence is required to begin work; after-work evidence is required before marking a request resolved. Urgent requests are highlighted in red.

Campus SLA Watch uses initial targets of Urgent: 24 hours, High: 72 hours, Normal: 7 days, and Low: 14 days. Confirm or adjust these targets with campus facilities policy before operational use.

## Main use cases

1. **Submit a campus request** — a signed-in student/faculty member chooses a category, location, and priority, describes the problem, and submits it. Matching technicians can accept and take responsibility for the request; its history is shown on the detail page.
2. **Track a request** — the reporter opens their dashboard and sees the current status and chronological updates. They cannot view another user's request.
3. **Accept and update work** — technicians see only unassigned requests in their chosen specialties and work assigned to them. They accept a request, then change its status with an optional note. The update appears in its timeline.
4. **Spot a recurring issue** — the dashboard groups open reports by building and category. Clusters of two or more reports are shown in Campus Pulse to help teams identify hotspots.

## Access control and data handling

- Public registration accepts student, faculty, and technical-team roles and requires a unique 4-32 digit campus ID. Students and faculty are accepted immediately. Technical-team accounts must select one or more specialties and remain Pending until an administrator marks them Verifying, Accepted, or Rejected. Only Accepted accounts can sign in; the administrator verification queue contains technicians only.
- Request pages require a session. Students/faculty can access only their own requests; technicians can access only requests in their specialties or assigned to them; administrators can access the campus queue.
- All database writes use bound SQL parameters; submitted values are checked server-side, and EJS escapes interpolated text by default.
- Sessions use an HTTP-only, same-site cookie, regenerate after sign-in, and expire after eight hours. Set `NODE_ENV=production` when deploying behind HTTPS.
- The default Express MemoryStore is for a single-process classroom demonstration, not a production multi-instance deployment. Configure a durable session store before production use.

## Project structure

```text
app.js
config/db.js
.env.example
package.json
README.md
REQUIREMENTS.md
INSTRUCTIONS.txt
LICENSE
scripts/
  import-sqlite-to-mysql.js
controllers/
  adminController.js
  authController.js
  maintenanceController.js
  profileController.js
middleware/
  auth.js
  imageUploads.js
models/maintenance.js
models/accounts.js
routes/
  admin.js
  auth.js
  maintenance.js
  profile.js
public/css/style.css
views/
  dashboard.ejs
  login.ejs
  register.ejs
  request-form.ejs
  request-detail.ejs
  admin-verifications.ejs
  profile.ejs
  error.ejs
  partials/
test/
  app.test.js
```

## Team members

The assignment requires exactly three team members. Replace the name placeholders with the team's actual names and identify each member's substantial, verified contributions before submission. Do not claim work or GitHub evidence that is not present.

| Team member | Primary contribution (complete with the actual work) |
| --- | --- |
| Member 1 — **name required** | Backend, routes, and business logic — document actual features and links |
| Member 2 — **name required** | Frontend, pages, and forms — document actual features and links |
| Member 3 — **name required** | Database, authentication, and testing — document actual features and links |

## GitHub collaboration checklist

The course requires visible, genuine collaboration: feature branches, task issues with assignees and expected results, conventional commits, pull requests linked to issues, substantive peer reviews, and a Project board reflecting real work. As currently checked, the remote repository has only `main` and its initial commit, no issues, and no pull requests; team-member names, reviews, and a Project board have not been evidenced here. Complete these requirements with the team and link the actual evidence before submission. Do not create retrospective or fabricated contributions.

## Known limitations

- Email notifications, assignment scheduling, and multi-campus tenancy are not implemented.
- The lightweight default session store is unsuitable for production or multiple application instances.
- The campus location list reflects the supplied CSPC buildings; confirm current official building names and spelling with the institution.
- Campus Pulse and Campus SLA Watch are transparent rule-based prioritization tools, not predictive analytics or emergency dispatch systems.

## AI assistance disclosure

AI assistance was used to help implement and document this project. The student team remains responsible for understanding, testing, reviewing, and defending all submitted code and for accurately documenting each member's contribution.

## License

MIT — see [LICENSE](LICENSE).

## Step-by-step: publish this project on GitHub

### 1. Create a GitHub repository

1. Sign in to [GitHub](https://github.com/).
2. Select **＋** → **New repository**.
3. Enter a repository name, for example `campus-maintenance-system`, and an optional description.
4. Choose **Private** or **Public** according to your instructor's requirements.
5. Because this project already has files, leave **Add a README file**, **Add .gitignore**, and **Choose a license** unchecked.
6. Select **Create repository**. Keep the new repository page open so you can copy its HTTPS URL.

### 2. Check the local project and protect private files

Open PowerShell in the project folder:

```powershell
cd C:\xampp\htdocs\CampusMaintenanceSystem
```

Check that the local environment file and generated files are ignored before staging anything:

```powershell
git status
git check-ignore .env node_modules data
```

`.env`, `node_modules/`, and the local SQLite database must not be uploaded. The repository includes `.env.example` for safe setup instructions. If `git check-ignore` reports that a private file is not ignored, stop and fix `.gitignore` before continuing. Never stage or push `.env`.

### 3. Initialize Git and make the first commit

If this folder is not already a Git repository, run:

```powershell
git init
git branch -M main
git add .
git status
```

Review the `git status` output. Make sure `.env`, `node_modules/`, and database files are not listed for commit. Then create the initial commit:

```powershell
git commit -m "feat: create campus maintenance system"
```

If Git asks for your identity, set the name and email that should appear on your commits:

```powershell
git config --global user.name "Nic-Dell"
git config --global user.email "nidelloson@my.cspc.edu.ph"
```

Then repeat the `git commit` command.

### 4. Connect the local folder to GitHub and push

Copy the repository's HTTPS URL from GitHub. Replace the example URL below with your own:

```powershell
git remote add origin https://github.com/Nic-Dell/campus-maintenance-system.git
git remote -v
git push -u origin main
```

GitHub may prompt you to sign in in a browser or with Git Credential Manager. Use GitHub's sign-in flow; do not put a password or access token into the remote URL. Refresh the GitHub repository page to verify that the project files and initial commit are visible.

If `git remote add origin` says that `origin` already exists, inspect it with `git remote -v`. If it points to the correct repository, continue to `git push -u origin main`. If it points to the wrong repository, replace it only after checking the intended URL:

```powershell
git remote set-url origin https://github.com/YOUR-USERNAME/campus-maintenance-system.git
```

### 5. Add your teammates as collaborators

The repository owner opens the GitHub repository and selects **Settings** → **Collaborators** (or **Collaborators and teams**) → **Add people**. Search for each teammate's GitHub username and send an invitation. Each teammate must accept the invitation before they can contribute.

### 6. Have each teammate clone the repository

Each teammate copies the repository's HTTPS URL and runs these commands in their own terminal:

```powershell
cd C:\xampp\htdocs
git clone https://github.com/YOUR-USERNAME/campus-maintenance-system.git
cd campus-maintenance-system
npm.cmd install
Copy-Item .env.example .env
```

Each person should edit their own local `.env`, set a private random `SESSION_SECRET`, and never commit that file. Start XAMPP MySQL, then run `npm.cmd start`; Campus Care creates its MySQL database automatically when it starts.

### 7. Make changes on a feature branch

Before starting a task, update `main` and create a branch with a clear name. For example:

```powershell
git switch main
git pull origin main
git switch -c feature/request-search
```

Make and test the change, then review exactly what will be committed:

```powershell
npm.cmd test
git status
git diff
git add .
git diff --cached
git commit -m "feat: add request search and filters"
git push -u origin feature/request-search
```

Use meaningful [Conventional Commit](https://www.conventionalcommits.org/) messages, such as `feat: ...`, `fix: ...`, `test: ...`, or `docs: ...`. If Git reports a file that should remain private, do not commit it; correct the staging or ignore rule first.

### 8. Open and review a pull request

1. After pushing a feature branch, open the GitHub repository. Use the **Compare & pull request** prompt, or select **Pull requests** → **New pull request**.
2. Set the base branch to `main` and the compare branch to your feature branch.
3. Give the pull request a descriptive title. Explain what changed, which task or issue it addresses, and the tests you ran.
4. Request a review from a teammate. The reviewer should inspect the actual changes, test behavior where appropriate, and leave specific feedback—not only “Looks good.”
5. Address requested changes on the same feature branch, commit, and push again.
6. After approval and passing checks, merge the pull request on GitHub. Do not merge another person's work without the required review.
7. After merging, update your local `main` before beginning another task:

```powershell
git switch main
git pull origin main
```

### 9. Track work with GitHub Issues and a Project board

Create an issue for each manageable task. Include its description, responsible person, and expected result; use labels such as `feature`, `bug`, or `documentation`. When opening a pull request, reference its issue in the description—for example, `Closes #12`.

Create a GitHub Project from the repository's **Projects** tab and add columns/statuses such as **Backlog**, **Todo**, **In Progress**, **Review**, and **Done**. Move issues as work progresses so the board reflects the team's actual status.

### 10. Keep the repository ready for submission

- Confirm all three actual team members are listed in this README and have substantial, traceable contributions.
- Show feature branches, issues, reviewed pull requests, useful commit messages, and an up-to-date project board.
- Keep `.env`, passwords, access tokens, and local database files out of GitHub.
- Ask every team member to test the installed application and be prepared to explain their changes, routes, data storage, validation, and access-control decisions.

========================================================================
NOBODY IS ALLOWED TO RUN THIS BUT ME
========================================================================
# 1. Create and switch to a new feature branch
git switch -c feature/your-feature-name

# 2. Make your code changes in VS Code, then stage and commit them
git add .
git commit -m "feat: describe what you built or changed"

# 3. Push the feature branch up to GitHub
git push -u origin feature/your-feature-name

========================================================================

n0ooooooooooooo