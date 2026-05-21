import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: '⊞' },
  { id: 'transactions', label: 'Transactions', path: '/transactions', icon: '↔' },
];

const Sidebar = ({ active }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={styles.sidebar}>
      <div style={styles.brand}>
        <div style={styles.brandIcon}>⬡</div>
        <div style={styles.brandText}>NexaBank</div>
      </div>

      <nav style={styles.nav}>
        {navItems.map((item) => (
          <NavLink key={item.id} to={item.path} style={({ isActive }) => ({
            ...styles.navItem,
            ...(isActive ? styles.navItemActive : {}),
          })}>
            <span style={styles.navIcon}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={styles.bottom}>
        <div style={styles.userCard}>
          <div style={styles.avatar}>
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{user?.first_name} {user?.last_name}</div>
            <div style={styles.userEmail}>{user?.email}</div>
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={handleLogout}>
          <span>⎋</span> Sign Out
        </button>
      </div>
    </div>
  );
};

const styles = {
  sidebar: {
    width: '260px',
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    position: 'sticky',
    top: 0,
    height: '100vh',
    flexShrink: 0,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '36px',
    paddingLeft: '8px',
  },
  brandIcon: {
    fontSize: '28px',
    background: 'var(--gradient-primary)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  brandText: {
    fontSize: '20px',
    fontWeight: '800',
    background: 'var(--gradient-primary)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    transition: 'all 0.2s',
    textDecoration: 'none',
  },
  navItemActive: {
    background: 'rgba(99,102,241,0.15)',
    color: 'var(--accent-primary)',
    fontWeight: '600',
    boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.2)',
  },
  navIcon: {
    fontSize: '18px',
    width: '24px',
    textAlign: 'center',
  },
  bottom: {
    borderTop: '1px solid var(--border-color)',
    paddingTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'var(--gradient-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '700',
    color: 'white',
    flexShrink: 0,
  },
  userInfo: { flex: 1, overflow: 'hidden' },
  userName: { fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userEmail: { fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.15)',
    color: 'var(--accent-red)',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    width: '100%',
  },
};

export default Sidebar;
