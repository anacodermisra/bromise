import React, { useState, useEffect, useRef } from 'react';
import type { Category, AIMessage, AIConfig } from '../../types';
import {
  executeBroCommand,
  getStoredAIConfig,
  saveStoredAIConfig,
  testLocalAIConnection,
  getActiveAIModelInfo,
} from '../../services/aiService';
import confetti from 'canvas-confetti';
import {
  Send,
  Mic,
  MicOff,
  Sparkles,
  X,
  CheckCircle2,
  Cpu,
  Wifi,
  Key,
  ExternalLink,
  Bot,
  Flame,
  Dumbbell,
  BookOpen,
} from 'lucide-react';

interface BroAIAssistantProps {
  categories: Category[];
  selectedDate: string;
  onDataChanged: () => void;
}

export const BroAIAssistant: React.FC<BroAIAssistantProps> = ({
  categories,
  selectedDate,
  onDataChanged,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'config'>('chat');
  const [inputQuery, setInputQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Config state
  const [aiConfig, setAiConfig] = useState<AIConfig>(getStoredAIConfig());
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Active Model Info
  const modelInfo = getActiveAIModelInfo(aiConfig);

  // Messages state
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content:
        "Yo, I'm **Bro Bot**! You can talk to me naturally in everyday English (e.g. *\"I finished my workout\"*, *\"delete the reading task\"*, *\"reschedule chemistry to tomorrow\"*), or type direct commands like `add task [name] in [category] assign today`.\n\nType `help` anytime for full command syntax!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleConfigChange = () => setAiConfig(getStoredAIConfig());
    window.addEventListener('bromise-ai-config-change', handleConfigChange);
    return () => window.removeEventListener('bromise-ai-config-change', handleConfigChange);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Voice Recognition via Web Speech API
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your command.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputQuery(transcript);
          handleSendCommand(transcript);
        }
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Send Command
  const handleSendCommand = async (overrideText?: string) => {
    const query = (overrideText || inputQuery).trim();
    if (!query || isProcessing) return;

    const userMsg: AIMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsProcessing(true);

    try {
      const result = await executeBroCommand(query, categories, selectedDate);

      if (result.actionTaken === 'completed_task' || result.actionTaken === 'added_task') {
        confetti({
          particleCount: 60,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#00f0ff', '#8b5cf6', '#10b981'],
        });
      }

      const botMsg: AIMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: result.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionsExecuted: result.actionTaken ? [result.actionTaken] : undefined,
      };

      setMessages(prev => [...prev, botMsg]);
      onDataChanged();
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: `Something went sideways: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Test Connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testLocalAIConnection(aiConfig);
      setTestResult(res);
      if (res.ok) {
        saveStoredAIConfig(aiConfig);
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleUpdateConfig = (patch: Partial<AIConfig>) => {
    const next = { ...aiConfig, ...patch };
    setAiConfig(next);
    saveStoredAIConfig(next);
  };

  return (
    <>
      {/* Floating Tactical Launcher Pill (hidden while drawer is open) */}
      {!isOpen && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 animate-fade-in">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center space-x-2.5 px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-full bg-dark-900/95 hover:bg-dark-850 text-white border border-dark-750 hover:border-theme-accent/60 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:scale-105 active:scale-95"
            title="Open Bro Bot Command Center"
          >
            {/* Active Model Indicator Dot */}
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  modelInfo.isCloud ? 'bg-emerald-400' : 'bg-cyan-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  modelInfo.isCloud ? 'bg-emerald-500' : 'bg-cyan-500'
                }`}
              />
            </span>

            <Bot className="w-4 h-4 text-theme-accent group-hover:rotate-12 transition-transform" />
            <span className="text-xs font-black tracking-wider uppercase font-sans">Bro Bot</span>

            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-dark-950 border border-dark-800 text-dark-300">
              {modelInfo.modelName}
            </span>
          </button>
        </div>
      )}

      {/* Main Slide-out Assistant Modal / Drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-end justify-end sm:p-5 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={e => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className="w-full sm:w-[460px] md:w-[480px] h-[90dvh] sm:h-[620px] max-h-[calc(100dvh-0.5rem)] sm:max-h-[min(650px,calc(100dvh-2.5rem))] bg-dark-900 border border-dark-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Mobile Top Drag Indicator */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-dark-900">
              <div className="w-10 h-1 rounded-full bg-dark-750" />
            </div>

            {/* Header */}
            <div className="p-3.5 sm:p-4 border-b border-dark-800 bg-dark-900/90 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-theme-accent/15 border border-theme-accent/30 flex items-center justify-center text-theme-accent flex-shrink-0">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5 sm:space-x-2">
                    <h3 className="text-xs sm:text-sm font-black text-theme-title font-sans">Bro Bot</h3>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-full border truncate max-w-[130px] sm:max-w-none ${
                        modelInfo.isCloud
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      }`}
                    >
                      {modelInfo.modelName}
                    </span>
                  </div>
                  <p className="text-[10px] text-dark-400 font-mono hidden sm:block truncate">{modelInfo.statusText}</p>
                </div>
              </div>

              {/* Tabs Switcher & Close */}
              <div className="flex items-center space-x-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'chat'
                      ? 'bg-theme-accent text-white shadow-sm'
                      : 'text-dark-400 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  Console
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('config')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'config'
                      ? 'bg-theme-accent text-white shadow-sm'
                      : 'text-dark-400 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  Config
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl text-dark-400 hover:text-white hover:bg-dark-850 transition-colors ml-1"
                  title="Close Bro Bot"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tab: Chat & Action Console */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0 bg-dark-950/40">
                {/* Quick Action Suggestion Chips */}
                <div className="p-2 sm:p-2.5 border-b border-dark-800/80 bg-dark-900/60 overflow-x-auto flex items-center space-x-2 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => handleSendCommand('Daily battle plan')}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-dark-850 hover:bg-theme-accent/20 text-dark-300 hover:text-theme-accent border border-dark-750 text-[10px] font-bold transition-all flex items-center space-x-1.5"
                  >
                    <Flame className="w-3 h-3 text-amber-400" />
                    <span>Battle Brief</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendCommand("Today's gym split")}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-dark-850 hover:bg-cyan-500/20 text-dark-300 hover:text-cyan-300 border border-dark-750 text-[10px] font-bold transition-all flex items-center space-x-1.5"
                  >
                    <Dumbbell className="w-3 h-3 text-cyan-400" />
                    <span>Gym Routine</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendCommand('list tasks')}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-dark-850 hover:bg-purple-500/20 text-dark-300 hover:text-purple-300 border border-dark-750 text-[10px] font-bold transition-all flex items-center space-x-1.5"
                  >
                    <BookOpen className="w-3 h-3 text-purple-400" />
                    <span>List Targets</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendCommand('clear completed')}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-dark-850 hover:bg-emerald-500/20 text-dark-300 hover:text-emerald-300 border border-dark-750 text-[10px] font-bold transition-all flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Clear Done</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendCommand('help')}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-dark-850 hover:bg-rose-500/20 text-dark-300 hover:text-rose-300 border border-dark-750 text-[10px] font-bold transition-all flex items-center space-x-1.5"
                  >
                    <Sparkles className="w-3 h-3 text-rose-400" />
                    <span>Commands Help</span>
                  </button>
                </div>

                {/* Message Log */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0">
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-theme-accent text-white font-semibold rounded-br-none'
                            : 'bg-dark-850 border border-dark-800 text-dark-200 rounded-bl-none shadow-sm'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{msg.content}</div>

                        {/* Executed Action Badge */}
                        {msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-dark-750 flex items-center space-x-1.5 text-[10px] font-bold text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Action executed automatically</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-dark-500 mt-1 px-1 font-mono">{msg.timestamp}</span>
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="flex items-center space-x-2 text-dark-400 text-xs italic p-2">
                      <Sparkles className="w-3.5 h-3.5 animate-spin text-theme-accent" />
                      <span>Bro Bot reasoning...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Bar with safe bottom padding on mobile */}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleSendCommand();
                  }}
                  className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-dark-900 border-t border-dark-800 flex items-center space-x-2"
                >
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    className={`p-2 rounded-xl transition-colors ${
                      isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-dark-800 text-dark-400 hover:text-white'
                    }`}
                    title="Speak command"
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <input
                    type="text"
                    value={inputQuery}
                    onChange={e => setInputQuery(e.target.value)}
                    placeholder='Ask in plain English or type "add...", "mark...", "remove..."'
                    className="flex-1 bg-dark-950 border border-dark-800 text-xs rounded-xl px-3.5 py-2.5 text-white placeholder-dark-500 focus:outline-none focus:border-theme-accent font-sans"
                  />

                  <button
                    type="submit"
                    disabled={!inputQuery.trim() || isProcessing}
                    className="p-2.5 rounded-xl bg-theme-accent text-white hover:bg-theme-accent/90 disabled:opacity-40 disabled:hover:bg-theme-accent transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* Tab: AI Model & Provider Configuration */}
            {activeTab === 'config' && (
              <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs bg-dark-950/40">
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-theme-title font-sans flex items-center space-x-2">
                    <Cpu className="w-4 h-4 text-theme-accent" />
                    <span>Bro Bot Intelligence Settings</span>
                  </h4>
                  <p className="text-[11px] text-dark-400 leading-relaxed">
                    Configure Google Gemini for cloud reasoning across mobile & desktop, or use local Ollama or built-in offline NLP rules.
                  </p>
                </div>

                {/* Active Model Summary Card */}
                <div className="p-3.5 rounded-2xl bg-dark-900 border border-dark-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-dark-400 uppercase tracking-wider block">
                      Active Engine
                    </span>
                    <div className="text-sm font-bold text-theme-title">{modelInfo.providerName}</div>
                    <div className="text-[11px] font-mono text-theme-accent">{modelInfo.modelName}</div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block text-[10px] px-2.5 py-1 rounded-full font-bold border ${
                        modelInfo.isCloud
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-dark-800 text-dark-300 border-dark-700'
                      }`}
                    >
                      {modelInfo.isCloud ? 'Cloud Online' : 'Local / Offline'}
                    </span>
                  </div>
                </div>

                {/* Provider Selector */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-dark-300 block mb-1">Select Engine Provider</label>
                    <select
                      value={aiConfig.provider}
                      onChange={e => handleUpdateConfig({ provider: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900 border border-dark-800 text-xs text-white"
                    >
                      <option value="gemini">Google Gemini (Multi-device Cloud · Recommended)</option>
                      <option value="ollama">Ollama (Local Laptop on localhost:11434)</option>
                      <option value="lmstudio">LM Studio / LocalAI (Local server on port 1234)</option>
                      <option value="offline">Fast Offline NLP Rule Engine (Zero setup)</option>
                    </select>
                  </div>

                  {/* Gemini Specific Settings */}
                  {aiConfig.provider === 'gemini' && (
                    <div className="p-4 rounded-2xl bg-dark-900 border border-theme-accent/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-theme-accent flex items-center space-x-1.5">
                          <Key className="w-3.5 h-3.5" />
                          <span>Google Gemini API Key</span>
                        </span>
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-theme-accent hover:underline flex items-center space-x-1"
                        >
                          <span>Get Free Key</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>

                      <input
                        type="password"
                        value={aiConfig.apiKey || ''}
                        onChange={e => handleUpdateConfig({ apiKey: e.target.value })}
                        placeholder="Paste your Gemini API key (AIzaSy...)"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-dark-800 text-xs text-white font-mono focus:outline-none focus:border-theme-accent"
                      />

                      <div>
                        <label className="text-[11px] font-semibold text-dark-300 block mb-1">
                          Gemini Model Variant
                        </label>
                        <select
                          value={aiConfig.geminiModel || 'gemini-1.5-flash'}
                          onChange={e => handleUpdateConfig({ geminiModel: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-dark-800 text-xs text-white"
                        >
                          <option value="gemini-1.5-flash">gemini-1.5-flash (Fast, Low Latency, Free Tier)</option>
                          <option value="gemini-2.0-flash">gemini-2.0-flash (Next-Gen High Speed)</option>
                          <option value="gemini-1.5-pro">gemini-1.5-pro (High Reasoning Depth)</option>
                        </select>
                      </div>

                      <p className="text-[10px] text-dark-400">
                        Keys are stored securely in your browser's localStorage. Any device you use can run Bro Bot seamlessly.
                      </p>
                    </div>
                  )}

                  {/* Ollama Specific Settings */}
                  {aiConfig.provider === 'ollama' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-dark-300 block mb-1">Ollama Endpoint URL</label>
                        <input
                          type="text"
                          value={aiConfig.endpointUrl}
                          onChange={e => handleUpdateConfig({ endpointUrl: e.target.value })}
                          placeholder="http://localhost:11434"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900 border border-dark-800 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-dark-300 block mb-1">Model Name</label>
                        <input
                          type="text"
                          value={aiConfig.model}
                          onChange={e => handleUpdateConfig({ model: e.target.value })}
                          placeholder="llama3.2 or mistral"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900 border border-dark-800 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* LM Studio Specific Settings */}
                  {aiConfig.provider === 'lmstudio' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-bold text-dark-300 block mb-1">LM Studio URL</label>
                        <input
                          type="text"
                          value={aiConfig.endpointUrl}
                          onChange={e => handleUpdateConfig({ endpointUrl: e.target.value })}
                          placeholder="http://localhost:1234/v1"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900 border border-dark-800 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Test Connection Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      className="w-full py-2.5 rounded-xl bg-theme-accent/20 hover:bg-theme-accent/30 text-theme-accent border border-theme-accent/40 font-bold text-xs transition-colors flex items-center justify-center space-x-2"
                    >
                      {isTesting ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                      <span>Test Engine Connection</span>
                    </button>
                  </div>

                  {testResult && (
                    <div
                      className={`p-3 rounded-xl border text-[11px] ${
                        testResult.ok
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {testResult.message}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className="w-full py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-white font-bold text-xs transition-colors"
                >
                  Return to Console
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
