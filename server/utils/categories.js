// Maps merchant names used by the demo dataset to broad merchant categories.
export const MERCHANT_CATEGORY_MAP = [
  [['Amazon', 'Flipkart', 'Myntra', 'Paytm', 'PhonePe', 'Amazon Pay', 'Razorpay', 'Trends'], 'E-commerce'],
  [['BigBasket', 'Reliance Fresh', 'DMart', 'Metro Cash & Carry', 'Walmart India'], 'Grocery'],
  [['Swiggy', 'Zomato', 'Dominos', 'Barista', 'Cafe Coffee Day', 'Fusion Restaurant'], 'Food & Dining'],
  [['Airtel', 'Jio', 'BSNL'], 'Telecom'],
  [['Uber', 'Ola'], 'Transport'],
  [['Indian Oil', 'HP Petrol'], 'Fuel'],
  [['Apollo Pharmacy'], 'Healthcare'],
  [['Netflix', 'IRCTC', 'MakeMyTrip'], 'Entertainment & Travel'],
  [['Croma', 'Shoppers Stop', 'Vijay Sales', 'Prestige'], 'Retail & Electronics'],
  [['LIC', 'SBI Life', 'ICICI Prudential', 'PolicyBazaar'], 'Insurance'],
  [['Tata Motors', 'Hyundai Service'], 'Automotive'],
];

export const CREDIT_ORIGINS = [
  'Salary',
  'Refund',
  'Interest',
  'Transfer In',
  'Cash Deposit',
  'Loan Disbursement',
  'Cheque Deposit',
  'Dividend',
];

export function categoryFor(merchant) {
  if (!merchant) return 'Other';
  for (const [names, category] of MERCHANT_CATEGORY_MAP) {
    if (names.includes(merchant)) return category;
  }
  if (CREDIT_ORIGINS.includes(merchant)) return 'Income & Transfers';
  return 'Other';
}
