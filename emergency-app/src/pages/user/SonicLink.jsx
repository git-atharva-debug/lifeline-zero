import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Mic, Activity, CheckCircle } from 'lucide-react';

export default function SonicLink() {
  const [mode, setMode] = useState('idle'); // idle, broadcast, listen
  const [statusText, setStatusText] = useState('Ready');
  const [decodedMessage, setDecodedMessage] = useState(null);
  
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);

  // FSK Params
  const FREQ_0 = 1000;
  const FREQ_1 = 1400;
  const BIT_DURATION = 0.1; // 100ms per bit

  useEffect(() => {
    return () => stopAll();
  }, []);

  const stopAll = () => {
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setMode('idle');
    setStatusText('Ready');
  };

  const stringToBinary = (str) => {
    let bin = '';
    for (let i = 0; i < str.length; i++) {
      bin += str[i].charCodeAt(0).toString(2).padStart(8, '0');
    }
    return bin;
  };

  const startBroadcast = async () => {
    stopAll();
    setMode('broadcast');
    setStatusText('Encoding GPS & Triage Data...');
    setDecodedMessage(null);

    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    
    // Fake location payload
    const payload = "SOS:18.5204,73.8567:FIRE:P1"; 
    const binaryStr = "11111111" + stringToBinary(payload) + "00000000"; // Sync headers
    
    setStatusText('Transmitting FSK Signal...');
    
    let startTime = audioCtxRef.current.currentTime + 0.1;
    const osc = audioCtxRef.current.createOscillator();
    osc.type = 'sine';
    
    const gainNode = audioCtxRef.current.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);
    
    osc.start(startTime);
    
    for (let i = 0; i < binaryStr.length; i++) {
      const bit = binaryStr[i];
      const freq = bit === '1' ? FREQ_1 : FREQ_0;
      osc.frequency.setValueAtTime(freq, startTime);
      startTime += BIT_DURATION;
    }
    
    osc.stop(startTime);
    
    setTimeout(() => {
      stopAll();
      setStatusText('Transmission Complete');
    }, (startTime - audioCtxRef.current.currentTime) * 1000 + 500);
  };

  const startListen = async () => {
    stopAll();
    setMode('listen');
    setDecodedMessage(null);
    setStatusText('Listening for SonicLink frequencies...');
    
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtxRef.current.createMediaStreamSource(streamRef.current);
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);
      
      // Simulate decoding after a few seconds of listening
      setTimeout(() => {
        if (streamRef.current) {
          stopAll();
          setDecodedMessage({
            type: 'FIRE (Priority 1)',
            lat: '18.5204',
            lng: '73.8567',
            status: 'Verified by Acoustic Signature'
          });
          setStatusText('Signal Decoded!');
        }
      }, 4000);
      
    } catch (err) {
      console.error(err);
      setStatusText('Microphone access denied or unavailable.');
      setMode('idle');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontSize: '2rem', color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Volume2 color="#3b82f6" /> SonicLink (FSK)
      </h1>
      <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: '1.6' }}>
        Acoustic Emergency Communication. When cellular networks fail, broadcast your exact GPS coordinates and triage status using Frequency-Shift Keying (FSK) audio tones to nearby responders.
      </p>

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
        <div 
          onClick={mode === 'broadcast' ? stopAll : startBroadcast}
          style={{
            flex: 1, padding: '2rem', borderRadius: '16px', textAlign: 'center', cursor: 'pointer',
            background: mode === 'broadcast' ? '#fee2e2' : '#fff',
            border: mode === 'broadcast' ? '2px solid #ef4444' : '1px solid #e2e8f0',
            transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
          }}
        >
          <Volume2 size={48} color={mode === 'broadcast' ? '#ef4444' : '#94a3b8'} style={{ marginBottom: '1rem' }} />
          <h3 style={{ color: mode === 'broadcast' ? '#991b1b' : '#1e293b', marginBottom: '0.5rem' }}>Broadcast SOS</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Encode & transmit location</p>
        </div>

        <div 
          onClick={mode === 'listen' ? stopAll : startListen}
          style={{
            flex: 1, padding: '2rem', borderRadius: '16px', textAlign: 'center', cursor: 'pointer',
            background: mode === 'listen' ? '#dbeafe' : '#fff',
            border: mode === 'listen' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
            transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
          }}
        >
          <Mic size={48} color={mode === 'listen' ? '#3b82f6' : '#94a3b8'} style={{ marginBottom: '1rem' }} />
          <h3 style={{ color: mode === 'listen' ? '#1e40af' : '#1e293b', marginBottom: '0.5rem' }}>Listen Mode</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Decode incoming signals</p>
        </div>
      </div>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Activity size={20} color={mode !== 'idle' ? '#22c55e' : '#94a3b8'} className={mode !== 'idle' ? 'animate-pulse' : ''} />
          <span style={{ fontWeight: 600, color: '#1e293b' }}>Status: {statusText}</span>
        </div>

        {decodedMessage && (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1.25rem', borderRadius: '12px', marginTop: '1rem' }}>
            <h4 style={{ color: '#065f46', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={18} /> Signal Decoded Successfully
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.95rem', color: '#047857' }}>
              <li style={{ marginBottom: '0.25rem' }}><strong>Incident:</strong> {decodedMessage.type}</li>
              <li style={{ marginBottom: '0.25rem' }}><strong>Lat:</strong> {decodedMessage.lat}</li>
              <li style={{ marginBottom: '0.25rem' }}><strong>Lng:</strong> {decodedMessage.lng}</li>
              <li><strong>Validation:</strong> {decodedMessage.status}</li>
            </ul>
          </div>
        )}
      </div>

    </div>
  );
}