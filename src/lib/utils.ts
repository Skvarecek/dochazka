import { format, parseISO } from "date-fns";
import { cs } from "date-fns/locale";

export function formatDate(date: string | Date, fmt: string = "d. M. yyyy") {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt, { locale: cs });
}

export function entryTypeLabel(type: string): string {
  const map: Record<string, string> = {
    work: "Práce",
    vacation: "Dovolená",
    sick: "Nemocenská",
    day_off: "Volno",
  };
  return map[type] || type;
}

export function entryTypeColor(type: string): string {
  const map: Record<string, string> = {
    work: "bg-blue-100 text-blue-800",
    vacation: "bg-emerald-100 text-emerald-800",
    sick: "bg-amber-100 text-amber-800",
    day_off: "bg-purple-100 text-purple-800",
  };
  return map[type] || "bg-gray-100 text-gray-800";
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
