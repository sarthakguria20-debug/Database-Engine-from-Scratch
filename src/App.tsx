import React, { useState, useEffect } from 'react';
import { Database, HardDrive, RefreshCw, Trash2, Save, Terminal, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [data, setData] = useState<Record<string, string>>({});
  const [walLogs, setWalLogs] = useState<string[]>([]);
  const [keyInput, setKeyInput] = useState('');
  const [valInput, setValInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      const [kvRes, walRes] = await Promise.all([
        fetch('/api/kv'),
        fetch('/api/wal')
      ]);
      const kvJson = await kvRes.json();
      const walJson = await walRes.json();
      
      if (kvJson.success) setData(kvJson.data);
      if (walJson.success) setWalLogs(walJson.logs);
    } catch (e) {
      console.error('Fetch error:', e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handlePut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setLoading(true);
    try {
      await fetch(`/api/kv/${encodeURIComponent(keyInput)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: valInput }),
      });
      setKeyInput('');
      setValInput('');
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await fetch(`/api/kv/${encodeURIComponent(key)}`, { method: 'DELETE' });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCompact = async () => {
    const isConfirmed = window.confirm("Are you sure you want to compact the WAL? This will take a snapshot of the current state and discard historical logs.");
    if (!isConfirmed) return;

    try {
      await fetch('/api/actions/compact', { method: 'POST' });
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredData = Object.entries(data).filter(([k, v]) => 
    k.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans p-4 sm:p-8 selection:bg-cyan-900 selection:text-cyan-50">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-950 rounded-lg shrink-0">
              <Database className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-medium tracking-tight text-neutral-100">Log-Structured DB</h1>
              <p className="text-sm font-mono text-neutral-500">Node.js + Write-Ahead Log</p>
            </div>
          </div>
          
          <button 
            onClick={handleCompact}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-sm font-medium rounded-md border border-neutral-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            Compact WAL
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main KV Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Input Form */}
            <form onSubmit={handlePut} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                <Save className="w-4 h-4" /> Insert / Update
              </h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text"
                  placeholder="Key"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cyan-700 transition-colors font-mono"
                  disabled={loading}
                />
                <input 
                  type="text"
                  placeholder="Value"
                  value={valInput}
                  onChange={(e) => setValInput(e.target.value)}
                  className="flex-[2] bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cyan-700 transition-colors font-mono"
                  disabled={loading}
                />
                <button 
                  type="submit" 
                  disabled={loading || !keyInput}
                  className="bg-cyan-900 hover:bg-cyan-800 text-cyan-50 px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Write
                </button>
              </div>
            </form>

            {/* KV Viewer */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-[500px]">
              <div className="border-b border-neutral-800 p-4 flex items-center justify-between bg-neutral-900 shrink-0">
                <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                  <HardDrive className="w-4 h-4" /> MemTable (Live)
                </h2>
                <div className="relative hidden sm:block">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input 
                    type="text" 
                    placeholder="Search keys..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-1.5 bg-neutral-950 border border-neutral-800 rounded-md text-xs font-mono focus:outline-none focus:border-cyan-700 transition-colors w-48"
                  />
                </div>
              </div>
              
              <div className="overflow-y-auto flex-1 p-4">
                <AnimatePresence>
                  {filteredData.length === 0 ? (
                    <motion.div 
                      key="empty-state"
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                      className="text-center text-neutral-500 py-12 font-mono text-sm"
                    >
                      Empty memory table
                    </motion.div>
                  ) : (
                    <div className="space-y-2">
                      {filteredData.map(([k, v]) => (
                        <motion.div 
                          key={k}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="flex items-center justify-between group bg-neutral-950 border border-neutral-800 p-3 rounded-lg hover:border-neutral-700 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 overflow-hidden">
                            <span className="font-mono text-cyan-400 text-sm truncate max-w-[150px] shrink-0">{k}</span>
                            <span className="font-mono text-neutral-300 text-sm truncate">{v}</span>
                          </div>
                          <button 
                            onClick={() => handleDelete(k)}
                            className="bg-neutral-900 sm:opacity-0 sm:group-hover:opacity-100 p-2 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded transition-all shrink-0 border border-neutral-800 sm:border-transparent"
                            title="Delete Key"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* WAL Viewer */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col shadow-sm h-[500px] lg:h-auto overflow-hidden">
            <div className="border-b border-neutral-800 p-4 shrink-0 flex items-center justify-between">
              <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4" /> WAL View
              </h2>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto bg-[#0a0a0a] font-mono text-xs space-y-1.5 custom-scrollbar break-all relative">
              {walLogs.length === 0 ? (
                <div className="text-neutral-600 italic">No operations recorded.</div>
              ) : (
                walLogs.map((log, i) => {
                  try {
                    const parsed = JSON.parse(log);
                    return (
                      <div key={i} className="flex gap-3 px-2 py-1.5 hover:bg-neutral-900 rounded border border-transparent hover:border-neutral-800 transition-colors">
                        <span className="text-neutral-600 shrink-0">{String(i + 1).padStart(3, '0')}</span>
                        <span className={parsed.op === 'DEL' ? 'text-red-400 shrink-0' : 'text-green-400 shrink-0'}>
                          [{parsed.op}]
                        </span>
                        <span className="text-cyan-200 shrink-0 max-w-[100px] sm:max-w-none truncate" title={parsed.key}>{parsed.key}</span>
                        {parsed.value !== undefined && (
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="text-neutral-600 shrink-0">→</span>
                            <span className="text-neutral-400 truncate" title={parsed.value}>{parsed.value}</span>
                          </div>
                        )}
                      </div>
                    );
                  } catch (e) {
                    return <div key={i} className="text-red-500 px-2 py-1">Corrupted log entry at line {i}</div>;
                  }
                })
              )}
            </div>
            
            <div className="p-3 border-t border-neutral-800 shrink-0 bg-neutral-900 flex items-center justify-between">
              <span className="text-xs text-neutral-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500/50 animate-pulse"></span>
               {walLogs.length} disk entrie{walLogs.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-neutral-600 font-mono">wal.log</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
