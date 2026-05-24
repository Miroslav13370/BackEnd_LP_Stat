/*
  Warnings:

  - Added the required column `tiktok_open_id` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tiktok_open_id" TEXT NOT NULL;
