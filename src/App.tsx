import { useState, useEffect, useRef } from 'react'
import { Download, Monitor, Music, ChevronDown, Check, RefreshCw, Folder, Link as LinkIcon, Scissors, FolderOpen, X } from 'lucide-react'
import TimeInput from './components/TimeInput'

declare global {
    interface Window {
        electronAPI: {
            checkYtDlp: () => Promise<boolean>
            updateYtDlp: () => Promise<boolean>
            selectFolder: () => Promise<string | null>
            downloadVideo: (url: string, options: any) => Promise<boolean>
            cancelDownload: () => Promise<boolean>
            onDownloadProgress: (callback: (progress: string) => void) => void
        }
    }
}

const QUALITIES = [
    { value: '1080p', label: '1080p', tag: 'FHD' },
    { value: '720p', label: '720p', tag: 'HD' },
    { value: '480p', label: '480p', tag: 'SD' },
    { value: '360p', label: '360p', tag: '' },
    { value: '240p', label: '240p', tag: '' },
    { value: '144p', label: '144p', tag: '' },
] as const;

function App() {
    const [url, setUrl] = useState('')
    const [format, setFormat] = useState<'video' | 'audio'>('video')
    const [quality, setQuality] = useState('1080p')
    const [savePath, setSavePath] = useState(() => localStorage.getItem('dba-save-path') || '')
    const [timeMode, setTimeMode] = useState(false)
    const [startTime, setStartTime] = useState('00:00:00')
    const [endTime, setEndTime] = useState('00:00:00')
    const [openFolder, setOpenFolder] = useState(true)
    const [isDownloading, setIsDownloading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState('Ready')
    const [updating, setUpdating] = useState(false)
    const [qualityOpen, setQualityOpen] = useState(false)
    const qualityRef = useRef<HTMLDivElement>(null)

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (qualityRef.current && !qualityRef.current.contains(e.target as Node)) {
                setQualityOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => {
        window.electronAPI.onDownloadProgress((data) => {
            const match = data.match(/(\d+\.?\d*)%/);
            if (match) setProgress(parseFloat(match[1]));
            if (!data.includes('%')) {
                setStatus(data.length > 40 ? data.slice(0, 37) + '...' : data);
            }
        });
    }, []);

    const handleSelectFolder = async () => {
        const path = await window.electronAPI.selectFolder();
        if (path) {
            setSavePath(path);
            localStorage.setItem('dba-save-path', path);
        }
    };

    const handleUpdate = async () => {
        setUpdating(true);
        setStatus('Updating engine...');
        try {
            await window.electronAPI.updateYtDlp();
            setStatus('Ready');
        } catch { setStatus('Update failed'); }
        finally { setUpdating(false); }
    };

    const handleDownload = async () => {
        if (!url) return;
        setIsDownloading(true);
        setProgress(0);
        setStatus('Initializing...');
        try {
            await window.electronAPI.downloadVideo(url, {
                audioOnly: format === 'audio',
                quality,
                start: timeMode ? startTime : undefined,
                end: timeMode ? endTime : undefined,
                outDir: savePath || undefined,
                openAfter: openFolder
            });
            setStatus('Complete!');
        } catch { setStatus('Cancelled'); }
        finally { setIsDownloading(false); }
    };

    const handleCancel = async () => {
        await window.electronAPI.cancelDownload();
        setIsDownloading(false);
        setProgress(0);
        setStatus('Cancelled');
    };

    return (
        <div className="app-shell select-none" style={{ color: '#e2e8f0' }}>
            {/* Animated ambient background */}
            <div className="ambient-bg">
                <div className="orb orb-1" />
                <div className="orb orb-2" />
                <div className="orb orb-3" />
            </div>

            {/* Header */}
            <header
                className="flex items-center px-6 surface-glass"
                style={{ height: 52, borderBottom: '1px solid rgba(255,255,255,0.04)', WebkitAppRegion: 'drag' } as any}
            >
                <div className="flex items-center" style={{ gap: 10 }}>
                    <div style={{
                        width: 28, height: 28,
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 10px rgba(59,130,246,0.3)',
                    }}>
                        <Download style={{ width: 14, height: 14, color: '#fff' }} />
                    </div>
                    <span className="text-[11px] font-black tracking-[0.3em] text-slate-500 uppercase">DBA Downloader</span>
                </div>
            </header>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
                <main className="max-w-xl mx-auto py-8 px-5 flex flex-col gap-8">

                    {/* ── URL + Download ── */}
                    <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Source</label>
                            {url && (
                                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider" style={{ animation: 'pulse 2s ease-in-out infinite' }}>● Link Ready</span>
                            )}
                        </div>
                        <div className="flex gap-3 items-stretch">
                            <div className="flex-1" style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    placeholder="Paste any video URL..."
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    className="input-glass w-full text-sm"
                                    style={{ height: 52, paddingLeft: 44, paddingRight: 16 }}
                                />
                                <LinkIcon style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: url ? '#3b82f6' : '#334155', transition: 'color 0.25s' }} />
                            </div>
                            {isDownloading ? (
                                <button
                                    onClick={handleCancel}
                                    className="flex items-center justify-center gap-3"
                                    style={{
                                        height: 52, minWidth: 140, fontSize: 11, letterSpacing: '0.15em',
                                        background: 'rgba(239,68,68,0.15)',
                                        border: '1px solid rgba(239,68,68,0.3)',
                                        borderRadius: 14, color: '#f87171', cursor: 'pointer',
                                        transition: 'all 0.25s',
                                        boxShadow: '0 4px 20px -4px rgba(239,68,68,0.2)',
                                        fontWeight: 900,
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.25)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                                >
                                    <X style={{ width: 18, height: 18 }} />
                                    <span className="font-black uppercase">Cancel</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleDownload}
                                    disabled={!url}
                                    className="btn-primary flex items-center justify-center gap-3"
                                    style={{ height: 52, minWidth: 140, fontSize: 11, letterSpacing: '0.15em' }}
                                >
                                    <Download style={{ width: 18, height: 18 }} />
                                    <span className="font-black uppercase">Download</span>
                                </button>
                            )}
                        </div>
                    </section>

                    {/* ── Storage ── */}
                    <section className="flex flex-col gap-3">
                        <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Storage</label>
                        <div className="flex gap-2 items-stretch">
                            <input
                                readOnly
                                value={savePath}
                                placeholder="Default Downloads"
                                className="input-glass flex-1 text-xs text-slate-400"
                                style={{ height: 44 }}
                            />
                            <button
                                onClick={handleSelectFolder}
                                className="surface-glass rounded-xl flex items-center justify-center"
                                style={{ width: 44, height: 44, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid rgba(255,255,255,0.06)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}
                            >
                                <Folder style={{ width: 16, height: 16, color: '#94a3b8' }} />
                            </button>
                        </div>
                    </section>

                    {/* ── Mode + Quality ── */}
                    <section className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-3">
                            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Format</label>
                            <div className="mode-pill flex">
                                <button onClick={() => setFormat('video')} className={format === 'video' ? 'active' : ''}>
                                    <Monitor style={{ width: 16, height: 16 }} />
                                </button>
                                <button onClick={() => setFormat('audio')} className={format === 'audio' ? 'active' : ''}>
                                    <Music style={{ width: 16, height: 16 }} />
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3">
                            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest px-1">Quality</label>
                            <div ref={qualityRef} style={{ position: 'relative', opacity: format === 'audio' ? 0.25 : 1, pointerEvents: format === 'audio' ? 'none' : 'auto' }}>
                                <button
                                    onClick={() => setQualityOpen(!qualityOpen)}
                                    className="input-glass w-full flex items-center justify-between"
                                    style={{ height: 44, padding: '0 14px', cursor: 'pointer' }}
                                >
                                    <span className="text-xs font-bold text-white" style={{ letterSpacing: '0.08em' }}>
                                        {QUALITIES.find(q => q.value === quality)?.label}
                                        {QUALITIES.find(q => q.value === quality)?.tag && (
                                            <span style={{ color: '#64748b', marginLeft: 6, fontSize: 10 }}>{QUALITIES.find(q => q.value === quality)?.tag}</span>
                                        )}
                                    </span>
                                    <ChevronDown style={{
                                        width: 14, height: 14, color: '#64748b',
                                        transition: 'transform 0.2s ease',
                                        transform: qualityOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                    }} />
                                </button>
                                {qualityOpen && (
                                    <div style={{
                                        position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                                        background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(20px)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 12, overflow: 'hidden', zIndex: 50,
                                        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                                        animation: 'fadeSlideIn 0.15s ease',
                                    }}>
                                        {QUALITIES.map((q) => (
                                            <button
                                                key={q.value}
                                                onClick={() => { setQuality(q.value); setQualityOpen(false); }}
                                                style={{
                                                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '10px 14px', border: 'none', cursor: 'pointer',
                                                    background: quality === q.value ? 'rgba(59,130,246,0.1)' : 'transparent',
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={e => { if (quality !== q.value) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = quality === q.value ? 'rgba(59,130,246,0.1)' : 'transparent'; }}
                                            >
                                                <span style={{ fontSize: 12, fontWeight: 700, color: quality === q.value ? '#60a5fa' : '#e2e8f0', letterSpacing: '0.05em' }}>
                                                    {q.label}
                                                    {q.tag && <span style={{ color: quality === q.value ? 'rgba(96,165,250,0.5)' : '#475569', marginLeft: 6, fontSize: 10, fontWeight: 600 }}>{q.tag}</span>}
                                                </span>
                                                {quality === q.value && <Check style={{ width: 14, height: 14, color: '#60a5fa' }} />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ── Advanced Panel ── */}
                    <section className="glass-card p-6 flex flex-col gap-5">
                        {/* Segment Toggle */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div style={{
                                    width: 34, height: 34, borderRadius: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.3s',
                                    background: timeMode ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                                    border: timeMode ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(255,255,255,0.04)',
                                    boxShadow: timeMode ? '0 0 12px rgba(59,130,246,0.1)' : 'none',
                                }}>
                                    <Scissors style={{ width: 15, height: 15, color: timeMode ? '#60a5fa' : '#475569' }} />
                                </div>
                                <span className="text-xs font-bold" style={{ color: timeMode ? '#fff' : '#64748b' }}>Clip Segment</span>
                            </div>
                            <label className="switch-container">
                                <input type="checkbox" checked={timeMode} onChange={(e) => setTimeMode(e.target.checked)} className="sr-only" />
                                <div className="switch-track"><div className="switch-thumb" /></div>
                            </label>
                        </div>

                        {timeMode && (
                            <div className="flex flex-col items-center gap-4 pt-2" style={{ animation: 'fadeSlideIn 0.3s ease' }}>
                                <div className="flex items-center gap-4" style={{
                                    background: 'rgba(0,0,0,0.3)',
                                    padding: '18px 24px',
                                    borderRadius: 16,
                                    border: '1px solid rgba(255,255,255,0.03)',
                                    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)',
                                }}>
                                    <TimeInput value={startTime} onChange={setStartTime} />
                                    <div style={{ width: 16, height: 2, background: '#334155', borderRadius: 2 }} />
                                    <TimeInput value={endTime} onChange={setEndTime} />
                                </div>
                                <span className="text-[9px] font-extrabold text-slate-600 uppercase tracking-[0.3em]">Start → End</span>
                            </div>
                        )}

                        {/* Divider */}
                        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />

                        {/* Auto-open */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div style={{
                                    width: 34, height: 34, borderRadius: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.3s',
                                    background: openFolder ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                                    border: openFolder ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(255,255,255,0.04)',
                                    boxShadow: openFolder ? '0 0 12px rgba(59,130,246,0.1)' : 'none',
                                }}>
                                    <FolderOpen style={{ width: 15, height: 15, color: openFolder ? '#60a5fa' : '#475569' }} />
                                </div>
                                <span className="text-xs font-bold" style={{ color: openFolder ? '#fff' : '#64748b' }}>Open on Complete</span>
                            </div>
                            <label className="switch-container">
                                <input type="checkbox" checked={openFolder} onChange={(e) => setOpenFolder(e.target.checked)} className="sr-only" />
                                <div className="switch-track"><div className="switch-thumb" /></div>
                            </label>
                        </div>
                    </section>
                </main>
            </div>

            {/* ── Footer ── */}
            <footer className="surface-glass" style={{
                padding: '20px 24px',
                borderTop: '1px solid rgba(255,255,255,0.04)',
            }}>
                <div className="max-w-xl mx-auto flex flex-col gap-4">
                    <div className="flex justify-between items-end">
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest">Engine</span>
                            <div className="flex items-center gap-2">
                                <div style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: isDownloading ? '#3b82f6' : '#4ade80',
                                    boxShadow: isDownloading ? '0 0 8px rgba(59,130,246,0.5)' : '0 0 8px rgba(74,222,128,0.4)',
                                }} className={isDownloading ? 'animate-pulse' : ''} />
                                <span className="text-sm font-semibold text-slate-300">{status}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <button
                                onClick={handleUpdate}
                                disabled={updating}
                                style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: 10, padding: '6px 14px',
                                    cursor: 'pointer', color: '#64748b',
                                    transition: 'all 0.2s', fontSize: 9,
                                    fontWeight: 800, letterSpacing: '0.15em',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                            >
                                <RefreshCw style={{ width: 11, height: 11 }} className={updating ? 'animate-spin' : ''} />
                                SYNC
                            </button>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black text-blue-500 tabular-nums leading-none">{Math.round(progress)}</span>
                                <span className="text-lg font-extrabold" style={{ color: 'rgba(59,130,246,0.35)' }}>%</span>
                            </div>
                        </div>
                    </div>
                    <div className="progress-container">
                        <div className="progress-bar" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            </footer>

            <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    )
}

export default App
