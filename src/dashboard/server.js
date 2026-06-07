const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { initDb } = require('../db/schema');
const { getTransactions } = require('../db/transactions');
const { getAllSplits } = require('../db/splits');
const { getAllDebtors } = require('../db/debtors');
const { getLoan } = require('../db/loan');
const { calculateTrueSpending, projectLoanPayoff, calculateMonthlyCommitment } = require('../processor/financials');
const { markTransactionSplit, recalculateDebtors } = require('../processor/splits');
const { sync } = require('../sync');

const DB_PATH = path.join(__dirname, '../../../data/santander.db');
const PORT = process.env.DASHBOARD_PORT || 8766;

function openDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  initDb(db);
  return db;
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/summary', (req, res) => {
  const db = openDb();
  const transactions = getTransactions(db, { accountType: 'card' });
  const splits = getAllSplits(db);
  const debtors = getAllDebtors(db);
  const loan = getLoan(db);
  const spending = calculateTrueSpending(transactions, splits);
  const projection = loan ? projectLoanPayoff({ balance: loan.balance, monthlyPayment: loan.monthly_payment }) : null;
  const commitment = loan
    ? calculateMonthlyCommitment({ cardSpendingOwnOnly: spending.cardOwnOnly, loanMonthlyPayment: loan.monthly_payment })
    : spending.cardOwnOnly;
  const meta = db.prepare("SELECT value FROM sync_metadata WHERE key='last_sync'").get();
  db.close();
  res.json({ transactions, splits, debtors, loan, spending, projection, commitment, lastSync: meta?.value || null });
});

app.post('/api/split', (req, res) => {
  const { transactionId, debtors } = req.body;
  if (!transactionId || !debtors) return res.status(400).json({ error: 'transactionId and debtors required' });
  const db = openDb();
  try {
    markTransactionSplit(db, transactionId, debtors);
    recalculateDebtors(db);
    db.close();
    res.json({ ok: true });
  } catch (err) {
    db.close();
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sync', async (req, res) => {
  try {
    await sync();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Dashboard at http://localhost:${PORT}`));
module.exports = app;
