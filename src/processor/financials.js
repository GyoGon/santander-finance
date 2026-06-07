function calculateMonthlyCommitment({ cardSpendingOwnOnly, loanMonthlyPayment }) {
  return Math.round((cardSpendingOwnOnly + loanMonthlyPayment) * 100) / 100;
}

function calculateTrueSpending(transactions, splits) {
  const cardTxs = transactions.filter((tx) => tx.account_type === 'card');
  const totalCard = cardTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const totalDebtorsOwe = splits.reduce((sum, s) => sum + s.amount_owed, 0);
  const cardOwnOnly = totalCard - totalDebtorsOwe;

  return {
    totalCard: Math.round(totalCard * 100) / 100,
    cardOwnOnly: Math.round(cardOwnOnly * 100) / 100,
    totalDebtorsOwe: Math.round(totalDebtorsOwe * 100) / 100,
  };
}

function projectLoanPayoff({ balance, monthlyPayment }) {
  if (balance <= 0) return { monthsRemaining: 0, payoffDate: null };
  const months = Math.ceil(balance / monthlyPayment);
  const payoff = new Date();
  payoff.setMonth(payoff.getMonth() + months);
  const payoffDate = `${payoff.getFullYear()}-${String(payoff.getMonth() + 1).padStart(2, '0')}`;
  return { monthsRemaining: months, payoffDate };
}

module.exports = { calculateMonthlyCommitment, calculateTrueSpending, projectLoanPayoff };
