import Layout from "@/components/Layout";
import { motion } from "framer-motion";

const colors = [
  "bg-sage-50 border-sage-200 dark:bg-sage-500/10 dark:border-sage-200/30",
  "bg-lavender-50 border-lavender-200 dark:bg-lavender-500/10 dark:border-lavender-200/30",
  "bg-peach-50 border-peach-200 dark:bg-peach-500/10 dark:border-peach-200/30",
  "bg-sky-50 border-sky-200 dark:bg-sky-500/10 dark:border-sky-200/30",
  "bg-sage-50 border-sage-200 dark:bg-sage-500/10 dark:border-sage-200/30",
  "bg-lavender-50 border-lavender-200 dark:bg-lavender-500/10 dark:border-lavender-200/30",
  "bg-peach-50 border-peach-200 dark:bg-peach-500/10 dark:border-peach-200/30",
  "bg-sky-50 border-sky-200 dark:bg-sky-500/10 dark:border-sky-200/30",
  "bg-sage-50 border-sage-200 dark:bg-sage-500/10 dark:border-sage-200/30",
];

const sections = [
  {
    emoji: "👋",
    title: "1. Who We Are",
    content: 'Brain-Friendly Notes is an independent web application at brainfriendlynotes.com, built and maintained by one person. Questions about privacy? Reach us at adhdnotemodifier@gmail.com',
  },
  {
    emoji: "📋",
    title: "2. What We Collect",
    bullets: [
      "<strong>Account information (optional):</strong> If you create an account, we collect your email address and an encrypted password.",
      "<strong>Content you submit:</strong> Documents, text, images, or files you upload are temporarily sent to AI to generate your notes. This content is not stored after processing unless you are logged in and choose to save.",
      "<strong>Saved notes:</strong> If you save notes, that content is stored securely in our database and only accessible through your account.",
      "<strong>Basic usage data:</strong> Our hosting provider (Vercel) may collect anonymized page visit data. This does not identify you personally.",
      "<strong>Passwords</strong> are always encrypted. We never store them in plain text.",
    ],
  },
  {
    emoji: "🎯",
    title: "3. How We Use Your Info",
    bullets: [
      "To provide and operate the Brain-Friendly Notes tool",
      "To save and retrieve your notes if you have an account",
      "To respond to questions or support requests you send us",
      "To improve app performance and features",
      "To display ads and affiliate content on the Support page to help cover operating costs",
    ],
  },
  {
    emoji: "🔗",
    title: "4. Third-Party Services",
    bullets: [
      "<strong>Anthropic API</strong> — processes your submitted content to generate reformatted notes",
      "<strong>Supabase</strong> — stores account information and saved notes securely",
      "<strong>Vercel</strong> — hosts the application and may collect anonymized traffic data",
      "<strong>Google AdSense</strong> — may display ads on the Support page and uses cookies for relevant ads",
      "<strong>Ko-fi</strong> — processes voluntary donations",
      "<strong>Amazon Associates</strong> — affiliate links on the Support page may use cookies to track referrals",
    ],
  },
  {
    emoji: "🍪",
    title: "5. Cookies",
    content: "We don't use cookies beyond what's needed to keep you logged in. Third-party services like Google AdSense may place cookies for ad personalization. You can manage cookie preferences through your browser settings.",
  },
  {
    emoji: "🗑️",
    title: "6. Your Rights & Data Deletion",
    bullets: [
      "Access the data we hold about you",
      "Request correction of inaccurate data",
      "Request deletion of your account and all associated data",
      "Withdraw consent at any time by deleting your account",
    ],
    footer: 'To request deletion: Email adhdnotemodifier@gmail.com with the subject line "Data Deletion Request." We\'ll process your request within 30 days.',
  },
  {
    emoji: "🔐",
    title: "7. Data Security",
    content: "Passwords are encrypted and never stored in plain text. Saved notes are stored in a secured database with access controls. No method of internet transmission is 100% secure, and we cannot guarantee absolute security.",
  },
  {
    emoji: "👦",
    title: "8. Children's Privacy",
    content: "Brain-Friendly Notes is not directed at children under 13. We do not knowingly collect information from children under 13. If you believe a child has provided personal information, contact us and we will delete it promptly.",
  },
  {
    emoji: "📝",
    title: "9. Changes to This Policy",
    content: "We may update this Privacy Policy from time to time. When we do, we'll update the effective date at the top of this page. Continued use of the app after changes means you accept the updated policy.",
  },
];
const Privacy = () => (
  <Layout>
    {/* Colored hero */}
    <div className="bg-gradient-to-br from-sage-100 via-lavender-50 to-sky-100 dark:from-sage-500/10 dark:via-lavender-500/10 dark:to-sky-500/10">
      <div className="container max-w-2xl py-12 md:py-16">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-extrabold text-foreground md:text-4xl">
            🔒 Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Effective March 5, 2026 · brainfriendlynotes.com
          </p>
        </motion.div>
      </div>
    </div>

    <div className="container max-w-2xl py-8">
      <div className="mb-8 rounded-xl border-2 border-sage-200 dark:border-sage-200/30 bg-gradient-to-r from-sage-50 to-lavender-50 dark:from-sage-500/10 dark:to-lavender-500/10 p-5">
        <p className="text-sm font-semibold text-foreground">Short version</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We collect only what we need to run the app. We don't sell your data. Ever.
        </p>
      </div>

      <div className="space-y-4">
        {sections.map((section, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`rounded-xl border-2 p-6 ${colors[i]}`}
          >
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <span>{section.emoji}</span> {section.title}
            </h2>
            {section.content && (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.content}</p>
            )}
            {section.bullets && (
              <ul className="mt-3 space-y-2">
                {section.bullets.map((bullet, j) => (
                  <li
                    key={j}
                    className="text-sm leading-relaxed text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: `• ${bullet}` }}
                  />
                ))}
              </ul>
            )}
            {section.footer && (
              <p className="mt-3 text-xs text-muted-foreground italic">{section.footer}</p>
            )}
          </motion.div>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center text-sm text-muted-foreground"
      >
        Questions about privacy?{" "}
        <a href="mailto:adhdnotemodifier@gmail.com" className="font-medium text-primary hover:underline">
          adhdnotemodifier@gmail.com
        </a>
        {" "}— we're a real person, not a support ticket system.
      </motion.p>
    </div>
  </Layout>
);

export default Privacy;
