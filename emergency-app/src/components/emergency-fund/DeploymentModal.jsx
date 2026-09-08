import React, { useState } from 'react';
import { X, Zap, AlertCircle, CheckCircle, Loader } from 'lucide-react';

const DeploymentModal = ({ isOpen, onClose, onDeploy, availableFund, isDeploying }) => {
  const [formData, setFormData] = useState({
    amount: '',
    purpose: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (parseFloat(formData.amount) > availableFund) {
      setError(`Amount exceeds available funds (${availableFund.toFixed(4)} ETH)`);
      return;
    }

    if (!formData.purpose.trim()) {
      setError('Please enter a purpose for deployment');
      return;
    }

    await onDeploy(formData);
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <Zap size={24} color="#10b981" />
            <h2 style={styles.title}>Authorize Fund Deployment</h2>
          </div>
          <button onClick={onClose} style={styles.closeButton}>
            <X size={20} />
          </button>
        </div>

        {/* Available Funds */}
        <div style={styles.availableFunds}>
          <div style={styles.availableLabel}>Available to Deploy</div>
          <div style={styles.availableAmount}>
            <span style={styles.availableEth}>{availableFund.toFixed(4)} ETH</span>
            <span style={styles.availableInr}>
              ≈ ₹{(availableFund * 250000).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Amount (ETH) *</label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              style={styles.input}
              disabled={isDeploying}
            />
            {formData.amount && (
              <div style={styles.inputHint}>
                ≈ ₹{(parseFloat(formData.amount || 0) * 250000).toLocaleString('en-IN')}
              </div>
            )}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Purpose / Operation *</label>
            <input
              type="text"
              placeholder="e.g. Medical supplies for Pune Zone 3"
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              style={styles.input}
              disabled={isDeploying}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div style={styles.error}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Warning */}
          <div style={styles.warning}>
            <AlertCircle size={16} />
            <span>This action will permanently record the deployment on the blockchain and cannot be undone.</span>
          </div>

          {/* Actions */}
          <div style={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              style={styles.cancelButton}
              disabled={isDeploying}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={styles.submitButton}
              disabled={isDeploying}
            >
              {isDeploying ? (
                <>
                  <Loader size={16} className="spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Sign & Authorize
                </>
              )}
            </button>
          </div>

          {/* Blockchain Note */}
          <p style={styles.note}>
            This sends a signed transaction to the Ethereum smart contract. 
            MetaMask will open to confirm the transaction.
          </p>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    background: 'white',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '500px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#0f172a',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#64748b',
    padding: '4px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableFunds: {
    margin: '20px 24px',
    padding: '16px 20px',
    background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
    borderRadius: '16px',
    border: '1px solid #bbf7d0',
  },
  availableLabel: {
    fontSize: '12px',
    color: '#166534',
    marginBottom: '4px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  availableAmount: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  availableEth: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#166534',
  },
  availableInr: {
    fontSize: '14px',
    color: '#166534',
    opacity: 0.8,
  },
  form: {
    padding: '0 24px 24px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#334155',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '12px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  },
  inputHint: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '4px',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    padding: '12px 16px',
    marginBottom: '16px',
    color: '#b91c1c',
    fontSize: '13px',
  },
  warning: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '10px',
    padding: '12px 16px',
    marginBottom: '20px',
    color: '#b45309',
    fontSize: '13px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  cancelButton: {
    flex: 1,
    padding: '12px',
    background: 'white',
    border: '1.5px solid #e2e8f0',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  submitButton: {
    flex: 2,
    padding: '12px',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'white',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  note: {
    fontSize: '11px',
    color: '#94a3b8',
    textAlign: 'center',
    margin: 0,
  },
};

export default DeploymentModal;