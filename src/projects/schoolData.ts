/**
 * School Data — single source of truth for the JARVIS school demo.
 *
 * Every piece of pre-authored demo content (teachers, homework, QCM questions,
 * lesson beats) lives here. Components and stores read from this file; nothing
 * is hardcoded elsewhere. See .claude/docs/SCHOOL_DATA.md for the spec.
 */

export interface Teacher {
  name: string;
  email: string;
  subject: string;
}

export type HomeworkType = "qcm" | "lesson" | "essay";

export interface QCMQuestion {
  text: string;
  imagePlaceholder?: string;
  options: string[];
  correctIndex: number;
}

export interface QCMData {
  subject: string;
  questions: QCMQuestion[];
  /** questionIndex → chosen option (0-indexed) */
  answers: Record<number, number>;
}

/** How a concept is explained — the tutor never repeats one when a student is stuck. */
export type ExplanationApproach = "visual" | "analogy" | "example" | "formal";

/** One explanation of a concept, tagged by approach. The "concept library" entry. */
export interface ConceptExplanation {
  approach: ExplanationApproach;
  /** A self-contained explanation; intro variants end on a check-in hook. */
  instruction: string;
}

/** The visual element a concept maps to on the SVG canvas. `none` = narration-only. */
export interface ConceptVisual {
  type: "draw" | "highlight" | "equation" | "none";
  svgCommand?: Record<string, unknown>;
  equation?: string;
}

/**
 * A concept in the lesson. NOT a position in a sequence — a library entry: a set of
 * available explanations (tagged by approach) plus the visual it owns. The tutor
 * selects which explanation to play per turn; the order of `concepts` only defines
 * what "the next concept" means when the student advances.
 */
export interface LessonConcept {
  /** Stable key + short human label (shown in the comprehension checklist). */
  concept: string;
  /** The approach used when this concept is first introduced. */
  introApproach: ExplanationApproach;
  /** The visual this concept lights up on the canvas. */
  visual: ConceptVisual;
  /** The available explanations for this concept, tagged by approach. */
  explanations: ConceptExplanation[];
}

export interface LessonData {
  subject: string;
  /** The concept library (ordered; order = the "advance" sequence). */
  concepts: LessonConcept[];
  /** The active concept's key — resume seed (live active concept lives in comprehension). */
  activeConceptId: string;
  /** Concepts confirmed understood — drives progress (set by the tutor, not by position). */
  confirmedConceptIds: string[];
}

export interface EssayData {
  subject: string;
  submitted: boolean;
  submittedAt?: string;
}

export type HomeworkData = QCMData | LessonData | EssayData;

export interface Homework {
  id: string;
  type: HomeworkType;
  title: string;
  dueDate: string;
  dueLabel: string;
  data: HomeworkData;
}

export interface SchoolProject {
  id: string;
  name: string;
  teacher: Teacher;
  homeworks: Homework[];
  history: Array<{ role: string; content: string }>;
  canvasState: unknown[];
  tree: unknown[];
  activeNodeId: string | null;
}

// ─── Progress Computation ───────────────────────────────────────────────────

export function computeProgress(homework: Homework): number {
  if (homework.type === "essay") {
    return (homework.data as EssayData).submitted ? 100 : 0;
  }
  if (homework.type === "qcm") {
    const d = homework.data as QCMData;
    const answered = Object.keys(d.answers).length;
    return Math.round((answered / d.questions.length) * 100);
  }
  if (homework.type === "lesson") {
    const d = homework.data as LessonData;
    if (!d.concepts.length) return 0;
    // Progress is comprehension-driven: concepts confirmed understood, not position.
    return Math.round((d.confirmedConceptIds.length / d.concepts.length) * 100);
  }
  return 0;
}

// ─── Default School Data ────────────────────────────────────────────────────

