# BiteSpeed Backend

A backend service that implements identity reconciliation — linking contacts that share an email address or phone number across multiple records.

## Tech Stack

- **Node.js** with **Express**
- **PostgreSQL** (via `pg`)
- **Morgan** for request logging
- **Helmet** for HTTP security headers
- **dotenv** for configuration

## Project Structure

```
src/
├── controllers/       # HTTP request/response handling
├── services/          # Business logic (reconciliation)
├── routes/            # Route definitions
├── middleware/        # Error handling, 404 handler
├── db/
│   ├── index.js       # PostgreSQL connection pool
│   ├── migrate.js     # Migration runner
│   └── migrations/    # SQL migration files
└── utils/             # Input validation helpers
```

## Local Setup

**Prerequisites:** Node.js ≥ 18, PostgreSQL running locally.

```bash
# Clone the repo
git clone https://github.com/Harsh2001Ranjan/BiteSpeed.git
cd BiteSpeed

# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env
```

Edit `.env` with your values (see below), then:

```bash
# Run database migrations
npm run migrate

# Start the development server
npm run dev
```

The server starts at `http://localhost:3000`.

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/bitespeed
CORS_ORIGIN=*
```

| Variable       | Description                                      |
|----------------|--------------------------------------------------|
| `PORT`         | Port to run the server on (default: 3000)        |
| `NODE_ENV`     | `development` or `production`                    |
| `DATABASE_URL` | Full PostgreSQL connection string                |
| `CORS_ORIGIN`  | Allowed CORS origin (use `*` for development)    |

## Database Migration

Migrations live in `src/db/migrations/` and are run in alphabetical order.

```bash
npm run migrate
```

To add a new migration, create a file like `002_your_change.sql` in the migrations folder. It will be picked up automatically.

## API

### `POST /identify`

Accepts an email and/or phone number and returns the consolidated contact identity.

**Request**

```http
POST /identify
Content-Type: application/json
```

```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "123456"
}
```

**Response**

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

If the same email is seen with a new phone number, a secondary contact is created and linked to the primary:

**Request**
```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "999999"
}
```

**Response**
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456", "999999"],
    "secondaryContactIds": [2]
  }
}
```

**Validation errors return `400`:**

```json
{ "error": "email must be a valid email address." }
```

### `GET /health`

Returns server and timestamp info. Useful for uptime checks.

```json
{ "status": "healthy", "timestamp": "2026-03-03T00:00:00.000Z" }
```

## Deployment on Render

1. Push your code to GitHub.
2. Go to [Render](https://dashboard.render.com) → **New** → **PostgreSQL**. Create a database and copy the **Internal Database URL**.
3. Go to **New** → **Web Service**, connect your GitHub repo.
4. Set the following:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under **Environment Variables**, add:
   - `DATABASE_URL` → your Render PostgreSQL internal URL
   - `NODE_ENV` → `production`
6. Deploy. Once live, run the migration manually via Render's **Shell** tab:
   ```bash
   npm run migrate
   ```

## Scripts

| Script          | Description                     |
|-----------------|---------------------------------|
| `npm start`     | Start the production server     |
| `npm run dev`   | Start with nodemon (hot reload) |
| `npm run migrate` | Run all pending SQL migrations |
