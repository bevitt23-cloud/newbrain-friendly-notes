import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { Heart, Coffee, Mail, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const products = [
  { emoji: "🔇", name: "Loop Quiet Earplugs", desc: "Reduce noise without fully blocking it.", url: "https://www.amazon.com/dp/B0D3V6TR98?tag=adhdnotes-20" },
  { emoji: "📓", name: "B5 College Ruled Notebook", desc: "A clean, no-frills notebook.", url: "https://www.amazon.com/dp/B095M8P3P2?tag=adhdnotes-20" },
  { emoji: "📔", name: "Leather Hardcover Journal", desc: "Sturdy, portable journal for notes on the go.", url: "https://www.amazon.com/dp/B0DHCZJT65?tag=adhdnotes-20" },
  { emoji: "🖊️", name: "Japanese Silicone Grip Pens", desc: "Smooth pens, soft grip reduces fatigue.", url: "https://www.amazon.com/dp/B0B9QVGVNJ?tag=adhdnotes-20" },
  { emoji: "✌️", name: "Japanese Liquid Ink Pens", desc: "Ultra-fine tip for neat, detailed notes.", url: "https://www.amazon.com/dp/B07Y2RBV4P?tag=adhdnotes-20" },
  { emoji: "🖋️", name: "Sharpie S-Gel Pens", desc: "Smooth gel ink that doesn't smear.", url: "https://www.amazon.com/dp/B082PMRSBK?tag=adhdnotes-20" },
  { emoji: "🌈", name: "Crayola Colored Pencils", desc: "Color-code your notes by topic.", url: "https://www.amazon.com/dp/B00000J0S3?tag=adhdnotes-20" },
  { emoji: "📌", name: "Post-it Sticky Notes", desc: "Color-coded for flagging key ideas.", url: "https://www.amazon.com/dp/B07YNHMVRT?tag=adhdnotes-20" },
];

const costs = [
  { emoji: "🤖", label: "Per Note", value: "~$0.03", desc: "AI processing fee", color: "bg-sage-50 border-sage-200 dark:bg-sage-500/10 dark:border-sage-200/30" },
  { emoji: "🌐", label: "Hosting", value: "~$0", desc: "Vercel free tier", color: "bg-lavender-50 border-lavender-200 dark:bg-lavender-500/10 dark:border-lavender-200/30" },
  { emoji: "🗄️", label: "Database", value: "~$0", desc: "Supabase free tier", color: "bg-peach-50 border-peach-200 dark:bg-peach-500/10 dark:border-peach-200/30" },
  { emoji: "🔧", label: "Upgrades", value: "∞", desc: "New features", color: "bg-sky-50 border-sky-200 dark:bg-sky-500/10 dark:border-sky-200/30" },
];

const Support = () => (
  <Layout>
    {/* Colored hero */}
    <div className="bg-gradient-to-b from-muted/40 to-transparent dark:from-muted/20">
      <div className="container max-w-3xl py-12 md:py-16 text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-extrabold text-foreground md:text-4xl">
            Help keep it{" "}
            <span className="text-primary italic">free for everyone</span>
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Every note costs a small AI fee. Your support keeps this tool accessible for every student.
          </p>
        </motion.div>
      </div>
    </div>

    <div className="container max-w-3xl py-8">
      {/* Colored cost cards */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-10">
        <h2 className="mb-4 text-center text-lg font-bold text-foreground">Where does the money go?</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {costs.map((cost, i) => (
            <div key={i} className={`rounded-xl border p-4 text-center ${cost.color}`}>
              <span className="text-xl">{cost.emoji}</span>
              <p className="mt-1 text-xs text-muted-foreground">{cost.label}</p>
              <p className="text-lg font-bold text-foreground">{cost.value}</p>
              <p className="text-[10px] text-muted-foreground">{cost.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          At 100 students/day, AI costs run $90–$150/month.
        </p>
      </motion.section>

      <div className="space-y-5">
        {/* Donate */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft">
          <div className="h-1 bg-primary/40" />
          <div className="p-6">
            <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</div>
            <h3 className="text-base font-bold text-foreground">Buy Me a Coffee</h3>
            <p className="mt-1 text-sm text-muted-foreground">Even $3 covers 100 note conversions. 💛</p>
            <a href="https://ko-fi.com/adhdnotes" target="_blank" rel="noopener noreferrer">
              <Button className="mt-4 gap-2 shadow-sm">
                <Coffee className="h-4 w-4" /> Donate on Ko-fi
              </Button>
            </a>
          </div>
        </motion.div>

        {/* Shop */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft">
          <div className="h-1 bg-primary/30" />
          <div className="p-6">
            <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</div>
            <h3 className="text-base font-bold text-foreground">Shop Tools We Love</h3>
            <p className="mt-1 text-sm text-muted-foreground">Need a study tool? Affiliate links at no extra cost.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {products.map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3 transition-all hover:bg-muted/50 hover:shadow-soft">
                  <span className="text-lg">{p.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.desc}</p>
                  </div>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/50 mt-0.5" />
                </a>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Ads */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft">
          <div className="h-1 bg-primary/20" />
          <div className="p-6">
            <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</div>
            <h3 className="text-base font-bold text-foreground">Click an Ad</h3>
            <p className="mt-1 text-sm text-muted-foreground">Ads live only on this page — never in the main app. Clicking costs nothing.</p>
          </div>
        </motion.div>

        {/* Share */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft">
          <div className="h-1 bg-primary/15" />
          <div className="p-6">
            <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">4</div>
            <h3 className="text-base font-bold text-foreground">Spread the Word 💛</h3>
            <p className="mt-1 text-sm text-muted-foreground">Share with a classmate, study group, or anyone who needs it.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="https://twitter.com/intent/tweet?text=This+free+tool+turns+study+material+into+brain-friendly+notes+%F0%9F%A7%A0+brainfriendlynotes.com" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs border-border hover:bg-muted/50">𝕏 Share on X</Button>
              </a>
              <a href="https://www.facebook.com/sharer/sharer.php?u=https://brainfriendlynotes.com" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs border-border hover:bg-muted/50">📘 Facebook</Button>
              </a>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs border-border hover:bg-muted/50"
                onClick={() => navigator.clipboard.writeText("https://brainfriendlynotes.com")}>
                🔗 Copy Link
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Questions? <a href="mailto:adhdnotemodifier@gmail.com" className="font-medium text-primary hover:underline">adhdnotemodifier@gmail.com</a>
      </p>
    </div>
  </Layout>
);

export default Support;
