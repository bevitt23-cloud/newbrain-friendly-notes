/**
 * Modular tutorial note system.
 *
 * Instead of 5 static variants, we assemble tutorial notes dynamically from
 * small HTML blocks based on the user's detected traits, selected add-ons,
 * writing style, and UI settings. The Smart Checkout live preview calls
 * `buildTutorialNotes()` so the preview updates instantly when toggles change.
 *
 * The tutorial uses "How Memory Works" as a universal demo topic — it has
 * processes (for flowcharts), numbers (for dyscalculia), vocabulary (for
 * jargon tooltips), and real-world relevance (for "Why Should I Care").
 */

import type { CognitiveTrait } from "./cognitiveRules";

// ─── Writing styles (kept for backwards compat) ─────────────────

export type WritingStyleKey =
  | "standard"
  | "bulleted"
  | "literal"
  | "bulleted_literal"
  | "procedural";

export const WRITING_STYLE_LABELS: Record<WritingStyleKey, { name: string; description: string }> = {
  standard: {
    name: "Standard Prose",
    description: "Clear paragraphs with bold key terms — the default academic style.",
  },
  bulleted: {
    name: "Bulleted & Chunked",
    description: "Key info broken into bullet points for rapid scanning. Great for ADHD.",
  },
  literal: {
    name: "Literal & Concrete",
    description: "No idioms or metaphors — precise, explicit language. Ideal for ASD.",
  },
  bulleted_literal: {
    name: "Bulleted + Literal",
    description: "Combines chunked bullets with concrete, jargon-free language.",
  },
  procedural: {
    name: "Step-by-Step Procedure",
    description: "Strict numbered sequence — nothing is skipped or grouped. Ideal for sequential thinkers.",
  },
};

/** Returns the combined writing style key for a set of active styles */
export function getActiveVariantKey(styles: WritingStyleKey[]): WritingStyleKey {
  if (styles.includes("bulleted_literal")) return "bulleted_literal";
  if (styles.includes("procedural")) return "procedural";
  if (styles.includes("bulleted") && styles.includes("literal")) return "bulleted_literal";
  if (styles.includes("bulleted")) return "bulleted";
  if (styles.includes("literal")) return "literal";
  return "standard";
}

// ─── Section content by writing style ───────────────────────────
// Each section has variants for each writing style. The content teaches
// "How Memory Works" so the user sees real educational content in their format.

interface SectionBlock {
  color: string;
  id: string;
  title: string;
  /** Title with emoji prefix for visual_mapper trait */
  emojiTitle: string;
  html: string;
}

