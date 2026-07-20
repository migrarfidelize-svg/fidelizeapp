import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

type Props = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  gradient: string; // e.g. "from-violet-600 via-indigo-600 to-sky-500"
  accent?: string; // hex used for glow orbs
  stats?: Array<{ label: string; value: string | number }>;
};

export function SectionBanner({ title, subtitle, icon: Icon, gradient, accent = "#8b5cf6", stats }: Props) {
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 md:p-8 text-white shadow-xl ring-1 ring-white/15`}>
      {/* floating orbs */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: accent, opacity: 0.55 }}
        animate={{ x: [0, 20, -10, 0], y: [0, -15, 10, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full blur-3xl"
        style={{ background: "white", opacity: 0.18 }}
        animate={{ x: [0, -20, 15, 0], y: [0, 10, -20, 0], scale: [1, 1.08, 0.94, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* grid pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse at top, black 30%, transparent 75%)",
        }}
      />
      {/* shine sweep */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-y-10 -left-1/3 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
        animate={{ x: ["0%", "420%"] }}
        transition={{ duration: 6.5, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
      />

      <div className="relative flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur ring-1 ring-white/30 shadow-lg"
        >
          <Icon className="h-7 w-7" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <motion.h2
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.4 }}
            className="font-display text-2xl md:text-3xl font-bold tracking-tight"
          >
            {title}
          </motion.h2>
          <motion.p
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-sm md:text-base text-white/85 mt-1 max-w-2xl"
          >
            {subtitle}
          </motion.p>
        </div>
        {stats && stats.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.4 }}
                className="rounded-2xl bg-white/12 backdrop-blur ring-1 ring-white/25 px-4 py-2 min-w-[92px]"
              >
                <div className="text-xs uppercase tracking-wide text-white/75">{s.label}</div>
                <div className="font-display text-2xl font-bold leading-tight">{s.value}</div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
