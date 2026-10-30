# OnboardIQ Shared API Contract

Version: 1.0 (initial integration contract)  
Base URL: `http://localhost:5000/api/v1`  
Frontend setting: `VITE_API_BASE_URL=http://localhost:5000/api/v1`

This document is the shared source of truth for frontend and backend integration. The attached Use Case 02 specification governs KYC rules, data protection, and lifecycle behavior. The project brief governs the requested Node/Express/Mongoose and React/Vite stack and the endpoint inventory. Where the two conflict, the decision is recorded in “Contract decisions.” The initial implementation milestone is authentication, customer application creation, and application listing.

## Contract decisions

1. **Statuses:** The canonical application status enum includes `EXTRACTING`, which is required by the source lifecycle even though it is omitted from the brief’s status list. All other values are exactly as listed in the brief: `SUBMITTED`, `AUTO_APPROVED`, `IN_REVIEW`, `PENDING_CHECKER`, `RESUBMISSION_REQUESTED`, `APPROVED`, `REJECTED`, `AUTO_REJECTED`, `CLOSED_EXPIRED`.
2. **Roles:** API role values are `CUSTOMER`, `MAKER`, `CHECKER`, `COMPLIANCE`, `ADMIN`. These map to the source’s Applicant, KYC Officer (maker), and Compliance Officer (checker/compliance). `ADMIN` is for administration only; it does not implicitly grant maker/checker decision powers.
3. **Decisions vs statuses:** Rule evaluation returns `APPROVE`, `REVIEW`, or `REJECT`. A maker recommendation is `APPROVE`, `REJECT`, or `REQUEST_RESUBMISSION`; a checker decision is `APPROVE`, `REJECT`, or `SEND_BACK`. The final application status is a separate enum.
4. **Uploads:** Documents are UTF-8 `.txt` files up to 1 MB each for the core track, with a declared document type. At least three documents are required before submission. Request content type is `multipart/form-data`; each file part is named `file`, with `documentType` as a text part. Image/PDF are out of scope for the core milestone.
5. **Privacy:** Only Aadhaar last four digits are accepted/stored. PAN is masked in customer lists and exports as specified by the case (example format `ZZKXXXXX4Q`); privileged detail views may return the full synthetic PAN to authorized staff. Password hashes are never serialized.
6. **Pagination:** List endpoints use `page` (1-based, default 1) and `limit` (default 10, max 100), returned in the common list envelope.
7. **Time:** Dates are ISO calendar dates (`YYYY-MM-DD`), evaluated as calendar dates in IST. Timestamps are ISO 8601 UTC.

## Common conventions

All JSON success responses use `{ "success": true, "message": "...", "data": ... }`. Lists use `{ "items": [], "total": 0, "page": 1, "limit": 10 }` within `data`. Errors use `{ "success": false, "message": "...", "error": { "code": "...", "details": [] } }`. `details` is an array of `{ "field": "...", "issue": "..." }`; it may be empty. Unless specified otherwise, successful reads/writes return HTTP 200; creation returns 201; accepted async work returns 202; missing resources return 404.

Protected requests send `Authorization: Bearer <token>`. IDs in `:applicationId` refer to the readable `applicationId` (for example `A2000001`) and `:documentId` is the document `_id` string. Mongo `_id` remains the internal resource key. Customer access is always scoped to the authenticated owner.

## Enums and shared models

### Enums

| Name | Values |
|---|---|
| User role | `CUSTOMER`, `MAKER`, `CHECKER`, `COMPLIANCE`, `ADMIN` |
| Application status | `SUBMITTED`, `EXTRACTING`, `AUTO_APPROVED`, `IN_REVIEW`, `PENDING_CHECKER`, `RESUBMISSION_REQUESTED`, `APPROVED`, `REJECTED`, `AUTO_REJECTED`, `CLOSED_EXPIRED` |
| Evaluation decision | `APPROVE`, `REVIEW`, `REJECT` |
| Risk category | `LOW`, `MEDIUM`, `HIGH` |
| Document type | `PAN_CARD`, `AADHAAR_CARD`, `ELECTRICITY_BILL`, `BANK_STATEMENT`, `DRIVING_LICENCE`, `OTHER` |
| Extraction status | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| Extraction field source | `MOCK`, `AI`, `OFFICER` |
| Maker recommendation | `APPROVE`, `REJECT`, `REQUEST_RESUBMISSION` |
| Checker decision | `APPROVE`, `REJECT`, `SEND_BACK` |

### Shared resource shapes

