"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Wallet, Download, Lock, Unlock, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from "date-fns";
import { cs } from "date-fns/locale";

type PayrollRow = {
  id: string;
  name: string;
  workHours: number;
  workPay: number;
  vacationHours: number;
  vacationPay: number;
  sickHours: number;
  sickPay: number;
  dayOffHours: number;
  dayOffPay: number;
  grossPay: number;
  loanDeductions: number;
  otherDeductions: number;
  netPay: number;
};

export default function PayrollPage() {
  const supabase = createClient();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [currentMonth]);

  async function loadData() {
    setLoading(true);
    const monthStr = format(currentMonth, "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const [profilesRes, entriesRes, loansRes, deductionsRes, locksRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("work_entries").select("*").gte("date", monthStr).lte("date", monthEnd),
      supabase.from("loans").select("*").eq("is_paid_off", false),
      supabase.from("deductions").select("*").eq("month", monthStr),
      supabase.from("monthly_locks").select("*").eq("month", monthStr),
    ]);

    const profiles = profilesRes.data || [];
    const entries = entriesRes.data || [];
    const loans = loansRes.data || [];
    const deductions = deductionsRes.data || [];

    setIsLocked((locksRes.data || []).length > 0);

    const payroll: PayrollRow[] = profiles.map((p: any) => {
      const myEntries = entries.filter((e: any) => e.user_id === p.id);
      const workHours = myEntries.filter((e: any) => e.entry_type === "work").reduce((s: number, e: any) => s + Number(e.hours), 0);
      const vacationHours = myEntries.filter((e: any) => e.entry_type === "vacation").reduce((s: number, e: any) => s + Number(e.hours), 0);
      const sickHours = myEntries.filter((e: any) => e.entry_type === "sick").reduce((s: number, e: any) => s + Number(e.hours), 0);
      const dayOffHours = myEntries.filter((e: any) => e.entry_type === "day_off").reduce((s: number, e: any) => s + Number(e.hours), 0);

      const workPay = workHours * Number(p.hourly_rate);
      const vacationPay = vacationHours * Number(p.vacation_rate);
      const sickPay = sickHours * Number(p.sick_rate);
      const dayOffPay = dayOffHours * Number(p.day_off_rate);
      const grossPay = workPay + vacationPay + sickPay + dayOffPay;

      const loanDeductions = loans.filter((l: any) => l.user_id === p.id).reduce((s: number, l: any) => s + Number(l.monthly_deduction), 0);
      const otherDeductions = deductions.filter((d: any) => d.user_id === p.id).reduce((s: number, d: any) => s + Number(d.amount), 0);
      const netPay = grossPay - loanDeductions - otherDeductions;

      return {
        id: p.id, name: p.full_name,
        workHours, workPay, vacationHours, vacationPay,
        sickHours, sickPay, dayOffHours, dayOffPay,
        grossPay, loanDeductions, otherDeductions, netPay,
      };
    });

    setRows(payroll);
    setLoading(false);
  }

  async function toggleLock() {
    const monthStr = format(currentMonth, "yyyy-MM-dd");
    const { data: { user } } = await supabase.auth.getUser();
    if (isLocked) {
      await supabase.from("monthly_locks").delete().eq("month", monthStr);
    } else {
      await supabase.from("monthly_locks").insert({ month: monthStr, locked_by: user?.id });
      // Lock all entries for this month
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      await supabase.from("work_entries").update({ is_locked: true }).gte("date", monthStr).lte("date", monthEnd);
    }
    loadData();
  }

  function exportCSV() {
    const headers = ["Zaměstnanec", "Práce (h)", "Práce (Kč)", "Dovolená (h)", "Dovolená (Kč)", "Nemoc (h)", "Nemoc (Kč)", "Volno (h)", "Volno (Kč)", "Hrubá mzda", "Splátky půjček", "Ostatní srážky", "K výplatě"];
    const csvRows = rows.map(r => [
      r.name, r.workHours, r.workPay, r.vacationHours, r.vacationPay,
      r.sickHours, r.sickPay, r.dayOffHours, r.dayOffPay,
      r.grossPay, r.loanDeductions, r.otherDeductions, r.netPay,
    ].join(";"));

    const totalNet = rows.reduce((s, r) => s + r.netPay, 0);
    csvRows.push(["", "", "", "", "", "", "", "", "", "", "", "CELKEM K VÝPLATĚ", totalNet].join(";"));

    const bom = "\uFEFF";
    const csv = bom + [headers.join(";"), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vyplaty-${format(currentMonth, "yyyy-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalGross = rows.reduce((s, r) => s + r.grossPay, 0);
  const totalDeductions = rows.reduce((s, r) => s + r.loanDeductions + r.otherDeductions, 0);
  const totalNet = rows.reduce((s, r) => s + r.netPay, 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-ink-500">Načítání...</div></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="btn-secondary p-2"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="font-display font-bold text-xl text-ink-900">{format(currentMonth, "LLLL yyyy", { locale: cs })}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="btn-secondary p-2"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={toggleLock} className={isLocked ? "btn-danger" : "btn-primary"}>
            {isLocked ? <><Unlock className="w-4 h-4" /> Odemknout měsíc</> : <><Lock className="w-4 h-4" /> Uzavřít měsíc</>}
          </button>
        </div>
      </div>

      {isLocked && <div className="badge bg-red-100 text-red-700 text-sm px-4 py-2">Tento měsíc je uzavřen – zaměstnanci nemohou měnit záznamy.</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div>
            <span className="text-sm text-ink-500">Hrubé mzdy celkem</span>
          </div>
          <p className="text-2xl font-display font-bold text-ink-900">{formatCurrency(totalGross)}</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><Wallet className="w-5 h-5 text-amber-600" /></div>
            <span className="text-sm text-ink-500">Srážky celkem</span>
          </div>
          <p className="text-2xl font-display font-bold text-ink-900">{formatCurrency(totalDeductions)}</p>
        </div>
        <div className="card p-5 ring-2 ring-brand-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Wallet className="w-5 h-5 text-brand-600" /></div>
            <span className="text-sm font-semibold text-brand-700">CELKEM K VÝPLATĚ</span>
          </div>
          <p className="text-3xl font-display font-bold text-brand-700">{formatCurrency(totalNet)}</p>
        </div>
      </div>

      {/* Payroll table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50">
                <th className="text-left px-4 py-3 font-medium text-ink-500">Zaměstnanec</th>
                <th className="text-right px-3 py-3 font-medium text-ink-500">Práce</th>
                <th className="text-right px-3 py-3 font-medium text-ink-500">Dovolená</th>
                <th className="text-right px-3 py-3 font-medium text-ink-500">Nemoc</th>
                <th className="text-right px-3 py-3 font-medium text-ink-500">Volno</th>
                <th className="text-right px-3 py-3 font-medium text-ink-500 bg-surface-100">Hrubá mzda</th>
                <th className="text-right px-3 py-3 font-medium text-ink-500">Splátky</th>
                <th className="text-right px-3 py-3 font-medium text-ink-500">Srážky</th>
                <th className="text-right px-4 py-3 font-medium text-brand-700 bg-brand-50">K výplatě</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-50/50">
                  <td className="px-4 py-3 font-medium text-ink-900">{r.name}</td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-ink-500">{r.workHours}h</span>
                    <br /><span className="font-medium text-ink-900">{formatCurrency(r.workPay)}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-ink-500">{r.vacationHours}h</span>
                    <br /><span className="font-medium text-ink-900">{formatCurrency(r.vacationPay)}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-ink-500">{r.sickHours}h</span>
                    <br /><span className="font-medium text-ink-900">{formatCurrency(r.sickPay)}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-ink-500">{r.dayOffHours}h</span>
                    <br /><span className="font-medium text-ink-900">{formatCurrency(r.dayOffPay)}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-ink-900 bg-surface-50">{formatCurrency(r.grossPay)}</td>
                  <td className="px-3 py-3 text-right text-red-600">{r.loanDeductions > 0 ? `-${formatCurrency(r.loanDeductions)}` : "—"}</td>
                  <td className="px-3 py-3 text-right text-red-600">{r.otherDeductions > 0 ? `-${formatCurrency(r.otherDeductions)}` : "—"}</td>
                  <td className="px-4 py-3 text-right font-bold text-brand-700 bg-brand-50/50 text-base">{formatCurrency(r.netPay)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-surface-300 bg-surface-50 font-bold">
                <td className="px-4 py-4 text-ink-900">CELKEM</td>
                <td className="px-3 py-4 text-right text-ink-900">{formatCurrency(rows.reduce((s, r) => s + r.workPay, 0))}</td>
                <td className="px-3 py-4 text-right text-ink-900">{formatCurrency(rows.reduce((s, r) => s + r.vacationPay, 0))}</td>
                <td className="px-3 py-4 text-right text-ink-900">{formatCurrency(rows.reduce((s, r) => s + r.sickPay, 0))}</td>
                <td className="px-3 py-4 text-right text-ink-900">{formatCurrency(rows.reduce((s, r) => s + r.dayOffPay, 0))}</td>
                <td className="px-3 py-4 text-right text-ink-900 bg-surface-100">{formatCurrency(totalGross)}</td>
                <td className="px-3 py-4 text-right text-red-600">{totalDeductions > 0 ? `-${formatCurrency(rows.reduce((s, r) => s + r.loanDeductions, 0))}` : "—"}</td>
                <td className="px-3 py-4 text-right text-red-600">{rows.reduce((s, r) => s + r.otherDeductions, 0) > 0 ? `-${formatCurrency(rows.reduce((s, r) => s + r.otherDeductions, 0))}` : "—"}</td>
                <td className="px-4 py-4 text-right text-brand-700 bg-brand-50 text-lg">{formatCurrency(totalNet)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
