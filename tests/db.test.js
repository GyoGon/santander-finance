const Database = require('better-sqlite3');
const { initDb } = require('../src/db/schema');
const path = require('path');
const fs = require('fs');
const { upsertTransaction, getTransactions } = require('../src/db/transactions');
const { upsertSplit, getSplitsForTransaction, getAllSplits, deleteSplitsForTransaction } = require('../src/db/splits');
const { upsertDebtor, getAllDebtors, getDebtorByName } = require('../src/db/debtors');
const { upsertLoan, getLoan } = require('../src/db/loan');

const TEST_DB = path.join(__dirname, 'test.db');

afterEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

test('initDb creates all required tables', () => {
  const db = new Database(TEST_DB);
  initDb(db);

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);

  expect(tables).toContain('transactions');
  expect(tables).toContain('splits');
  expect(tables).toContain('debtors');
  expect(tables).toContain('loan');
  expect(tables).toContain('sync_metadata');
  db.close();
});

test('initDb is idempotent (can be called twice)', () => {
  const db = new Database(TEST_DB);
  initDb(db);
  expect(() => initDb(db)).not.toThrow();
  db.close();
});

test('transactions rejects invalid type', () => {
  const db = new Database(TEST_DB);
  initDb(db);
  expect(() => {
    db.prepare(`INSERT INTO transactions VALUES ('t1','b1','2026-01-01',-10,'desc','transfer','card','2026-01-01')`).run();
  }).toThrow();
  db.close();
});

test('splits rejects percentage <= 0', () => {
  const db = new Database(TEST_DB);
  initDb(db);
  db.prepare(`INSERT INTO transactions VALUES ('t1','b1','2026-01-01',-10,'desc','debit','card','2026-01-01')`).run();
  expect(() => {
    db.prepare(`INSERT INTO splits VALUES ('s1','t1','Juan',0,0,'2026-01-01','2026-01-01')`).run();
  }).toThrow();
  db.close();
});

test('loan enforces single-row singleton', () => {
  const db = new Database(TEST_DB);
  initDb(db);
  db.prepare(`INSERT INTO loan VALUES (1,1000,100,10,'2026-06-20','2026-01-01')`).run();
  expect(() => {
    db.prepare(`INSERT INTO loan VALUES (2,2000,200,5,'2026-07-20','2026-01-01')`).run();
  }).toThrow();
  db.close();
});

describe('transactions', () => {
  test('upsertTransaction stores and retrieves a transaction', () => {
    const db = new Database(TEST_DB);
    initDb(db);

    const tx = {
      id: 'tx-001',
      bank_id: 'santander-001',
      date: '2026-06-05',
      amount: -45.00,
      description: 'Starbucks',
      type: 'debit',
      account_type: 'card',
      synced_at: new Date().toISOString(),
    };

    upsertTransaction(db, tx);
    const rows = getTransactions(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('tx-001');
    expect(rows[0].amount).toBe(-45.00);
    db.close();
  });

  test('getTransactions filters by accountType', () => {
    const db = new Database(TEST_DB);
    initDb(db);
    upsertTransaction(db, { id: 'tx-c', bank_id: 'b', date: '2026-06-01', amount: -10, description: 'card tx', type: 'debit', account_type: 'card', synced_at: new Date().toISOString() });
    upsertTransaction(db, { id: 'tx-l', bank_id: 'b', date: '2026-06-01', amount: -100, description: 'loan tx', type: 'debit', account_type: 'loan', synced_at: new Date().toISOString() });
    const cardTxs = getTransactions(db, { accountType: 'card' });
    expect(cardTxs).toHaveLength(1);
    expect(cardTxs[0].id).toBe('tx-c');
    db.close();
  });
});

describe('splits', () => {
  test('upsertSplit links a split to a transaction', () => {
    const db = new Database(TEST_DB);
    initDb(db);

    upsertTransaction(db, {
      id: 'tx-002', bank_id: 'b2', date: '2026-06-05',
      amount: -120.00, description: 'Jumbo', type: 'debit',
      account_type: 'card', synced_at: new Date().toISOString(),
    });

    upsertSplit(db, {
      id: 'sp-001',
      transaction_id: 'tx-002',
      debtor_name: 'Juan',
      percentage: 50,
      amount_owed: 60.00,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const splits = getSplitsForTransaction(db, 'tx-002');
    expect(splits).toHaveLength(1);
    expect(splits[0].debtor_name).toBe('Juan');
    expect(splits[0].amount_owed).toBe(60.00);
    db.close();
  });

  test('deleteSplitsForTransaction removes all splits for a transaction', () => {
    const db = new Database(TEST_DB);
    initDb(db);
    upsertTransaction(db, { id: 'tx-del', bank_id: 'b', date: '2026-06-01', amount: -50, description: 'test', type: 'debit', account_type: 'card', synced_at: new Date().toISOString() });
    upsertSplit(db, { id: 'sp-del1', transaction_id: 'tx-del', debtor_name: 'A', percentage: 50, amount_owed: 25, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    deleteSplitsForTransaction(db, 'tx-del');
    expect(getSplitsForTransaction(db, 'tx-del')).toHaveLength(0);
    db.close();
  });
});

describe('debtors', () => {
  test('upsertDebtor creates or updates a debtor', () => {
    const db = new Database(TEST_DB);
    initDb(db);

    upsertDebtor(db, { id: 'd-001', name: 'Juan', total_owed: 60.00,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    upsertDebtor(db, { id: 'd-001', name: 'Juan', total_owed: 82.50,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString() });

    const debtors = getAllDebtors(db);
    expect(debtors).toHaveLength(1);
    expect(debtors[0].total_owed).toBe(82.50);
    db.close();
  });

  test('getDebtorByName returns null for unknown debtor', () => {
    const db = new Database(TEST_DB);
    initDb(db);
    expect(getDebtorByName(db, 'NoExiste')).toBeNull();
    db.close();
  });
});

describe('loan', () => {
  test('upsertLoan stores loan data', () => {
    const db = new Database(TEST_DB);
    initDb(db);

    upsertLoan(db, {
      balance: 12450.00,
      monthly_payment: 850.00,
      remaining_installments: 15,
      due_date: '2026-06-20',
      updated_at: new Date().toISOString(),
    });

    const loan = getLoan(db);
    expect(loan.balance).toBe(12450.00);
    expect(loan.remaining_installments).toBe(15);
    db.close();
  });

  test('upsertLoan updates loan data on second call', () => {
    const db = new Database(TEST_DB);
    initDb(db);

    upsertLoan(db, { balance: 12450, monthly_payment: 850, remaining_installments: 15, due_date: '2026-06-20', updated_at: new Date().toISOString() });
    upsertLoan(db, { balance: 11600, monthly_payment: 850, remaining_installments: 14, due_date: '2026-07-20', updated_at: new Date().toISOString() });

    const loan = getLoan(db);
    expect(loan.balance).toBe(11600);
    expect(loan.remaining_installments).toBe(14);
    db.close();
  });
});
