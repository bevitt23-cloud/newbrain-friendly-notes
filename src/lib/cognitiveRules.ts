// ─── Cognitive Profile Rules Engine ─────────────────────────
// Maps wizard answers → traits → tools/settings/AI prompts

export type CognitiveTrait =
  | "dyslexia"
  | "adhd"
  | "asd"
  | "dyscalculia"
  | "dysgraphia_motor"
  | "dysgraphia_expression"
  | "working_memory"
  | "ef_planning"
  | "dopamine_regulation"
  | "rsd"
  | "interest_based"
  | "cognitive_burnout"
  | "high_cognitive_load"
  | "sensory_hypo"
  | "visual_spatial"
  | "systems_analytical"
  | "strict_procedural";

// ─── Question definitions ───────────────────────────────────
export interface WizardOption {
  label: string;
  description: string;
  traits: CognitiveTrait[];
}

export interface WizardQuestion {
  id: string;
  section: string;
  sectionIcon: string;
  question: string;
  options: WizardOption[];
}

export const WIZARD_QUESTIONS: WizardQuestion[] = [
  {
    id: "q1_text_reaction",
    section: "Input & Decoding",
    sectionIcon: "📥",
    question: "When faced with a long, dense wall of text, what is your immediate reaction?",
    options: [
      { label: "I read it top-to-bottom without much issue", description: "Text processing feels natural", traits: [] },
      { label: "Words blur or I re-read sentences to catch meaning", description: "Decoding takes extra effort", traits: ["dyslexia"] },
      { label: "I skim, jump around, and often miss key details", description: "Sustained attention is the challenge", traits: ["adhd"] },
      { label: "I feel instantly overwhelmed and look for audio/video instead", description: "Heavy cognitive load from text", traits: ["high_cognitive_load"] },
    ],
  },
  {
    id: "q2_environment",
    section: "Input & Decoding",
    sectionIcon: "📥",
    question: "How does your physical environment affect your focus?",
    options: [
      { label: "I can tune out most background noise", description: "Environment doesn't impact much", traits: [] },
      { label: "I need absolute silence and a clean visual space", description: "Sensory overload shuts down focus", traits: ["asd"] },
      { label: "I need background noise or movement to stay locked in", description: "Stimulation helps activation", traits: ["adhd", "sensory_hypo"] },
    ],
  },
  {
    id: "q3_numbers",
    section: "Input & Decoding",
    sectionIcon: "📥",
    question: "When a topic involves numbers, statistics, or timelines, how does your brain handle it?",
    options: [
      { label: "I can read and interpret data easily", description: "Numerical reasoning is fine", traits: [] },
      { label: "Numbers 'float' or get jumbled; stats feel abstract", description: "Numerical concepts need grounding", traits: ["dyscalculia"] },
      { label: "I lose track of sequences or multi-step problems", description: "Working memory gets overloaded", traits: ["working_memory"] },
    ],
  },
  {
    id: "q4_output",
    section: "Output & Organization",
    sectionIcon: "📤",
    question: "When asked to demonstrate what you know, which method feels the most frustrating?",
    options: [
      { label: "I can adapt to most formats", description: "Output modality is flexible", traits: [] },
      { label: "The physical act of writing — brain moves faster than fingers", description: "Motor execution is the bottleneck", traits: ["dysgraphia_motor"] },
      { label: "Organizing my thoughts into a structured format", description: "Expression and structure are hard", traits: ["dysgraphia_expression"] },
    ],
  },
  {
    id: "q5_planning",
    section: "Output & Organization",
    sectionIcon: "📤",
    question: "You have a large assignment due in two weeks. What does your starting process look like?",
    options: [
      { label: "I break it into pieces and start the first step right away", description: "Planning and initiation are solid", traits: [] },
      { label: "I want to start but feel paralyzed — don't know which step first", description: "Task initiation is the barrier", traits: ["ef_planning"] },
      { label: "I wait until the last night — urgency is the only thing that works", description: "Dopamine-driven deadline dependency", traits: ["dopamine_regulation", "adhd"] },
    ],
  },
  {
    id: "q6_wrong_answer",
    section: "Emotion & Energy",
    sectionIcon: "💭",
    question: "How do you react when you get a practice question wrong?",
    options: [
      { label: "I look at the answer to see where I made a mistake", description: "Errors are neutral data", traits: [] },
      { label: "A sharp surge of frustration or anxiety — I want to quit", description: "Emotional intensity around errors", traits: ["rsd"] },
      { label: "I brush it off, but without penalty or reward I lose interest", description: "Engagement needs stakes", traits: [] },
    ],
  },
  {
    id: "q7_boring_topic",
    section: "Emotion & Energy",
    sectionIcon: "💭",
    question: "If the topic you are studying is incredibly boring to you, how do you manage?",
    options: [
      { label: "I just push through it", description: "Willpower carries the day", traits: [] },
      { label: "Physically painful to focus unless I connect it to a personal interest", description: "Interest-based nervous system", traits: ["interest_based"] },
    ],
  },
  {
    id: "q8_energy",
    section: "Emotion & Energy",
    sectionIcon: "💭",
    question: "After a traditional study session or a long class, how does your mental battery usually feel?",
    options: [
      { label: "Tired, but refreshed after a break", description: "Normal cognitive fatigue", traits: [] },
      { label: "Completely wiped out — brain fog for the rest of the day", description: "High masking / cognitive burnout", traits: ["cognitive_burnout"] },
    ],
  },
  {
    id: "q9_complex_concept",
    section: "Input & Decoding",
    sectionIcon: "📥",
    question: "When learning a complex new concept or system, how does your brain naturally break it down?",
    options: [
      { label: "I need to see a 'blueprint' of the raw materials and how they piece together", description: "You think in spatial layouts and component relationships", traits: ["visual_spatial"] },
      { label: "I look for the leading indicators, the catalyst event, and the momentum shifts", description: "You think in systems, triggers, and cascading effects", traits: ["systems_analytical"] },
      { label: "I need a strict, step-by-step operating procedure where nothing is skipped", description: "You think in rigid sequences and checklists", traits: ["strict_procedural"] },
    ],
  },
];

