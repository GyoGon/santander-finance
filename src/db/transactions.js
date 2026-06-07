function upsertTransaction(db, tx) {
  db.prepare(`
    INSERT INTO transactions (id, bank_id, date, amount, description, type, account_type, synced_at)
    VALUES (@id, @bank_id, @date, @amount, @description, @type, @account_type, @synced_at)
    ON CONFLICT(id) DO UPDATE SET
      amount=excluded.amount, description=excluded.description, synced_at=excluded.synced_at
  `).run(tx);
}

function getTransactions(db, { accountType, since } = {}) {
  let q = 'SELECT * FROM transactions WHERE 1=1';
  const params = {};
  if (accountType) { q += ' AND account_type = @accountType'; params.accountType = accountType; }
  if (since) { q += ' AND date >= @since'; params.since = since; }
  q += ' ORDER BY date DESC';
  return db.prepare(q).all(params);
}

module.exports = { upsertTransaction, getTransactions };
