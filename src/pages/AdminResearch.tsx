import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, BarChart3, Users, TrendingUp,
  UserPlus, Trash2, Search, RefreshCw, Download,
  ChevronDown, Database, Filter,
} from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  computeMetric,
  exportQueryResultsCSV,
  exportRawEventsCSV,
  METRIC_LABELS,
  DIMENSION_LABELS,
  type MetricKey,
  type DimensionKey,
  type QueryResult,
} from "@/lib/researchQueries";

interface AdminUser {
  id: string;
  user_id: string;
  role: string;
  email?: string;
}

const DATE_RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "All time", days: 0 },
] as const;

const AdminResearch = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);

  // Query builder state
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("quiz_accuracy");
  const [selectedDimension, setSelectedDimension] = useState<DimensionKey>("trait");
  const [dateRangeIdx, setDateRangeIdx] = useState(1); // 30 days default
  const [minGroupSize, setMinGroupSize] = useState(3);
  const [results, setResults] = useState<QueryResult[]>([]);

  // Admin management
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);

  // ── Auth check ──
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

  // ── Load data ──
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
      .limit(10000);
    if (data) setEvents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadEvents();
    loadAdmins();
  }, [isAdmin, loadAdmins, loadEvents]);

  // ── Filter events by date ──
  const filteredEvents = useMemo(() => {
    const range = DATE_RANGES[dateRangeIdx];
    if (range.days === 0) return events;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range.days);
    return events.filter((e) => new Date(e.created_at) >= cutoff);
  }, [events, dateRangeIdx]);

  // ── Compute results ──
  useEffect(() => {
    if (filteredEvents.length === 0) {
      setResults([]);
      return;
    }
    const r = computeMetric(filteredEvents, selectedMetric, selectedDimension, minGroupSize);
    setResults(r);
  }, [filteredEvents, selectedMetric, selectedDimension, minGroupSize]);

  // ── KPIs ──
  const totalEvents = filteredEvents.length;
  const totalUsers = new Set(filteredEvents.map((e: any) => e.user_id)).size;
  const quizEvents = filteredEvents.filter((e: any) =>
    ["quiz_answer", "cloze_answer", "final_exam_answer"].includes(e.event_type)
  );
  const overallAccuracy = quizEvents.length > 0
    ? Math.round((quizEvents.filter((e: any) => e.event_data?.correct).length / quizEvents.length) * 100)
    : 0;
  const sessionSummaries = filteredEvents.filter((e: any) => e.event_type === "session_behavior_summary");

  // ── Export ──
  const handleExportResults = () => {
    const csv = exportQueryResultsCSV(results, selectedMetric, selectedDimension);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research_${selectedMetric}_by_${selectedDimension}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const handleExportRaw = () => {
    const csv = exportRawEventsCSV(filteredEvents, minGroupSize);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `research_raw_anonymized_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Raw data exported (anonymized)");
  };

  // ── Admin management ──
  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    const { error } = await supabase.functions.invoke("manage-admin", {
      body: { action: "add", email: newAdminEmail.trim() },
    });
    if (error) { toast.error("Failed to add admin"); return; }
    toast.success("Admin added");
    setNewAdminEmail("");
    loadAdmins();
  };

  const handleRemoveAdmin = async (adminUserId: string) => {
    if (adminUserId === user?.id) { toast.error("Cannot remove yourself"); return; }
    const { error } = await supabase.functions.invoke("manage-admin", {
      body: { action: "remove", user_id: adminUserId },
    });
    if (error) { toast.error("Failed to remove admin"); return; }
    toast.success("Admin removed");
    loadAdmins();
  };

  if (!user || !isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-lg font-bold">Admin Access Required</h2>
            <p className="text-sm text-muted-foreground">You need admin privileges to view research data.</p>
          </div>
        </div>
      </Layout>
    );
  }

  const maxValue = results.length > 0 ? Math.max(...results.map((r) => r.value), 1) : 1;
  const metricInfo = METRIC_LABELS[selectedMetric];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Database className="h-6 w-6 text-lavender-500" />
              Research Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Anonymized research data — all groups with fewer than {minGroupSize} users are hidden
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadEvents} className="rounded-lg bg-muted px-3 py-2 text-xs font-medium hover:bg-muted/80 transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={handleExportResults} className="rounded-lg bg-lavender-100 dark:bg-lavender-500/15 px-3 py-2 text-xs font-medium text-lavender-600 dark:text-lavender-300 hover:bg-lavender-200 transition-colors flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export Query
            </button>
            <button onClick={handleExportRaw} className="rounded-lg bg-sage-100 dark:bg-sage-500/15 px-3 py-2 text-xs font-medium text-sage-600 dark:text-sage-300 hover:bg-sage-200 transition-colors flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export Raw
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Events", value: totalEvents.toLocaleString(), icon: BarChart3, color: "text-sage-500" },
            { label: "Unique Users", value: totalUsers.toLocaleString(), icon: Users, color: "text-lavender-500" },
            { label: "Quiz Accuracy", value: `${overallAccuracy}%`, icon: TrendingUp, color: "text-peach-500" },
            { label: "Sessions Tracked", value: sessionSummaries.length.toLocaleString(), icon: Search, color: "text-sky-500" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
              </div>
              <div className="text-xl font-bold text-foreground">{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Query Builder */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Query Builder</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Metric selector */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Measure</label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {(Object.keys(METRIC_LABELS) as MetricKey[]).map((k) => (
                  <option key={k} value={k}>{METRIC_LABELS[k].name}</option>
                ))}
              </select>
            </div>

            {/* Dimension selector */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Group By</label>
              <select
                value={selectedDimension}
                onChange={(e) => setSelectedDimension(e.target.value as DimensionKey)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {(Object.keys(DIMENSION_LABELS) as DimensionKey[]).map((k) => (
                  <option key={k} value={k}>{DIMENSION_LABELS[k]}</option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Time Range</label>
              <select
                value={dateRangeIdx}
                onChange={(e) => setDateRangeIdx(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {DATE_RANGES.map((r, i) => (
                  <option key={i} value={i}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Min group size */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Min Group Size</label>
              <select
                value={minGroupSize}
                onChange={(e) => setMinGroupSize(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value={1}>1 (no anonymization)</option>
                <option value={3}>3 (recommended)</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              {metricInfo.name} by {DIMENSION_LABELS[selectedDimension]}
            </h3>
            <span className="text-xs text-muted-foreground">
              {results.length} group{results.length !== 1 ? "s" : ""} · {filteredEvents.length.toLocaleString()} events
            </span>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {loading ? "Loading..." : "No data matches your query. Try adjusting filters or lowering the minimum group size."}
            </div>
          ) : (
            <>
              {/* Bar chart */}
              <div className="space-y-2 mb-6">
                {results.slice(0, 20).map((r) => (
                  <div key={r.group} className="flex items-center gap-3">
                    <div className="w-32 text-xs text-foreground font-medium truncate text-right" title={r.group}>
                      {r.group}
                    </div>
                    <div className="flex-1 h-7 bg-muted/50 rounded-lg overflow-hidden relative">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max((r.value / maxValue) * 100, 2)}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-lavender-400 to-sage-400 rounded-lg"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-foreground">
                        {r.value}{metricInfo.unit === "%" ? "%" : ` ${metricInfo.unit}`}
                      </span>
                    </div>
                    <div className="w-16 text-[10px] text-muted-foreground text-right">
                      n={r.userCount}
                    </div>
                  </div>
                ))}
              </div>

              {/* Data table */}
              <div className="overflow-x-auto border border-border/50 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">{DIMENSION_LABELS[selectedDimension]}</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Events</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Users</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">{metricInfo.name} ({metricInfo.unit})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.group} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium text-foreground">{r.group}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{r.count.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{r.userCount}</td>
                        <td className="px-3 py-2 text-right font-semibold text-foreground">{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Quick Insights (auto-computed) */}
        {sessionSummaries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(() => {
              // Peak performance hour
              const hourCounts = new Map<number, { correct: number; total: number }>();
              for (const e of quizEvents) {
                const h = e.event_data?.local_hour;
                if (h === undefined) continue;
                const curr = hourCounts.get(h) || { correct: 0, total: 0 };
                curr.total++;
                if (e.event_data?.correct) curr.correct++;
                hourCounts.set(h, curr);
              }
              let peakHour = "N/A";
              let peakAcc = 0;
              for (const [h, data] of hourCounts) {
                if (data.total >= 3) {
                  const acc = data.correct / data.total;
                  if (acc > peakAcc) { peakAcc = acc; peakHour = `${h % 12 || 12}${h < 12 ? "am" : "pm"}`; }
                }
              }

              // Avg scroll thrash
              const avgThrash = sessionSummaries.length > 0
                ? (sessionSummaries.reduce((s: number, e: any) => s + (e.event_data?.scroll_thrash_count || 0), 0) / sessionSummaries.length).toFixed(1)
                : "0";

              // Avg velocity degradation
              const velDeg = sessionSummaries.filter((e: any) => e.event_data?.velocity_degradation_pct !== undefined);
              const avgDeg = velDeg.length > 0
                ? Math.round(velDeg.reduce((s: number, e: any) => s + e.event_data.velocity_degradation_pct, 0) / velDeg.length)
                : 0;

              return [
                { label: "Peak Performance Hour", value: peakHour, sub: `${Math.round(peakAcc * 100)}% accuracy` },
                { label: "Avg Scroll Thrash", value: `${avgThrash}/session`, sub: "direction changes per study session" },
                { label: "Avg Reading Velocity Drop", value: `${avgDeg}%`, sub: "speed decrease from start to end of session" },
              ];
            })().map((insight) => (
              <div key={insight.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{insight.label}</div>
                <div className="text-lg font-bold text-foreground">{insight.value}</div>
                <div className="text-[11px] text-muted-foreground">{insight.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Admin Management */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <button
            onClick={() => setShowAdmin(!showAdmin)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" /> Admin Management
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdmin ? "rotate-180" : ""}`} />
          </button>
          {showAdmin && (
            <div className="px-5 pb-4 space-y-3 border-t border-border/50">
              <div className="flex gap-2 mt-3">
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="user@email.com"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                />
                <button
                  onClick={handleAddAdmin}
                  disabled={!newAdminEmail.trim()}
                  className="rounded-lg bg-lavender-500 px-3 py-2 text-sm font-medium text-white hover:bg-lavender-600 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              {admins.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                  <span className="text-xs text-muted-foreground font-mono">{a.user_id.slice(0, 12)}...</span>
                  {a.user_id !== user?.id && (
                    <button
                      onClick={() => handleRemoveAdmin(a.user_id)}
                      className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminResearch;