// ─── Rules engine: traits → tools/settings ──────────────────

export interface ProfileSettings {
  uiSettings: string[];
  addOns: string[];
  studyTools: string[];
  learningMode: string;
}

const TRAIT_RULES: Record<CognitiveTrait, Partial<ProfileSettings>> = {
  dyslexia: {
    uiSettings: ["dyslexia_font", "line_spacing", "audio_player"],
    addOns: ["tldr", "color_coded_tagging"],
    studyTools: ["mindmap"],
    learningMode: "dyslexia",
  },
  adhd: {
    uiSettings: ["bionic_reading"],
    addOns: ["tldr", "retention_quiz", "why_should_i_care"],
    studyTools: ["pomodoro", "ambient_audio", "anchor"],
    learningMode: "adhd",
  },
  asd: {
    uiSettings: ["reduce_motion", "minimalist_theme"],
    addOns: ["feynman_check", "transition_bridges"],
    studyTools: ["flowchart"],
    learningMode: "adhd",
  },
  dyscalculia: {
    addOns: ["visual_data_anchors", "formula_translator", "color_coded_variables", "step_by_step_math"],
    studyTools: ["flowchart"],
  },
  dysgraphia_motor: {
    addOns: ["write_this_down"],
    studyTools: ["cloze_notes"],
  },
  dysgraphia_expression: {
    addOns: ["write_this_down"],
    studyTools: ["cloze_notes"],
  },
  working_memory: {
    addOns: ["recall_prompts"],
    studyTools: ["flashcards"],
  },
  ef_planning: {
    addOns: ["recall_prompts"],
    studyTools: [],
  },
  dopamine_regulation: {
    addOns: ["why_should_i_care"],
    studyTools: ["pomodoro", "anchor"],
  },
  rsd: {
    uiSettings: ["hide_red_x"],
    addOns: ["retention_quiz"],
    studyTools: ["knowledge_quest", "xp_points"],
  },
  interest_based: {
    addOns: ["why_should_i_care"],
    studyTools: ["socratic_chatbot"],
  },
  cognitive_burnout: {
    studyTools: ["pomodoro", "ambient_audio"],
  },
  high_cognitive_load: {
    uiSettings: ["audio_player"],
    addOns: ["tldr", "watch_explanation"],
    studyTools: ["mindmap"],
  },
  sensory_hypo: {
    studyTools: ["ambient_audio"],
  },
  visual_spatial: {
    addOns: ["tldr"],
    studyTools: ["mindmap", "flowchart"],
  },
  systems_analytical: {
    addOns: ["why_should_i_care"],
    studyTools: ["flowchart"],
  },
  strict_procedural: {
    addOns: ["recall_prompts"],
    studyTools: [],
  },
};

export function deriveProfileSettings(traits: CognitiveTrait[]): ProfileSettings {
  const result: ProfileSettings = {
    uiSettings: [],
    addOns: [],
    studyTools: [],
    learningMode: "adhd", // default
  };

  for (const trait of traits) {
    const rule = TRAIT_RULES[trait];
    if (!rule) continue;
    if (rule.uiSettings) result.uiSettings.push(...rule.uiSettings);
    if (rule.addOns) result.addOns.push(...rule.addOns);
    if (rule.studyTools) result.studyTools.push(...rule.studyTools);
    if (rule.learningMode) result.learningMode = rule.learningMode;
  }

  // Deduplicate
  result.uiSettings = [...new Set(result.uiSettings)];
  result.addOns = [...new Set(result.addOns)];
  result.studyTools = [...new Set(result.studyTools)];

  return result;
}

// ─── AI prompt appends per trait ─────────────────────────────