function getMemorySections(style: WritingStyleKey): SectionBlock[] {
  if (style === "procedural") {
    return [
      {
        color: "sage",
        id: "section-1",
        title: "Step 1: Encoding — How Your Brain Captures Info",
        emojiTitle: "🧠 Step 1: Encoding — How Your Brain Captures Info",
        html: `<h3>Prerequisites</h3>
<p>Your brain needs sensory input — something you see, hear, or touch.</p>
<h3>Action</h3>
<p>Your brain converts the sensory input into a neural signal. This process is called <span class="jargon" data-definition="The process of converting sensory information into a form the brain can store">encoding</span>. The more senses involved, the stronger the encoding.</p>
<h3>Result</h3>
<p>A temporary neural pattern is created in your <span class="jargon" data-definition="A seahorse-shaped brain region essential for forming new memories">hippocampus</span>. This is now a short-term memory.</p>`,
      },
      {
        color: "lavender",
        id: "section-2",
        title: "Step 2: Storage — Moving to Long-Term",
        emojiTitle: "💾 Step 2: Storage — Moving to Long-Term",
        html: `<h3>Prerequisites</h3>
<p>Step 1 must be complete. A short-term memory must exist in the hippocampus.</p>
<h3>Action</h3>
<p>During sleep and repeated review, the hippocampus replays the memory and transfers it to the <span class="jargon" data-definition="The outer layer of the brain responsible for higher thinking, where long-term memories are permanently stored">neocortex</span>. This is called <span class="jargon" data-definition="The process where short-term memories become stable long-term memories through repetition and sleep">consolidation</span>.</p>
<h3>Result</h3>
<p>The memory is now stored long-term. It can persist for years if reinforced.</p>`,
      },
      {
        color: "peach",
        id: "section-3",
        title: "Step 3: Retrieval — Accessing What You Stored",
        emojiTitle: "🔍 Step 3: Retrieval — Accessing What You Stored",
        html: `<h3>Prerequisites</h3>
<p>Step 2 must be complete. The memory must be consolidated in long-term storage.</p>
<h3>Action</h3>
<p>When you encounter a cue (a question, a smell, a related concept), your brain activates the stored neural pattern and brings the memory back into conscious awareness.</p>
<h3>Result</h3>
<p>You remember the information. The more retrieval practice you do, the faster and more reliable this step becomes.</p>`,
      },
    ];
  }

  if (style === "bulleted" || style === "bulleted_literal") {
    const useLiteral = style === "bulleted_literal";
    return [
      {
        color: "sage",
        id: "section-1",
        title: "Encoding — Capturing Information",
        emojiTitle: "🧠 Encoding — Capturing Information",
        html: `<ul>
<li><strong>${useLiteral ? "Encoding" : "Encoding"}</strong> — ${useLiteral ? "your brain converts what you see, hear, or touch into a neural signal" : "your brain converts sensory input into a <span class=\"jargon\" data-definition=\"A neural signal pattern that represents new information\">neural code</span>"}</li>
<li><strong>Multi-sensory input is stronger</strong> — ${useLiteral ? "using more than one sense (seeing AND hearing) creates a stronger memory" : "the more senses involved, the deeper the encoding"}</li>
<li><strong>Where it happens</strong> — the <span class="jargon" data-definition="A seahorse-shaped brain region essential for forming new memories">hippocampus</span> ${useLiteral ? "creates a temporary copy of the new information" : "creates a temporary neural pattern"}</li>
</ul>`,
      },
      {
        color: "lavender",
        id: "section-2",
        title: "Storage — Short-Term to Long-Term",
        emojiTitle: "💾 Storage — Short-Term to Long-Term",
        html: `<ul>
<li><strong>Short-term memory</strong> — ${useLiteral ? "lasts about 20 to 30 seconds without rehearsal. That means if you do not repeat the information, you lose it." : "lasts ~20-30 seconds without rehearsal"}</li>
<li><strong><span class="jargon" data-definition="The process where short-term memories become stable long-term memories through repetition and sleep">Consolidation</span></strong> — ${useLiteral ? "during sleep, the hippocampus replays the memory and sends it to the outer brain layer for permanent storage" : "during sleep, the hippocampus replays memories and transfers them to the neocortex"}</li>
<li><strong>Spacing effect</strong> — ${useLiteral ? "studying the same material across multiple days produces stronger memories than studying it all at once" : "distributed practice beats cramming every time"}</li>
</ul>`,
      },
      {
        color: "peach",
        id: "section-3",
        title: "Retrieval — Pulling Memories Back",
        emojiTitle: "🔍 Retrieval — Pulling Memories Back",
        html: `<ul>
<li><strong>Cue-dependent</strong> — ${useLiteral ? "you need a trigger (a question, a smell, a related idea) to activate the stored memory" : "memories are activated by cues — questions, smells, related concepts"}</li>
<li><strong>Retrieval practice</strong> — ${useLiteral ? "testing yourself on material makes you remember it better than re-reading the same material" : "testing yourself strengthens the retrieval pathway more than re-reading"}</li>
<li><strong>Use it or lose it</strong> — ${useLiteral ? "neural pathways that are not used become weaker over time. Regular review prevents this." : "unused pathways weaken; regular review keeps them strong"}</li>
</ul>`,
      },
    ];
  }

  if (style === "literal") {
    return [
      {
        color: "sage",
        id: "section-1",
        title: "Encoding — How Your Brain Captures New Information",
        emojiTitle: "🧠 Encoding — How Your Brain Captures New Information",
        html: `<p>When you see, hear, or touch something new, your brain converts that sensory input into a neural signal. This conversion process is called <span class="jargon" data-definition="The process of converting sensory information into a form the brain can store">encoding</span>.</p>
<p>Encoding is stronger when more than one sense is involved. For example, if you read a word AND hear it spoken at the same time, your brain creates a stronger memory than if you only read it.</p>
<p>The encoded information goes to a specific brain region called the <span class="jargon" data-definition="A seahorse-shaped brain region essential for forming new memories">hippocampus</span>. The hippocampus creates a temporary copy. This temporary copy is your short-term memory.</p>`,
      },
      {
        color: "lavender",
        id: "section-2",
        title: "Storage — Moving From Short-Term to Long-Term",
        emojiTitle: "💾 Storage — Moving From Short-Term to Long-Term",
        html: `<p>Short-term memory has a limited duration. Without rehearsal, information in short-term memory disappears after approximately 20 to 30 seconds.</p>
<p>To move information into long-term memory, a process called <span class="jargon" data-definition="The process where short-term memories become stable long-term memories through repetition and sleep">consolidation</span> must occur. During sleep, the hippocampus replays the memory and gradually transfers it to the <span class="jargon" data-definition="The outer layer of the brain responsible for higher thinking, where long-term memories are permanently stored">neocortex</span> for permanent storage.</p>
<p>Studying the same material across multiple days (called spaced repetition) produces significantly stronger long-term memories than studying it all in one session.</p>`,
      },
      {
        color: "peach",
        id: "section-3",
        title: "Retrieval — Accessing Stored Memories",
        emojiTitle: "🔍 Retrieval — Accessing Stored Memories",
        html: `<p>To access a stored memory, your brain needs a trigger. This trigger is called a retrieval cue. A retrieval cue can be a question, a smell, a location, or a related concept.</p>
<p>When the cue activates the stored neural pattern, the memory returns to your conscious awareness. This is the act of remembering.</p>
<p>Testing yourself on material (retrieval practice) strengthens the memory pathway more effectively than simply re-reading the material. Each time you successfully retrieve a memory, the pathway becomes faster and more reliable.</p>`,
      },
    ];
  }

  // Default: standard prose
  return [
    {
      color: "sage",
      id: "section-1",
      title: "Encoding — How Your Brain Captures Information",
      emojiTitle: "🧠 Encoding — How Your Brain Captures Information",
      html: `<p>Every memory starts with <strong>encoding</strong> — the moment your brain converts sensory input into a <span class="jargon" data-definition="A neural signal pattern that represents new information">neural code</span>. Think of it as your brain taking a snapshot, but the quality depends on how many senses are involved.</p>
<p>Reading a fact quietly uses one channel. Reading it aloud while writing it down uses three. The more channels, the stronger the <span class="jargon" data-definition="A seahorse-shaped brain region essential for forming new memories">hippocampus</span> grips onto the new information.</p>`,
    },
    {
      color: "lavender",
      id: "section-2",
      title: "Storage — Short-Term to Long-Term",
      emojiTitle: "💾 Storage — Short-Term to Long-Term",
      html: `<p>Your short-term memory is fragile — it holds information for roughly <strong>20-30 seconds</strong> before it fades. The bridge to long-term memory is a process called <span class="jargon" data-definition="The process where short-term memories become stable long-term memories through repetition and sleep">consolidation</span>.</p>
<p>During sleep, your hippocampus replays the day's memories and transfers them to the <span class="jargon" data-definition="The outer layer of the brain responsible for higher thinking, where long-term memories are permanently stored">neocortex</span> for permanent storage. This is why cramming the night before rarely works — your brain needs sleep cycles to consolidate.</p>`,
    },
    {
      color: "peach",
      id: "section-3",
      title: "Retrieval — The Key to Stronger Memory",
      emojiTitle: "🔍 Retrieval — The Key to Stronger Memory",
      html: `<p>A stored memory is useless if you can't access it. <strong>Retrieval</strong> is the process of pulling a memory back into conscious awareness, triggered by a cue — a question, a smell, a related concept.</p>
<p>Here's the critical insight: <strong>testing yourself</strong> on material strengthens the retrieval pathway far more than re-reading. Every successful recall makes the next recall faster and more reliable. This is exactly why the study tools below your notes exist.</p>`,
    },
  ];
}

