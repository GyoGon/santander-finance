function upsertSplit(db, split) {
  db.prepare(`
    INSERT INTO splits (id, transaction_id, debtor_name, percentage, amount_owed, created_at, updated_at)
    VALUES (@id, @transaction_id, @debtor_name, @percentage, @amount_owed, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      percentage=excluded.percentage, amount_owed=excluded.amount_owed, updated_at=excluded.updated_at
  `).run(split);
}

function getSplitsForTransaction(db, transactionId) {
  return db.prepare('SELECT * FROM splits WHERE transaction_id = ?').all(transactionId);
}

function getAllSplits(db) {
  return db.prepare('SELECT * FROM splits').all();
}

function deleteSplitsForTransaction(db, transactionId) {
  db.prepare('DELETE FROM splits WHERE transaction_id = ?').run(transactionId);
}

module.exports = { upsertSplit, getSplitsForTransaction, getAllSplits, deleteSplitsForTransaction };
