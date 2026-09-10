# AI Calendar Assistant — Backend

Backend service for an AI-powered meeting and calendar assistant.

The backend combines **Google Calendar**, **Gemini**, **Mastra**, **Descope**, and **PostgreSQL** to let authenticated users interact with their calendar through natural language.

Users can ask the assistant to:

* View upcoming meetings
* View today's agenda
* Check calendar availability
* Create meetings
* Add Google Meet links
* Invite attendees
* Reschedule meetings
* Cancel meetings
* Maintain conversational memory and meeting preferences

---

## Architecture

```text
                         ┌──────────────────────┐
                         │      Next.js         │
                         │      Frontend        │
                         └──────────┬───────────┘
                                    │
                              HTTP / SSE
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Express Backend   │
                         └──────────┬───────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
             ▼                      ▼                      ▼
      ┌─────────────┐       ┌──────────────┐       ┌─────────────┐
      │   Descope   │       │    Mastra    │       │ PostgreSQL  │
      │     Auth    │       │  AI Agent    │       │   Database  │
      └──────┬──────┘       └──────┬───────┘       └─────────────┘
             │                     │
             │                     ▼
             │              ┌──────────────┐
             │              │    Gemini    │
             │              │     LLM      │
             │              └──────────────┘
             │
             ▼
      ┌─────────────────────┐
      │ Google Calendar     │
      │ OAuth Connection    │
      └─────────────────────┘

                         ┌──────────────────────┐
                         │     Mastra Memory    │
                         │      LibSQL/SQLite   │
                         └──────────────────────┘
```

---

# Tech Stack

| Technology          | Purpose                                       |
| ------------------- | --------------------------------------------- |
| Node.js             | Backend runtime                               |
| TypeScript          | Application language                          |
| Express             | HTTP API server                               |
| PostgreSQL          | Application database                          |
| `pg`                | PostgreSQL client                             |
| Mastra              | AI agent framework                            |
| Gemini              | LLM provider                                  |
| `@mastra/memory`    | Agent memory                                  |
| `@mastra/libsql`    | Persistent Mastra memory storage              |
| Descope             | Authentication and Google Calendar connection |
| Google Calendar API | Calendar operations                           |
| Zod                 | Request/tool validation                       |
| CORS                | Frontend-backend communication                |
| Server-Sent Events  | Streaming AI responses                        |
| dotenv              | Environment configuration                     |

---

# Project Structure

```text
backend/
│
├── scripts/
│   └── migrate.ts
│
├── sql/
│   ├── 001_users.sql
│   └── 002_connections.sql
│
├── src/
│   ├── config/
│   │   ├── agent-instructions.ts
│   │   ├── descope.ts
│   │   └── memory.ts
│   │
│   ├── db/
│   │   └── pool.ts
│   │
│   ├── middleware/
│   │   └── requireSession.ts
│   │
│   ├── repositories/
│   │   ├── connection.repository.ts
│   │   └── user.repository.ts
│   │
│   ├── routes/
│   │   ├── agent.routes.ts
│   │   └── connection.routes.ts
│   │
│   ├── services/
│   │   ├── agent-tools.service.ts
│   │   ├── agent.service.ts
│   │   ├── calendar.service.ts
│   │   ├── connection.service.ts
│   │   └── token.service.ts
│   │
│   └── index.ts
│
├── .env
├── package.json
├── package-lock.json
├── tsconfig.json
└── mastra.db
```

> `.env`, `mastra.db`, and other generated/local files should not be committed to Git.

---

# Core Components

## 1. Authentication

Authentication is handled through **Descope**.

Every protected endpoint uses:

```text
Authorization: Bearer <session-token>
```

The `requireSession` middleware:

1. Extracts the Bearer token.
2. Validates the session with Descope.
3. Extracts the authenticated user's ID.
4. Creates/updates the corresponding local PostgreSQL user.
5. Attaches authentication information to `req.auth`.

The request authentication context contains:

```typescript
{
  authUserId,
  email,
  name,
  userId,
  token
}
```

There are two user identifiers:

### `authUserId`

The user ID provided by Descope.

