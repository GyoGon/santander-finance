// Loan is a singleton row (id=1 always). Only one loan per user.
function upsertLoan(db, loan) {
  db.prepare(`
    INSERT INTO loan (id, balance, monthly_payment, remaining_installments, due_date, updated_at)
    VALUES (1, @balance, @monthly_payment, @remaining_installments, @due_date, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      balance=excluded.balance, monthly_payment=excluded.monthly_payment,
      remaining_installments=excluded.remaining_installments,
      due_date=excluded.due_date, updated_at=excluded.updated_at
  `).run(loan);
}

function getLoan(db) {
  return db.prepare('SELECT * FROM loan WHERE id = 1').get() ?? null;
}

module.exports = { upsertLoan, getLoan };
