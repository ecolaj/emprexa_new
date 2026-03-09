import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { NavProps, User, View } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../utils/supabase';
import { getSdgInfo } from '../../utils/sdgUtils';
import { useLanguage } from '../../context/LanguageContext';
import { SDGS } from '../../constants';

export const DashboardBasic: React.FC<NavProps> = ({ navigate }) => {
    const { user: authUser } = useAuth();
    const { t, language } = useLanguage();

    // --- STATE MANAGEMENT ---
    const [chartData, setChartData] = useState<any[]>([]);
    const [topPosts, setTopPosts] = useState<any[]>([]);
    const [activityData, setActivityData] = useState<Record<number, number>>({});
    const [counts, setCounts] = useState({
        posts: 0,
        impact: 0,
        reach: 0,
        views: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [flippedCardIndex, setFlippedCardIndex] = useState<number | null>(null);
    const [isChartFlipped, setIsChartFlipped] = useState(false);
    const [isActivityFlipped, setIsActivityFlipped] = useState(false);

    // Basic is locked to current month
    const selectedMonth = useMemo(() => new Date().toISOString().substring(0, 7), []);

    useEffect(() => {
        const fetchStats = async () => {
            if (!authUser) return;
            setIsLoading(true);

            const [year, month] = selectedMonth.split('-').map(Number);
            const start = new Date(year, month - 1, 1).toISOString();
            const end = new Date(year, month, 0, 23, 59, 59).toISOString();

            try {
                const postsQuery = supabase
                    .from('posts')
                    .select('*')
                    .eq('user_id', authUser.id)
                    .gte('created_at', start)
                    .lte('created_at', end);

                const { data: posts } = await postsQuery;
                const currentPosts = posts || [];

                const totalImpactPoints = currentPosts.reduce((acc, p) => acc + (p.likes_count || 0) + (p.comments_count || 0) + 10, 0);
                const reach = (currentPosts.length * 150) + (currentPosts.reduce((acc, p) => acc + (p.likes_count || 0), 0) * 12);
                const views = reach * 0.45;

                setCounts({
                    posts: currentPosts.length,
                    impact: Math.min(100, (totalImpactPoints / 500) * 100),
                    reach,
                    views
                });

                // Top Posts
                const sorted = [...currentPosts].sort((a, b) => {
                    const engagementA = (a.likes_count || 0) + (a.comments_count || 0);
                    const engagementB = (b.likes_count || 0) + (b.comments_count || 0);
                    return engagementB - engagementA;
                }).slice(0, 5);
                setTopPosts(sorted);

                // Activity Heatmap
                const activity: Record<number, number> = {};
                currentPosts.forEach(p => {
                    const day = new Date(p.created_at).getDate();
                    activity[day] = (activity[day] || 0) + 1;
                });
                setActivityData(activity);

                // Chart Data (Daily only for Basic)
                const daysInMonth = new Date(year, month, 0).getDate();
                const dailyPoints = Array.from({ length: daysInMonth }, (_, i) => {
                    const d = i + 1;
                    const dayPosts = currentPosts.filter(p => new Date(p.created_at).getDate() === d);
                    const val = dayPosts.reduce((acc, p) => acc + (p.likes_count || 0) + (p.comments_count || 0), 0);
                    return { name: `${d}`, value: val };
                });
                setChartData(dailyPoints);

            } catch (err) {
                console.error(err);
            }
            setIsLoading(false);
        };

        fetchStats();
    }, [authUser, selectedMonth]);

    const monthName = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        const name = new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', { month: 'long' }).format(date);
        return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + year;
    }, [selectedMonth, language]);

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
            {isLoading && (
                <div className="fixed top-8 right-8 z-[110] flex items-center gap-3 bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border border-blue-50">
                    <div className="size-4 border-2 border-blue-100 border-t-blue-500 rounded-full animate-spin"></div>
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{t('dashboard.syncing')}</span>
                </div>
            )}

            <div className={`max-w-7xl mx-auto pb-20 transition-all duration-700 ${isLoading ? 'opacity-50 blur-[1px]' : 'opacity-100 blur-0'}`}>
                {/* Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter mb-2">{t('dashboard.myImpact')}</h1>
                        <p className="text-slate-400 font-medium tracking-tight">{t('dashboard.hello').replace('{name}', authUser?.name?.split(' ')[0] || '')}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 px-6 py-3 rounded-2xl shadow-sm flex items-center gap-3">
                        <span className="material-symbols-outlined text-blue-500 filled text-xl">verified_user</span>
                        <span className="text-sm font-black text-blue-700 uppercase tracking-widest">{t('dashboard.basicPlan')}</span>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                    {[
                        {
                            label: t('dashboard.reachLabel'),
                            value: (counts.reach / 1000).toFixed(1) + 'k',
                            icon: 'rocket_launch',
                            color: 'text-blue-500',
                            bg: 'bg-blue-50',
                            backBg: 'bg-blue-600',
                            desc: t('dashboard.reachDesc')
                        },
                        {
                            label: t('dashboard.viewsLabel'),
                            value: (counts.views / 1000).toFixed(1) + 'k',
                            icon: 'visibility',
                            color: 'text-purple-500',
                            bg: 'bg-purple-50',
                            backBg: 'bg-purple-600',
                            desc: t('dashboard.viewsDesc')
                        },
                        {
                            label: t('dashboard.impactScoreLabel'),
                            value: Math.round(counts.impact) + '/100',
                            icon: 'stars',
                            color: 'text-amber-500',
                            bg: 'bg-amber-50',
                            backBg: 'bg-amber-500',
                            desc: t('dashboard.impactScoreDesc'),
                            showProgress: true
                        }
                    ].map((card, i) => (
                        <div key={i} className="h-44" style={{ perspective: '1000px' }}>
                            <div
                                className="relative w-full h-full transition-all duration-700"
                                style={{ transformStyle: 'preserve-3d', transform: flippedCardIndex === i ? 'rotateY(180deg)' : 'rotateY(0deg)', cursor: 'pointer' }}
                                onClick={() => setFlippedCardIndex(flippedCardIndex === i ? null : i)}
                            >
                                {/* Front */}
                                <div className="absolute inset-0 bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm flex flex-col justify-between overflow-hidden" style={{ backfaceVisibility: 'hidden' }}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">{card.label}</p>
                                            <span className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">{card.value}</span>
                                        </div>
                                        <div className={`size-16 rounded-3xl ${card.bg} ${card.color} flex items-center justify-center shrink-0 shadow-inner`}>
                                            <span className="material-symbols-outlined text-3xl filled">{card.icon}</span>
                                        </div>
                                    </div>
                                    {card.showProgress && (
                                        <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5 shadow-inner">
                                            <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${counts.impact}%` }}></div>
                                        </div>
                                    )}
                                </div>
                                {/* Back */}
                                <div className={`absolute inset-0 ${card.backBg} p-8 rounded-[48px] flex flex-col justify-center items-center text-center text-white shadow-xl shadow-blue-500/10`} style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                                    <div className="size-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined filled">info</span>
                                    </div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">{t('dashboard.about').replace('{label}', card.label)}</p>
                                    <p className="text-sm font-bold leading-tight">{card.desc}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Main Chart */}
                <div className="grid grid-cols-1 gap-10 mb-12">
                    <div className="h-[550px]" style={{ perspective: '2000px' }}>
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
                                <div className="flex justify-between items-center mb-12 cursor-pointer" onClick={() => setIsChartFlipped(true)}>
                                    <div>
                                        <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{t('dashboard.dailyEngagement')}</h3>
                                        <p className="text-slate-400 text-sm font-medium tracking-tight">{t('dashboard.interactionsMonth').replace('{month}', monthName)}</p>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 px-5 py-2 rounded-full border border-slate-100">
                                        <span className="size-2 rounded-full bg-blue-500 animate-pulse"></span>
                                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{t('dashboard.realTime')}</span>
                                    </div>
                                </div>
                                <div className="h-[350px] w-full cursor-pointer" onClick={() => setIsChartFlipped(true)}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorEngagementBasic" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#0095FF" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#0095FF" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }} dy={10} />
                                            <YAxis hide domain={['0', 'dataMax + 5']} />
                                            <RechartsTooltip
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl text-center relative translate-y-[-20px]">
                                                                <p className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">{t('dashboard.day').replace('{day}', payload[0].payload.name)}</p>
                                                                <p className="text-3xl font-black text-blue-400 tabular-nums">{payload[0].value}</p>
                                                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full border-[10px] border-transparent border-t-slate-900"></div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Area type="monotone" dataKey="value" stroke="#0095FF" strokeWidth={4} fill="url(#colorEngagementBasic)" dot={{ r: 6, fill: '#0095FF', stroke: '#fff', strokeWidth: 3 }} />
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
                                <span className="material-symbols-outlined text-6xl mb-8 filled text-blue-400">insights</span>
                                <h4 className="text-2xl font-black uppercase tracking-widest mb-6">{t('dashboard.interactionMetrics')}</h4>
                                <div className="space-y-6 max-w-md">
                                    <p className="text-lg font-medium leading-relaxed opacity-90">
                                        {t('dashboard.chartDesc1')}
                                    </p>
                                    <p className="text-sm font-medium leading-relaxed opacity-70">
                                        {t('dashboard.chartDesc2')}
                                    </p>
                                </div>
                                <div className="mt-12 px-8 py-4 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/20 transition-colors">
                                    {t('dashboard.backToChart')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Heatmap and Top Posts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Activity Heatmap with Flip */}
                    <div className="h-[500px]" style={{ perspective: '2000px' }}>
                        <div
                            className={`relative w-full h-full transition-all duration-1000`}
                            style={{
                                transformStyle: 'preserve-3d',
                                transform: isActivityFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                            }}
                        >
                            {/* Front Side */}
                            <div
                                className="absolute inset-0 bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm flex flex-col overflow-hidden"
                                style={{ backfaceVisibility: 'hidden' }}
                            >
                                <div className="flex justify-between items-start mb-12 cursor-pointer" onClick={() => setIsActivityFlipped(true)}>
                                    <div>
                                        <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{t('dashboard.activity')}</h3>
                                        <p className="text-slate-400 text-sm font-medium tracking-tight">{t('dashboard.postsMonth').replace('{month}', monthName)}</p>
                                    </div>
                                    <div className="size-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shadow-inner">
                                        <span className="material-symbols-outlined filled text-3xl">calendar_today</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-7 gap-3 mb-8">
                                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, i) => (
                                        <span key={i} className="text-center text-[10px] font-black text-slate-300 mb-2">{day}</span>
                                    ))}
                                    {heatmapGrid.padding.map((_, i) => <div key={`p-${i}`} className="aspect-square"></div>)}
                                    {heatmapGrid.days.map((day) => {
                                        const count = activityData[day] || 0;
                                        const bgColor = count > 0 ? 'bg-blue-500 shadow-lg shadow-blue-500/20' : 'bg-slate-50';
                                        const textColor = count > 0 ? 'text-white' : 'text-slate-300';
                                        return (
                                            <div
                                                key={day}
                                                className={`aspect-square rounded-xl ${bgColor} flex items-center justify-center shadow-sm transition-all hover:scale-110 cursor-help group/day relative`}
                                                onClick={() => setIsActivityFlipped(true)}
                                            >
                                                <span className={`text-[9px] font-black ${textColor}`}>{day}</span>
                                                {count > 0 && (
                                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover/day:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">
                                                        {t('dashboard.impacts').replace('{count}', String(count))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-auto bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('dashboard.monthlyTotal')}</span>
                                    <span className="text-2xl font-black text-slate-900">{t('dashboard.stories').replace('{count}', String(counts.posts))}</span>
                                </div>
                            </div>

                            {/* Back Side */}
                            <div
                                className="absolute inset-0 bg-[#F8FAFC] p-16 rounded-[56px] shadow-2xl flex flex-col justify-center items-center text-center border-4 border-blue-500/5"
                                style={{
                                    backfaceVisibility: 'hidden',
                                    transform: 'rotateY(180deg)',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setIsActivityFlipped(false)}
                            >
                                <div className="size-20 bg-blue-100 text-blue-600 rounded-[28px] flex items-center justify-center mb-8 shadow-inner">
                                    <span className="material-symbols-outlined text-4xl filled">event_note</span>
                                </div>
                                <h4 className="text-2xl font-black text-slate-900 uppercase tracking-widest mb-6">{t('dashboard.impactFrequency')}</h4>
                                <div className="space-y-6 max-w-sm">
                                    <p className="text-lg font-medium text-slate-600 leading-relaxed">
                                        {t('dashboard.activityDesc1')}
                                    </p>
                                    <p className="text-sm font-medium text-slate-400 leading-relaxed">
                                        {t('dashboard.activityDesc2')}
                                    </p>
                                </div>
                                <div className="mt-12 px-10 py-4 bg-slate-900 text-white rounded-full text-xs font-black uppercase tracking-[0.2em] shadow-lg">
                                    {t('dashboard.backToCalendar')}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Top Posts Refined */}
                    <div className="bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{t('dashboard.topStories')}</h3>
                                <p className="text-slate-400 text-sm font-medium tracking-tight">{t('dashboard.bestMonth')}</p>
                            </div>
                            <div className="bg-blue-50 text-blue-600 px-5 py-2 rounded-2xl text-[10px] font-black border border-blue-100">{t('dashboard.engagement')}</div>
                        </div>
                        <div className="space-y-6 overflow-y-auto no-scrollbar max-h-[350px] pr-2">
                            {topPosts.length > 0 ? topPosts.map((post, i) => (
                                <div key={i} className="flex items-center gap-6 p-5 rounded-[32px] hover:bg-slate-50 transition-all group border border-transparent hover:border-slate-100">
                                    <div className="size-16 rounded-[20px] bg-slate-100 overflow-hidden shrink-0 shadow-md group-hover:scale-105 transition-all duration-500">
                                        <img src={post.images?.[0] || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=200'} className="w-full h-full object-cover" alt="" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-base font-black text-slate-900 truncate tracking-tight mb-2 group-hover:text-blue-600 transition-colors uppercase">{post.title || t('dashboard.initiative')}</p>
                                        <div className="flex gap-6">
                                            <div className="flex items-center gap-1.5 opacity-60">
                                                <span className="material-symbols-outlined text-[14px] text-blue-500 filled">favorite</span>
                                                <span className="text-xs font-black tabular-nums">{post.likes_count || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 opacity-60">
                                                <span className="material-symbols-outlined text-[14px] text-indigo-500 filled">forum</span>
                                                <span className="text-xs font-black tabular-nums">{post.comments_count || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                        <p className="text-xs font-black text-slate-400">#{i + 1}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                                    <span className="material-symbols-outlined text-6xl mb-4">analytics</span>
                                    <p className="text-xs font-black uppercase tracking-[0.2em]">{t('dashboard.waitingData')}</p>
                                </div>
                            )}
                        </div>
                        {topPosts.length > 0 && (
                            <div className="mt-8 p-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-[32px] shadow-xl relative overflow-hidden group">
                                <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="relative z-10 flex items-center justify-between">
                                    <p className="text-white text-[10px] font-black uppercase tracking-widest">{t('dashboard.excellentPace')}</p>
                                    <p className="text-blue-400 text-[9px] font-bold uppercase tracking-widest">{t('dashboard.keepPublishing')}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Upgrade Call to Action */}
                <div className="mt-12 bg-gradient-to-br from-slate-900 to-blue-900 rounded-[56px] p-12 text-center relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 size-64 bg-blue-500/10 blur-[100px] rounded-full"></div>
                    <div className="relative z-10">
                        <h3 className="text-3xl font-black text-white tracking-tighter mb-4">{t('dashboard.wantToSeeMore')}</h3>
                        <p className="text-blue-200/80 mb-8 max-w-lg mx-auto text-sm leading-relaxed">
                            {t('dashboard.upgradeDesc')}
                        </p>
                        <button
                            onClick={() => navigate(View.PRICING)}
                            className="bg-blue-500 text-white px-10 py-4 rounded-2xl font-black text-sm hover:bg-blue-400 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-500/25"
                        >
                            {t('dashboard.viewPremium')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
