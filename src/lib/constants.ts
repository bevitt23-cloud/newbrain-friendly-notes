/** Learning mode identifiers used in note generation and UI branching */
export const LEARNING_MODE = {
  ADHD: "adhd",
  DYSLEXIA: "dyslexia",
  NEUROTYPICAL: "neurotypical",
  VISUAL: "visual",
} as const;

export type LearningMode = (typeof LEARNING_MODE)[keyof typeof LEARNING_MODE];

/** Energy mode levels for UI complexity adjustment */
export const ENERGY_MODE = {
  FULL: "full",
  MINIMAL: "minimal",
  ZEN: "zen",
} as const;

export type EnergyMode = (typeof ENERGY_MODE)[keyof typeof ENERGY_MODE];

/** Fun fact source modes */
export const FUN_FACT_MODE = {
  MATERIAL: "material",
  SPECIAL_INTEREST: "special_interest",
  CUSTOM: "custom",
} as const;

export type FunFactMode = (typeof FUN_FACT_MODE)[keyof typeof FUN_FACT_MODE];

/** Default folder name for uncategorized notes */
export const DEFAULT_FOLDER = "Unsorted";

/** Separator for nested folder paths (e.g. "Biology/Campbell Bio") */
export const FOLDER_SEPARATOR = "/";
