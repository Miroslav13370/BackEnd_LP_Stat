-- AlterEnum
ALTER TYPE "InstagramReportStatus" ADD VALUE 'DRAFT';

-- CreateIndex
CREATE INDEX "InstagramAccount_editorId_idx" ON "InstagramAccount"("editorId");

-- CreateIndex
CREATE INDEX "InstagramAccount_moderatorId_idx" ON "InstagramAccount"("moderatorId");

-- CreateIndex
CREATE INDEX "InstagramWeeklyReport_instagramAccountId_idx" ON "InstagramWeeklyReport"("instagramAccountId");

-- CreateIndex
CREATE INDEX "InstagramWeeklyReport_status_idx" ON "InstagramWeeklyReport"("status");

-- CreateIndex
CREATE INDEX "InstagramWeeklyReport_verifiedByModeratorId_idx" ON "InstagramWeeklyReport"("verifiedByModeratorId");
