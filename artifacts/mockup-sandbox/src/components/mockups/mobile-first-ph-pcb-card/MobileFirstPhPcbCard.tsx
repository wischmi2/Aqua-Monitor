import { useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BatteryCharging,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Gauge,
  Radio,
  Thermometer,
  Zap,
} from "lucide-react";

type Metric = { label: string; value: string; unit?: string; tone?: "warn" | "good" };

const phMetrics: Metric[] = [
  { label: "Calibration", value: "7", unit: "point" },
  { label: "Signal", value: "155.93", unit: "mV" },
  { label: "Water temp", value: "25.1", unit: "°C" },
];

const healthMetrics: Metric[] = [
  { label: "Charge state", value: "Charging", tone: "good" },
  { label: "Battery voltage", value: "3.657", unit: "V", tone: "good" },
  { label: "Current draw", value: "152.5", unit: "mA" },
];

function CompactMetric({ metric }: { metric: Metric }) {
  return (
    <div className="flex min-h-11 items-center justify-between border-b border-[#e7e4dc] last:border-0">
      <span className="text-[12px] text-[#77786f]">{metric.label}</span>
      <span className={`font-mono text-[12px] font-semibold ${metric.tone === "good" ? "text-[#18765f]" : "text-[#252a28]"}`}>
        {metric.value}
        {metric.unit && <span className="ml-1 font-sans text-[10px] font-normal text-[#8b8c83]">{metric.unit}</span>}
      </span>
    </div>
  );
}

function ReadingBlock({ title, icon: Icon, children }: { title: string; icon: typeof Gauge; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e4e2da] bg-[#fffefa] p-4 shadow-[0_5px_20px_rgba(37,42,40,0.035)]">
      <div className="mb-1 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#eef0e7] text-[#59665e]"><Icon size={16} /></span>
        <h3 className="text-[13px] font-semibold text-[#303631]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function MobileFirstPhPcbCard() {
  const [expanded, setExpanded] = useState(new URLSearchParams(window.location.search).get("state") === "expanded");

  return (
    <main className="min-h-[100dvh] bg-[#f5f4ee] px-4 py-6 text-[#252a28] sm:px-8">
      <div className="mx-auto w-full max-w-[390px]">
        <header className="mb-4 flex items-end justify-between px-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#77786f]">Sensor PCB</p>
            <p className="mt-1 text-[12px] text-[#92938a]">Water quality + board health</p>
          </div>
          <span className="rounded-lg border border-[#deddd5] bg-[#faf9f4] px-2 py-1 font-mono text-[10px] text-[#7e8078]">PCB-04</span>
        </header>

        <div className="overflow-hidden rounded-[24px] border border-[#deddD5] bg-[#fbfaf5] shadow-[0_16px_40px_rgba(44,49,43,0.08)]">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="mobile-pcb-details"
            onClick={() => setExpanded((value) => !value)}
            className="block min-h-[210px] w-full px-5 pb-5 pt-5 text-left transition-colors active:bg-[#f5f3eb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd5f45] focus-visible:ring-inset"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#f9e7df] px-3 py-1.5 text-[11px] font-semibold text-[#a44935]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#c2543c]" /> Critical
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#77786f]">
                {expanded ? "Collapse" : "Inspect"} {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </span>
            </div>
            <div className="mt-7">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8b8c83]">pH level</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-[52px] font-semibold leading-none tracking-[-0.08em] text-[#bd4d38]">3.963</span>
                <span className="text-[13px] text-[#8b8c83]">pH</span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-[#a44935]">
                <AlertTriangle size={13} /> Outside normal range · 8.0–8.4
              </div>
            </div>
          </button>

          {expanded && (
            <div id="mobile-pcb-details" className="space-y-3 border-t border-[#e4e2da] bg-[#f8f7f1] p-4">
              <div className="flex items-center gap-2 px-1 text-[11px] text-[#77786f]">
                <Radio size={14} className="text-[#59665e]" /> Latest LightDB stream payload
              </div>
              <ReadingBlock title="pH readings" icon={Gauge}>
                <div className="mt-2">{phMetrics.map((metric) => <CompactMetric key={metric.label} metric={metric} />)}</div>
              </ReadingBlock>
              <ReadingBlock title="Battery & board health" icon={BatteryCharging}>
                <div className="mt-2">{healthMetrics.map((metric) => <CompactMetric key={metric.label} metric={metric} />)}</div>
                <div className="mt-3 flex min-h-11 items-center justify-between rounded-xl bg-[#e7f1e9] px-3 text-[11px] font-medium text-[#18765f]">
                  <span className="inline-flex items-center gap-2"><Check size={14} /> VBUS connected</span><Zap size={14} />
                </div>
              </ReadingBlock>
              <div className="grid grid-cols-2 gap-2 px-1 pt-1 text-[10px] text-[#77786f]">
                <span className="inline-flex items-center gap-1.5"><Cpu size={13} /> Board online</span>
                <span className="inline-flex items-center justify-end gap-1.5"><Thermometer size={13} /> Temp in °C</span>
                <span className="font-mono">err: 0</span>
                <span className="text-right">updated 12 sec ago</span>
              </div>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-[10px] text-[#999a91]">Tap the card to reveal complete telemetry</p>
      </div>
    </main>
  );
}
