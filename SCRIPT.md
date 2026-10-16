# Campus Care Showcase and Defense Script

This script follows sections 22–24 of `INSTRUCTIONS.txt`: the Round 1 Showcase, the evidence-based counterpart critique, and the Defense. It is written for four speakers as requested.

> **Team-size note:** `INSTRUCTIONS.txt` requires exactly three team members. If your instructor has not approved a four-person team, combine Speaker 4's sections with another speaker and present as three members. Replace each speaker label with the actual member's name and speak only about work that person genuinely contributed to.

## Before presenting

Fill in the bracketed details using your real project evidence. Do not claim branches, issues, pull requests, reviews, contributions, test results, or counterpart observations that you cannot show.

- Speaker names and actual contributions: `[names and verified contributions]`
- Test account details: use accounts already set up for the live demonstration. Do not put passwords or private `.env` values in this document or on slides.
- GitHub: `[repository link]`, `[actual branches]`, `[issues]`, `[pull requests and reviews]`, `[project board]`, `[commits]`
- Paired team's system and evidence for the critique: `[system or feature observed]`, `[specific page/workflow/repository evidence]`
- AI disclosure: `[accurate disclosure of AI assistance, if used, consistent with project policy]`

## Section 22 — Round 1 Showcase

### Part 1 — Project introduction

**Speaker 1**

“Good day. We are presenting **Campus Care**, our Campus Maintenance System. The problem we address is that campus facility issues need a clear way to be reported, assigned, tracked, and reviewed. When requests are communicated informally, students and faculty may not know whether an issue has been received, who is responsible for it, or when it has been resolved.

“Our target users are students, faculty members, technical team members, and campus administrators. Students and faculty submit and track their own campus requests. Technicians work on requests that match their approved specialties. Administrators verify campus accounts and oversee campus-wide maintenance activity.

“The purpose of Campus Care is to provide a single, role-based portal for the maintenance-request lifecycle—from a report with a location and priority, through technician work and evidence, to resolution and user feedback.”

### Part 2 — Requirements

**Speaker 1**

“The key stakeholders include campus facilities and maintenance leadership, campus safety and operations, the campus community, IT administrators, and our project team and instructor.

“The main functional requirements are: account registration with a unique campus ID; administrator verification; campus request submission with category, building, priority, and description; private request tracking; category-based technician assignment; documented work updates; and administrative analytics and exports.

“Important non-functional requirements include server-side authorization, input validation, privacy for users' requests and photos, secure password storage, persistent MySQL or MariaDB data, and a usable mobile-responsive interface.

“Our major use cases include registering and verifying an account, submitting a request, accepting or receiving a matching assignment, documenting work, following the request timeline, rating a resolved service, and reviewing administrative reports. These requirements and use cases are documented in `REQUIREMENTS.md`.”

### Part 3 — System demonstration

**Speaker 2**

“I will demonstrate the main workflow in the working application. First, a student or faculty member signs in and opens **Campus Request**.

“The reporter selects a maintenance category and one of the campus locations, chooses a priority, describes the issue, and can attach a photograph of the area. The server validates the submitted information and saves the request and its initial history in the database.

“Here is the request detail page. It shows the location, priority, status, service target, and timeline. The reporter can follow only requests belonging to their own account.”

**Live demonstration cue:** Sign in with a prepared student or faculty account; open **Campus Request**; show the fields and optional area-photo control; submit a prepared request if doing so will not disrupt the demonstration database; show its detail page and timeline.

**Speaker 2**

“When a request is submitted, Campus Care looks for an administrator-verified technician with the matching specialty and assigns it to the qualified technician with the fewest active requests. The technician queue places urgent and high-priority work first. If nobody is eligible yet, the request remains available for a matching technician to claim.”

**Speaker 3**

“A technician signs in to a separate role-based workspace. Their queue is limited to work in their specialties and requests already assigned to them. When work begins, the technician records an update and provides the required before-work photograph. Before marking the request resolved, the technician provides an after-work photograph.

“Each update is attributed to the account that performed it and appears in the request timeline. Once the request is resolved, its original reporter can submit a one-to-five rating and an optional comment, and can update that feedback later.”

**Live demonstration cue:** Show the technician dashboard and a matching assigned request. If prepared data permits, show the before/after-photo controls and the request timeline. Then show the resolved-request feedback form using an already resolved test request.

**Speaker 4**

“Campus Care also includes **Campus Pulse**, which surfaces recurring unresolved reports grouped by building and category, and **Campus SLA Watch**, which highlights service targets and approaching or overdue deadlines.

“Administrators have additional tools. They can compare the campus ID shown on a registration with official records and mark the account Verifying, Accepted, or Rejected. Their Analytics page summarizes request volume, priorities, categories, locations, and feedback. Administrators can export request reports in CSV or PDF.”

**Live demonstration cue:** Show Campus Pulse and Campus SLA Watch on a prepared dashboard. Sign in as an administrator to show the verification page and then Analytics. If database content is available, download one CSV and one PDF report.

### Part 4 — Access control

**Speaker 3**

“Access restrictions are enforced on the server, not just by hiding navigation links. A person must sign in to access protected pages. Only accepted accounts can use the system. Students and faculty can view their own requests; technicians can access matching or assigned work; and only an assigned technician or an administrator can update request status.

“For example, I will demonstrate an unauthorized access attempt. A student account tries to open an administrator-only page. The server denies access. A user also cannot view another reporter's request simply by changing the request number in the address.”

**Live demonstration cue:** From a student session, visit `/admin/analytics` or `/admin/verifications` and show the denial. If safe prepared accounts are available, try another user's request URL and show it is denied. Do not expose passwords during this demonstration.

