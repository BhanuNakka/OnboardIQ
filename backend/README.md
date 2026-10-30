# OnboardIQ backend

Express/Mongoose backend using JavaScript ES modules. API paths and response shapes follow the repository `API_CONTRACT.md`.

## Run locally

1. Install Node.js 18+ and have a MongoDB database available (local MongoDB or Atlas).
2. In PowerShell, from the repository root:

```powershell
Copy-Item backend/.env.example backend/.env
npm --prefix backend install
npm run seed
npm run dev
```

Set `MONGODB_URI` to your reachable local/Atlas database and replace `JWT_SECRET` in `backend/.env` before running. The server listens on port 5000, allows `http://localhost:5173`, and exposes health at `GET http://localhost:5000/health`.

## Demo accounts

Seed-only development accounts use `DemoPass123!`:

| Role | Email |
|---|---|
| CUSTOMER | customer@onboardiq.test |
| MAKER | maker@onboardiq.test |
| CHECKER | checker@onboardiq.test |
| COMPLIANCE | compliance@onboardiq.test |
| ADMIN | admin@onboardiq.test |

Do not use these credentials outside local development. Public registration always creates `CUSTOMER`.

## First integration flow

1. `POST /api/v1/auth/login` with email/password; copy `data.token`.
2. Send `Authorization: Bearer <token>` to `POST /api/v1/applications` with `personalDetails` and `addressDetails` from `API_CONTRACT.md`.
3. Call `GET /api/v1/applications/mine?page=1&limit=10` with the same token.

Create request example:

```json
{
  "personalDetails": {
    "fullName": "Asha Rao", "dob": "1995-04-12", "gender": "FEMALE",
    "panNumber": "ZZKPS1234Q", "aadhaarLast4": "4821", "mobile": "9876543210",
    "email": "asha@example.test", "occupationCode": "SALARIED_PRIVATE",
    "annualIncome": 900000, "consentToKyc": true
  },
  "addressDetails": { "address": "Flat 12, Lotus Residency", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001" }
}
```

Expected response shape (generated IDs/timestamps vary):

```json
{
  "success": true,
  "message": "Application created successfully",
  "data": { "application": { "applicationId": "A2000001", "status": "SUBMITTED", "decision": null } }
}
```

Import `postman/OnboardIQ.postman_collection.json` into Postman for requests that save a login token and application ID automatically.

Customer-created records use `SUBMITTED` per the current contract. `POST /applications/:applicationId/submit` begins extraction and moves it to `EXTRACTING` once all three or more required documents are uploaded.

All routes use the shared JSON envelope except the decisions CSV export. Uploads accept UTF-8 `.txt` files only, max 1 MB. The extraction implementation reads text records or uploaded text; it is a mock, not OCR. Synthetic watchlists can be added as `sanctions.csv` and `pep.csv` under `WATCHLIST_DIR`.
