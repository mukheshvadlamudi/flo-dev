"use client";

import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

/** Mobile-only bar that appears once the hero form scrolls out of view. */
export function StickyMobileCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const form = document.getElementById("audit");
    if (!form) return;
    const io = new IntersectionObserver(([e]) => setShow(!e!.isIntersecting && e!.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(form);
    return () => io.disconnect();
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg/85 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
          <a href="#audit" className="flex h-12 items-center justify-center gap-2 rounded-full bg-fg text-[15px] font-medium text-bg">
            Run a free audit <ArrowRight className="size-4" />
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
