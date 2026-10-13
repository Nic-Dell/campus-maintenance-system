# Campus Care — Campus Maintenance System

Campus Care gives students and faculty one clear place to report maintenance problems, follow request progress, and help campus teams prioritize repairs. Maintenance staff see a campus-wide queue, update request statuses, and leave a visible progress history.

The documented users, stakeholders, requirements, and use cases are in [REQUIREMENTS.md](REQUIREMENTS.md).

## Assigned system

Campus Maintenance System, built for the Node.js and Express Round 1 campus-system project.

## Users and stakeholders

- **Students and faculty** report issues and check their own request timelines.
- **Maintenance staff** triage the campus queue and record progress and resolution.
- **Campus administrators** oversee maintenance operations and provision staff accounts.
- **Facilities leadership and the campus community** benefit from safer, more reliable spaces and earlier visibility into repeated issues.

## Features

- Responsive sign-in, public student/faculty registration, and role-aware navigation.
- Secure password hashing, server-side sessions, private request ownership, and staff-only status changes.
- Validated issue reports with categories, campus locations, room/area, priority, and description.
- Persistent SQLite storage, searchable/filterable request queues, summary counts, and request history.
- Students and faculty can withdraw their own requests while they are still open.
- **Unique feature — Campus Pulse:** automatically groups unresolved reports by building and category. When at least two reports identify the same hotspot, the dashboard surfaces it, prioritizing urgent/high-priority clusters. This helps facilities staff notice recurring problems before they become larger disruptions.

## Technologies

- Node.js, Express 5, EJS, HTML, CSS, and client/server-side JavaScript
- SQLite (`sqlite3`) for durable local storage
- `express-session` for sessions, `bcrypt` for password hashing, and `dotenv` for configuration
- Native Node.js test runner (`node:test`) for application workflow tests

## Requirements

- Node.js 18 or newer and npm
- Windows, macOS, or Linux; XAMPP is not required for this Node/Express application

## Installation and configuration

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `SESSION_SECRET` to a long, random, private value. Keep `.env` out of Git.
4. To provision the first administrator, set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 12 characters (and optionally `ADMIN_NAME`) in `.env` before first start. The administrator is created only if the email is not already present. Registration never allows users to assign themselves staff/admin roles.
5. Optionally set `DB_PATH` to an absolute path if the SQLite database should live outside the default `data/` directory.

## Database setup

The application creates the SQLite database directory, tables, indexes, and request-history schema on first start. The default database is `data/campus-maintenance.sqlite`; it is persistent and excluded from Git. Do not put a live database or credentials in the repository.

## How to run

```powershell
npm start
```

Visit [http://localhost:3000](http://localhost:3000). Students/faculty can create an account from the sign-in page. Staff/admin accounts must be provisioned by an administrator (or set up through the optional initial-admin environment variables).

Run automated workflow tests with:

```powershell
npm test
```

## Main use cases

1. **Report an issue** — a signed-in student/faculty member chooses a category, location, and priority, describes the problem, and submits it. The request and initial timeline entry are stored and shown on its detail page.
2. **Track a request** — the reporter opens their dashboard and sees the current status and chronological updates. They cannot view another user's request.
3. **Triage and update** — staff sign in, search/filter the campus-wide queue, open a request, and change its status with an optional note. The update appears in its timeline.
4. **Spot a recurring issue** — the dashboard groups open reports by building and category. Clusters of two or more reports are shown in Campus Pulse to help teams identify hotspots.

## Access control and data handling

- Public registration accepts student/faculty roles only. Staff and admin accounts are provisioned securely outside public registration.
- Request pages require a session. Reporters can access only their own requests; staff/admin can access the campus queue and change statuses.
- All database writes use bound SQL parameters; submitted values are checked server-side, and EJS escapes interpolated text by default.
- Sessions use an HTTP-only, same-site cookie, regenerate after sign-in, and expire after eight hours. Set `NODE_ENV=production` when deploying behind HTTPS.
- The default Express MemoryStore is for a single-process classroom demonstration, not a production multi-instance deployment. Configure a durable session store before production use.

## Project structure

```text
app.js
config/db.js
controllers/
  authController.js
  maintenanceController.js
middleware/auth.js
models/maintenance.js
routes/
  auth.js
  maintenance.js
public/css/style.css
views/
  dashboard.ejs
  login.ejs
  register.ejs
  request-form.ejs
  request-detail.ejs
  error.ejs
  partials/
```

## Team members

Add the three actual team member names and their feature responsibilities before submission. Keep individual contributions traceable through the required feature branches, issues, reviewed pull requests, and conventional commits.

## GitHub collaboration checklist

Use the project workflow in `INSTRUCTIONS.txt`: make feature branches; link changes to issues; use meaningful conventional commit messages; create pull requests; and have another team member provide a substantive review before merging. Maintain a project board that reflects real work. This local setup does not create GitHub Issues, a board, branches, reviews, or team contribution evidence.

## Known limitations

- Email notifications, file/photo attachments, assignment scheduling, and multi-campus tenancy are not implemented.
- The lightweight default session store is unsuitable for production or multiple application instances.
- Campus building choices are a starter list and should be adapted to the institution before use.
- Campus Pulse is a transparent rule-based repeated-report signal, not a predictive or emergency dispatch system.

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
git config --global user.name "Your Name"
git config --global user.email "your-github-email@example.com"
```

Then repeat the `git commit` command.

### 4. Connect the local folder to GitHub and push

Copy the repository's HTTPS URL from GitHub. Replace the example URL below with your own:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/campus-maintenance-system.git
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
npm install
Copy-Item .env.example .env
```

Each person should edit their own local `.env`, set a private random `SESSION_SECRET`, and never commit that file. The project creates its SQLite database automatically when it runs. Start the application with `npm start`.

### 7. Make changes on a feature branch

Before starting a task, update `main` and create a branch with a clear name. For example:

```powershell
git switch main
git pull origin main
git switch -c feature/request-search
```

Make and test the change, then review exactly what will be committed:

```powershell
npm test
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
