import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import {
  Brain, Sparkles, Upload, BookOpen, Mic, Music, Star,
  Lightbulb, FileText, StickyNote, Save, Volume2, Beaker, ArrowRight
} from "lucide-react";
import logo from "@/assets/logo.jpeg";

const steps = [
  { num: "1", title: "Add your content", desc: "Upload up to 5 files — PDF, Word, PowerPoint, images, or video. Paste text, drop in a URL, or a YouTube link. You can even speak your notes aloud.", color: "from-sage-50 to-sage-100 dark:from-sage-500/10 dark:to-sage-500/5", border: "border-sage-200 dark:border-sage-200/30", accent: "bg-sage-200 dark:bg-sage-500/20", numColor: "text-sage-700 dark:text-sage-300", gradient: "from-sage-400 to-sage-300" },
  { num: "2", title: "AI turns it into brain-friendly notes", desc: "Your content is sent to Gemini or Claude AI. In seconds you get color-coded, chunked, plain-English notes for neurodivergent brains.", color: "from-lavender-50 to-lavender-100 dark:from-lavender-500/10 dark:to-lavender-500/5", border: "border-lavender-200 dark:border-lavender-200/30", accent: "bg-lavender-200 dark:bg-lavender-500/20", numColor: "text-lavender-500 dark:text-lavender-300", gradient: "from-lavender-400 to-lavender-300" },
  { num: "3", title: "Study your way", desc: "Use Flashcards, Practice Exams, Mind Maps, or Flow Charts. Star important text and those concepts get featured in your tests.", color: "from-peach-50 to-peach-100 dark:from-peach-500/10 dark:to-peach-500/5", border: "border-peach-200 dark:border-peach-200/30", accent: "bg-peach-200 dark:bg-peach-500/20", numColor: "text-peach-500 dark:text-peach-300", gradient: "from-peach-400 to-peach-300" },
  { num: "4", title: "Save & come back", desc: "Create a free account to save notes into folders and pick up where you left off. Download or print anytime — formatting included.", color: "from-sky-50 to-sky-100 dark:from-sky-300/10 dark:to-sky-300/5", border: "border-sky-200 dark:border-sky-200/30", accent: "bg-sky-100 dark:bg-sky-300/20", numColor: "text-sky-300 dark:text-sky-200", gradient: "from-sky-300 to-sky-200" },
];