const TRAIT_PROMPTS: Partial<Record<CognitiveTrait, string>> = {
  working_memory:
    'Do NOT generate paragraphs. Use the "I Do, We Do, You Do" scaffolding method. Break the core concept into a 3-step numbered checklist. Keep all sentences under 15 words. Bold the actionable verbs.',
  ef_planning:
    'Do NOT generate paragraphs. Use the "I Do, We Do, You Do" scaffolding method. Break the core concept into a 3-step numbered checklist. Keep all sentences under 15 words. Bold the actionable verbs.',
  rsd:
    'When the user answers incorrectly, utilize Unconditional Positive Regard. Depersonalize the error. Never say "You got this wrong." Say "This specific concept is notoriously tricky because [X]." Frame failures as neutral, temporary data points in a low-stakes game.',
  interest_based:
    "The user requires extreme novelty to engage executive function. Explain the target concept entirely through the lens of their registered hyper-fixation. Map the academic variables directly to elements of their interest. RULE OF MECHANICAL ALIGNMENT (CRITICAL GUARDRAIL): The underlying mechanics of the academic concept MUST logically match the rules of the hyper-fixation. Every analogy must be a mathematically sound 1-to-1 mapping where the cause-effect relationships, proportions, and constraints mirror each other. If a logical, mechanically accurate mapping is impossible for a given concept, you MUST opt-out of the hyper-fixation lens and use a standard, highly visual real-world example instead. Never force a broken analogy — accuracy is non-negotiable.",
  dyscalculia:
    `The user struggles with abstract numbers and timelines. Every statistic, percentage, formula, or date must be accompanied by a concrete, real-world visual analogy. What does this number physically look like?

FORMULA TRANSLATOR RULE: Whenever you write a mathematical equation, formula, or complex expression, wrap it in <span class="math-formula" data-formula="THE_RAW_FORMULA">displayed formula</span>. The data-formula attribute must contain the raw symbolic expression (e.g. "E = mc^2") so the UI can generate a plain-English tooltip.

COLOR-CODED VARIABLES RULE: Inside formulas, wrap each distinct variable in <span class="math-var" style="color: var(--math-VAR_NAME)">VAR</span> where VAR_NAME is a lowercase identifier. Use consistent colors for the same variable throughout the notes. This helps the user visually track which symbol means what.

STEP-BY-STEP MATH RULE: When solving a math problem or demonstrating a calculation, output a <div class="math-stepper" data-total-steps="N"> container. Inside it, place each step as <div class="math-step" data-step="N"><div class="math-step-equation">equation here</div><div class="math-step-explain">plain English explanation of what just happened</div></div>. Number steps sequentially starting at 1. The UI will render these with cascading reveal.`,
  asd:
    "Rewrite concepts using literal, precise language. Remove all idioms, sarcasm, and abstract metaphors. Create strict 'If X, then Y' logical sequences.",
  dyslexia:
    "Use short sentences (under 15 words each). Avoid walls of text. Use bullet points and numbered lists extensively. Bold key terms on first use.",
  adhd:
    "Use chunked, color-coded sections with clear headers. Start each section with a one-line hook. Use bullet points, not paragraphs. Bold the most important words. Keep each bullet under 20 words.",
  visual_spatial:
    "COGNITIVE MODIFIER: Visual-Spatial Processing. Whenever explaining a complex system where multiple parts form a whole, you MUST format the explanation like a 'Technical Pack' or 'Design Blueprint'. First, provide a bulleted list of the raw 'Materials' or 'Components' involved. Then, explicitly explain how these components 'stitch' or connect together to create the final structure.",
  systems_analytical:
    "COGNITIVE MODIFIER: Systems-Analytical Processing. Whenever explaining a cause-and-effect relationship, historical event, or biological chain reaction, format the explanation using 'Catalysts' and 'Indicators'. You MUST explicitly identify the 'Leading Indicator' (the early warning sign), the 'Catalyst' (the exact trigger event), and the 'Momentum Shift' (the final resulting action or trend).",
  strict_procedural:
    "COGNITIVE MODIFIER: Strict Procedural Processing. Whenever explaining a process, lifecycle, or sequence of events, format it as a strict 'Standard Operating Procedure'. First, list the exact 'Tools' or prerequisites required before beginning. Then, provide a rigid, numbered sequence of actions where each step explicitly relies on the successful completion of the previous step. Do not group multiple actions into a single step.",
};

export function buildProfilePromptAppend(traits: CognitiveTrait[], hyperFixation?: string | null): string {
  const parts: string[] = [];

  for (const trait of traits) {
    const prompt = TRAIT_PROMPTS[trait];
    if (prompt) {
      parts.push(prompt);
    }
  }

  return parts.length > 0
    ? "\n\nADDITIONAL COGNITIVE PROFILE INSTRUCTIONS:\n" + parts.join("\n\n")
    : "";
}

export function deriveTraitsFromAnswers(answers: Record<string, number>): CognitiveTrait[] {
  const traits: CognitiveTrait[] = [];
  for (const q of WIZARD_QUESTIONS) {
    const ansIdx = answers[q.id];
    if (ansIdx !== undefined && q.options[ansIdx]) {
      traits.push(...q.options[ansIdx].traits);
    }
  }
  return [...new Set(traits)];
}
