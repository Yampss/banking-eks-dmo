import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '',
    phone: '', address: '', date_of_birth: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div style={styles.container}>
      <div style={styles.background}>
        <div style={styles.orb1} />
        <div style={styles.orb2} />
      </div>

      <div style={styles.card} className="fade-in">
        <div style={styles.logoArea}>
          <div style={styles.logoIcon}>⬡</div>
          <h1 style={styles.brandName}>NexaBank</h1>
        </div>

        <h2 style={styles.title}>Create your account</h2>
        <p style={styles.subtitle}>Join thousands of customers banking smarter</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div className="grid-2">
            <div className="input-group">
              <label>First Name</label>
              <input type="text" placeholder="John" value={form.first_name} onChange={set('first_name')} required />
            </div>
            <div className="input-group">
              <label>Last Name</label>
              <input type="text" placeholder="Doe" value={form.last_name} onChange={set('last_name')} required />
            </div>
          </div>

          <div className="input-group">
            <label>Email Address</label>
            <input type="email" placeholder="john@example.com" value={form.email} onChange={set('email')} required />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input type="password" placeholder="Min 8 characters" value={form.password} onChange={set('password')} required minLength={8} />
          </div>

          <div className="input-group">
            <label>Phone Number</label>
            <input type="tel" placeholder="+1 234 567 8900" value={form.phone} onChange={set('phone')} />
          </div>

          <div className="input-group">
            <label>Date of Birth</label>
            <input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
          </div>

          <div className="input-group">
            <label>Address</label>
            <input type="text" placeholder="123 Main St, City, Country" value={form.address} onChange={set('address')} />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>

        <p style={styles.switchText}>
          Already have an account?{' '}
          <Link to="/login" style={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
    padding: '20px',
  },
  background: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  },
  orb1: {
    position: 'absolute',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)',
    top: '-100px',
    left: '-100px',
  },
  orb2: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)',
    bottom: '-50px',
    right: '-50px',
  },
  card: {
    background: 'var(--bg-card)',
    backdropFilter: 'blur(20px)',
    border: '1px solid var(--border-color)',
    borderRadius: '24px',
    padding: '40px',
    width: '100%',
    maxWidth: '500px',
    boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
    position: 'relative',
    zIndex: 1,
  },
  logoArea: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logoIcon: {
    fontSize: '40px',
    background: 'var(--gradient-primary)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'block',
  },
  brandName: {
    fontSize: '24px',
    fontWeight: '800',
    background: 'var(--gradient-primary)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '24px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  switchText: {
    textAlign: 'center',
    marginTop: '20px',
    fontSize: '14px',
    color: 'var(--text-secondary)',
  },
  link: {
    color: 'var(--accent-primary)',
    fontWeight: '600',
  },
};

export default RegisterPage;