const features = [
  { icon: Brain, title: "Focus-Friendly Notes", desc: "Short sentences, color-coded boxes, and 'pause' checkpoints.", color: "from-sage-50 to-sage-100/80 dark:from-sage-500/10 dark:to-sage-500/5", border: "border-sage-200 dark:border-sage-200/30", iconBg: "bg-sage-100 dark:bg-sage-500/20", iconColor: "text-sage-600 dark:text-sage-300" },
  { icon: BookOpen, title: "Readable Font", desc: "OpenDyslexic font, extra spacing, ultra-short sentences.", color: "from-lavender-50 to-lavender-100/80 dark:from-lavender-500/10 dark:to-lavender-500/5", border: "border-lavender-200 dark:border-lavender-200/30", iconBg: "bg-lavender-100 dark:bg-lavender-500/20", iconColor: "text-lavender-500 dark:text-lavender-300" },
  { icon: Upload, title: "Upload Anything", desc: "PDF, Word, PPT, images, video — or paste a YouTube link.", color: "from-peach-50 to-peach-100/80 dark:from-peach-500/10 dark:to-peach-500/5", border: "border-peach-200 dark:border-peach-200/30", iconBg: "bg-peach-100 dark:bg-peach-500/20", iconColor: "text-peach-500 dark:text-peach-300" },
  { icon: Sparkles, title: "Study Tools", desc: "Flashcards, Practice Exam, Mind Map, and Flow Chart — auto-built.", color: "from-sky-50 to-sky-100/80 dark:from-sky-300/10 dark:to-sky-300/5", border: "border-sky-200 dark:border-sky-200/30", iconBg: "bg-sky-100 dark:bg-sky-300/20", iconColor: "text-sky-300 dark:text-sky-200" },
  { icon: Volume2, title: "Read Aloud", desc: "Floating player reads sentence by sentence. Adjust pitch & speed.", color: "from-sage-50 to-sage-100/80 dark:from-sage-500/10 dark:to-sage-500/5", border: "border-sage-200 dark:border-sage-200/30", iconBg: "bg-sage-100 dark:bg-sage-500/20", iconColor: "text-sage-600 dark:text-sage-300" },
  { icon: Mic, title: "Speak Your Notes", desc: "Can't type? Just talk. Built for dysgraphia and thinking out loud.", color: "from-lavender-50 to-lavender-100/80 dark:from-lavender-500/10 dark:to-lavender-500/5", border: "border-lavender-200 dark:border-lavender-200/30", iconBg: "bg-lavender-100 dark:bg-lavender-500/20", iconColor: "text-lavender-500 dark:text-lavender-300" },
  { icon: Music, title: "Focus Music + Gamma", desc: "Lofi stations + 40Hz gamma binaural beat for focus support.", color: "from-peach-50 to-peach-100/80 dark:from-peach-500/10 dark:to-peach-500/5", border: "border-peach-200 dark:border-peach-200/30", iconBg: "bg-peach-100 dark:bg-peach-500/20", iconColor: "text-peach-500 dark:text-peach-300" },
  { icon: Star, title: "Star Important Info", desc: "Starred content gets featured in Flashcards and Practice Exams.", color: "from-sky-50 to-sky-100/80 dark:from-sky-300/10 dark:to-sky-300/5", border: "border-sky-200 dark:border-sky-200/30", iconBg: "bg-sky-100 dark:bg-sky-300/20", iconColor: "text-sky-300 dark:text-sky-200" },
  { icon: Lightbulb, title: "Explain This", desc: "Plain-English explanation with a real-life analogy — instantly.", color: "from-sage-50 to-sage-100/80 dark:from-sage-500/10 dark:to-sage-500/5", border: "border-sage-200 dark:border-sage-200/30", iconBg: "bg-sage-100 dark:bg-sage-500/20", iconColor: "text-sage-600 dark:text-sage-300" },
  { icon: Beaker, title: "Retention Quiz", desc: "5-question quiz after your notes — test what actually stuck.", color: "from-lavender-50 to-lavender-100/80 dark:from-lavender-500/10 dark:to-lavender-500/5", border: "border-lavender-200 dark:border-lavender-200/30", iconBg: "bg-lavender-100 dark:bg-lavender-500/20", iconColor: "text-lavender-500 dark:text-lavender-300" },
  { icon: StickyNote, title: "Sticky Notes", desc: "Color-coded sticky notes right next to the content.", color: "from-peach-50 to-peach-100/80 dark:from-peach-500/10 dark:to-peach-500/5", border: "border-peach-200 dark:border-peach-200/30", iconBg: "bg-peach-100 dark:bg-peach-500/20", iconColor: "text-peach-500 dark:text-peach-300" },
  { icon: Save, title: "Save & Organize", desc: "Save notes into folders, access from any device.", color: "from-sky-50 to-sky-100/80 dark:from-sky-300/10 dark:to-sky-300/5", border: "border-sky-200 dark:border-sky-200/30", iconBg: "bg-sky-100 dark:bg-sky-300/20", iconColor: "text-sky-300 dark:text-sky-200" },
];

