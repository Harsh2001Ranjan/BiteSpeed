require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

const migrationsDir = path.join(__dirname, 'migrations');

const runMigrations = async () => {
  const client = await pool.connect();
  try {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log(`Running migration: ${file}`);
      await client.query(sql);
      console.log(`Completed: ${file}`);
    }

    console.log('All migrations ran successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

runMigrations();
