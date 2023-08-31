# CS-375-Uno
Web-based UNO Game Implementation
---

## Requirements

- Node.JS v20.5
- PostgreSQL v15.4

## Running

0. Clone repository to folder of your choice, and navigate to it
1. Once PostgreSQL instance is configured, run `psql -a -f setup.sql`
2. Run `npm i` to install dependencies
3. Copy `.env.example` to `.env` and fill in values from PostgreSQL
4. Run server with `npm run start`
5. Navigate to http://localhost:3000
6. Enjoy!