// ─── Add-on demo blocks ─────────────────────────────────────────
// Each add-on gets a small HTML block that demonstrates it in context.

const ADDON_BLOCKS: Record<string, string> = {
  tldr: `<section data-section-color="sky">
<h2 data-section-color="sky" id="section-tldr">⚡ TL;DR</h2>
<p>Your brain encodes sensory input into short-term memory, consolidates it into long-term memory during sleep, and retrieves it using cues. Testing yourself (retrieval practice) is the single most effective way to strengthen memories.</p>
</section>`,

  why_care: `<section data-section-color="amber">
<h2 data-section-color="amber" id="section-care">🤔 Why Should I Care?</h2>
<p>Understanding how memory works gives you a <strong>strategic advantage</strong> over every student who just reads and highlights. When you know that retrieval practice beats re-reading by 50-80%, you can study half as long and remember twice as much. This is the science behind every study tool on this platform.</p>
</section>`,

  recall: `<div class="recall-prompt" data-section-index="1">
<p><strong>Quick check:</strong> What are the three stages of memory, and which brain region handles the first stage?</p>
<textarea class="recall-input" placeholder="What do you remember?" rows="3"></textarea>
<button class="recall-submit">Check</button>
<div class="recall-key" style="display:none">Encoding (hippocampus), Storage/Consolidation (transfer to neocortex during sleep), and Retrieval (cue-dependent recall). The hippocampus handles encoding.</div>
</div>`,

  simplify: `<div class="write-this-down"><strong>✍️ Write This Down:</strong> <p>Memory has 3 stages: Encoding (capture), Storage (consolidation during sleep), Retrieval (cue-triggered recall). Testing yourself beats re-reading.</p></div>`,

  feynman: `<div class="feynman-check" data-section="feynman">
<p><strong>Feynman Check:</strong> Can you explain how a memory goes from "something you just heard" to "something you remember next week"? Use your own words.</p>
<textarea class="feynman-input" placeholder="Explain it in your own words..." rows="4"></textarea>
<button class="feynman-submit">Check My Understanding</button>
<div class="feynman-key" style="display:none">
<div class="feynman-point" data-concept="encoding">Sensory input is converted to neural signals by the hippocampus</div>
<div class="feynman-point" data-concept="consolidation">During sleep, the hippocampus replays and transfers to neocortex</div>
<div class="feynman-point" data-concept="retrieval">Cues trigger recall; testing yourself strengthens the pathway</div>
</div>
</div>`,

  visual_learner: `<button class="watch-explainer" data-query="how memory works simple visual explanation">🎥 Watch Explainer</button>`,
};

