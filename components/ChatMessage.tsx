
import React from 'react';
import { Role, Message } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import { User, Brain, FileText, Download } from 'lucide-react';

interface Props {
  message: Message;
}

const ChatMessage: React.FC<Props> = ({ message }) => {
  const isModel = message.role === Role.MODEL;

  // Handle optional mimeType and data in MessagePart's inlineData
  const renderFilePart = (inlineData: { mimeType?: string; data?: string }) => {
    // If there is no base64 data, we cannot render anything.
    if (!inlineData.data) return null;
    
    const isImage = inlineData.mimeType?.startsWith('image/');
    
    if (isImage) {
      return (
        <div className="mb-4">
          <img 
            src={`data:${inlineData.mimeType};base64,${inlineData.data}`} 
            alt="Uploaded content" 
            className="max-h-96 rounded-2xl shadow-2xl border border-slate-700/50"
          />
        </div>
      );
    }

    // Generic file display for non-image types or missing mimeType
    return (
      <div className="mb-4 flex items-center gap-3 p-4 bg-slate-900/60 rounded-2xl border border-slate-700/50 hover:bg-slate-900 transition-colors group">
        <div className="w-12 h-12 rounded-xl bg-cyan-600/20 flex items-center justify-center text-cyan-400">
          <FileText size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-200 truncate">Document Attached</p>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">{inlineData.mimeType?.split('/')[1] || 'FILE'}</p>
        </div>
        <div className="text-slate-500 group-hover:text-cyan-400 transition-colors">
          <Download size={18} />
        </div>
      </div>
    );
  };

  return (
    <div className={`flex w-full gap-4 mb-8 ${isModel ? 'flex-row' : 'flex-row-reverse animate-in slide-in-from-right-2'}`}>
      <div className={`flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xl transition-transform hover:scale-110 ${
        isModel ? 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-800 text-slate-300'
      }`}>
        {isModel ? <Brain size={20} className="drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]" fill="currentColor" /> : <User size={20} />}
      </div>

      <div className={`flex flex-col max-w-[85%] sm:max-w-[80%] ${isModel ? 'items-start' : 'items-end'}`}>
        <div className={`p-5 rounded-3xl shadow-lg leading-relaxed ${
          isModel 
            ? 'bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm text-slate-100' 
            : 'bg-cyan-600/10 border border-cyan-500/20 text-slate-100'
        }`}>
          {message.parts.map((part, idx) => (
            <div key={idx} className="space-y-4">
              {part.inlineData && renderFilePart(part.inlineData)}
              {part.text && (
                <MarkdownRenderer content={part.text} />
              )}
            </div>
          ))}
        </div>
        <span className="mt-2 text-[10px] uppercase tracking-[0.2em] text-slate-600 font-black px-2">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

export default ChatMessage;
