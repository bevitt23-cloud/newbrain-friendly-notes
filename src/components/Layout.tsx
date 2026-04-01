import { ReactNode, useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";
import { useUserPreferences } from "@/hooks/useUserPreferences";

const FONT_MAP: Record<string, string> = {
  "font-opendyslexic": "'OpenDyslexic', sans-serif",
  "font-lexend": "'Lexend', system-ui, sans-serif",
  "font-sans": "'Inter', system-ui, sans-serif",
};

const Layout = ({ children }: { children: ReactNode }) => {
  const { preferences } = useUserPreferences();

  // Establish the Font Hierarchy
  let fontClass = "font-sans"; // The fallback default

  if (preferences.dyslexia_font) {
    fontClass = "font-opendyslexic"; // Highest priority
  } else if (preferences.adhd_font) {
    fontClass = "font-lexend"; // Second priority
  }

  // Apply font and dyslexia body class
  useEffect(() => {
    document.body.style.fontFamily = FONT_MAP[fontClass] || FONT_MAP["font-sans"];
    document.body.classList.toggle("dyslexia-active", fontClass === "font-opendyslexic");
  }, [fontClass]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
};

export default Layout;
