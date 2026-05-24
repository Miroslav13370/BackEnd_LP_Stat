-- CreateEnum
CREATE TYPE "InstagramReportPeriodType" AS ENUM ('CUSTOM', 'WEEK', 'ALL_TIME');

-- AlterTable
ALTER TABLE "InstagramWeeklyReport" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "periodType" "InstagramReportPeriodType" NOT NULL DEFAULT 'WEEK',
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "videosOver1000" JSONB,
ADD COLUMN     "videosOver1000Count" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "weekStartDate" DROP NOT NULL,
ALTER COLUMN "weekEndDate" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "InstagramWeeklyReport_periodType_idx" ON "InstagramWeeklyReport"("periodType");
