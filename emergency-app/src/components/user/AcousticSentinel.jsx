import React, { useState, useEffect, useRef } from 'react';
// We use window.speechCommands from CDN to bypass Webpack 5 'fs' core module errors
const speechCommands = window.speechCommands;

export default function AcousticSentinel({ onSosTrigger }) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Offline');
  const [currentWord, setCurrentWord] = useState('');
  const [confidence, setConfidence] = useState(0);
  const recognizerRef = useRef(null);

  useEffect(() => {
    // Preload the ML model when component mounts
    async function loadModel() {
      setStatus('Loading Edge ML Model...');
      // When calling `create()`, you must provide the type of the audio dataset.
      // The two available options are 'BROWSER_FFT' and 'SOFT_FFT'.
      // 'BROWSER_FFT' uses the browser's native Web Audio API.
      const recognizer = speechCommands.create('BROWSER_FFT');
      await recognizer.ensureModelLoaded();
      recognizerRef.current = recognizer;
      setStatus('Ready (Offline)');
    }
    loadModel();

    return () => {
      if (recognizerRef.current && recognizerRef.current.isListening()) {
        recognizerRef.current.stopListening();
      }
    };
  }, []);

  const startListening = async () => {
    if (!recognizerRef.current) return;
    try {
      await recognizerRef.current.listen(
        (result) => {
          const scores = result.scores;
          const labels = recognizerRef.current.wordLabels();
          
          // Find the label with the highest probability
          const maxScore = Math.max(...scores);
          const maxIndex = scores.indexOf(maxScore);
          const word = labels[maxIndex];

          setCurrentWord(word);
          setConfidence(maxScore);

          // Trigger SOS if it hears specific keywords with high confidence
          if ((word === 'help' || word === 'stop') && maxScore > 0.85) {
            if (onSosTrigger) {
               // Prevent multiple triggers rapidly
               recognizerRef.current.stopListening();
               setIsListening(false);
               setStatus('SOS TRIGGERED');
               onSosTrigger(word);
            }
          }
        },
        {
          includeSpectrogram: false,
          probabilityThreshold: 0.7,
          invokeCallbackOnNoiseAndUnknown: false,
          overlapFactor: 0.5 // listen constantly with 50% overlap
        }
      );
      setIsListening(true);
      setStatus('Active & Listening');
    } catch (e) {
      console.error(e);
      setStatus('Mic Permission Denied');
    }
  };

  const stopListening = () => {
    if (recognizerRef.current && recognizerRef.current.isListening()) {
      recognizerRef.current.stopListening();
      setIsListening(false);
      setStatus('Ready (Offline)');
    }
  };

  return (
    <div style={{
      background: 'rgba(20, 20, 25, 0.9)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '16px',
      padding: '1.5rem',
      marginTop: '1.5rem',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Pulse Effect when listening */}
      {isListening && (
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '150%', height: '150%',
          background: 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)',
          animation: 'pulse 2s infinite',
          zIndex: 0,
          pointerEvents: 'none'
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>🎙️</span> Acoustic Sentinel
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Edge-based TensorFlow.js Audio Classification
            </p>
          </div>
          <div style={{ 
            background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.2)',
            color: isListening ? '#ef4444' : '#94a3b8',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {isListening && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'blink 1s infinite' }} />}
            {status}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button 
            onClick={isListening ? stopListening : startListening}
            style={{
              background: isListening ? 'transparent' : '#ef4444',
              border: isListening ? '1px solid #ef4444' : 'none',
              color: isListening ? '#ef4444' : '#fff',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            disabled={status.includes('Loading')}
          >
            {isListening ? 'Deactivate Sentinel' : 'Activate Sentinel'}
          </button>
          
          {isListening && currentWord && currentWord !== '_background_noise_' && (
             <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
               Detected: <strong style={{ color: '#fff', fontSize: '1.1rem' }}>{currentWord}</strong> 
               <span style={{ color: '#64748b', marginLeft: '8px' }}>({(confidence * 100).toFixed(0)}%)</span>
             </div>
          )}
        </div>
        
        <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
          * Try yelling "Help" or "Stop" into the microphone to trigger an autonomous offline SOS.
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.5; }
          50% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.5; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