- **User:** `{ _id, name, email, role, createdAt }`. `password` is accepted only by register/login and never returned.
- **Application:** `{ _id, applicationId, userId, personalDetails, addressDetails, documentIds, status, riskCategory, decision, reasonCodes, nameMatchScore, rekycDueDate, createdAt, updatedAt }`. `personalDetails` contains `fullName`, `dob`, `gender`, `panNumber`, `aadhaarLast4`, `mobile`, `email`, `occupationCode`, `annualIncome`, and mandatory `consentToKyc: true`. `addressDetails` contains `address`, `city`, `state`, `pincode`. `decision` is nullable and uses the evaluation decision enum; `reasonCodes` is an array. Customer-facing collection responses mask `panNumber` and omit confidence and watchlist details.
- **Document:** `{ _id, applicationId, documentType, fileName, extractionStatus, createdAt }`. File content/hash/storage key are never exposed in normal document metadata responses.
- **Extraction:** `{ _id, applicationId, documentId, extractedFields, confidence, source, extractorVersion, createdAt }`. `extractedFields` is a map of field names to `{ value, confidence, source }`; the provider interface and batch file remain long-form `doc_id, field_name, value, confidence`.
- **Decision:** `{ applicationId, decision, reasonCodes, nameMatchScore, riskCategory, rekycDueDate, evaluatedAt, status, documents }`. Each `documents` item is `{ documentId, docType, confidence }`.
- **Audit log:** `{ _id, applicationId, actorId, action, details, timestamp }`. Append-only; no update/delete API.
- **Maker-checker:** `{ applicationId, makerId, makerRecommendation, makerComments, checkerId, checkerDecision, checkerComments, createdAt, updatedAt }`.

Decision rules are the source rules R1–R17, run without short-circuiting, skipping only rules whose required field is unusable. Usable fields are present, non-empty, and confidence `>= 0.80`. Final evaluation is REJECT if R4–R10 trigger, otherwise REVIEW if R1–R3 or R11–R17 trigger, otherwise APPROVE. Preserve triggered reason codes in rule order joined by `|` in CSV; the API represents them as an array. Risk, re-KYC date, watchlist result, and matcher behavior follow the case configuration. The AI/provider supplies classifications and fields only; it never decides. A reviewed case remains checker-routed when approved after correction/recommendation. Maker and checker must be different users.

### Status lifecycle

`SUBMITTED → EXTRACTING → AUTO_APPROVED | PENDING_CHECKER | IN_REVIEW | AUTO_REJECTED`; `IN_REVIEW → PENDING_CHECKER | RESUBMISSION_REQUESTED`; `RESUBMISSION_REQUESTED → SUBMITTED` (within 7 days) or `CLOSED_EXPIRED`; `PENDING_CHECKER → APPROVED | REJECTED | IN_REVIEW`. `AUTO_APPROVED`, `APPROVED`, `REJECTED`, `AUTO_REJECTED`, and `CLOSED_EXPIRED` are terminal. A correction on a reviewed case that evaluates to APPROVE routes to `PENDING_CHECKER`, never straight-through.

## Endpoint index

| Method | Path | Roles | Purpose / phase |
|---|---|---|---|
| POST | `/auth/register` | Public | Register customer; core |
| POST | `/auth/login` | Public | Authenticate; core |
| GET | `/auth/me` | All authenticated | Current identity; core |
| POST | `/applications` | CUSTOMER | Create draft application; core |
| GET | `/applications/mine` | CUSTOMER | List own applications; core |
| GET | `/applications` | MAKER, CHECKER, COMPLIANCE, ADMIN | Staff application list; phase 2 |
| GET | `/applications/:applicationId` | Owner CUSTOMER; MAKER, CHECKER, COMPLIANCE, ADMIN | Get application; phase 2 |
| PATCH | `/applications/:applicationId` | Owner CUSTOMER | Edit draft/resubmission; phase 2 |
| POST | `/applications/:applicationId/submit` | Owner CUSTOMER | Submit with documents; phase 2 |
| POST | `/applications/:applicationId/documents` | Owner CUSTOMER | Upload document; phase 2 |
| GET | `/applications/:applicationId/documents` | Owner CUSTOMER, MAKER, CHECKER, COMPLIANCE, ADMIN | List metadata; phase 2 |
| POST | `/documents/:documentId/extract` | System/service; ADMIN for demo retry | Extract/classify; phase 2 |
| GET | `/applications/:applicationId/extractions` | MAKER, CHECKER, COMPLIANCE, ADMIN | Read extraction results; phase 2 |
| POST | `/applications/:applicationId/evaluate` | System/service; ADMIN for demo retry | Run rules; phase 2 |
| GET | `/applications/:applicationId/decision` | Owner CUSTOMER (sanitized), MAKER, CHECKER, COMPLIANCE, ADMIN | Read decision; phase 2 |
| GET | `/officer/review-queue` | MAKER | Queue REVIEW cases; phase 2 |
| GET | `/officer/applications/:applicationId` | MAKER | Review workbench (audits document views); phase 2 |
| POST | `/officer/applications/:applicationId/recommend` | MAKER | Record maker recommendation; phase 2 |
| GET | `/checker/pending` | CHECKER, COMPLIANCE | Pending checker queue; phase 2 |
| POST | `/checker/applications/:applicationId/decision` | CHECKER, COMPLIANCE | Checker decision; phase 2 |
| GET | `/compliance/dashboard` | COMPLIANCE, ADMIN | Metrics and date filter; phase 2 |
| GET | `/compliance/audit/:applicationId` | COMPLIANCE, ADMIN | Audit history; phase 2 |
| GET | `/compliance/decisions/export` | COMPLIANCE, ADMIN | CSV decision export; phase 2 |
| POST | `/core-banking/accounts` | System/service; ADMIN for demo retry | Mock account creation after approval; phase 2 |
| GET | `/core-banking/accounts/:applicationId` | Owner CUSTOMER (limited), MAKER, CHECKER, COMPLIANCE, ADMIN | Read mock account; phase 2 |

