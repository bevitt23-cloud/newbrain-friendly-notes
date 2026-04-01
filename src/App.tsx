import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { FunFactProvider } from "@/hooks/useFunFacts";
import { NotesProvider } from "@/hooks/useNotesContext";
import { UserPreferencesProvider } from "@/hooks/useUserPreferences";
import Index from "./pages/Index.tsx";
import About from "./pages/About.tsx";
import Support from "./pages/Support.tsx";
import Privacy from "./pages/Privacy.tsx";
import Auth from "./pages/Auth.tsx";
import Library from "./pages/Library.tsx";
import CognitiveWizard from "./pages/CognitiveWizard.tsx";
import LibraryStudySession from "./pages/LibraryStudySession.tsx";
import StudyReview from "./pages/StudyReview.tsx";
import Insights from "./pages/Insights.tsx";
import AdminResearch from "./pages/AdminResearch.tsx";
import Settings from "./pages/Settings.tsx";
import NotFound from "./pages/NotFound.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";

const ADMIN_EMAIL = "adhdnotemodifier@gmail.com";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserPreferencesProvider>
        <NotesProvider>
        <FunFactProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/support" element={<Support />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/library" element={<ProtectedRoute><Library /></ProtectedRoute>} />
              <Route path="/setup" element={<ProtectedRoute><CognitiveWizard /></ProtectedRoute>} />
              <Route path="/library/study" element={<ProtectedRoute><LibraryStudySession /></ProtectedRoute>} />
              <Route path="/library/review" element={<ProtectedRoute><StudyReview /></ProtectedRoute>} />
              <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
              <Route path="/admin/research" element={<ProtectedRoute adminOnly adminEmail={ADMIN_EMAIL}><AdminResearch /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </FunFactProvider>
        </NotesProvider>
        </UserPreferencesProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
