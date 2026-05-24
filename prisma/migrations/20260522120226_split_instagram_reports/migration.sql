/*
  Warnings:

  - You are about to drop the `InstagramWeeklyReport` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "InstagramReportPeriodType" ADD VALUE 'MONTH';

-- DropForeignKey
ALTER TABLE "InstagramWeeklyReport" DROP CONSTRAINT "InstagramWeeklyReport_instagramAccountId_fkey";

-- DropForeignKey
ALTER TABLE "InstagramWeeklyReport" DROP CONSTRAINT "InstagramWeeklyReport_verifiedByModeratorId_fkey";

-- DropTable
DROP TABLE "InstagramWeeklyReport";

-- CreateTable
CREATE TABLE "InstagramMetricsReport" (
    "id" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "periodType" "InstagramReportPeriodType" NOT NULL DEFAULT 'WEEK',
    "weekStartDate" TIMESTAMP(3),
    "weekEndDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "currentTotalViews" INTEGER NOT NULL,
    "currentTotalLikes" INTEGER NOT NULL,
    "currentVideosCount" INTEGER NOT NULL,
    "viewsDelta" INTEGER NOT NULL DEFAULT 0,
    "likesDelta" INTEGER NOT NULL DEFAULT 0,
    "videosDelta" INTEGER NOT NULL DEFAULT 0,
    "status" "InstagramReportStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "verifiedByModeratorId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramMetricsReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramViralVideosReport" (
    "id" TEXT NOT NULL,
    "instagramAccountId" TEXT NOT NULL,
    "periodType" "InstagramReportPeriodType" NOT NULL DEFAULT 'MONTH',
    "weekStartDate" TIMESTAMP(3),
    "weekEndDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "videosCount" INTEGER NOT NULL DEFAULT 0,
    "videos" JSONB NOT NULL,
    "status" "InstagramReportStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "verifiedByModeratorId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramViralVideosReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstagramMetricsReport_instagramAccountId_idx" ON "InstagramMetricsReport"("instagramAccountId");

-- CreateIndex
CREATE INDEX "InstagramMetricsReport_status_idx" ON "InstagramMetricsReport"("status");

-- CreateIndex
CREATE INDEX "InstagramMetricsReport_verifiedByModeratorId_idx" ON "InstagramMetricsReport"("verifiedByModeratorId");

-- CreateIndex
CREATE INDEX "InstagramMetricsReport_periodType_idx" ON "InstagramMetricsReport"("periodType");

-- CreateIndex
CREATE INDEX "InstagramMetricsReport_startDate_endDate_idx" ON "InstagramMetricsReport"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramMetricsReport_instagramAccountId_periodType_weekSt_key" ON "InstagramMetricsReport"("instagramAccountId", "periodType", "weekStartDate", "weekEndDate");

-- CreateIndex
CREATE INDEX "InstagramViralVideosReport_instagramAccountId_idx" ON "InstagramViralVideosReport"("instagramAccountId");

-- CreateIndex
CREATE INDEX "InstagramViralVideosReport_status_idx" ON "InstagramViralVideosReport"("status");

-- CreateIndex
CREATE INDEX "InstagramViralVideosReport_verifiedByModeratorId_idx" ON "InstagramViralVideosReport"("verifiedByModeratorId");

-- CreateIndex
CREATE INDEX "InstagramViralVideosReport_periodType_idx" ON "InstagramViralVideosReport"("periodType");

-- CreateIndex
CREATE INDEX "InstagramViralVideosReport_startDate_endDate_idx" ON "InstagramViralVideosReport"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramViralVideosReport_instagramAccountId_periodType_we_key" ON "InstagramViralVideosReport"("instagramAccountId", "periodType", "weekStartDate", "weekEndDate");

-- AddForeignKey
ALTER TABLE "InstagramMetricsReport" ADD CONSTRAINT "InstagramMetricsReport_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramMetricsReport" ADD CONSTRAINT "InstagramMetricsReport_verifiedByModeratorId_fkey" FOREIGN KEY ("verifiedByModeratorId") REFERENCES "Moderator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramViralVideosReport" ADD CONSTRAINT "InstagramViralVideosReport_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramViralVideosReport" ADD CONSTRAINT "InstagramViralVideosReport_verifiedByModeratorId_fkey" FOREIGN KEY ("verifiedByModeratorId") REFERENCES "Moderator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