## Endpoint details and examples

All examples omit standard headers. `{{token}}` is a JWT. Examples show the exact wire field names. Responses abbreviated with `...` still follow the envelope and named resource shape above.

### Authentication

#### `POST /auth/register` — Public

Request JSON: `{ "name": "Asha Rao", "email": "asha@example.test", "password": "DemoPass123!" }`.

201: `{ "success": true, "message": "User registered successfully", "data": { "user": { "_id": "...", "name": "Asha Rao", "email": "asha@example.test", "role": "CUSTOMER", "createdAt": "2026-03-04T10:00:00Z" }, "token": "<jwt>" } }`.

Errors: 400 `VALIDATION_ERROR` (missing/invalid fields or password policy); 409 `EMAIL_ALREADY_EXISTS`.

#### `POST /auth/login` — Public

Request JSON: `{ "email": "asha@example.test", "password": "DemoPass123!" }`.

200: `{ "success": true, "message": "Login successful", "data": { "user": { "_id": "...", "name": "Asha Rao", "email": "asha@example.test", "role": "CUSTOMER", "createdAt": "..." }, "token": "<jwt>" } }`.

Errors: 400 `VALIDATION_ERROR`; 401 `INVALID_CREDENTIALS` (same response for unknown email and wrong password).

#### `GET /auth/me` — All authenticated roles

Request: no body. 200: `{ "success": true, "message": "User retrieved successfully", "data": { "user": { "_id": "...", "name": "Asha Rao", "email": "asha@example.test", "role": "CUSTOMER", "createdAt": "..." } } }`.

Errors: 401 `UNAUTHORIZED`, `TOKEN_EXPIRED`.

### Applications

#### `POST /applications` — CUSTOMER

Creates an editable application in `SUBMITTED` status (not yet in the evaluation pipeline). Request JSON:

```json
{
  "personalDetails": {
    "fullName": "Asha Rao", "dob": "1995-04-12", "gender": "FEMALE",
    "panNumber": "ZZKPS1234Q", "aadhaarLast4": "4821", "mobile": "9876543210",
    "email": "asha@example.test", "occupationCode": "SALARIED_PRIVATE",
    "annualIncome": 900000, "consentToKyc": true
  },
  "addressDetails": { "address": "Flat 12, Lotus Residency, MG Road", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001" }
}
```

201: `{ "success": true, "message": "Application created successfully", "data": { "application": { "_id": "...", "applicationId": "A2000101", "userId": "...", "personalDetails": { "fullName": "Asha Rao", "dob": "1995-04-12", "gender": "FEMALE", "panNumber": "ZZKXXXXX4Q", "aadhaarLast4": "4821", "mobile": "9876543210", "email": "asha@example.test", "occupationCode": "SALARIED_PRIVATE", "annualIncome": 900000, "consentToKyc": true }, "addressDetails": { "address": "Flat 12, Lotus Residency, MG Road", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001" }, "documentIds": [], "status": "SUBMITTED", "riskCategory": null, "decision": null, "reasonCodes": [], "nameMatchScore": null, "rekycDueDate": null, "createdAt": "...", "updatedAt": "..." } } }`.