const About = () => (
  <Layout>
    {/* Mesmerizing hero with layered gradients */}
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-lavender-100 via-sage-50 to-peach-100 dark:from-lavender-500/10 dark:via-sage-500/10 dark:to-peach-500/10" />
      <div className="absolute inset-0">
        <div className="absolute -top-24 right-10 h-72 w-72 rounded-full bg-gradient-to-br from-sage-300/40 to-sage-200/20 dark:from-sage-500/10 dark:to-sage-400/5 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-56 w-56 rounded-full bg-gradient-to-tr from-peach-300/40 to-peach-200/20 dark:from-peach-500/10 dark:to-peach-400/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-48 rounded-full bg-gradient-to-r from-lavender-300/30 to-sky-200/20 dark:from-lavender-500/8 dark:to-sky-300/5 blur-3xl" />
      </div>
      <div className="container relative max-w-4xl py-16 md:py-24 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <img src={logo} alt="Brain-Friendly Notes" className="mx-auto mb-6 h-20 w-20 rounded-2xl shadow-xl shadow-sage-400/20 ring-2 ring-white/60 dark:ring-white/10" />
          <h1 className="text-3xl font-extrabold text-foreground md:text-4xl lg:text-5xl">
            Notes that work <span className="bg-gradient-to-r from-sage-600 via-lavender-500 to-peach-500 bg-clip-text text-transparent italic">with your brain</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Built by one person who understands that for brains wired differently — like those seen in ADHD or dyslexia — studying just looks different. And that's okay.
          </p>
        </motion.div>
      </div>
    </div>

    <div className="container max-w-4xl py-12">
      {/* How it works — sleek step cards */}
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-20">
        <h2 className="mb-10 text-center text-xl font-bold text-foreground">How It Works</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
              className={`group relative overflow-hidden rounded-2xl border ${step.border} bg-gradient-to-br ${step.color} p-6 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]`}
            >
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${step.gradient}`} />
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${step.accent} text-sm font-bold ${step.numColor}`}>
                {step.num}
              </div>
              <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
            </motion.div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your content is processed securely and never stored unless you choose to save. No data is sold. No ads in the main app. Ever.
        </p>
      </motion.section>

      {/* Features grid — color-coded cards with icon badges */}
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-20">
        <h2 className="mb-10 text-center text-xl font-bold text-foreground">Features Built for Different Brains</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.04 }}
              className={`group rounded-2xl border ${feature.border} bg-gradient-to-br ${feature.color} p-5 transition-all duration-300 hover:shadow-md hover:scale-[1.02]`}
            >
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${feature.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                <feature.icon className={`h-4.5 w-4.5 ${feature.iconColor}`} />
              </div>
              <h3 className="text-sm font-bold text-foreground">{feature.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Personal story — warm glassmorphic card */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-20 relative overflow-hidden rounded-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-peach-100 via-lavender-50 to-sage-50 dark:from-peach-500/10 dark:via-lavender-500/5 dark:to-sage-500/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-peach-200/20 via-transparent to-lavender-200/20 dark:from-peach-500/5 dark:to-lavender-500/5" />
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-peach-400 via-sage-400 to-lavender-400 dark:from-peach-400/60 dark:via-sage-400/60 dark:to-lavender-400/60" />
        <div className="relative p-8 md:p-12">
          <h2 className="mb-5 text-xl font-bold text-foreground">Hi! I'm B. 👋</h2>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>After learning more about how my own brain works, so many things finally made sense. I've been on a journey of learning how to work <em>with</em> my brain instead of against it.</p>
            <p>After a weekend of studying — getting blinded by page after page of black and white text — I just couldn't do it anymore. I'd tried plenty of study apps. None gave me what I actually needed. <strong className="text-foreground">I wanted color, simplicity, and speed. I just wanted to read the page.</strong></p>
            <p>So I took a break from studying and made this instead.</p>
            <p className="font-medium text-foreground">Happy learning. 🧡 — B</p>
          </div>
        </div>
      </motion.section>

      {/* Install — sky-themed */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="relative overflow-hidden rounded-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-sage-50 to-lavender-50 dark:from-sky-300/10 dark:via-sage-500/5 dark:to-lavender-500/5" />
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-300 via-sage-400 to-lavender-400 dark:from-sky-300/60 dark:via-sage-400/60 dark:to-lavender-400/60" />
        <div className="relative p-8 md:p-12 text-center">
          <h2 className="text-xl font-bold text-foreground">Want the app? 📱</h2>
          <p className="mt-2 text-sm text-muted-foreground">No download required — add it to your home screen.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-sky-200 dark:border-sky-200/30 bg-card/80 backdrop-blur-sm p-5 text-left transition-all hover:shadow-md hover:scale-[1.01]">
              <p className="mb-3 text-sm font-bold text-foreground">🍎 iPhone / iPad</p>
              <ol className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3 text-sky-300 shrink-0" /> Open in <strong>Safari</strong></li>
                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3 text-sky-300 shrink-0" /> Tap the <strong>Share button</strong></li>
                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3 text-sky-300 shrink-0" /> Tap <strong>"Add to Home Screen"</strong></li>
                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3 text-sage-500 shrink-0" /> Done! 🎉</li>
              </ol>
            </div>
            <div className="rounded-xl border border-sky-200 dark:border-sky-200/30 bg-card/80 backdrop-blur-sm p-5 text-left transition-all hover:shadow-md hover:scale-[1.01]">
              <p className="mb-3 text-sm font-bold text-foreground">🤖 Android</p>
              <ol className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3 text-sky-300 shrink-0" /> Open in <strong>Chrome</strong></li>
                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3 text-sky-300 shrink-0" /> Tap the <strong>three dots menu</strong></li>
                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3 text-sky-300 shrink-0" /> Tap <strong>"Add to Home Screen"</strong></li>
                <li className="flex items-center gap-2"><ArrowRight className="h-3 w-3 text-sage-500 shrink-0" /> Done! 🎉</li>
              </ol>
            </div>
          </div>
        </div>
      </motion.section>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        <strong>Powered by:</strong> Gemini AI · Anthropic Claude AI · Supabase · Vercel · Built with love in Nashville, TN 🎸
      </p>
    </div>
  </Layout>
);

export default About;
