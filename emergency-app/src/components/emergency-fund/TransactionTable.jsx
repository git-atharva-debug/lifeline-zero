import React, { useState } from 'react';
import { 
  ExternalLink, 
  Clock, 
  Search, 
  Filter,
  ChevronLeft,
  ChevronRight,
  Download 
} from 'lucide-react';

const TransactionTable = ({ transactions = [], explorerBase = 'https://sepolia.etherscan.io' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  // Format INR
  const formatINR = (num) => {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num);
  };

  // Format ETH
  const formatETH = (eth) => {
    return parseFloat(eth || 0).toFixed(4);
  };

  // Shorten address
  const shortenAddress = (addr) => {
    if (!addr) return '—';
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (tx.donorName?.toLowerCase() || '').includes(searchLower) ||
      (tx.donor?.toLowerCase() || '').includes(searchLower) ||
      (tx.message?.toLowerCase() || '').includes(searchLower) ||
      tx.amount.toString().includes(searchLower)
    );
  });

  // Sort transactions
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (sortConfig.key === 'amount') {
      return sortConfig.direction === 'asc' 
        ? a.amount - b.amount
        : b.amount - a.amount;
    }
    if (sortConfig.key === 'timestamp') {
      return sortConfig.direction === 'asc'
        ? new Date(a.timestamp) - new Date(b.timestamp)
        : new Date(b.timestamp) - new Date(a.timestamp);
    }
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedTransactions.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedTransactions = sortedTransactions.slice(startIndex, startIndex + rowsPerPage);

  // Handle sort
  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Donor Name', 'Donor Address', 'Amount (ETH)', 'Amount (INR)', 'Message', 'Timestamp', 'Transaction Hash'];
    const csvData = transactions.map(tx => [
      tx.donorName || 'Anonymous',
      tx.donor,
      tx.amount,
      formatINR(tx.amountINR),
      `"${tx.message || ''}"`,
      new Date(tx.timestamp).toISOString(),
      tx.transactionHash || 'N/A',
    ]);
    
    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `donations_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div style={styles.container}>
      {/* Header with search and filters */}
      <div style={styles.header}>
        <div style={styles.searchBox}>
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search by name, address, or message..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <div style={styles.actions}>
          <button style={styles.filterButton}>
            <Filter size={16} />
            Filter
          </button>
          <button onClick={exportToCSV} style={styles.exportButton}>
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Donor</th>
              <th style={styles.th}>Address</th>
              <th 
                style={{ ...styles.th, cursor: 'pointer' }}
                onClick={() => handleSort('amount')}
              >
                Amount (ETH) {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th style={styles.th}>Amount (INR)</th>
              <th style={styles.th}>Message</th>
              <th 
                style={{ ...styles.th, cursor: 'pointer' }}
                onClick={() => handleSort('timestamp')}
              >
                Timestamp {sortConfig.key === 'timestamp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th style={styles.th}>Explorer</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTransactions.length > 0 ? (
              paginatedTransactions.map((tx, index) => (
                <tr key={index} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.donorInfo}>
                      <div style={styles.donorAvatar}>
                        {tx.donorName?.[0] || 'A'}
                      </div>
                      <span style={styles.donorName}>{tx.donorName || 'Anonymous'}</span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.address}>{shortenAddress(tx.donor)}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.ethAmount}>{formatETH(tx.amount)} ETH</span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.inrAmount}>₹{formatINR(tx.amountINR)}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.message}>"{tx.message || '—'}"</span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.timeCell}>
                      <Clock size={12} color="#94a3b8" />
                      <span style={styles.time}>{formatTime(tx.timestamp)}</span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <a
                      href={`${explorerBase}/address/${tx.donor}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.explorerLink}
                    >
                      View <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={styles.emptyState}>
                  {searchTerm ? 'No matching transactions found' : 'No transactions yet'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredTransactions.length > 0 && (
        <div style={styles.pagination}>
          <div style={styles.paginationInfo}>
            Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, filteredTransactions.length)} of{' '}
            {filteredTransactions.length} transactions
          </div>
          <div style={styles.paginationControls}>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={styles.rowsSelect}
            >
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
            <div style={styles.pageButtons}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={styles.pageButton}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={styles.pageButton}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    background: 'white',
    borderRadius: '20px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
    flexWrap: 'wrap',
    gap: '12px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '0 12px',
    flex: 1,
    maxWidth: '400px',
  },
  searchInput: {
    border: 'none',
    background: 'none',
    padding: '10px 0',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
  },
  actions: {
    display: 'flex',
    gap: '8px',
  },
  filterButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#64748b',
    cursor: 'pointer',
  },
  exportButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: '#0f172a',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    color: 'white',
    cursor: 'pointer',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '14px 20px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '2px solid #e2e8f0',
    background: '#f8fafc',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
    transition: 'background 0.2s',
  },
  td: {
    padding: '16px 20px',
    fontSize: '14px',
    color: '#0f172a',
  },
  donorInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  donorAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '600',
    fontSize: '14px',
  },
  donorName: {
    fontWeight: '500',
  },
  address: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#64748b',
  },
  ethAmount: {
    fontWeight: '600',
    color: '#0f172a',
  },
  inrAmount: {
    color: '#10b981',
    fontWeight: '500',
  },
  message: {
    color: '#64748b',
    fontSize: '13px',
    fontStyle: 'italic',
    maxWidth: '250px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  timeCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  time: {
    fontSize: '13px',
    color: '#64748b',
  },
  explorerLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: '#3b82f6',
    textDecoration: 'none',
    fontSize: '13px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#94a3b8',
    fontSize: '14px',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderTop: '1px solid #e2e8f0',
    flexWrap: 'wrap',
    gap: '12px',
  },
  paginationInfo: {
    fontSize: '13px',
    color: '#64748b',
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  rowsSelect: {
    padding: '6px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#0f172a',
    background: 'white',
  },
  pageButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  pageButton: {
    padding: '6px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    background: 'white',
    color: '#0f172a',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  pageInfo: {
    fontSize: '13px',
    color: '#0f172a',
  },
};

export default TransactionTable;