# UniFix — Requirements

## Purpose and scope

UniFix is a campus maintenance system for reporting, tracking, and triaging repair and facilities issues. The first release supports one campus, persistent MySQL/MariaDB storage, and browser-based use on desktop and mobile. It is not an emergency dispatch service.

## Users

| User | Goals |
| --- | --- |
| Student | Submit a campus request, provide a useful location and description, and follow updates to their own requests. |
| Instructor / faculty member | Submit and track campus requests using the same private request workflow and review resolved work they reported. |
| Technical team | Select maintenance specialties, receive or claim matching campus requests, and record status changes after administrator approval. |
| Administrator | Verify technical-team campus IDs; accept, reject, or mark technician accounts as verifying; and review maintenance analytics and exports. |

## Stakeholders

- Facilities and maintenance leadership: prioritize recurring issues and understand unresolved workload.
- Campus safety and operations: respond to issues that affect access, safety, or the continuity of campus activities.
- Students, faculty, and other campus occupants: use safe, functional, well-maintained spaces.
- IT/system administrators: configure, protect, back up, and operate the application and its stored data.
- Project team and instructor: assess requirements fit, application behavior, access control, testing, collaboration, and maintainability.

## Functional requirements

| ID | Requirement |
| --- | --- |
| FR-01 | Visitors can create student, faculty, or technical-team accounts using a unique campus ID, a unique validated email address, and a password stored as a bcrypt hash. Technical-team registration must select one or more valid maintenance categories. Public registration must not grant administrator roles. |
| FR-02 | Student and faculty accounts are Accepted immediately after successful registration. Technical-team accounts remain Pending until an administrator marks them Verifying, Accepted, or Rejected. Only Accepted accounts can sign in or continue using protected pages. |
| FR-03 | Administrators can review technical-team campus IDs and accept, reject, or mark technician accounts as Verifying. |
| FR-04 | Signed-in students and faculty can submit a request with title, category, campus building, optional room/area, priority, sufficiently detailed description, and an optional JPEG, PNG, or WebP area photo up to 5 MB. |
| FR-05 | Requests, photo metadata, service target deadlines, and initial timeline entries persist in MySQL/MariaDB and remain available after page refresh or server restart. |
| FR-06 | Students and faculty can see, search, and filter their requests, view request details and status history, and withdraw their own requests only while the status is Open. |
| FR-07 | A reporter cannot read another user's request or private photos by changing a URL or request identifier. |
| FR-08 | Administrators can search/filter all campus requests. Technical team members can see and accept only unassigned requests matching their specialties and requests already assigned to them; only the assigned technician or an administrator can change request status. |
| FR-09 | Technical team members must attach a before-work photo before moving assigned work to In Progress and an after-work photo before marking it Resolved. Status changes and evidence are attributed to the acting user and recorded in the request history. |
| FR-10 | The dashboard summarizes total, open, in-progress, and resolved requests for the current reporter and provides campus operations summaries for staff and administrators. |
| FR-11 | **Campus Pulse** groups Open and In Progress requests by building and category. It displays a hotspot after at least two unresolved reports share a group and gives urgent/high-priority groups precedence. Resolved requests are excluded. |
| FR-12 | **Campus SLA Watch** assigns initial target times by priority (Urgent: 24 hours, High: 72 hours, Normal: 7 days, Low: 14 days), counts overdue and due-within-24-hours requests, and marks target status on request listings. |
| FR-13 | Signed-in users can view and update their profile name, email, and private profile photo. Technical team members can add, change, and remove maintenance specialties from their profile. |
| FR-14 | Invalid, missing, out-of-range, or unauthorized input receives a useful validation or access-denied response and is not accepted as a successful operation. |
| FR-15 | New requests are automatically assigned to an accepted technical-team account qualified for that category, balancing active assigned workload. Requests with no eligible technician remain unassigned and claimable by matching staff; urgent/high-priority requests are ordered first in technician queues. |
| FR-16 | The original student or instructor/faculty reporter can submit or update one 1–5 star service review and a 5–1,000 character message for the assigned technician after their request is resolved. Other users cannot submit or change that review. |
| FR-17 | Authorized users who can view a request can see its saved reporter review; administrators can review aggregate request, priority, category, location, and review analytics. |
| FR-18 | Administrators can export the campus request report, including assignment and submitted reviews, as CSV or PDF. CSV values are protected against spreadsheet formula execution. |
| FR-19 | The application presents a consistent, formal, responsive interface across authentication, dashboards, request workflows, profiles, and administration pages. |

## Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-01 | Use Node.js, Express, HTML, CSS, JavaScript, server-rendered EJS pages, and a persistent database. |
| NFR-02 | Protect passwords with bcrypt; use parameterized SQL; escape user-provided text in rendered pages; validate image content and size; store photos outside public web files; and keep secrets, uploaded files, and database backups out of source control. |
| NFR-03 | Enforce authentication, request ownership, technician specialty/assignment, and administrator permissions on the server, not only through hidden links or UI controls. |
| NFR-04 | Validate submitted data on the server and provide clear, actionable feedback. |
| NFR-05 | The application supports common desktop and mobile viewport sizes, uses a consistent formal visual design, and provides semantic labels and keyboard-operable forms with visible focus states. |
| NFR-06 | Keep route, controller, model, middleware, view, and configuration responsibilities separated. |
| NFR-07 | A new local setup can initialize the database automatically and can run a repeatable test suite using the project's documented commands. |
| NFR-08 | The initial release targets a classroom demonstration. Production deployment requires HTTPS, a durable session store, routine database backups, and operational monitoring. |

## Use cases

### UC-01 — Create an account and sign in

- **Actor:** Student, faculty member, or technical-team member.
- **Precondition:** The person does not already have an account using the submitted email address.
- **Steps:** Open registration; enter a name, email, unique campus ID number, password, and account type; technical-team members also select one or more maintenance specialties; submit. Students and faculty can sign in immediately; technicians wait for administrator verification.
- **Expected result:** The account is stored with a bcrypt password hash. Student and faculty accounts are Accepted immediately; technical-team accounts are Pending until administrator acceptance. Invalid or duplicate details are rejected with feedback.

### UC-02 — Verify a campus account

- **Actor:** Administrator.
- **Precondition:** The administrator is signed in and a technical-team account is awaiting review.
- **Steps:** Open Admin verification; compare the technician's campus ID and specialties with official campus records; mark the account Verifying, Accepted, or Rejected.
- **Expected result:** The status is saved. Only Accepted accounts can sign in or continue using protected pages.

### UC-03 — Submit a maintenance request

- **Actor:** Signed-in student or faculty member.
- **Precondition:** The actor is authenticated.
- **Steps:** Open the new request form; provide an issue title, category, building, optional room/area, priority, description, and optionally an area photo; submit.
- **Expected result:** A persistent Open request, initial timeline event, and priority-based service target are created. The reporter is taken to the new request detail page.

### UC-04 — Track or withdraw a request

- **Actor:** Signed-in request reporter.
- **Precondition:** The request belongs to the actor's account.
- **Steps:** Open the dashboard; search or filter the request; view its details and timeline; optionally withdraw it while it remains Open.
- **Expected result:** The reporter sees current status and staff notes. Other users' requests remain inaccessible. A successful withdrawal removes only the reporter's own Open request.

### UC-05 — Accept and update a request

- **Actor:** Technical team member or administrator.
- **Precondition:** The actor is authenticated; technicians have a matching specialty and may update only requests assigned to them.
- **Steps:** Technicians open their specialty queue and accept an unassigned matching request. The assigned technician or administrator selects a valid status, adds an optional note, and saves.
- **Expected result:** The request is assigned to the accepting technician. Status changes and attributed update events appear in the timeline. Student/faculty accounts cannot perform these operations.