Errors: 400 `VALIDATION_ERROR`; 401 `UNAUTHORIZED`; 409 `DUPLICATE_APPLICATION` or `DUPLICATE_IDENTIFIER` (PAN already used in this applicant’s open application or existing-customer duplicate where policy requires preventing creation). Rule R17 is otherwise a REVIEW outcome at evaluation time.

#### `GET /applications/mine` — CUSTOMER

Query: `?page=1&limit=10`. 200: `{ "success": true, "message": "Applications retrieved successfully", "data": { "items": [{ "_id": "...", "applicationId": "A2000101", "userId": "...", "personalDetails": { "fullName": "Asha Rao", "panNumber": "ZZKXXXXX4Q", "aadhaarLast4": "4821" }, "addressDetails": { "city": "Mumbai", "state": "Maharashtra", "pincode": "400001" }, "documentIds": [], "status": "SUBMITTED", "riskCategory": null, "decision": null, "reasonCodes": [], "nameMatchScore": null, "rekycDueDate": null, "createdAt": "...", "updatedAt": "..." }], "total": 1, "page": 1, "limit": 10 } }`.

Errors: 400 `VALIDATION_ERROR`; 401 `UNAUTHORIZED`.

#### `GET /applications` — MAKER, CHECKER, COMPLIANCE, ADMIN (phase 2)

Query: `?page=1&limit=10&status=IN_REVIEW&riskCategory=HIGH&from=2026-03-01&to=2026-03-31`. 200 list envelope with `items` using the sanitized application shape. Errors: 400 `VALIDATION_ERROR`; 401 `UNAUTHORIZED`; 403 `FORBIDDEN`.

#### `GET /applications/:applicationId` — owner CUSTOMER; staff roles above (phase 2)

200: `{ "success": true, "message": "Application retrieved successfully", "data": { "application": { "_id": "...", "applicationId": "A2000101", "userId": "...", "personalDetails": { "fullName": "Asha Rao", "panNumber": "ZZKXXXXX4Q", "aadhaarLast4": "4821" }, "addressDetails": { "city": "Mumbai", "pincode": "400001" }, "documentIds": [], "status": "IN_REVIEW", "riskCategory": "LOW", "decision": "REVIEW", "reasonCodes": ["DOCUMENT_MISSING"], "nameMatchScore": 1, "rekycDueDate": "2036-03-04", "createdAt": "...", "updatedAt": "..." } } }`.

Errors: 401 `UNAUTHORIZED`; 403 `FORBIDDEN` (wrong owner/role); 404 `APPLICATION_NOT_FOUND`.

#### `PATCH /applications/:applicationId` — owner CUSTOMER (phase 2)

Request JSON: same `personalDetails`/`addressDetails` fields as creation, partial allowed. Only `SUBMITTED` drafts and `RESUBMISSION_REQUESTED` cases may be changed. On resubmission, required documents must be provided and submission must occur within 7 days.

200: application envelope, with updated `updatedAt`. Errors: 400 `VALIDATION_ERROR`; 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 404 `APPLICATION_NOT_FOUND`; 409 `INVALID_STATUS_TRANSITION`.

#### `POST /applications/:applicationId/submit` — owner CUSTOMER (phase 2)

Request JSON: `{}`. Requires at least three uploaded documents, mandatory KYC consent, and valid application data. 202: `{ "success": true, "message": "Application submitted for processing", "data": { "applicationId": "A2000101", "status": "EXTRACTING" } }`.

Errors: 400 `VALIDATION_ERROR` or `DOCUMENTS_REQUIRED`; 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 404 `APPLICATION_NOT_FOUND`; 409 `INVALID_STATUS_TRANSITION`.

### Documents and extraction

#### `POST /applications/:applicationId/documents` — owner CUSTOMER (phase 2)

Multipart parts: `file` = UTF-8 `.txt`, max 1 MB; `documentType` = one of `PAN_CARD`, `AADHAAR_CARD`, `ELECTRICITY_BILL`, `BANK_STATEMENT`, `DRIVING_LICENCE`. File contents must contain the synthetic specimen marker per source data requirements. Same SHA-256 hash for this application is idempotent and returns the existing record. 201: `{ "success": true, "message": "Document uploaded successfully", "data": { "document": { "_id": "...", "applicationId": "A2000101", "documentType": "PAN_CARD", "fileName": "D3000001.txt", "extractionStatus": "PENDING", "createdAt": "..." } } }`.

Errors: 400 `VALIDATION_ERROR`, `UNSUPPORTED_DOCUMENT_TYPE`, `INVALID_FILE_ENCODING`, `INVALID_FILE_TYPE`; 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 404 `APPLICATION_NOT_FOUND`; 413 `FILE_TOO_LARGE`; 409 `INVALID_STATUS_TRANSITION`.

