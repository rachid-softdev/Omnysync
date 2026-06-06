-- Create UserRole table
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- Copy existing role data to UserRole
INSERT INTO "UserRole" ("id", "userId", "role")
SELECT gen_random_uuid()::text, "id", "role"
FROM "User";

-- Add unique constraint
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- Add index
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- Add foreign key
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
