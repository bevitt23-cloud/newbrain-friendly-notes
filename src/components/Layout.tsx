import { ReactNode, useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import logo from "@/assets/logo.jpeg";

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
      <div className="relative">
        {/* Brain watermark behind page header area */}
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 z-0 h-[320px] w-[320px] -translate-x-1/2 -translate-y-[10%] object-contain opacity-[0.18] mix-blend-multiply dark:opacity-[0.09] dark:mix-blend-screen dark:invert"
        />
        <main className="relative z-10 flex-1">{children}</main>
      </div>
      <Footer />
    </div>
  );
};

export default Layout;
