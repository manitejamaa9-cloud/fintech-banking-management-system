// Number + date formatting helpers (Indian number system)

export function num(v) {
  return v === null || v === undefined ? 0 : Number(v);
}

export function round2(v) {
  return Math.round(num(v) * 100) / 100;
}

// 1234567 -> "12,34,567" (Indian digit grouping)
export function inr(v) {
  const n = Math.round(num(v));
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n).toString();
  const last3 = abs.slice(-3);
  const rest = abs.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  return `${sign}₹${grouped}`;
}

// 12450000 -> "1.25 Cr"
export function inrCompact(v) {
  const n = num(v);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} Lakh`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs}`;
}

export function pct(v, digits = 1) {
  return `${num(v).toFixed(digits)}%`;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function pad(n) {
  return String(n).padStart(2, '0');
}

// Normalise a value that may be a Date or date-string to "YYYY-MM-DD"
export function fmtDate(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      return v.slice(0, 10);
    }
    return v.slice(0, 10);
  }
  return String(v);
}

export function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Signed profit display, e.g. "+ ₹12,45,780" / "- ₹3,25,450"
export function signedProfit(v) {
  const n = num(v);
  return n >= 0 ? `+ ₹${inr(n).slice(1)}` : `− ₹${inr(Math.abs(n)).slice(1)}`;
}
