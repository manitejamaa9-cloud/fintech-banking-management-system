import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load server/.env regardless of the current working directory so that
// start scripts invoked from the repository root behave identically.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

const env = process.env;
const isProduction = env.NODE_ENV === 'production';

const jwtSecret = env.JWT_SECRET;
if (!jwtSecret || jwtSecret.trim().length < 16) {
  throw new Error(
    'JWT_SECRET is missing or too short. Add a strong value (16+ characters) to server/.env.\n' +
      'See .env.example for the required variables.'
  );
}

const pg = {
  host: env.PGHOST || 'localhost',
  port: Number(env.PGPORT || 5432),
  database: env.PGDATABASE || 'fintech_banking',
  user: env.PGUSER || 'postgres',
  password: env.PGPASSWORD || '',
};

const config = {
  env: env.NODE_ENV || 'development',
  isProduction,
  port: Number(env.PORT || 5000),

  jwtSecret,
  jwtExpires: env.JWT_EXPIRES || '8h',

  demoOtp: env.DEMO_OTP || '123456',

  databaseUrl: env.DATABASE_URL || '',
  pg,

  // Seed the demo dataset automatically when the database is completely empty.
  // Set AUTO_SEED=false to manage data manually.
  autoSeed: env.AUTO_SEED !== 'false',

  clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',

  // Only surfaces "demo data" labels in the UI; never grants extra access.
  demoMode: env.DEMO_MODE !== 'false',
};

export default config;
