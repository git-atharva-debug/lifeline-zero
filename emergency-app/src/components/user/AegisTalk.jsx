import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, ShieldAlert, Camera, X } from 'lucide-react';

const SYSTEM_PROMPT = `You are AEGIS Talk, a Multi-Modal AI emergency triage assistant. 
The user is in a panic. They may send text, or text AND an image of the disaster.
Analyze BOTH the text and the visual damage in the image (if provided).
Extract the incident details and output ONLY strict JSON.
If you don't have enough info, ask a very short follow-up question in the "reply" field.
If you have enough info, set "ready" to true, give a reassuring "reply", and fill the fields.

JSON SCHEMA:
{
  "reply": "String - reassuring message or short follow-up question",
  "ready": Boolean,
  "extracted": {
    "incidentType": "fire|flood|earthquake|medical|collapse|other",
    "description": "String - summarized situation, incorporating visual details if an image was analyzed",
    "priority": "low|medium|high|critical",
    "estimatedPeople": "Number"
  }
}

Rules:
- Be extremely concise.
- If an image shows severe structural damage, large fire, or immediate life threat, prioritize as 'critical'.
- Default estimatedPeople to 1 if unknown.
`;

export default function AegisTalk({ onReportSubmit }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'I am AEGIS. What is your emergency? You can also upload a photo.' }
  ]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && !selectedImage) return;

    const userText = input.trim();
    const currentImage = selectedImage;
    
    setInput('');
    setSelectedImage(null);

    setMessages(prev => [...prev, { 
      role: 'user', 
      text: userText,
      image: currentImage
    }]);
    
    setLoading(true);

    // Build History for Groq
    const history = messages.map(m => {
      if (m.role === 'ai') {
        return { role: 'assistant', content: m.text };
      } else {
        // If previous user message had an image, we only pass text to keep payload small,
        // or we can pass the image. For safety/limits, let's just pass text for history,
        // but for the CURRENT message we will pass the image.
        return { role: 'user', content: m.text || "Attached an image." };
      }
    });

    // Current message payload
    let currentUserMessage;
    let targetModel = "llama-3.3-70b-versatile"; // Default text model

    if (currentImage) {
      targetModel = "llama-3.2-11b-vision-preview"; // Vision model
      currentUserMessage = {
        role: 'user',
        content: [
          { type: 'text', text: userText || "Please analyze this emergency image." },
          { type: 'image_url', image_url: { url: currentImage } }
        ]
      };
    } else {
      currentUserMessage = {
        role: 'user',
        content: userText
      };
    }

    try {
      const key = process.env.REACT_APP_GROQ_API_KEY;
      if (!key) {
        setMessages(prev => [...prev, { role: 'ai', text: 'AEGIS is offline (Missing API Key).' }]);
        setLoading(false);
        return;
      }

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: targetModel,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...history,
            currentUserMessage
          ]
        })
      });

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error.message || "API Error");
      }
      
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        setMessages(prev => [...prev, { role: 'ai', text: parsed.reply }]);
        
        if (parsed.ready && parsed.extracted) {
          setTimeout(() => {
             onReportSubmit(parsed.extracted);
          }, 1500);
        }
      } else {
         setMessages(prev => [...prev, { role: 'ai', text: 'Connection failed. Please use the manual form.' }]);
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'ai', text: `System error: ${err.message}. Please use manual form.` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      height: '450px',
      overflow: 'hidden'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
        padding: '1rem',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldAlert size={20} color="#38bdf8" />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>AEGIS Multi-Modal Triage</h3>
        </div>
        <span style={{ fontSize: '0.75rem', background: '#38bdf822', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px' }}>
          Vision Enabled
        </span>
      </div>

      <div style={{
        flex: 1,
        padding: '1rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        background: '#f8fafc'
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'ai' ? 'flex-start' : 'flex-end',
            maxWidth: '85%',
            display: 'flex',
            flexDirection: m.role === 'ai' ? 'row' : 'row-reverse',
            gap: '0.5rem',
            alignItems: 'flex-end'
          }}>
            {m.role === 'ai' && (
              <div style={{ background: '#e2e8f0', padding: '6px', borderRadius: '50%' }}>
                <Bot size={16} color="#475569" />
              </div>
            )}
            <div style={{
              background: m.role === 'ai' ? '#fff' : '#ef4444',
              color: m.role === 'ai' ? '#1e293b' : '#fff',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: m.role === 'ai' ? '1px solid #e2e8f0' : 'none',
              fontSize: '0.95rem',
              lineHeight: 1.4,
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              {m.image && (
                <img src={m.image} alt="User upload" style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '150px', objectFit: 'cover' }} />
              )}
              {m.text && <span>{m.text}</span>}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', color: '#94a3b8', fontSize: '0.85rem', marginLeft: '2rem' }}>
            AEGIS is analyzing visual & text data...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {selectedImage && (
        <div style={{ padding: '0.5rem 1rem', background: '#f1f5f9', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ position: 'relative', width: '40px', height: '40px' }}>
            <img src={selectedImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
            <button 
              onClick={() => setSelectedImage(null)}
              style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
            >
              <X size={10} />
            </button>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Image attached for AI Vision analysis</span>
        </div>
      )}

      <form onSubmit={handleSend} style={{
        padding: '1rem',
        background: '#fff',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center'
      }}>
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleImageSelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: loading ? 'not-allowed' : 'pointer',
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Upload image for AI analysis"
        >
          <Camera size={22} />
        </button>

        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Describe your emergency..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            outline: 'none',
            fontSize: '0.95rem'
          }}
        />
        <button
          type="submit"
          disabled={loading || (!input.trim() && !selectedImage)}
          style={{
            background: '#0f172a',
            color: '#fff',
            border: 'none',
            padding: '0 1.25rem',
            borderRadius: '8px',
            cursor: loading || (!input.trim() && !selectedImage) ? 'not-allowed' : 'pointer',
            opacity: loading || (!input.trim() && !selectedImage) ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '42px'
          }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
