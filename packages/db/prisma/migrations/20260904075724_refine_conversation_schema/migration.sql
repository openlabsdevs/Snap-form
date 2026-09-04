/*
  Warnings:

  - A unique constraint covering the columns `[conversationId,version]` on the table `form_versions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[conversationId,sequence]` on the table `messages` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sequence` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "form_versions" DROP CONSTRAINT "form_versions_formId_fkey";

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "sequence" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "form_versions_conversationId_version_key" ON "form_versions"("conversationId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversationId_sequence_key" ON "messages"("conversationId", "sequence");

-- AddForeignKey
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_formId_fkey" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
