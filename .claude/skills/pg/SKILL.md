---
description: Query the local PostgreSQL database
user_invocable: true
---

# pg — Local Database Query

Run SQL queries against the local Postgres dev database from natural language or raw SQL.

## Connection (hardcoded)

```
Host:     localhost
Port:     5434
Database: nest
User:     postgres
Password: 123
```

## Steps

### 1. Understand the request

The user describes what they want in plain English (e.g. "show me all users", "count confirmations by shipper"). Your job:

1. If unsure of column names, inspect the table first: `psql "postgresql://postgres:123@localhost:5434/nest" -c "\d \"<Table>\""` (Prisma uses quoted PascalCase table names — e.g. `"User"`, `"File"`, `"Confirmation"`).
2. Build the SQL from the description.
3. If the user passes raw SQL, run it as-is.

### 2. Run the query

```
psql "postgresql://postgres:123@localhost:5434/nest" -c "<SQL>"
```

### 3. Present results

Show the output clearly. If the result set is large, summarize key findings.

## Rules

- Always add `LIMIT` to open-ended SELECTs (default 50) unless the user explicitly asks for all rows.
- This is a full-access local dev database — writes are allowed. Still, confirm with the user before running destructive statements (`DROP`, `TRUNCATE`, `DELETE` without WHERE).
- Table names follow Prisma conventions: PascalCase and double-quoted in SQL (e.g. `SELECT * FROM "User"`).
- The schema is defined in `apps/api/prisma/schema.prisma` — read it if you need a refresher on the data model.
