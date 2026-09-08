import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../context/AuthContext';
import { emergencyProfileAPI, sosAPI } from '../../services/api';

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── CLEAN WHITE UI WITH PROPER TYPOGRAPHY ─────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  * { 
    box-sizing: border-box; 
    margin: 0; 
    padding: 0; 
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: #f5f7fb;
  }

  .ehub {
    min-height: 100vh;
    background: #f5f7fb;
    color: #1a1f36;
  }

  /* Typography - All fonts between 10px and 17px */
  .heading-xl {
    font-family: 'Inter', sans-serif;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.4;
    color: #1a1f36;
  }

  .heading-lg {
    font-family: 'Inter', sans-serif;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: #1a1f36;
  }

  .heading-md {
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    font-weight: 600;
    color: #1a1f36;
  }

  .heading-sm {
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #1a1f36;
  }

  .body-text {
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    line-height: 1.6;
    color: #4a5568;
  }

  .body-text-large {
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #2d3748;
  }

  .body-text-small {
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    line-height: 1.5;
    color: #718096;
  }

  .mono-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #4a5568;
  }

  /* ── Top bar ───────────────────────────────── */
  .ehub-topbar {
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    padding: 0 2rem;
    height: 70px;
    display: flex;
    align-items: center;
    gap: 1.5rem;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  }

  .ehub-logo {
    font-family: 'Inter', sans-serif;
    font-weight: 700;
    font-size: 15px;
    color: #e53e3e;
    letter-spacing: -0.01em;
  }

  .ehub-topbar-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    border-radius: 40px;
    font-size: 12px;
    font-weight: 500;
    font-family: 'Inter', sans-serif;
  }

  .status-badge-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .badge-idle {
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    color: #718096;
  }
  .badge-idle .status-badge-dot { background: #a0aec0; }

  .badge-active {
    background: #fff5f5;
    border: 1px solid #fc8181;
    color: #e53e3e;
  }
  .badge-active .status-badge-dot {
    background: #e53e3e;
  }

  .badge-armed {
    background: #fffaf0;
    border: 1px solid #fbd38d;
    color: #dd6b20;
  }
  .badge-armed .status-badge-dot { background: #dd6b20; }

  .battery-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #718096;
  }

  /* ── Main layout ───────────────────────────── */
  .ehub-body {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2.5rem 2rem 4rem;
  }

  /* ── Page Title ────────────────────────────── */
  .page-title {
    margin-bottom: 2rem;
  }

  .page-title h1 {
    font-family: 'Inter', sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #ef4444 0%, #f97316 50%, #eab308 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .page-title p {
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    color: #718096;
  }

  /* ── Warning banner ────────────────────────── */
  .ehub-warning {
    background: #fffaf0;
    border: 1px solid #fbd38d;
    border-radius: 12px;
    padding: 1rem 1.5rem;
    font-size: 13px;
    color: #c05621;
    margin-bottom: 2rem;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* ── Tab bar ───────────────────────────────── */
  .ehub-tabs {
    display: flex;
    gap: 8px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 6px;
    margin-bottom: 2.5rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  }

  .ehub-tab {
    flex: 1;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    border: none;
    background: transparent;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: #718096;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .ehub-tab:hover {
    background: #f7fafc;
    color: #2d3748;
  }

  .ehub-tab.tab-active {
    background: #e53e3e;
    color: #ffffff;
    font-weight: 500;
  }

  .ehub-tab.tab-sos-active {
    background: #e53e3e;
    color: #ffffff;
  }

  /* ── Sub-tabs ──────────────────────────────── */
  .sub-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 2rem;
  }

  .sub-tab {
    padding: 0.8rem 1.8rem;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: #718096;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
  }

  .sub-tab:hover {
    border-color: #cbd5e0;
    color: #2d3748;
    background: #f7fafc;
  }

  .sub-tab.sub-tab-active {
    background: #1a1f36;
    border-color: #1a1f36;
    color: #ffffff;
  }

  /* ── Cards ─────────────────────────────────── */
  .card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    padding: 2rem;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
    transition: all 0.2s ease;
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
    border-color: #cbd5e0;
  }

  .card-red {
    background: #fff5f5;
    border-color: #fc8181;
  }

  .card-amber {
    background: #fffaf0;
    border-color: #fbd38d;
  }

  .card-green {
    background: #f0fff4;
    border-color: #9ae6b4;
  }

  /* ── Section label ─────────────────────────── */
  .section-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #a0aec0;
    margin-bottom: 1.5rem;
  }

  /* ── Data rows ─────────────────────────────── */
  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid #edf2f7;
    font-size: 13px;
  }

  .data-row:last-child { border-bottom: none; }

  .data-label {
    color: #718096;
    font-size: 13px;
  }

  .data-val {
    color: #1a1f36;
    font-weight: 500;
    text-align: right;
    max-width: 60%;
    word-break: break-word;
    font-size: 13px;
  }

  .data-val-empty {
    color: #e53e3e;
  }

  /* ── Two-column grid ───────────────────────── */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }

  /* ── SOS Button ────────────────────────────── */
  .sos-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem 0 2.5rem;
  }

  .sos-hint {
    font-size: 12px;
    color: #a0aec0;
    letter-spacing: 0.02em;
    margin-bottom: 2rem;
    font-family: 'Inter', sans-serif;
  }

  .sos-btn-container {
    position: relative;
    width: 220px;
    height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2rem;
  }

  .sos-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid #fc8181;
    animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
  }

  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 0.5; }
    100% { transform: scale(2); opacity: 0; }
  }

  .sos-ring:nth-child(2) { animation-delay: 0.6s; }
  .sos-ring:nth-child(3) { animation-delay: 1.2s; }

  .sos-btn {
    width: 160px;
    height: 160px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #ffffff;
    position: relative;
    z-index: 2;
    transition: all 0.2s cubic-bezier(0.215, 0.61, 0.355, 1);
  }

  .sos-btn:hover {
    transform: scale(1.05);
  }

  .sos-btn:active { 
    transform: scale(0.95); 
  }

  .sos-btn:disabled { 
    cursor: wait; 
    opacity: 0.7; 
  }

  .sos-btn-idle {
    background: #e53e3e;
    box-shadow: 0 8px 20px -4px rgba(229, 62, 62, 0.3);
  }

  .sos-btn-idle:hover {
    box-shadow: 0 12px 24px -4px rgba(229, 62, 62, 0.4);
  }

  .sos-btn-armed {
    background: #dd6b20;
    box-shadow: 0 8px 20px -4px rgba(221, 107, 32, 0.3);
  }

  .sos-btn-active {
    background: #e53e3e;
    box-shadow: 0 8px 20px -4px rgba(229, 62, 62, 0.4);
  }

  .sos-timer {
    font-family: 'JetBrains Mono', monospace;
    font-size: 17px;
    font-weight: 500;
    color: #e53e3e;
    letter-spacing: 0.02em;
  }

  .sos-pings-label {
    font-size: 12px;
    color: #718096;
    margin-top: 8px;
  }

  .sos-idle-note {
    font-size: 13px;
    color: #718096;
    text-align: center;
    line-height: 1.6;
    max-width: 380px;
  }

  /* ── Location display ──────────────────────── */
  .loc-box {
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.25rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #4a5568;
    line-height: 2;
  }

  .loc-box-val { 
    color: #1a1f36; 
    font-weight: 500; 
    font-size: 12px;
  }

  .loc-box-live { 
    color: #e53e3e; 
    font-size: 12px;
  }

  /* ── Signal bars ───────────────────────────── */
  .signal-bars {
    display: flex;
    gap: 4px;
    align-items: flex-end;
    height: 24px;
  }

  .signal-bar {
    width: 6px;
    border-radius: 3px;
    background: #e53e3e;
    transition: opacity 0.2s ease;
  }

  /* ── Ping log ──────────────────────────────── */
  .ping-log {
    max-height: 200px;
    overflow-y: auto;
  }

  .ping-entry {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 0.6rem 0;
    border-bottom: 1px solid #edf2f7;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #718096;
  }

  .ping-entry:last-child { border-bottom: none; }

  .ping-ok { color: #38a169; }

  /* ── ID Card ───────────────────────────────── */
  .id-card {
    background: linear-gradient(135deg, #1a1f36 0%, #2d3748 100%);
    border-radius: 24px;
    padding: 2rem;
    color: #ffffff;
    max-width: 400px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
    transition: all 0.2s ease;
  }

  .id-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 25px 30px -5px rgba(0,0,0,0.15);
  }

  .id-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }

  .id-card-logo {
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #fc8181;
    letter-spacing: 0.03em;
  }

  .id-card-sub {
    font-size: 10px;
    color: rgba(255,255,255,0.4);
    margin-top: 4px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .id-card-blood {
    background: #e53e3e;
    border-radius: 12px;
    padding: 6px 16px;
    text-align: center;
  }

  .id-card-blood-label {
    font-size: 10px;
    color: rgba(255,255,255,0.8);
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .id-card-blood-val {
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.2;
    color: #ffffff;
  }

  .id-card-name {
    font-family: 'Inter', sans-serif;
    font-size: 17px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 1.5rem;
    letter-spacing: -0.01em;
  }

  .id-card-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .id-card-field {
    background: rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 0.8rem;
    border: 1px solid rgba(255,255,255,0.1);
  }

  .id-card-field-label {
    font-size: 10px;
    color: rgba(255,255,255,0.5);
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .id-card-field-val {
    font-size: 12px;
    color: rgba(255,255,255,0.9);
    line-height: 1.4;
  }

  .id-card-contact {
    background: rgba(229, 62, 62, 0.2);
    border: 1px solid rgba(229, 62, 62, 0.3);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .id-card-contact-label {
    font-size: 10px;
    color: #fc8181;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .id-card-contact-name {
    font-size: 13px;
    color: rgba(255,255,255,0.9);
    font-weight: 600;
  }

  .id-card-contact-phone {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: #9ae6b4;
    font-weight: 500;
    margin-top: 4px;
  }

  .id-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .id-card-scan-note {
    font-size: 10px;
    color: rgba(255,255,255,0.3);
    max-width: 140px;
    line-height: 1.5;
  }

  .id-card-qr {
    background: #ffffff;
    padding: 8px;
    border-radius: 8px;
  }

  /* ── Profile completeness ──────────────────── */
  .profile-progress {
    height: 8px;
    background: #edf2f7;
    border-radius: 999px;
    overflow: hidden;
    margin: 1rem 0 0.5rem;
  }

  .profile-progress-bar {
    height: 100%;
    border-radius: 999px;
    transition: width 0.5s ease;
  }

  /* ── QR section ────────────────────────────── */
  .qr-box {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    padding: 2.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  }

  .qr-note {
    font-size: 13px;
    color: #718096;
    text-align: center;
  }

  /* ── Chip preview ──────────────────────────── */
  .chip-preview {
    background: linear-gradient(135deg, #ebf4ff 0%, #e6f0ff 100%);
    border-radius: 24px;
    padding: 2rem;
    color: #1a1f36;
    min-height: 200px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    border: 1px solid #cbd5e0;
    transition: all 0.2s ease;
  }

  .chip-preview:hover {
    transform: translateY(-2px);
    border-color: #e53e3e;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
  }

  .chip-preview-logo {
    font-size: 11px;
    font-weight: 600;
    color: #3182ce;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 1rem;
  }

  .chip-preview-name {
    font-family: 'Inter', sans-serif;
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 8px;
    color: #1a1f36;
  }

  .chip-preview-blood {
    display: inline-block;
    background: #e53e3e;
    border-radius: 8px;
    padding: 2px 14px;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 1rem;
    color: #ffffff;
  }

  .chip-preview-info {
    font-size: 12px;
    color: #4a5568;
    line-height: 2;
  }

  /* ── Stat boxes ────────────────────────────── */
  .stat-box {
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.25rem;
    text-align: center;
  }

  .stat-val {
    font-family: 'JetBrains Mono', monospace;
    font-size: 17px;
    color: #e53e3e;
    font-weight: 500;
  }

  .stat-label {
    font-size: 11px;
    color: #718096;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    margin-top: 4px;
  }

  /* ── Raw data block ────────────────────────── */
  .raw-data {
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.5rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #2d3748;
    overflow-x: auto;
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* ── Buttons ───────────────────────────────── */
  .btn {
    padding: 0.9rem 1.8rem;
    border-radius: 12px;
    border: none;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn:hover {
    transform: translateY(-1px);
  }

  .btn:active {
    transform: translateY(0);
  }

  .btn-primary-red {
    background: #e53e3e;
    color: #ffffff;
    width: 100%;
  }

  .btn-primary-red:hover {
    background: #c53030;
    box-shadow: 0 4px 12px rgba(229, 62, 62, 0.3);
  }

  .btn-primary-green {
    background: #38a169;
    color: #ffffff;
    width: 100%;
  }

  .btn-primary-green:hover {
    background: #2f855a;
    box-shadow: 0 4px 12px rgba(56, 161, 105, 0.3);
  }

  .btn-outline {
    background: transparent;
    color: #4a5568;
    border: 1px solid #e2e8f0;
    width: 100%;
  }

  .btn-outline:hover {
    background: #f7fafc;
    color: #1a1f36;
    border-color: #cbd5e0;
  }

  .btn-outline-red {
    background: transparent;
    color: #e53e3e;
    border: 1.5px solid #fc8181;
    width: 100%;
  }

  .btn-outline-red:hover {
    background: #fff5f5;
    border-color: #e53e3e;
  }

  .btn-ghost {
    background: transparent;
    color: #a0aec0;
    width: 100%;
    margin-top: 0.5rem;
    font-size: 13px;
  }

  .btn-ghost:hover {
    background: #f7fafc;
    color: #4a5568;
  }

  .btn-sm {
    flex: 1;
    padding: 0.7rem 1.2rem;
    font-size: 12px;
  }

  /* ── Overlay ───────────────────────────────── */
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .overlay-box {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 24px;
    padding: 2.5rem;
    max-width: 440px;
    width: 100%;
    text-align: center;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
  }

  .overlay-title {
    font-family: 'Inter', sans-serif;
    font-size: 17px;
    font-weight: 700;
    margin-bottom: 1rem;
    color: #1a1f36;
  }

  .overlay-desc {
    font-size: 13px;
    color: #718096;
    line-height: 1.7;
    margin-bottom: 2rem;
  }

  .cdown-bar-wrap {
    height: 4px;
    background: #edf2f7;
    border-radius: 99px;
    overflow: hidden;
    margin: 1.5rem 0;
  }

  .cdown-bar {
    height: 100%;
    background: #e53e3e;
    border-radius: 99px;
    animation: countdown-bar 3s linear forwards;
  }

  @keyframes countdown-bar {
    from { width: 100%; }
    to { width: 0%; }
  }

  /* ── Use Cases Card (What If Scenarios) ───── */
  .use-cases-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    padding: 2.5rem;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  }

  .use-cases-title {
    font-family: 'Inter', sans-serif;
    font-size: 17px;
    font-weight: 700;
    color: #1a1f36;
    margin-bottom: 2rem;
    letter-spacing: -0.01em;
  }

  .use-case-item {
    display: flex;
    gap: 1.5rem;
    padding: 1rem 0;
    border-bottom: 1px solid #edf2f7;
  }

  .use-case-item:last-child { 
    border-bottom: none; 
  }

  .use-case-number {
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #e53e3e;
    min-width: 36px;
  }

  .use-case-text {
    font-size: 13px;
    color: #4a5568;
    line-height: 1.6;
  }

  .use-case-text strong {
    color: #1a1f36;
    font-weight: 600;
  }

  /* ── Col stacks ────────────────────────────── */
  .col-stack { 
    display: flex; 
    flex-direction: column; 
    gap: 1.5rem; 
  }

  @media (max-width: 768px) {
    .two-col { 
      grid-template-columns: 1fr !important; 
    }
    
    .ehub-body {
      padding: 1.5rem 1rem;
    }
    
    .page-title h1 {
      font-size: 20px;
    }
  }
`;

export default function EmergencyHub() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({});
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const res = await emergencyProfileAPI.get();
        if (res.success && res.data) setProfile(res.data);
      } catch (err) {
        console.error('Failed to load emergency profile:', err);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const userName = profile.displayName || user?.name || profile.name || 'Your Name';

  const [mainTab, setMainTab] = useState('id');
  const [activeSubTab, setActiveSubTab] = useState('card');

  // SOS state
  const [phase, setPhase] = useState('idle');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState(null);
  const [pingCount, setPingCount] = useState(0);
  const [pingLog, setPingLog] = useState([]);
  const [lastPing, setLastPing] = useState(null);
  const [battery, setBattery] = useState(null);
  const [signalStrength, setSignal] = useState(4);
  const [duration, setDuration] = useState(0);
  const [countdown, setCountdown] = useState(3);

  const intervalRef = useRef(null);
  const durationRef = useRef(null);
  const countdownRef = useRef(null);
  const pingRef = useRef(0);
  const audioCtxRef = useRef(null);
  const sirenIntervalRef = useRef(null);

  // SOS siren using Web Audio API — no external files needed
  const startSiren = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      let high = true;
      const playTone = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = high ? 1400 : 900;
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
        high = !high;
      };
      playTone();
      sirenIntervalRef.current = setInterval(playTone, 500);
    } catch (e) {
      console.error('Audio siren error:', e);
    }
  }, []);

  const stopSiren = useCallback(() => {
    clearInterval(sirenIntervalRef.current);
    sirenIntervalRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const qrPayload = JSON.stringify({
    v: '1', app: 'RESCUE.AI', name: userName,
    bg: profile.bloodGroup || '?', med: profile.medicalConditions || 'None',
    meds: profile.medications || 'None', alg: profile.allergies || 'None',
    ec: profile.emergencyContact || 'Not set', ep: profile.emergencyPhone || 'Not set',
    rel: profile.relation || '', addr: profile.address || '',
    note: profile.notes || '', ts: new Date().toISOString().split('T')[0],
  });

  const profileComplete = profile.bloodGroup && profile.emergencyContact && profile.emergencyPhone;

  useEffect(() => {
    if ('getBattery' in navigator) {
      navigator.getBattery().then(b => {
        setBattery(Math.round(b.level * 100));
        b.addEventListener('levelchange', () => setBattery(Math.round(b.level * 100)));
      });
    }
  }, []);

  const fetchLocation = useCallback(() => new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject('GPS not available'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) }),
      err => reject(err.message),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }), []);

  // Define deactivateSOS first before it's used in writePing
  const deactivateSOS = useCallback(async (origin = 'manual') => {
    clearInterval(intervalRef.current);
    clearInterval(durationRef.current);
    clearInterval(countdownRef.current);
    intervalRef.current = null;
    stopSiren();

    if (origin === 'manual') {
      try { await sosAPI.deactivate(); }
      catch (err) { console.error('SOS deactivate failed:', err); }
    }

    setPhase(origin === 'remote' ? 'rescued' : 'idle');
    setShowDeactivate(false);
    if (origin === 'manual') setDuration(0);
    setPingCount(0);
  }, [stopSiren]);

  const writePing = useCallback(async (loc) => {
    const now = new Date().toISOString();
    const sig = Math.floor(Math.random() * 2) + 3;
    setSignal(sig);
    const pingData = {
      lat: loc?.lat ?? null, lon: loc?.lon ?? null,
      accuracy: loc?.acc ?? null, battery: battery ?? null, signal: sig,
      bloodGroup: profile.bloodGroup || 'Unknown', allergies: profile.allergies || 'None',
      medications: profile.medications || 'None', medicalConditions: profile.medicalConditions || 'None',
      emergencyContact: profile.emergencyContact || 'Not set', emergencyPhone: profile.emergencyPhone || 'Not set',
      address: profile.address || 'Not set', notes: profile.notes || '',
      pingCount: pingRef.current,
    };
    try {
      const res = await sosAPI.activate(pingData);
      if (res.success && res.data?.rescueStatus === 'resolved') {
        deactivateSOS('remote');
        return;
      }
    } catch (err) {
      console.error('SOS ping failed:', err);
    }
    setLastPing(now);
    setPingLog(prev => [{ time: now, lat: loc?.lat, lon: loc?.lon, sig }, ...prev].slice(0, 20));
  }, [profile, battery, deactivateSOS]); // Now deactivateSOS is defined before this

  const activateSOS = useCallback(async () => {
    setShowConfirm(false);
    setPhase('armed');
    startSiren();
    setDuration(0);
    setPingCount(0);
    setPingLog([]);
    pingRef.current = 0;
    let loc = null;
    try { loc = await fetchLocation(); setLocation(loc); setLocError(null); }
    catch (e) { setLocError(String(e)); }
    setPhase('active');
    pingRef.current = 1;
    setPingCount(1);
    await writePing(loc);
    intervalRef.current = setInterval(async () => {
      try {
        const freshLoc = await fetchLocation();
        setLocation(freshLoc); setLocError(null);
        pingRef.current += 1; setPingCount(c => c + 1);
        await writePing(freshLoc);
      } catch (e) {
        pingRef.current += 1; setPingCount(c => c + 1);
        await writePing(loc);
      }
    }, 10000);
    durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  }, [fetchLocation, writePing, startSiren]);

  useEffect(() => {
    if (showConfirm) {
      setCountdown(3);
      countdownRef.current = setInterval(() => {
        setCountdown(c => { if (c <= 1) { clearInterval(countdownRef.current); return 0; } return c - 1; });
      }, 1000);
    }
    return () => clearInterval(countdownRef.current);
  }, [showConfirm]);

  useEffect(() => () => {
    clearInterval(intervalRef.current);
    clearInterval(durationRef.current);
    stopSiren();
  }, [stopSiren]);

  const fmtDuration = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const isActive = phase === 'active';
  const isArmed = phase === 'armed';

  const profileFields = [
    { label: 'Blood Group', key: 'bloodGroup', required: true },
    { label: 'Emergency Contact', key: 'emergencyContact', required: true },
    { label: 'Contact Phone', key: 'emergencyPhone', required: true },
    { label: 'Allergies', key: 'allergies', required: false },
    { label: 'Medications', key: 'medications', required: false },
    { label: 'Medical Conditions', key: 'medicalConditions', required: false },
    { label: 'Relation', key: 'relation', required: false },
    { label: 'Home Address', key: 'address', required: false },
    { label: 'Notes', key: 'notes', required: false },
  ];
  const filledCount = profileFields.filter(f => profile[f.key]).length;
  const pct = Math.round((filledCount / profileFields.length) * 100);
  const progressColor = pct >= 80 ? '#38a169' : pct >= 50 ? '#dd6b20' : '#e53e3e';

  return (
    <>
      <style>{CSS}</style>
      <div className="ehub">

        {/* Confirm SOS Overlay */}
        {showConfirm && (
          <div className="overlay">
            <div className="overlay-box">
              <div className="overlay-title" style={{ color: '#e53e3e' }}>Activate SOS Beacon?</div>
              <div className="overlay-desc">
                This will continuously broadcast your live GPS location, medical profile, and emergency contacts every 10 seconds.
              </div>
              <div className="cdown-bar-wrap"><div className="cdown-bar" /></div>
              <button className="btn btn-primary-red" onClick={activateSOS}>
                Send SOS Now ({countdown}s)
              </button>
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>
                Cancel — I'm safe
              </button>
            </div>
          </div>
        )}

        {/* Deactivate Overlay */}
        {showDeactivate && (
          <div className="overlay">
            <div className="overlay-box">
              <div className="overlay-title" style={{ color: '#38a169' }}>Confirm you are safe?</div>
              <div className="overlay-desc">
                This will stop broadcasting your location and notify rescue teams that you have been found safe.
              </div>
              <button className="btn btn-primary-green" style={{ marginBottom: '0.5rem' }} onClick={() => deactivateSOS('manual')}>
                I'm safe — Stop beacon
              </button>
              <button className="btn btn-ghost" onClick={() => setShowDeactivate(false)}>
                Go back — Keep beacon ON
              </button>
            </div>
          </div>
        )}

        {/* Top Bar */}
        <div className="ehub-topbar">
          <div className="ehub-logo">
            LifeLineZero
          </div>
          <div className="ehub-topbar-right">
            {isActive && (
              <div className="status-badge badge-active">
                <span className="status-badge-dot" />
                SOS ACTIVE
              </div>
            )}
            {isArmed && (
              <div className="status-badge badge-armed">
                <span className="status-badge-dot" />
                ARMING
              </div>
            )}
            {phase === 'idle' && mainTab === 'sos' && (
              <div className="status-badge badge-idle">
                <span className="status-badge-dot" />
                STANDBY
              </div>
            )}
            {battery !== null && (
              <span className="battery-label">BATTERY {battery}%</span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="ehub-body">

          {/* Page Title */}
          <div className="page-title">
            <h1>Emergency Response System</h1>
            <p>Your digital lifeline in critical situations</p>
          </div>

          {/* Incomplete warning */}
          {!profileComplete && (
            <div className="ehub-warning">
              Your emergency profile is incomplete. Please add your blood group, emergency contact, and medical information.
            </div>
          )}

          {/* Main Tabs */}
          <div className="ehub-tabs">
            <button
              className={`ehub-tab ${mainTab === 'id' ? 'tab-active' : ''}`}
              onClick={() => setMainTab('id')}
            >
              Wearable Emergency ID
            </button>
            <button
              className={`ehub-tab ${mainTab === 'sos' ? (isActive ? 'tab-sos-active' : 'tab-active') : ''}`}
              onClick={() => setMainTab('sos')}
            >
              SOS Emergency Beacon
            </button>
          </div>

          {/* WEARABLE ID TAB */}
          {mainTab === 'id' && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div className="sub-tabs">
                {[
                  { id: 'card', label: 'ID Card' },
                  { id: 'qr', label: 'QR Code' },
                  { id: 'chip', label: 'Wearable Chip' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveSubTab(t.id)}
                    className={`sub-tab ${activeSubTab === t.id ? 'sub-tab-active' : ''}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ID Card sub-tab */}
              {activeSubTab === 'card' && (
                <div className="two-col">
                  <div className="col-stack">
                    <div className="heading-sm" style={{ color: '#718096', marginBottom: '0.5rem' }}>
                      CARD PREVIEW
                    </div>
                    <div className="id-card">
                      <div className="id-card-header">
                        <div>
                          <div className="id-card-logo">RESCUE.AI</div>
                          <div className="id-card-sub">Emergency ID</div>
                        </div>
                        <div className="id-card-blood">
                          <div className="id-card-blood-label">Blood</div>
                          <div className="id-card-blood-val">{profile.bloodGroup || '?'}</div>
                        </div>
                      </div>
                      <div className="id-card-name">{userName}</div>
                      <div className="id-card-grid">
                        {[
                          { label: 'Allergies', value: profile.allergies || 'None' },
                          { label: 'Medications', value: profile.medications || 'None' },
                          { label: 'Conditions', value: profile.medicalConditions || 'None' },
                          { label: 'Address', value: profile.address || 'Not set' },
                        ].map(f => (
                          <div key={f.label} className="id-card-field">
                            <div className="id-card-field-label">{f.label}</div>
                            <div className="id-card-field-val">{f.value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="id-card-contact">
                        <div className="id-card-contact-label">Emergency Contact</div>
                        <div className="id-card-contact-name">
                          {profile.emergencyContact || 'Not set'}
                          {profile.relation && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}> ({profile.relation})</span>}
                        </div>
                        <div className="id-card-contact-phone">{profile.emergencyPhone || 'No phone set'}</div>
                      </div>
                      <div className="id-card-footer">
                        <div className="id-card-scan-note">Scan QR for complete emergency profile</div>
                        <div className="id-card-qr">
                          <QRCodeSVG value={qrPayload} size={60} level="M" />
                        </div>
                      </div>
                    </div>
                    <button className="btn btn-outline" onClick={() => window.print()}>
                      Print Card
                    </button>
                  </div>

                  <div className="card">
                    <div className="section-label">Profile Completeness</div>
                    {profileFields.map(f => (
                      <div key={f.key} className="data-row">
                        <div>
                          <span className="data-label">{f.label}</span>
                          {f.required && <span style={{ fontSize: '10px', color: '#e53e3e', marginLeft: 8, fontWeight: 600 }}>REQUIRED</span>}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: profile[f.key] ? '#38a169' : '#a0aec0' }}>
                          {profile[f.key] ? '✓' : '—'}
                        </span>
                      </div>
                    ))}
                    <div style={{ marginTop: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: 8 }}>
                        <span style={{ color: '#718096' }}>Completeness</span>
                        <span style={{ color: progressColor, fontWeight: 600 }}>{pct}%</span>
                      </div>
                      <div className="profile-progress">
                        <div className="profile-progress-bar" style={{ width: `${pct}%`, background: progressColor }} />
                      </div>
                      <p className="body-text-small" style={{ marginTop: 8 }}>
                        {pct >= 80 ? 'Your ID is rescue-ready.' : 'Add more information for best results.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* QR Code sub-tab */}
              {activeSubTab === 'qr' && (
                <div className="two-col">
                  <div className="col-stack">
                    <div className="qr-box">
                      <QRCodeSVG value={qrPayload} size={220} level="H" includeMargin={false} />
                      <div className="qr-note">Works offline · Scan with any phone camera</div>
                      <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
                          Print QR
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ flex: 1, background: '#f0fff4', color: '#38a169', border: '1px solid #9ae6b4' }}
                          onClick={() => {
                            const svg = document.querySelector('svg');
                            const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = 'rescue-ai-emergency-qr.svg';
                            a.click();
                          }}
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-label">Data Encoded in QR</div>
                    {[
                      { label: 'Blood Group', value: profile.bloodGroup },
                      { label: 'Allergies', value: profile.allergies },
                      { label: 'Medications', value: profile.medications },
                      { label: 'Conditions', value: profile.medicalConditions },
                      { label: 'Emergency Contact', value: profile.emergencyContact },
                      { label: 'Phone', value: profile.emergencyPhone },
                      { label: 'Relation', value: profile.relation },
                      { label: 'Address', value: profile.address },
                      { label: 'Notes', value: profile.notes },
                    ].map(f => (
                      <div key={f.label} className="data-row">
                        <span className="data-label">{f.label}</span>
                        <span className="data-val" style={{ color: f.value ? '#1a1f36' : '#a0aec0' }}>
                          {f.value || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Wearable Chip sub-tab */}
              {activeSubTab === 'chip' && (
                <div className="two-col">
                  <div className="col-stack">
                    <div className="chip-preview">
                      <div className="chip-preview-logo">RESCUE.AI NFC Chip</div>
                      <div className="chip-preview-name">{userName}</div>
                      <div className="chip-preview-blood">{profile.bloodGroup || '?'}</div>
                      <div className="chip-preview-info">
                        <div>Emergency: {profile.emergencyPhone || 'No contact set'}</div>
                        <div>Allergies: {profile.allergies || 'None listed'}</div>
                      </div>
                    </div>
                    <div className="card">
                      <div className="section-label">How It Works</div>
                      {[
                        'Print the QR code and laminate it',
                        'Wear as wristband or attach to ID card',
                        'Rescuers scan with any phone camera',
                        'Emergency profile loads instantly',
                        'Works completely offline',
                      ].map((t, i) => (
                        <div key={i} style={{ padding: '0.75rem 0', borderBottom: '1px solid #edf2f7', fontSize: '13px', color: '#4a5568' }}>
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card">
                    <div className="section-label">Raw Chip Data</div>
                    <div className="raw-data">
                      {JSON.stringify(JSON.parse(qrPayload), null, 2)}
                    </div>
                    <button
                      className="btn btn-outline"
                      style={{ marginTop: '1rem' }}
                      onClick={() => { navigator.clipboard.writeText(qrPayload); alert('Profile data copied'); }}
                    >
                      Copy Raw Data
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SOS BEACON TAB */}
          {mainTab === 'sos' && (
            <div style={{ animation: 'fadeIn 0.3s ease', maxWidth: 800, margin: '0 auto' }}>

              {/* SOS Button */}
              <div className="sos-wrap">
                <div className="sos-hint">
                  {isActive ? 'Tap to deactivate beacon' : 'Tap to activate emergency beacon'}
                </div>

                <div className="sos-btn-container">
                  {isActive && (
                    <>
                      <div className="sos-ring" />
                      <div className="sos-ring" />
                      <div className="sos-ring" />
                    </>
                  )}
                  <button
                    className={`sos-btn ${isActive ? 'sos-btn-active' : isArmed ? 'sos-btn-armed' : 'sos-btn-idle'}`}
                    onClick={() => {
                      if (isActive) setShowDeactivate(true);
                      else if (phase === 'idle') setShowConfirm(true);
                    }}
                    disabled={isArmed}
                  >
                    {isActive ? 'STOP' : isArmed ? 'ARMING' : 'SOS'}
                  </button>
                </div>

                {isActive && (
                  <div style={{ textAlign: 'center' }}>
                    <div className="sos-timer">{fmtDuration(duration)}</div>
                    <div className="sos-pings-label">
                      Beacon active · {pingCount} signal{pingCount !== 1 ? 's' : ''} sent
                    </div>
                  </div>
                )}

                {phase === 'idle' && (
                  <div className="sos-idle-note">
                    Only activate in a genuine emergency.<br />
                    Your location will be shared with rescue teams.
                  </div>
                )}
              </div>

              {/* Active panels */}
              {isActive && (
                <div className="col-stack">
                  <div className="card card-red">
                    <div className="section-label">Live Transmission Status</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                      <div className="stat-box">
                        <div className="stat-val">{pingCount}</div>
                        <div className="stat-label">Pings Sent</div>
                      </div>
                      <div className="stat-box">
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                          <div className="signal-bars">
                            {[1, 2, 3, 4].map(i => (
                              <div
                                key={i}
                                className="signal-bar"
                                style={{ height: `${i * 5 + 5}px`, opacity: i <= signalStrength ? 1 : 0.15 }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="stat-label">Signal Strength</div>
                      </div>
                    </div>
                    <div className="loc-box">
                      {location ? (
                        <>
                          <div>LATITUDE <span className="loc-box-val">{location.lat.toFixed(6)}</span></div>
                          <div>LONGITUDE <span className="loc-box-val">{location.lon.toFixed(6)}</span></div>
                          <div>ACCURACY <span className="loc-box-val">{location.acc}m</span></div>
                        </>
                      ) : locError ? (
                        <div style={{ color: '#dd6b20' }}>GPS Error: {locError}</div>
                      ) : (
                        <div style={{ color: '#a0aec0' }}>Acquiring GPS signal...</div>
                      )}
                      <div style={{ marginTop: 12, color: '#718096' }}>
                        Last ping: <span className="loc-box-live">{fmtTime(lastPing)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="section-label">Medical Data Being Broadcast</div>
                    {[
                      ['Blood Group', profile.bloodGroup || 'Unknown'],
                      ['Allergies', profile.allergies || 'None'],
                      ['Medications', profile.medications || 'None'],
                      ['Medical Conditions', profile.medicalConditions || 'None'],
                      ['Emergency Contact', profile.emergencyContact || 'Not set'],
                      ['Emergency Phone', profile.emergencyPhone || 'Not set'],
                    ].map(([l, v]) => (
                      <div key={l} className="data-row">
                        <span className="data-label">{l}</span>
                        <span className="data-val" style={{ color: v === 'Unknown' || v === 'Not set' ? '#e53e3e' : '#1a1f36' }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  <div className="card">
                    <div className="section-label">Ping Log</div>
                    <div className="ping-log">
                      {pingLog.length === 0 && (
                        <div className="mono-text" style={{ color: '#a0aec0', padding: '0.5rem 0' }}>
                          Waiting for first ping...
                        </div>
                      )}
                      {pingLog.map((p, i) => (
                        <div key={i} className="ping-entry">
                          <span className="ping-ok">✓</span>
                          <span>{fmtTime(p.time)}</span>
                          <span>{p.lat ? `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}` : 'GPS unavailable'}</span>
                          <span style={{ marginLeft: 'auto', color: '#e53e3e' }}>SIG:{p.sig}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button className="btn btn-outline-red" onClick={() => setShowDeactivate(true)}>
                    Deactivate Beacon — I Am Safe
                  </button>
                </div>
              )}

              {/* Rescued Success State */}
              {phase === 'rescued' && (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <div className="heading-xl" style={{ color: '#38a169', marginBottom: '1.5rem' }}>Rescue Confirmed</div>
                  <div className="body-text-large" style={{ color: '#4a5568', marginBottom: '2rem' }}>
                    Command center has marked you as rescued.
                    Help is either on-site or you have been safely evacuated.
                  </div>
                  <button className="btn btn-primary-green" style={{ maxWidth: 300, margin: '0 auto' }} onClick={() => setPhase('idle')}>
                    Back to Dashboard
                  </button>
                </div>
              )}

              {/* Idle panels */}
              {phase === 'idle' && (
                <div className="col-stack">
                  <div className="card">
                    <div className="section-label">Your Emergency Profile</div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div className="heading-md" style={{ marginBottom: '0.5rem' }}>
                        {userName}
                      </div>
                      <div style={{ display: 'inline-block', background: '#e53e3e', borderRadius: 8, padding: '4px 16px', fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                        {profile.bloodGroup || 'Blood group not set'}
                      </div>
                    </div>
                    {[
                      ['Allergies', profile.allergies],
                      ['Medications', profile.medications],
                      ['Emergency Contact', profile.emergencyContact],
                      ['Emergency Phone', profile.emergencyPhone],
                    ].map(([l, v]) => (
                      <div key={l} className="data-row">
                        <span className="data-label">{l}</span>
                        <span className={`data-val ${!v ? 'data-val-empty' : ''}`}>{v || 'Not set'}</span>
                      </div>
                    ))}
                  </div>

                  
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}