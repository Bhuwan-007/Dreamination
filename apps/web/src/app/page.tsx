import { Sparkles, Moon, Compass, Play, ShieldCheck, Waves } from "lucide-react";

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col justify-between p-6 md:p-16 overflow-hidden bg-void bg-grain">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-forest-night/80 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-lantern/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-graphite/40 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-lantern/40 flex items-center justify-center bg-forest-night shadow-lantern">
            <Moon className="w-5 h-5 text-lantern" />
          </div>
          <div>
            <span className="font-display tracking-wider text-lg text-cloud font-medium block">
              the dream machine
            </span>
            <span className="text-xs text-sage tracking-widest uppercase">
              Luminous · Hushed · Mythic
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-graphite bg-slate/60 text-xs text-mist">
            <span className="w-2 h-2 rounded-full bg-leaf animate-pulse" />
            <span>Core Online · Free-First</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-4xl mx-auto my-auto py-16 text-center flex flex-col items-center">
        {/* Arch portal badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-lantern/30 bg-forest-night/80 text-lantern-soft text-sm mb-8 backdrop-blur-md shadow-lantern">
          <Sparkles className="w-4 h-4 text-lantern" />
          <span>The Recognition Moment</span>
        </div>

        <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-light text-cloud leading-[1.1] tracking-tight mb-8">
          Step through <br className="hidden sm:inline" />
          <span className="italic font-serif text-lantern-soft">the dream.</span>
        </h1>

        <p className="font-serif italic text-lg sm:text-xl text-mist max-w-2xl mx-auto mb-12 leading-relaxed">
          &ldquo;You wake with only fragments—a tide, a door, a face you almost knew.
          We stitch without flattening the strange, and give your shadows voice.&rdquo;
        </p>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <a
            href="#capture"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full bg-lantern text-void font-medium tracking-wide shadow-lantern hover:bg-lantern-soft transition-all duration-300"
          >
            <Compass className="w-5 h-5" />
            <span>Open the Door</span>
          </a>

          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-full border border-hairline bg-slate/50 text-cloud hover:border-lantern/60 hover:text-lantern-soft transition-all duration-300 backdrop-blur-sm"
          >
            <Play className="w-5 h-5 text-lantern" />
            <span>Launch 3D Player Spike</span>
          </a>
        </div>
      </section>

      {/* Feature Cards / Principles */}
      <footer className="relative z-10 pt-12 border-t border-graphite/40">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
          <div className="p-6 rounded-2xl border border-graphite/60 bg-forest-night/40 backdrop-blur-sm">
            <Waves className="w-6 h-6 text-lake mb-4" />
            <h3 className="font-display text-cloud text-base mb-2">Preserve Dream Logic</h3>
            <p className="text-sm text-sage leading-relaxed">
              Emotional continuity over ordinary physics. Inferred gaps are flagged and visible on tap.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-graphite/60 bg-forest-night/40 backdrop-blur-sm">
            <Sparkles className="w-6 h-6 text-lantern mb-4" />
            <h3 className="font-display text-cloud text-base mb-2">Personal Symbol Lexicon</h3>
            <p className="text-sm text-sage leading-relaxed">
              Learned probability distributions per user, updated by resonance feedback. No generic dream dictionaries.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-graphite/60 bg-forest-night/40 backdrop-blur-sm">
            <ShieldCheck className="w-6 h-6 text-leaf mb-4" />
            <h3 className="font-display text-cloud text-base mb-2">Deterministic 3D Theater</h3>
            <p className="text-sm text-sage leading-relaxed">
              A real-time cel-shaded Three.js engine executing director scripts with lip-sync visemes and camera cuts.
            </p>
          </div>
        </div>

        <div className="text-center mt-12 text-xs text-ash">
          The Dream Machine &middot; Monorepo Scaffold v0.1.0 &middot; Zero Paid Services
        </div>
      </footer>
    </main>
  );
}
