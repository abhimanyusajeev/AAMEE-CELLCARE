"use client";

import { useEffect } from "react";

export default function PrintJobSheetButton() {
  useEffect(() => {
    // The user triggers printing manually; don't auto-open the print dialog.
  }, []);
  return <button type="button" onClick={() => window.print()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white print:hidden">Print Job Sheet</button>;
}
