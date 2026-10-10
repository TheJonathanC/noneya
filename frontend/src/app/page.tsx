import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Tags,
  Activity,
  FileText,
  Database,
  Sparkles,
  Monitor,
  Server,
} from "lucide-react";
import { HeroSwarm } from "@/components/landing/HeroSwarm";
import { GithubIcon } from "@/components/common/GithubIcon";

const STAGES = [
  {
    step: "01",
    icon: Camera,
    title: "Good or bad?",
    tech: "Model 1 · EfficientNet + Grad-CAM",
    body: "Every photo is filtered first using EfficientNet for binary OK vs. Defective screening, combined with Grad-CAM for anomaly localization. Nominal parts skip downstream inspection.",
  },
  {
    step: "02",
    icon: Tags,
    title: "What's wrong?",
    tech: "Model 2 · ResNet-18 (or YOLOv8-seg)",
    body: "Defective components are categorized across 6 defect classes using ResNet-18 with attention masking (or YOLOv8-seg for single-pass detection, categorization, and segmentation).",
  },
  {
    step: "03",
    icon: Activity,
    title: "Why did it happen?",
    tech: "Model 3 · XGBoost Root-Cause",
    body: "XGBoost correlates the factory telemetry generator with historical casting datasets to isolate the primary culprit sensor and quantify parameter deviation.",
  },
  {
    step: "04",
    icon: FileText,
    title: "LLM Layer & Reporting",
    tech: "Gemini (2-Step Flow)",
    body: "Gemini first structures raw XGBoost diagnostic signals into clean JSON, followed by a final Gemini call synthesizing the authoritative 3-sentence incident report.",
  },
];

