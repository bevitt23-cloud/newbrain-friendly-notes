import { ReactNode, useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";
import { useUserPreferences } from "@/hooks/useUserPreferences";

const FONT_MAP: Record<string, string> = {
  "font-opendyslexic": "'OpenDyslexic', sans-serif",
  "font-lexend": "'Times New Roman', 'Times', serif",
  "font-garamond": "'EB Garamond', 'Georgia', serif",
};

const Layout = ({ children }: { children: ReactNode }) => {
  const { preferences } = useUserPreferences();

  // Three-way font selection: OpenDyslexic > Lexend > EB Garamond (default)
  let fontClass = "font-garamond";

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
