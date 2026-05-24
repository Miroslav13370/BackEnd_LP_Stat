/*
  Warnings:

  - Added the required column `isAdmin` to the `Moderator` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Moderator" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL;