#### `GET /applications/:applicationId/documents` — owner CUSTOMER or staff (phase 2)

200 list envelope; each item is document metadata only. Each document view/download by a user must be separately authorized and audited; there is no public/guessable document URL. Errors: 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 404 `APPLICATION_NOT_FOUND`.

#### `POST /documents/:documentId/extract` — service, ADMIN demo retry (phase 2)

Request JSON: `{ "provider": "mock" }` (optional; default from `EXTRACTION_PROVIDER`). Provider is `mock` or `ai`. Response (200, or 202 if queued): `{ "success": true, "message": "Document extraction completed", "data": { "documentId": "...", "docType": "PAN_CARD", "confidence": 0.98, "fields": [{ "fieldName": "name", "value": "Asha Rao", "confidence": 0.98 }, { "fieldName": "pan_number", "value": "ZZKPS1234Q", "confidence": 0.96 }], "extractionStatus": "COMPLETED", "source": "MOCK", "extractorVersion": "mock-v1" } }`.

Unknown mock document returns `docType: "OTHER"`, confidence `0.00`, and empty `fields`. Provider timeout/failure marks extraction `FAILED`; fields receive confidence 0 and the case is routed to review. Errors: 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 404 `DOCUMENT_NOT_FOUND`; 422 `EXTRACTION_FAILED`.

#### `GET /applications/:applicationId/extractions` — MAKER, CHECKER, COMPLIANCE, ADMIN (phase 2)

200 list envelope of extraction records for the application. Customer role is denied confidence and field-level extraction data. Errors: 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 404 `APPLICATION_NOT_FOUND`.

### Evaluation and decision

#### `POST /applications/:applicationId/evaluate` — service, ADMIN demo retry (phase 2)

Request JSON: `{}` (optional configuration version override is not accepted from clients). 200: `{ "success": true, "message": "Application evaluated successfully", "data": { "decision": { "applicationId": "A2000101", "decision": "REVIEW", "reasonCodes": ["LOW_EXTRACTION_CONFIDENCE"], "nameMatchScore": 1, "riskCategory": "LOW", "rekycDueDate": "2036-03-04", "evaluatedAt": "...", "status": "IN_REVIEW", "documents": [{ "documentId": "...", "docType": "PAN_CARD", "confidence": 0.62 }] } } }`.

Errors: 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 404 `APPLICATION_NOT_FOUND`; 409 `INVALID_STATUS_TRANSITION`; 422 `EVALUATION_FAILED`.

#### `GET /applications/:applicationId/decision` — owner CUSTOMER (sanitized), MAKER, CHECKER, COMPLIANCE, ADMIN (phase 2)

200: same decision shape as evaluation response. Customer response includes readable reason messages but omits match-entry names, watchlist details, extraction confidences, and internal evidence. Errors: 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 404 `DECISION_NOT_FOUND`.

### Maker/officer workflow

#### `GET /officer/review-queue` — MAKER (phase 2)

Query: `?page=1&limit=10`. Queue sorts HIGH risk first, then submission time. 200 list envelope of application summaries and structured reasons. Errors: 401 `UNAUTHORIZED`; 403 `FORBIDDEN`.

#### `GET /officer/applications/:applicationId` — MAKER (phase 2)

200: `{ "success": true, "message": "Review case retrieved successfully", "data": { "application": { "applicationId": "A2000101", "status": "IN_REVIEW", "...": "..." }, "documents": [{ "documentId": "...", "fileName": "D3000001.txt", "text": "SYNTHETIC SPECIMEN - NOT A VALID DOCUMENT\\n...", "docType": "PAN_CARD", "fields": [{ "fieldName": "pan_number", "value": "ZZTP59O12Y", "confidence": 0.62 }] }], "decision": { "decision": "REVIEW", "reasonCodes": ["LOW_EXTRACTION_CONFIDENCE"] } } }`.

Every document view is audited. Errors: 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 404 `APPLICATION_NOT_FOUND`; 409 `CONCURRENT_MODIFICATION`.

#### `POST /officer/applications/:applicationId/recommend` — MAKER (phase 2)

Request JSON: `{ "recommendation": "APPROVE", "comments": "Identity and address evidence reviewed." }`. `comments` must contain at least 10 characters. Optional field correction is a separate request extension: `{ "corrections": [{ "documentId": "...", "fieldName": "pan_number", "value": "ZZTPS9012Y", "reason": "Corrected from clearly legible specimen text." }] }`; each correction requires a reason, is stored with source `OFFICER`, confidence `1.00`, triggers re-evaluation, and is audited with before/after values.

