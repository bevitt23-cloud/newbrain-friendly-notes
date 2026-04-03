import { FOLDER_SEPARATOR, DEFAULT_FOLDER } from "./constants";

/* ═══════════════════════════════════════════════════════════════
   Folder path utilities for nested folder hierarchy.

   Folders are stored as `/`-delimited path strings in the
   saved_notes.folder column:  "Biology/Campbell Biology"

   Single-segment paths ("Unsorted", "My Notes") remain valid
   as top-level folders — full backward compatibility.
   ═══════════════════════════════════════════════════════════════ */

/** Split a path string into its segments */
export function parseFolderPath(path: string): string[] {
  return path.split(FOLDER_SEPARATOR).filter(Boolean);
}

/** Join segments into a folder path */
export function buildFolderPath(...segments: string[]): string {
  return segments
    .map((s) => s.trim())
    .filter(Boolean)
    .join(FOLDER_SEPARATOR);
}

/** Get the parent folder path, or null for top-level */
export function getParentFolder(path: string): string | null {
  const segments = parseFolderPath(path);
  if (segments.length <= 1) return null;
  return segments.slice(0, -1).join(FOLDER_SEPARATOR);
}

/** Get the leaf (last segment) of a folder path */
export function getFolderLeaf(path: string): string {
  const segments = parseFolderPath(path);
  return segments[segments.length - 1] || path;
}

/** Get the top-level folder name */
export function getTopLevelFolder(path: string): string {
  return parseFolderPath(path)[0] || path;
}

/** Get depth (0-based): "Biology" = 0, "Biology/Book" = 1 */
export function getFolderDepth(path: string): number {
  return Math.max(0, parseFolderPath(path).length - 1);
}

/** Check if a path is a child/descendant of a parent path */
export function isDescendantOf(path: string, parent: string): boolean {
  return path.startsWith(parent + FOLDER_SEPARATOR);
}

/** Check if a path matches a folder or any of its descendants */
export function matchesFolderOrDescendant(
  notePath: string,
  selectedFolder: string | null
): boolean {
  if (!selectedFolder) return true; // no filter
  return notePath === selectedFolder || isDescendantOf(notePath, selectedFolder);
}

/* ─── Tree builder ─── */

export interface FolderTreeNode {
  /** Just the segment name (e.g. "Campbell Biology") */
  name: string;
  /** Full path (e.g. "Biology/Campbell Biology") */
  fullPath: string;
  /** Child folders */
  children: FolderTreeNode[];
  /** Number of notes directly in this folder */
  noteCount: number;
  /** Total notes in this folder + all descendants */
  totalNoteCount: number;
}

/**
 * Build a nested tree from a flat list of folder paths + counts.
 *
 * @param folderCounts Map of folder path → note count
 * @returns Root-level tree nodes, sorted alphabetically.
 *
 * Example input:
 *   { "Biology": 2, "Biology/Campbell Bio": 5, "Math": 1, "Unsorted": 3 }
 *
 * Example output:
 *   [
 *     { name: "Biology", fullPath: "Biology", children: [
 *       { name: "Campbell Bio", fullPath: "Biology/Campbell Bio", ... }
 *     ]},
 *     { name: "Math", fullPath: "Math", children: [] },
 *     { name: "Unsorted", fullPath: "Unsorted", children: [] },
 *   ]
 */
export function buildFolderTree(
  folderCounts: Record<string, number>
): FolderTreeNode[] {
  // Index of all nodes by full path
  const nodeMap = new Map<string, FolderTreeNode>();

  // Ensure every ancestor path exists (even if it has 0 direct notes)
  const allPaths = new Set<string>();
  for (const path of Object.keys(folderCounts)) {
    const segments = parseFolderPath(path);
    for (let i = 1; i <= segments.length; i++) {
      allPaths.add(segments.slice(0, i).join(FOLDER_SEPARATOR));
    }
  }

  // Create nodes
  for (const path of allPaths) {
    nodeMap.set(path, {
      name: getFolderLeaf(path),
      fullPath: path,
      children: [],
      noteCount: folderCounts[path] || 0,
      totalNoteCount: 0, // computed below
    });
  }

  // Build parent→child relationships
  const roots: FolderTreeNode[] = [];

  for (const [path, node] of nodeMap) {
    const parent = getParentFolder(path);
    if (parent && nodeMap.has(parent)) {
      nodeMap.get(parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children alphabetically, but keep DEFAULT_FOLDER first at root level
  const sortNodes = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.fullPath === DEFAULT_FOLDER) return -1;
      if (b.fullPath === DEFAULT_FOLDER) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);

  // Compute totalNoteCount (bottom-up)
  const computeTotals = (node: FolderTreeNode): number => {
    let sum = node.noteCount;
    for (const child of node.children) {
      sum += computeTotals(child);
    }
    node.totalNoteCount = sum;
    return sum;
  };
  for (const root of roots) {
    computeTotals(root);
  }

  return roots;
}

/**
 * Rename a folder in a path. Returns updated path.
 * Used to batch-update all notes when a folder is renamed.
 *
 * renameInPath("Biology/Campbell Bio/Ch1", "Biology", "Bio 101")
 *   → "Bio 101/Campbell Bio/Ch1"
 *
 * renameInPath("Biology/Campbell Bio", "Biology/Campbell Bio", "Biology/Campbell 12th")
 *   → "Biology/Campbell 12th"
 */
export function renameInPath(
  notePath: string,
  oldFolderPath: string,
  newFolderPath: string
): string {
  if (notePath === oldFolderPath) return newFolderPath;
  if (notePath.startsWith(oldFolderPath + FOLDER_SEPARATOR)) {
    return newFolderPath + notePath.slice(oldFolderPath.length);
  }
  return notePath; // not affected
}
