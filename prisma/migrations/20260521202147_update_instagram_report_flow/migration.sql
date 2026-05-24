/*
  Warnings:

  - You are about to drop the column `totalLikes` on the `InstagramWeeklyReport` table. All the data in the column will be lost.
  - You are about to drop the column `totalViews` on the `InstagramWeeklyReport` table. All the data in the column will be lost.
  - You are about to drop the column `videosCount` on the `InstagramWeeklyReport` table. All the data in the column will be lost.
  - Added the required column `currentTotalLikes` to the `InstagramWeeklyReport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currentTotalViews` to the `InstagramWeeklyReport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `currentVideosCount` to the `InstagramWeeklyReport` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "InstagramWeeklyReport" DROP COLUMN "totalLikes",
DROP COLUMN "totalViews",
DROP COLUMN "videosCount",
ADD COLUMN     "currentTotalLikes" INTEGER NOT NULL,
ADD COLUMN     "currentTotalViews" INTEGER NOT NULL,
ADD COLUMN     "currentVideosCount" INTEGER NOT NULL,
ADD COLUMN     "likesDelta" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rejectReason" TEXT,
ADD COLUMN     "videosDelta" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "viewsDelta" INTEGER NOT NULL DEFAULT 0;
