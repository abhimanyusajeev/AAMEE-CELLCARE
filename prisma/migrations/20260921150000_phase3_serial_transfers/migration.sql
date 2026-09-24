-- Phase 3: link stock transfer items to physical serialized mobile devices.
-- Apply this migration only against a database that already contains the Phase 1/2 tables.
ALTER TABLE "StockTransferItem" ADD COLUMN IF NOT EXISTS "serialDeviceId" TEXT;
CREATE INDEX IF NOT EXISTS "StockTransferItem_serialDeviceId_idx" ON "StockTransferItem"("serialDeviceId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockTransferItem_serialDeviceId_fkey'
  ) THEN
    ALTER TABLE "StockTransferItem"
      ADD CONSTRAINT "StockTransferItem_serialDeviceId_fkey"
      FOREIGN KEY ("serialDeviceId") REFERENCES "SerialDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
