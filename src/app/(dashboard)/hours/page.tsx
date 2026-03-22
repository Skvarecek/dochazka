"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatDate, entryTypeLabel, entryTypeColor } from "@/lib/utils";
import { Plus, X, Trash2, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from "date-fns";
import { cs } from "date-fns/locale";

export default function HoursPage() {
  const supabase = createClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entries, setEntries] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  // Form
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formHours, setFormHours] = useState("8");
  const [formType, setFormType] = useState("work");
  const [formProject, setFormProject] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formNote, setFormNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, [currentMonth]);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const monthStart = startOfMonth(currentMonth).toISOString().split("T")[0];
    const monthEnd = endOfMonth(currentMonth).toISOString().split("T")[0];

    const [entriesRes, projectsRes, locksRes] = await Promise.all([
      supabase.from("work_entries").select("*, projects(name)").eq("user_id", user.id).gte("date", monthStart).lte("date", monthEnd).order("date", { ascending: false }),
      supabase.from("projects").select("*").eq("is_active", true).order("name"),
      supabase.from("monthly_locks").select("*").eq("month", monthStart),
    ]);

    setEntries(entriesRes.data || []);
    setProjects(projectsRes.data || []);
    setIsLocked((locksRes.data || []).length > 0);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("work_entries").insert({
      user_id: user.id,
      date: formDate,
      hours: parseFloat(formHours),
      entry_type: formType,
      project_id: formProject || null,
      location: formLocation || null,
      note: formNote || null,
    });

    if (!error) {
      setShowForm(false);
      setFormDate(new Date().toISOString().split("T")[0]);
      setFormHours("8");
      setFormType("work");
      setFormProject("");
      setFormLocation("");
      setFormNote("");
      loadData();
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Opravdu smazat tento záznam?")) return;
    await supabase.from("work_entries").delete().eq("id", id);
    loadData();
  }

  const totalWork = entries.filter(e => e.entry_type === "work").reduce((s, e) => s + Number(e.hours), 0);
  const totalOther = entries.filter(e => e.entry_type !== "work").reduce((s, e) => s + Number(e.hours), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="btn-secondary p-2"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="font-display font-bold text-xl text-ink-900">{format(currentMonth, "LLLL yyyy", { locale: cs })}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="btn-secondary p-2"><ChevronRight className="w-5 h-5" /></button>
        </div>
        {!isLocked && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? <><X className="w-4 h-4" /> Zrušit</> : <><Plus className="w-4 h-4" /> Zapsat hodiny</>}
          </button>
        )}
        {isLocked && <span className="badge bg-red-100 text-red-700">Měsíc uzavřen</span>}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Clock className="w-5 h-5 text-blue-600" /></div>
          <div>
            <p className="text-xs text-ink-500">Práce</p>
            <p className="text-xl font-display font-bold text-ink-900">{totalWork} h</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Clock className="w-5 h-5 text-purple-600" /></div>
          <div>
            <p className="text-xs text-ink-500">Dovolená / Nemoc / Volno</p>
            <p className="text-xl font-display font-bold text-ink-900">{totalOther} h</p>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-6 animate-in">
          <h3 className="font-display font-semibold text-lg mb-4">Nový záznam</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Datum</label>
                <input type="date" className="input" value={formDate} onChange={e => setFormDate(e.target.value)} required />
              </div>
              <div>
                <label className="label">Hodiny</label>
                <input type="number" className="input" value={formHours} onChange={e => setFormHours(e.target.value)} min="0.5" max="24" step="0.5" required />
              </div>
              <div>
                <label className="label">Typ</label>
                <select className="input" value={formType} onChange={e => setFormType(e.target.value)}>
                  <option value="work">Práce</option>
                  <option value="vacation">Dovolená</option>
                  <option value="sick">Nemocenská</option>
                  <option value="day_off">Volno</option>
                </select>
              </div>
            </div>
            {formType === "work" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Zakázka</label>
                  <select className="input" value={formProject} onChange={e => setFormProject(e.target.value)}>
                    <option value="">-- Vyberte zakázku --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}{p.address ? ` (${p.address})` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Místo</label>
                  <input type="text" className="input" value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="Adresa / místo práce" />
                </div>
              </div>
            )}
            <div>
              <label className="label">Poznámka – co jste dělal/a</label>
              <textarea className="input min-h-[80px] resize-y" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Popis práce..." />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary">{submitting ? "Ukládání..." : "Uložit záznam"}</button>
          </form>
        </div>
      )}

      {/* Entries list */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200">
          <h3 className="font-display font-semibold text-ink-900">Záznamy</h3>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-ink-500">Načítání...</div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-12 text-center text-ink-500">Žádné záznamy pro tento měsíc</div>
        ) : (
          <div className="divide-y divide-surface-100">
            {entries.map((entry) => (
              <div key={entry.id} className="px-6 py-3 flex items-center gap-3">
                <div className="w-20 text-xs text-ink-500 flex-shrink-0">{formatDate(entry.date, "EEE d.M.")}</div>
                <span className={`badge flex-shrink-0 ${entryTypeColor(entry.entry_type)}`}>{entryTypeLabel(entry.entry_type)}</span>
                <div className="flex-1 min-w-0 text-sm truncate">
                  {entry.projects?.name && <span className="font-medium text-ink-900">{entry.projects.name}</span>}
                  {entry.location && <span className="text-ink-400"> · {entry.location}</span>}
                  {entry.note && <span className="text-ink-500"> – {entry.note}</span>}
                </div>
                <div className="font-mono text-sm font-medium text-ink-900 flex-shrink-0">{Number(entry.hours)} h</div>
                {!entry.is_locked && !isLocked && (
                  <button onClick={() => handleDelete(entry.id)} className="text-ink-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