### `userId`

The internal PostgreSQL UUID associated with the user.

This separation allows the application database to maintain its own user identity while using Descope as the authentication provider.

---

# 2. PostgreSQL

PostgreSQL stores application-level user and connection information.

## Users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id TEXT UNIQUE NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Connections

```sql
CREATE TABLE connections (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    PRIMARY KEY (user_id, provider)
);
```

Currently supported provider:

```text
calendar
```

Connection states:

```text
connected
disconnected
pending
```

---

# 3. Database Access

PostgreSQL access is centralized in:

```text
src/db/pool.ts
```

The backend uses a lazy-created PostgreSQL connection pool.

The connection is configured through:

```text
DATABASE_URL
```

Example:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/agentic_calendar
```

---

# 4. Database Migrations

SQL migrations are stored in:

```text
sql/
```

Current migrations:

```text
001_users.sql
002_connections.sql
```

The migration script:

```text
scripts/migrate.ts
```

automatically:

1. Reads all `.sql` files.
2. Sorts them.
3. Executes them against PostgreSQL.
4. Logs each migrated file.

Run:

```bash
npm run migrate
```

---

# 5. AI Agent

The AI assistant is implemented using **Mastra**.

Main service:

```text
src/services/agent.service.ts
```

The agent is configured with:

```text
Model:
google/gemini-3.6-flash
```

The model can use calendar tools exposed through:

```text
createCalendarTools()
```

The agent also has persistent memory.

---

# 6. Calendar Tools

The AI agent currently has five tools.

## `listUpcomingMeetings`

Lists upcoming Google Calendar events.

Parameters:

```typescript
{
  maxResults?: number;
  todayOnly?: boolean;
}
```

Example user request:

```text
What's on my calendar today?
```

The agent can call:

```text
listUpcomingMeetings
```

with:

```json
{
  "todayOnly": true
}
```

---

## `checkCalendarBusy`

Checks whether the user's calendar is busy during a specified time range.

Parameters:

```typescript
{
  startIso: string;
  endIso: string;
}
```

It uses the Google Calendar FreeBusy API.

Example:

```text
Am I free tomorrow from 10 AM to 11 AM?
```

---

## `createMeeting`

Creates a Google Calendar event.

Parameters include:

```typescript
{
  title: string;
  startIso: string;
  endIso: string;
  attendeeEmails?: string[];
  description?: string;
  addGoogleMeet?: boolean;
}
```

By default:

```text
Google Meet = enabled
```

If attendees are provided, Google Calendar sends invitations.

Example:

```text
Schedule a meeting with Alice tomorrow at 3 PM for 30 minutes.
```

The agent can:

1. Determine the requested time.
2. Create the calendar event.
3. Add attendees.
4. Generate a Google Meet link.
5. Return the created meeting information.

---

## `rescheduleMeeting`

Moves an existing calendar event.

Parameters:

```typescript
{
  eventId: string;
  startIso: string;
  endIso: string;
}
```

Google Calendar attendees receive an update.

---

## `cancelMeeting`

Cancels an existing calendar event.

Parameters:

```typescript
{
  eventId: string;
}
```

Calendar attendees receive the cancellation.

---

# 7. Google Calendar Integration

Google Calendar operations are centralized in:

```text
src/services/calendar.service.ts
```

The service creates a Google Calendar API client using an access token.

The backend supports:

```text
List events
Create events
Update events
Delete events
FreeBusy queries
Google Meet generation
Attendee invitations
```

The calendar connection itself is handled separately through:

```text
src/services/connection.service.ts
```

while token retrieval is handled by:

```text
src/services/token.service.ts
```

This separation keeps:

```text
Authentication
Connection management
Token management
Calendar operations
```

as separate concerns.

---

# 8. Descope Calendar Connection

Descope is used not only for authentication but also for the Google Calendar outbound connection.

The configured connection is:

```env
DESCOPE_CALENDAR_CONNECTION_ID=google-calendar
```

The connection flow is:

```text
User
  │
  ▼
Backend
  │
  ▼
Descope Outbound Connection
  │
  ▼
