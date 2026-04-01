import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Moon, Sun, Settings2, Info, HelpCircle, LogOut, User } from "lucide-react";
import { useTheme } from "next-themes";
import logo from "@/assets/logo.jpeg";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import LearningModeSelector from "@/components/LearningModeSelector";
import { useUserPreferences } from "@/hooks/useUserPreferences";

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const { preferences, updatePreferences } = useUserPreferences();

  const isDark = resolvedTheme === "dark";
  const toggleTheme = () => {
    const nextIsDark = !isDark;
    setTheme(nextIsDark ? "dark" : "light");
    void updatePreferences({ default_dark_mode: nextIsDark });
  };

  const learningMode = preferences.dyslexia_font ? "dyslexia" : "adhd";
  const handleModeChange = (mode: string) => {
    if (mode === "dyslexia") {
      updatePreferences({ dyslexia_font: true, adhd_font: false });
    } else {
      updatePreferences({ dyslexia_font: false, adhd_font: true });
    }
  };
  const handleBionicChange = (enabled: boolean) => {
    updatePreferences({ bionic_reading: enabled });
  };

  const handleSignOut = async () => {
    await signOut();
    setMenuOpen(false);
    navigate("/");
  };

  // Close menu on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const mainNav = [
    { label: "Upload", path: "/" },
    { label: "Insights", path: "/insights" },
    { label: "My Library", path: "/library" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-2xl backdrop-saturate-150">
      <div className="container flex h-14 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <img src={logo} alt="Brain-Friendly Notes" className="h-9 w-9 rounded-xl shadow-sm ring-1 ring-border/60 transition-shadow duration-200 group-hover:shadow-md" />
          <span className="text-base font-bold tracking-tight text-foreground">
            Brain-Friendly <span className="text-primary">Notes</span>
          </span>
        </Link>

        {/* Center nav */}
        <nav className="flex items-center gap-1">
          {mainNav.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? "bg-sage-100 text-sage-700 dark:bg-sage-700/20 dark:text-sage-300"
                  : "text-muted-foreground hover:bg-sage-50 hover:text-foreground dark:hover:bg-sage-700/10"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side: learning mode + theme toggle + hamburger */}
        <div className="flex items-center gap-2">
          <LearningModeSelector
            selectedMode={learningMode}
            onModeChange={handleModeChange}
            bionicEnabled={preferences.bionic_reading}
            onBionicChange={handleBionicChange}
          />
          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="relative flex h-6 w-11 items-center rounded-full bg-muted p-0.5 transition-colors"
          >
            <motion.div
              className="flex h-5 w-5 items-center justify-center rounded-full bg-card shadow-sm"
              animate={{ x: isDark ? 20 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              {isDark ? <Moon className="h-3 w-3 text-lavender-400" /> : <Sun className="h-3 w-3 text-peach-400" />}
            </motion.div>
          </button>

          {/* Hamburger menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border/60 bg-popover shadow-elevated overflow-hidden z-50"
                >
                  {user ? (
                    <>
                      <div className="px-4 py-3 border-b border-border/60">
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <div className="py-1">
                        <MenuLink icon={Settings2} label="Settings" onClick={() => navigate("/settings")} />
                        <MenuLink icon={Info} label="About" onClick={() => navigate("/about")} />
                        <MenuLink icon={HelpCircle} label="Support" onClick={() => navigate("/support")} />
                      </div>
                      <div className="border-t border-border/60 py-1">
                        <MenuLink icon={LogOut} label="Sign Out" onClick={handleSignOut} destructive />
                      </div>
                    </>
                  ) : (
                    <div className="py-1">
                      <MenuLink icon={Settings2} label="Settings" onClick={() => navigate("/settings")} />
                      <MenuLink icon={Info} label="About" onClick={() => navigate("/about")} />
                      <MenuLink icon={HelpCircle} label="Support" onClick={() => navigate("/support")} />
                      <div className="border-t border-border/60 py-1">
                        <MenuLink icon={User} label="Sign In" onClick={() => navigate("/auth")} />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

interface MenuLinkProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

const MenuLink = ({ icon: Icon, label, onClick, destructive }: MenuLinkProps) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors ${
      destructive
        ? "text-destructive hover:bg-destructive/10"
        : "text-foreground hover:bg-muted"
    }`}
  >
    <Icon className="h-4 w-4" />
    {label}
  </button>
);

export default Header;
