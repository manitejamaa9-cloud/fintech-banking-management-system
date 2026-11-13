import bcrypt from 'bcryptjs';
import { num, round2, todayStr, daysAgoStr, addMonths, pad } from '../utils/format.js';
import { computeEmi } from '../utils/finance.js';
import { categoryFor } from '../utils/categories.js';

// ---------------------------------------------------------------------------
// Deterministic RNG so the demo dataset is reproducible
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260809);
const ri = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
const rf = (min, max) => rng() * (max - min) + min;
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
function pickWeighted(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rng() * total;
  for (const [val, w] of pairs) {
    r -= w;
    if (r <= 0) return val;
  }
  return pairs[0][0];
}
// Skew dates towards the recent past
function recentDate(maxDays) {
  const u = Math.pow(rng(), 1.35);
  return daysAgoStr(Math.floor(u * maxDays));
}
function afterDate(dateStr, minDateStr) {
  if (!minDateStr) return dateStr;
  return dateStr >= minDateStr ? dateStr : minDateStr;
}

// ---------------------------------------------------------------------------
// Static reference data
// ---------------------------------------------------------------------------
const BRANCHES = [
  ['BR-HO-001', 'FinTech Bank - Head Office', 'Mumbai', 'Tower A, Nariman Point', '022-4400-0001'],
  ['BR-DEL-002', 'FinTech Bank - Delhi Main', 'New Delhi', 'Connaught Place, Block B', '011-4400-0002'],
  ['BR-BLR-003', 'FinTech Bank - Bengaluru', 'Bengaluru', 'MG Road, 2nd Block', '080-4400-0003'],
  ['BR-CHE-004', 'FinTech Bank - Chennai', 'Chennai', 'Anna Salai, Teynampet', '044-4400-0004'],
  ['BR-KOL-005', 'FinTech Bank - Kolkata', 'Kolkata', 'Park Street, 1st Floor', '033-4400-0005'],
  ['BR-HYD-006', 'FinTech Bank - Hyderabad', 'Hyderabad', 'Banjara Hills, Road No 12', '040-4400-0006'],
  ['BR-PUN-007', 'FinTech Bank - Pune', 'Pune', 'Koregaon Park, Lane 5', '020-4400-0007'],
  ['BR-AHM-008', 'FinTech Bank - Ahmedabad', 'Ahmedabad', 'CG Road, Navrangpura', '079-4400-0008'],
];

// per-branch base monthly revenue / expense targets (fictional)
const BRANCH_BASE = {
  1: { rev: 4300000, exp: 3400000 },
  2: { rev: 3200000, exp: 2500000 },
  3: { rev: 3000000, exp: 2300000 },
  4: { rev: 2600000, exp: 2000000 },
  5: { rev: 2200000, exp: 1700000 },
  6: { rev: 2400000, exp: 1850000 },
  7: { rev: 2100000, exp: 1650000 },
  8: { rev: 1950000, exp: 1550000 },
};

const FIRST_NAMES = ['Aarav', 'Vivaan', 'Aditya', 'Sai', 'Arjun', 'Rohan', 'Rahul', 'Ishaan', 'Kabir', 'Karan', 'Vikram', 'Rajesh', 'Amit', 'Sanjay', 'Nikhil', 'Siddharth', 'Pranav', 'Manish', 'Harsh', 'Ankit', 'Dev', 'Kunal', 'Rahul', 'Suresh', 'Deepak', 'Ravi', 'Anil', 'Gaurav', 'Tarun', 'Mohit', 'Priya', 'Ananya', 'Sneha', 'Pooja', 'Neha', 'Riya', 'Kavya', 'Divya', 'Shreya', 'Aisha', 'Pallavi', 'Meera', 'Anjali', 'Nisha', 'Sakshi', 'Ishita', 'Komal', 'Ritu', 'Tanvi', 'Vaishnavi'];
const LAST_NAMES = ['Sharma', 'Verma', 'Patel', 'Gupta', 'Singh', 'Iyer', 'Reddy', 'Nair', 'Mehta', 'Kapoor', 'Chopra', 'Malhotra', 'Bhat', 'Kulkarni', 'Desai', 'Joshi', 'Rao', 'Das', 'Banerjee', 'Chatterjee', 'Mukherjee', 'Mishra', 'Tiwari', 'Agarwal', 'Shah', 'Jain', 'Choudhary', 'Khan', 'Yadav', 'Pillai'];

