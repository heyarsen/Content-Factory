-- CreateTable
CREATE TABLE "social_accounts" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "username" TEXT,
    "profileImage" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "isConnected" BOOLEAN NOT NULL DEFAULT true,
    "uploadPostProfileId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_userId_workspaceId_platform_key" ON "social_accounts"("userId", "workspaceId", "platform");

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add new platform enum values
ALTER TYPE "Platform" ADD VALUE 'THREADS';

-- Add new notification type enum values
ALTER TYPE "NotificationType" ADD VALUE 'SOCIAL_ACCOUNT_CONNECTED';
ALTER TYPE "NotificationType" ADD VALUE 'SOCIAL_ACCOUNT_DISCONNECTED';