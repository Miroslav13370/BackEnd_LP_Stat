-- CreateTable
CREATE TABLE "InstagramUser" (
    "id" TEXT NOT NULL,
    "facebook_user_id" TEXT,
    "facebook_page_id" TEXT,
    "instagram_account_id" TEXT NOT NULL,
    "isUpdate" BOOLEAN NOT NULL DEFAULT false,
    "access_token" TEXT NOT NULL,
    "access_expires_in" INTEGER,
    "access_expires_at" TIMESTAMP(3),
    "instagram_username" TEXT,
    "instagram_name" TEXT,
    "instagram_biography" TEXT,
    "instagram_profile_picture_url" TEXT,
    "followers_count" INTEGER NOT NULL DEFAULT 0,
    "follows_count" INTEGER NOT NULL DEFAULT 0,
    "media_count" INTEGER NOT NULL DEFAULT 0,
    "isAuthorContent" BOOLEAN NOT NULL DEFAULT false,
    "planTarget" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "moderatorId" TEXT,

    CONSTRAINT "InstagramUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstagramUser_instagram_account_id_key" ON "InstagramUser"("instagram_account_id");

-- AddForeignKey
ALTER TABLE "InstagramUser" ADD CONSTRAINT "InstagramUser_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "Moderator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
