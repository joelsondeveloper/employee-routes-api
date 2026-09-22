# Optimization HTTP API

## Health

`GET /health`

Successful response (`200`):

```json
{"status":"ok"}
```

The health endpoint does not call LocationIQ.

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

`employeeIds` is required. It must be a non-empty array of unique employee IDs. Unknown IDs and duplicate IDs return `400`. The server loads only those employees from SQLite, uses the configured company origin, creates a routing provider and invokes `optimizeEmployeeRoutes` once. Requests with the same normalized selection may share one in-flight execution; different selections never share results. The request may take more than a minute.

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

1. Start the server with the configured `.env` file.
2. Send `GET http://localhost:3000/health`; expect `200` and `{"status":"ok"}`.
3. Send `POST http://localhost:3000/api/routes/optimize` with `Content-Type: application/json` and a body such as `{"employeeIds":["employee-1"]}`; expect `200` and the groups/issues/summary response. A populated database may take more than a minute because the request performs the complete optimization.
