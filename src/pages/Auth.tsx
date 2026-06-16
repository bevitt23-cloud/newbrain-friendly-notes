import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

type AuthMode = "login" | "signup" | "forgot" | "reset";

// Supabase appends "#...&type=recovery" to the redirect URL when the user clicks
// a password-reset email. Detect it synchronously so we land in "reset" mode and
// don't bounce the (now-authenticated) recovery session straight to the library.
const isRecoveryUrl =
  typeof window !== "undefined" && window.location.hash.includes("type=recovery");

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>(isRecoveryUrl ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Backup detection: Supabase fires PASSWORD_RECOVERY once the recovery token is parsed.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => subscription.unsubscribe();
  }, []);

  // Redirect signed-in users away — except during password recovery, where the
  // user is technically authenticated but still needs to set a new password.
  useEffect(() => {
    if (user && mode !== "reset") navigate("/library");
  }, [user, mode, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { toast.error(error.message); return; }
        toast.success("Welcome back!");
        navigate("/library");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) { toast.error(error.message); return; }
        toast.success("Check your email to verify your account!");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        // Always show the same confirmation so we never reveal whether an email is registered.
        if (error) console.error("Password reset error:", error);
        toast.success("If that email has an account, a password reset link is on its way.");
        setMode("login");
      } else if (mode === "reset") {
        if (password !== confirmPassword) {
          toast.error("Passwords don't match.");
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) { toast.error(error.message); return; }
        toast.success("Password updated! You're all set.");
        // Clear the recovery hash and continue into the app.
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/library");
      }
    } finally {
      setLoading(false);
    }
  };

  const headings: Record<AuthMode, { title: string; subtitle: string }> = {
    login: { title: "Welcome back", subtitle: "Sign in to access your saved notes" },
    signup: { title: "Create account", subtitle: "Start saving brain-friendly notes" },
    forgot: { title: "Reset your password", subtitle: "Enter your account email and we'll send a reset link" },
    reset: { title: "Set a new password", subtitle: "Choose a new password for your account" },
  };

  const submitLabel: Record<AuthMode, string> = {
    login: "Sign In",
    signup: "Sign Up",
    forgot: "Send reset link",
    reset: "Update password",
  };

  return (
    <Layout>
      <div className="container max-w-md py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-8 shadow-xl shadow-sage-200/20 dark:shadow-none"
        >
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-foreground">{headings[mode].title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{headings[mode].subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  name="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
            )}

            {/* Email — shown for everything except the final "set new password" step */}
            {mode !== "reset" && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            )}

            {/* Password — hidden on the "forgot" (email-only) step */}
            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            )}

            {mode === "reset" && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loading..." : submitLabel[mode]}
            </Button>
          </form>

          {/* Footer navigation */}
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" && (
              <p>
                Don't have an account?{" "}
                <button onClick={() => setMode("signup")} className="font-semibold text-primary hover:underline">
                  Sign up
                </button>
              </p>
            )}
            {mode === "signup" && (
              <p>
                Already have an account?{" "}
                <button onClick={() => setMode("login")} className="font-semibold text-primary hover:underline">
                  Sign in
                </button>
              </p>
            )}
            {(mode === "forgot" || mode === "reset") && (
              <button onClick={() => setMode("login")} className="font-semibold text-primary hover:underline">
                ← Back to sign in
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Auth;
