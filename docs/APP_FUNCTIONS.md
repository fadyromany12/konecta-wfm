# Konecta WFM – App Function List & Logic

This document describes how the main functions and features work and how they connect.

---

## 1. Authentication & Sessions

| Function | Where | How it works |
|----------|--------|----------------|
| **Login** | `POST /api/auth/login` | Validates email/password, returns JWT and user. JWT expiry is configurable via `JWT_EXPIRES_IN` (default **30 days** to reduce re-login). |
| **Register** | `POST /api/auth/register` | Creates agent with optional `manager_id`. Requires manager selection. Admin approval may be required. |
| **Session** | JWT in `Authorization: Bearer <token>` | Every API call (except auth) uses this. Frontend stores token in Zustand; proxy forwards it to the backend. |
| **Theme** | `localStorage konecta-theme` | Light/dark; default is light. Layout script and theme store sync `html.dark`. |

**Logic tie-in:** Auth store hydrates on load; 401 on API triggers clear auth + redirect to login. Token is sent on all `/api/proxy/*` requests.

---

## 2. Leave & Annual Request

| Function | Where | How it works |
|----------|--------|----------------|
| **Create leave** | `POST /api/leave` (agent) | Body: `type` (annual, sick, casual, overtime, cancel_day_off), `start_date`, `end_date`, optional `reason`, `file_url` (sick). Annual/sick deduct from balance. |
| **Leave dates** | Backend `leave/repository` | **Fixed:** Dates are normalized with `toDateOnly()` so stored/returned values are **YYYY-MM-DD** and no longer shift by timezone (avoids “one day before” for annual). |
| **My leave** | `GET /api/leave/me` | List of current user’s leave requests. |
| **Manager pending** | `GET /api/manager/leave/pending` | Leave requests for agents where `users.manager_id = current user`. |
| **Manager leave history** | `GET /api/manager/leave/team` | All team leave (any status). Frontend uses this for **Leave history** tab in Approvals. |
| **Approve/Reject** | `POST /api/manager/leave/:id/approve` or `reject` | Only if the leave belongs to an agent whose `manager_id` is the current manager. |

**Logic tie-in:** Leave balances (annual/sick) are checked on create; balances are in `leave_balances`. Approvals page shows **Pending** and **Leave history** (from `/manager/leave/team` filtered by status ≠ pending).

---

## 3. Clock-in / Clock-out & AUX

| Function | Where | How it works |
|----------|--------|----------------|
| **Clock in** | `POST /api/attendance/clock-in` | Creates an open attendance row. Optional `work_location` (WFO/WFH) for manager/admin. |
| **Clock out** | `POST /api/attendance/clock-out` | Closes the open attendance, sets `clock_out`, computes `total_hours` (interval). |
| **My attendance** | `GET /api/attendance/me` | List of current user’s attendance. |
| **Start AUX** | `POST /api/aux/start` | Body: `auxType` (break, lunch, meeting, coaching, etc.). One open AUX per user. |
| **End AUX** | `POST /api/aux/end` | Closes current open AUX. |
| **Set available** | Same as End AUX or start AUX type `available` | Agent returns to “available” when no AUX is open (or explicitly “available”). |

**Logic tie-in:** Agent dashboard shows status (Clocked in/out), current AUX, today’s sessions, and live timer. Clock-in implies “available” until they start an AUX; “Set available” ends current AUX. Project session clock-in/out is separate (project work tracking).

---

## 4. Time Tracking & Projects

| Function | Where | How it works |
|----------|--------|----------------|
| **List projects** | `GET /api/project-sessions/projects` | All projects (agent/manager/admin/PM). **Admin projects** list: `GET /api/projects` (admin only); frontend now handles both array and `{ data }` response. |
| **Clock-in to project** | `POST /api/project-sessions/clock-in` | Body: `projectId`. Tied to current user. |
| **Clock-out from project** | `POST /api/project-sessions/clock-out` | Ends current project session. |

**Logic tie-in:** Agent chooses project before clock-in (optional). Project sessions are separate from attendance; both can run (attendance for shift, project for which project they’re on).

---

## 5. Schedules

| Function | Where | How it works |
|----------|--------|----------------|
| **Manager team schedules** | `GET /api/manager/schedule/team?from=&to=` | Schedules for users where `manager_id = current user`. |
| **Admin schedules** | `GET /api/admin/schedules?from=&to=` | All schedules; optional `user_id`. |
| **RTA schedules** | `GET /api/rta/projects/:id/schedules?from=&to=` | Schedules for agents in that project (RTA-assigned). |
| **Upsert schedule** | `POST /api/admin/schedules` or RTA `PUT /api/rta/projects/:id/schedules` | Create/update shift and break times. |

**Logic tie-in:** **Managers** can only view their team’s schedules today; **editing** schedule for agents is currently admin or RTA. **#9 (Manager edit schedule)** would require new permission or route so manager can upsert for their `manager_id` agents.

---

## 6. Approvals & Transfers

| Function | Where | How it works |
|----------|--------|----------------|
| **Pending leave** | `GET /api/manager/leave/pending` | Leave where status = pending, agent’s `manager_id` = current user. |
| **Leave history** | **Approvals tab** | Uses `GET /api/manager/leave/team` and shows rows with status ≠ pending. |
| **Pending shift swaps** | `GET /api/shift-swaps/manager/pending` | Swaps needing manager approval (requester/target report to this manager). |
| **Approve/Reject leave** | `POST /api/manager/leave/:id/approve` or `reject` | Manager only for their reports. |
| **Approve/Reject swap** | `POST /api/shift-swaps/:id/manager-approve` | Body: `{ approve: true/false }`. |
| **Transfer requests** | `GET /api/manager/transfer-requests?filter=` | `mine` = my requests; `pending_approval` = pending for me to approve; **`all`** = all requests I can see (used for **History** tab). |
| **Request transfer** | `POST /api/manager/transfer-request` | Body: `agentId`, `toManagerId`. Agent must have `manager_id = current user`. |
| **Approve/Reject transfer** | `PATCH /api/manager/transfer-requests/:id/approve` or `reject` | Approver = from_manager’s manager (or admin). |

