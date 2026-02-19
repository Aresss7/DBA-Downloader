import { useState, useEffect, useRef } from 'react'
import { Download, Monitor, Music, ChevronDown, Check, RefreshCw, Folder, Link as LinkIcon, Scissors, FolderOpen, X, Shield, Info, Crown, ExternalLink } from 'lucide-react'
import TimeInput from './components/TimeInput'

declare global {
    interface Window {
        electronAPI: {
            checkYtDlp: () => Promise<boolean>
            updateYtDlp: () => Promise<boolean>
            selectFolder: () => Promise<string | null>
            downloadVideo: (url: string, options: any) => Promise<boolean>
            cancelDownload: () => Promise<boolean>
            fetchVideoInfo: (url: string) => Promise<{ audioLangs: { code: string; name: string; formatId: string; isAudioOnly: boolean }[]; debug: string }>
            getSetting: (key: string) => Promise<any>
            setSetting: (key: string, value: any) => Promise<boolean>
            openExternal: (url: string) => Promise<boolean>
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

const LANG_TO_COUNTRY: Record<string, string> = {
    ru: 'ru', en: 'gb', 'en-us': 'us', 'en-gb': 'gb', uk: 'ua', ja: 'jp', ko: 'kr', zh: 'cn',
    de: 'de', fr: 'fr', es: 'es', it: 'it', pt: 'br', 'pt-pt': 'pt', tr: 'tr',
    ar: 'sa', hi: 'in', pl: 'pl', cs: 'cz', nl: 'nl', sv: 'se',
    da: 'dk', fi: 'fi', no: 'no', el: 'gr', hu: 'hu', ro: 'ro',
    th: 'th', vi: 'vn', id: 'id', ms: 'my', he: 'il', bg: 'bg',
    sk: 'sk', hr: 'hr', sr: 'rs', lt: 'lt', lv: 'lv', et: 'ee',
    ka: 'ge', az: 'az', kk: 'kz', uz: 'uz', ta: 'in', te: 'in',
    ml: 'in', bn: 'bd', 'zh-hans': 'cn', 'zh-hant': 'tw',
    am: 'et', jv: 'id', so: 'so', zu: 'za', ga: 'ie', ur: 'pk',
    bs: 'ba', gu: 'in', eu: 'es', mt: 'mt', sq: 'al', hy: 'am',
    is: 'is', km: 'kh', si: 'lk', sl: 'si', cy: 'gb', ps: 'af',
    my: 'mm', sw: 'ke', af: 'za', ne: 'np', lo: 'la', mn: 'mn',
    mk: 'mk', gl: 'es', ca: 'es', eo: 'eu', la: 'va',
    pa: 'in', mr: 'in', kn: 'in', or: 'in', as: 'in',
    ky: 'kg', tg: 'tj', tk: 'tm', tt: 'ru', be: 'by',
    ha: 'ng', ig: 'ng', yo: 'ng', rw: 'rw', mg: 'mg',
    ny: 'mw', sn: 'zw', st: 'za', xh: 'za', ts: 'za',
    fil: 'ph', tl: 'ph', ceb: 'ph', haw: 'us', sm: 'ws',
    mi: 'nz', sd: 'pk', ku: 'iq', fy: 'nl', lb: 'lu',
    gd: 'gb', co: 'fr', ht: 'ht', hmn: 'la',
};

function langFlagUrl(code: string): string {
    const country = LANG_TO_COUNTRY[code] || LANG_TO_COUNTRY[code.slice(0, 2)];
    if (country) return `https://flagcdn.com/24x18/${country}.png`;
    return '';
}

function App() {
    const [url, setUrl] = useState('')
    const [format, setFormat] = useState<'video' | 'audio'>('video')
    const [quality, setQuality] = useState('1080p')
    const [savePath, setSavePath] = useState('')
    const [timeMode, setTimeMode] = useState(false)
    const [startTime, setStartTime] = useState('00:00:00')
    const [endTime, setEndTime] = useState('00:00:00')
    const [openFolder, setOpenFolder] = useState(true)
    const [isDownloading, setIsDownloading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState('Ready')
    const [updating, setUpdating] = useState(false)
    const [qualityOpen, setQualityOpen] = useState(false)
    const [disclaimerAccepted, setDisclaimerAccepted] = useState(false)
    const [settingsLoaded, setSettingsLoaded] = useState(false)
    const [showAbout, setShowAbout] = useState(false)
    const qualityRef = useRef<HTMLDivElement>(null)
    const [audioLangs, setAudioLangs] = useState<{ code: string; name: string; formatId: string; isAudioOnly: boolean }[]>([])
    const [showLangModal, setShowLangModal] = useState(false)
    const [_fetchingInfo, setFetchingInfo] = useState(false)
    const [selectedLangCode, setSelectedLangCode] = useState<string | null>(null)
    const [showPremium, setShowPremium] = useState(false)

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

    // Load settings from file on startup
    useEffect(() => {
        (async () => {
            const accepted = await window.electronAPI.getSetting('disclaimerAccepted');
            const savedPath = await window.electronAPI.getSetting('savePath');
            const savedFormat = await window.electronAPI.getSetting('format');
            const savedQuality = await window.electronAPI.getSetting('quality');
            const savedTimeMode = await window.electronAPI.getSetting('timeMode');
            const savedOpenFolder = await window.electronAPI.getSetting('openFolder');
            if (accepted) setDisclaimerAccepted(true);
            if (savedPath) setSavePath(savedPath);
            if (savedFormat) setFormat(savedFormat);
            if (savedQuality) setQuality(savedQuality);
            if (savedTimeMode !== null && savedTimeMode !== undefined) setTimeMode(!!savedTimeMode);
            if (savedOpenFolder !== null && savedOpenFolder !== undefined) setOpenFolder(!!savedOpenFolder);
            setSettingsLoaded(true);
        })();
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
            await window.electronAPI.setSetting('savePath', path);
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

    const startDownload = async (audioFormatId?: string, audioFormatIsAudioOnly?: boolean, audioLang?: string) => {
        setSelectedLangCode(audioLang || null);
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
                openAfter: openFolder,
                audioFormatId: audioFormatIsAudioOnly ? audioFormatId : undefined,
                audioFormatIsAudioOnly,
                audioLang: !audioFormatIsAudioOnly ? audioLang : undefined
            });
            setStatus('Complete!');
        } catch { setStatus('Cancelled'); }
        finally { setIsDownloading(false); }
    };

    const handleDownload = async () => {
        if (!url) return;
        setFetchingInfo(true);
        setStatus('Analyzing audio tracks...');
        try {
            const info = await window.electronAPI.fetchVideoInfo(url);
            console.log('[handleDownload]', info.debug);
            if (info.audioLangs.length > 1) {
                setAudioLangs(info.audioLangs);
                setShowLangModal(true);
                setFetchingInfo(false);
                setStatus('Select audio language');
                return;
            }
        } catch (e: any) {
            console.error('[handleDownload] fetchVideoInfo error:', e);
        }
        setFetchingInfo(false);
        await startDownload();
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
                <div className="flex items-center gap-2 ml-auto" style={{ WebkitAppRegion: 'no-drag' } as any}>
                    <button
                        onClick={() => setShowAbout(true)}
                        title="О программе"
                        style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    >
                        <Info style={{ width: 13, height: 13, color: '#64748b' }} />
                    </button>
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
                                <button onClick={() => { setFormat('video'); window.electronAPI.setSetting('format', 'video'); }} className={format === 'video' ? 'active' : ''}>
                                    <Monitor style={{ width: 16, height: 16 }} />
                                </button>
                                <button onClick={() => { setFormat('audio'); window.electronAPI.setSetting('format', 'audio'); }} className={format === 'audio' ? 'active' : ''}>
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
                                                onClick={() => { setQuality(q.value); setQualityOpen(false); window.electronAPI.setSetting('quality', q.value); }}
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
                                <input type="checkbox" checked={timeMode} onChange={(e) => { setTimeMode(e.target.checked); window.electronAPI.setSetting('timeMode', e.target.checked); }} className="sr-only" />
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
                                <input type="checkbox" checked={openFolder} onChange={(e) => { setOpenFolder(e.target.checked); window.electronAPI.setSetting('openFolder', e.target.checked); }} className="sr-only" />
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
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-extrabold text-slate-600 uppercase tracking-widest">Video Language</span>
                                {selectedLangCode ? (
                                    <span className="flex items-center gap-1.5">
                                        {langFlagUrl(selectedLangCode) && <img src={langFlagUrl(selectedLangCode)} alt="" style={{ width: 14, height: 10, borderRadius: 1, objectFit: 'cover' }} />}
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{selectedLangCode}</span>
                                    </span>
                                ) : (
                                    <span className="text-[8px] font-semibold" style={{ color: '#334155' }}>Default</span>
                                )}
                            </div>
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
                    <div className="flex justify-end" style={{ marginTop: 8 }}>
                        <button
                            onClick={() => setShowPremium(true)}
                            style={{
                                height: 26, borderRadius: 7, padding: '0 10px',
                                background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(234,179,8,0.03) 100%)',
                                border: '1px solid rgba(245,158,11,0.12)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                cursor: 'pointer', transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(234,179,8,0.08) 100%)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.25)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(234,179,8,0.03) 100%)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.12)'; }}
                        >
                            <Crown style={{ width: 10, height: 10, color: '#f59e0b' }} />
                            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.1em', color: '#f59e0b' }}>GET PREMIUM</span>
                        </button>
                    </div>
                </div>
            </footer>

            {/* ── Language Selection Modal ── */}
            {showLangModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 999,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 24,
                }}>
                    <div style={{
                        maxWidth: 520, width: '100%',
                        background: 'rgba(15,23,42,0.97)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 20, padding: '32px 28px',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                        animation: 'fadeSlideIn 0.3s ease',
                    }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                            <div className="flex items-center gap-3">
                                <div style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    background: 'rgba(59,130,246,0.1)',
                                    border: '1px solid rgba(59,130,246,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Music style={{ width: 18, height: 18, color: '#60a5fa' }} />
                                </div>
                                <div>
                                    <div className="text-sm font-black text-white">Выберите язык аудио</div>
                                    <div className="text-[10px] font-bold text-slate-500">Обнаружено {audioLangs.length} дорожек</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowLangModal(false)}
                                style={{
                                    width: 28, height: 28, borderRadius: 8,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: 'none', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                <X style={{ width: 14, height: 14, color: '#64748b' }} />
                            </button>
                        </div>

                        <p className="text-[11px] text-slate-500" style={{ marginBottom: 20 }}>
                            Это видео имеет несколько звуковых дорожек. Выберите нужный язык:
                        </p>

                        <div className="flex flex-wrap gap-2" style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 20 }}>
                            {audioLangs.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => { setShowLangModal(false); startDownload(lang.formatId, lang.isAudioOnly, lang.code); }}
                                    className="lang-pill"
                                    style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        color: '#94a3b8',
                                    }}
                                >
                                    {langFlagUrl(lang.code) && (
                                        <img src={langFlagUrl(lang.code)} alt="" style={{ width: 20, height: 15, borderRadius: 2, objectFit: 'cover' }} />
                                    )}
                                    <span>{lang.code.toUpperCase()}</span>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => { setShowLangModal(false); startDownload(); }}
                            style={{
                                width: '100%', height: 40, borderRadius: 12,
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                color: '#64748b', cursor: 'pointer',
                                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                        >
                            Пропустить (скачать по умолчанию)
                        </button>
                    </div>
                </div>
            )}

            {/* ── Premium Modal ── */}
            {showPremium && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 999,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 24,
                }} onClick={() => setShowPremium(false)}>
                    <div style={{
                        maxWidth: 440, width: '100%',
                        background: 'rgba(15,23,42,0.97)',
                        border: '1px solid rgba(245,158,11,0.15)',
                        borderRadius: 20, padding: '32px 28px',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(245,158,11,0.05)',
                        animation: 'fadeSlideIn 0.3s ease',
                    }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                            <div className="flex items-center gap-3">
                                <div style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(234,179,8,0.05) 100%)',
                                    border: '1px solid rgba(245,158,11,0.25)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Crown style={{ width: 20, height: 20, color: '#f59e0b' }} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: 16, fontWeight: 900, color: '#f59e0b', margin: 0, letterSpacing: '-0.01em' }}>
                                        Get Premium
                                    </h2>
                                    <p style={{ fontSize: 10, color: '#64748b', margin: 0, fontWeight: 600 }}>
                                        Unlock all features
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPremium(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: 10, width: 32, height: 32,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: '#64748b', transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                            >
                                <X style={{ width: 14, height: 14 }} />
                            </button>
                        </div>

                        {/* Features */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                            {[
                                { icon: '🖥️', title: '1440p QHD Downloads', desc: 'Download videos in Quad HD quality' },
                                { icon: '🎬', title: '4K Ultra HD Downloads', desc: 'Maximum resolution for crystal-clear video' },
                                { icon: '⚡', title: 'Priority Updates', desc: 'Get early access to new features and fixes' },
                                { icon: '❤️', title: 'Support the Developer', desc: 'Help keep the project alive and growing' },
                            ].map((f, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    padding: '12px 14px', borderRadius: 12,
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                }}>
                                    <span style={{ fontSize: 20 }}>{f.icon}</span>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{f.title}</div>
                                        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>{f.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Purchase buttons */}
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={() => window.electronAPI.openExternal('https://itch.io')}
                                style={{
                                    flex: 1, height: 44, borderRadius: 12,
                                    background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(234,179,8,0.08) 100%)',
                                    border: '1px solid rgba(245,158,11,0.25)',
                                    color: '#f59e0b', cursor: 'pointer',
                                    fontSize: 11, fontWeight: 800, letterSpacing: '0.05em',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,158,11,0.25) 0%, rgba(234,179,8,0.15) 100%)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(234,179,8,0.08) 100%)'; }}
                            >
                                <ExternalLink style={{ width: 13, height: 13 }} />
                                Buy on Itch.io
                            </button>
                            <button
                                onClick={() => window.electronAPI.openExternal('https://gumroad.com')}
                                style={{
                                    flex: 1, height: 44, borderRadius: 12,
                                    background: 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(219,39,119,0.06) 100%)',
                                    border: '1px solid rgba(236,72,153,0.2)',
                                    color: '#ec4899', cursor: 'pointer',
                                    fontSize: 11, fontWeight: 800, letterSpacing: '0.05em',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(236,72,153,0.2) 0%, rgba(219,39,119,0.1) 100%)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(219,39,119,0.06) 100%)'; }}
                            >
                                <ExternalLink style={{ width: 13, height: 13 }} />
                                Buy on Gumroad
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Disclaimer Modal ── */}
            {settingsLoaded && !disclaimerAccepted && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 999,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 24,
                }}>
                    <div style={{
                        maxWidth: 480, width: '100%',
                        background: 'rgba(15,23,42,0.97)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 20, padding: '36px 32px',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                        animation: 'fadeSlideIn 0.3s ease',
                    }}>
                        <div className="flex items-center gap-3" style={{ marginBottom: 24 }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 12,
                                background: 'rgba(59,130,246,0.1)',
                                border: '1px solid rgba(59,130,246,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Shield style={{ width: 20, height: 20, color: '#60a5fa' }} />
                            </div>
                            <div>
                                <div className="text-sm font-black text-white">Лицензионное соглашение</div>
                                <div className="text-[10px] font-bold text-slate-500">и отказ от ответственности</div>
                            </div>
                        </div>

                        <div className="text-xs leading-relaxed text-slate-400" style={{ marginBottom: 28, lineHeight: 1.8 }}>
                            <p style={{ marginBottom: 16, color: '#94a3b8' }}>Вы собираетесь использовать программу <strong style={{ color: '#fff' }}>DBA Downloader</strong>. Пожалуйста, подтвердите следующее:</p>
                            <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <li>Вы обязуетесь использовать данное ПО исключительно в ознакомительных целях или для скачивания контента, на который у вас есть законные права.</li>
                                <li>Вы осознаёте, что скачивание материалов, защищённых авторским правом (фильмы, музыка, чужой коммерческий контент) без разрешения автора, может нарушать законы вашей страны и правила платформы.</li>
                                <li>Разработчик <strong style={{ color: '#94a3b8' }}>DBA Downloader</strong> не несёт ответственности за любые действия пользователя, совершённые с помощью данного инструмента.</li>
                            </ul>
                        </div>

                        <p className="text-[10px] text-slate-600 font-semibold" style={{ marginBottom: 20 }}>
                            Нажимая «Принять», вы подтверждаете своё согласие с данными условиями.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => window.close()}
                                style={{
                                    flex: 1, height: 44, borderRadius: 12,
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    color: '#64748b', cursor: 'pointer',
                                    fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                            >
                                ОТКЛОНИТЬ
                            </button>
                            <button
                                onClick={() => { window.electronAPI.setSetting('disclaimerAccepted', true); setDisclaimerAccepted(true); }}
                                className="btn-primary"
                                style={{
                                    flex: 1, height: 44, borderRadius: 12,
                                    fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
                                    cursor: 'pointer',
                                }}
                            >
                                ПРИНЯТЬ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── About Modal ── */}
            {showAbout && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 998,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 24,
                }} onClick={() => setShowAbout(false)}>
                    <div style={{
                        maxWidth: 440, width: '100%',
                        background: 'rgba(15,23,42,0.97)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 20, padding: '32px 28px',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                        animation: 'fadeSlideIn 0.3s ease',
                    }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
                            <div className="flex items-center gap-3">
                                <div style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
                                }}>
                                    <Download style={{ width: 18, height: 18, color: '#fff' }} />
                                </div>
                                <div>
                                    <div className="text-sm font-black text-white">DBA Downloader</div>
                                    <div className="text-[10px] font-bold text-slate-500">Версия 1.0.0</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAbout(false)}
                                style={{
                                    width: 28, height: 28, borderRadius: 8,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: 'none', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                <X style={{ width: 14, height: 14, color: '#64748b' }} />
                            </button>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-400" style={{ marginBottom: 20, lineHeight: 1.7 }}>
                            Десктопное приложение для скачивания видео и аудио. Поддерживает множество популярных платформ.
                        </p>

                        {/* Divider */}
                        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 16 }} />

                        {/* Troubleshooting */}
                        <div style={{ marginBottom: 20 }}>
                            <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                                <RefreshCw style={{ width: 12, height: 12, color: '#3b82f6' }} />
                                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Если не работает</span>
                            </div>
                            <ul className="text-[11px] text-slate-500" style={{ paddingLeft: 14, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <li>Убедитесь, что видео находится в открытом доступе и не имеет возрастных ограничений.</li>
                                <li>Нажмите кнопку <strong style={{ color: '#94a3b8' }}>SYNC</strong> в нижней части приложения для обновления движка.</li>
                            </ul>
                        </div>

                        {/* Divider */}
                        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 16 }} />

                        {/* Disclaimer */}
                        <div style={{ marginBottom: 20 }}>
                            <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                                <Shield style={{ width: 12, height: 12, color: '#f59e0b' }} />
                                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Дисклеймер</span>
                            </div>
                            <ul className="text-[11px] text-slate-500" style={{ paddingLeft: 14, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <li>Используйте ПО только в ознакомительных целях или для контента, на который у вас есть права.</li>
                                <li>Скачивание защищённого авторским правом материала может нарушать законы вашей страны.</li>
                                <li>Разработчик не несёт ответственности за действия пользователей.</li>
                            </ul>
                        </div>

                        {/* Divider */}
                        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 16 }} />

                        {/* Credits */}
                        <div className="text-[10px] text-slate-600" style={{ lineHeight: 1.8 }}>
                            <span className="font-bold">Powered by</span>{' '}
                            <span className="text-slate-400 font-semibold">yt-dlp</span>
                            <span className="mx-2">·</span>
                            <span className="font-bold">Built with</span>{' '}
                            <span className="text-slate-400 font-semibold">Electron + React</span>
                            <br />
                            <span className="font-bold">License:</span>{' '}
                            <span className="text-slate-400 font-semibold">MIT</span>
                        </div>
                    </div>
                </div>
            )}

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
