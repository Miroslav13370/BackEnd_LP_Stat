/*
  Warnings:

  - A unique constraint covering the columns `[moderatorLogin]` on the table `Moderator` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Moderator_moderatorLogin_key" ON "Moderator"("moderatorLogin");