200: `{ "success": true, "message": "Maker recommendation recorded successfully", "data": { "makerChecker": { "applicationId": "A2000101", "makerId": "...", "makerRecommendation": "APPROVE", "makerComments": "Identity and address evidence reviewed.", "checkerId": null, "checkerDecision": null, "checkerComments": null, "createdAt": "...", "updatedAt": "..." }, "status": "PENDING_CHECKER", "decision": { "decision": "APPROVE", "reasonCodes": [], "riskCategory": "LOW", "rekycDueDate": "2036-03-04" } } }`.

Errors: 400 `VALIDATION_ERROR`; 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 404 `APPLICATION_NOT_FOUND`; 409 `CONCURRENT_MODIFICATION`, `INVALID_STATUS_TRANSITION`.

### Checker workflow

#### `GET /checker/pending` — CHECKER, COMPLIANCE (phase 2)

Query: `?page=1&limit=10`. 200 list envelope of `PENDING_CHECKER` items, including maker id and recommendation but no unrestricted document content. Errors: 401 `UNAUTHORIZED`; 403 `FORBIDDEN`.

#### `POST /checker/applications/:applicationId/decision` — CHECKER, COMPLIANCE (phase 2)

Request JSON: `{ "decision": "APPROVE", "comments": "Independent review completed." }`. `comments` minimum is 10 characters. Checker must differ from maker. `SEND_BACK` moves status to `IN_REVIEW`; on final approval, backend invokes mock core banking once.

200: `{ "success": true, "message": "Checker decision recorded successfully", "data": { "applicationId": "A2000101", "checkerDecision": "APPROVE", "status": "APPROVED", "account": { "customerId": "CUST-9001", "accountNumber": "1000000001" } } }`.

Errors: 400 `VALIDATION_ERROR`; 401 `UNAUTHORIZED`; 403 `FORBIDDEN` (including same maker/checker); 404 `APPLICATION_NOT_FOUND`; 409 `INVALID_STATUS_TRANSITION`, `CONCURRENT_MODIFICATION`; 502 `CORE_BANKING_FAILED` (application remains approved; retry is idempotent).

### Compliance

#### `GET /compliance/dashboard` — COMPLIANCE, ADMIN (phase 2)

Query: `?from=2026-03-01&to=2026-03-31`. 200: `{ "success": true, "message": "Dashboard retrieved successfully", "data": { "byStatus": { "SUBMITTED": 0, "IN_REVIEW": 0, "PENDING_CHECKER": 0 }, "decidedCount": 10, "straightThroughRate": 0.4, "reviewRate": 0.3, "rejectRate": 0.3, "topReasonCodes": [{ "reasonCode": "DOCUMENT_MISSING", "count": 4 }], "averageReviewTimeSeconds": 120, "pendingCheckerCount": 2 } }`.

Errors: 400 `VALIDATION_ERROR`; 401 `UNAUTHORIZED`; 403 `FORBIDDEN`.

#### `GET /compliance/audit/:applicationId` — COMPLIANCE, ADMIN (phase 2)

200 list envelope ordered oldest first; each item `{ "_id": "...", "applicationId": "A2000101", "actorId": "...", "action": "DOCUMENT_VIEWED", "details": {}, "timestamp": "..." }`. Errors: 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 404 `APPLICATION_NOT_FOUND`.

#### `GET /compliance/decisions/export` — COMPLIANCE, ADMIN (phase 2)

Query: optional `?from=2026-03-01&to=2026-03-31`. Success is the sole endpoint exception to JSON: HTTP 200, `Content-Type: text/csv; charset=utf-8`, with exactly these column names/order: `application_id,decision,reason_codes,name_match_score,risk_category,rekyc_due_date`. Empty/null values are empty CSV cells; `reason_codes` joins in rule order with `|`; scores are formatted to four decimals. PAN is not included. Errors use the common JSON envelope. Errors: 400 `VALIDATION_ERROR`; 401 `UNAUTHORIZED`; 403 `FORBIDDEN`.

### Mock core banking

#### `POST /core-banking/accounts` — service, ADMIN demo retry (phase 2)

Request JSON: `{ "applicationId": "A2000101" }`. Only final `APPROVED` or `AUTO_APPROVED` can open an account; idempotent per application. 201 (first creation) or 200 (repeat): `{ "success": true, "message": "Mock account created successfully", "data": { "applicationId": "A2000101", "customerId": "CUST-9001", "accountNumber": "1000000001", "createdAt": "..." } }`.

Errors: 400 `VALIDATION_ERROR`; 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 404 `APPLICATION_NOT_FOUND`; 409 `APPLICATION_NOT_APPROVED`; 502 `CORE_BANKING_FAILED`.