const OCCUPATIONS = [
  ['Software Engineer', 60000, 250000],
  ['Doctor', 80000, 400000],
  ['Teacher', 30000, 90000],
  ['Business Owner', 100000, 800000],
  ['Government Employee', 40000, 120000],
  ['Engineer', 50000, 180000],
  ['Lawyer', 70000, 300000],
  ['Farmer', 20000, 60000],
  ['Retailer', 40000, 200000],
  ['Consultant', 90000, 350000],
  ['Professor', 60000, 150000],
  ['Accountant', 35000, 100000],
  ['Bank Employee', 45000, 120000],
  ['Homemaker', 5000, 20000],
  ['Student', 2000, 10000],
];

const ACCOUNT_TYPES = ['Savings', 'Current', 'Salary', 'Joint', 'NRI Savings'];

const LOAN_DEFS = {
  'Home Loan': { rate: 8.5, min: 1000000, max: 8000000, tenure: [120, 240], w: 0.14 },
  'Car Loan': { rate: 9.5, min: 300000, max: 2500000, tenure: [36, 84], w: 0.12 },
  'Personal Loan': { rate: 11.5, min: 100000, max: 2000000, tenure: [12, 60], w: 0.20 },
  'Education Loan': { rate: 9.0, min: 200000, max: 2000000, tenure: [36, 120], w: 0.10 },
  'Business Loan': { rate: 12.0, min: 500000, max: 5000000, tenure: [24, 120], w: 0.14 },
  'Gold Loan': { rate: 8.0, min: 100000, max: 1500000, tenure: [12, 36], w: 0.16 },
  'Agriculture Loan': { rate: 8.5, min: 100000, max: 1500000, tenure: [12, 60], w: 0.14 },
};

const METHOD_CONFIG = [
  ['UPI', 0.30, 100, 150000],
  ['Debit Card', 0.14, 200, 60000],
  ['Credit Card', 0.12, 300, 150000],
  ['NEFT', 0.09, 10000, 1500000],
  ['RTGS', 0.05, 50000, 5000000],
  ['IMPS', 0.07, 5000, 200000],
  ['ATM', 0.08, 1000, 20000],
  ['Cash', 0.09, 1000, 200000],
  ['Cheque', 0.03, 10000, 500000],
  ['Auto Debit', 0.03, 1000, 50000],
];

const DEBIT_MERCHANTS = ['Amazon', 'Flipkart', 'BigBasket', 'Swiggy', 'Zomato', 'Reliance Fresh', 'Myntra', 'Paytm', 'PhonePe', 'IRCTC', 'MakeMyTrip', 'Apollo Pharmacy', 'Croma', 'Shoppers Stop', 'Dominos', 'Netflix', 'Airtel', 'Jio', 'BSNL', 'Indian Oil', 'HP Petrol', 'Uber', 'Ola', 'DMart', 'LIC', 'Tata Motors', 'Hyundai Service', 'Metro Cash & Carry', 'Trends', 'Prestige', 'Vijay Sales', 'Fusion Restaurant', 'Barista', 'Cafe Coffee Day', 'Walmart India', 'Amazon Pay', 'Razorpay', 'SBI Life', 'ICICI Prudential', 'PolicyBazaar'];
const CREDIT_ORIGINS = ['Salary', 'Refund', 'Interest', 'Transfer In', 'Cash Deposit', 'Loan Disbursement', 'Cheque Deposit', 'Dividend'];

const REVENUE_WEIGHTS = [
  ['Transaction Fees', 0.30],
  ['Processing Fees', 0.10],
  ['Card Fees', 0.14],
  ['ATM Fees', 0.06],
  ['Maintenance Charges', 0.16],
  ['Penalties & Late Charges', 0.05],
  ['Other Income', 0.19],
];

const EXPENSE_WEIGHTS = [
  ['Employee Salaries', 0.36],
  ['Rent', 0.10],
  ['Electricity & Utilities', 0.05],
  ['Technology', 0.12],
  ['ATM Maintenance', 0.05],
  ['Marketing', 0.06],
  ['Administrative', 0.08],
  ['Interest Paid (Depositors)', 0.12],
  ['Other Operating', 0.06],
];