### UC-06 — Document maintenance work

- **Actor:** Technical team member or administrator.
- **Precondition:** The actor is authenticated and authorized to update the request.
- **Steps:** Attach a before-work photo when moving a request to In Progress; attach an after-work photo before setting it to Resolved.
- **Expected result:** Photos are stored privately and shown with the request to its reporter and authorized staff. Unsupported, malformed, or oversized images are rejected.

### UC-07 — Monitor service targets

- **Actor:** Student, faculty member, technical team member, or administrator.
- **Precondition:** The account has access to an unresolved request.
- **Steps:** Review the dashboard's Campus SLA Watch and a request's target deadline.
- **Expected result:** Requests approaching their priority-based target and those past target are clearly identified.

### UC-08 — Identify a recurring campus hotspot

- **Actor:** Maintenance staff, administrator, or dashboard user.
- **Precondition:** At least two unresolved reports share a building and category.
- **Steps:** Open the dashboard and review Campus Pulse. Compare the exact building and category on the unresolved requests.
- **Expected result:** A building/category group appears only when at least two requests in Open or In Progress share both values; Resolved requests are excluded. The group shows its report count, and urgent/high-priority groups appear first.

### UC-09 — Automatically schedule a technician

- **Actor:** UniFix system; technical team members receive the assignments.
- **Precondition:** A student or faculty member submits a valid request.
- **Steps:** Find administrator-accepted technicians with a matching specialty; assign the request to the matching technician with the fewest active requests; order urgent and high-priority work first in the technician queue.
- **Expected result:** The detail page identifies the scheduled technician. If there is no verified technician for that category, the request remains unassigned and appears in matching technicians' claimable queue.

### UC-10 — Review resolved maintenance service

- **Actor:** Original student or instructor/faculty request reporter.
- **Precondition:** The reporter's request is Resolved.
- **Steps:** Open the resolved request, select a 1–5 star rating, write a 5–1,000 character message to the assigned technician, and submit. Reopen the form later to update the review.
- **Expected result:** One review is saved per request and displayed on its detail page. Only the reporter can create or update it; other authorized viewers can read it.

### UC-11 — Review and export maintenance analytics

- **Actor:** Administrator.
- **Precondition:** Administrator is signed in.
- **Steps:** Open Analytics to review request totals, priority, category, building demand, and average feedback; download CSV or PDF.
- **Expected result:** Reports contain request status and assignment details plus available ratings/comments. Non-administrator access is denied.

## Acceptance checks

- Sign-in, sign-out, invalid credentials, unique campus ID validation, public registration, and attempted public administrator role assignment.
- Immediate student/faculty access; Pending, Verifying, Accepted, and Rejected technician behavior; admin-only technician verification controls and access revocation.
- Anonymous dashboard access, reporter-to-reporter request access, and student-to-staff status update attempts.
- Required-field and invalid-category/location/status/priority validation.
- Persistent request creation, staff update history, and withdrawal of an eligible Open request.
- Campus Pulse visibility when the repeated unresolved building/category threshold is met.
- Private request-area photos; required before/after technician evidence; rejection of invalid image content and excessive file size.
- SLA target calculations for each priority and overdue/due-soon dashboard indicators.
- Automatic assignment only to accepted technicians with matching specialties; workload balancing and unassigned fallback when no eligible technician exists.
- Student- and instructor/faculty-reporter-only star reviews after resolution, required message validation, review editing, visible saved review content for the reporter and assigned technician, and one-review-per-request behavior.
- Dashboard status filtering for Open, In Progress, Resolved (including the query alias `Resolve`), and all statuses.
- Campus Pulse hotspot creation when two or more Open/In Progress reports share the same building and category; resolved reports do not count.
- Administrator-only analytics and CSV/PDF downloads, including export content and spreadsheet-formula escaping.

## Out of scope

Email/SMS notifications, calendar-based appointment scheduling, multi-campus tenancy, emergency dispatch, and predictive analytics.
