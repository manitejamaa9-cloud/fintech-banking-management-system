// Small, dependency-free CSV parser (RFC 4180 style) used by the dataset importer.
export function parseCsvText(text) {
  if (text == null) return { headers: [], rows: [] };
  let input = String(text).replace(/^\uFEFF/, '');
  if (!input.trim()) return { headers: [], rows: [] };

  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      records.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  records.push(row);

  const cleaned = records.filter((r) => r.some((c) => String(c).trim() !== ''));
  if (!cleaned.length) return { headers: [], rows: [] };

  const headers = cleaned[0].map((h) => h.trim());
  const rows = cleaned.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] !== undefined ? String(r[idx]).trim() : '';
    });
    return obj;
  });
  return { headers, rows };
}

const HEADER_ALIASES = {
  transaction_id: ['transaction_id', 'transactionid', 'txn_id', 'txnid', 'transaction_ref', 'id'],
  customer_ref: ['customer_id', 'customerid', 'cust_id', 'customer_ref', 'customer'],
  date: ['transaction_date', 'txn_date', 'date', 'timestamp', 'datetime'],
  amount: ['amount', 'transaction_amount', 'amt', 'value'],
  transaction_type: ['transaction_type', 'type', 'direction', 'debit_credit', 'dr_cr'],
  payment_method: ['payment_method', 'method', 'channel', 'payment_channel', 'mode'],
  merchant: ['merchant', 'merchant_name', 'beneficiary', 'payee'],
  merchant_category: ['merchant_category', 'category', 'mcc_category'],
  status: ['status', 'transaction_status', 'txn_status'],
  fraud_flag: ['fraud_flag', 'is_fraud', 'fraud', 'suspicious'],
};

function normaliseHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_');
}

/**
 * Map flexible CSV headers to canonical field names.
 * Returns { map: {canonical: actualHeader}, missing: [...] }
 */
export function mapHeaders(headers) {
  const normalised = headers.map((h) => [h, normaliseHeader(h)]);
  const map = {};
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    const found = normalised.find(([, n]) => aliases.includes(n));
    if (found) map[canonical] = found[0];
  }
  const missing = ['transaction_id', 'date', 'amount'].filter((k) => !map[k]);
  return { map, missing };
}

export function parseAmount(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value)
    .replace(/[₹,\s]/g, '')
    .replace(/^\((.*)\)$/, '-$1');
  if (cleaned === '' || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function isoFromParts(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Accepts YYYY-MM-DD (and ISO timestamps) plus DD/MM/YYYY or DD-MM-YYYY. */
export function parseFlexibleDate(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (m) return isoFromParts(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    // Interpret as DD/MM/YYYY (common in Indian banking exports).
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    return isoFromParts(y, mo, d) || isoFromParts(y, d, mo);
  }

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    return isoFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  return null;
}

export function parseBool(value) {
  if (value === null || value === undefined) return false;
  const s = String(value).trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'flagged', 'fraud'].includes(s);
}