const SCHEMES = [
  ['Sweep-In Savings Account', 'Savings Scheme', 4.0, 60, 5000, 5000000, 'Auto-sweep of surplus balances into a linked fixed deposit.'],
  ['Privilege Savings Account', 'Savings Scheme', 3.5, 0, 25000, 5000000, 'Premium savings with concierge and higher withdrawal limits.'],
  ['Regular Fixed Deposit', 'Fixed Deposit', 6.5, 12, 10000, 50000000, 'Standard fixed deposit with flexible tenors from 12 months.'],
  ['Tax Saver Fixed Deposit', 'Fixed Deposit', 6.8, 60, 10000, 1500000, 'Section 80C eligible 5-year tax saving deposit.'],
  ['Recurring Deposit Scheme', 'Recurring Deposit', 6.0, 36, 500, 2000000, 'Monthly savings plan that builds a lump sum on maturity.'],
  ['Senior Citizen Fixed Deposit', 'Senior Citizen Scheme', 7.5, 12, 10000, 50000000, 'Higher interest rates for customers above 60 years.'],
  ['Senior Citizen Monthly Income Plan', 'Senior Citizen Scheme', 7.0, 60, 100000, 5000000, 'Monthly payout scheme designed for retired customers.'],
  ['Personal Loan Scheme', 'Loan Scheme', 11.5, 60, 100000, 2000000, 'Instant pre-approved personal loans for salaried customers.'],
  ['Home Loan Advantage Scheme', 'Loan Scheme', 8.5, 240, 1000000, 8000000, 'Affordable home loans with doorstep service and zero processing fee.'],
  ['Business Banking Account', 'Business Banking Scheme', 4.5, 0, 50000, 20000000, 'Current account with integrated payment collection for SMEs.'],
  ['Cashback Rewards Card Scheme', 'Cashback / Rewards Scheme', 0.0, 0, 0, 500000, 'Credit card with up to 5% cashback across partner merchants.'],
  ['Festival Special Deposit', 'Special Interest Scheme', 7.2, 15, 5000, 20000000, 'Limited period deposit with festival season bonus rates.'],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function insertMany(query, table, columns, rows, chunk = 400) {
  if (!rows.length) return;
  const colSql = columns.join(', ');
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const placeholders = [];
    const params = [];
    slice.forEach((row, rIdx) => {
      const offset = rIdx * columns.length;
      placeholders.push(`(${columns.map((_, cIdx) => `$${offset + cIdx + 1}`).join(', ')})`);
      row.forEach((v) => params.push(v === undefined ? null : v));
    });
    await query(`INSERT INTO ${table} (${colSql}) VALUES ${placeholders.join(', ')}`, params);
  }
}

async function resetSequences(query) {
  const sequences = [
    ['branches', 'branch_id'],
    ['users', 'user_id'],
    ['customers', 'customer_id'],
    ['accounts', 'account_id'],
    ['loans', 'loan_id'],
    ['loan_payments', 'payment_id'],
    ['transactions', 'transaction_id'],
    ['revenue', 'revenue_id'],
    ['expenses', 'expense_id'],
    ['banking_schemes', 'scheme_id'],
    ['scheme_enrollments', 'enrollment_id'],
  ];
  for (const [table, column] of sequences) {
    await query(
      `SELECT setval(pg_get_serial_sequence('${table}', '${column}'),
              GREATEST(COALESCE((SELECT MAX(${column}) FROM ${table}), 1), 1))`
    );
  }
}