// ─── Trait-specific demo blocks ─────────────────────────────────

function getTraitDemoBlocks(traits: CognitiveTrait[]): string {
  const blocks: string[] = [];

  if (traits.includes("dyscalculia")) {
    blocks.push(`<section data-section-color="sky">
<h2 data-section-color="sky" id="section-math-demo">Numbers Made Concrete</h2>
<p>Your notes will automatically translate abstract numbers into real-world comparisons. For example:</p>
<p>Short-term memory lasts <strong>20-30 seconds</strong> — that is roughly the time it takes to tie your shoelaces. After that, the information fades unless you actively rehearse it.</p>
<p>When your notes contain equations, they will appear in a step-by-step format like this:</p>
<div class="math-stepper" data-total-steps="2">
<div class="math-step" data-step="1">
<div class="math-step-equation">Memory Strength = Encoding Quality × Retrieval Practice</div>
<div class="math-step-explain">The strength of a memory depends on two things multiplied together: how well you encoded it initially, and how often you tested yourself on it.</div>
</div>
<div class="math-step" data-step="2">
<div class="math-step-equation">If Encoding = 3 (multi-sensory) and Practice = 4 sessions → Strength = 12</div>
<div class="math-step-explain">Using multiple senses (score of 3) combined with 4 practice sessions gives a strong memory score of 12.</div>
</div>
</div>
</section>`);
  }

  if (traits.includes("prioritization_fatigue")) {
    blocks.push(`<section data-section-color="amber">
<h2 data-section-color="amber" id="section-hierarchy-demo">How Information Hierarchy Works</h2>
<p>Your notes will label every piece of information by importance so you never have to guess what to focus on:</p>
<p><strong>Core Concept:</strong> Memory has three stages — encoding, storage, and retrieval.</p>
<p><strong>Context:</strong> The hippocampus handles initial encoding, while the neocortex stores long-term memories. This transfer happens during sleep.</p>
<p><strong>Example:</strong> Reading a fact aloud while writing it down uses three sensory channels, making encoding much stronger than silent reading alone.</p>
</section>`);
  }

  if (traits.includes("demand_avoidant")) {
    blocks.push(`<section data-section-color="sage">
<h2 data-section-color="sage" id="section-language-demo">Low-Pressure Language</h2>
<p>Your notes will never use pressuring phrases. Instead of "You must memorize these three stages," your notes will say something like:</p>
<p>"There are three stages worth exploring here — encoding, storage, and retrieval. Some people find it helpful to think of them as a pipeline."</p>
<p>Words like "obviously," "simply," and "clearly" will be removed because they can create unnecessary pressure.</p>
</section>`);
  }

  return blocks.join("\n\n");
}

