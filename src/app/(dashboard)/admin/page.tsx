"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Shield, Save, Plus, Trash2, CreditCard, Banknote } from "lucide-react";

export default function AdminPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeEmployee, setActiveEmployee] = useState<string | null>(null);

  // Loan form
  const [loanAmount, setLoanAmount] = useState("");
  const [loanDesc, setLoanDesc] = useState("");
  const [loanMonthly, setLoanMonthly] = useState("");
  const [showLoanForm, setShowLoanForm] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);
    if (p?.role !== "admin") { setLoading(false); return; }

    const [empRes, loansRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("loans").select("*, profiles(full_name)").eq("is_paid_off", false).order("created_at", { ascending: false }),
    ]);
    setEmployees(empRes.data || []);
    setLoans(loansRes.data || []);
    setLoading(false);
  }

  async function saveRates(emp: any) {
    setSaving(emp.id);
    await supabase.from("profiles").update({
      hourly_rate: emp.hourly_rate,
      vacation_rate: emp.vacation_rate,
      sick_rate: emp.sick_rate,
      day_off_rate: emp.day_off_rate,
    }).eq("id", emp.id);
    setSaving(null);
  }

  async function toggleRole(id: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "employee" : "admin";
    await supabase.from("profiles").update({ role: newRole }).eq("id", id);
    loadData();
  }

  async function addLoan() {
    if (!activeEmployee || !loanAmount) return;
    await supabase.from("loans").insert({
      user_id: activeEmployee,
      amount: parseFloat(loanAmount),
      remaining: parseFloat(loanAmount),
      description: loanDesc || null,
      monthly_deduction: parseFloat(loanMonthly) || 0,
    });
    setLoanAmount(""); setLoanDesc(""); setLoanMonthly(""); setShowLoanForm(false);
    loadData();
  }

  async function deleteLoan(id: string) {
    if (!confirm("Smazat půjčku?")) return;
    await supabase.from("loans").delete().eq("id", id);
    loadData();
  }

  function updateEmployeeField(id: string, field: string, value: string) {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, [field]: parseFloat(value) || 0 } : e));
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-ink-500">Načítání...</div></div>;
  if (profile?.role !== "admin") return (
    <div className="max-w-md mx-auto text-center py-16">
      <Shield className="w-16 h-16 text-ink-300 mx-auto mb-4" />
      <h2 className="font-display font-bold text-xl text-ink-900 mb-2">Přístup odepřen</h2>
      <p className="text-ink-500">Tato sekce je dostupná pouze pro administrátory.</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Employees with rates */}
      <div>
        <h2 className="font-display font-bold text-xl text-ink-900 mb-4">Zaměstnanci a sazby</h2>
        <div className="space-y-4">
          {employees.map((emp) => (
            <div key={emp.id} className="card p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center font-display font-semibold text-brand-700 text-sm">
                  {emp.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-ink-900">{emp.full_name}</p>
                  <p className="text-xs text-ink-500">{emp.email}</p>
                </div>
                <span className={`badge ${emp.role === "admin" ? "bg-brand-100 text-brand-700" : "bg-surface-100 text-ink-500"}`}>
                  {emp.role === "admin" ? "Admin" : "Zaměstnanec"}
                </span>
                {emp.id !== profile?.id && (
                  <button onClick={() => toggleRole(emp.id, emp.role)} className="btn-secondary text-xs px-3 py-1.5">
                    {emp.role === "admin" ? "Odebrat admina" : "Nastavit admina"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="label text-xs">Práce (Kč/h)</label>
                  <input type="number" className="input text-sm" value={emp.hourly_rate} onChange={e => updateEmployeeField(emp.id, "hourly_rate", e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Dovolená (Kč/h)</label>
                  <input type="number" className="input text-sm" value={emp.vacation_rate} onChange={e => updateEmployeeField(emp.id, "vacation_rate", e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Nemoc (Kč/h)</label>
                  <input type="number" className="input text-sm" value={emp.sick_rate} onChange={e => updateEmployeeField(emp.id, "sick_rate", e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Volno (Kč/h)</label>
                  <input type="number" className="input text-sm" value={emp.day_off_rate} onChange={e => updateEmployeeField(emp.id, "day_off_rate", e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button onClick={() => saveRates(emp)} disabled={saving === emp.id} className="btn-primary text-sm">
                  <Save className="w-4 h-4" /> {saving === emp.id ? "Ukládání..." : "Uložit sazby"}
                </button>
                <button onClick={() => { setActiveEmployee(emp.id); setShowLoanForm(true); }} className="btn-secondary text-sm">
                  <Banknote className="w-4 h-4" /> Přidat půjčku
                </button>
              </div>
              {/* Loans for this employee */}
              {loans.filter(l => l.user_id === emp.id).length > 0 && (
                <div className="mt-4 border-t border-surface-200 pt-3">
                  <p className="text-xs font-semibold text-ink-500 mb-2">Aktivní půjčky:</p>
                  {loans.filter(l => l.user_id === emp.id).map(loan => (
                    <div key={loan.id} className="flex items-center gap-3 py-1.5 text-sm">
                      <CreditCard className="w-4 h-4 text-ink-300" />
                      <span className="text-ink-700">{loan.description || "Půjčka"}</span>
                      <span className="font-medium text-ink-900">{formatCurrency(loan.amount)}</span>
                      <span className="text-ink-500">zbývá {formatCurrency(loan.remaining)}</span>
                      {loan.monthly_deduction > 0 && <span className="text-ink-400">({formatCurrency(loan.monthly_deduction)}/měs.)</span>}
                      <button onClick={() => deleteLoan(loan.id)} className="ml-auto text-ink-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Loan form modal */}
      {showLoanForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm" onClick={() => setShowLoanForm(false)}>
          <div className="card p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-lg mb-4">Nová půjčka</h3>
            <p className="text-sm text-ink-500 mb-4">Pro: {employees.find(e => e.id === activeEmployee)?.full_name}</p>
            <div className="space-y-3">
              <div>
                <label className="label">Částka (Kč)</label>
                <input type="number" className="input" value={loanAmount} onChange={e => setLoanAmount(e.target.value)} placeholder="10000" />
              </div>
              <div>
                <label className="label">Popis</label>
                <input type="text" className="input" value={loanDesc} onChange={e => setLoanDesc(e.target.value)} placeholder="Záloha na nářadí..." />
              </div>
              <div>
                <label className="label">Měsíční splátka (Kč)</label>
                <input type="number" className="input" value={loanMonthly} onChange={e => setLoanMonthly(e.target.value)} placeholder="2000" />
              </div>
              <div className="flex gap-3">
                <button onClick={addLoan} className="btn-primary flex-1">Přidat půjčku</button>
                <button onClick={() => setShowLoanForm(false)} className="btn-secondary">Zrušit</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
