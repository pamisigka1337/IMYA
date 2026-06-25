const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(date: string | Date) {
  if (date instanceof Date) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  }

  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function calculateRentalDays(startDate: string | Date, endDate: string | Date) {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const diffDays = Math.round((end - start) / DAY_MS);

  if (!Number.isFinite(diffDays) || diffDays < 0) return 0;
  return Math.max(1, diffDays);
}

export function getRentalDateError(startDate?: string | Date, endDate?: string | Date) {
  if (!startDate || !endDate) return null;
  return parseDateOnly(endDate) < parseDateOnly(startDate) ? "Дата окончания не может быть раньше даты начала" : null;
}

export function formatRussianDays(days: number) {
  const absDays = Math.abs(days);
  const lastTwo = absDays % 100;
  const last = absDays % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return "дней";
  if (last === 1) return "день";
  if (last >= 2 && last <= 4) return "дня";
  return "дней";
}
