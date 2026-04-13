-- CreateTable
CREATE TABLE "AppSetting" (
    "id" SERIAL NOT NULL,
    "useNewConfirmationForm" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);
