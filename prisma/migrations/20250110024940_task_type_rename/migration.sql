/*
  Warnings:

  - You are about to drop the column `type` on the `SheetColumn` table. All the data in the column will be lost.
  - Added the required column `taskType` to the `SheetColumn` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SheetColumn" DROP COLUMN "type",
ADD COLUMN     "taskType" "ColumnTaskType" NOT NULL;
