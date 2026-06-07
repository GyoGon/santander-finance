const { calculateMonthlyCommitment, calculateTrueSpending, projectLoanPayoff } = require('../src/processor/financials');

test('calculateMonthlyCommitment sums card spending + loan payment', () => {
  const result = calculateMonthlyCommitment({
    cardSpendingOwnOnly: 2100.00,
    loanMonthlyPayment: 850.00,
  });
  expect(result).toBeCloseTo(2950.00, 2);
});

test('calculateTrueSpending reduces total by split amounts', () => {
  const transactions = [
    { id: 'tx-1', amount: -120.00, account_type: 'card' },
    { id: 'tx-2', amount: -45.00, account_type: 'card' },
    { id: 'tx-3', amount: -850.00, account_type: 'loan' },
  ];
  const splits = [
    { transaction_id: 'tx-1', amount_owed: 60.00 },
    { transaction_id: 'tx-2', amount_owed: 22.50 },
  ];
  const result = calculateTrueSpending(transactions, splits);
  expect(result.totalCard).toBeCloseTo(165.00, 2);
  expect(result.cardOwnOnly).toBeCloseTo(82.50, 2);
  expect(result.totalDebtorsOwe).toBeCloseTo(82.50, 2);
});

test('projectLoanPayoff estimates months remaining', () => {
  const result = projectLoanPayoff({ balance: 12450.00, monthlyPayment: 850.00 });
  expect(result.monthsRemaining).toBe(15);
  expect(result.payoffDate).toMatch(/^\d{4}-\d{2}$/);
});

test('projectLoanPayoff handles near-zero balance', () => {
  const result = projectLoanPayoff({ balance: 100.00, monthlyPayment: 850.00 });
  expect(result.monthsRemaining).toBe(1);
});

test('calculateTrueSpending handles no splits', () => {
  const transactions = [{ id: 'tx-1', amount: -100.00, account_type: 'card' }];
  const result = calculateTrueSpending(transactions, []);
  expect(result.totalCard).toBeCloseTo(100.00, 2);
  expect(result.cardOwnOnly).toBeCloseTo(100.00, 2);
  expect(result.totalDebtorsOwe).toBe(0);
});
