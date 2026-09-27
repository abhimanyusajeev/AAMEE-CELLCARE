-- Repair Centre upgrade: inspection, accessories and repair invoices.
CREATE TABLE "RepairInspection" (
    "id" TEXT NOT NULL,
    "repairJobId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RepairInspection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RepairAccessory" (
    "id" TEXT NOT NULL,
    "repairJobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RepairAccessory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RepairInvoice" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "repairJobId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RepairInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RepairInspection_repairJobId_item_key" ON "RepairInspection"("repairJobId", "item");
CREATE INDEX "RepairInspection_repairJobId_idx" ON "RepairInspection"("repairJobId");
CREATE INDEX "RepairAccessory_repairJobId_idx" ON "RepairAccessory"("repairJobId");
CREATE UNIQUE INDEX "RepairInvoice_repairJobId_key" ON "RepairInvoice"("repairJobId");
CREATE UNIQUE INDEX "RepairInvoice_branchId_invoiceNumber_key" ON "RepairInvoice"("branchId", "invoiceNumber");
CREATE INDEX "RepairInvoice_branchId_issuedAt_idx" ON "RepairInvoice"("branchId", "issuedAt");

ALTER TABLE "RepairInspection" ADD CONSTRAINT "RepairInspection_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepairAccessory" ADD CONSTRAINT "RepairAccessory_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepairInvoice" ADD CONSTRAINT "RepairInvoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepairInvoice" ADD CONSTRAINT "RepairInvoice_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
