# Optimization HTTP API

## Health

`GET /health`

Successful response (`200`):

```json
{"status":"ok"}
```

The health endpoint does not call LocationIQ.

## Authentication

Production uses Google Identity Services. The frontend posts the Google ID token to `POST /api/auth/google`:

```json
{"credential":"<google-id-token>"}
```

The backend validates the token and creates the first user, personal organization and `ADMIN` membership when needed. Subsequent private requests must include:

```http
Authorization: Bearer <google-id-token>
```

Private endpoints are `/employees`, `/api/geocoding/preview`, `/api/routes/optimize` and `/api/routes/recalculate`. `/health` and the Google sign-in endpoint remain public. Every employee query is scoped to the organization resolved from the validated identity.

## Guest mode

The unauthenticated guest playground exposes a fixed, read-only dataset of 30 fictitious employees through `GET /api/guest/employees`. The browser copies that dataset into versioned localStorage and keeps guest CRUD changes there; no guest employee is written to PostgreSQL.

Guest optimization sends only the selected, validated employees to the isolated public routes:

```json
POST /api/guest/routes/optimize
{"employees":[{"id":"demo-01","name":"Lucas Almeida","address":"Centro, Cabo","phone":"(81) 99000-0001","latitude":-8.29,"longitude":-35.03}]}
```

`POST /api/guest/routes/recalculate` accepts the same employee payload plus manual groups. Guest executions allow at most 12 employees, use the same optimization/routing services, and are protected by an in-memory per-IP rate limit. Guest geocoding is available only at `POST /api/guest/geocoding/preview`, with its own rate limit and input size validation. No guest endpoint can access organization employees.

## Employee coordinates

`POST /employees` and `PUT /employees/:id` accept optional `latitude` and `longitude`.
When both are supplied and valid, they are persisted as the routing source of truth and the backend does not geocode again. If neither is supplied, the existing automatic geocoding behavior is preserved. Supplying only one coordinate, a non-finite value, or a value outside the valid latitude/longitude ranges returns `400`.

The address remains the human-readable description of the location. Coordinates are the point used by routing.

## Geocoding preview

`POST /api/geocoding/preview`

```json
{"address":"Rua do endereço, 123, Recife"}
```

Successful response:

```json
{"latitude":-8.123,"longitude":-34.123}
```

The route returns only coordinates. The LocationIQ key and raw provider response remain on the backend.

## Optimize selected employees

`POST /api/routes/optimize`

Request body:

```json
{"employeeIds":["employee-1","employee-2"]}
```

`employeeIds` is required. It must be a non-empty array of unique employee IDs. Unknown IDs and duplicate IDs return `400`. The server loads only those employees from PostgreSQL belonging to the authenticated organization, uses the configured company origin, creates a routing provider and invokes `optimizeEmployeeRoutes` once. Requests with the same organization and normalized selection may share one in-flight execution; different selections never share results. The request may take more than a minute.

Successful response (`200`):

```json
{
  "groups": [
    {
      "groupNumber": 1,
      "status": "ACCEPTED",
      "acceptable": true,
      "employees": [
        {"id":"employee-1","name":"Ana","latitude":-8.1,"longitude":-34.9}
      ],
      "stops": [
        {"type":"ORIGIN","id":"company","name":"Company","latitude":-8.1678849,"longitude":-34.9442083},
        {"type":"EMPLOYEE","id":"employee-1","employeeId":"employee-1","name":"Ana","latitude":-8.1,"longitude":-34.9}
      ],
      "totalDurationSeconds": 1200,
      "totalDistanceMeters": 4500,
      "averageExtraDurationSeconds": 300,
      "maxExtraDurationSeconds": 600,
      "passengerMetrics": [
        {"employeeId":"employee-1","name":"Ana","directDurationSeconds":500,"sharedDurationSeconds":600,"extraDurationSeconds":100}
      ],
      "violations": []
    }
  ],
  "issues": [],
  "summary": {
    "totalEmployees": 1,
    "totalGroups": 1,
    "acceptableGroups": 1,
    "rejectedGroups": 0,
    "unavailableGroups": 0,
    "unroutableEmployees": 0,
    "averageOccupancy": 1
  }
}
```

`REJECTED` groups and operational issues still return `200`. A rejected group has `status: "REJECTED"` and its `violations`. An unroutable employee appears in `issues` with `type: "UNROUTABLE_EMPLOYEE"` and a safe employee summary. Phone numbers and full addresses are not included in this DTO.

Error responses use this shape:

```json
{
  "error": {
    "code": "ROUTING_PROVIDER_UNAVAILABLE",
    "message": "Não foi possível calcular as rotas no momento."
  }
}
```

Current mappings:

| Status | Code | Meaning |
|---:|---|---|
| 400 | `INVALID_REQUEST` / `INVALID_JSON` / `INVALID_ROUTING_INPUT` | Request or routing data is invalid |
| 400 | `EMPLOYEE_NOT_FOUND` | One or more selected IDs do not exist |
| 500 | `ROUTING_PROVIDER_CONFIGURATION` | Provider configuration is missing or invalid |
| 502 | `ROUTING_PROVIDER_RESPONSE_INVALID` | Provider returned an invalid Matrix |
| 503 | `ROUTING_PROVIDER_UNAVAILABLE` | Provider/upstream failure |
| 504 | `ROUTING_PROVIDER_TIMEOUT` | Identifiable provider timeout |
| 500 | `INTERNAL_ERROR` | Unexpected server failure |

`FRONTEND_ORIGIN` may be set to enable CORS for one configured frontend origin. No wildcard origin is enabled by default.

## Postman smoke test

1. Configure `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `LOCATIONIQ_API_KEY` and `FRONTEND_ORIGIN` in the backend environment.
2. Send `GET http://localhost:3000/health`; expect `200` and `{"status":"ok"}`.
3. Send `POST http://localhost:3000/api/routes/optimize` with `Content-Type: application/json` and a body such as `{"employeeIds":["employee-1"]}`; expect `200` and the groups/issues/summary response. A populated database may take more than a minute because the request performs the complete optimization.

## Recalculate manually reviewed groups

`POST /api/routes/recalculate`

This endpoint recalculates only the groups supplied by the operator. It does not run the initial grouping policy again.

```json
{
  "employeeIds": ["employee-1", "employee-2", "employee-3"],
  "groups": [
    {
      "groupNumber": 1,
      "employeeIds": ["employee-1", "employee-3"],
      "stopOrder": ["company", "employee-3", "employee-1"]
    },
    {"groupNumber": 2, "employeeIds": ["employee-2"]}
  ]
}
```

`stopOrder` is optional. When supplied, that order is calculated exactly as requested; when omitted, the existing route scoring policy chooses the best order for that group. Groups cannot contain more than four passengers. This endpoint returns the same group/issue/summary DTO as optimization and never requests a real Uber trip.

The frontend export menu produces internal JSON, operational CSV, plain text, and a preview-only Uber Guest Rides payload. The Uber preview is not sent to Uber and requires valid coordinates and Brazilian phone numbers convertible to E.164 (`+55...`).
