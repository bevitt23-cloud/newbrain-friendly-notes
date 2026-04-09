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
  | "strict_procedural"
  | "demand_avoidant"
  | "prioritization_fatigue"
  | "visual_mapper";

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
    id: "q8b_pressure_language",
    section: "Emotion & Energy",
    sectionIcon: "💭",
    question: "When a teacher or textbook uses authoritative or pressure-heavy language (e.g., 'You must memorize this' or 'Obviously, the answer is...'), how does your brain react?",
    options: [
      { label: "It motivates me or I don't really notice", description: "Pressure language is neutral", traits: [] },
      { label: "I instantly feel anxious, overwhelmed, or a strong urge to resist and disengage", description: "Demand avoidance or academic anxiety", traits: ["demand_avoidant"] },
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
  {
    id: "q10_working_memory_hurdle",
    section: "Input & Decoding",
    sectionIcon: "📥",
    question: "When reading a dense textbook chapter, what is the biggest hurdle for your working memory?",
    options: [
      { label: "Understanding the complex vocabulary or domain-specific jargon", description: "Vocabulary is the bottleneck", traits: [] },
      { label: "Everything looks equally important — I burn all my energy figuring out what is a core fact versus a supporting detail", description: "Information prioritization is the bottleneck", traits: ["prioritization_fatigue"] },
    ],
  },
  {
    id: "q11_document_navigation",
    section: "Input & Decoding",
    sectionIcon: "📥",
    question: "How do you prefer to navigate a new document or study guide before you start reading?",
    options: [
      { label: "I usually just start reading from the top down", description: "Linear reading is natural", traits: [] },
      { label: "I need to scan for visual markers (like icons or distinct headers) to build a mental map of the document first", description: "Visual-spatial navigation needed", traits: ["visual_mapper"] },
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
  demand_avoidant: {
    addOns: [],
    studyTools: [],
  },
  prioritization_fatigue: {
    addOns: ["tldr"],
    studyTools: [],
  },
  visual_mapper: {
    uiSettings: [],
    addOns: ["tldr"],
    studyTools: ["mindmap"],
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
    "The user requires extreme novelty to engage executive function. Explain the target concept entirely through the lens of their registered hyper-fixation. Map the academic variables directly to elements of their interest. RULE OF MECHANICAL ALIGNMENT (CRITICAL GUARDRAIL): The underlying mechanics of the academic concept MUST logically match the rules of the hyper-fixation. Every analogy must be a mathematically sound 1-to-1 mapping where the cause-effect relationships, proportions, and constraints mirror each other. If a logical, mechanically accurate mapping is impossible for a given concept, seamlessly default to a standard, highly visual real-world example. DO NOT apologize or mention that you are shifting away from their interest — just teach the concept clearly. Never force a broken analogy — accuracy is non-negotiable.",
  dyscalculia:
    `The user struggles with abstract numbers and timelines. Every statistic, percentage, formula, or date must be accompanied by a concrete, real-world visual analogy. What does this number physically look like?

FORMULA TRANSLATOR RULE: ONLY wrap actual multi-symbol mathematical equations in <span class="math-formula" data-formula="THE_ACTUAL_EQUATION">displayed formula</span>. The data-formula attribute MUST contain the real symbolic math expression (e.g. data-formula="E = mc^2" or data-formula="a^2 + b^2 = c^2"). NEVER put placeholder text, instruction text, or descriptions in data-formula — only real math symbols. DO NOT wrap these in math-formula: plain numbers (5, 81, 3.14), exercise/problem labels, page numbers, dates, section numbers, single variables, or short numeric values. Only equations with operators and multiple terms qualify.

COLOR-CODED VARIABLES RULE: Inside math-formula spans ONLY, wrap each distinct variable in <span class="math-var" style="color: var(--math-VAR_NAME)">VAR</span> where VAR_NAME is a lowercase identifier. Use consistent colors for the same variable throughout the notes.

STEP-BY-STEP MATH RULE: When solving a math problem or demonstrating a calculation, output a <div class="math-stepper" data-total-steps="N"> container. Inside it, place each step as <div class="math-step" data-step="N"><div class="math-step-equation">equation here</div><div class="math-step-explain">detailed plain English explanation with a concrete real-world analogy for the operation</div></div>. Number steps sequentially starting at 1. NEVER skip steps or combine multiple operations into one step. Each step explanation must include a real-world analogy that grounds the abstract math in something physical. The UI will render these with cascading reveal.`,
  asd:
    "Rewrite concepts using literal, precise language. Remove all idioms, sarcasm, and abstract metaphors. Create strict 'If X, then Y' logical sequences.",
  dyslexia:
    "Use short sentences (under 15 words each). Avoid walls of text. Use bullet points and numbered lists for facts, steps, and components — but always precede a list with a plain-English sentence explaining what the list covers and why it matters. Each bullet should be a complete thought, not a fragment. Use <strong> tags to bold key terms on first use. NEVER use asterisks or markdown syntax — only HTML tags.",
  adhd:
    "Use chunked, color-coded sections with clear headers. Start each section with a one-line hook. Use a MIX of short paragraphs (1-2 sentences) and bullet points — paragraphs for explaining concepts and context, bullets for listing facts, examples, or components. Each bullet must be a complete thought that connects to the one before it. NEVER use a bullet list without a lead-in sentence that explains what the list covers. Use <strong> tags to bold the most important words. NEVER use asterisks or markdown syntax — only HTML tags.",
  visual_spatial:
    "COGNITIVE MODIFIER: Visual-Spatial Processing. Whenever explaining a complex system where multiple parts form a whole, you MUST format the explanation like a 'Technical Pack' or 'Design Blueprint'. First, provide a bulleted list of the raw 'Materials' or 'Components' involved. Then, explicitly explain how these components 'stitch' or connect together to create the final structure.",
  systems_analytical:
    "COGNITIVE MODIFIER: Systems-Analytical Processing. Whenever explaining a cause-and-effect relationship, historical event, or biological chain reaction, format the explanation using 'Catalysts' and 'Indicators'. You MUST explicitly identify the 'Leading Indicator' (the early warning sign), the 'Catalyst' (the exact trigger event), and the 'Momentum Shift' (the final resulting action or trend).",
  strict_procedural:
    "COGNITIVE MODIFIER: Strict Procedural Processing. Whenever explaining a process, lifecycle, or sequence of events, format it as a strict 'Standard Operating Procedure'. First, list the exact 'Tools' or prerequisites required before beginning. Then, provide a rigid, numbered sequence of actions where each step explicitly relies on the successful completion of the previous step. Do not group multiple actions into a single step.",
  demand_avoidant:
    "LOW-DEMAND LANGUAGE: The user experiences Pathological Demand Avoidance (PDA) or academic anxiety. Never use words that imply a concept should be easy (e.g., 'obviously', 'simply', 'clearly', 'as you can see', 'of course', 'just'). Never use high-pressure commands (e.g., 'you must memorize this', 'it is essential that you'). Use invitational, neutral language that lowers the student's affective filter. Frame learning as exploration, not obligation.",
  prioritization_fatigue:
    "EXPLICIT HIERARCHY: The user struggles with executive function and information prioritization. You must explicitly label the weight of information to help them prioritize. Use HTML bold prefixes like <strong>Core Concept:</strong> for the main testable idea, <strong>Context:</strong> for the supporting narrative, and <strong>Example:</strong> for illustrative cases. This visual hierarchy helps the reader instantly distinguish what to memorize from what is background context. NEVER use asterisks for bold — only HTML <strong> tags.",
  visual_mapper:
    "VISUAL ANCHORING: The user requires visual-spatial mapping to decode text. Every single <h2> and <h3> header MUST begin with a single emoji that literally depicts the main object or action in that section (e.g., 🧬 for DNA, ☀️ for light/energy, 🧠 for brain, 📊 for data/charts). Do NOT use abstract emoji like 🔄, 💡, ✨, 🌟. Use the same emoji consistently for the same concept throughout. One emoji per header.",
};

// ─── Strength traits: lean INTO these as primary teaching strategies ──

const STRENGTH_TRAITS: CognitiveTrait[] = ["visual_spatial", "systems_analytical", "strict_procedural"];

export function buildProfilePromptAppend(traits: CognitiveTrait[], hyperFixation?: string | null): string {
  const parts: string[] = [];

  // Separate strengths from accommodations
  const strengths = traits.filter((t) => STRENGTH_TRAITS.includes(t));
  const accommodations = traits.filter((t) => !STRENGTH_TRAITS.includes(t));

  // Strengths first — frame as primary teaching strategy
  if (strengths.length > 0) {
    const strengthPrompts = strengths.map((t) => TRAIT_PROMPTS[t]).filter(Boolean);
    if (strengthPrompts.length > 0) {
      parts.push(
        "LEARNING STRENGTHS (lean into these as your PRIMARY teaching strategy — the user processes information best this way):\n" +
        strengthPrompts.join("\n\n")
      );
    }
  }

  // Accommodations second — frame as load-reducers
  if (accommodations.length > 0) {
    const accomPrompts = accommodations.map((t) => TRAIT_PROMPTS[t]).filter(Boolean);
    if (accomPrompts.length > 0) {
      parts.push(
        "ACCOMMODATIONS (reduce cognitive load in these areas):\n" +
        accomPrompts.join("\n\n")
      );
    }
  }

  // Subject-aware adaptation rule
  parts.push(
    "SUBJECT-AWARE ADAPTATION: Not all accommodations apply to all content. " +
    "If the source material contains zero equations, formulas, or numerical data, skip math-specific rules entirely (math steppers, formula translators, color-coded variables). " +
    "If it contains even one equation or worked problem, apply math rules fully. " +
    "If the source is purely quantitative with no narrative text, skip humanities-specific rules (timelines, character motives, thematic breakdowns). " +
    "Strengths-based strategies (above) should ALWAYS be applied regardless of subject matter."
  );

  return parts.length > 0
    ? "\n\nADDITIONAL COGNITIVE PROFILE INSTRUCTIONS:\n" + parts.join("\n\n")
    : "";
}

// ─── Profile name derivation ────────────────────────────────

export interface ProfileLabel {
  name: string;
  description: string;
}

export function deriveProfileLabel(traits: CognitiveTrait[]): ProfileLabel {
  const s = new Set(traits);

  // Check dominant patterns (order matters — first match wins)
  if (s.has("visual_spatial") || s.has("visual_mapper")) {
    return {
      name: "Visual Learner",
      description: "You process information best through spatial layouts, diagrams, and visual anchors. Your notes will emphasize blueprints, concept maps, and emoji-marked navigation.",
    };
  }
  if (s.has("systems_analytical")) {
    return {
      name: "Systems Thinker",
      description: "You naturally think in cause-and-effect chains and cascading systems. Your notes will highlight triggers, catalysts, and momentum shifts.",
    };
  }
  if (s.has("strict_procedural")) {
    return {
      name: "Step-by-Step Learner",
      description: "You process information best as rigid, sequential procedures. Your notes will be formatted as numbered checklists where each step builds on the last.",
    };
  }
  if (s.has("rsd") || s.has("demand_avoidant")) {
    return {
      name: "Confidence Builder",
      description: "Your notes will use warm, low-pressure language that frames learning as exploration. Errors are treated as stepping stones, not failures.",
    };
  }
  if (s.has("adhd") && s.has("dyslexia")) {
    return {
      name: "Focus Flow",
      description: "Your notes combine chunked, scannable formatting with short sentences and bold key terms — optimized for both attention and decoding.",
    };
  }
  if (s.has("adhd")) {
    return {
      name: "Focus Flow",
      description: "Your notes are chunked into short, color-coded sections with bold key phrases and one-line hooks to keep your attention locked in.",
    };
  }
  if (s.has("dyslexia")) {
    return {
      name: "Deep Reader",
      description: "Your notes use short sentences, extra spacing, and bold key terms to reduce decoding effort so you can focus on understanding.",
    };
  }
  if (s.has("dyscalculia")) {
    return {
      name: "Concrete Thinker",
      description: "Abstract numbers and formulas are translated into real-world comparisons and step-by-step breakdowns with plain-English explanations.",
    };
  }
  if (s.has("working_memory") || s.has("prioritization_fatigue")) {
    return {
      name: "Guided Learner",
      description: "Your notes explicitly label what's essential versus supporting context, with checklists and recall prompts to reinforce key points.",
    };
  }
  if (s.has("interest_based")) {
    return {
      name: "Curiosity-Driven",
      description: "Your notes connect academic concepts to your personal interests, using real-world analogies that make abstract ideas click.",
    };
  }

  return {
    name: "Adaptive Learner",
    description: "Your notes are formatted with brain-friendly defaults — clear headings, bold key terms, and color-coded sections for easy navigation.",
  };
}

// ─── Tool details for the Smart Checkout UI ───────────────

export interface ToolDetail {
  name: string;
  explanation: string;
  category: "ui" | "addon" | "study";
}

export const TOOL_DETAILS: Record<string, ToolDetail> = {
  // UI Settings
  dyslexia_font: {
    name: "Dyslexia-Friendly Font",
    explanation: "Switches to OpenDyslexic, a font with weighted bottoms that reduces letter swapping.",
    category: "ui",
  },
  bionic_reading: {
    name: "Bionic Reading",
    explanation: "Bolds the first half of each word so your eye anchors faster and reads with less effort.",
    category: "ui",
  },
  line_spacing: {
    name: "Extra Line Spacing",
    explanation: "Increases space between lines to prevent visual crowding and reduce re-reading.",
    category: "ui",
  },
  audio_player: {
    name: "Audio Player",
    explanation: "Adds a text-to-speech player so you can listen to your notes instead of reading.",
    category: "ui",
  },
  reduce_motion: {
    name: "Reduce Motion",
    explanation: "Turns off animations and transitions that can be distracting or cause discomfort.",
    category: "ui",
  },
  minimalist_theme: {
    name: "Minimalist Theme",
    explanation: "Strips the UI to essentials — fewer colors, icons, and visual noise.",
    category: "ui",
  },
  hide_red_x: {
    name: "Hide Red X on Errors",
    explanation: "Replaces harsh red error indicators with neutral, low-pressure feedback colors.",
    category: "ui",
  },
  // Add-ons (AI writing extras)
  tldr: {
    name: "TL;DR Summary",
    explanation: "Adds a 1-2 sentence bottom-line summary at the very top of your notes.",
    category: "addon",
  },
  why_should_i_care: {
    name: "Why Should I Care?",
    explanation: "Adds a motivational intro connecting the topic to your real life.",
    category: "addon",
  },
  recall_prompts: {
    name: "Recall Prompts",
    explanation: "Adds open-ended questions after each section to test what you remember.",
    category: "addon",
  },
  retention_quiz: {
    name: "Retention Quiz",
    explanation: "Generates a multiple-choice quiz at the bottom of your notes.",
    category: "addon",
  },
  write_this_down: {
    name: "Write This Down",
    explanation: "Adds a prompt telling you exactly what to jot down from each section.",
    category: "addon",
  },
  feynman_check: {
    name: "Feynman Check",
    explanation: "Asks you to explain the concept in your own words — the ultimate comprehension test.",
    category: "addon",
  },
  visual_data_anchors: {
    name: "Visual Data Anchors",
    explanation: "Converts abstract numbers into concrete, real-world size comparisons.",
    category: "addon",
  },
  formula_translator: {
    name: "Formula Translator",
    explanation: "Makes math formulas clickable — tap to see a plain-English translation.",
    category: "addon",
  },
  color_coded_variables: {
    name: "Color-Coded Variables",
    explanation: "Gives each math variable a unique color so you can track it across equations.",
    category: "addon",
  },
  step_by_step_math: {
    name: "Step-by-Step Math",
    explanation: "Shows math solutions one step at a time with a plain-English explanation for each.",
    category: "addon",
  },
  watch_explanation: {
    name: "Watch Explainer Videos",
    explanation: "Adds video search buttons so you can watch a visual explanation of each topic.",
    category: "addon",
  },
  color_coded_tagging: {
    name: "Color-Coded Tags",
    explanation: "Highlights different types of information (definitions, examples, rules) in distinct colors.",
    category: "addon",
  },
  transition_bridges: {
    name: "Transition Bridges",
    explanation: "Adds explicit connectors between sections explaining how topics relate.",
    category: "addon",
  },
  visual_learner: {
    name: "Visual Learner Mode",
    explanation: "Adds explainer video buttons after each major section for visual reinforcement.",
    category: "addon",
  },
  // Study Tools
  mindmap: {
    name: "Mind Map",
    explanation: "Generates an interactive concept map showing how all key ideas connect.",
    category: "study",
  },
  flowchart: {
    name: "Flow Chart",
    explanation: "Creates a step-by-step process diagram from sequences in your material.",
    category: "study",
  },
  pomodoro: {
    name: "Pomodoro Timer",
    explanation: "Built-in focus timer with work/break cycles to prevent burnout.",
    category: "study",
  },
  ambient_audio: {
    name: "Ambient Audio",
    explanation: "Background sounds (rain, lo-fi, white noise) to help maintain focus.",
    category: "study",
  },
  flashcards: {
    name: "Flashcards",
    explanation: "Auto-generates flashcards from key terms and definitions in your notes.",
    category: "study",
  },
  anchor: {
    name: "Anchor Timer",
    explanation: "A visible countdown that creates urgency to help with task initiation.",
    category: "study",
  },
  socratic_chatbot: {
    name: "Socratic Chatbot",
    explanation: "An AI tutor that asks you leading questions instead of giving answers directly.",
    category: "study",
  },
  knowledge_quest: {
    name: "Knowledge Quest",
    explanation: "Gamified quiz mode with points and streaks to make review feel like a game.",
    category: "study",
  },
  xp_points: {
    name: "XP Points",
    explanation: "Earn experience points for completing study activities — tracks your progress.",
    category: "study",
  },
  cloze_notes: {
    name: "Cloze Notes",
    explanation: "Blanks out key terms in your notes so you can practice filling them in.",
    category: "study",
  },
};

export function deriveTraitsFromAnswers(answers: Record<string, number | number[]>): CognitiveTrait[] {
  const traits: CognitiveTrait[] = [];
  for (const q of WIZARD_QUESTIONS) {
    const raw = answers[q.id];
    if (raw === undefined) continue;
    // Support both legacy single-index and new multi-select array
    const indices = Array.isArray(raw) ? raw : [raw];
    for (const idx of indices) {
      if (q.options[idx]) {
        traits.push(...q.options[idx].traits);
      }
    }
  }
  return [...new Set(traits)];
}
