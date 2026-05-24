/*
  Warnings:

  - You are about to drop the column `moderatorLogin` on the `Moderator` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[login]` on the table `Moderator` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `login` to the `Moderator` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Moderator_moderatorLogin_key";

-- AlterTable
ALTER TABLE "Moderator" DROP COLUMN "moderatorLogin",
ADD COLUMN     "login" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Moderator_login_key" ON "Moderator"("login");
