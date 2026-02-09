import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, Type, LiveServerMessage } from '@google/genai';
import { Role, Message, ChatSession } from './types';
import { geminiService } from './services/geminiService';
import ChatInput from './components/ChatInput';
import ChatMessage from './components/ChatMessage';
import { Plus, MessageSquare, Trash2, Menu, X, ChevronRight, Mic, MicOff, ExternalLink, Brain } from 'lucide-react';
import { APP_NAME, LIVE_MODEL, SYSTEM_INSTRUCTION, TRADINGVIEW_URL } from './constants';

// Helper functions for Live API
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Live API Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  useEffect(() => {
    const saved = localStorage.getItem('luminol_chat_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('luminol_chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, scrollToBottom]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Discussion',
      messages: [],
      updatedAt: Date.now()
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    if (currentSessionId === id) setCurrentSessionId(updated.length > 0 ? updated[0].id : null);
  };

  const handleSendMessage = async (text: string, fileData?: { data: string; mimeType: string }) => {
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      const newId = crypto.randomUUID();
      const firstSession: ChatSession = {
        id: newId,
        title: text.substring(0, 30) || 'New Discussion',
        messages: [],
        updatedAt: Date.now()
      };
      setSessions([firstSession, ...sessions]);
      setCurrentSessionId(newId);
      activeSessionId = newId;
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: Role.USER,
      parts: [...(text ? [{ text }] : []), ...(fileData ? [{ inlineData: fileData }] : [])],
      timestamp: Date.now()
    };

    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, userMsg], updatedAt: Date.now() } : s));
    setIsLoading(true);

    try {
      const modelMsgId = crypto.randomUUID();
      let streamContent = '';
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, { id: modelMsgId, role: Role.MODEL, parts: [{ text: '' }], timestamp: Date.now() }] } : s));

      const history = sessions.find(s => s.id === activeSessionId)?.messages || [];
      const stream = geminiService.streamChat(history, userMsg);
      
      for await (const chunk of stream) {
        streamContent += chunk;
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === modelMsgId ? { ...m, parts: [{ text: streamContent }] } : m) } : s));
      }

      if (history.length <= 1) {
        const title = await geminiService.generateTitle(text);
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, title } : s));
      }
    } catch (err) {
      console.error(err);
    } finally { setIsLoading(false); }
  };

  const openTradingView = () => {
    window.open(TRADINGVIEW_URL, '_blank');
    return "Opened TradingView in a new tab for Keneilwe.";
  };

  const toggleVoiceMode = async () => {
    if (isVoiceMode) {
      if (sessionRef.current) sessionRef.current.close();
      setIsVoiceMode(false);
      setIsLiveConnected(false);
      return;
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === "" || apiKey === "''") {
      alert("⚠️ Configuration Error: API_KEY is missing. Please add it to Vercel and redeploy.");
      return;
    }

    setIsVoiceMode(true);
    const ai = new GoogleGenAI({ apiKey });
    
    try {
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: LIVE_MODEL,
        callbacks: {
          onopen: () => {
            setIsLiveConnected(true);
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'openTradingView') {
                  const result = openTradingView();
                  sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result } } }));
                }
              }
            }

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const ctx = outputAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e){} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => { setIsVoiceMode(false); setIsLiveConnected(false); },
          onerror: () => { setIsVoiceMode(false); setIsLiveConnected(false); }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: [{
            name: 'openTradingView',
            parameters: { type: Type.OBJECT, properties: {} }
          }]}]
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsVoiceMode(false);
      alert("Microphone access is required for Voice Tutor.");
    }
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 overflow-hidden font-sans">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] border-r border-slate-800 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
                <Brain size={18} className="drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" fill="currentColor" />
              </div>
              {APP_NAME}
            </h1>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 text-slate-400"><X size={20} /></button>
          </div>

          <button onClick={createNewSession} className="flex items-center gap-3 w-full p-3 mb-6 bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 rounded-xl transition-all border border-cyan-500/30 font-medium">
            <Plus size={18} /> New Study Session
          </button>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {sessions.map(session => (
              <button key={session.id} onClick={() => setCurrentSessionId(session.id)} className={`group flex items-center gap-3 w-full p-3 rounded-xl transition-all text-left relative ${currentSessionId === session.id ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20' : 'hover:bg-slate-800/40 text-slate-400 border border-transparent'}`}>
                <MessageSquare size={16} className="flex-shrink-0" />
                <span className="flex-1 truncate text-sm font-medium">{session.title}</span>
                <div onClick={(e) => deleteSession(e, session.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"><Trash2 size={14} /></div>
              </button>
            ))}
          </div>
          
          <div className="mt-auto pt-4 border-t border-slate-800/60">
             <button onClick={() => window.open(TRADINGVIEW_URL, '_blank')} className="flex items-center gap-3 w-full p-3 text-cyan-400 hover:bg-cyan-400/10 rounded-xl transition-all border border-cyan-500/20 text-xs font-bold uppercase tracking-wider">
               <ExternalLink size={16} /> Open TradingView
             </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0 bg-slate-950">
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-1"><Menu size={20} /></button>}
            <h2 className="font-semibold text-slate-200 truncate">{currentSession?.title || 'Hi Keneilwe'}</h2>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleVoiceMode}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all ${isVoiceMode ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20'}`}
            >
              {isVoiceMode ? <MicOff size={16} /> : <Mic size={16} />}
              <span className="text-xs font-bold">{isVoiceMode ? 'Voice Tutor ON' : 'Start Voice Tutor'}</span>
            </button>
            <span className="text-[10px] px-2 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-bold uppercase">LUMI-3-F</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-8 custom-scrollbar relative">
          {isVoiceMode && (
            <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
               <div className="relative mb-12">
                 <div className="absolute inset-0 bg-cyan-500 blur-3xl opacity-20 animate-pulse rounded-full" />
                 <div className="relative w-32 h-32 bg-cyan-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-cyan-500/40">
                   {isLiveConnected ? <div className="flex gap-1.5"><div className="w-2 h-8 bg-white/40 rounded-full animate-wave" /><div className="w-2 h-12 bg-white rounded-full animate-wave-delayed" /><div className="w-2 h-8 bg-white/40 rounded-full animate-wave" /></div> : <Brain size={40} className="drop-shadow-[0_0_15px_rgba(255,255,255,0.9)]" fill="currentColor" />}
                 </div>
               </div>
               <h2 className="text-3xl font-black text-white mb-2">Live Voice Tutor</h2>
               <p className="text-cyan-400 font-medium mb-8 uppercase tracking-[0.2em] text-sm">Lumi is listening to Keneilwe</p>
               <div className="max-w-md bg-slate-900/50 border border-slate-800 p-6 rounded-2xl mb-12">
                  <p className="text-slate-300 text-sm leading-relaxed italic">"Hi Keneilwe, I'm your Live Forensic & Trading Tutor. Ask me anything about your UFS curriculum or market structures. I'm here to listen and help."</p>
               </div>
               <button onClick={toggleVoiceMode} className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl shadow-xl transition-all active:scale-95">Stop Session</button>
            </div>
          )}

          <div className="max-w-4xl mx-auto">
            {!currentSession || currentSession.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 animate-in fade-in slide-in-from-bottom-4">
                <div className="w-20 h-20 bg-cyan-600 rounded-3xl flex items-center justify-center text-white mb-10 shadow-2xl shadow-cyan-500/40 rotate-3 hover:rotate-0 transition-transform">
                  <Brain size={40} fill="white" className="drop-shadow-[0_0_12px_rgba(255,255,255,1)]" />
                </div>
                <h3 className="text-4xl font-black mb-4 text-white">Hi Keneilwe, I'm Lumi</h3>
                <p className="text-slate-400 max-w-lg mb-12 text-lg">Your Personal AI assistant, built just for you. How can I support your studies or analysis today?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-4">
                  {[
                    "I need to vent about my day",
                    "Analyse USD/ZAR Macro Fundamentals",
                    "UFS Genetics: Mendelian Laws",
                    "Forensic Chemistry: GC-MS Analysis",
                    "Trading Idea: Gold (XAUUSD) Analysis",
                    "Solve a Statistics problem"
                  ].map((s) => (
                    <button key={s} onClick={() => handleSendMessage(s)} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 transition-all text-left text-sm text-slate-300 group flex items-center justify-between shadow-lg">
                      <span className="font-medium">{s}</span><ChevronRight size={16} className="text-cyan-500 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {currentSession.messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)}
                {isLoading && (
                   <div className="flex w-full gap-4 mb-8">
                     <div className="w-10 h-10 rounded-full flex items-center justify-center bg-cyan-600 text-white animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                        <Brain size={20} fill="currentColor" className="drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]" />
                     </div>
                     <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700 flex gap-2"><div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" /><div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:-.15s]" /><div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:-.3s]" /></div>
                   </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        <div className="p-4 md:p-8 bg-gradient-to-t from-[#020617] via-[#020617]/90 to-transparent">
          <div className="max-w-4xl mx-auto">
            <ChatInput onSendMessage={handleSendMessage} disabled={isLoading || isVoiceMode} />
            <div className="mt-4 flex justify-center gap-6">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500" /> UFS Forensics</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Advanced Trading</span>
            </div>
          </div>
        </div>
      </main>
      <style>{`
        @keyframes wave { 0%, 100% { height: 8px; } 50% { height: 32px; } }
        @keyframes wave-delayed { 0%, 100% { height: 12px; } 50% { height: 48px; } }
        .animate-wave { animation: wave 1s ease-in-out infinite; }
        .animate-wave-delayed { animation: wave-delayed 1s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;