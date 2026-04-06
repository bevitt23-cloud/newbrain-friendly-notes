import { useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, FolderPlus, Pencil, Trash2, Library, CheckSquare, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { buildFolderTree, type FolderTreeNode } from "@/lib/folderUtils";
import { DEFAULT_FOLDER } from "@/lib/constants";

interface FolderTreeProps {
  folderCounts: Record<string, number>;
  totalNoteCount: number;
  selectedFolder: string | null;
  onSelect: (folder: string | null) => void;
  onRename: (oldName: string) => void;
  onDelete: (folderName: string) => void;
  onCreate: () => void;
  /** Multi-select mode */
  selectMode?: boolean;
  selectedFolders?: Set<string>;
  onToggleFolderSelect?: (folder: string) => void;
}

interface TreeNodeProps {
  node: FolderTreeNode;
  depth: number;
  selectedFolder: string | null;
  onSelect: (folder: string | null) => void;
  onRename: (oldName: string) => void;
  onDelete: (folderName: string) => void;
  selectMode?: boolean;
  selectedFolders?: Set<string>;
  onToggleFolderSelect?: (folder: string) => void;
}

const TreeNode = ({ node, depth, selectedFolder, onSelect, onRename, onDelete, selectMode, selectedFolders, onToggleFolderSelect }: TreeNodeProps) => {
  const [expanded, setExpanded] = useState(true);
  const isActive = selectedFolder === node.fullPath;
  const hasChildren = node.children.length > 0;
  const isDefault = node.fullPath === DEFAULT_FOLDER;
  const isFolderSelected = selectedFolders?.has(node.fullPath) ?? false;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm cursor-pointer transition-all duration-150 ${
          isFolderSelected
            ? "bg-primary/10 text-primary ring-1 ring-primary/20"
            : isActive
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => selectMode && onToggleFolderSelect ? onToggleFolderSelect(node.fullPath) : onSelect(isActive ? null : node.fullPath)}
      >
        {/* Select checkbox */}
        {selectMode && !isDefault && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFolderSelect?.(node.fullPath); }}
            className="shrink-0"
          >
            {isFolderSelected ? (
              <CheckSquare className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Square className="h-3.5 w-3.5 text-muted-foreground/40" />
            )}
          </button>
        )}

        {/* Expand/collapse arrow */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground/60 hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Folder icon */}
        {isActive ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <Folder className="h-4 w-4 shrink-0" />
        )}

        {/* Name */}
        <span className="truncate flex-1 text-[13px]">{node.name}</span>

        {/* Note count */}
        <span className={`text-[10px] shrink-0 ${isActive ? "text-primary/60" : "text-muted-foreground/50"}`}>
          {node.totalNoteCount}
        </span>

        {/* Actions — always visible for non-default folders */}
        {!isDefault && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onRename(node.fullPath); }}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted hover:text-foreground"
              title="Rename"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(node.fullPath); }}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
              title="Delete folder"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {hasChildren && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <TreeNode
                key={child.fullPath}
                node={child}
                depth={depth + 1}
                selectedFolder={selectedFolder}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
                selectMode={selectMode}
                selectedFolders={selectedFolders}
                onToggleFolderSelect={onToggleFolderSelect}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FolderTree = ({
  folderCounts,
  totalNoteCount,
  selectedFolder,
  onSelect,
  onRename,
  onDelete,
  onCreate,
  selectMode,
  selectedFolders,
  onToggleFolderSelect,
}: FolderTreeProps) => {
  const tree = buildFolderTree(folderCounts);

  return (
    <div className="flex flex-col gap-1">
      {/* Header */}
      <div className="flex items-center justify-between px-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          Folders
        </span>
        <button
          onClick={onCreate}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
          title="New folder"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* All Notes */}
      <div
        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer transition-all duration-150 ${
          selectedFolder === null
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        }`}
        onClick={() => onSelect(null)}
      >
        <Library className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-[13px]">All Notes</span>
        <span className={`text-[10px] ${selectedFolder === null ? "text-primary/60" : "text-muted-foreground/50"}`}>
          {totalNoteCount}
        </span>
      </div>

      {/* Tree */}
      {tree.map((node) => (
        <TreeNode
          key={node.fullPath}
          node={node}
          depth={0}
          selectedFolder={selectedFolder}
          onSelect={onSelect}
          onRename={onRename}
          onDelete={onDelete}
          selectMode={selectMode}
          selectedFolders={selectedFolders}
          onToggleFolderSelect={onToggleFolderSelect}
        />
      ))}
    </div>
  );
};

export default FolderTree;
