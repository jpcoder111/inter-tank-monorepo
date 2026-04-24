"use client";

import LocalStandardSection from "./LocalStandardSection";
import LocalExceptionsSection from "./LocalExceptionsSection";

export default function LocalChargesTab() {
  return (
    <div className="flex flex-col gap-6">
      <LocalStandardSection />
      <LocalExceptionsSection />
    </div>
  );
}
