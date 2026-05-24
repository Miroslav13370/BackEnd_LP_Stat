/*
  Warnings:

  - You are about to drop the column `topVideoLikes` on the `InstagramWeeklyReport` table. All the data in the column will be lost.
  - You are about to drop the column `topVideoUrl` on the `InstagramWeeklyReport` table. All the data in the column will be lost.
  - You are about to drop the column `topVideoViews` on the `InstagramWeeklyReport` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "InstagramWeeklyReport" DROP COLUMN "topVideoLikes",
DROP COLUMN "topVideoUrl",
DROP COLUMN "topVideoViews";

-- CreateIndex
CREATE INDEX "InstagramWeeklyReport_startDate_endDate_idx" ON "InstagramWeeklyReport"("startDate", "endDate");