// ─── Platform tutorial section ──────────────────────────────────

function getApplicationSection(style: WritingStyleKey, useEmoji: boolean): string {
  const e = useEmoji;
  if (style === "bulleted" || style === "bulleted_literal") {
    return `<section data-section-color="amber">
<h2 data-section-color="amber" id="section-apply">${e ? "🎯 " : ""}Applying This to Your Study Habits</h2>
<ul>
<li><strong>Space your sessions</strong> — review material across multiple days instead of one marathon session</li>
<li><strong>Test before re-reading</strong> — close your notes and try to recall the key points first</li>
<li><strong>Use multiple senses</strong> — read aloud while writing key terms to strengthen encoding</li>
<li><strong>Sleep on it</strong> — <span class="jargon" data-definition="The process where short-term memories become stable long-term memories during sleep">consolidation</span> happens during sleep, so study before bed</li>
</ul>
</section>`;
  }

  if (style === "procedural") {
    return `<section data-section-color="amber">
<h2 data-section-color="amber" id="section-apply">${e ? "🎯 " : ""}Step 4: Apply These Principles</h2>
<h3>Prerequisites</h3>
<p>Steps 1-3 must be understood. You know how encoding, storage, and retrieval work.</p>
<h3>Action</h3>
<p>Space your study sessions across multiple days. After each session, close your notes and test yourself before re-reading. Read key terms aloud while writing them down to engage multiple senses.</p>
<h3>Result</h3>
<p>Stronger encoding, faster consolidation, and more reliable retrieval on exam day.</p>
</section>`;
  }

  return `<section data-section-color="amber">
<h2 data-section-color="amber" id="section-apply">${e ? "🎯 " : ""}Applying This to Your Study Habits</h2>
<p>The most effective study strategy based on memory science is <strong>spaced retrieval practice</strong>. Instead of re-reading your notes, close them and try to recall the key points from memory. This strengthens the retrieval pathway far more than passive review.</p>
<p>Spacing your sessions across multiple days gives your <span class="jargon" data-definition="A seahorse-shaped brain region essential for forming new memories">hippocampus</span> time to consolidate each review into long-term storage. Cramming skips this step entirely.</p>
</section>`;
}

