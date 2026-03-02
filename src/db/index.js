const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log(`Successfully connected to PostgreSQL database`);
    client.release();
  } catch (err) {
    console.error('Error connecting to PostgreSQL database:', err.message);
    process.exit(1);
  }
};

module.exports = {
  pool,
  connectDB,
  query: (text, params) => pool.query(text, params),
};
