import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, BarChart3, Users, TrendingUp, Calendar,
  UserPlus, Trash2, Search, Brain, BookOpen, Layers,
  Map, GitBranch, MessageCircle, FileText, Sparkles,
  Video, CheckCircle2, XCircle, Clock, Target,
  RefreshCw,
} from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  user_id: string;
  role: string;
  email?: string;
}

interface TelemetryEvent {
  id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

interface ToolStats {
  tool: string;
  engaged: number;
  completed: number;
  abandoned: number;
  label: string;
  icon: typeof Map;
  color: string;
}

interface QuizPerformance {
  topic: string;
  correct: number;
  total: number;
  percent: number;
  date: string;
}

const TOOL_META: Record<string, { label: string; icon: typeof Map; color: string }> = {
  flashcard: { label: "Flashcards", icon: Layers, color: "text-sage-500" },
  mindmap: { label: "Mind Map", icon: Map, color: "text-lavender-500" },
  flowchart: { label: "Flow Chart", icon: GitBranch, color: "text-peach-500" },
  socratic: { label: "Argue With Me", icon: MessageCircle, color: "text-sky-300" },
  cloze: { label: "Fill-in-the-Blank", icon: FileText, color: "text-sage-600" },
  quiz: { label: "Retention Quiz", icon: CheckCircle2, color: "text-peach-400" },
  video: { label: "Video Explainer", icon: Video, color: "text-sky-400" },
  explain: { label: "Explain This", icon: Brain, color: "text-sage-400" },
};

function relativeDay(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const AdminResearch = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    const check = async () => {
      const { data } = await supabase
        .from("user_roles" as any)
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    };
    check();
  }, [user]);

  const loadAdmins = useCallback(async () => {
    const { data } = await supabase
      .from("user_roles" as any)
      .select("*")
      .eq("role", "admin");
    if (data) setAdmins(data as any[]);
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("telemetry_events" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (data) setEvents(data as unknown as TelemetryEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadEvents();
    loadAdmins();
  }, [isAdmin, loadAdmins, loadEvents]);

  // Derived stats
  const toolEngagements = events.filter((e) => e.event_type === "tool_engaged");
  const toolCompletions = events.filter((e) =>
    ["flashcard_session_complete", "cloze_session_complete", "quiz_complete", "final_exam_complete", "socratic_session_end"].includes(e.event_type)
  );
  const toolAbandoned = events.filter((e) => e.event_type === "tool_abandoned");

  // Build per-tool stats
  const toolStatsMap: Record<string, { engaged: number; completed: number; abandoned: number }> = {};
  for (const e of toolEngagements) {
    const tool = (e.event_data?.tool as string) || "unknown";
    if (!toolStatsMap[tool]) toolStatsMap[tool] = { engaged: 0, completed: 0, abandoned: 0 };
    toolStatsMap[tool].engaged++;
  }
  for (const e of toolCompletions) {
    const tool = (e.event_data?.tool as string) || mapCompletionToTool(e.event_type);
    if (!toolStatsMap[tool]) toolStatsMap[tool] = { engaged: 0, completed: 0, abandoned: 0 };
    toolStatsMap[tool].completed++;
  }
  for (const e of toolAbandoned) {
    const tool = (e.event_data?.tool as string) || "unknown";
    if (!toolStatsMap[tool]) toolStatsMap[tool] = { engaged: 0, completed: 0, abandoned: 0 };
    toolStatsMap[tool].abandoned++;
  }

  const toolStats: ToolStats[] = Object.entries(toolStatsMap)
    .map(([tool, s]) => ({
      tool,
      ...s,
      label: TOOL_META[tool]?.label || tool,
      icon: TOOL_META[tool]?.icon || Sparkles,
      color: TOOL_META[tool]?.color || "text-muted-foreground",
    }))
    .sort((a, b) => b.engaged - a.engaged);

  // Quiz performance (strengths & struggles)
  const quizAnswers = events.filter((e) =>
    ["quiz_answer", "cloze_answer", "final_exam_answer"].includes(e.event_type)
  );
  const quizCompletes = events.filter((e) =>
    ["quiz_complete", "final_exam_complete"].includes(e.event_type)
  );

  const totalCorrect = quizAnswers.filter((e) => e.event_data?.correct === true).length;
  const totalAnswers = quizAnswers.length;
  const overallPercent = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

  // Per-topic performance from quiz_complete events
  const topicPerformance: QuizPerformance[] = quizCompletes
    .filter((e) => e.event_data?.topic && typeof e.event_data.percent === "number")
    .map((e) => ({
      topic: String(e.event_data.topic).slice(0, 60),
      correct: Number(e.event_data.score) || 0,
      total: Number(e.event_data.total) || 0,
      percent: Number(e.event_data.percent),
      date: e.created_at,
    }));

  const strengths = topicPerformance.filter((t) => t.percent >= 80).slice(0, 5);
  const struggles = topicPerformance.filter((t) => t.percent < 60).slice(0, 5);

  // Video tier preferences
  const videoEvents = events.filter((e) => e.event_type === "video_tier_selected" || e.event_type === "video_watched");
  const tierCounts: Record<string, number> = { short: 0, medium: 0, long: 0 };
  for (const e of videoEvents) {
    const tier = (e.event_data?.tier as string) || "medium";
    if (tier in tierCounts) tierCounts[tier]++;
  }

  // Explain This usage
  const explainEvents = events.filter((e) => e.event_type === "explain_this_clicked");

  // Recent events timeline
  const recentEvents = events.slice(0, 20);

  // Activity by day (last 7 days)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });
  const eventsByDay = last7.map((day) => ({
    day: new Date(day).toLocaleDateString("en-US", { weekday: "short" }),
    count: events.filter((e) => e.created_at.startsWith(day)).length,
  }));
  const maxDayCount = Math.max(...eventsByDay.map((d) => d.count), 1);

  const addAdmin = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-admin", {
        body: { action: "add", email: newEmail.trim() },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); }
      else { toast.success(`Admin role added for ${newEmail.trim()}`); setNewEmail(""); loadAdmins(); }
    } catch (e: any) { toast.error(e.message || "Failed to add admin"); }
    setAdding(false);
  };

  const removeAdmin = async (roleId: string, userId: string) => {
    if (userId === user?.id) { toast.error("You cannot remove your own admin role."); return; }
    try {
      const { data, error } = await supabase.functions.invoke("manage-admin", { body: { action: "remove", role_id: roleId } });
      if (error) throw error;
      toast.success("Admin role removed");
      loadAdmins();
    } catch (e: any) { toast.error(e.message || "Failed to remove admin"); }
  };

  if (isAdmin === null) {
    return (
      <Layout>
        <div className="container max-w-4xl py-16 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-lavender-400 border-t-transparent mx-auto" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container max-w-4xl py-16 text-center">
          <Shield className="mx-auto h-12 w-12 text-destructive/40 mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">This page is restricted to administrators.</p>
          <button onClick={() => navigate("/")} className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
            Go Home
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sage-100 via-lavender-100 to-peach-100 dark:from-sage-500/10 dark:via-lavender-500/10 dark:to-peach-500/10" />
        <div className="container relative max-w-5xl py-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-destructive/10 px-4 py-1.5 text-xs font-semibold text-destructive ring-1 ring-destructive/20">
              <Shield className="h-3.5 w-3.5" /> Admin Only
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Research Dashboard</h1>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Study tool engagement, performance data, and learning pattern analysis.
            </p>
            <button
              onClick={loadEvents}
              disabled={loading}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </motion.div>
        </div>
      </div>

      <div className="container max-w-5xl py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <KpiCard icon={BarChart3} color="text-sage-500" label="Total Events" value={events.length.toLocaleString()} />
          <KpiCard icon={Sparkles} color="text-lavender-500" label="Tools Used" value={toolEngagements.length.toLocaleString()} sub={`${toolCompletions.length} completed`} />
          <KpiCard icon={Target} color="text-peach-500" label="Overall Accuracy" value={totalAnswers > 0 ? `${overallPercent}%` : "—"} sub={totalAnswers > 0 ? `${totalCorrect}/${totalAnswers} correct` : "No quizzes yet"} />
          <KpiCard icon={Brain} color="text-sky-300" label="Explain This" value={explainEvents.length.toLocaleString()} sub="curiosity clicks" />
        </div>

        {/* Activity Chart (7 days) */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-sage-500" />
            <h2 className="text-lg font-bold text-foreground">Activity (Last 7 Days)</h2>
          </div>
          <div className="flex items-end gap-2 h-32">
            {eventsByDay.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-sage-400 to-sage-300 dark:from-sage-500/40 dark:to-sage-400/30 transition-all"
                  style={{ height: `${Math.max((d.count / maxDayCount) * 100, 4)}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{d.day}</span>
                <span className="text-[10px] font-medium text-foreground">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tool Engagement Breakdown */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-lavender-500" />
            <h2 className="text-lg font-bold text-foreground">Study Tool Engagement</h2>
          </div>
          {toolStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No tool usage data yet. Start using study tools to see metrics here.</p>
          ) : (
            <div className="space-y-3">
              {toolStats.map((t) => {
                const completionRate = t.engaged > 0 ? Math.round((t.completed / t.engaged) * 100) : 0;
                return (
                  <div key={t.tool} className="flex items-center gap-3">
                    <t.icon className={`h-4 w-4 shrink-0 ${t.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">{t.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {t.engaged} used · {t.completed} completed · {completionRate}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sage-400 to-lavender-400 transition-all"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Strengths & Struggles */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-sage-500" />
              <h2 className="text-lg font-bold text-foreground">Strengths</h2>
            </div>
            {strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Complete quizzes to reveal strong topics.</p>
            ) : (
              <div className="space-y-2">
                {strengths.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-sage-50 dark:bg-sage-500/10 border border-sage-200 dark:border-sage-200/20 p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-sage-500" />
                      <span className="text-sm text-foreground truncate">{s.topic}</span>
                    </div>
                    <span className="text-sm font-bold text-sage-600 dark:text-sage-300 shrink-0 ml-2">{s.percent}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="h-5 w-5 text-peach-500" />
              <h2 className="text-lg font-bold text-foreground">Needs Practice</h2>
            </div>
            {struggles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Complete quizzes to identify areas for growth.</p>
            ) : (
              <div className="space-y-2">
                {struggles.map((s, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-peach-50 dark:bg-peach-500/10 border border-peach-200 dark:border-peach-200/20 p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Target className="h-4 w-4 shrink-0 text-peach-500" />
                      <span className="text-sm text-foreground truncate">{s.topic}</span>
                    </div>
                    <span className="text-sm font-bold text-peach-600 dark:text-peach-300 shrink-0 ml-2">{s.percent}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Video Preferences */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Video className="h-5 w-5 text-sky-300" />
            <h2 className="text-lg font-bold text-foreground">Video Preferences</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { tier: "short", label: "Quick (< 5 min)", color: "bg-sage-50 border-sage-200 dark:bg-sage-500/10 dark:border-sage-200/20", textColor: "text-sage-600 dark:text-sage-300" },
              { tier: "medium", label: "Standard (5-15 min)", color: "bg-sky-50 border-sky-200 dark:bg-sky-400/10 dark:border-sky-200/20", textColor: "text-sky-400 dark:text-sky-200" },
              { tier: "long", label: "Deep Dive (15+ min)", color: "bg-lavender-50 border-lavender-200 dark:bg-lavender-500/10 dark:border-lavender-200/20", textColor: "text-lavender-500 dark:text-lavender-300" },
            ].map((t) => (
              <div key={t.tier} className={`rounded-xl border p-4 text-center ${t.color}`}>
                <div className={`text-2xl font-bold ${t.textColor}`}>{tierCounts[t.tier]}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.label}</div>
              </div>
            ))}
          </div>
          {videoEvents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center mt-3">Watch explainer videos to see preference data.</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-peach-500" />
            <h2 className="text-lg font-bold text-foreground">Recent Activity</h2>
          </div>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No events recorded yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {recentEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                  <div className="h-2 w-2 shrink-0 rounded-full bg-sage-400" />
                  <span className="text-xs font-mono text-muted-foreground w-16 shrink-0">{relativeDay(e.created_at)}</span>
                  <span className="text-sm text-foreground">{formatEventType(e.event_type)}</span>
                  {e.event_data?.tool && (
                    <span className="rounded-full bg-lavender-100 dark:bg-lavender-500/15 px-2 py-0.5 text-[10px] font-medium text-lavender-600 dark:text-lavender-300">
                      {TOOL_META[e.event_data.tool as string]?.label || String(e.event_data.tool)}
                    </span>
                  )}
                  {typeof e.event_data?.correct === "boolean" && (
                    <span className={`text-xs font-medium ${e.event_data.correct ? "text-sage-500" : "text-peach-500"}`}>
                      {e.event_data.correct ? "Correct" : "Incorrect"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Admin Management */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-lavender-500" />
              <h2 className="text-lg font-bold text-foreground">Admin Management</h2>
            </div>
            <button
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className="text-xs font-medium text-lavender-500 hover:text-lavender-600 transition-colors"
            >
              {showAdminPanel ? "Hide" : "Manage Admins"}
            </button>
          </div>

          {showAdminPanel && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    id="admin-email"
                    name="adminEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addAdmin()}
                    placeholder="Enter email to grant data-access admin role..."
                    className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-lavender-300"
                  />
                </div>
                <button
                  onClick={addAdmin}
                  disabled={adding || !newEmail.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-lavender-200 px-4 py-2.5 text-sm font-semibold text-lavender-600 hover:bg-lavender-300 transition-colors disabled:opacity-50 dark:bg-lavender-500/20 dark:text-lavender-300"
                >
                  <UserPlus className="h-4 w-4" />
                  {adding ? "Adding..." : "Add"}
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground">
                Admins have read-only access to anonymized aggregate telemetry data. They cannot modify user accounts.
              </p>

              <div className="space-y-2">
                {admins.map((admin) => (
                  <div key={admin.id} className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lavender-200 text-lavender-600 dark:bg-lavender-500/20 dark:text-lavender-300">
                        <Shield className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{admin.user_id}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {admin.user_id === user?.id ? "You" : "Admin"}
                        </div>
                      </div>
                    </div>
                    {admin.user_id !== user?.id && (
                      <button
                        onClick={() => removeAdmin(admin.id, admin.user_id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Remove admin"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {admins.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No admins found.</p>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </Layout>
  );
};

function KpiCard({ icon: Icon, color, label, value, sub }: { icon: typeof BarChart3; color: string; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function mapCompletionToTool(eventType: string): string {
  if (eventType.startsWith("flashcard")) return "flashcard";
  if (eventType.startsWith("cloze")) return "cloze";
  if (eventType.startsWith("quiz")) return "quiz";
  if (eventType.startsWith("final_exam")) return "quiz";
  if (eventType.startsWith("socratic")) return "socratic";
  return "unknown";
}

function formatEventType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default AdminResearch;
