const { upsertSplit, deleteSplitsForTransaction, getAllSplits } = require('../db/splits');
const { upsertDebtor } = require('../db/debtors');
const { randomUUID } = require('crypto');

function markTransactionSplit(db, transactionId, debtors) {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);
  if (!debtors || debtors.length === 0) throw new Error('At least one debtor required');

  const totalPct = debtors.reduce((sum, d) => sum + d.percentage, 0);
  if (totalPct > 100) throw new Error(`Split percentages total ${totalPct}%, cannot exceed 100%`);

  const now = new Date().toISOString();
  deleteSplitsForTransaction(db, transactionId);

  for (const debtor of debtors) {
    const amountOwed = Math.round(Math.abs(tx.amount) * (debtor.percentage / 100) * 100) / 100;
    upsertSplit(db, {
      id: randomUUID(),
      transaction_id: transactionId,
      debtor_name: debtor.name,
      percentage: debtor.percentage,
      amount_owed: amountOwed,
      created_at: now,
      updated_at: now,
    });
  }
}

function recalculateDebtors(db) {
  const splits = getAllSplits(db);
  const totals = {};

  for (const split of splits) {
    totals[split.debtor_name] = (totals[split.debtor_name] || 0) + split.amount_owed;
  }

  const now = new Date().toISOString();
  for (const [name, total] of Object.entries(totals)) {
    const existing = db.prepare('SELECT id FROM debtors WHERE name = ?').get(name);
    upsertDebtor(db, {
      id: existing ? existing.id : randomUUID(),
      name,
      total_owed: Math.round(total * 100) / 100,
      created_at: now,
      updated_at: now,
    });
  }
}

module.exports = { markTransactionSplit, recalculateDebtors };
