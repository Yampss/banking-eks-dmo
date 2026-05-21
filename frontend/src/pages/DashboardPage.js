import React, { useState, useEffect } from 'react';
import { accountAPI, transactionAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DashboardPage = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [createForm, setCreateForm] = useState({ account_type: 'savings', currency: 'USD' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [accRes, txRes] = await Promise.all([
        accountAPI.getMyAccounts(),
        transactionAPI.getMyTransactions({ limit: 10 }),
      ]);
      setAccounts(accRes.data.data);
      setTransactions(txRes.data.data);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await accountAPI.create(createForm);
      setShowCreateAccount(false);
      loadData();
    } catch (err) {
    } finally {
      setCreating(false);
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);

  const chartData = transactions
    .slice(0, 7)
    .reverse()
    .map((tx, i) => ({
      name: new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: parseFloat(tx.amount),
    }));

  if (loading) {
    return (
      <div style={styles.pageLayout}>
        <Sidebar active="dashboard" />
        <div style={styles.content}>
          <div style={styles.loadingCenter}>
            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageLayout}>
      <Sidebar active="dashboard" />
      <div style={styles.content} className="fade-in">
        <div style={styles.header}>
          <div>
            <h1 style={styles.greeting}>Good morning, {user?.first_name} 👋</h1>
            <p style={styles.subGreeting}>Here's what's happening with your finances</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateAccount(true)}>
            + New Account
          </button>
        </div>

        <div style={styles.statsGrid}>
          <div style={styles.balanceCard}>
            <div style={styles.balanceLabel}>Total Balance</div>
            <div style={styles.balanceAmount}>${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div style={styles.balanceSub}>{accounts.length} account{accounts.length !== 1 ? 's' : ''} linked</div>
          </div>

          <div className="card" style={styles.statCard}>
            <div style={{ ...styles.statIcon, background: 'rgba(16,185,129,0.15)' }}>↑</div>
            <div>
              <div style={styles.statLabel}>Total In</div>
              <div className="text-success" style={styles.statValue}>
                ${transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + parseFloat(t.amount), 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="card" style={styles.statCard}>
            <div style={{ ...styles.statIcon, background: 'rgba(239,68,68,0.15)' }}>↓</div>
            <div>
              <div style={styles.statLabel}>Total Out</div>
              <div className="text-danger" style={styles.statValue}>
                ${transactions.filter(t => t.type !== 'deposit').reduce((s, t) => s + parseFloat(t.amount), 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="card" style={styles.statCard}>
            <div style={{ ...styles.statIcon, background: 'rgba(99,102,241,0.15)' }}>≡</div>
            <div>
              <div style={styles.statLabel}>Transactions</div>
              <div style={styles.statValue}>{transactions.length}</div>
            </div>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={styles.sectionTitle}>Recent Activity</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', color: '#f1f5f9' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} fill="url(#colorAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div style={styles.twoCol}>
          <div>
            <h3 style={styles.sectionTitle}>My Accounts</h3>
            {accounts.length === 0 ? (
              <div className="card" style={styles.emptyState}>
                <div style={styles.emptyIcon}>🏦</div>
                <p>No accounts yet. Create your first account!</p>
              </div>
            ) : (
              accounts.map((account) => (
                <div key={account.id} style={styles.accountCard} className="card">
                  <div style={styles.accountTop}>
                    <div>
                      <div style={styles.accountType}>{account.account_type.toUpperCase()}</div>
                      <div style={styles.accountNumber}>{account.account_number}</div>
                    </div>
                    <span className={`badge ${account.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {account.status}
                    </span>
                  </div>
                  <div style={styles.accountBalance}>
                    ${parseFloat(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    <span style={styles.currency}>{account.currency}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div>
            <h3 style={styles.sectionTitle}>Recent Transactions</h3>
            {transactions.length === 0 ? (
              <div className="card" style={styles.emptyState}>
                <div style={styles.emptyIcon}>💳</div>
                <p>No transactions yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {transactions.slice(0, 6).map((tx) => (
                  <div key={tx.id} className="card" style={styles.txCard}>
                    <div style={styles.txIconWrap}>
                      <div style={{
                        ...styles.txIcon,
                        background: tx.type === 'deposit' ? 'rgba(16,185,129,0.15)' :
                          tx.type === 'transfer' ? 'rgba(99,102,241,0.15)' : 'rgba(239,68,68,0.15)'
                      }}>
                        {tx.type === 'deposit' ? '↓' : tx.type === 'transfer' ? '↔' : '↑'}
                      </div>
                    </div>
                    <div style={styles.txInfo}>
                      <div style={styles.txType}>{tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</div>
                      <div style={styles.txRef}>{tx.reference_id}</div>
                    </div>
                    <div style={{
                      ...styles.txAmount,
                      color: tx.type === 'deposit' ? 'var(--accent-green)' : 'var(--accent-red)'
                    }}>
                      {tx.type === 'deposit' ? '+' : '-'}${parseFloat(tx.amount).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showCreateAccount && (
          <div style={styles.modal} onClick={() => setShowCreateAccount(false)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()} className="fade-in">
              <h3 style={styles.modalTitle}>Create New Account</h3>
              <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="input-group">
                  <label>Account Type</label>
                  <select value={createForm.account_type} onChange={(e) => setCreateForm({ ...createForm, account_type: e.target.value })}>
                    <option value="savings">Savings</option>
                    <option value="checking">Checking</option>
                    <option value="investment">Investment</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Currency</label>
                  <select value={createForm.currency} onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={creating}>
                    {creating ? <span className="spinner" /> : 'Create Account'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateAccount(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  pageLayout: { display: 'flex', minHeight: '100vh' },
  content: { flex: 1, padding: '32px', overflowY: 'auto', background: 'var(--bg-primary)' },
  loadingCenter: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' },
  greeting: { fontSize: '26px', fontWeight: '700', marginBottom: '4px' },
  subGreeting: { color: 'var(--text-secondary)', fontSize: '14px' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1.5fr repeat(3, 1fr)', gap: '16px', marginBottom: '24px' },
  balanceCard: {
    background: 'var(--gradient-primary)',
    borderRadius: '20px',
    padding: '28px',
    boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
  },
  balanceLabel: { fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', fontWeight: '500' },
  balanceAmount: { fontSize: '32px', fontWeight: '800', color: 'white', marginBottom: '8px' },
  balanceSub: { fontSize: '13px', color: 'rgba(255,255,255,0.6)' },
  statCard: { display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' },
  statIcon: { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 },
  statLabel: { fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' },
  statValue: { fontSize: '20px', fontWeight: '700' },
  sectionTitle: { fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-primary)' },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' },
  emptyState: { textAlign: 'center', padding: '40px', color: 'var(--text-muted)' },
  emptyIcon: { fontSize: '36px', marginBottom: '12px' },
  accountCard: { marginBottom: '12px', padding: '20px' },
  accountTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  accountType: { fontSize: '11px', fontWeight: '700', color: 'var(--accent-primary)', letterSpacing: '1px' },
  accountNumber: { fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' },
  accountBalance: { fontSize: '26px', fontWeight: '800', display: 'flex', alignItems: 'baseline', gap: '8px' },
  currency: { fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' },
  txCard: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' },
  txIconWrap: {},
  txIcon: { width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700' },
  txInfo: { flex: 1 },
  txType: { fontSize: '14px', fontWeight: '600' },
  txRef: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' },
  txAmount: { fontSize: '15px', fontWeight: '700' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '32px', width: '420px' },
  modalTitle: { fontSize: '18px', fontWeight: '700', marginBottom: '24px' },
};

export default DashboardPage;