// ─── Main assembly function ─────────────────────────────────────

export interface TutorialBuildOptions {
  writingStyle: WritingStyleKey;
  traits: CognitiveTrait[];
  addOns: string[];
  uiSettings: string[];
}

export function buildTutorialNotes(options: TutorialBuildOptions): string {
  const { writingStyle, traits, addOns } = options;
  const useEmoji = traits.includes("visual_mapper") || traits.includes("adhd");

  const parts: string[] = [];

  // Title
  parts.push(`<h1>${useEmoji ? "🧠 " : ""}How Memory Works</h1>`);

  // TL;DR at top (if addon selected)
  if (addOns.includes("tldr")) {
    parts.push(ADDON_BLOCKS.tldr);
  }

  // Why Should I Care (if addon selected)
  if (addOns.includes("why_care")) {
    parts.push(ADDON_BLOCKS.why_care);
  }

  // Main content sections
  const sections = getMemorySections(writingStyle);
  for (const section of sections) {
    const title = useEmoji ? section.emojiTitle : section.title;
    let sectionHtml = `<section data-section-color="${section.color}">
<h2 data-section-color="${section.color}" id="${section.id}">${title}</h2>
${section.html}`;

    // Add recall prompt after first content section if addon selected
    if (section.id === "section-1" && addOns.includes("recall")) {
      sectionHtml += `\n${ADDON_BLOCKS.recall}`;
    }

    // Add write-this-down after second section if addon selected
    if (section.id === "section-2" && addOns.includes("simplify")) {
      sectionHtml += `\n${ADDON_BLOCKS.simplify}`;
    }

    // Add watch explainer after each section if addon selected
    if (addOns.includes("visual_learner")) {
      sectionHtml += `\n${ADDON_BLOCKS.visual_learner}`;
    }

    sectionHtml += `\n</section>`;
    parts.push(sectionHtml);
  }

  // Trait-specific demo blocks
  const traitBlocks = getTraitDemoBlocks(traits);
  if (traitBlocks) {
    parts.push(traitBlocks);
  }

  // Application section — how memory concepts apply to studying
  parts.push(getApplicationSection(writingStyle, useEmoji));

  // Feynman check at end if addon selected
  if (addOns.includes("feynman")) {
    parts.push(ADDON_BLOCKS.feynman);
  }

  return `<div>\n${parts.join("\n\n")}\n</div>`;
}

// ─── Legacy compat: static variants (used by old code paths) ────

export const ONBOARDING_VARIANTS: Record<WritingStyleKey, string> = {
  standard: buildTutorialNotes({ writingStyle: "standard", traits: [], addOns: ["simplify"], uiSettings: [] }),
  bulleted: buildTutorialNotes({ writingStyle: "bulleted", traits: ["adhd"], addOns: ["tldr", "simplify"], uiSettings: [] }),
  literal: buildTutorialNotes({ writingStyle: "literal", traits: ["asd"], addOns: ["simplify"], uiSettings: [] }),
  bulleted_literal: buildTutorialNotes({ writingStyle: "bulleted_literal", traits: ["asd", "adhd"], addOns: ["tldr", "simplify"], uiSettings: [] }),
  procedural: buildTutorialNotes({ writingStyle: "procedural", traits: ["strict_procedural"], addOns: ["simplify"], uiSettings: [] }),
};
