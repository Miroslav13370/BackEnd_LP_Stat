/*
  Warnings:

  - A unique constraint covering the columns `[tiktok_open_id]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "User_tiktok_open_id_key" ON "User"("tiktok_open_id");
