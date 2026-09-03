import { AlertTriangle, CalendarCheck, ClipboardCheck, ShieldCheck, Inbox, Sparkles, Upload, CheckCircle2, Circle, FileText, ClipboardList, HardHat, Search, PenLine, BadgeCheck, Home, type LucideIcon } from "lucide-react";

// Product pictures drawn from the product's own parts.
//
// A screenshot goes stale the week after it is taken and needs a
// signed-in account to make. These are the dashboard and the client
// portal rebuilt in miniature from the same shapes and colours the real
// screens use, with a project that does not exist. They are pictures,
// not the product: nothing here is interactive.

const SAMPLE_ADDRESS = "14 Wattle Street, Kellyville";

function Tile({ icon: Icon, label, value, alert = false }: { icon: LucideIcon; label: string; value: number; alert?: boolean }) {
  return (
    <div className={`rounded-lg border bg-white p-2.5 ${alert ? "border-red-200" : "border-slate-200"}`}>
      <Icon size={13} className={alert ? "text-red-600" : "text-[#2fa6a0]"} />
      <div className={`mt-1.5 text-[18px] font-bold leading-none ${alert ? "text-red-600" : "text-slate-900"}`}>{value}</div>
      <div className="mt-1 text-[8.5px] font-medium leading-tight text-slate-500">{label}</div>
    </div>
  );
}

