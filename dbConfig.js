require('dotenv').config();

const {Pool} = require('pg'); // import the PostgreSQL client library

const isProduction = process.env.NODE_ENV === 'production';

const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`

const pool = new Pool({
    connectionString: isProduction ? process.env.DATABASE_URL : connectionString
}); // initialize a pool using the environment configuration

module.exports = { pool };
