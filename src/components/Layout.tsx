import { ReactNode, useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";
import { useUserPreferences } from "@/hooks/useUserPreferences";

const FONT_MAP: Record<string, string> = {
  "font-opendyslexic": "'OpenDyslexic', sans-serif",
  "font-lexend": "'Lexend', system-ui, sans-serif",
  "font-arial": "'Arial', 'Helvetica Neue', sans-serif",
};

const Layout = ({ children }: { children: ReactNode }) => {
  const { preferences } = useUserPreferences();

  // Three-way font selection: OpenDyslexic > Lexend > Arial (default)
  let fontClass = "font-arial";

  if (preferences.dyslexia_font) {
    fontClass = "font-opendyslexic";
  } else if (preferences.adhd_font) {
    fontClass = "font-lexend";
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