**Logic tie-in:** Transfers page has **Transfer agent**, **My requests**, **Pending my approval**, and **History** (filter=all). Approvals page has **Leave pending**, **Leave history**, and **Shift swaps**.

---

## 7. Hierarchy & Direct Reports

| Function | Where | How it works |
|----------|--------|----------------|
| **Org tree** | `GET /api/manager/org-tree` | **Admin:** full tree (root = users with `manager_id` null). **Manager:** subtree under current user (root = users with `manager_id = current user` = direct reports). |
| **Team list** | `GET /api/manager/team` | Users where `manager_id = current user` (same as “direct reports”). |

**Logic tie-in:** **Direct reports** = users whose `manager_id` is your id. If “no direct reports” in Hierarchy but you see agents in Transfers, those agents are the ones you can transfer (same list). If hierarchy is empty, ensure agents have `manager_id` set in DB or in user admin.

---

## 8. Exports

| Function | Where | How it works |
|----------|--------|----------------|
| **Admin exports** | `GET /api/admin/export/attendance|leave|aux|overtime|daily?from=&to=&format=csv` | **Fixed:** `total_hours` and `overtime_duration` are formatted with `formatIntervalForCsv()` so CSV no longer shows `[object Object]`. Daily export uses valid from/to defaults. |
| **Manager exports** | `GET /api/manager/export/attendance|leave|aux?from=&to=` | Same interval formatting for attendance. Only includes users where `manager_id = current user`. |
| **Download** | Frontend `downloadExport(path, filename, token, { from, to })` | GET with Bearer token and query params; triggers blob download. |

**Logic tie-in:** All export routes now format PostgreSQL interval columns as strings (e.g. `H:MM:SS`) so CSV is readable.

---

## 9. Activity Grid

| Function | Where | How it works |
|----------|--------|----------------|
| **Grid data** | `GET /api/grid/activity?date=&user_id=&project_id=` | Returns users and events (attendance, AUX, scheduled shifts, coachings, meetings, violations). |
| **Tooltip** | Frontend grid tile hover | **Fixed:** Tooltip uses `whitespace-normal`, `min-w/max-w`, `z-[100]` so full content is visible and not clipped. |

---

## 10. Coachings & Meetings

| Function | Where | How it works |
|----------|--------|----------------|
| **Add coaching/meeting** | **Removed** | The “Add coaching or meeting” form was removed from Manager → Coachings & Meetings. Page now directs users to use the **Schedule** page for shift activities. |
| **Schedule activities** | Backend `POST /api/manager/schedule-activities` | Still exists; RTA/Admin schedule or future “manager schedule edit” can create these. |

---

## 11. Admin: Users & Projects

| Function | Where | How it works |
|----------|--------|----------------|
| **All users** | `GET /api/admin/users?page=&limit=` | Returns `{ data: UserRow[], total }`. **Fixed:** Frontend now correctly reads `data` (or array) so the list is no longer empty. |
| **Projects list** | `GET /api/projects` | Admin only; returns projects with optional `pm_count`. **Fixed:** Frontend handles both array and `{ data }` and requests `/admin/users?limit=500` for project page. |

---

## 12. Permissions Overview

| Role | Can do |
|------|--------|
| **Agent** | Clock in/out, AUX, leave requests, swap requests, view own schedule, project sessions, profile. |
| **Manager** | Everything for **their reports** (manager_id = me): approve leave/swaps, view team attendance, request transfers, approve/reject transfers (if they are the approver), view hierarchy (subtree), exports for team. Cannot edit schedules (admin/RTA). |
| **Admin** | Full users, projects, schedules, exports, leave balances, org tree, approvals, transfer history. |
| **RTA** | Schedules for assigned projects, edit schedules for those projects, grid for project. |
| **Project manager** | View assigned projects, project overview. |

**#9 (Manager edit schedule):** To allow managers to edit their agents’ schedules, add a route (e.g. `PUT /api/manager/schedule` or allow manager to call a shared schedule upsert) that checks `user.manager_id = req.user.sub` for the target user.

---

## 13. What’s Tied to What

- **Leave** ↔ Leave balances (annual/sick), manager approval, notifications.
- **Attendance** ↔ One open session per user; clock-out computes total_hours (interval).
- **AUX** ↔ One open AUX per user; auxlogs table; grid and reports use it.
- **Schedules** ↔ Shifts and breaks; used by grid, wallboard, and export “daily”.
- **Transfers** ↔ `users.manager_id`; approver = from_manager’s manager.
- **Hierarchy / Direct reports** ↔ `users.manager_id`; org-tree and team list use it.
- **Exports** ↔ Same data as main app; interval columns formatted for CSV.
- **Theme** ↔ `localStorage` + `html.dark`; CSS variables in `globals.css`.

---

## 14. Remaining / Suggested

1. **#2 (Unify clock-in/AUX UI):** Not implemented; current flow is “clock in → available; tap AUX → in that AUX; Set available → end AUX”. Could be redesigned as a single “status” control (Available / Break / Lunch / …) that toggles AUX.
2. **#9 (Manager edit schedule):** Backend support for manager to upsert schedule for users where `manager_id = current user`.
3. **#11 (Direct reports visibility):** If hierarchy is empty, verify in DB that agents have `manager_id` set to the correct manager id.
