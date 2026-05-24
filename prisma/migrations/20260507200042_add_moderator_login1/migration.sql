/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_moderatorId_fkey";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "TikTokUser" (
    "id" TEXT NOT NULL,
    "tiktok_open_id" TEXT NOT NULL,
    "tiktok_username" TEXT,
    "tiktok_display_name" TEXT,
    "tiktok_avatar_url" TEXT,
    "access_token" TEXT NOT NULL,
    "access_expires_in" INTEGER NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "refresh_expires_in" INTEGER NOT NULL,
    "moderatorId" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TikTokUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TikTokUser_tiktok_open_id_key" ON "TikTokUser"("tiktok_open_id");

-- AddForeignKey
ALTER TABLE "TikTokUser" ADD CONSTRAINT "TikTokUser_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "Moderator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
