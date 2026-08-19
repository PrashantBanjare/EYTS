-- AlterEnum
ALTER TYPE "CommissionType" ADD VALUE 'TASK_PENALTY';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "taskDeadline" TIMESTAMP(3),
ADD COLUMN     "taskStartAt" TIMESTAMP(3),
ADD COLUMN     "taskTarget" INTEGER;
