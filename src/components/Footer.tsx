import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Heart, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Footer = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container flex flex-col items-center gap-4 py-8 text-sm text-muted-foreground md:flex-row md:justify-between">
        <p className="flex items-center gap-1.5">
          Made with <Heart className="h-3.5 w-3.5 text-primary" /> for neurodiverse learners
        </p>
        <div className="flex items-center gap-6">
          <Link to="/support" className="transition-colors hover:text-foreground">Support</Link>
          <Link to="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
          <a href="mailto:adhdnotemodifier@gmail.com" className="transition-colors hover:text-foreground">Contact</a>
          {isAdmin && (
            <Link to="/admin/research" className="transition-colors hover:text-foreground" title="Research Dashboard">
              <ShieldCheck className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
