-- CreateEnum
CREATE TYPE "InstagramReportStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "InstagramEditor" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramEditor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramAccount" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "accountUrl" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "isAuthorContent" BOOLEAN NOT NULL DEFAULT false,
    "planTarget" INTEGER NOT NULL DEFAULT 0,
    "moderatorId" TEXT,
    "editorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramWeeklyReport" (
    "id" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekEndDate" TIMESTAMP(3) NOT NULL,
    "totalViews" INTEGER NOT NULL,
    "totalLikes" INTEGER NOT NULL,
    "videosCount" INTEGER NOT NULL,
    "topVideoUrl" TEXT NOT NULL,
    "topVideoViews" INTEGER NOT NULL,
    "topVideoLikes" INTEGER NOT NULL,
    "status" "InstagramReportStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedByModeratorId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramWeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstagramEditor_login_key" ON "InstagramEditor"("login");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAccount_username_key" ON "InstagramAccount"("username");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramWeeklyReport_instagramAccountId_weekStartDate_week_key" ON "InstagramWeeklyReport"("instagramAccountId", "weekStartDate", "weekEndDate");

-- AddForeignKey
ALTER TABLE "InstagramAccount" ADD CONSTRAINT "InstagramAccount_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "Moderator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramAccount" ADD CONSTRAINT "InstagramAccount_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "InstagramEditor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramWeeklyReport" ADD CONSTRAINT "InstagramWeeklyReport_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramWeeklyReport" ADD CONSTRAINT "InstagramWeeklyReport_verifiedByModeratorId_fkey" FOREIGN KEY ("verifiedByModeratorId") REFERENCES "Moderator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
