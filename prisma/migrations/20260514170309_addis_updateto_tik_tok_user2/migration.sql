/*
  Warnings:

  - Made the column `access_expires_at` on table `TikTokUser` required. This step will fail if there are existing NULL values in that column.
  - Made the column `refresh_expires_at` on table `TikTokUser` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "TikTokUser" ADD COLUMN     "isAuthorContent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "planTarget" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "access_expires_at" SET NOT NULL,
ALTER COLUMN "refresh_expires_at" SET NOT NULL;
