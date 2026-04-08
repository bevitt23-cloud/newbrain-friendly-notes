import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder, Star, FileText, BookOpen, MoreVertical, Trash2,
  Eye, RotateCcw, GraduationCap, CheckSquare, Square, Sparkles, ExternalLink,
  Map, GitBranch, Layers, MessageCircle, MoveRight,
  CheckCheck, Menu,
} from "lucide-react";
import type { StudyToolType } from "@/hooks/useStudyToolGeneration";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFunFacts } from "@/hooks/useFunFacts";
import { DEFAULT_FOLDER } from "@/lib/constants";
import { matchesFolderOrDescendant } from "@/lib/folderUtils";
import FolderTree from "@/components/library/FolderTree";
import LibraryHeader from "@/components/library/LibraryHeader";
import NoteCard from "@/components/library/NoteCard";

interface SavedNote {
  id: string;
  title: string;
  content: string | null;
  category_id: string | null;
  is_favorite: boolean;
  source_type: string;
  learning_mode: string;
  tags: string[];
  folder: string;
  created_at: string;
  updated_at: string;
}

interface SavedMaterial {
  id: string;
  title: string;
  material_type: string;
  content: Record<string, unknown>;
  category_id: string | null;
  is_favorite: boolean;
  note_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const Library = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [materials, setMaterials] = useState<SavedMaterial[]>([]);
  const [search, setSearch] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    return (localStorage.getItem("library-view-mode") as "grid" | "list") || "grid";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("library-view-mode", mode);
  };

  const PAGE_SIZE = 20;
  const [visibleNoteCount, setVisibleNoteCount] = useState(PAGE_SIZE);
  const [visibleMaterialCount, setVisibleMaterialCount] = useState(PAGE_SIZE);

  // Bulk action state
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);

  // New folder state
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Rename / delete folder state
  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
  const [renameFolderOldName, setRenameFolderOldName] = useState("");
  const [renameFolderNewName, setRenameFolderNewName] = useState("");
  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState("");

  // View handlers — navigate to full-screen review
  const viewNote = (note: SavedNote) => {
    if (!note.content) return;
    navigate("/library/review", {
      state: {
        items: [{ id: note.id, title: note.title, type: "note" as const, content: note.content, noteId: note.id }],
      },
    });
  };

  const viewMaterial = (mat: SavedMaterial) => {
    const raw = typeof mat.content?.raw === "string" ? mat.content.raw : JSON.stringify(mat.content);
    navigate("/library/review", {
      state: {
        items: [{
          id: mat.id,
          title: mat.title,
          type: "material" as const,
          materialType: mat.material_type,
          content: raw as string,
          rawContent: mat.content,
        }],
      },
    });
  };

  // Multi-select for study session
  const [selectMode, setSelectMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [selectStep, setSelectStep] = useState<"notes" | "tools">("notes");
  const [selectedTools, setSelectedTools] = useState<Set<StudyToolType>>(new Set());

  const availableTools: { id: StudyToolType; label: string; icon: typeof Map }[] = [
    { id: "mindmap", label: "Mind Map", icon: Map },
    { id: "flowchart", label: "Flow Chart", icon: GitBranch },
    { id: "flashcard", label: "Flash Cards", icon: Layers },
    { id: "cloze", label: "Fill-in-the-Blank", icon: FileText },
    { id: "socratic", label: "Argue With Me", icon: MessageCircle },
    { id: "final-exam", label: "Final Exam", icon: GraduationCap },
  ];

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchNotes();
      fetchMaterials();
    }
  }, [user]);

  const fetchNotes = async () => {
    const { data } = await supabase.from("saved_notes").select("*").order("updated_at", { ascending: false });
    if (data) setNotes(data);
  };

  const fetchMaterials = async () => {
    const { data } = await supabase.from("saved_study_materials").select("*").order("updated_at", { ascending: false });
    if (data) setMaterials(data as SavedMaterial[]);
  };

  const toggleNoteFavorite = async (note: SavedNote) => {
    await supabase.from("saved_notes").update({ is_favorite: !note.is_favorite }).eq("id", note.id);
    fetchNotes();
  };

  const toggleMaterialFavorite = async (mat: SavedMaterial) => {
    await supabase.from("saved_study_materials").update({ is_favorite: !mat.is_favorite }).eq("id", mat.id);
    fetchMaterials();
  };

  const deleteNote = async (id: string) => {
    await supabase.from("saved_notes").delete().eq("id", id);
    toast.success("Note deleted");
    fetchNotes();
  };

  const deleteMaterial = async (id: string) => {
    await supabase.from("saved_study_materials").delete().eq("id", id);
    toast.success("Material deleted");
    fetchMaterials();
  };

  const filterItems = <T extends { title: string; is_favorite: boolean; tags?: string[]; folder?: string }>(items: T[]) => {
    return items.filter((item) => {
      // Hide system placeholder records
      if (item.title === ".folder_metadata") return false;
      const searchLower = search.toLowerCase();
      const matchTitle = !search || item.title.toLowerCase().includes(searchLower);
      const matchTag = !search || (item.tags || []).some((t) => t.toLowerCase().includes(searchLower.replace(/^#/, "")));
      const matchSearch = matchTitle || matchTag;
      const matchFavorite = !showFavoritesOnly || item.is_favorite;
      const matchFolder = matchesFolderOrDescendant(item.folder || "", selectedFolder);
      return matchSearch && matchFavorite && matchFolder;
    });
  };

  const filteredNotes = filterItems(notes);
  const filteredMaterials = filterItems(materials);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleNoteCount(PAGE_SIZE);
    setVisibleMaterialCount(PAGE_SIZE);
  }, [search, showFavoritesOnly, selectedFolder]);

  // Derive folders dynamically from saved notes (excluding placeholder metadata records)
  const usedFolders = Array.from(new Set(notes.map((n) => n.folder).filter(Boolean)));
  const allFolders = usedFolders.includes(DEFAULT_FOLDER) ? usedFolders : [DEFAULT_FOLDER, ...usedFolders];

  // Build folder counts for the tree component
  const folderCounts: Record<string, number> = {};
  for (const n of notes) {
    if (n.title === ".folder_metadata") {
      // Ensure empty folders appear in the tree
      if (!folderCounts[n.folder]) folderCounts[n.folder] = 0;
    } else {
      folderCounts[n.folder] = (folderCounts[n.folder] || 0) + 1;
    }
  }
  const totalNoteCount = notes.filter((n) => n.title !== ".folder_metadata").length;

  const toggleFolderSelect = (folder: string) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder); else next.add(folder);
      return next;
    });
  };

  // Bulk action handlers
  const handleBulkDelete = async () => {
    const noteIds = Array.from(selectedNoteIds);
    const matIds = Array.from(selectedMaterialIds);
    if (noteIds.length > 0) await supabase.from("saved_notes").delete().in("id", noteIds);
    if (matIds.length > 0) await supabase.from("saved_study_materials").delete().in("id", matIds);

    // Delete selected folders (move notes to Unsorted, remove metadata)
    for (const folder of selectedFolders) {
      const notesInFolder = notes.filter((n) => n.folder === folder);
      for (const n of notesInFolder) {
        if (n.title === ".folder_metadata") {
          await supabase.from("saved_notes").delete().eq("id", n.id);
        } else {
          await supabase.from("saved_notes").update({ folder: DEFAULT_FOLDER }).eq("id", n.id);
        }
      }
    }

    const totalDeleted = noteIds.length + matIds.length + selectedFolders.size;
    toast.success(`Deleted ${totalDeleted} item${totalDeleted !== 1 ? "s" : ""}${selectedFolders.size > 0 ? ` (${selectedFolders.size} folder${selectedFolders.size > 1 ? "s" : ""} — notes moved to Unsorted)` : ""}`);
    setSelectedNoteIds(new Set());
    setSelectedMaterialIds(new Set());
    setSelectedFolders(new Set());
    setBulkDeleteConfirm(false);
    fetchNotes();
    fetchMaterials();
  };

  const handleBulkMoveFolder = async (folder: string) => {
    // Move individually selected notes
    const noteIds = Array.from(selectedNoteIds);
    for (const id of noteIds) {
      await supabase.from("saved_notes").update({ folder }).eq("id", id);
    }

    // Move all notes from selected folders
    let folderNoteCount = 0;
    for (const srcFolder of selectedFolders) {
      const notesInFolder = notes.filter((n) => n.folder === srcFolder && n.title !== ".folder_metadata");
      for (const n of notesInFolder) {
        await supabase.from("saved_notes").update({ folder }).eq("id", n.id);
        folderNoteCount++;
      }
    }

    const totalMoved = noteIds.length + folderNoteCount;
    toast.success(`Moved ${totalMoved} note${totalMoved !== 1 ? "s" : ""} to ${folder}`);
    setSelectedNoteIds(new Set());
    setSelectedFolders(new Set());
    setBulkMoveOpen(false);
    fetchNotes();
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (allFolders.includes(name)) {
      toast.error("A folder with that name already exists");
      return;
    }
    if (!user) return;
    setCreatingFolder(true);
    // Insert a hidden placeholder so the folder persists even if empty
    const { error: err } = await supabase.from("saved_notes").insert({
      user_id: user.id,
      title: ".folder_metadata",
      content: null,
      folder: name,
      source_type: "system",
    });
    if (err) {
      toast.error("Failed to create folder");
    } else {
      toast.success(`Folder "${name}" created`);
      fetchNotes();
    }
    setCreatingFolder(false);
    setNewFolderName("");
    setNewFolderDialogOpen(false);
  };

  const moveNoteToFolder = async (noteId: string, folder: string) => {
    await supabase.from("saved_notes").update({ folder }).eq("id", noteId);
    toast.success(`Moved to ${folder}`);
    fetchNotes();
  };

  const handleRenameFolder = async () => {
    const newName = renameFolderNewName.trim();
    if (!newName || newName === renameFolderOldName) return;
    if (allFolders.includes(newName)) {
      toast.error("A folder with that name already exists");
      return;
    }
    // Update all notes in the old folder to the new name
    const notesInFolder = notes.filter((n) => n.folder === renameFolderOldName);
    for (const n of notesInFolder) {
      await supabase.from("saved_notes").update({ folder: newName }).eq("id", n.id);
    }
    toast.success(`Renamed folder to "${newName}"`);
    if (selectedFolder === renameFolderOldName) setSelectedFolder(newName);
    setRenameFolderDialogOpen(false);
    fetchNotes();
  };

  const handleDeleteFolder = async () => {
    // Move all real notes to Unsorted, then delete placeholder records
    const notesInFolder = notes.filter((n) => n.folder === deleteFolderTarget);
    for (const n of notesInFolder) {
      if (n.title === ".folder_metadata") {
        await supabase.from("saved_notes").delete().eq("id", n.id);
      } else {
        await supabase.from("saved_notes").update({ folder: DEFAULT_FOLDER }).eq("id", n.id);
      }
    }
    toast.success(`Folder "${deleteFolderTarget}" deleted — notes moved to Unsorted`);
    if (selectedFolder === deleteFolderTarget) setSelectedFolder(null);
    setDeleteFolderDialogOpen(false);
    fetchNotes();
  };

  const handleBulkGenerateStudyTools = () => {
    const noteIds = new Set(selectedNoteIds);
    const items = notes.filter((n) => noteIds.has(n.id) && n.content).map((n) => ({
      id: n.id, title: n.title, type: "note" as const, content: n.content!,
    }));
    if (!items.length) { toast.error("Selected notes have no content"); return; }
    setSelectStep("tools");
  };

  const selectAllNotes = () => {
    setSelectedNoteIds(new Set(filteredNotes.map((n) => n.id)));
  };
  const selectAllMaterials = () => {
    setSelectedMaterialIds(new Set(filteredMaterials.map((m) => m.id)));
  };
  const deselectAll = () => {
    setSelectedNoteIds(new Set());
    setSelectedMaterialIds(new Set());
    setSelectedFolders(new Set());
  };

  // Multi-select handlers
  const toggleNoteSelect = (id: string) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleMaterialSelect = (id: string) => {
    setSelectedMaterialIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const totalSelected = selectedNoteIds.size + selectedMaterialIds.size + selectedFolders.size;

  const handleStartStudySession = () => {
    const noteIds = new Set(selectedNoteIds);

    const items: { id: string; title: string; type: "note" | "material"; materialType?: string; content: string; rawContent?: Record<string, unknown> }[] = [];

    notes.filter((n) => noteIds.has(n.id)).forEach((n) => {
      if (n.content) items.push({ id: n.id, title: n.title, type: "note", content: n.content });
    });

    materials.filter((m) => selectedMaterialIds.has(m.id)).forEach((m) => {
      const raw = typeof m.content?.raw === "string" ? m.content.raw : JSON.stringify(m.content);
      items.push({ id: m.id, title: m.title, type: "material", materialType: m.material_type, content: raw as string, rawContent: m.content });
    });

    if (!items.length) {
      toast.error("Selected items have no content");
      return;
    }

    const toolsToGenerate = Array.from(selectedTools) as string[];
    navigate("/library/review", { state: { items, toolsToGenerate } });
  };

  const toggleToolSelect = (id: StudyToolType) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  if (authLoading) return null;

  const folderSidebarContent = (
    <FolderTree
      folderCounts={folderCounts}
      totalNoteCount={totalNoteCount}
      selectedFolder={selectedFolder}
      onSelect={(f) => { setSelectedFolder(f); setSidebarOpen(false); }}
      onRename={(oldName) => {
        setRenameFolderOldName(oldName);
        setRenameFolderNewName(oldName);
        setRenameFolderDialogOpen(true);
      }}
      onDelete={(name) => {
        setDeleteFolderTarget(name);
        setDeleteFolderDialogOpen(true);
      }}
      onCreate={() => setNewFolderDialogOpen(true)}
      selectMode={selectMode}
      selectedFolders={selectedFolders}
      onToggleFolderSelect={toggleFolderSelect}
    />
  );

  return (
    <Layout>
      <div className="container max-w-6xl py-6">
        <LibraryHeader
          selectedFolder={selectedFolder}
          onFolderClick={setSelectedFolder}
          search={search}
          onSearchChange={setSearch}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          showFavoritesOnly={showFavoritesOnly}
          onFavoritesToggle={() => setShowFavoritesOnly(!showFavoritesOnly)}
          selectMode={selectMode}
          onSelectModeToggle={() => {
            setSelectMode(!selectMode);
            setSelectStep("notes");
            setSelectedTools(new Set());
            if (selectMode) {
              setSelectedNoteIds(new Set());
              setSelectedMaterialIds(new Set());
              setSelectedFolders(new Set());
            }
          }}
          selectedCount={totalSelected}
        />

        {/* Bulk Action Toolbar */}
        <AnimatePresence>
          {selectMode && selectStep === "notes" && totalSelected > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 sticky top-16 z-20 rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-sm p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg"
            >
              <p className="text-sm font-medium text-foreground">
                {totalSelected} item{totalSelected > 1 ? "s" : ""} selected
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkDeleteConfirm(true)}
                  className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
                {(selectedNoteIds.size > 0 || selectedFolders.size > 0) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkMoveOpen(true)}
                    className="gap-1.5"
                  >
                    <MoveRight className="h-3.5 w-3.5" /> Move
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleBulkGenerateStudyTools}
                  className="gap-1.5 rounded-xl bg-gradient-to-r from-sage-600 to-sage-500 text-white shadow-md"
                >
                  <GraduationCap className="h-3.5 w-3.5" /> Generate Study Tools
                </Button>
              </div>
            </motion.div>
          )}

          {selectMode && selectStep === "tools" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Select study tools to generate</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pick the tools you'd like, then start your session</p>
                </div>
                <button
                  onClick={() => setSelectStep("notes")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Back to selection
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableTools.map((tool) => {
                  const isSelected = selectedTools.has(tool.id);
                  return (
                    <button
                      key={tool.id}
                      onClick={() => toggleToolSelect(tool.id)}
                      className={`group rounded-xl border p-3 text-left transition-all duration-200 hover:shadow-md ${
                        isSelected
                          ? "border-primary/30 bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                          : "border-border bg-card hover:bg-muted/50"
                      }`}
                    >
                      <tool.icon className={`h-4 w-4 mb-1.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <p className={`text-xs font-semibold ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>{tool.label}</p>
                    </button>
                  );
                })}
              </div>
              <Button
                disabled={selectedTools.size === 0}
                onClick={handleStartStudySession}
                className="w-full gap-1.5 rounded-xl bg-gradient-to-r from-sage-600 to-sage-500 text-white shadow-md"
              >
                <GraduationCap className="h-4 w-4" />
                Generate {selectedTools.size > 0 ? `${selectedTools.size} Tool${selectedTools.size > 1 ? "s" : ""}` : "Tools"} & Start Session
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-6 flex-col lg:flex-row">
          {/* Sidebar: Folder Tree — hidden on mobile, shown in sheet */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-20 rounded-xl border border-border/50 bg-card p-3">
              {folderSidebarContent}
            </div>
          </aside>

          {/* Mobile sidebar toggle */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <button className="lg:hidden flex items-center gap-2 rounded-xl border border-border/50 bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Menu className="h-4 w-4" />
                {selectedFolder || "All Folders"}
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4 pt-10">
              {folderSidebarContent}
            </SheetContent>
          </Sheet>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="notes">
              <TabsList className="mb-4">
                <TabsTrigger value="notes" className="gap-2">
                  <FileText className="h-4 w-4" /> Notes ({filteredNotes.length})
                </TabsTrigger>
                <TabsTrigger value="materials" className="gap-2">
                  <BookOpen className="h-4 w-4" /> Study Materials ({filteredMaterials.length})
                </TabsTrigger>
                <TabsTrigger value="funfacts" className="gap-2">
                  <Sparkles className="h-4 w-4" /> Fun Facts
                </TabsTrigger>
              </TabsList>

              <TabsContent value="notes">
                {selectMode && filteredNotes.length > 0 && (
                  <div className="mb-3 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectedNoteIds.size === filteredNotes.length ? deselectAll : selectAllNotes}
                      className="gap-1.5 text-xs"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      {selectedNoteIds.size === filteredNotes.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                )}
                {filteredNotes.length === 0 ? (
                  <EmptyState type="notes" />
                ) : (
                  <div className={viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                    : "flex flex-col gap-2"
                  }>
                    <AnimatePresence>
                      {filteredNotes.slice(0, visibleNoteCount).map((note) => (
                        <motion.div
                          key={note.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                        >
                          <NoteCard
                            note={note}
                            viewMode={viewMode}
                            onView={() => viewNote(note)}
                            onFavorite={() => toggleNoteFavorite(note)}
                            onDelete={() => deleteNote(note.id)}
                            onMove={(id, folder) => moveNoteToFolder(id, folder)}
                            selectMode={selectMode}
                            selected={selectedNoteIds.has(note.id)}
                            onToggleSelect={() => toggleNoteSelect(note.id)}
                            folders={allFolders}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {filteredNotes.length > visibleNoteCount && (
                      <Button
                        variant="outline"
                        onClick={() => setVisibleNoteCount((c) => c + PAGE_SIZE)}
                        className={`mt-2 ${viewMode === "grid" ? "col-span-full" : ""}`}
                      >
                        Load more ({filteredNotes.length - visibleNoteCount} remaining)
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="materials">
                {selectMode && filteredMaterials.length > 0 && (
                  <div className="mb-3 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectedMaterialIds.size === filteredMaterials.length ? deselectAll : selectAllMaterials}
                      className="gap-1.5 text-xs"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      {selectedMaterialIds.size === filteredMaterials.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                )}
                {filteredMaterials.length === 0 ? (
                  <EmptyState type="materials" />
                ) : (
                  <div className="grid gap-3">
                    <AnimatePresence>
                      {filteredMaterials.slice(0, visibleMaterialCount).map((mat) => (
                        <MaterialCard
                          key={mat.id}
                          material={mat}
                          onToggleFavorite={() => toggleMaterialFavorite(mat)}
                          onDelete={() => deleteMaterial(mat.id)}
                          onView={() => viewMaterial(mat)}
                          onRegenerate={() => {
                            const linkedNote = mat.note_id ? notes.find((n) => n.id === mat.note_id) : null;
                            if (linkedNote?.content) {
                              navigate("/library/study", { state: { notesHtml: linkedNote.content, noteTitle: linkedNote.title } });
                            } else {
                              toast.error("Source notes not found. Generate from the home page.");
                            }
                          }}
                          selectMode={selectMode}
                          isSelected={selectedMaterialIds.has(mat.id)}
                          onToggleSelect={() => toggleMaterialSelect(mat.id)}
                        />
                      ))}
                    </AnimatePresence>
                    {filteredMaterials.length > visibleMaterialCount && (
                      <Button
                        variant="outline"
                        onClick={() => setVisibleMaterialCount((c) => c + PAGE_SIZE)}
                        className="w-full mt-2"
                      >
                        Load more ({filteredMaterials.length - visibleMaterialCount} remaining)
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="funfacts">
                <FunFactsTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Bulk Delete Confirm */}
      <Dialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {totalSelected} items?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Move Folder */}
      <Dialog open={bulkMoveOpen} onOpenChange={setBulkMoveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Move {selectedNoteIds.size} notes to folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {allFolders.map((f) => (
              <button
                key={f}
                onClick={() => handleBulkMoveFolder(f)}
                className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Folder className="h-4 w-4 text-muted-foreground" />
                <span>{f}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <Input
            id="new-folder-name"
            name="newFolderName"
            placeholder="Folder name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}>
              {creatingFolder ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={renameFolderDialogOpen} onOpenChange={setRenameFolderDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <Input
            id="rename-folder-name"
            name="renameFolderName"
            placeholder="New folder name..."
            value={renameFolderNewName}
            onChange={(e) => setRenameFolderNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRenameFolder()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFolderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRenameFolder} disabled={!renameFolderNewName.trim() || renameFolderNewName.trim() === renameFolderOldName}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Dialog */}
      <Dialog open={deleteFolderDialogOpen} onOpenChange={setDeleteFolderDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete folder "{deleteFolderTarget}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            All notes in this folder will be moved to <strong>Unsorted</strong>. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFolderDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteFolder}>Delete Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Layout>
  );
};

// Fun Facts tab component
const FunFactsTab = () => {
  const { savedFacts, removeFact } = useFunFacts();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(savedFacts.map((f) => f.id)));
  const deselectAllFacts = () => setSelectedIds(new Set());

  const handleBulkDelete = () => {
    for (const id of selectedIds) removeFact(id);
    setSelectedIds(new Set());
  };

  if (savedFacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <Sparkles className="h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 font-medium text-muted-foreground">No fun facts saved yet</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Click "Fun Fact!" links in your notes to discover and save interesting facts
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Select all / bulk actions bar */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={selectedIds.size === savedFacts.length ? deselectAllFacts : selectAll}
          className="gap-1.5 text-xs"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          {selectedIds.size === savedFacts.length ? "Deselect All" : "Select All"}
        </Button>
        {selectedIds.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBulkDelete}
            className="gap-1.5 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete {selectedIds.size} selected
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        <AnimatePresence>
          {savedFacts.map((ff) => {
            const isSelected = selectedIds.has(ff.id);
            return (
              <motion.div
                key={ff.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => toggleSelect(ff.id)}
                className={`group rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${
                  isSelected ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(ff.id); }}
                    className="shrink-0 mt-0.5"
                  >
                    {isSelected
                      ? <CheckSquare className="h-5 w-5 text-primary" />
                      : <Square className="h-5 w-5 text-muted-foreground/40" />
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed text-foreground">{ff.fact}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <a
                        href={ff.searchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Learn more: {ff.searchQuery}
                      </a>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(ff.savedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFact(ff.id); }}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Sub-components
const EmptyState = ({ type }: { type: "notes" | "materials" }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
    {type === "notes" ? <FileText className="h-10 w-10 text-muted-foreground/40" /> : <BookOpen className="h-10 w-10 text-muted-foreground/40" />}
    <p className="mt-3 font-medium text-muted-foreground">No {type} yet</p>
    <p className="mt-1 text-sm text-muted-foreground/70">
      {type === "notes" ? "Generate notes from the home page to see them here" : "Create flashcards or quizzes to see them here"}
    </p>
  </div>
);

interface MaterialCardProps {
  material: SavedMaterial;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onView: () => void;
  onRegenerate: () => void;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}

const MaterialCard = ({ material, onToggleFavorite, onDelete, onView, onRegenerate, selectMode, isSelected, onToggleSelect }: MaterialCardProps) => {
  const typeLabel: Record<string, string> = {
    flashcard: "🃏 Flash Cards",
    mindmap: "🗺️ Mind Map",
    flowchart: "📊 Flow Chart",
    cloze: "📝 Fill-in-the-Blank",
    socratic: "💬 Debate",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-all ${
        isSelected ? "border-primary/30 ring-1 ring-primary/20" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {selectMode && (
          <button onClick={onToggleSelect} className="mt-1 shrink-0">
            {isSelected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
          </button>
        )}
        <div className="min-w-0 flex-1 cursor-pointer" onClick={onView}>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-full bg-lavender-100 dark:bg-lavender-500/15 px-2 py-0.5 text-xs font-medium text-lavender-500 dark:text-lavender-300">
              {typeLabel[material.material_type] || material.material_type}
            </span>
          </div>
          <h3 className="font-semibold text-foreground truncate">{material.title}</h3>
          {material.tags && material.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {material.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-lavender-50 dark:bg-lavender-500/10 border border-lavender-200 dark:border-lavender-200/30 px-2 py-0.5 text-[10px] font-medium text-lavender-500 dark:text-lavender-300">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground/60">
            {new Date(material.updated_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onView} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="View">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={onRegenerate} className="rounded-md p-1.5 text-muted-foreground hover:text-primary transition-colors" title="Regenerate">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button onClick={onToggleFavorite} className="rounded-md p-1.5 text-muted-foreground hover:text-amber-500 transition-colors">
            <Star className={`h-4 w-4 ${material.is_favorite ? "fill-amber-400 text-amber-400" : ""}`} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
};

export default Library;