**Speaker 3**

“Passwords are stored as bcrypt hashes. Database operations use parameterized queries, and uploaded profile and request images are private rather than served as public files.”

### Part 5 — GitHub workflow

**Speaker 4**

“The repository for this project is `[repository link]`. We will show the actual development evidence required by the assignment: branches, issues, the project board, pull requests, code reviews, commits, and each member's contributions.

“Here is `[actual branch or branches]`. Here are `[actual issue numbers and their assigned tasks]`. This pull request, `[PR link or number]`, addresses `[issue]`; the changes are `[brief description]`, and the review is by `[reviewer]`. The board shows `[actual status]`, and the commit history shows `[specific verified contributions]`.

“We will also show the license and our accurate AI-assistance disclosure.”

**Live demonstration cue:** Open the real GitHub repository and show the listed pages. If any required evidence is missing, say so plainly and explain the team's next step—do not imply that a branch, review, issue, or pull request exists when it does not.

### Part 6 — Counterpart critique handoff

**Speaker 4**

“Section 23 requires a professional, evidence-based critique of our paired team's implementation. We will present the observation, the evidence, its impact, and a practical recommendation. We will critique the implementation, not the people.”

Proceed to the Section 23 template below after completing it with actual observations.

## Section 23 — Evidence-Based Counterpart Critique

**Speaker 1**

“Our observation is: `[one specific, neutral observation about the paired team's system or workflow]`.

“The evidence is: `[identify the page, step, test, or repository artifact observed, and describe exactly what it showed]`.

“The impact is: `[explain how this affects a user, data handling, security, requirements coverage, maintainability, or collaboration]`.

“Our recommendation is: `[a feasible and respectful improvement]`.

“We also observed `[a specific strength, if supported by evidence]`, demonstrated by `[evidence]`. This critique is limited to what we could actually observe; we are not making claims about code or behavior we did not inspect.”

**Preparation checklist (do not read aloud):**

- Evaluate requirements, functionality, user experience, data handling, security, code organization, and GitHub workflow where evidence is available.
- Prepare one or more specific examples. For each, record observation, evidence, impact, and recommendation.
- Avoid assumptions about hidden code or untested behavior. Say “we did not verify this” where appropriate.
- Keep the language professional, balanced, and focused on improvements.

## Section 24 — Defense

Each member should answer from their actual contribution. These are sample prompts; the instructor may ask follow-up questions.

### Speaker 1 — Requirements and design

**Possible question:** “What problem does Campus Care solve, and who uses it?”

**Answer:** “It gives campus users a traceable way to report and follow maintenance issues. Students and faculty submit and track their own requests, technicians work on qualified assignments, and administrators verify accounts and review operations.”

**Possible question:** “What is Campus Pulse?”

**Answer:** “Campus Pulse groups unresolved requests by building and category. When at least two unresolved reports share a group, it highlights that recurring location/category, with higher-priority groups first. It is a transparent rule-based hotspot indicator, not predictive analytics.”

### Speaker 2 — Request workflow and interface

**Possible question:** “How does a request get created?”

**Answer:** “The request form collects the issue title, category, campus location, optional room, priority, description, and optional area photo. The request route validates the input, and the maintenance model saves the request and initial timeline update.”

**Possible question:** “How does the reporter follow progress?”

**Answer:** “The reporter opens their dashboard and request detail page. The detail page shows the current status, service target, timeline, and any available photographs. The server checks request ownership before showing it.”

### Speaker 3 — Authentication, database, and testing

**Possible question:** “How do authentication and authorization work?”

**Answer:** “Passwords are checked against bcrypt hashes. After sign-in, the application stores the signed-in account in a session. Role middleware protects administrator and technician actions, while request-specific checks enforce ownership, specialty, and assignment.”

**Possible question:** “Where is data stored?”

**Answer:** “The normal local setup stores account, request, timeline, assignment, and feedback data in MySQL or MariaDB, commonly through XAMPP. Request and profile images are stored privately outside the public web directory. phpMyAdmin can inspect the database, but the application connects directly to MySQL.”

**Possible question:** “How do you handle invalid or unauthorized input?”

**Answer:** “The server validates request fields and images before saving. Database writes use parameters. Protected routes check the session, role, and request ownership or assignment. Invalid input gets a validation or access-denied response instead of being accepted.”

### Speaker 4 — Scheduling, reporting, and collaboration

**Possible question:** “How is a technician assigned?”

**Answer:** “For each new request, the system finds administrator-accepted technicians whose specialties match the request category and assigns it to the matching technician with the fewest active assigned requests. If no eligible technician exists, it remains unassigned and can be claimed by a matching technician. Urgent and high-priority requests are ordered first in the technician queue.”

**Possible question:** “How do you protect report exports?”

**Answer:** “Only administrators can access analytics and export routes. CSV cells are quoted and values beginning with spreadsheet formula characters are prefixed to reduce formula execution risk. The PDF export is generated server-side from the report data.”

**Possible question:** “Which branch or pull request contains your contribution?”

**Answer:** “My verified contribution is `[feature or files]`. The branch is `[actual branch]`, and the related issue or pull request is `[actual link/number, if it exists]`. I can show the changes and explain how they were tested.”

**Possible question:** “What problem did you encounter and solve?”

**Answer:** “One challenge was `[real problem]`. We investigated it by `[actual steps]`, changed `[actual fix]`, and verified the result with `[actual test or demonstration]`.”

## Closing

**Speaker 1**

“To summarize, Campus Care supports campus account verification and a complete maintenance workflow: reporting, technician assignment, documented progress, resolution, and user feedback. It also provides recurring-hotspot and service-target views for campus operations. Thank you. We are ready for your questions.”
