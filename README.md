# CommonGround — Backend API

REST API for **CommonGround**, a community volunteering platform where organizers create events and volunteers join them. Built with Express 5 and the native MongoDB driver, secured with Better Auth JWT tokens verified against a remote JWKS endpoint.

## Live

| Service | URL |
| --- | --- |
| **API (live)** | https://common-ground-backend-api.vercel.app/ |
| Frontend | https://common-ground-frontend.vercel.app/ |
| Repository | https://github.com/sabbircodeh083/Common_Ground_Backend |

Quick check:

```bash
curl https://common-ground-backend-api.vercel.app/
# {"message":"Social Events API is running!"}
```

## Tech Stack

- **Node.js** (ES Modules)
- **Express 5**
- **MongoDB** official driver (`mongodb`) — database: `CommonGround`
- **jose** — JWT verification via remote JWKS
- **cors**, **dotenv**
- **Vercel** — serverless deployment

## API Reference

Base URL: `https://common-ground-backend-api.vercel.app`

🔒 = requires `Authorization: Bearer <jwt>` header.

### Health

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/` | Service health check |

### Events

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/events` | — | All upcoming events (from today, Asia/Dhaka), sorted soonest first |
| GET | `/events-recent6` | — | The 6 nearest upcoming events |
| GET | `/events/:id` | — | Single event by id (`400` if malformed, `404` if missing) |
| POST | `/events` | 🔒 | Create an event (sets `volunteerCount: 0`) |
| PUT | `/events/:id` | 🔒 | Update an event; ignores `_id` and `volunteerCount` |
| DELETE | `/events/:id` | 🔒 | Delete an event and its join records |

### Joined Events

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/joinedEvent` | 🔒 | Join an event (capacity-checked, atomic slot reservation) |
| GET | `/joinedEvent/list/:participantId` | 🔒 | A participant's joined events, newest first |
| DELETE | `/joinedEvent/:id` | 🔒 | Leave an event (by join record id), frees the slot |

### Organized Events

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/organizedEvent/list/:organizerId` | 🔒 | Events created by an organizer |

## Authentication

Private routes are protected by the `verifyToken` middleware:

1. Reads `Authorization: Bearer <token>`; missing/malformed → `401 {"msg":"Unauthorized!"}`.
2. Verifies the JWT against the JWKS published by Better Auth at:
   `${CLIENT_URL}/api/auth/jwks`
3. On success, the decoded payload is attached to `req.user`.

Invalid or expired tokens also return `401`.

## Data Model

### `events`

```json
{
  "_id": "6afdd387a1250306b5d8f838",
  "title": "Green Campus Tree Plantation Drive",
  "type": "Plantation",
  "date": "2026-11-26",
  "description": "<p>...</p>",
  "thumbnailUrl": "https://...",
  "location": "BUET Campus, Dhaka",
  "numberOfVolunteers": 60,
  "volunteerCount": 0,
  "organizerId": "6af9dfe61aa95da6fdb7c068",
  "organizerName": "sabbir",
  "organizerEmail": "organizer@example.com",
  "organizerImage": "https://..."
}
```

`date` is a `YYYY-MM-DD` string, so lexicographic sorting equals chronological sorting.

### `joinedEvent`

Stores the join record plus a snapshot of event fields, used for the participant's "my events" list. A unique compound index on `{ eventId, participantId }` prevents double joins.

### `user`

Managed by Better Auth.

## Join Flow

`POST /joinedEvent` is concurrency-safe:

1. Validate ids and confirm the event exists.
2. Reject if the participant already joined (`409 ALREADY_JOINED`).
3. Reject if `volunteerCount >= numberOfVolunteers` (`409 EVENT_FULL`).
4. Atomically increment `volunteerCount` **only if** a slot is still free (`$expr` / `$lt`) — this closes the overbooking race window.
5. Insert the join record; if that fails, decrement the counter to release the reserved slot.

`PUT /events/:id` and `DELETE /events/:id` also propagate to the related join records so a participant's list stays consistent with the event.

## Getting Started

### Prerequisites

- Node.js 18+
- A MongoDB database (Atlas or local)

### Install

```bash
git clone https://github.com/sabbircodeh083/Common_Ground_Backend.git
cd Common_Ground_Backend
npm install
```

### Environment Variables

Create a `.env` in the project root:

```env
PORT=8000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<db>
CLIENT_URL=https://common-ground-frontend.vercel.app
```

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Port to listen on (default `8000`) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `CLIENT_URL` | Yes | Frontend origin. Used for CORS **and** to build the JWKS URL, so the app throws on startup if it is missing |

> `.env*` and `.vercel` are git-ignored. Never commit real credentials.

### Run

```bash
npm start   # production: node index.js
npm run dev # development: nodemon index.js
```

Server starts on `http://localhost:8000`.

## Deployment

Deployed on Vercel as a serverless Node function. `index.js` exports the Express `app` as the default export, which Vercel uses as the request handler.

Set the same environment variables in the Vercel project settings, then:

```bash
vercel --prod
```

Note that the `joinedEvent` unique index and the Mongo client are created at module scope, so they are reused across invocations of a warm serverless instance.

## Project Structure

```
backend_API/
├── index.js        # Express app: middleware, auth, all routes, Mongo setup
├── package.json
├── .env            # local secrets (git-ignored)
└── .vercel/        # Vercel project link (git-ignored)
```

## Known Issues

- `POST /joinedEvent` currently inserts `req.body` verbatim, so `eventId` is stored as a **string**, while queries elsewhere compare it as an `ObjectId`. This weakens duplicate-join detection and makes the `updateMany` that syncs join records on `PUT /events/:id` match nothing. Fix: insert an explicit document with `eventId: new ObjectId(id)`.
- `client.connect()` is never awaited; the driver connects lazily, but the startup `createIndex` call is the only eager connection.

## License

ISC
