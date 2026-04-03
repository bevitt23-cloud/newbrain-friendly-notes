/**
 * Pre-written tutorial note variants keyed by AI writing style.
 * The Smart Checkout live preview renders whichever variant(s) the user enables.
 * Each variant uses the same section-color and study-tool markup as real notes.
 */

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

export const ONBOARDING_VARIANTS: Record<WritingStyleKey, string> = {
  standard: `<div>
<h1>Welcome to Brain-Friendly Notes</h1>

<section data-section-color="sage">
  <h2 data-section-color="sage" id="section-1">How Your Notes Work</h2>
  <p>Every note you generate is <strong>reformatted by AI</strong> into a structure designed for how your brain actually processes information. The colors, spacing, and layout aren't decoration — they're engineered to reduce cognitive load.</p>
  <p>You'll notice each section has a <strong>distinct background color</strong> that cycles through sage, lavender, peach, sky, and amber. This creates a <span class="jargon" data-definition="A mental reset that happens when your eyes encounter a new visual pattern, helping you stay focused longer">visual reset</span> between topics so your brain doesn't zone out.</p>
</section>

<section data-section-color="lavender">
  <h2 data-section-color="lavender" id="section-2">The Text Selection Menu</h2>
  <p><strong>Highlight any text</strong> in your notes to open the selection menu. From there you can dive deeper into a concept, create a sticky note, or ask the AI to explain it differently.</p>
  <p>This is your primary interaction point — think of it as a right-click menu for learning.</p>
</section>

<section data-section-color="peach">
  <h2 data-section-color="peach" id="section-3">Study Tools at the Bottom</h2>
  <p>Scroll below your notes to find <strong>retention quizzes</strong>, mind maps, and flow charts. These are generated alongside your notes and test you on the material you just read.</p>
  <div class="write-this-down"><strong>Write This Down:</strong> <p>The most effective study strategy is to read a section, then immediately test yourself on it before moving on.</p></div>
</section>
</div>`,

  bulleted: `<div>
<h1>Welcome to Brain-Friendly Notes</h1>

<section data-section-color="sage">
  <h2 data-section-color="sage" id="section-1">How Your Notes Work</h2>
  <ul>
    <li><strong>AI-powered formatting</strong> — your material is restructured for how your brain processes info</li>
    <li><strong>Color-coded sections</strong> — sage, lavender, peach, sky, amber create <span class="jargon" data-definition="A mental reset triggered by new visual patterns that helps sustain focus">visual resets</span></li>
    <li><strong>Spacing is intentional</strong> — white space reduces cognitive overload</li>
  </ul>
</section>

<section data-section-color="lavender">
  <h2 data-section-color="lavender" id="section-2">The Text Selection Menu</h2>
  <ul>
    <li><strong>Highlight any text</strong> to open the action menu</li>
    <li><strong>Dive Deeper</strong> — get an AI explanation of a concept</li>
    <li><strong>Sticky Notes</strong> — pin your own thoughts to any passage</li>
    <li><strong>Ask AI</strong> — rephrase, simplify, or expand on a section</li>
  </ul>
</section>

<section data-section-color="peach">
  <h2 data-section-color="peach" id="section-3">Study Tools at the Bottom</h2>
  <ul>
    <li><strong>Retention Quiz</strong> — auto-generated questions from your notes</li>
    <li><strong>Mind Map</strong> — visual overview of all key concepts</li>
    <li><strong>Flow Chart</strong> — step-by-step process diagrams</li>
  </ul>
  <div class="write-this-down"><strong>Write This Down:</strong> <p>Read a section, then quiz yourself immediately — this is the most effective study loop.</p></div>
</section>
</div>`,

  literal: `<div>
<h1>Welcome to Brain-Friendly Notes</h1>

<section data-section-color="sage">
  <h2 data-section-color="sage" id="section-1">How Your Notes Work</h2>
  <p>When you upload a file or paste text, the AI reads it and creates a new version. The new version has the same information but with different formatting. The formatting includes colored backgrounds, bold key words, and short paragraphs.</p>
  <p>Each topic section has a different background color. The colors rotate through five options: sage (green), lavender (purple), peach (orange), sky (blue), and amber (yellow). The color change tells your brain that a new topic has started.</p>
</section>

<section data-section-color="lavender">
  <h2 data-section-color="lavender" id="section-2">The Text Selection Menu</h2>
  <p>Use your mouse cursor to select text inside your notes. Click and drag across the words you want to select. When you release the mouse button, a small menu will appear near the selected text.</p>
  <p>The menu has several buttons. Each button does one specific thing. For example, one button asks the AI to explain the selected text in more detail. Another button creates a note you can attach to that spot.</p>
</section>

<section data-section-color="peach">
  <h2 data-section-color="peach" id="section-3">Study Tools at the Bottom</h2>
  <p>After the AI finishes generating your notes, scroll down past all the text. Below the notes you will see additional study tools. These tools are generated from the same material as your notes.</p>
  <p>The tools include a quiz with multiple-choice questions, a mind map that shows how concepts connect, and a flow chart that shows sequences of steps.</p>
</section>
</div>`,

  bulleted_literal: `<div>
<h1>Welcome to Brain-Friendly Notes</h1>

<section data-section-color="sage">
  <h2 data-section-color="sage" id="section-1">How Your Notes Work</h2>
  <ul>
    <li>You upload a file or paste text into the app</li>
    <li>The AI reads it and creates a new formatted version</li>
    <li>The new version has colored backgrounds, bold words, and short paragraphs</li>
    <li>Each topic section has a different color so your brain knows when a new topic starts</li>
  </ul>
</section>

<section data-section-color="lavender">
  <h2 data-section-color="lavender" id="section-2">The Text Selection Menu</h2>
  <ul>
    <li>Click and drag your mouse across text to select it</li>
    <li>A small menu appears near the selected text</li>
    <li>One button asks the AI to explain the text in more detail</li>
    <li>Another button creates a note you can pin to that spot</li>
  </ul>
</section>

<section data-section-color="peach">
  <h2 data-section-color="peach" id="section-3">Study Tools at the Bottom</h2>
  <ul>
    <li>Scroll below your notes to find the study tools</li>
    <li>There is a quiz with multiple-choice questions about your material</li>
    <li>There is a mind map showing how the concepts connect</li>
    <li>There is a flow chart showing step-by-step sequences</li>
  </ul>
</section>
</div>`,

  procedural: `<div>
<h1>Welcome to Brain-Friendly Notes</h1>

<section data-section-color="sage">
  <h2 data-section-color="sage" id="section-1">Step 1: Upload Your Material</h2>
  <h3>Prerequisites</h3>
  <p>You need a PDF, Word document, or text you want to study.</p>
  <h3>Action</h3>
  <p>Click the <strong>Upload File</strong> tab. Drag your file into the upload zone, or click the zone to open a file browser. Select your file. The app will read it automatically.</p>
  <h3>Result</h3>
  <p>Your file name appears below the upload zone with a checkmark.</p>
</section>

<section data-section-color="lavender">
  <h2 data-section-color="lavender" id="section-2">Step 2: Generate Your Notes</h2>
  <h3>Prerequisites</h3>
  <p>Step 1 must be complete. Your file must be visible in the upload zone.</p>
  <h3>Action</h3>
  <p>Click the large <strong>"Turn into Brain-Friendly Notes"</strong> button at the bottom of the page. Wait for the AI to finish generating. You will see text appear in real-time.</p>
  <h3>Result</h3>
  <p>Your notes appear with colored sections, bold terms, and structured formatting.</p>
</section>

<section data-section-color="peach">
  <h2 data-section-color="peach" id="section-3">Step 3: Use Your Study Tools</h2>
  <h3>Prerequisites</h3>
  <p>Step 2 must be complete. Notes must be fully generated (loading spinner gone).</p>
  <h3>Action</h3>
  <p>Highlight any text to open the selection menu. Scroll below the notes to find the retention quiz, mind map, and flow chart.</p>
  <h3>Result</h3>
  <p>You can now interact with your material through quizzes, visual maps, and targeted explanations.</p>
</section>
</div>`,
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
