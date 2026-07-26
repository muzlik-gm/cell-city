"use client";

import { useAppStore } from "@/lib/store";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sidebar } from "@/components/sidebar";

export function MobileNav() {
  const { mobileNavOpen, setMobileNavOpen } = useAppStore();
  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent side="left" className="w-[280px] p-0">
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
}