Google Calendar
```

Connection status is persisted in PostgreSQL.

Possible states:

```text
pending
connected
disconnected
```

---

# 9. Mastra Memory

The AI assistant uses persistent Mastra memory.

Storage:

```text
mastra.db
```

The memory system stores conversation history and working memory.

The agent keeps the latest:

```text
20 messages
```

Working memory is scoped to the user/resource.

Current preferences include:

```text
Timezone
Default meeting length
Preferred meeting hours
Usual invitees
Notes
```

This allows the assistant to remember user preferences between conversations.

For example, if a user says:

```text
I usually schedule meetings for 45 minutes.
```

the assistant can retain that preference.

---

# 10. Thread-Based Conversations

Every conversation is associated with a thread.

A thread contains:

```text
Thread ID
User/resource ID
Messages
Title
Updated timestamp
```

The backend provides endpoints to:

* List threads
* Retrieve thread messages
* Stream new assistant responses

Threads are scoped to the authenticated user.

This prevents one user from accessing another user's conversation history.

---

# API

Base URL:

```text
http://localhost:4001
```

---

## Health Check

### `GET /health`

Checks whether the backend can communicate with PostgreSQL.

Example response:

```json
{
  "status": "success",
  "message": "Server is running",
  "code": 200
}
```

---

# Connection API

All connection endpoints require authentication.

```text
Authorization: Bearer <token>
```

## Get Connection

```http
GET /api/connections/
```

Example response:

```json
{
  "connection": {
    "label": "Google Calendar",
    "status": "connected"
  }
}
```

---

## Start Calendar Connection

```http
POST /api/connections/connect
```

Request:

```json
{
  "refreshToken": "<descope-refresh-token>",
  "redirectUrl": "http://localhost:3000/dashboard"
}
```

Response:

```json
{
  "url": "<connection-url>"
}
```

The frontend can redirect the user to this URL to connect Google Calendar.

---

## Refresh Connection Status

```http
POST /api/connections/refresh-status
```

Example response:

```json
{
  "connection": {
    "label": "Google Calendar",
    "status": "connected"
  }
}
```

---

# Agent API

All agent endpoints require authentication.

---

## List Threads

```http
GET /api/agent/threads
```

Example:

```json
{
  "threads": [
    {
      "id": "thread-id",
      "title": "Schedule team meeting",
      "updatedAt": "2026-08-22T15:00:00.000Z"
    }
  ]
}
```

---

## Get Thread Messages

```http
GET /api/agent/threads/:threadId
```

Example:

```json
{
  "threadId": "thread-id",
  "messages": [
    {
      "id": "message-id",
      "role": "user",
      "content": "What's on my calendar today?"
    },
    {
      "id": "message-id-2",
      "role": "assistant",
      "content": "You have two meetings today."
    }
  ]
}
```

---

# Streaming Chat

## `POST /api/agent/chat`

The AI response is streamed using **Server-Sent Events (SSE)**.

Request:

```json
{
  "message": "What's on my calendar today?",
  "threadId": "thread-uuid"
}
```

Response content type:

```text
text/event-stream
```

The server emits events such as:

### Started

```json
{
  "type": "started",
  "message": "Agent is planning"
}
```

### Tool progress

```json
{
  "type": "progress",
  "message": "Running listUpcomingMeetings"
}
```

### Token

```json
{
  "type": "token",
  "token": "You have "
}
```

### Completed

```json
{
  "type": "completed",
  "message": "done"
}
```

### Error

```json
{
  "type": "error",
  "message": "..."
}
```

---

# Request Flow

A typical AI calendar request works like this:

```text
User
 │
 │ "Schedule a meeting tomorrow at 3 PM"
 ▼
Next.js Frontend
 │
 │ POST /api/agent/chat
 ▼
Express
 │
 ▼
requireSession
 │
 │ Validate Descope session
 ▼
Agent Service
 │
 ▼
Mastra Agent
 │
 ▼
Gemini
 │
 │ Decide which tool to use
 ▼
createMeeting()
 │
 ▼
Token Service
 │
 ▼
Descope
 │
 ▼
