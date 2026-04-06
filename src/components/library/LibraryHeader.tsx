import { Search, LayoutGrid, List, Star, CheckSquare, Library } from "lucide-react";
import { parseFolderPath } from "@/lib/folderUtils";

interface LibraryHeaderProps {
  selectedFolder: string | null;
  onFolderClick: (folder: string | null) => void;
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  showFavoritesOnly: boolean;
  onFavoritesToggle: () => void;
  selectMode: boolean;
  onSelectModeToggle: () => void;
  selectedCount: number;
}

const LibraryHeader = ({
  selectedFolder,
  onFolderClick,
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  showFavoritesOnly,
  onFavoritesToggle,
  selectMode,
  onSelectModeToggle,
  selectedCount,
}: LibraryHeaderProps) => {
  const breadcrumbs = selectedFolder ? parseFolderPath(selectedFolder) : [];

  return (
    <div className="mb-6 space-y-4">
      {/* Top row: title + actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sage-300 to-lavender-300 dark:from-sage-500/30 dark:to-lavender-500/30 shadow-sm">
            <Library className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">My Library</h1>
            {/* Breadcrumb */}
            {breadcrumbs.length > 0 ? (
              <nav className="flex items-center gap-1 text-xs text-muted-foreground">
                <button
                  onClick={() => onFolderClick(null)}
                  className="hover:text-foreground transition-colors"
                >
                  All
                </button>
                {breadcrumbs.map((segment, i) => {
                  const fullPath = breadcrumbs.slice(0, i + 1).join("/");
                  const isLast = i === breadcrumbs.length - 1;
                  return (
                    <span key={fullPath} className="flex items-center gap-1">
                      <span className="text-muted-foreground/40">/</span>
                      {isLast ? (
                        <span className="font-medium text-foreground">{segment}</span>
                      ) : (
                        <button
                          onClick={() => onFolderClick(fullPath)}
                          className="hover:text-foreground transition-colors"
                        >
                          {segment}
                        </button>
                      )}
                    </span>
                  );
                })}
              </nav>
            ) : (
              <p className="text-xs text-muted-foreground">All notes</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border/50 p-0.5">
            <button
              onClick={() => onViewModeChange("grid")}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                viewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground"
              }`}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onViewModeChange("list")}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground"
              }`}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Favorites */}
          <button
            onClick={onFavoritesToggle}
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all ${
              showFavoritesOnly
                ? "border-amber-300 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300"
                : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Star className={`h-3 w-3 ${showFavoritesOnly ? "fill-amber-400" : ""}`} />
            <span className="hidden sm:inline">Favorites</span>
          </button>

          {/* Select mode */}
          <button
            onClick={onSelectModeToggle}
            className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all ${
              selectMode
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <CheckSquare className="h-3 w-3" />
            <span className="hidden sm:inline">{selectMode ? `${selectedCount} selected` : "Select"}</span>
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <input
          type="text"
          placeholder="Search notes by title or #tag..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-xl border border-border/50 bg-muted/30 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:bg-card focus:ring-2 focus:ring-primary/10 transition-all"
        />
      </div>
    </div>
  );
};

export default LibraryHeader;
