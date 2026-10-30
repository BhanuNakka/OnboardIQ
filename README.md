# OnboardIQ

OnboardIQ is a synthetic KYC onboarding demo with an Express/MongoDB API and a React/Vite frontend. The frontend lives in `frontend/`; backend source and Postman collections remain in `backend/`.

## Run locally

From the repository root, in PowerShell:

```powershell
npm install
Copy-Item frontend/.env.example frontend/.env.local
npm run dev
```

Vite serves the frontend at `http://localhost:5173`. Start the API separately in a second terminal:

```powershell
npm run dev:backend
```

The API uses its own `backend/.env` with `MONGO_URI`, `JWT_SECRET`, and other backend settings. Do not copy backend secrets into Vite variables. The frontend's only environment variable is `VITE_API_BASE_URL`, defaulting to `http://localhost:5000/api/v1`.

After an API contract change, update the frontend API modules to match `API_CONTRACT.md`; the frontend does not simulate successful API responses. Public sign up creates a customer account. Staff accounts must be seeded/created through the existing backend process.

## Frontend capabilities

- Authentication, JWT restoration, sign out, role-aware navigation, and protected pages.
- Customer applications list, validated application form, document upload, submission, status tracking, saved decision reasons, and editable details while the backend permits `SUBMITTED` or `RESUBMISSION_REQUESTED` updates.
- Maker review queue and review workbench; paginated checker decision queue with expandable backend evidence and confirmation; compliance dashboard, audit search, and CSV export.
- Staff application list/details and a limited admin overview that links only to existing API functions.
- Responsive layouts, loading/empty/error states, and backend error messages.

Document upload follows the current backend implementation: UTF-8 `.txt`, maximum 1 MB, with the synthetic specimen marker required by the mock extraction service. It is not OCR or document verification. Use synthetic data only.

## API integration notes

The centralized Axios client attaches `Authorization: Bearer <token>` and logs a customer out on 401. API routes and response parsing were matched to the backend routes and `API_CONTRACT.md`. The implemented UI uses `/auth/login`, `/auth/register`, `/auth/me`, customer/staff application routes, documents/extractions, maker/checker review routes, and compliance dashboard/audit/export routes. The admin page links to application oversight and compliance; user management and configuration screens are omitted because the API does not expose those endpoints.

The backend Postman route-check collection previously verified health and authentication/role gating for the route set. The end-to-end customer data flow needs a reachable MongoDB Atlas instance; the previous API run could not connect because Atlas rejected the configured network source. Therefore a real login, application write/read, upload/extraction, review decision, compliance export, and browser API integration have not been confirmed against live backend data here.

## Commands

```powershell
npm run dev          # Frontend at localhost:5173
npm run dev:backend  # Backend API at localhost:5000
npm run build        # Production frontend build
npm run preview      # Preview built frontend
```

The backend's own instructions and demo seed credentials are documented in `backend/README.md`.