Google Calendar API
 │
 ▼
Calendar Event Created
 │
 ▼
Mastra
 │
 │ Stream response
 ▼
SSE
 │
 ▼
Next.js UI
```

---

# Environment Variables

Create a `.env` file in the backend directory.

Example:

```env
PORT=4001

APP_URL=http://localhost:3000

DATABASE_URL=postgresql://username:password@localhost:5432/agentic_calendar

DESCOPE_PROJECT_ID=your_descope_project_id

DESCOPE_MANAGEMENT_KEY=your_descope_management_key

DESCOPE_CALENDAR_CONNECTION_ID=google-calendar

GOOGLE_API_KEY=your_google_api_key

AI_MODEL=gemini-3.6-flash
```

Never commit `.env` to Git.

Use:

```text
.env.example
```

for sharing required configuration names.

---

# Installation

From the backend directory:

```bash
npm install
```

---

# Database Setup

Make sure PostgreSQL is running and `DATABASE_URL` is configured.

Run:

```bash
npm run migrate
```

This creates:

```text
users
connections
```

tables.

---

# Development

Start the backend in development mode:

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:4001
```

Health check:

```text
GET http://localhost:4001/health
```

---

# Production Build

Build the TypeScript project:

```bash
npm run build
```

Start the compiled backend:

```bash
npm start
```

---

# Security

The backend follows several security principles:

### Authentication

All calendar and agent APIs require a valid Descope session.

### User Isolation

Thread memory and calendar access are scoped using the authenticated user's ID.

### Token Handling

Google Calendar access tokens are retrieved server-side.

The frontend should never directly receive or persist Google Calendar access tokens.

### Input Validation

Agent requests and tool inputs are validated using Zod.

### Environment Secrets

API keys, database credentials, and Descope management credentials are loaded from environment variables.

---

# Error Handling

The API returns HTTP status codes for common failures.

```text
400 → Invalid request
401 → Unauthorized / expired session
500 → Internal server error
```

Agent errors are streamed through SSE:

```json
{
  "type": "error",
  "message": "..."
}
```

---

# Design Principles

The backend is organized using a service-oriented structure:

```text
Routes
  ↓
Middleware
  ↓
Services
  ↓
Repositories / External APIs
```

### Routes

Responsible for HTTP handling.

### Middleware

Responsible for authentication and request context.

### Services

Contain business logic.

### Repositories

Handle PostgreSQL persistence.

### Configuration

Contains external service configuration and AI instructions.

This separation makes the backend easier to extend and test.

---

# Current Features

* [x] Descope authentication
* [x] PostgreSQL user persistence
* [x] Google Calendar connection
* [x] Google Calendar access token retrieval
* [x] List upcoming meetings
* [x] Today's agenda
* [x] Calendar FreeBusy
* [x] Create meetings
* [x] Google Meet generation
* [x] Attendee invitations
* [x] Reschedule meetings
* [x] Cancel meetings
* [x] Gemini-powered AI agent
* [x] Mastra agent framework
* [x] Mastra persistent memory
* [x] Thread-based conversations
* [x] SSE response streaming
* [x] Working memory for meeting preferences
* [x] Zod validation

---

# Development Philosophy

The project is designed around the idea of an **agentic calendar assistant** rather than a traditional CRUD calendar application.

Instead of requiring the user to manually perform every calendar operation, the user communicates with an AI agent using natural language.

For example:

```text
"Am I free tomorrow afternoon?"

        ↓

Gemini understands intent

        ↓

checkCalendarBusy()

        ↓

Google Calendar FreeBusy API

        ↓

Agent interprets result

        ↓

Natural language response
```

For a scheduling request:

```text
"Schedule a 30 minute meeting with
alice@example.com tomorrow at 3 PM"

        ↓

Gemini
        ↓
createMeeting()
        ↓
Descope Calendar Connection
        ↓
Google Calendar API
        ↓
Google Meet + invitation
        ↓
Streaming response to frontend
```

This architecture allows additional tools to be added without changing the core chat system.

---

# License

This project is currently intended as a personal/portfolio project.

Add the appropriate license here before public distribution.
