function upsertDebtor(db, debtor) {
  db.prepare(`
    INSERT INTO debtors (id, name, total_owed, created_at, updated_at)
    VALUES (@id, @name, @total_owed, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      total_owed=excluded.total_owed, updated_at=excluded.updated_at
  `).run(debtor);
}

function getAllDebtors(db) {
  return db.prepare('SELECT * FROM debtors ORDER BY total_owed DESC').all();
}

function getDebtorByName(db, name) {
  return db.prepare('SELECT * FROM debtors WHERE name = ?').get(name) ?? null;
}

module.exports = { upsertDebtor, getAllDebtors, getDebtorByName };
