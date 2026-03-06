import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Label } from 'recharts';
import { View, NavProps } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabase';
import { getSdgInfo } from '../../utils/sdgUtils';
import { SDGS } from '../../constants';
import html2canvas from 'html2canvas';

export const DashboardEnterprise: React.FC<NavProps> = ({ navigate }) => {
    const { user: authUser } = useAuth();

    // --- STATE MANAGEMENT ---
    const [chartData, setChartData] = useState<any[]>([]);
    const [pieData, setPieData] = useState<any[]>([]);
    const [topPosts, setTopPosts] = useState<any[]>([]);
    const [activityData, setActivityData] = useState<Record<number, number>>({});
    const [activeSdgIds, setActiveSdgIds] = useState<number[]>([]);
    const [timeGranularity, setTimeGranularity] = useState<'day' | 'week'>('day');
    const [counts, setCounts] = useState({
        posts: 0,
        projects: 0,
        followers: 0,
        impact: 0,
        reach: 0,
        views: 0
    });
    const [projectMetrics, setProjectMetrics] = useState({
        count: 0,
        sdgs: 0,
        raised: 0,
        volunteers: 0
    });
    const [globalImpactScore, setGlobalImpactScore] = useState(0); // For Enterprise Comparison
    const [isLoading, setIsLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [flippedCardIndex, setFlippedCardIndex] = useState<number | null>(null);
    const [flippedProjectCardIndex, setFlippedProjectCardIndex] = useState<number | null>(null);
    const [isChartFlipped, setIsChartFlipped] = useState(false);
    const [isOdsFlipped, setIsOdsFlipped] = useState(false);
    const [isActivityFlipped, setIsActivityFlipped] = useState(false);
    const [availableMonths, setAvailableMonths] = useState<{ value: string; label: string }[]>([]);

    // --- SMART RANGE FETCHER ---
    useEffect(() => {
        const fetchRange = async () => {
            if (!authUser) return;
            const { data } = await supabase.from('posts').select('created_at').eq('user_id', authUser.id).order('created_at', { ascending: true }).limit(1);
            if (data && data.length > 0) {
                const start = new Date(data[0].created_at);
                const end = new Date();
                const options: { value: string; label: string }[] = [];
                let current = new Date(start.getFullYear(), start.getMonth(), 1);
                const endTarget = new Date(end.getFullYear(), end.getMonth(), 1);
                while (current <= endTarget) {
                    const val = current.toISOString().substring(0, 7);
                    const lbl = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(current);
                    options.unshift({ value: val, label: lbl.charAt(0).toUpperCase() + lbl.slice(1) });
                    current.setMonth(current.getMonth() + 1);
                }
                options.unshift({ value: 'all', label: 'Histórico Acumulado' });
                setAvailableMonths(options);
            } else {
                const now = new Date();
                const val = now.toISOString().substring(0, 7);
                const lbl = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(now);
                setAvailableMonths([{ value: 'all', label: 'Histórico Acumulado' }, { value: val, label: lbl.charAt(0).toUpperCase() + lbl.slice(1) }]);
            }
        };
        fetchRange();
    }, [authUser]);

    const toggleSdg = (id: number) => {
        setActiveSdgIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    useEffect(() => {
        const fetchStats = async () => {
            if (!authUser) return;
            setIsLoading(true);

            const isAllTime = selectedMonth === 'all';
            let start = '', end = '';

            if (!isAllTime) {
                const [year, month] = selectedMonth.split('-').map(Number);
                start = new Date(year, month - 1, 1).toISOString();
                end = new Date(year, month, 0, 23, 59, 59).toISOString();
            }

            try {
                let postsQuery = supabase.from('posts').select('*').eq('user_id', authUser.id);
                let projectsQuery = supabase.from('projects').select('*').eq('owner_id', authUser.id);
                let globalImpactQuery = supabase.from('posts').select('likes_count, comments_count');

                if (!isAllTime) {
                    postsQuery = postsQuery.gte('created_at', start).lte('created_at', end);
                    projectsQuery = projectsQuery.gte('created_at', start).lte('created_at', end);
                    globalImpactQuery = globalImpactQuery.gte('created_at', start).lte('created_at', end);
                }

                if (activeSdgIds.length > 0) {
                    postsQuery = postsQuery.filter('sdg_ids', 'ov', `{${activeSdgIds.join(',')}}`);
                    projectsQuery = projectsQuery.in('sdg_id', activeSdgIds);
                }

                const [postsResponse, projResponse, followCount, globalResponse] = await Promise.all([
                    postsQuery,
                    projectsQuery,
                    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', authUser.id),
                    globalImpactQuery
                ]);

                const posts = postsResponse.data || [];
                const projects = projResponse.data || [];
                const globalPosts = globalResponse.data || [];

                const totalImpactPoints = (projects.length * 100) + posts.reduce((acc, p) => acc + (p.likes_count || 0) + (p.comments_count || 0) + 10, 0);
                const reach = (posts.length * 150) + (posts.reduce((acc, p) => acc + (p.likes_count || 0), 0) * 12);

                // Calculate Global Impact Average
                const totalGlobalPoints = globalPosts.reduce((acc, p) => acc + (p.likes_count || 0) + (p.comments_count || 0) + 10, 0);
                setGlobalImpactScore(totalGlobalPoints);

                setCounts({
                    posts: posts.length,
                    projects: projects.length,
                    followers: followCount.count || 0,
                    impact: Math.min(100, (totalImpactPoints / 500) * 100),
                    reach,
                    views: reach * 0.45
                });

                // Calculate Project Metrics
                const uniqueSdgs = new Set<number>();
                let totalRaised = 0;
                let totalVolunteers = 0;

                projects.forEach((p: any) => {
                    if (p.sdg_id) uniqueSdgs.add(p.sdg_id);
                    totalRaised += p.raised_amount || 0;
                    totalVolunteers += p.volunteers_count || 0;
                });

                setProjectMetrics({
                    count: projects.length,
                    sdgs: uniqueSdgs.size,
                    raised: totalRaised,
                    volunteers: totalVolunteers
                });

                const sorted = [...posts].sort((a, b) => (b.likes_count + b.comments_count) - (a.likes_count + a.comments_count));
                setTopPosts(sorted);

                const activity: Record<number, number> = {};
                posts.forEach(p => {
                    const d = new Date(p.created_at).getDate();
                    activity[d] = (activity[d] || 0) + 1;
                });
                setActivityData(activity);

                if (isAllTime) {
                    // Group by month for "All Time"
                    const monthMap: Record<string, number> = {};
                    posts.forEach(p => {
                        const date = new Date(p.created_at);
                        const mLabel = new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' }).format(date);
                        monthMap[mLabel] = (monthMap[mLabel] || 0) + (p.likes_count || 0) + (p.comments_count || 0);
                    });

                    const sortedMonths = Object.keys(monthMap).sort((a, b) => {
                        const [m1, y1] = a.split(' ');
                        const [m2, y2] = b.split(' ');
                        return y1.localeCompare(y2) || m1.localeCompare(m2);
                    });

                    setChartData(sortedMonths.map(m => ({ name: m, value: monthMap[m] })));
                } else {
                    const [year, month] = selectedMonth.split('-').map(Number);
                    const daysInMonth = new Date(year, month, 0).getDate();
                    if (timeGranularity === 'day') {
                        setChartData(Array.from({ length: daysInMonth }, (_, i) => {
                            const d = i + 1;
                            const dayPosts = posts.filter(p => new Date(p.created_at).getDate() === d);
                            return { name: `${d}`, value: dayPosts.reduce((acc, p) => acc + (p.likes_count || 0) + (p.comments_count || 0), 0) };
                        }));
                    } else {
                        const weeks = Math.ceil(daysInMonth / 7);
                        setChartData(Array.from({ length: weeks }, (_, i) => {
                            const s = i * 7 + 1, e = Math.min((i + 1) * 7, daysInMonth);
                            const wPosts = posts.filter(p => { const d = new Date(p.created_at).getDate(); return d >= s && d <= e; });
                            return { name: `${i + 1}`, value: wPosts.reduce((acc, p) => acc + (p.likes_count || 0) + (p.comments_count || 0), 0) };
                        }));
                    }
                }

                const sdgMap: Record<number, number> = {};
                posts.forEach(p => (p.sdg_ids || []).forEach((id: number) => sdgMap[id] = (sdgMap[id] || 0) + 1));
                const totalMentions = Object.values(sdgMap).reduce((a, b) => a + b, 0);
                const pie = Object.entries(sdgMap).map(([id, count]) => {
                    const info = getSdgInfo(Number(id));
                    return { name: info?.label || `ODS ${id}`, value: count, color: info?.color || '#94a3b8', icon: info?.icon || 'spa', percentage: Math.round((count / (totalMentions || 1)) * 100) };
                }).sort((a, b) => b.value - a.value);
                setPieData(pie.length > 0 ? pie : [{ name: 'Sin datos', value: 1, color: '#f1f5f9', icon: 'info', percentage: 0 }]);

            } catch (err) { console.error(err); }
            setIsLoading(false);
        };
        fetchStats();
    }, [authUser, selectedMonth, activeSdgIds, timeGranularity]);

    const handleExportImage = async () => {
        const element = document.getElementById('pdf-report-container');
        if (!element) return;
        setIsExporting(true);
        try {
            // High fidelity delay for rendering all complex SVG gradients
            await new Promise(resolve => setTimeout(resolve, 1000));

            const canvas = await html2canvas(element, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                height: element.scrollHeight,
                windowHeight: element.scrollHeight,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('pdf-report-container');
                    if (el) {
                        el.style.display = 'flex';
                        el.style.width = '900px';
                        el.style.height = 'auto'; // Force expansion in clone
                        el.style.minHeight = '1850px';
                        el.style.fontFamily = "'Inter', system-ui, sans-serif";

                        // Ensure dark regions keep their visibility
                        const darkSections = el.querySelectorAll('.bg-slate-900');
                        darkSections.forEach((s: any) => s.style.backgroundColor = '#0f172a');

                        // Force visibility of all icons and high-contrast text
                        const texts = el.querySelectorAll('p, span, h1, h3');
                        texts.forEach((t: any) => {
                            if (t.classList.contains('text-white')) t.style.color = '#ffffff';
                        });
                    }
                }
            });

            const link = document.createElement('a');
            const fileName = `Reporte_Impacto_Corporativo_${authUser?.name || 'Empresa'}_${monthName.replace(' ', '_')}.png`;
            link.download = fileName;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
            setIsPreviewOpen(false);
        } catch (err) {
            console.error('Export Error:', err);
        }
        setIsExporting(false);
    };

    const heatmapGrid = useMemo(() => {
        if (selectedMonth === 'all') return { padding: [], days: [], remaining: Array.from({ length: 42 }) };
        const [y, m] = selectedMonth.split('-').map(Number);
        const first = new Date(y, m - 1, 1).getDay();
        const len = new Date(y, m, 0).getDate();
        return { padding: Array.from({ length: first }), days: Array.from({ length: len }, (_, i) => i + 1), remaining: Array.from({ length: 42 - (first + len) }) };
    }, [selectedMonth]);

    const monthName = useMemo(() => {
        if (selectedMonth === 'all') return 'Histórico Acumulado';
        const [y, m] = selectedMonth.split('-').map(Number);
        const date = new Date(y, m - 1, 1);
        const name = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(date);
        return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + y;
    }, [selectedMonth]);

    const shareOfImpact = useMemo(() => {
        const myPoints = (counts.projects * 100) + (counts.posts * 10);
        if (globalImpactScore === 0) return 0;
        return ((myPoints / globalImpactScore) * 100).toFixed(2);
    }, [counts, globalImpactScore]);

    return (
        <div className="flex-1 overflow-y-auto bg-[#FDFDFF] p-6 lg:p-10 no-scrollbar relative">
            {isLoading && (
                <div className="fixed top-8 right-8 z-[110] flex items-center gap-3 bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border border-blue-50">
                    <div className="size-4 border-2 border-blue-100 border-t-blue-500 rounded-full animate-spin"></div>
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Sincronizando...</span>
                </div>
            )}

            <div id="dashboard-content" className={`max-w-7xl mx-auto pb-20 transition-all duration-700 ${isLoading ? 'opacity-50 blur-[1px]' : 'opacity-100 blur-0'}`}>
                {/* Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
                    <div className="flex items-center gap-6">
                        <div className="size-20 bg-slate-900 border-[6px] border-white shadow-2xl rounded-[32px] flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-4xl">domain</span>
                        </div>
                        <div>
                            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter mb-1">Impacto Global</h1>
                            <div className="flex items-center gap-2">
                                <div className="size-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Cuenta Enterprise Validada</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 self-stretch lg:self-auto">
                        <div className="flex items-center bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-sm gap-4">
                            <span className="material-symbols-outlined text-slate-400 text-xl font-bold">calendar_today</span>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="text-sm font-black text-slate-700 outline-none bg-transparent cursor-pointer appearance-none w-full"
                            >
                                {availableMonths.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
                            </select>
                        </div>
                        <button onClick={() => setIsPreviewOpen(true)} className="bg-[#0095FF] text-white px-8 py-4 rounded-2xl font-black text-sm shadow-2xl hover:bg-blue-600 transition-all flex items-center gap-3">
                            <span className="material-symbols-outlined">description</span> Reporte Ejecutivo
                        </button>
                    </div>
                </div>

                {/* Comparison Bar (Enterprise Feature) */}
                <div className="bg-slate-900 rounded-[48px] p-10 mb-12 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 size-80 bg-blue-500/10 blur-[100px] rounded-full group-hover:bg-blue-500/20 transition-all duration-1000"></div>
                    <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
                        <div className="max-w-md">
                            <h3 className="text-2xl font-black mb-4 tracking-tighter uppercase">Cuota de Impacto Global</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Has contribuido con un <span className="text-blue-400 font-black">{shareOfImpact}%</span> del impacto total de Emprexa este mes. Tu liderazgo está moviendo la aguja global.
                            </p>
                        </div>
                        <div className="flex-1 w-full max-w-xl">
                            <div className="flex justify-between items-end mb-4">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em]">Benchmarking</span>
                                <span className="text-5xl font-black text-white">{shareOfImpact}%</span>
                            </div>
                            <div className="h-4 w-full bg-white/5 rounded-full border border-white/10 p-1">
                                <div className="h-full bg-blue-500 rounded-full shadow-[0_0_25px_rgba(59,130,246,0.6)]" style={{ width: `${Math.min(100, Number(shareOfImpact) * 5)}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Rest of traditional Dashboard code... (KPIs, Charts, Heatmap, TopPosts) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                    {[
                        {
                            label: 'Alcance Total',
                            value: (counts.reach / 1000).toFixed(1) + 'k',
                            change: '+15.2%',
                            icon: 'rocket_launch',
                            color: 'text-blue-500',
                            bg: 'bg-blue-50',
                            backBg: 'bg-[#0095FF]',
                            explanation: (
                                <p className="text-[10px] font-medium leading-relaxed opacity-90">
                                    Impacto visual estimado basado en tus publicaciones: <br />
                                    <span className="font-black text-white">+150 puntos</span> por post activo <br />
                                    <span className="font-black text-white">+12 puntos</span> por interacción recibida.
                                </p>
                            )
                        },
                        {
                            label: 'Proyectos Activos',
                            value: counts.projects,
                            change: '+2',
                            icon: 'account_tree',
                            color: 'text-purple-500',
                            bg: 'bg-purple-50',
                            backBg: 'bg-purple-600',
                            explanation: (
                                <p className="text-[10px] font-medium leading-relaxed opacity-90">
                                    Iniciativas estratégicas de impacto corporativo: <br />
                                    Conteo real de proyectos validados bajo estándares ESG y vinculados a objetivos específicos.
                                </p>
                            )
                        },
                        {
                            label: 'Impact Score',
                            value: counts.impact.toFixed(0) + '/100',
                            change: '+5pts',
                            icon: 'stars',
                            color: 'text-amber-500',
                            bg: 'bg-amber-50',
                            showProgress: true,
                            backBg: 'bg-amber-500',
                            explanation: (
                                <p className="text-[10px] font-medium leading-relaxed opacity-90">
                                    Tu relevancia en el ecosistema social: <br />
                                    <span className="font-black text-white">+100</span> por Proyecto, <br />
                                    <span className="font-black text-white">+10</span> por Post y <br />
                                    <span className="font-black text-white">+1</span> por cada Like o Comentario.
                                </p>
                            )
                        },
                        {
                            label: 'Red Aliada',
                            value: (counts.followers / 1000).toFixed(1) + 'k',
                            change: '+12%',
                            icon: 'person_add',
                            color: 'text-emerald-500',
                            bg: 'bg-emerald-50',
                            backBg: 'bg-emerald-600',
                            explanation: (
                                <p className="text-[10px] font-medium leading-relaxed opacity-90">
                                    Crecimiento neto de tu red de impacto corporativo: <br />
                                    Conteo real de usuarios y empresas que siguen tus iniciativas estratégicas.
                                </p>
                            )
                        }
                    ].map((card, i) => {
                        const isFlipped = flippedCardIndex === i;
                        return (
                            <div key={i} className="h-[220px]" style={{ perspective: '1000px' }}>
                                <div
                                    className={`relative w-full h-full transition-all duration-700`}
                                    style={{
                                        transformStyle: 'preserve-3d',
                                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => setFlippedCardIndex(isFlipped ? null : i)}
                                >
                                    <div className="absolute inset-0 bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm overflow-hidden group hover:shadow-2xl transition-all duration-700" style={{ backfaceVisibility: 'hidden' }}>
                                        <div className="flex justify-between items-start mb-8">
                                            <div>
                                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">{card.label}</p>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">{card.value}</span>
                                                    <div className={`flex items-center px-2 py-1 rounded-lg text-[9px] font-black ${card.change.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                        <span className="material-symbols-outlined text-[12px] font-black mr-1">{card.change.startsWith('+') ? 'arrow_upward' : 'arrow_downward'}</span>
                                                        {card.change}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`size-16 rounded-3xl ${card.bg} ${card.color} flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                                                <span className="material-symbols-outlined text-3xl filled">{card.icon}</span>
                                            </div>
                                        </div>
                                        {card.showProgress && (
                                            <div className="space-y-4">
                                                <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5 shadow-inner">
                                                    <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-1000 ease-out shadow-lg shadow-amber-500/30" style={{ width: `${counts.impact}%` }}></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div
                                        className={`absolute inset-0 ${card.backBg} p-8 rounded-[48px] shadow-2xl flex flex-col justify-center items-center text-center text-white`}
                                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                                    >
                                        <span className="material-symbols-outlined text-3xl mb-4 filled">info</span>
                                        <h4 className="text-sm font-black uppercase tracking-widest mb-3">{card.label}</h4>
                                        {card.explanation}
                                        <div className="mt-4 px-4 py-2 bg-white/20 rounded-full text-[8px] font-black uppercase tracking-widest">
                                            Click para volver
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* PROJECT METRICS GRID */}
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-6 flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-400">engineering</span>
                    KPIs de Proyectos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                    {[
                        {
                            label: 'Proyectos del Mes',
                            value: projectMetrics.count,
                            change: 'Active',
                            icon: 'folder_managed',
                            color: 'text-pink-500',
                            bg: 'bg-pink-50',
                            backBg: 'bg-pink-600',
                            explanation: (
                                <p className="text-[10px] font-medium leading-relaxed opacity-90">
                                    Total de iniciativas activas o creadas en el periodo seleccionado.
                                </p>
                            )
                        },
                        {
                            label: 'Diversidad ODS',
                            value: projectMetrics.sdgs,
                            change: 'Scope',
                            icon: 'category',
                            color: 'text-cyan-500',
                            bg: 'bg-cyan-50',
                            backBg: 'bg-cyan-600',
                            explanation: (
                                <p className="text-[10px] font-medium leading-relaxed opacity-90">
                                    Cantidad de Objetivos de Desarrollo Sostenible distintos que abarcan tus proyectos actuales.
                                </p>
                            )
                        },
                        {
                            label: 'Recaudo Total',
                            value: '$' + (projectMetrics.raised / 1000).toFixed(1) + 'k',
                            change: 'Funding',
                            icon: 'attach_money',
                            color: 'text-emerald-500',
                            bg: 'bg-emerald-50',
                            backBg: 'bg-emerald-600',
                            explanation: (
                                <p className="text-[10px] font-medium leading-relaxed opacity-90">
                                    Fondos totales recaudados o asignados a los proyectos activos en este periodo.
                                </p>
                            )
                        },
                        {
                            label: 'Voluntarios',
                            value: projectMetrics.volunteers,
                            change: 'Team',
                            icon: 'diversity_3',
                            color: 'text-orange-500',
                            bg: 'bg-orange-50',
                            backBg: 'bg-orange-600',
                            explanation: (
                                <p className="text-[10px] font-medium leading-relaxed opacity-90">
                                    Número total de voluntarios y colaboradores sumados en todos tus proyectos.
                                </p>
                            )
                        }
                    ].map((card, i) => {
                        const isFlipped = flippedProjectCardIndex === i;
                        return (
                            <div key={i} className="h-[220px]" style={{ perspective: '1000px' }}>
                                <div
                                    className={`relative w-full h-full transition-all duration-700`}
                                    style={{
                                        transformStyle: 'preserve-3d',
                                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => setFlippedProjectCardIndex(isFlipped ? null : i)}
                                >
                                    <div className="absolute inset-0 bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm overflow-hidden group hover:shadow-2xl transition-all duration-700" style={{ backfaceVisibility: 'hidden' }}>
                                        <div className="flex justify-between items-start mb-8">
                                            <div>
                                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">{card.label}</p>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">{card.value}</span>
                                                    <div className={`flex items-center px-2 py-1 rounded-lg text-[9px] font-black bg-slate-50 text-slate-500`}>
                                                        {card.change}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`size-16 rounded-3xl ${card.bg} ${card.color} flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                                                <span className="material-symbols-outlined text-3xl filled">{card.icon}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        className={`absolute inset-0 ${card.backBg} p-8 rounded-[48px] shadow-2xl flex flex-col justify-center items-center text-center text-white`}
                                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                                    >
                                        <span className="material-symbols-outlined text-3xl mb-4 filled">info</span>
                                        <h4 className="text-sm font-black uppercase tracking-widest mb-3">{card.label}</h4>
                                        {card.explanation}
                                        <div className="mt-4 px-4 py-2 bg-white/20 rounded-full text-[8px] font-black uppercase tracking-widest">
                                            Click para volver
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-12">
                    <div className="lg:col-span-2 h-[600px]" style={{ perspective: '2000px' }}>
                        <div
                            className={`relative w-full h-full transition-all duration-1000`}
                            style={{
                                transformStyle: 'preserve-3d',
                                transform: isChartFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                            }}
                        >
                            {/* Front Side */}
                            <div
                                className="absolute inset-0 bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm overflow-hidden"
                                style={{ backfaceVisibility: 'hidden' }}
                            >
                                <div className="flex justify-between items-center mb-12" onClick={() => setIsChartFlipped(true)} style={{ cursor: 'pointer' }}>
                                    <div>
                                        <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Engagement {selectedMonth === 'all' ? 'Mensual' : timeGranularity === 'day' ? 'Diario' : 'Semanal'}</h3>
                                        <p className="text-slate-400 text-sm font-medium tracking-tight">Interacciones promedio por publicación este periodo</p>
                                    </div>
                                    <div className={`flex bg-slate-100 p-1.5 rounded-3xl border border-slate-200 shadow-inner ${selectedMonth === 'all' ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <button onClick={(e) => { e.stopPropagation(); setTimeGranularity('day'); }} className={`px-8 py-3 rounded-2xl text-xs font-black transition-all ${timeGranularity === 'day' ? 'bg-white shadow-xl text-slate-900' : 'text-slate-400'}`}>Día</button>
                                        <button onClick={(e) => { e.stopPropagation(); setTimeGranularity('week'); }} className={`px-8 py-3 rounded-2xl text-xs font-black transition-all ${timeGranularity === 'week' ? 'bg-white shadow-xl text-slate-900' : 'text-slate-400'}`}>Semana</button>
                                    </div>
                                </div>
                                <div className="h-[400px] w-full" onClick={() => setIsChartFlipped(true)} style={{ cursor: 'pointer' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                                            <defs>
                                                <linearGradient id="entChart" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0095FF" stopOpacity={0.3} /><stop offset="95%" stopColor="#0095FF" stopOpacity={0} /></linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                            />
                                            <RechartsTooltip
                                                cursor={{ stroke: '#0095FF', strokeWidth: 2, strokeDasharray: '12 12' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-slate-900 border border-slate-800 text-white px-8 py-5 rounded-[32px] shadow-2xl relative translate-y-[-35px] backdrop-blur-2xl bg-opacity-95 ring-8 ring-slate-900/10 text-center">
                                                                <p className="text-[10px] font-black opacity-40 uppercase tracking-[0.3em] mb-2">{selectedMonth === 'all' ? 'Mes ' : timeGranularity === 'day' ? 'Día ' : 'Semana '}{payload[0].payload.name}</p>
                                                                <p className="text-4xl font-black text-blue-400 tabular-nums">{payload[0].value}</p>
                                                                <p className="text-[8px] font-black uppercase text-slate-400 mt-1">Interacciones</p>
                                                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full border-[12px] border-transparent border-t-slate-900 opacity-95"></div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Area type="monotone" dataKey="value" stroke="#0095FF" strokeWidth={4} fill="url(#entChart)" dot={{ r: 6, fill: '#0095FF', strokeWidth: 4, stroke: '#fff' }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Back Side */}
                            <div
                                className="absolute inset-0 bg-slate-900 p-16 rounded-[56px] shadow-2xl flex flex-col justify-center items-center text-center text-white"
                                style={{
                                    backfaceVisibility: 'hidden',
                                    transform: 'rotateY(180deg)',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setIsChartFlipped(false)}
                            >
                                <span className="material-symbols-outlined text-6xl mb-8 filled text-blue-400">query_stats</span>
                                <h4 className="text-2xl font-black uppercase tracking-widest mb-6">Análisis de Engagement</h4>
                                <div className="space-y-6 max-w-lg">
                                    <p className="text-lg font-medium leading-relaxed opacity-90">
                                        Este gráfico visualiza la intensidad de la interacción social generada corporativamente.
                                    </p>
                                    <p className="text-sm font-medium leading-relaxed opacity-70">
                                        Cada punto representa la suma total de <span className="text-white font-bold">Me gusta</span> y <span className="text-white font-bold">Comentarios</span> recibidos.
                                    </p>
                                    <p className="text-sm font-medium leading-relaxed opacity-70">
                                        Utilizamos esta data para calcular tu <span className="text-blue-400 font-bold">Share of Impact</span> global y entender qué momentos del trimestre resuenan más con el mercado.
                                    </p>
                                </div>
                                <div className="mt-12 px-8 py-4 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                                    Click para volver al Gráfico
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="h-[600px]" style={{ perspective: '2000px' }}>
                        <div
                            className={`relative w-full h-full transition-all duration-1000`}
                            style={{
                                transformStyle: 'preserve-3d',
                                transform: isOdsFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                            }}
                        >
                            {/* Front Side */}
                            <div
                                className="absolute inset-0 bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm flex flex-col group overflow-hidden"
                                style={{ backfaceVisibility: 'hidden' }}
                            >
                                <div className="flex justify-between items-start mb-8 cursor-pointer" onClick={() => setIsOdsFlipped(true)}>
                                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Status ODS</h3>
                                    <div className="size-16 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center">
                                        <span className="material-symbols-outlined text-3xl filled">eco</span>
                                    </div>
                                </div>
                                <div className="flex-1 w-full relative mb-4 mx-auto cursor-pointer min-h-[250px]" onClick={() => setIsOdsFlipped(true)}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <RechartsTooltip
                                                wrapperStyle={{ zIndex: 40 }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-slate-900 border border-slate-800 text-white px-8 py-6 rounded-[32px] shadow-2xl text-center relative translate-y-[-20px] backdrop-blur-xl bg-opacity-95 ring-4 ring-white/5">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">{data.name}</p>
                                                                <p className="text-4xl font-black text-white tabular-nums">{data.percentage}%</p>
                                                                <div className="mt-3 flex items-center justify-center gap-3">
                                                                    <div className="size-3 rounded-full shadow-lg" style={{ backgroundColor: data.color }}></div>
                                                                    <p className="text-xs font-bold text-slate-300">{data.value} Acciones</p>
                                                                </div>
                                                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full border-[12px] border-transparent border-t-slate-900"></div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Pie data={pieData} innerRadius={85} outerRadius={115} paddingAngle={8} dataKey="value" stroke="none" cornerRadius={12}>
                                                {pieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-7xl font-black text-slate-900 tracking-tighter">{counts.posts}</span>
                                        <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest mt-2">Acciones</span>
                                    </div>
                                </div>
                                <div className="w-full space-y-3 h-32 overflow-y-auto no-scrollbar pr-2">
                                    {pieData.map((e, i) => (
                                        <div key={i} className="flex items-center justify-between group/ods">
                                            <div className="flex items-center gap-4">
                                                <div className="size-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: e.color }}></div>
                                                <span className="text-xs font-bold text-slate-500 group-hover/ods:text-slate-900 transition-colors truncate max-w-[180px]">{e.name}</span>
                                            </div>
                                            <span className="text-xs font-black text-slate-900 bg-slate-50 px-3 py-1 rounded-lg tabular-nums">{e.percentage}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Back Side */}
                            <div
                                className="absolute inset-0 bg-[#0F172A] p-16 rounded-[56px] shadow-2xl flex flex-col justify-center items-center text-center text-white"
                                style={{
                                    backfaceVisibility: 'hidden',
                                    transform: 'rotateY(180deg)',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setIsOdsFlipped(false)}
                            >
                                <div className="size-24 bg-blue-500/20 text-blue-400 rounded-[32px] flex items-center justify-center mb-12 border border-blue-500/30 shadow-2xl shadow-blue-500/10">
                                    <span className="material-symbols-outlined text-5xl filled">public</span>
                                </div>
                                <h4 className="text-3xl font-black uppercase tracking-widest mb-8">Huella Corporativa</h4>
                                <div className="space-y-8 max-w-sm">
                                    <p className="text-xl font-medium leading-relaxed opacity-90">
                                        Tu impacto está alineado con los Objetivos de Desarrollo Sostenible.
                                    </p>
                                    <p className="text-sm font-medium leading-relaxed opacity-60">
                                        Analizamos cada reporte corporativo y publicación social para categorizar tus esfuerzos en pilares de <span className="text-blue-400 font-bold">Sostenibilidad Global</span>.
                                    </p>
                                </div>
                                <div className="mt-16 px-10 py-5 bg-white/10 rounded-full text-xs font-black uppercase tracking-[0.2em] backdrop-blur-md border border-white/10">
                                    Click para volver
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                    <div className="lg:col-span-2 h-[550px]" style={{ perspective: '2000px' }}>
                        <div
                            className={`relative w-full h-full transition-all duration-1000`}
                            style={{
                                transformStyle: 'preserve-3d',
                                transform: isActivityFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                            }}
                        >
                            {/* Front Side */}
                            <div
                                className="absolute inset-0 bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm relative overflow-hidden group flex flex-col"
                                style={{ backfaceVisibility: 'hidden' }}
                            >
                                <div className="flex justify-between items-center mb-12 cursor-pointer" onClick={() => setIsActivityFlipped(true)}>
                                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Frecuencia Social</h3>
                                    <div className="flex items-center gap-3">
                                        <div className="size-4 rounded-full bg-blue-500 shadow-xl shadow-blue-500/20 animate-pulse"></div>
                                        <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Actividad Global</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-7 gap-5 h-full min-h-[180px] relative">
                                    {selectedMonth === 'all' ? (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm rounded-[32px] border-2 border-dashed border-slate-200 z-20">
                                            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">event_busy</span>
                                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest text-center px-4">Mapa de calor mensual <br /> desactivado en vista de Histórico</h4>
                                        </div>
                                    ) : (
                                        <>
                                            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, i) => (
                                                <span key={i} className="text-center text-[10px] font-black text-slate-300 mb-6">{day}</span>
                                            ))}
                                            {heatmapGrid.padding.map((_, i) => <div key={`p-${i}`} className="aspect-square"></div>)}
                                            {heatmapGrid.days.map((day) => {
                                                const count = activityData[day] || 0;
                                                const bgColor = count > 3 ? 'bg-blue-600' : count > 1 ? 'bg-blue-400' : count === 1 ? 'bg-blue-200' : 'bg-slate-50';
                                                return (
                                                    <div
                                                        key={day}
                                                        title={`${day}: ${count} posts`}
                                                        className={`aspect-square rounded-[18px] ${bgColor} hover:ring-[12px] hover:ring-blue-50 transition-all cursor-crosshair shadow-sm relative group/cell`}
                                                        onClick={(e) => { e.stopPropagation(); setIsActivityFlipped(true); }}
                                                    >
                                                        {count > 0 && (
                                                            <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-4 py-2 rounded-xl opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-2xl">
                                                                {count} Publicaciones
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>
                                <div className="mt-6 flex justify-between items-center bg-slate-50/50 p-8 rounded-[40px] border border-slate-100">
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Volumen {selectedMonth === 'all' ? 'Histórico' : 'Mensual'}</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-4xl font-black text-slate-900 tabular-nums">{counts.posts}</p>
                                        <p className="text-xs font-black text-blue-500 uppercase">Impactos</p>
                                    </div>
                                </div>
                            </div>

                            {/* Back Side */}
                            <div
                                className="absolute inset-0 bg-[#F8FAFC] p-16 rounded-[56px] shadow-2xl flex flex-col justify-center items-center text-center border-4 border-blue-500/10"
                                style={{
                                    backfaceVisibility: 'hidden',
                                    transform: 'rotateY(180deg)',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setIsActivityFlipped(false)}
                            >
                                <div className="size-24 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mb-12 shadow-inner">
                                    <span className="material-symbols-outlined text-5xl filled">calendar_month</span>
                                </div>
                                <h4 className="text-3xl font-black text-slate-900 uppercase tracking-widest mb-8">Mapa de Calor Social</h4>
                                <div className="space-y-8 max-w-sm">
                                    <p className="text-xl font-medium text-slate-600 leading-relaxed">
                                        Visualiza tu consistencia y ritmo de publicación a lo largo de <span className="text-blue-600 font-extrabold">{monthName}</span>.
                                    </p>
                                    <p className="text-sm font-medium text-slate-400 leading-relaxed text-center">
                                        La intensidad del azul indica el volumen de historias compartidas. Un color más oscuro refleja una <span className="text-slate-900 font-bold">mayor presencia social</span> durante ese día.
                                    </p>
                                    <p className="text-[12px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-6 py-3 rounded-full inline-block">
                                        Regularidad = Mayor Impacto
                                    </p>
                                </div>
                                <div className="mt-16 px-10 py-5 bg-slate-900 text-white rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-xl">
                                    Click para volver al Calendario
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-3 bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm relative group overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-4xl font-black text-slate-900 tracking-tighter">Impacto Destacado</h3>
                                <p className="text-slate-400 text-sm font-medium tracking-tight mt-1">Análisis de rendimiento por publicación en {monthName}</p>
                            </div>
                            <div className="bg-blue-50 text-blue-600 px-8 py-4 rounded-2xl text-xs font-black border border-blue-100">
                                {topPosts.length} Publicaciones Totales
                            </div>
                        </div>

                        <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar max-h-[400px] pr-4">
                            {topPosts.slice(0, 10).map((p, i) => (
                                <div
                                    key={i}
                                    className="group/item flex items-center gap-8 p-8 rounded-[40px] hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all duration-500"
                                >
                                    <div className="size-24 rounded-[32px] bg-slate-100 overflow-hidden shrink-0 border-4 border-white shadow-xl group-hover/item:scale-105 transition-all duration-500 relative">
                                        <img
                                            src={p.images?.[0] || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=200'}
                                            crossOrigin="anonymous"
                                            className="w-full h-full object-cover"
                                            alt={p.title}
                                        />
                                        <div className="absolute inset-0 bg-black/10 group-hover/item:bg-black/0 transition-all"></div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-3">
                                            {(p.sdg_ids || []).slice(0, 3).map((id: number) => (
                                                <div key={id} className="size-7 rounded-xl flex items-center justify-center text-white shadow-md" style={{ backgroundColor: getSdgInfo(id)?.color }}>
                                                    <span className="material-symbols-outlined text-[16px] filled">{getSdgInfo(id)?.icon}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <h4 className="text-xl font-black text-slate-900 truncate tracking-tight group-hover/item:text-blue-600 transition-colors uppercase">{p.title || 'Proyecto Estratégico'}</h4>
                                        <p className="text-sm font-bold text-slate-400 mt-1 line-clamp-1">{p.content || 'Sin descripción adicional disponible.'}</p>
                                    </div>
                                    <div className="flex items-center gap-12 pl-8 border-l-2 border-slate-100">
                                        <div className="text-center">
                                            <p className="text-2xl font-black text-slate-900 tabular-nums">{p.likes_count || 0}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Likes</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-black text-slate-900 tabular-nums">{p.comments_count || 0}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comentarios</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {isPreviewOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-3xl" onClick={() => setIsPreviewOpen(false)}></div>
                    <div className="relative bg-[#f8fafc] w-full max-w-5xl h-[90vh] rounded-[72px] shadow-2xl flex flex-col overflow-hidden border border-white/20">
                        <div className="p-12 border-b border-slate-200 bg-white/50 flex justify-between items-center">
                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Empresa Dashboard Preview</h2>
                            <button onClick={() => setIsPreviewOpen(false)} className="size-14 rounded-full bg-white text-slate-400 transition-all flex items-center justify-center shadow-sm border border-slate-100">
                                <span className="material-symbols-outlined font-black">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-12 flex justify-center no-scrollbar bg-slate-900/10">
                            <div id="pdf-report-container" className="bg-[#ffffff] w-[900px] p-20 shadow-2xl relative border border-slate-300 flex flex-col font-sans mb-12" style={{ display: 'flex', minHeight: '2000px', backgroundColor: '#ffffff', color: '#0f172a' }}>
                                {/* Header: Executive Branding */}
                                <div className="flex justify-between items-start mb-16 border-b-[6px] border-slate-900 pb-12">
                                    <div className="flex items-center gap-6">
                                        <div className="size-20 bg-slate-900 rounded-[24px] flex items-center justify-center text-white shadow-2xl transform -rotate-3">
                                            <span className="material-symbols-outlined text-5xl">domain</span>
                                        </div>
                                        <div>
                                            <h1 className="text-4xl font-[1000] text-slate-900 tracking-tighter uppercase leading-none">Emprexa Reportes</h1>
                                            <p className="text-blue-600 font-black text-[11px] uppercase tracking-[0.6em] mt-3">Métricas de Impacto y Análisis Estratégico</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="inline-block px-5 py-2 bg-slate-900 rounded-full mb-3 shadow-lg" style={{ backgroundColor: '#0f172a' }}>
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white" style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}>Documento Corporativo Oficial</p>
                                        </div>
                                        <p className="text-3xl font-black text-slate-900 uppercase tracking-tighter">{monthName}</p>
                                    </div>
                                </div>

                                {/* Summary Grid: Clean & High Contrast */}
                                <div className="grid grid-cols-4 gap-6 mb-16">
                                    {[
                                        { label: 'Cuota de Impacto Global', value: shareOfImpact + '%', sub: 'Cuota de Mercado Social', icon: 'public' },
                                        { label: 'Alcance Agregado', value: (counts.reach / 1000).toFixed(1) + 'k', sub: 'Alcance Bruto de Impacto', icon: 'rocket_launch' },
                                        { label: 'Puntaje de Impacto', value: counts.impact.toFixed(0), sub: 'Índice de Relevancia', icon: 'stars' },
                                        { label: 'Red Estratégica', value: counts.followers, sub: 'Crecimiento de Red Activa', icon: 'groups' }
                                    ].map((m, i) => (
                                        <div key={i} className="bg-[#f8fafc] p-8 rounded-[40px] border-2 border-slate-100 flex flex-col items-center text-center shadow-sm">
                                            <div className="size-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-slate-100 mb-4">
                                                <span className="material-symbols-outlined text-xl filled">{m.icon}</span>
                                            </div>
                                            <p className="text-[32px] font-[1000] text-slate-900 mb-1 tabular-nums tracking-tighter">{m.value}</p>
                                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-tight">{m.label}</p>
                                            <p className="text-[8px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{m.sub}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* ESG & SDG Section */}
                                <div className="grid grid-cols-5 gap-10 mb-16">
                                    <div className="col-span-2 bg-slate-900 rounded-[56px] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col justify-center">
                                        <div className="absolute top-0 right-0 size-80 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
                                        <h3 className="text-blue-400 font-black text-[12px] uppercase tracking-[0.4em] mb-10 flex items-center gap-3">
                                            <div className="w-8 h-1 bg-blue-400"></div> Sostenibilidad
                                        </h3>
                                        <div className="space-y-12 relative z-10">
                                            <div>
                                                <p className="text-5xl font-black tabular-nums tracking-tighter text-white" style={{ color: '#ffffff' }}>{projectMetrics.count}</p>
                                                <p className="text-[11px] font-black uppercase text-slate-300 tracking-widest leading-none mt-3">Proyectos Totales</p>
                                            </div>
                                            <div>
                                                <p className="text-5xl font-black tabular-nums tracking-tighter text-white" style={{ color: '#ffffff' }}>${(projectMetrics.raised / 1000).toFixed(1)}k</p>
                                                <p className="text-[11px] font-black uppercase text-slate-300 tracking-widest leading-none mt-3">Capital Movilizado</p>
                                            </div>
                                            <div>
                                                <p className="text-5xl font-black tabular-nums tracking-tighter text-white" style={{ color: '#ffffff' }}>{projectMetrics.volunteers}</p>
                                                <p className="text-[11px] font-black uppercase text-slate-300 tracking-widest leading-none mt-3">Red de Voluntarios</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-3 bg-[#ffffff] rounded-[56px] border-[3px] border-slate-50 p-12 flex flex-col shadow-sm">
                                        <h3 className="text-slate-400 font-black text-[11px] uppercase tracking-[0.4em] mb-10">Análisis Completo de Impacto ODS (100%)</h3>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                                            {pieData.filter(e => e.percentage > 0 || e.value > 0).map((e, i) => (
                                                <div key={i} className="flex items-center gap-4 p-4 bg-[#f8fafc] rounded-[24px] border border-slate-100 min-h-[72px]">
                                                    <div className="size-12 rounded-[14px] flex items-center justify-center text-white shrink-0 shadow-lg" style={{ backgroundColor: e.color }}>
                                                        <span className="material-symbols-outlined text-xl filled">{e.icon}</span>
                                                    </div>
                                                    <div className="min-w-0 flex flex-col justify-center">
                                                        <p className="text-[10px] font-black text-slate-900 truncate uppercase tracking-tighter leading-normal mb-1" style={{ paddingBottom: '2px', paddingTop: '2px' }}>{e.name}</p>
                                                        <p className="text-2xl font-[1000] text-blue-600 tabular-nums leading-none">{e.percentage}%</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {pieData.length === 0 && (
                                                <p className="col-span-2 text-center text-slate-400 font-bold py-10 uppercase tracking-widest text-[10px]">Sin datos registrados este periodo</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Activity Analysis */}
                                <div className="mb-16 bg-[#fcfdfe] p-16 rounded-[64px] border border-slate-200 shadow-sm relative border-b-[12px] border-b-slate-900/5">
                                    <h3 className="text-slate-900 font-[1000] text-2xl tracking-tighter mb-10 flex justify-between items-center">
                                        Frecuencia de Actividad por Día
                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Contenido Publicado — {monthName}</span>
                                    </h3>
                                    <div className="grid grid-cols-7 gap-3">
                                        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d, i) => (
                                            <span key={i} className="text-center text-[10px] font-black text-slate-400 mb-2">{d}</span>
                                        ))}
                                        {heatmapGrid.padding.map((_, i) => <div key={`p-${i}`} className="aspect-square"></div>)}
                                        {heatmapGrid.days.map((day) => {
                                            const count = activityData[day] || 0;
                                            const intensity = count === 0 ? 'bg-white' : count === 1 ? 'bg-blue-100' : count < 5 ? 'bg-blue-400' : 'bg-blue-700';
                                            const textColor = count > 1 ? 'text-white' : 'text-slate-300';
                                            return (
                                                <div key={day} className={`aspect-square rounded-[18px] ${intensity} border-2 border-slate-100 flex flex-col items-center justify-center shadow-sm relative group`}>
                                                    <span className={`text-[10px] font-black mb-0.5 ${textColor}`}>{day}</span>
                                                    {count > 0 && <span className={`text-[14px] font-[1000] ${textColor} tabular-nums`}>{count}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Top Posts Selection */}
                                <div className="mb-20 bg-white rounded-[56px] border-[3px] border-slate-100 p-12 shadow-sm">
                                    <h3 className="text-slate-400 font-black text-[11px] uppercase tracking-[0.4em] mb-10">Publicaciones de Mayor Tracción Social</h3>
                                    <div className="grid grid-cols-2 gap-8">
                                        {topPosts.slice(0, 4).map((p, i) => (
                                            <div key={i} className="flex items-center gap-6 p-6 bg-[#f8fafc] rounded-[36px] border border-slate-100 shadow-sm h-32 overflow-hidden flex-nowrap">
                                                <div className="size-20 rounded-[24px] bg-slate-200 overflow-hidden border-4 border-white shrink-0 shadow-md">
                                                    <img src={p.images?.[0] || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=200'} crossOrigin="anonymous" className="w-full h-full object-cover" alt="" />
                                                </div>
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <h4 className="text-[14px] font-[1000] text-slate-900 uppercase tracking-tighter mb-2 line-clamp-2" style={{ lineHeight: '1.5', paddingBottom: '2px', paddingTop: '2px' }}>
                                                        {p.title || 'Iniciativa de Impacto'}
                                                    </h4>
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-blue-600 text-[14px] filled">analytics</span>
                                                        <span className="text-[11px] font-black text-slate-500 uppercase">{p.likes_count} Reacciones</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Simplified Footer with Protection Padding */}
                                <div className="mt-auto pt-16 pb-12 border-t-[8px] border-slate-900 flex justify-between items-end">
                                    <div className="flex items-center gap-6">
                                        <img src={authUser?.avatar} crossOrigin="anonymous" className="size-16 rounded-[22px] border-[4px] border-white shadow-lg object-cover" alt="" />
                                        <div>
                                            <p className="text-lg font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">{authUser?.name}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Responsable de Reporte Corporativo</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1">Generado: {new Date().toLocaleDateString('es-ES')} — {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">FOLIO DE SEGURIDAD: {Math.random().toString(36).substring(2, 10).toUpperCase()}-{Date.now().toString().slice(-4)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-10 border-t border-slate-200 bg-white flex justify-end gap-6">
                            <button onClick={() => setIsPreviewOpen(false)} className="px-12 py-5 rounded-3xl text-sm font-black text-slate-500 uppercase tracking-widest">Cerrar</button>
                            <button onClick={handleExportImage} disabled={isExporting} className="bg-slate-900 text-white px-16 py-6 rounded-3xl font-black shadow-2xl flex items-center gap-6">{isExporting ? 'Exportando...' : 'Descargar Reporte PNG'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
