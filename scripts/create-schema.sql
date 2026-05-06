-- Create schema for Omnysync project
CREATE SCHEMA IF NOT EXISTS omnysync;

-- Grant all privileges on schema to dev user
GRANT ALL ON SCHEMA omnysync TO dev;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA omnysync TO dev;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA omnysync TO dev;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA omnysync GRANT ALL ON TABLES TO dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA omnysync GRANT ALL ON SEQUENCES TO dev;