#### `GET /core-banking/accounts/:applicationId` — owner CUSTOMER (limited), staff (phase 2)

200: `{ "success": true, "message": "Account retrieved successfully", "data": { "applicationId": "A2000101", "customerId": "CUST-9001", "accountNumber": "1000000001", "createdAt": "..." } }`.

Errors: 401 `UNAUTHORIZED`; 403 `FORBIDDEN`; 404 `ACCOUNT_NOT_FOUND`.

## Error code reference

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Required field missing, malformed value, invalid date, invalid pagination/filter, invalid PAN/Aadhaar/mobile/pincode, or invalid comment. `details` identifies fields. |
| 400 | `UNSUPPORTED_DOCUMENT_TYPE` | Declared type is not in the canonical document enum. |
| 400 | `INVALID_FILE_TYPE`, `INVALID_FILE_ENCODING` | Upload is not a UTF-8 `.txt` file. |
| 401 | `UNAUTHORIZED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS` | Missing/invalid/expired JWT or login failure. |
| 403 | `FORBIDDEN` | Authenticated role lacks access, resource is not owned by customer, or maker attempts own checker decision. |
| 404 | `APPLICATION_NOT_FOUND`, `DOCUMENT_NOT_FOUND`, `DECISION_NOT_FOUND`, `ACCOUNT_NOT_FOUND` | Referenced resource does not exist or is intentionally concealed for ownership privacy. |
| 409 | `EMAIL_ALREADY_EXISTS`, `DUPLICATE_APPLICATION`, `DUPLICATE_IDENTIFIER` | Conflicting identity or duplicate creation. Existing-customer PAN match during evaluation is R17 `DUPLICATE_CUSTOMER` (REVIEW), not an automatic rejection. |
| 409 | `INVALID_STATUS_TRANSITION` | Operation is not permitted from current lifecycle status. |
| 409 | `CONCURRENT_MODIFICATION` | Another officer has changed/claimed the case; second concurrent write is rejected. |
| 413 | `FILE_TOO_LARGE` | Uploaded document exceeds 1 MB. |
| 422 | `EXTRACTION_FAILED`, `EVALUATION_FAILED` | Processing could not complete; failed extraction is confidence 0 and routes to review. |
| 502 | `CORE_BANKING_FAILED` | Mock service unavailable; retry is idempotent. |

Standard unauthorized/error example: HTTP 400 `{ "success": false, "message": "Validation failed", "error": { "code": "VALIDATION_ERROR", "details": [{ "field": "personalDetails.aadhaarLast4", "issue": "Must contain exactly four digits." }] } }`.

## Validation and business rule behavior

- Required application fields are all fields in `personalDetails` and `addressDetails` shown in the create example; `consentToKyc` must be `true`.
- `panNumber` matches `^[A-Z]{5}[0-9]{4}[A-Z]$`; rule R5 additionally requires the fourth character to be `P`. `aadhaarLast4` matches `^[0-9]{4}$`; 12-digit Aadhaar values are rejected. `mobile` matches `^[6-9][0-9]{9}$`; `pincode` matches `^[1-9][0-9]{5}$`; DOB cannot be a future date.
- Unsupported doc types and invalid/oversized uploads fail before storage. A duplicate file hash for the same application returns the existing document (idempotency).
- Missing required/invalid fields return HTTP 400 with field-level details. Unknown application/document IDs return 404. Wrong JWT is 401; wrong role/owner is 403.
- Watchlist MATCH/POSSIBLE and reason codes are returned only to authorized staff. Customer receives plain-language reason messages without list-entry identity or sensitive screening details.
- R1 missing required document, R2 declared/classified type mismatch, R3 low type/required-field confidence; R4 underage; R5 invalid/ non-individual PAN; R6 PAN mismatch; R7 DOB mismatch; R8 Aadhaar mismatch; R9 name score below 0.75; R10 sanctions MATCH; R11 name score 0.75–<0.90; R12 expired driving licence; R13 address proof older than 90 days or future-dated; R14 address pincode mismatch; R15 sanctions POSSIBLE; R16 PEP MATCH; R17 existing-customer PAN.
- Field correction requires a reason, records old/new values and officer identity, sets source `OFFICER` and confidence `1.00`, and reruns all applicable rules. Race conditions use atomic status/version checks and return 409.
- Every document view, extraction, evaluation, correction, recommendation, checker action, status transition, watchlist hit, and account operation is audited. Audit records cannot be updated or deleted through the API.

## Environment variables

