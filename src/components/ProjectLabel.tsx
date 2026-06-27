import { AnimatePresence, motion } from "framer-motion";
import { useProjectStore } from "@/projects/projectStore";

export function ProjectLabel() {
  const activeId = useProjectStore((s) => s.activeProjectId);
  const name     = useProjectStore((s) => s.projects[s.activeProjectId]?.name ?? "");

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeId}
        className="pointer-events-none fixed left-4 top-4 z-[3000]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <span
          className="font-mono"
          style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.05em" }}
        >
          {name}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
