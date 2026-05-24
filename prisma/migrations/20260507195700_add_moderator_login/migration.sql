/*
  Warnings:

  - Added the required column `moderatorLogin` to the `Moderator` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Moderator" ADD COLUMN     "moderatorLogin" TEXT NOT NULL;