| Variable | Purpose | Example/default |
|---|---|---|
| `PORT` | Express port | `5000` |
| `API_PREFIX` | API route prefix | `/api/v1` |
| `MONGODB_URI` | Mongo connection | `mongodb://localhost:27017/onboardiq` |
| `JWT_SECRET` | Signing secret (development only placeholder) | set locally |
| `JWT_EXPIRES_IN` | Token lifetime | `8h` |
| `FRONTEND_ORIGIN` | CORS origin | `http://localhost:5173` |
| `EXTRACTION_PROVIDER` | `mock` or `ai` | `mock` |
| `EXTRACTION_TIMEOUT_MS` | Per-document extraction timeout | `10000` |
| `UPLOAD_DIR` | Private document storage directory | `./storage/documents` |
| `MAX_DOCUMENT_BYTES` | Upload cap | `1048576` |
| `CORE_BANKING_SERVICE_KEY` | Backend-only mock service credential | set locally |
| `RULE_CONFIG_PATH` | Rules configuration JSON | `./data/case_02_rules_config_V1.0.json` |
| `WATCHLIST_DIR` | Sanctions/PEP data directory | `./data/watchlists` |
| `APP_TIMEZONE` | Calendar date interpretation | `Asia/Kolkata` |

`.env.example` (place at repository root; values are safe local defaults, never production secrets):

```dotenv
PORT=5000
API_PREFIX=/api/v1
MONGODB_URI=mongodb://localhost:27017/onboardiq
JWT_SECRET=replace-with-a-local-development-secret
JWT_EXPIRES_IN=8h
FRONTEND_ORIGIN=http://localhost:5173
EXTRACTION_PROVIDER=mock
EXTRACTION_TIMEOUT_MS=10000
UPLOAD_DIR=./storage/documents
MAX_DOCUMENT_BYTES=1048576
CORE_BANKING_SERVICE_KEY=local-development-only
RULE_CONFIG_PATH=./data/case_02_rules_config_V1.0.json
WATCHLIST_DIR=./data/watchlists
APP_TIMEZONE=Asia/Kolkata
```

Frontend `.env.example`:

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

## First integration milestone

1. Register/login obtains a JWT; frontend stores/attaches it as `Authorization: Bearer <token>`.
2. Customer submits a valid application with the agreed JSON fields.
3. Backend validates and persists in MongoDB with a readable `applicationId` and `SUBMITTED` status.
4. Frontend calls `GET /applications/mine` and renders each application/status.

Document upload, extraction, evaluation, and staff features are phase 2; the initial integration must not assume those endpoints are already implemented.

## Proposed repository folder structure

```text
OnboardIQ/
├── API_CONTRACT.md
├── .env.example
├── package.json                 # workspace scripts (optional monorepo root)
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/              # env, db, rule config
│   │   ├── routes/              # route declarations only
│   │   ├── controllers/         # HTTP request/response mapping
│   │   ├── middleware/          # JWT, role, validation, errors, upload
│   │   ├── models/              # Mongoose User, Application, Document, Extraction, Decision, Audit, MakerChecker
│   │   ├── services/            # auth, applications, extraction providers, rules, screening, core banking, audit
│   │   ├── validators/
│   │   └── utils/
│   ├── scripts/                 # development seed accounts/data
│   └── tests/
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── services/api.js      # single Axios client
│   │   ├── services/            # auth, applications, documents, officers, checkers, compliance
│   │   ├── components/
│   │   ├── pages/
│   │   ├── routes/
│   │   └── ...
│   └── .env.example
├── data/                        # synthetic inputs, rule config, watchlists (never real PII)
├── storage/documents/           # private local uploads; gitignored
├── output/
│   ├── decisions_output.csv
│   └── design/
│       ├── design_document.md
│       ├── openapi.yaml
│       ├── status_lifecycle.mmd
│       └── er_diagram.mmd
└── postman/
    └── OnboardIQ.postman_collection.json
```

## Endpoint implementation tracker

| Scope | State in this contract revision |
|---|---|
| Authentication (`/auth/*`) | Contracted; implementation pending |
| Customer create/list vertical slice | Contracted; implementation pending |
| Remaining applications/documents/extraction/evaluation | Contracted; phase 2, pending |
| Maker/checker/compliance/core banking | Contracted; phase 2, pending |
| `GET /health` | Required backend support endpoint, pending; returns `{ "success": true, "message": "Service is healthy", "data": { "status": "ok" } }` without auth |
| Postman collection | Pending; contract examples above are the current equivalent integration reference |

The health endpoint is outside the `/api/v1` prefix and outside the requested business endpoint inventory. No endpoint is claimed implemented until its live request/response has been verified against this contract.
