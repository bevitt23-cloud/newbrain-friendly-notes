import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useNoteGeneration, QuizQuestion } from "@/hooks/useNoteGeneration";
import { useAuth } from "@/hooks/useAuth";

interface NotesContextType {
  generatedHtml: string;
  isGenerating: boolean;
  error: string | null;
  uploadProgress: string;
  quizQuestions: QuizQuestion[];
  isGeneratingQuiz: boolean;
  savedNoteId: string | null;
  savedNoteTitle: string;
  setSavedNoteId: (id: string | null) => void;
  setSavedNoteTitle: (t: string) => void;
  generate: ReturnType<typeof useNoteGeneration>["generate"];
  reset: () => void;
  autoSavedRef: React.MutableRefObject<boolean>;
}

const NotesContext = createContext<NotesContextType | null>(null);

export const NotesProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const noteGen = useNoteGeneration();
  const { reset: resetNoteGen } = noteGen;
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [savedNoteTitle, setSavedNoteTitle] = useState("");
  const autoSavedRef = useRef(false);
  const prevUserId = useRef(user?.id);

  // Reset notes on sign out
  useEffect(() => {
    if (prevUserId.current && !user) {
      resetNoteGen();
      setSavedNoteId(null);
      setSavedNoteTitle("");
      autoSavedRef.current = false;
    }
    prevUserId.current = user?.id;
  }, [user, resetNoteGen]);

  const reset = useCallback(() => {
    resetNoteGen();
    autoSavedRef.current = false;
    setSavedNoteId(null);
    setSavedNoteTitle("");
  }, [resetNoteGen]);

  return (
    <NotesContext.Provider value={{
      ...noteGen,
      savedNoteId,
      savedNoteTitle,
      setSavedNoteId,
      setSavedNoteTitle,
      reset,
      autoSavedRef,
    }}>
      {children}
    </NotesContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotesContext = () => {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotesContext must be used within NotesProvider");
  return ctx;
};
