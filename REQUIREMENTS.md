# Campus Care — Requirements

## Purpose and scope

Campus Care is a campus maintenance system for reporting, tracking, and triaging repair and facilities issues. The first release supports one campus, persistent SQLite storage, and browser-based use on desktop and mobile. It is not an emergency dispatch service.

## Users

| User | Goals |
| --- | --- |
| Student | Report a facilities issue, provide a useful location and description, and follow updates to their own requests. |
| Faculty member | Report and track a campus maintenance issue using the same private request workflow. |
| Maintenance staff | Review the campus-wide request queue, search and filter reports, and record status changes and notes. |
| Administrator | Oversee the operational queue and provision staff accounts outside public registration. |

## Stakeholders

- Facilities and maintenance leadership: prioritize recurring issues and understand unresolved workload.
- Campus safety and operations: respond to issues that affect access, safety, or the continuity of campus activities.
- Students, faculty, and other campus occupants: use safe, functional, well-maintained spaces.
- IT/system administrators: configure, protect, back up, and operate the application and its stored data.
- Project team and instructor: assess requirements fit, application behavior, access control, testing, collaboration, and maintainability.

## Functional requirements

| ID | Requirement |
| --- | --- |
| FR-01 | Visitors can create student or faculty accounts using a unique, validated email address and a password stored as a bcrypt hash. Public registration must not grant staff or administrator roles. |
| FR-02 | Users can sign in and sign out. Successful sign-in regenerates the session; protected pages redirect unauthenticated visitors to sign-in. |
| FR-03 | Signed-in students and faculty can submit a request with title, category, campus building, optional room/area, priority, and a sufficiently detailed description. |
| FR-04 | Requests and their initial timeline entries persist in SQLite and remain available after page refresh or server restart. |
| FR-05 | Students and faculty can see, search, and filter their requests, view request details and status history, and withdraw their own requests only while the status is Open. |
| FR-06 | A reporter cannot read another user's request by changing a URL or request identifier. |
| FR-07 | Staff and administrators can search/filter all campus requests, view request details, and change request status to Open, In Progress, or Resolved with an optional update note. |
| FR-08 | Status changes are recorded with the acting user, status, note, and timestamp, and appear in chronological request history. |
| FR-09 | The dashboard summarizes total, open, in-progress, and resolved requests, scoped to the current reporter or to the campus-wide staff view. |
| FR-10 | **Campus Pulse** groups unresolved requests by building and category. It displays a hotspot after at least two reports share a group and gives urgent/high-priority groups precedence. |
| FR-11 | Invalid, missing, out-of-range, or unauthorized input receives a useful validation or access-denied response and is not accepted as a successful operation. |

## Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-01 | Use Node.js, Express, HTML, CSS, JavaScript, server-rendered EJS pages, and a persistent database. |
| NFR-02 | Protect passwords with bcrypt; use parameterized SQL; escape user-provided text in rendered pages; and keep secrets and the SQLite database out of source control. |
| NFR-03 | Enforce authentication, request ownership, and staff/admin permissions on the server, not only through hidden links or UI controls. |
| NFR-04 | Validate submitted data on the server and provide clear, actionable feedback. |
| NFR-05 | The application supports common desktop and mobile viewport sizes and provides semantic labels and keyboard-operable forms. |
| NFR-06 | Keep route, controller, model, middleware, view, and configuration responsibilities separated. |
| NFR-07 | A new local setup can initialize the database automatically and can run a repeatable test suite using the project's documented commands. |
| NFR-08 | The initial release targets a classroom demonstration. Production deployment requires HTTPS, a durable session store, routine database backups, and operational monitoring. |

## Use cases

### UC-01 — Create an account and sign in

- **Actor:** Student or faculty member.
- **Precondition:** The person does not already have an account using the submitted email address.
- **Steps:** Open registration; enter a name, email, password, and public account type; submit; sign in with the new credentials.
- **Expected result:** A unique account is stored with a bcrypt password hash. The user receives a session and reaches the protected dashboard. Invalid or duplicate details are rejected with feedback.

### UC-02 — Submit a maintenance request

- **Actor:** Signed-in student or faculty member.
- **Precondition:** The actor is authenticated.
- **Steps:** Open the new request form; provide an issue title, category, building, optional room/area, priority, and description; submit.
- **Expected result:** A persistent Open request and initial timeline event are created. The reporter is taken to the new request detail page.

### UC-03 — Track or withdraw a request

- **Actor:** Signed-in request reporter.
- **Precondition:** The request belongs to the actor's account.
- **Steps:** Open the dashboard; search or filter the request; view its details and timeline; optionally withdraw it while it remains Open.
- **Expected result:** The reporter sees current status and staff notes. Other users' requests remain inaccessible. A successful withdrawal removes only the reporter's own Open request.

### UC-04 — Triage and update a request

- **Actor:** Maintenance staff or administrator.
- **Precondition:** The actor has a staff or admin account and is authenticated.
- **Steps:** Open the campus dashboard; search/filter requests; select a request; choose a valid status and optionally add a note; save.
- **Expected result:** The request status and update timestamp are changed, and an attributed update event appears in the timeline. Student/faculty accounts cannot perform this operation.

### UC-05 — Identify a recurring campus hotspot

- **Actor:** Maintenance staff, administrator, or dashboard user.
- **Precondition:** At least two unresolved reports share a building and category.
- **Steps:** Open the dashboard and review Campus Pulse.
- **Expected result:** The repeated location/category appears with its report count; urgent/high-priority clusters appear first. Groups with fewer than two unresolved reports are not displayed.

## Acceptance checks

- Sign-in, sign-out, invalid credentials, public registration, and attempted public staff/admin role assignment.
- Anonymous dashboard access, reporter-to-reporter request access, and student-to-staff status update attempts.
- Required-field and invalid-category/location/status/priority validation.
- Persistent request creation, staff update history, and withdrawal of an eligible Open request.
- Campus Pulse visibility when the repeated unresolved building/category threshold is met.

## Out of scope

Email/SMS notifications, image uploads, automated staff assignment, work-order scheduling, multi-campus tenancy, emergency dispatch, and predictive analytics.
