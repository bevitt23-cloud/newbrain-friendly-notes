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
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [savedNoteTitle, setSavedNoteTitle] = useState("");
  const autoSavedRef = useRef(false);
  const prevUserId = useRef(user?.id);

  // Reset notes on sign out
  useEffect(() => {
    if (prevUserId.current && !user) {
      noteGen.reset();
      setSavedNoteId(null);
      setSavedNoteTitle("");
      autoSavedRef.current = false;
    }
    prevUserId.current = user?.id;
  }, [user]);

  const reset = useCallback(() => {
    noteGen.reset();
    autoSavedRef.current = false;
    setSavedNoteId(null);
    setSavedNoteTitle("");
  }, [noteGen.reset]);

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

export const useNotesContext = () => {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error("useNotesContext must be used within NotesProvider");
  return ctx;
};
