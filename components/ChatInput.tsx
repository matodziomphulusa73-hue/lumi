
import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Loader2, FileText, Paperclip } from 'lucide-react';

interface Props {
  onSendMessage: (text: string, file?: { data: string; mimeType: string; name?: string }) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<Props> = ({ onSendMessage, disabled }) => {
  const [input, setInput] = useState('');
  const [file, setFile] = useState<{ data: string; mimeType: string; preview?: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if ((!input.trim() && !file) || disabled) return;
    onSendMessage(input.trim(), file ? { data: file.data, mimeType: file.mimeType } : undefined);
    setInput('');
    setFile(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      const isImage = selectedFile.type.startsWith('image/');
      setFile({
        data: base64,
        mimeType: selectedFile.type,
        preview: isImage ? (event.target?.result as string) : undefined,
        name: selectedFile.name
      });
    };
    reader.readAsDataURL(selectedFile);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-3 shadow-2xl transition-all focus-within:border-cyan-500/50">
      {file && (
        <div className="relative inline-block m-2 group">
          {file.preview ? (
            <img src={file.preview} alt="Upload preview" className="h-24 w-24 object-cover rounded-2xl border border-slate-700 shadow-lg" />
          ) : (
            <div className="h-24 w-24 bg-slate-800 rounded-2xl border border-slate-700 flex flex-col items-center justify-center p-2 text-center shadow-lg">
              <FileText size={28} className="text-cyan-400 mb-1" />
              <span className="text-[10px] text-slate-400 truncate w-full px-1 font-medium">{file.name}</span>
            </div>
          )}
          <button
            onClick={() => setFile(null)}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-xl hover:bg-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
      
      <div className="flex items-end gap-3 px-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-3 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-2xl transition-all"
          title="Upload image or document"
          disabled={disabled}
        >
          <Paperclip size={22} />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.txt"
          className="hidden"
        />
        
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Lumi..."
          rows={1}
          className="flex-1 bg-transparent border-none focus:ring-0 text-slate-100 placeholder-slate-600 py-3 resize-none scrollbar-hide text-[15px] font-medium"
          disabled={disabled}
        />

        <button
          onClick={handleSend}
          disabled={(!input.trim() && !file) || disabled}
          className={`p-3 rounded-2xl transition-all shadow-xl active:scale-95 ${
            (!input.trim() && !file) || disabled
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-cyan-500/20'
          }`}
        >
          {disabled ? <Loader2 size={22} className="animate-spin" /> : <Send size={22} />}
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
