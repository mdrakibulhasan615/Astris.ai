import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, User, Image as ImageIcon, Trash2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import 'katex/dist/katex.min.css';

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ 
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export default function AIChat({ 
  paperId,
  onClose, 
  paperContext, 
  onCaptureScreenshot 
}: { 
  paperId: string,
  onClose: () => void, 
  paperContext: string, 
  onCaptureScreenshot?: () => Promise<string | null> 
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hi! I can help you with this paper. What do you need help with?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadChatHistory = async () => {
      if (!paperId) return;
      setIsHistoryLoading(true);
      try {
        const docRef = doc(db, 'user_papers', paperId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.chatHistory) {
            try {
              const history = JSON.parse(data.chatHistory);
              if (Array.isArray(history) && history.length > 0) {
                setMessages(history as ChatMessage[]);
                setIsHistoryLoading(false);
                return;
              }
            } catch (e) {
              console.error("Failed to parse chat history:", e);
            }
          }
        }
        // Fallback to default message
        setMessages([
          { role: 'model', text: 'Hi! I can help you with this paper. What do you need help with?' }
        ]);
      } catch (err) {
        console.error("Error loading chat history:", err);
      } finally {
        setIsHistoryLoading(false);
      }
    };
    loadChatHistory();
  }, [paperId]);

  useEffect(() => {
    if (!isHistoryLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isHistoryLoading]);

  const saveChatHistory = async (newMessages: ChatMessage[]) => {
    if (!paperId) return;
    try {
      const docRef = doc(db, 'user_papers', paperId);
      await updateDoc(docRef, {
        chatHistory: JSON.stringify(newMessages),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error saving chat history:", err);
    }
  };

  const handleClearChat = async () => {
    if (!paperId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    
    try {
      const docRef = doc(db, 'user_papers', paperId);
      await updateDoc(docRef, {
        chatHistory: null,
        updatedAt: new Date().toISOString()
      });
      setMessages([
        { role: 'model', text: 'Hi! I can help you with this paper. What do you need help with?' }
      ]);
      setConfirmDelete(false);
    } catch (err) {
      console.error("Error clearing chat history:", err);
    }
  };

  // Reset confirmation after 3 seconds
  useEffect(() => {
    if (confirmDelete) {
      const timer = setTimeout(() => setConfirmDelete(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmDelete]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input;
    setInput('');
    const updatedUserMsgs: ChatMessage[] = [...messages, { role: 'user', text: userMsg }];
    setMessages(updatedUserMsgs);
    setLoading(true);

    // Save user's message immediately
    await saveChatHistory(updatedUserMsgs);

    try {
      const ai = getAiClient();
      if (!ai) {
        const errorMsg: ChatMessage = { role: 'model', text: 'AI capabilities are currently disabled. Please add a GEMINI_API_KEY environment variable.' };
        const finalMsgs: ChatMessage[] = [...updatedUserMsgs, errorMsg];
        setMessages(finalMsgs);
        await saveChatHistory(finalMsgs);
        setLoading(false);
        return;
      }

      const history = updatedUserMsgs.map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: msg.text }]
      }));

      const chat = ai.chats.create({
        model: 'gemini-3.5-flash',
        history,
        config: {
          systemInstruction: `You are an expert tutor helping a student with an exam or past paper. The user may provide a screenshot of the current page they are looking at, which may include their annotations and the original questions. Read the screenshot to understand what question they are working on. The paper context is: ${paperContext}.
IMPORTANT: Be concise, clear, and extremely direct. If the user asks for an answer, a solution, to "do" a question, or asks a direct question (e.g. "do 3a", "solve this", "what is the answer"), DO NOT withhold the answer, play games, or try to guide them Socratic-style. Give them the direct solution and answer immediately with clear step-by-step working. Only use guidance/hints if they explicitly ask for a hint or conceptual help instead of the answer.`,
        }
      });
      
      const userParts: any[] = [{ text: userMsg }];
      if (includeScreenshot && onCaptureScreenshot) {
        const screenshot = await onCaptureScreenshot();
        if (screenshot) {
          userParts.push({ inlineData: { mimeType: 'image/jpeg', data: screenshot } });
        }
      }
      
      const response = await chat.sendMessage({ message: userParts });
      const modelResponseText = response.text || 'Sorry, I could not generate a response.';
      const finalMsgs: ChatMessage[] = [...updatedUserMsgs, { role: 'model', text: modelResponseText }];
      setMessages(finalMsgs);
      await saveChatHistory(finalMsgs);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: ChatMessage = { role: 'model', text: 'Sorry, I encountered an error. Please try again.' };
      const finalMsgs: ChatMessage[] = [...updatedUserMsgs, errorMsg];
      setMessages(finalMsgs);
      await saveChatHistory(finalMsgs);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed right-0 md:right-4 top-0 md:top-4 bottom-0 md:bottom-4 w-full sm:w-[400px] bg-white/80 dark:bg-gray-900/90 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] md:rounded-3xl border border-white/50 dark:border-gray-700/50 flex flex-col z-50 overflow-hidden font-sans">
      <div className="p-5 border-b border-gray-200/50 dark:border-gray-800/50 flex justify-between items-center bg-white/50 dark:bg-gray-800/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500 text-white p-2 rounded-xl shadow-sm">
            <Bot className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white tracking-tight">AI Tutor</h3>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleClearChat} 
            title={confirmDelete ? "Click again to confirm delete" : "Delete whole chat history"}
            className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold ${
              confirmDelete 
                ? 'bg-red-500 text-white animate-pulse shadow-sm scale-105' 
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/20 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            {confirmDelete && <span className="pr-1 text-[10px] tracking-tight">Confirm?</span>}
          </button>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full transition-all shadow-sm active:scale-95">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-gray-50/30 dark:bg-black/20">
        {isHistoryLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500 dark:text-gray-400">
            <Bot className="w-8 h-8 animate-bounce text-indigo-500" />
            <span className="text-xs font-medium font-mono">Loading previous session...</span>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`p-4 rounded-[1.25rem] max-w-[80%] shadow-sm ${msg.role === 'user' ? 'bg-indigo-500 text-white rounded-tr-sm' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'}`}>
                  <div className={`prose prose-sm max-w-none font-medium ${
                    msg.role === 'user' 
                      ? 'prose-p:text-white prose-headings:text-white prose-strong:text-white prose-ul:text-white prose-ol:text-white prose-li:text-white prose-markers:text-white marker:text-white text-white' 
                      : 'prose-p:text-gray-700 dark:prose-p:text-gray-200 prose-headings:text-gray-900 dark:prose-headings:text-white prose-strong:text-gray-900 dark:prose-strong:text-white prose-li:text-gray-700 dark:prose-li:text-gray-200 prose-ol:text-gray-700 dark:prose-ol:text-gray-200 prose-ul:text-gray-700 dark:prose-ul:text-gray-200 prose-markers:text-gray-500 dark:prose-markers:text-gray-400 marker:text-gray-500 dark:marker:text-gray-400'
                  }`}>
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-[1.25rem] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm flex items-center gap-2 shadow-sm h-12">
                  <div className="w-2 h-2 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-2 h-2 bg-indigo-500 dark:bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      <div className="p-4 border-t border-gray-200/50 dark:border-gray-800/50 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md pb-safe flex flex-col gap-2">
        {onCaptureScreenshot && (
          <button
            onClick={() => setIncludeScreenshot(!includeScreenshot)}
            className={`self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              includeScreenshot
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                : 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {includeScreenshot ? 'Current Page Attached' : 'Attach Current Page'}
          </button>
        )}
        <div className="flex gap-2 items-center bg-gray-100/80 dark:bg-gray-800/80 p-1.5 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white dark:focus-within:bg-gray-800 transition-all shadow-inner">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask for help..."
            className="flex-1 px-4 py-2.5 bg-transparent border-none focus:outline-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-medium"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50 disabled:bg-gray-400 dark:disabled:bg-gray-700 transition-all shadow-sm active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