function monthKeys(startStr, endStr) {
  const res = [];
  const d = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (d <= end) {
    res.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    d.setMonth(d.getMonth() + 1);
  }
  return res;
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------
export async function seedData(query, { force = false } = {}) {
  const check = await query('SELECT COUNT(*) AS c FROM customers');
  const count = num(check[0] && check[0].c);
  if (count > 0 && !force) return { seeded: false, reason: 'already seeded' };

  if (force) {
    const tables = ['scheme_enrollments', 'banking_schemes', 'expenses', 'revenue', 'transactions', 'loan_payments', 'loans', 'accounts', 'customers', 'users', 'branches'];
    for (const t of tables) await query(`DELETE FROM ${t}`);
  }

  const today = todayStr();
  const startMonth = addMonths(today, -72); // 6 years of history

  // ----- branches -----
  const branchRows = BRANCHES.map((b, i) => [i + 1, b[0], b[1], b[2], b[3], b[4], recentDate(2190)]);
  await insertMany(query, 'branches', ['branch_id', 'branch_code', 'branch_name', 'city', 'address', 'phone', 'created_at'], branchRows);

  // ----- users -----
  const hash = (p) => bcrypt.hashSync(p, 8);
  const userRows = [
    [1, 'SUPER001', 'Aditya Deshmukh', 'superadmin@fintechbank.demo', hash('Admin@123'), 'super_admin', 1, 'active', recentDate(2190)],
  ];
  BRANCHES.forEach((b, i) => {
    const bid = i + 1;
    userRows.push([10 + bid, `BM${1000 + bid}`, `Branch Manager ${b[2].split(' - ')[1] || b[2]}`, `manager${bid}@fintechbank.demo`, hash('Manager@123'), 'bank_manager', bid, 'active', recentDate(2190)]);
  });
  userRows.push([20, 'FIN001', 'Neha Krishnan', 'financialofficer@fintechbank.demo', hash('Finance@123'), 'financial_officer', 1, 'active', recentDate(2190)]);
  userRows.push([21, 'VIEW001', 'Rohit Menon', 'viewer@fintechbank.demo', hash('View@123'), 'viewer', 1, 'active', recentDate(2190)]);
  await insertMany(query, 'users', ['user_id', 'employee_id', 'name', 'email', 'password_hash', 'role', 'branch_id', 'status', 'created_at'], userRows);

  // ----- customers -----
  const customerRows = [];
  const customers = []; // {id, branch_id, name, city, created_at}
  const namePool = (() => {
    const out = [];
    for (let i = 0; i < 3000; i++) out.push(`${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`);
    return out;
  })();
  let cid = 1;
  for (let i = 0; i < 64; i++) {
    const branchId = i % 8 === 0 ? 1 : ri(1, 8);
    const city = branchId === 1 ? 'Mumbai' : BRANCHES[branchId - 1][2];
    const occ = pick(OCCUPATIONS);
    const created = recentDate(2190);
    const status = rng() < 0.06 ? 'inactive' : 'active';
    const row = [cid, branchId, namePool[i], ri(21, 72), city, occ[0], round2(rf(occ[1], occ[2])), ri(540, 850), status, created];
    customerRows.push(row);
    customers.push({ id: cid, branch_id: branchId, name: row[2], city, created_at: created });
    cid++;
  }
  await insertMany(query, 'customers', ['customer_id', 'branch_id', 'name', 'age', 'city', 'occupation', 'monthly_income', 'credit_score', 'status', 'created_at'], customerRows);

  // ----- accounts -----
  const accountRows = [];
  const accounts = []; // {id, customer_id, branch_id, current_balance, created_at}
  let accId = 1;
  for (const c of customers) {
    const numAcc = rng() < 0.2 ? 2 : 1;
    for (let a = 0; a < numAcc; a++) {
      const type = pick(ACCOUNT_TYPES);
      const balance = round2(rf(5000, type === 'Current' || type === 'NRI Savings' ? 6000000 : 3000000));
      const status = rng() < 0.04 ? 'closed' : 'active';
      accountRows.push([accId, c.id, c.branch_id, type, round2(balance * 0.6), balance, status, afterDate(c.created_at, addMonths(today, -66))]);
      accounts.push({ id: accId, customer_id: c.id, branch_id: c.branch_id, current_balance: balance, created_at: accountRows[accId - 1][7] });
      accId++;
    }
  }
  await insertMany(query, 'accounts', ['account_id', 'customer_id', 'branch_id', 'account_type', 'opening_balance', 'current_balance', 'status', 'created_at'], accountRows);

  // ----- loans + EMI schedule -----
  const loanRows = [];
  const loanPayments = [];
  const interestByBranchMonth = {}; // key branch|YYYY-MM -> amount
  let loanId = 1;
  const loanTypePairs = Object.entries(LOAN_DEFS).map(([t, d]) => [t, d.w]);
  for (let i = 0; i < 90; i++) {
    const c = pick(customers);
    const type = pickWeighted(loanTypePairs);
    const def = LOAN_DEFS[type];
    const amount = round2(rf(def.min, def.max) * (0.7 + rng() * 0.6));
    const rate = round2(def.rate + (rng() < 0.3 ? rf(-0.5, 0.5) : 0));
    const tenure = ri(def.tenure[0], def.tenure[1]);
    const emi = computeEmi(amount, rate, tenure);
    const status = pickWeighted([
      ['Active', 0.5],
      ['Completed', 0.22],
      ['Overdue', 0.08],
      ['Defaulted', 0.06],
      ['Pending', 0.08],
    ]);

    let monthsSinceIssue;
    if (status === 'Completed') monthsSinceIssue = tenure;
    else if (status === 'Pending') monthsSinceIssue = 0;
    else if (status === 'Defaulted') monthsSinceIssue = ri(6, Math.min(tenure, 30));
    else if (status === 'Overdue') monthsSinceIssue = ri(3, Math.min(tenure, 24));
    else monthsSinceIssue = ri(1, Math.min(tenure, 40));

    const issueDate = status === 'Pending' ? addMonths(today, ri(3, 20)) : addMonths(today, -monthsSinceIssue);
    const dueDate = addMonths(issueDate, tenure);

    let monthsPaid;
    if (status === 'Pending') monthsPaid = 0;
    else if (status === 'Completed') monthsPaid = tenure;
    else if (status === 'Defaulted') monthsPaid = Math.floor(monthsSinceIssue * 0.6);
    else if (status === 'Overdue') monthsPaid = Math.max(0, monthsSinceIssue - 1);
    else monthsPaid = monthsSinceIssue;

    let outstanding = amount;
    let repaid = 0;
    let interestEarned = 0;
    const monthlyRate = rate / 100 / 12;
    const branchId = c.branch_id;

    for (let m = 1; m <= monthsPaid; m++) {
      let interest = round2(outstanding * monthlyRate);
      let principal = round2(emi - interest);
      if (principal <= 0) principal = Math.max(0, round2(emi - interest));
      if (principal > outstanding) {
        principal = outstanding;
        interest = round2(emi - principal);
        if (interest < 0) interest = 0;
      }
      const emiPaid = round2(principal + interest);
      outstanding = round2(outstanding - principal);
      repaid = round2(repaid + principal);
      interestEarned = round2(interestEarned + interest);
      const payDate = addMonths(issueDate, m);
      const mk = `${branchId}|${payDate.slice(0, 7)}`;
      interestByBranchMonth[mk] = round2((interestByBranchMonth[mk] || 0) + interest);
      loanPayments.push([loanPayments.length + 1, loanId, c.id, branchId, payDate, emiPaid, principal, interest, pick(['UPI', 'NEFT', 'Auto Debit', 'Cash', 'IMPS']), 'paid']);
    }

    const paymentStatusMap = { Active: 'Current', Completed: 'Paid', Overdue: 'Overdue', Defaulted: 'Defaulted', Pending: 'Not Due' };
    const loanOutstanding = status === 'Pending' ? amount : Math.max(0, round2(amount - repaid));
    loanRows.push([loanId, c.id, branchId, type, amount, rate, tenure, emi, repaid, loanOutstanding, interestEarned, interestEarned, status, paymentStatusMap[status], issueDate, dueDate]);
    loanId++;
  }
  await insertMany(
    query,
    'loans',
    ['loan_id', 'customer_id', 'branch_id', 'loan_type', 'loan_amount', 'interest_rate', 'tenure_months', 'emi', 'amount_repaid', 'outstanding_amount', 'interest_earned', 'interest_received', 'loan_status', 'payment_status', 'issue_date', 'due_date'],
    loanRows
  );
  await insertMany(query, 'loan_payments', ['payment_id', 'loan_id', 'customer_id', 'branch_id', 'payment_date', 'emi_amount', 'principal_paid', 'interest_paid', 'payment_method', 'payment_status'], loanPayments);

  // ----- transactions -----
  const transactionRows = [];
  const accountOf = (cid) => accounts.find((a) => a.customer_id === cid) || accounts[0];
  for (let i = 0; i < 1200; i++) {
    const c = pick(customers);
    const acc = accountOf(c.id);
    const method = pickWeighted(METHOD_CONFIG.map((m) => [m[0], m[1]]));
    const cfg = METHOD_CONFIG.find((m) => m[0] === method);
    let amount = round2(rf(cfg[2], cfg[3]));
    if (method === 'RTGS' && rng() < 0.3) amount = round2(rf(1000000, 5000000));
    if (method === 'NEFT' && rng() < 0.2) amount = round2(rf(1000000, 3000000));
    const isDebit = method === 'ATM' || method === 'Auto Debit' ? true : rng() < 0.7;
    const type = isDebit ? 'debit' : 'credit';
    const merchant = isDebit ? pick(DEBIT_MERCHANTS) : pick(CREDIT_ORIGINS);
    const status = pickWeighted([
      ['Successful', 0.86],
      ['Failed', 0.06],
      ['Pending', 0.05],
      ['Reversed', 0.03],
    ]);
    const date = afterDate(recentDate(2190), acc.created_at);
    // Simulated "flagged" sample: a small, clearly-labelled subset of failed /
    // reversed high-value transactions. This is not verified fraud data.
    const fraudFlag = (status === 'Failed' || status === 'Reversed') && amount >= 100000 && rng() < 0.18;
    const reference = `TXN${String(i + 1).padStart(8, '0')}`;
    transactionRows.push([i + 1, c.id, acc.id, c.branch_id, date, method, type, amount, merchant, status, fraudFlag, categoryFor(merchant), reference]);
  }
  await insertMany(
    query,
    'transactions',
    ['transaction_id', 'customer_id', 'account_id', 'branch_id', 'transaction_date', 'payment_method', 'transaction_type', 'amount', 'merchant', 'status', 'fraud_flag', 'merchant_category', 'reference_no'],
    transactionRows
  );

  // ----- banking schemes + enrollments -----
  const schemeRows = SCHEMES.map((s, i) => [i + 1, s[0], s[1], s[2], s[3], s[4], s[5], s[6]]);
  await insertMany(query, 'banking_schemes', ['scheme_id', 'scheme_name', 'scheme_type', 'interest_rate', 'duration_months', 'minimum_amount', 'maximum_amount', 'description'], schemeRows);

  const enrollmentRows = [];
  let eid = 1;
  for (let sIdx = 0; sIdx < SCHEMES.length; sIdx++) {
    const scheme = SCHEMES[sIdx];
    const n = ri(8, 18);
    for (let i = 0; i < n; i++) {
      const c = pick(customers);
      const amount = round2(rf(scheme[4], scheme[5]) * (0.4 + rng() * 0.6));
      enrollmentRows.push([eid, sIdx + 1, c.id, c.branch_id, amount, afterDate(recentDate(1500), c.created_at)]);
      eid++;
    }
  }
  await insertMany(query, 'scheme_enrollments', ['enrollment_id', 'scheme_id', 'customer_id', 'branch_id', 'amount', 'start_date'], enrollmentRows);

  // ----- monthly revenue / expenses -----
  const months = monthKeys(startMonth, today);
  const revenueRows = [];
  const expenseRows = [];
  let rid = 1;
  let xid = 1;

  months.forEach((mk, idx) => {
    const years = idx / 12;
    const revGrowth = Math.pow(1.14, years);
    const expGrowth = Math.pow(1.11, years);

    for (let bid = 1; bid <= 8; bid++) {
      const base = BRANCH_BASE[bid];
      const date = `${mk}-${pad(15)}`;
      const branchNoise = 0.82 + rng() * 0.36;

      // Revenue
      const targetRev = base.rev * revGrowth * branchNoise;
      const loanInt = num(interestByBranchMonth[`${bid}|${mk}`] || 0);
      let remainder = Math.max(0, targetRev - loanInt);
      let investIncome = 0;
      if (idx % 3 === 0) {
        investIncome = targetRev * rf(0.12, 0.22);
        remainder = Math.max(0, remainder - investIncome);
      }
      if (loanInt > 0) revenueRows.push([rid++, date, 'Loan Interest', round2(loanInt), bid]);
      for (const [cat, w] of REVENUE_WEIGHTS) {
        const amt = round2(remainder * w * (0.7 + rng() * 0.6));
        if (amt > 0) revenueRows.push([rid++, date, cat, amt, bid]);
      }
      if (investIncome > 0) revenueRows.push([rid++, date, 'Investment Income', round2(investIncome), bid]);

      // Expenses. All categories use the modelled branch target so the
      // synthetic profit & loss stays internally consistent.
      const targetExp = base.exp * expGrowth * (0.85 + rng() * 0.3);
      for (const [cat, w] of EXPENSE_WEIGHTS) {
        const amt = round2(targetExp * w * (0.85 + rng() * 0.3));
        expenseRows.push([xid++, date, cat, amt, bid]);
      }
    }
  });

  await insertMany(query, 'revenue', ['revenue_id', 'date', 'revenue_type', 'amount', 'branch_id'], revenueRows);
  await insertMany(query, 'expenses', ['expense_id', 'date', 'expense_type', 'amount', 'branch_id'], expenseRows);

  // Explicit IDs are inserted above, so advance the SERIAL sequences.
  await resetSequences(query);

  return {
    seeded: true,
    counts: {
      branches: branchRows.length,
      users: userRows.length,
      customers: customerRows.length,
      accounts: accountRows.length,
      loans: loanRows.length,
      loanPayments: loanPayments.length,
      transactions: transactionRows.length,
      revenue: revenueRows.length,
      expenses: expenseRows.length,
      schemes: schemeRows.length,
      enrollments: enrollmentRows.length,
    },
  };
}