const DASHBOARD_TABS = [
  ["Image", "The photo with defects marked. Opens first for bad parts."],
  ["Report", "The verdict, likely cause, and the recommended action."],
  ["Sensors", "Each machine reading with its recent history."],
  ["Details", "The raw JSON from the pipeline, for engineers."],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1917]">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-[#EAE4D7] bg-[#FAF8F5]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-[#1C1917] flex items-center justify-center p-1 shrink-0">
              <svg viewBox="0 0 32 32" fill="none" className="w-full h-full" aria-hidden="true">
                <circle cx="15" cy="14.5" r="7" stroke="#FAF8F5" strokeWidth="2.75" />
                <path d="M18.5 18L24 23.5" stroke="#FAF8F5" strokeWidth="2.75" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-sm font-semibold tracking-tight">Qastra</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2 text-sm">
            <a
              href="#how-it-works"
              className="hidden sm:inline-block px-3 py-1.5 rounded-lg text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] transition-colors"
            >
              How it works
            </a>
            <a
              href="#architecture"
              className="hidden sm:inline-block px-3 py-1.5 rounded-lg text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] transition-colors"
            >
              Architecture
            </a>
            <Link
              href="/simulation"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] transition-colors font-medium"
            >
              Pipeline Simulation
            </Link>
            <Link
              href="/data"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] transition-colors font-medium"
            >
              Process Data
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1C1917] text-[#FAF8F5] font-medium hover:bg-[#2C2724] active:scale-[0.97] transition-[background-color,transform] duration-150"
            >
              Open dashboard
            </Link>
            <a
              href="https://github.com/TheJonathanC/noneya"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              title="GitHub repository"
              className="inline-flex items-center justify-center p-2 rounded-lg text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] border border-[#E5DFD3] bg-white active:scale-[0.97] transition-[background-color,border-color,color,transform] duration-150 shadow-xs"
            >
              <GithubIcon className="w-4 h-4" />
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-14 sm:pt-20 pb-16 grid lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 text-xs font-medium text-[#78716A] border border-[#E5DFD3] bg-white rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              Casting inspection, from photo to report
            </p>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] text-balance">
              Upload a photo.
              <br />
              Know if the part is good.
            </h1>
            <p className="text-base sm:text-lg text-[#57534E] leading-relaxed max-w-lg text-pretty">
              Qastra checks each casting photo for defects, marks them on the image, and says
              which machine reading probably caused them. You get a short report you can act on.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1C1917] text-[#FAF8F5] text-sm font-semibold hover:bg-[#2C2724] active:scale-[0.97] transition-[background-color,transform] duration-150"
              >
                Open dashboard
                <ArrowRight aria-hidden="true" className="w-4 h-4" />
              </Link>
              <Link
                href="/simulation"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#DDD5C7] bg-white text-sm font-medium text-[#1C1917] hover:bg-[#F3EFE6] active:scale-[0.97] transition-[background-color,transform] duration-150"
              >
                Launch Simulation
                <Sparkles aria-hidden="true" className="w-4 h-4 text-[#D97706]" />
              </Link>
            </div>
          </div>

          <div className="relative aspect-square max-h-[460px] w-full rounded-3xl border border-[#E5DFD3] bg-white shadow-xs overflow-hidden">
            <HeroSwarm className="absolute inset-0" />
            <p className="absolute bottom-3 left-0 right-0 text-center text-[11px] font-mono text-[#A8A29E]">
              part → scan → sensors → verdict
            </p>
          </div>
        </section>

        {/* Flow */}
        <section id="how-it-works" className="border-t border-[#EAE4D7] bg-white scroll-mt-16">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 space-y-10">
            <div className="max-w-xl space-y-2">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                What happens to each photo
              </h2>
              <p className="text-[#57534E] leading-relaxed">
                Four stages run in order on the server. Parts that pass stop after stage one.
              </p>
            </div>

            <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {STAGES.map(({ step, icon: Icon, title, tech, body }) => (
                <li
                  key={step}
                  className="relative rounded-2xl border border-[#E5DFD3] bg-[#FAF8F5] p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-white border border-[#E5DFD3] flex items-center justify-center text-[#1C1917]">
                      <Icon aria-hidden="true" className="w-4 h-4" />
                    </span>
                    <span className="font-mono text-xs text-[#A8A29E]">{step}</span>
                  </div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-[#57534E] leading-relaxed">{body}</p>
                  <p className="text-[11px] font-mono text-[#78716A] pt-1 border-t border-[#EAE4D7]">
                    {tech}
                  </p>
                </li>
              ))}
            </ol>

            <div className="rounded-2xl border border-[#E5DFD3] p-5 sm:p-6 grid md:grid-cols-[1fr_2fr] gap-5">
              <div className="space-y-1.5">
                <h3 className="font-semibold">What you see in the dashboard</h3>
                <p className="text-sm text-[#57534E] leading-relaxed">
                  Bad parts open on the image. Good parts open on a short “All Good” card.
                </p>
              </div>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {DASHBOARD_TABS.map(([name, desc]) => (
                  <div key={name}>
                    <dt className="font-medium">{name}</dt>
                    <dd className="text-[#57534E]">{desc}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section id="architecture" className="border-t border-[#EAE4D7] scroll-mt-16">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 space-y-10">
            <div className="max-w-xl space-y-2">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Architecture</h2>
              <p className="text-[#57534E] leading-relaxed">
                A Next.js frontend sends photos to one FastAPI endpoint. The backend runs the
                models, saves the readings, and asks Gemini to write the report.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E5DFD3] bg-white p-5 sm:p-8">
              <div className="grid lg:grid-cols-[1fr_auto_1.4fr_auto_1fr] gap-4 items-stretch">
                {/* Client */}
                <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F5] p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Monitor aria-hidden="true" className="w-4 h-4" /> Frontend
                  </div>
                  <p className="text-xs text-[#57534E] leading-relaxed">
                    Next.js 16, React 19, Tailwind. Uploads images, draws defect outlines and
                    heatmaps, shows the report and sensor history.
                  </p>
                  <p className="text-[11px] font-mono text-[#78716A]">/dashboard</p>
                </div>

                <FlowArrow label="multipart upload" />

                {/* API */}
                <div className="rounded-xl border border-[#1C1917] bg-[#FAF8F5] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Server aria-hidden="true" className="w-4 h-4" /> FastAPI backend
                  </div>
                  <p className="text-[11px] font-mono text-[#78716A]">POST /api/inspect</p>
                  <ul className="space-y-1.5 text-xs">
                    {[
                      "Model 1: EfficientNet (binary OK vs. Defective) + Grad-CAM",
                      "Model 2: ResNet-18 (6 defect classes with attention masking) or YOLOv8-seg",
                      "Model 3: XGBoost root-cause with factory telemetry & historical data",
                      "LLM Layer: Gemini (JSON structurer + 3-sentence incident report)",
                    ].map((line) => (
                      <li
                        key={line}
                        className="rounded-lg bg-white border border-[#EAE4D7] px-2.5 py-1.5 text-[#1C1917]"
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-[#78716A]">Runs in Docker on a VPS.</p>
                </div>

                <FlowArrow label="save · summarize" />

                {/* Services */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F5] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Database aria-hidden="true" className="w-4 h-4" /> MongoDB Atlas
                    </div>
                    <p className="text-xs text-[#57534E] leading-relaxed">
                      Each inspection&apos;s telemetry is stored with Beanie, which gives the
                      Sensors tab its history.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F5] p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Sparkles aria-hidden="true" className="w-4 h-4" /> Gemini
                    </div>
                    <p className="text-xs text-[#57534E] leading-relaxed">
                      Two-stage pipeline: first structures XGBoost outputs into clean JSON, then generates the final 3-sentence incident report.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[#EAE4D7] bg-[#1C1917] text-[#FAF8F5]">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-14 flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                Try it on a casting photo
              </h2>
              <p className="text-sm text-[#D6D3D1]">Drop in one image, or a batch of up to ten.</p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FAF8F5] text-[#1C1917] text-sm font-semibold hover:bg-white active:scale-[0.97] transition-[background-color,transform] duration-150"
            >
              Open dashboard
              <ArrowRight aria-hidden="true" className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#EAE4D7] bg-[#FAF8F5] py-8 px-5 sm:px-8 text-xs text-[#78716A]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded-md bg-[#1C1917] flex items-center justify-center p-0.5 shrink-0">
              <svg viewBox="0 0 32 32" fill="none" className="w-full h-full" aria-hidden="true">
                <circle cx="15" cy="14.5" r="7" stroke="#FAF8F5" strokeWidth="2.75" />
                <path d="M18.5 18L24 23.5" stroke="#FAF8F5" strokeWidth="2.75" strokeLinecap="round" />
              </svg>
            </span>
            <span className="font-semibold text-[#1C1917]">Qastra</span>
            <span className="text-[#D6D3D1]">·</span>
            <span>Automated Component Quality Analysis</span>
          </div>

          <a
            href="https://github.com/TheJonathanC/noneya"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5DFD3] bg-white text-[#57534E] hover:text-[#1C1917] hover:bg-[#F3EFE6] active:scale-[0.97] transition-all font-mono text-[11px] shadow-xs"
          >
            <GithubIcon className="w-3.5 h-3.5" />
            <span>TheJonathanC/noneya</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex lg:flex-col items-center justify-center gap-1.5 text-[#A8A29E]">
      <span className="text-[10px] font-mono text-center leading-tight max-w-[72px]">{label}</span>
      <ArrowRight aria-hidden="true" className="w-4 h-4 rotate-90 lg:rotate-0" />
    </div>
  );
}
