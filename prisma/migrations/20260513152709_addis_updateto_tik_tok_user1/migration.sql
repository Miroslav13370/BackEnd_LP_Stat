-- AlterTable
ALTER TABLE "TikTokUser" ADD COLUMN     "access_expires_at" TIMESTAMP(3),
ADD COLUMN     "refresh_expires_at" TIMESTAMP(3);