export function DashboardMockup() {
  return (
    <div className="rise-in-late overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(26,58,95,0.16)]">
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        <span className="ml-3 rounded-md bg-white px-2 py-0.5 text-[9px] text-slate-400 border border-slate-200">app.certlyn.com.au/dashboard</span>
      </div>
      <div className="grid sm:grid-cols-[46px_1fr]">
        <div className="hidden flex-col items-center gap-3 border-r border-slate-200 bg-[#1a3a5f] py-3 sm:flex">
          {[Home, ClipboardList, HardHat, FileText, Search].map((Icon, i) => (
            <span key={i} className={`flex h-7 w-7 items-center justify-center rounded-md ${i === 0 ? "bg-white/15 text-white" : "text-white/60"}`}>
              <Icon size={13} />
            </span>
          ))}
        </div>
        <div className="bg-[#f5f7fa] p-3 sm:p-4">
          <div className="text-[13px] font-bold text-slate-900">Dashboard</div>
          <div className="text-[9px] text-slate-500">Good morning, Sarah. Here&rsquo;s what&rsquo;s happening today.</div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[9.5px] font-semibold text-slate-900">
              <Sparkles size={11} className="text-[#2fa6a0]" /> Your assistant
            </div>
            <p className="mt-1 text-[9px] leading-snug text-slate-700">
              Two clients sent documents overnight. The BASIX certificate for {SAMPLE_ADDRESS} arrived at 7:40 am and is waiting on you to
              assess. The slab inspection at 8 Banksia Close is booked for 10:30 today.
            </p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            <Tile icon={AlertTriangle} label="Actions require attention" value={3} alert />
            <Tile icon={CalendarCheck} label="Inspections today" value={2} />
            <Tile icon={ClipboardCheck} label="Assessments in progress" value={7} />
            <Tile icon={ShieldCheck} label="Approvals to issue" value={2} />
            <Tile icon={Inbox} label="Documents for review" value={5} />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px]">
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-1.5 border-b border-slate-200 px-3 py-1.5 text-[9.5px] font-semibold text-slate-900">
                <CalendarCheck size={11} className="text-[#2fa6a0]" /> Today&rsquo;s inspections
              </div>
              {[
                ["Slab inspection", "8 Banksia Close, Rouse Hill", "10:30"],
                ["Frame inspection", "27 Ironbark Avenue, Box Hill", "1:00"],
              ].map(([title, addr, time]) => (
                <div key={title} className="flex items-center justify-between border-t border-slate-100 px-3 py-1.5 first:border-t-0">
                  <div>
                    <div className="text-[9.5px] font-medium text-slate-900">{title}</div>
                    <div className="text-[8.5px] text-slate-500">{addr}</div>
                  </div>
                  <span className="rounded-full bg-[#2f5c8f] px-2 py-0.5 text-[8px] font-semibold text-white">{time}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-2.5">
              <div className="text-[9.5px] font-semibold text-slate-900">Projects</div>
              <div className="mx-auto mt-2 h-16 w-16 rounded-full" style={{ background: "conic-gradient(#2fa6a0 0 30%, #f9a825 30% 45%, #8e44ad 45% 70%, #1a3a5f 70% 92%, #2e7d32 92% 100%)" }}>
                <div className="m-[9px] flex h-[46px] w-[46px] items-center justify-center rounded-full bg-white text-[12px] font-bold text-slate-900">24</div>
              </div>
              <div className="mt-2 space-y-0.5 text-[8px] text-slate-600">
                <div className="flex justify-between"><span>In assessment</span><span>7</span></div>
                <div className="flex justify-between"><span>Under construction</span><span>11</span></div>
                <div className="flex justify-between"><span>Complete</span><span>2</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PortalMockup() {
  const items: { title: string; state: "done" | "waiting" | "todo" }[] = [
    { title: "Site plan", state: "done" },
    { title: "Structural engineer's certificate", state: "done" },
    { title: "BASIX certificate", state: "waiting" },
    { title: "Home Building Compensation certificate", state: "todo" },
  ];
  return (
    <div className="mx-auto w-[300px] rounded-[2rem] border-[6px] border-slate-900 bg-slate-900 shadow-[0_24px_60px_rgba(26,58,95,0.2)]">
      <div className="overflow-hidden rounded-[1.6rem] bg-[#f5f7fa]">
        <div className="bg-[#1a3a5f] px-4 pb-4 pt-6 text-white">
          <div className="text-[9px] uppercase tracking-[0.2em] text-white/60">Your project</div>
          <div className="mt-1 text-[14px] font-bold leading-tight">{SAMPLE_ADDRESS}</div>
          <div className="mt-1 text-[9px] text-white/70">New two-storey dwelling · CDC</div>
          <div className="mt-3 flex items-center gap-1">
            {["Application", "Documents", "Certificate", "Inspections", "OC"].map((s, i) => (
              <div key={s} className="flex-1">
                <div className={`h-1 rounded-full ${i < 2 ? "bg-[#f0b93a]" : "bg-white/25"}`} />
                <div className={`mt-1 text-[7px] ${i < 2 ? "text-white" : "text-white/50"}`}>{s}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-3">
          <div className="text-[10px] font-semibold text-slate-900">Documents we need from you</div>
          <div className="mt-2 space-y-1.5">
            {items.map((item) => (
              <div key={item.title} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                {item.state === "done" ? (
                  <CheckCircle2 size={13} className="shrink-0 text-[#2e7d32]" />
                ) : item.state === "waiting" ? (
                  <Circle size={13} className="shrink-0 text-[#f9a825]" />
                ) : (
                  <Circle size={13} className="shrink-0 text-slate-300" />
                )}
                <span className="flex-1 text-[9.5px] leading-tight text-slate-800">{item.title}</span>
                {item.state === "done" && <span className="text-[8px] font-semibold text-[#2e7d32]">Approved</span>}
                {item.state === "waiting" && <span className="text-[8px] font-semibold text-[#8a6100]">Being reviewed</span>}
                {item.state === "todo" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#1a3a5f] px-2 py-0.5 text-[8px] font-semibold text-white">
                    <Upload size={9} /> Upload
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
            <div className="text-[9.5px] font-semibold text-slate-900">Next inspection</div>
            <div className="mt-0.5 text-[9px] text-slate-600">Slab — Tuesday 8 September, 10:30 am</div>
            <div className="mt-0.5 text-[8.5px] text-[#2e7d32]">Confirmed by your certifier</div>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-2">
            <div>
              <div className="text-[9.5px] font-semibold text-slate-900">Invoice INV-0142</div>
              <div className="text-[8.5px] text-slate-500">$2,750.00 · paid 1 Sept</div>
            </div>
            <BadgeCheck size={14} className="text-[#2e7d32]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// The seven stages the brief names, as one line on a desk and one
// column on a phone.
export const WORKFLOW: { title: string; text: string; icon: LucideIcon }[] = [
  { title: "Application", text: "Quote accepted, project set up, land and consent details filled from the address.", icon: ClipboardList },
  { title: "Certification", text: "The certifier assesses the application against the code or consent.", icon: Search },
  { title: "Documents", text: "Clients upload what's needed into their portal; you review and approve.", icon: FileText },
  { title: "Inspections", text: "Booked, carried out on site, signed and reported to the Portal.", icon: HardHat },
  { title: "Amendments / Requests", text: "Send a document back with a note, or record a modification.", icon: PenLine },
  { title: "Approval", text: "The CDC or CC issued, the approved set stamped and bundled.", icon: ShieldCheck },
  { title: "Occupation Certificate", text: "Whole or partial, with every inspection report behind it.", icon: BadgeCheck },
];

export function WorkflowStrip() {
  return (
    <ol className="grid gap-3 md:grid-cols-7 md:gap-2">
      {WORKFLOW.map((stage, i) => {
        const Icon = stage.icon;
        return (
          <li key={stage.title} className="relative flex gap-3 md:block">
            <div className="flex flex-col items-center md:flex-row md:items-center">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1a3a5f] text-white shadow-sm">
                <Icon size={18} />
              </span>
              {i < WORKFLOW.length - 1 && <span className="mt-1 h-full w-px flex-1 bg-slate-200 md:mt-0 md:h-px md:w-auto md:flex-1" />}
            </div>
            <div className="pb-4 md:pb-0 md:pr-2 md:pt-3">
              <div className="text-[12px] font-bold uppercase tracking-wide text-[#1a3a5f]">{stage.title}</div>
              <p className="mt-1 text-[13px] leading-snug text-slate-600">{stage.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
