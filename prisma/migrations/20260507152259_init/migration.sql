-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "access_expires_in" INTEGER NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "refresh_expires_in" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
