const { markTransactionSplit, recalculateDebtors } = require('../src/processor/splits');
const Database = require('better-sqlite3');
const { initDb } = require('../src/db/schema');
const { upsertTransaction } = require('../src/db/transactions');
const { getAllDebtors } = require('../src/db/debtors');
const { getSplitsForTransaction } = require('../src/db/splits');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(__dirname, 'test-processor.db');
let db;

beforeEach(() => {
  db = new Database(TEST_DB);
  initDb(db);
  upsertTransaction(db, {
    id: 'tx-001', bank_id: 'b1', date: '2026-06-05',
    amount: -120.00, description: 'Jumbo', type: 'debit',
    account_type: 'card', synced_at: new Date().toISOString(),
  });
});

afterEach(() => {
  db.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

test('markTransactionSplit 50/50 creates correct splits', () => {
  markTransactionSplit(db, 'tx-001', [{ name: 'Juan', percentage: 50 }]);
  const splits = getSplitsForTransaction(db, 'tx-001');
  expect(splits).toHaveLength(1);
  expect(splits[0].debtor_name).toBe('Juan');
  expect(splits[0].amount_owed).toBeCloseTo(60.00, 2);
});

test('markTransactionSplit 33/33 creates two splits', () => {
  markTransactionSplit(db, 'tx-001', [
    { name: 'A', percentage: 33.33 },
    { name: 'B', percentage: 33.33 },
  ]);
  const splits = getSplitsForTransaction(db, 'tx-001');
  expect(splits).toHaveLength(2);
});

test('markTransactionSplit replaces existing splits on re-call', () => {
  markTransactionSplit(db, 'tx-001', [{ name: 'Juan', percentage: 50 }]);
  markTransactionSplit(db, 'tx-001', [{ name: 'Carlos', percentage: 50 }]);
  const splits = getSplitsForTransaction(db, 'tx-001');
  expect(splits).toHaveLength(1);
  expect(splits[0].debtor_name).toBe('Carlos');
});

test('markTransactionSplit throws if percentage > 100', () => {
  expect(() => markTransactionSplit(db, 'tx-001', [{ name: 'A', percentage: 60 }, { name: 'B', percentage: 60 }])).toThrow();
});

test('recalculateDebtors sums correctly across transactions', () => {
  upsertTransaction(db, {
    id: 'tx-002', bank_id: 'b2', date: '2026-06-04',
    amount: -45.00, description: 'Starbucks', type: 'debit',
    account_type: 'card', synced_at: new Date().toISOString(),
  });
  markTransactionSplit(db, 'tx-001', [{ name: 'Juan', percentage: 50 }]);
  markTransactionSplit(db, 'tx-002', [{ name: 'Juan', percentage: 50 }]);
  recalculateDebtors(db);
  const debtors = getAllDebtors(db);
  const juan = debtors.find((d) => d.name === 'Juan');
  expect(juan.total_owed).toBeCloseTo(82.50, 2);
});
