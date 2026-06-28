import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type Line = { id: number; text: string };

const FONT_SIZE    = 14;   // px
const LINE_HEIGHT  = 1.6;  // unitless
const PADDING_V    = 16;   // px, top and bottom each
const MAX_LINES    = 4;
// Fixed height that fits exactly MAX_LINES single-line rows (border-box).
const INNER_HEIGHT = Math.round(MAX_LINES * FONT_SIZE * LINE_HEIGHT + 2 * PADDING_V); // 122 px

// bottom = chatbox bottom-gap (32px) + chatbox height (48px) + gap (8px) = 88px
const STYLES = `
  .rb-root {
    position: fixed;
    bottom: 88px;
    left: 50%;
    width: clamp(400px, 90vw, 680px);
    z-index: 39;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    opacity: 0;
    transform: translateX(-50%) translateY(8px);
    transition: opacity 300ms ease-out, transform 300ms ease-out;
    pointer-events: none;
  }
  .rb-root.rb-visible {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
    pointer-events: auto;
  }
  .rb-inner {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: ${PADDING_V}px 20px;
    font-size: ${FONT_SIZE}px;
    color: rgba(255, 255, 255, 0.85);
    line-height: ${LINE_HEIGHT};
    height: ${INNER_HEIGHT}px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
`;

interface ResponseBoxProps {
  text: string;
  shown: boolean;
}

export function ResponseBox({ text, shown }: ResponseBoxProps) {
  const [lines, setLines] = useState<Line[]>([]);
  const lineIdRef = useRef(0);

  useEffect(() => {
    const incoming = text ? text.split("\n").filter(Boolean) : [];

    setLines(current => {
      if (!incoming.length) return [];

      let result = [...current];
      const diff = incoming.length - result.length;

      if (diff < 0) {
        // App.tsx trimmed oldest entries (overflow cap); drop them from front.
        result = result.slice(-diff);
      } else if (diff > 0) {
        // New segments arrived; append placeholder entries.
        for (let i = 0; i < diff; i++) {
          result.push({ id: lineIdRef.current++, text: "" });
        }
      }

      // After length adjustment result.length === incoming.length; sync texts.
      // Mapping is 1-to-1 because offset is always 0 after the diff correction.
      return result.map((line, i) => ({ ...line, text: incoming[i] ?? line.text }));
    });
  }, [text]);

  return (
    <>
      <style>{STYLES}</style>
      <div className={`rb-root${shown ? " rb-visible" : ""}`}>
        <div className="rb-inner">
          <AnimatePresence mode="sync">
            {lines.map(line => (
              <motion.div
                key={line.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                style={{
                  lineHeight: LINE_HEIGHT,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {line.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
