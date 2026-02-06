import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { NavProps, ID, View } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabase';
import { getSdgInfo } from '../../utils/sdgUtils';
import { SDGS } from '../../constants';

export const DashboardPro: React.FC<NavProps> = ({ navigate }) => {
    const { user: authUser } = useAuth();

    // --- STATE MANAGEMENT ---
    const [chartData, setChartData] = useState<any[]>([]);
    const [pieData, setPieData] = useState<any[]>([]);
    const [topPosts, setTopPosts] = useState<any[]>([]);
    const [activityData, setActivityData] = useState<Record<number, number>>({});
    const [timeGranularity, setTimeGranularity] = useState<'day' | 'week'>('day');
    const [counts, setCounts] = useState({
        posts: 0,
        followers: 0,
        impact: 0,
        reach: 0,
        views: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [flippedCardIndex, setFlippedCardIndex] = useState<number | null>(null);
    const [isChartFlipped, setIsChartFlipped] = useState(false);
    const [isOdsFlipped, setIsOdsFlipped] = useState(false);
    const [isActivityFlipped, setIsActivityFlipped] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
    const [availableMonths, setAvailableMonths] = useState<{ value: string; label: string }[]>([]);

    // --- DATA FETCHING ---
    useEffect(() => {
        const fetchRange = async () => {
            if (!authUser) return;
            const { data } = await supabase.from('posts').select('created_at').eq('user_id', authUser.id).order('created_at', { ascending: true });
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
                setAvailableMonths(options);
            } else {
                const now = new Date();
                const val = now.toISOString().substring(0, 7);
                const lbl = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(now);
                setAvailableMonths([{ value: val, label: lbl.charAt(0).toUpperCase() + lbl.slice(1) }]);
            }
        };
        fetchRange();
    }, [authUser]);

    useEffect(() => {
        const fetchStats = async () => {
            if (!authUser) return;
            setIsLoading(true);

            const [year, month] = selectedMonth.split('-').map(Number);
            const start = new Date(year, month - 1, 1).toISOString();
            const end = new Date(year, month, 0, 23, 59, 59).toISOString();

            try {
                const [postsResponse, followCount] = await Promise.all([
                    supabase.from('posts').select('*').eq('user_id', authUser.id).gte('created_at', start).lte('created_at', end),
                    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', authUser.id)
                ]);

                const posts = postsResponse.data || [];

                const totalImpactPoints = posts.reduce((acc, p) => acc + (p.likes_count || 0) + (p.comments_count || 0) + 10, 0);
                const reach = (posts.length * 150) + (posts.reduce((acc, p) => acc + (p.likes_count || 0), 0) * 12);
                const views = reach * 0.45;

                setCounts({
                    posts: posts.length,
                    followers: followCount.count || 0,
                    impact: Math.min(100, (totalImpactPoints / 500) * 100),
                    reach,
                    views
                });

                // Top Posts
                const sorted = [...posts].sort((a, b) => {
                    const engagementA = (a.likes_count || 0) + (a.comments_count || 0);
                    const engagementB = (b.likes_count || 0) + (b.comments_count || 0);
                    return engagementB - engagementA;
                });
                setTopPosts(sorted);

                // Chart & Heatmap
                const activity: Record<number, number> = {};
                posts.forEach(p => {
                    const d = new Date(p.created_at).getDate();
                    activity[d] = (activity[d] || 0) + 1;
                });
                setActivityData(activity);

                const daysInMonth = new Date(year, month, 0).getDate();
                if (timeGranularity === 'day') {
                    const daily = Array.from({ length: daysInMonth }, (_, i) => {
                        const d = i + 1;
                        const dayPosts = posts.filter(p => new Date(p.created_at).getDate() === d);
                        return { name: `${d}`, value: dayPosts.reduce((acc, p) => acc + (p.likes_count || 0) + (p.comments_count || 0), 0) };
                    });
                    setChartData(daily);
                } else {
                    const weeks = Math.ceil(daysInMonth / 7);
                    const weekly = Array.from({ length: weeks }, (_, i) => {
                        const startDay = i * 7 + 1;
                        const endDay = Math.min((i + 1) * 7, daysInMonth);
                        const weekPosts = posts.filter(p => {
                            const d = new Date(p.created_at).getDate();
                            return d >= startDay && d <= endDay;
                        });
                        return { name: `${i + 1}`, value: weekPosts.reduce((acc, p) => acc + (p.likes_count || 0) + (p.comments_count || 0), 0) };
                    });
                    setChartData(weekly);
                }

                // SDG Pie
                const sdgMap: Record<number, number> = {};
                posts.forEach(p => (p.sdg_ids || []).forEach((id: number) => sdgMap[id] = (sdgMap[id] || 0) + 1));
                const totalMentions = Object.values(sdgMap).reduce((a, b) => a + b, 0);
                const pie = Object.entries(sdgMap).map(([id, count]) => {
                    const info = getSdgInfo(Number(id));
                    return {
                        name: info?.label || `ODS ${id}`,
                        value: count,
                        color: info?.color || '#94a3b8',
                        icon: info?.icon || 'spa',
                        percentage: Math.round((count / (totalMentions || 1)) * 100)
                    };
                }).sort((a, b) => b.value - a.value);
                setPieData(pie.length > 0 ? pie : [{ name: 'Sin datos', value: 1, color: '#f1f5f9', icon: 'info', percentage: 0 }]);

            } catch (err) { console.error(err); }
            setIsLoading(false);
        };
        fetchStats();
    }, [authUser, selectedMonth, timeGranularity]);

    const monthName = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        const name = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(date);
        return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + year;
    }, [selectedMonth]);

    const heatmapGrid = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const firstDay = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();
        const padding = Array.from({ length: firstDay });
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        return { padding, days };
    }, [selectedMonth]);

    return (
        <div className="flex-1 overflow-y-auto bg-[#FDFDFF] p-6 lg:p-10 no-scrollbar relative">
            <div className="max-w-7xl mx-auto pb-20">
                {/* Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter mb-2">Panel Pro</h1>
                        <p className="text-slate-400 font-medium tracking-tight">Análisis detallado de tu influencia social.</p>
                    </div>
                    <div className="flex items-center gap-4 self-stretch lg:self-auto">
                        <div className="group relative flex items-center bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-sm gap-4 focus-within:ring-4 focus-within:ring-blue-50 transition-all min-w-[220px]">
                            <span className="material-symbols-outlined text-slate-400 text-xl font-bold">calendar_today</span>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="text-sm font-black text-slate-700 outline-none bg-transparent cursor-pointer appearance-none w-full"
                            >
                                {availableMonths.map((m) => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined text-slate-300 text-lg pointer-events-none">expand_more</span>

                            {/* Tooltip */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-64 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-[120] scale-90 group-hover:scale-100 origin-top border border-slate-800">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-indigo-400">Historial Pro</p>
                                <p className="text-[11px] font-medium leading-relaxed opacity-80">
                                    En plan <strong className="text-white">Pro</strong> tienes acceso al análisis del mes actual.
                                    Haz el upgrade a <strong className="text-indigo-300 italic">Enterprise</strong> para desbloquear todo tu historial de impacto.
                                </p>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-[10px] border-transparent border-b-slate-900"></div>
                            </div>
                        </div>
                        <div className="bg-purple-600 text-white px-6 py-3 rounded-2xl shadow-lg flex items-center gap-3">
                            <span className="material-symbols-outlined filled">workspace_premium</span>
                            <span className="text-sm font-black uppercase tracking-widest">Plan Pro</span>
                        </div>
                    </div>
                </div>

                {/* KPI Cards (Flip style like current Dashboard) */}
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
                            label: 'Vistas Perfil',
                            value: (counts.views / 1000).toFixed(1) + 'k',
                            change: '+8.4%',
                            icon: 'visibility',
                            color: 'text-purple-500',
                            bg: 'bg-purple-50',
                            backBg: 'bg-purple-600',
                            explanation: (
                                <p className="text-[10px] font-medium leading-relaxed opacity-90">
                                    Interés directo generado en tu perfil profesional: <br />
                                    Calculado como el <span className="font-black text-white">45% de tu Alcance</span> Total, basado en tendencias de engagement.
                                </p>
                            )
                        },
                        {
                            label: 'Impact Score',
                            value: Math.round(counts.impact) + '/100',
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
                            label: 'Nuevos Seguidores',
                            value: (counts.followers / 1000).toFixed(1) + 'k',
                            change: '+12%',
                            icon: 'person_add',
                            color: 'text-emerald-500',
                            bg: 'bg-emerald-50',
                            backBg: 'bg-emerald-600',
                            explanation: (
                                <p className="text-[10px] font-medium leading-relaxed opacity-90">
                                    Crecimiento neto de tu red de impacto: <br />
                                    Conteo real de usuarios que han decidido seguir tus iniciativas y actualizaciones.
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

                {/* Charts Section */}
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
                                        <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Engagement {timeGranularity === 'day' ? 'Diario' : 'Semanal'}</h3>
                                        <p className="text-slate-400 text-sm font-medium tracking-tight">Interacciones promedio por publicación este mes</p>
                                    </div>
                                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                                        <button onClick={(e) => { e.stopPropagation(); setTimeGranularity('day'); }} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${timeGranularity === 'day' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Día</button>
                                        <button onClick={(e) => { e.stopPropagation(); setTimeGranularity('week'); }} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${timeGranularity === 'week' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>Semana</button>
                                    </div>
                                </div>
                                <div className="h-[300px] w-full" onClick={() => setIsChartFlipped(true)} style={{ cursor: 'pointer' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="proGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} /><stop offset="95%" stopColor="#6366f1" stopOpacity={0} /></linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 900 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 900 }}
                                            />
                                            <RechartsTooltip
                                                cursor={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '12 12' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-slate-900 border border-slate-800 text-white px-8 py-5 rounded-[32px] shadow-2xl relative translate-y-[-35px] backdrop-blur-2xl bg-opacity-95 ring-8 ring-slate-900/10 text-center">
                                                                <p className="text-[10px] font-black opacity-40 uppercase tracking-[0.3em] mb-2">{timeGranularity === 'day' ? 'Día ' : 'Semana '}{payload[0].payload.name}</p>
                                                                <p className="text-4xl font-black text-indigo-400 tabular-nums">{payload[0].value}</p>
                                                                <p className="text-[8px] font-black uppercase text-slate-400 mt-1">Interacciones</p>
                                                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full border-[12px] border-transparent border-t-slate-900 opacity-95"></div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fill="url(#proGrad)" dot={{ r: 4, fill: '#6366f1' }} />
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
                                        Este gráfico visualiza la intensidad de la interacción social generada por tus publicaciones.
                                    </p>
                                    <p className="text-sm font-medium leading-relaxed opacity-70">
                                        Cada punto representa la suma total de <span className="text-white font-bold">Me gusta</span> y <span className="text-white font-bold">Comentarios</span> recibidos.
                                    </p>
                                    <p className="text-sm font-medium leading-relaxed opacity-70">
                                        Utilizamos esta data para calcular tu <span className="text-blue-400 font-bold">Impact Score</span> y entender qué momentos del mes resuenan más con tu audiencia.
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
                                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Mapeo ODS</h3>
                                    <div className="size-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
                                        <span className="material-symbols-outlined filled">eco</span>
                                    </div>
                                </div>
                                <div className="size-48 relative mb-6 mx-auto cursor-pointer" onClick={() => setIsOdsFlipped(true)}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <RechartsTooltip
                                                wrapperStyle={{ zIndex: 40 }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-slate-900 border border-slate-800 text-white px-6 py-4 rounded-[24px] shadow-2xl text-center relative translate-y-[-20px] backdrop-blur-xl bg-opacity-95">
                                                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">{data.name}</p>
                                                                <p className="text-3xl font-black text-white tabular-nums">{data.percentage}%</p>
                                                                <div className="mt-2 flex items-center justify-center gap-2">
                                                                    <div className="size-2 rounded-full" style={{ backgroundColor: data.color }}></div>
                                                                    <p className="text-[10px] font-bold text-slate-300">{data.value} Menciones</p>
                                                                </div>
                                                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full border-[10px] border-transparent border-t-slate-900"></div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none" cornerRadius={6}>
                                                {pieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-3xl font-black text-slate-900">{counts.posts}</span>
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Temas</span>
                                    </div>
                                </div>
                                <div className="w-full space-y-3 max-h-32 overflow-y-auto no-scrollbar">
                                    {pieData.map((e, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="size-2 rounded-full" style={{ backgroundColor: e.color }}></div>
                                                <span className="text-[10px] font-bold text-slate-500 truncate max-w-[120px]">{e.name}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-900">{e.percentage}%</span>
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
                                <div className="size-20 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mb-10 border border-emerald-500/30">
                                    <span className="material-symbols-outlined text-4xl filled">public</span>
                                </div>
                                <h4 className="text-2xl font-black uppercase tracking-widest mb-6">Mapeo de Impacto</h4>
                                <div className="space-y-6 max-w-sm">
                                    <p className="text-lg font-medium leading-relaxed opacity-90">
                                        Tu huella ODS se calcula analizando cada publicación y proyecto activo.
                                    </p>
                                    <p className="text-sm font-medium leading-relaxed opacity-70">
                                        El gráfico muestra la distribución porcentual basada en las <span className="text-emerald-400 font-bold">menciones directas</span> de los ODS.
                                    </p>
                                </div>
                                <div className="mt-12 px-8 py-4 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                                    Click para volver
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Heatmap & Table */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
                    <div className="lg:col-span-2 h-[500px]" style={{ perspective: '2000px' }}>
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
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Actividad Social</h3>
                                    <div className="flex items-center gap-2">
                                        <div className="size-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/30"></div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Publicaciones</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-7 gap-4">
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
                                                className={`aspect-square rounded-[14px] ${bgColor} hover:ring-8 hover:ring-blue-50 transition-all cursor-crosshair shadow-sm relative group/cell`}
                                                onClick={() => setIsActivityFlipped(true)}
                                            >
                                                {count > 0 && (
                                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">
                                                        {count} Publicaciones
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-auto flex justify-between items-center bg-slate-50/50 p-6 rounded-[32px] border border-slate-100">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Volumen</p>
                                    <p className="text-2xl font-black text-slate-900 tabular-nums">{counts.posts} Posts</p>
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
                                <div className="size-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mb-10 shadow-inner">
                                    <span className="material-symbols-outlined text-4xl filled">calendar_month</span>
                                </div>
                                <h4 className="text-2xl font-black text-slate-900 uppercase tracking-widest mb-6">Mapa de Calor</h4>
                                <div className="space-y-6 max-w-sm">
                                    <p className="text-lg font-medium text-slate-600 leading-relaxed">
                                        Visualiza tu consistencia y ritmo de publicación.
                                    </p>
                                    <p className="text-sm font-medium text-slate-400 leading-relaxed">
                                        La intensidad del azul indica el volumen de historias compartidas. Un color más oscuro refleja una <span className="text-slate-900 font-bold">mayor presencia social</span>.
                                    </p>
                                </div>
                                <div className="mt-12 px-8 py-4 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                                    Click para volver
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-3 bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm relative group overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Impacto Destacado</h3>
                                <p className="text-slate-400 text-sm font-medium tracking-tight">Publicaciones en {monthName}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-50 text-blue-600 px-6 py-3 rounded-2xl text-xs font-black border border-blue-100">
                                    {topPosts.length} Publicaciones
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar max-h-[350px] pr-4">
                            {topPosts.map((p, i) => (
                                <div
                                    key={i}
                                    className="group/item flex items-center gap-6 p-6 rounded-[32px] hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all duration-500"
                                >
                                    <div className="size-20 rounded-[24px] bg-slate-100 overflow-hidden shrink-0 border-2 border-white shadow-md group-hover/item:scale-105 transition-all duration-500 relative">
                                        <img
                                            src={p.images?.[0] || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=200'}
                                            className="w-full h-full object-cover"
                                            alt={p.title}
                                        />
                                        <div className="absolute inset-0 bg-black/10 group-hover/item:bg-black/0 transition-all"></div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            {(p.sdg_ids || []).slice(0, 3).map((id: number) => (
                                                <div key={id} className="size-6 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: getSdgInfo(id)?.color }}>
                                                    <span className="material-symbols-outlined text-[14px] filled">{getSdgInfo(id)?.icon}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <h4 className="text-lg font-black text-slate-900 truncate tracking-tight group-hover/item:text-blue-600 transition-colors uppercase">{p.title || 'Proyecto sin Título'}</h4>
                                        <p className="text-xs font-bold text-slate-400 mt-1 line-clamp-1">{p.content || 'Sin descripción adicional.'}</p>
                                    </div>
                                    <div className="flex items-center gap-10 pl-6 border-l border-slate-100">
                                        <div className="text-center">
                                            <p className="text-xl font-black text-slate-900 tabular-nums">{p.likes_count || 0}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Likes</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xl font-black text-slate-900 tabular-nums">{p.comments_count || 0}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Comentarios</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
