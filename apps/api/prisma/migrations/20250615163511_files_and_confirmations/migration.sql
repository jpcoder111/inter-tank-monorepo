-- CreateTable
CREATE TABLE "File" (
    "id" SERIAL NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "r2Key" TEXT NOT NULL,
    "publicUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Confirmation" (
    "id" SERIAL NOT NULL,
    "inputFileId" INTEGER NOT NULL,
    "outputFileId" INTEGER,
    "shipper" TEXT NOT NULL,
    "importer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Confirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "File_r2Key_key" ON "File"("r2Key");

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_inputFileId_fkey" FOREIGN KEY ("inputFileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Confirmation" ADD CONSTRAINT "Confirmation_outputFileId_fkey" FOREIGN KEY ("outputFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