export function createDefaultSchoolData(): Record<string, SchoolProject> {
  return {
    history: {
      id: "history",
      name: "History",
      teacher: {
        name: "Ms. Martin",
        email: "s.martin@lycee-victor.fr",
        subject: "History",
      },
      homeworks: [
        {
          id: "hw-ww2-qcm",
          type: "qcm",
          title: "WW2 — QCM",
          dueDate: "today",
          dueLabel: "Today, 5pm",
          data: {
            subject: "World War 2",
            questions: [
              {
                text: "When did the First World War end?",
                options: ["1916", "1917", "1918", "1919"],
                correctIndex: 2,
              },
              {
                text: "What event is considered the immediate trigger of WW2?",
                options: [
                  "The assassination of Franz Ferdinand",
                  "The invasion of Poland",
                  "The attack on Pearl Harbor",
                  "The fall of France",
                ],
                correctIndex: 1,
              },
              {
                text: "Which alliance did Italy, Germany and Japan form?",
                options: ["The Allies", "The Entente", "The Axis", "The Central Powers"],
                correctIndex: 2,
              },
              {
                text: "Which country did Germany invade first to trigger the start of WW2?",
                imagePlaceholder: "MAP: Europe, September 1939",
                options: ["France", "Poland", "England", "Soviet Union"],
                correctIndex: 1,
              },
              {
                text: "In which year did the D-Day landings take place?",
                imagePlaceholder: "PHOTO: Allied troops, Normandy coast",
                options: ["1941", "1943", "1944", "1945"],
                correctIndex: 2,
              },
              {
                text: "Who led the United Kingdom as Prime Minister during most of WW2?",
                imagePlaceholder: "PORTRAIT: British Parliament, 1940s",
                options: [
                  "Clement Attlee",
                  "Winston Churchill",
                  "Neville Chamberlain",
                  "Anthony Eden",
                ],
                correctIndex: 1,
              },
              {
                text: "When did WW2 officially end?",
                imagePlaceholder: "PHOTO: VJ Day celebrations, 1945",
                options: ["1944", "1945", "1946", "1947"],
                correctIndex: 1,
              },
            ],
            // Questions 0-2 already answered correctly (= 43% progress, 3 of 7)
            answers: { 0: 2, 1: 1, 2: 2 },
          } as QCMData,
        },
      ],
      history: [],
      canvasState: [],
      tree: [],
      activeNodeId: null,
    },

    maths: {
      id: "maths",
      name: "Maths",
      teacher: {
        name: "Mr. Leconte",
        email: "p.leconte@lycee-victor.fr",
        subject: "Mathematics",
      },
      homeworks: [
        {
          id: "hw-pythagoras",
          type: "lesson",
          title: "Pythagoras Theorem — Lesson",
          dueDate: "tomorrow",
          dueLabel: "Tomorrow",
          data: {
            subject: "Pythagoras Theorem",
            // The active concept lives in the tutor's comprehension state at runtime;
            // this is the resume seed. No position counter — `concepts` is a library.
            activeConceptId: "right-angled triangle",
            confirmedConceptIds: [],
            // CONCEPT LIBRARY: each concept owns a visual and a set of explanations
            // tagged by approach. The first explanation (the `introApproach`) ends on
            // a check-in hook and is what plays when the concept is first introduced;
            // the others are what the tutor reaches for to reframe/deepen.
            concepts: [
              {
                concept: "right-angled triangle",
                introApproach: "visual",
                visual: {
                  type: "draw",
                  svgCommand: {
                    shape: "right-triangle",
                    vertices: { A: [15, 80], B: [80, 80], C: [80, 15] },
                    strokeColor: "rgba(255,255,255,0.85)",
                    animationMs: 700,
                    rightAngleMarker: "B",
                  },
                },
                explanations: [
                  {
                    approach: "visual",
                    instruction:
                      "Let's start simple. This is a right-angled triangle — see the little square corner? That marks the right angle. With me so far?",
                  },
                  {
                    approach: "analogy",
                    instruction:
                      "Think of the corner of a book or a window — that perfect square corner is a 'right angle'. A triangle built around one of those is a right-angled triangle.",
                  },
                  {
                    approach: "formal",
                    instruction:
                      "Precisely: a right-angled triangle has exactly one 90-degree angle — the small square at corner B marks it — and that single fact is what makes everything else work.",
                  },
                ],
              },
              {
                concept: "side a",
                introApproach: "visual",
                visual: {
                  type: "highlight",
                  svgCommand: {
                    highlightSegment: "BC",
                    glowColor: "#6366f1",
                    label: { text: "a", position: "right-of-segment", size: "normal" },
                  },
                },
                explanations: [
                  {
                    approach: "visual",
                    instruction:
                      "I'll give the sides names so we can talk about them. This shorter side, we'll call 'a'. Good?",
                  },
                  {
                    approach: "analogy",
                    instruction:
                      "The letter 'a' is just a name tag pinned to this one side — nothing more. It saves us saying 'the bottom-right side' every time.",
                  },
                  {
                    approach: "example",
                    instruction:
                      "Say this side is 3 units long — then 'a' just means 3 here. The label lets us talk about its length without redrawing it.",
                  },
                ],
              },
              {
                concept: "side b",
                introApproach: "visual",
                visual: {
                  type: "highlight",
                  svgCommand: {
                    highlightSegment: "AB",
                    glowColor: "#6366f1",
                    label: { text: "b", position: "below-segment", size: "normal" },
                  },
                },
                explanations: [
                  {
                    approach: "visual",
                    instruction: "This other short side is 'b'. Still following?",
                  },
                  {
                    approach: "analogy",
                    instruction:
                      "Same idea as before — 'b' is just a name for the second short side, the one along the bottom.",
                  },
                  {
                    approach: "formal",
                    instruction:
                      "'a' and 'b' are precisely the two sides that meet at the right angle — that's what makes them a pair: they form the square corner.",
                  },
                ],
              },
              {
                concept: "hypotenuse (c)",
                introApproach: "visual",
                visual: {
                  type: "highlight",
                  svgCommand: {
                    highlightSegment: "AC",
                    glowColor: "#f59e0b",
                    label: { text: "c", position: "left-of-segment", size: "large" },
                  },
                },
                explanations: [
                  {
                    approach: "visual",
                    instruction:
                      "This long slanted side, opposite the right angle, has a special name — the hypotenuse. We call it 'c'. Make sense?",
                  },
                  {
                    approach: "analogy",
                    instruction:
                      "The hypotenuse is just the side sitting across from the square corner, never touching it — always the longest side of the triangle.",
                  },
                  {
                    approach: "formal",
                    instruction:
                      "Formally, 'c' is the side opposite the right angle, and it's the longest because it faces the widest angle — the bigger the angle, the longer the side across from it.",
                  },
                ],
              },
              {
                concept: "the relationship",
                introApproach: "formal",
                visual: { type: "none" },
                explanations: [
                  {
                    approach: "formal",
                    instruction:
                      "Here's the heart of it: those two short sides and the long one are locked together in a fixed relationship. Ready for it?",
                  },
                  {
                    approach: "analogy",
                    instruction:
                      "Think of it like a recipe — once you fix the two short sides, the hypotenuse is decided for you. They can't just be any lengths.",
                  },
                  {
                    approach: "example",
                    instruction:
                      "This is exactly what Pythagoras discovered: a rule that holds for every right-angled triangle ever drawn, whatever its size or shape.",
                  },
                ],
              },
              {
                concept: "a² + b² = c²",
                introApproach: "formal",
                visual: { type: "equation", equation: "a² + b² = c²" },
                explanations: [
                  {
                    approach: "formal",
                    instruction:
                      "Square 'a', square 'b', add them together — and you always get 'c' squared. That's Pythagoras.",
                  },
                  {
                    approach: "analogy",
                    instruction:
                      "Squaring just means multiplying a number by itself. Do that to both short sides, add the two results, and you've got the hypotenuse squared.",
                  },
                  {
                    approach: "example",
                    instruction:
                      "If a is 3 and b is 4, then 9 plus 16 is 25 — and the square root of 25 is 5. So the hypotenuse is exactly 5; the rule lets you find a side you never measured.",
                  },
                ],
              },
            ],
          } as LessonData,
        },
      ],
      history: [],
      canvasState: [],
      tree: [],
      activeNodeId: null,
    },

    english: {
      id: "english",
      name: "English",
      teacher: {
        name: "Ms. Thompson",
        email: "a.thompson@lycee-victor.fr",
        subject: "English Literature",
      },
      homeworks: [
        {
          id: "hw-gatsby-essay",
          type: "essay",
          title: "The Great Gatsby — Essay",
          dueDate: "submitted",
          dueLabel: "Submitted ✓",
          data: {
            subject: "The Great Gatsby",
            submitted: true,
            submittedAt: "Yesterday, 11:42pm",
          } as EssayData,
        },
      ],
      history: [],
      canvasState: [],
      tree: [],
      activeNodeId: null,
    },
  };
}
