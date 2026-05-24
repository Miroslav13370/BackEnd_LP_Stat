-- CreateTable
CREATE TABLE "YouTubeUser" (
    "id" TEXT NOT NULL,
    "google_sub" TEXT NOT NULL,
    "youtube_channel_id" TEXT NOT NULL,
    "isUpdate" BOOLEAN NOT NULL DEFAULT false,
    "access_token" TEXT NOT NULL,
    "access_expires_in" INTEGER NOT NULL,
    "access_expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_token" TEXT,
    "refresh_expires_at" TIMESTAMP(3),
    "youtube_title" TEXT,
    "youtube_description" TEXT,
    "youtube_custom_url" TEXT,
    "youtube_thumbnail_url" TEXT,
    "isAuthorContent" BOOLEAN NOT NULL DEFAULT false,
    "planTarget" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "moderatorId" TEXT,

    CONSTRAINT "YouTubeUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeUser_google_sub_key" ON "YouTubeUser"("google_sub");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeUser_youtube_channel_id_key" ON "YouTubeUser"("youtube_channel_id");

-- AddForeignKey
ALTER TABLE "YouTubeUser" ADD CONSTRAINT "YouTubeUser_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "Moderator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
