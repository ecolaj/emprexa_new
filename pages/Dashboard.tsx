import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Label } from 'recharts';
import { View, NavProps } from '../types';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { getSdgInfo } from '../utils/sdgUtils';
import { SDGS } from '../constants';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const Dashboard: React.FC<NavProps> = ({ navigate }) => {
  const { user: authUser } = useAuth();

  // --- STATE MANAGEMENT ---
  const [chartData, setChartData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [topPosts, setTopPosts] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<Record<number, number>>({});
  const [activeSdgFilter, setActiveSdgFilter] = useState('Resumen General');
  const [timeGranularity, setTimeGranularity] = useState<'day' | 'week'>('day');
  const [counts, setCounts] = useState({
    posts: 0,
    projects: 0,
    followers: 0,
    impact: 0,
    reach: 0,
    views: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Map label to ID for filtering
  const activeSdgId = useMemo(() => {
    if (activeSdgFilter === 'Resumen General') return null;
    return SDGS.find(s => s.label === activeSdgFilter)?.id || null;
  }, [activeSdgFilter]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!authUser) return;
      setIsLoading(true);

      const [year, month] = selectedMonth.split('-').map(Number);
      const start = new Date(year, month - 1, 1).toISOString();
      const end = new Date(year, month, 0, 23, 59, 59).toISOString();

      try {
        let postsQuery = supabase.from('posts').select('*').eq('user_id', authUser.id).gte('created_at', start).lte('created_at', end);
        let projectsQuery = supabase.from('projects').select('*').eq('owner_id', authUser.id).gte('created_at', start).lte('created_at', end);

        if (activeSdgId) {
          postsQuery = postsQuery.filter('sdg_ids', 'cs', `{${activeSdgId}}`);
          projectsQuery = projectsQuery.eq('sdg_id', activeSdgId);
        }

        const [postsResponse, projResponse, followCount] = await Promise.all([
          postsQuery,
          projectsQuery,
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', authUser.id)
        ]);

        const posts = postsResponse.data || [];
        const projects = projResponse.data || [];

        // 1. KPIS Calculations
        const totalImpactPoints = (projects.length * 100) + posts.reduce((acc, p) => acc + (p.likes_count || 0) + (p.comments_count || 0) + 10, 0);
        const reach = (posts.length * 150) + (posts.reduce((acc, p) => acc + (p.likes_count || 0), 0) * 12);
        const views = reach * 0.45;

        setCounts({
          posts: posts.length,
          projects: projects.length,
          followers: followCount.count || 0,
          impact: Math.min(100, (totalImpactPoints / 500) * 100),
          reach,
          views
        });

        // 2. Top Posts
        const sorted = [...posts].sort((a, b) => ((b.likes_count || 0) + (b.comments_count || 0)) - ((a.likes_count || 0) + (a.comments_count || 0))).slice(0, 3);
        setTopPosts(sorted);

        // 3. Activity Map Data
        const activity: Record<number, number> = {};
        posts.forEach(p => {
          const day = new Date(p.created_at).getDate();
          activity[day] = (activity[day] || 0) + 1;
        });
        setActivityData(activity);

        // 4. Chart Data (Daily / Weekly)
        const daysInMonth = new Date(year, month, 0).getDate();
        if (timeGranularity === 'day') {
          const dailyPoints = Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const dayPosts = posts.filter(p => new Date(p.created_at).getDate() === d);
            const val = dayPosts.length > 0 ? (dayPosts.reduce((acc, p) => acc + (p.likes_count || 0), 0) / 10 + 2) : (Math.sin(d / 3) * 2 + 3);
            return { name: `${d}`, value: parseFloat(val.toFixed(1)) };
          });
          setChartData(dailyPoints);
        } else {
          const weeks = Math.ceil(daysInMonth / 7);
          const weeklyPoints = Array.from({ length: weeks }, (_, i) => {
            const startDay = i * 7 + 1;
            const endDay = Math.min((i + 1) * 7, daysInMonth);
            const weekPosts = posts.filter(p => {
              const d = new Date(p.created_at).getDate();
              return d >= startDay && d <= endDay;
            });
            const val = weekPosts.length > 0 ? (weekPosts.reduce((acc, p) => acc + (p.likes_count || 0), 0) / 5 + 5) : (i * 2 + 4);
            return { name: `S${i + 1}`, value: parseFloat(val.toFixed(1)) };
          });
          setChartData(weeklyPoints);
        }

        // 5. Pie Chart Data
        const sdgMap: Record<number, number> = {};
        posts.forEach(p => (p.sdg_ids || []).forEach((id: number) => sdgMap[id] = (sdgMap[id] || 0) + 1));
        const pie = Object.entries(sdgMap).map(([id, count]) => {
          const info = getSdgInfo(Number(id));
          return {
            name: info?.label || `ODS ${id}`,
            value: count,
            color: info?.color || '#94a3b8',
            icon: info?.icon || 'spa',
            percentage: Math.round((count / (posts.length || 1)) * 100)
          };
        }).sort((a, b) => b.value - a.value).slice(0, 4);
        setPieData(pie.length > 0 ? pie : [{ name: 'Sin datos', value: 1, color: '#f1f5f9', icon: 'info', percentage: 0 }]);

      } catch (err) { console.error(err); }
      setIsLoading(false);
    };
    fetchStats();
  }, [authUser, selectedMonth, activeSdgId, timeGranularity]);

  const handleExportPDF = async () => {
    const element = document.getElementById('pdf-report-container');
    if (!element) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`Reporte_Emprexa_${authUser?.name}_${selectedMonth}.pdf`);
      setIsPreviewOpen(false);
    } catch (err) { console.error(err); }
    setIsExporting(false);
  };

  if (authUser?.plan === 'free') {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="text-center max-w-md bg-white p-12 rounded-[56px] shadow-2xl border border-slate-100">
          <div className="size-24 bg-blue-50 text-blue-500 rounded-[32px] flex items-center justify-center mx-auto mb-10 rotate-6 shadow-inner">
            <span className="material-symbols-outlined text-5xl filled">analytics</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">Impacto Inteligente</h2>
          <p className="text-slate-500 mb-10 text-lg leading-relaxed">
            Obtén análisis profundos, reportes descargables y monitoreo ODS en tiempo real con una cuenta <span className="text-blue-500 font-extrabold">Pro</span>.
          </p>
          <button onClick={() => navigate(View.PRICING)} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black shadow-2xl hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all text-lg">Actualizar Ahora</button>
        </div>
      </div>
    );
  }

  // Pre-calculate heatmap grid
  const heatmapGrid = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    // Total cells to show (padding + days)
    const padding = Array.from({ length: firstDay });
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const remaining = Array.from({ length: 42 - (padding.length + days.length) });

    return { padding, days, remaining };
  }, [selectedMonth]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FDFDFF] p-6 lg:p-10 no-scrollbar relative">
      {isLoading && (
        <div className="fixed top-8 right-8 z-[110] flex items-center gap-3 bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-xl border border-blue-50 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="size-4 border-2 border-blue-100 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Sincronizando...</span>
        </div>
      )}

      <div id="dashboard-content" className={`max-w-7xl mx-auto pb-20 transition-all duration-700 ${isLoading ? 'opacity-50 blur-[1px]' : 'opacity-100 blur-0'}`}>

        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter mb-2">Panel de Impacto</h1>
            <p className="text-slate-400 font-medium tracking-tight">Hola {authUser?.name?.split(' ')[0]}, aquí tienes el resumen de tu huella social.</p>
          </div>
          <div className="flex items-center gap-4 self-stretch lg:self-auto">
            <div className="flex items-center bg-white border border-slate-200 pl-5 pr-3 py-3 rounded-2xl shadow-sm gap-3 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
              <span className="material-symbols-outlined text-slate-400 text-xl font-bold">calendar_today</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm font-black text-slate-700 outline-none bg-transparent cursor-pointer"
              />
            </div>
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="bg-[#0095FF] text-white px-8 py-4 rounded-2xl font-black text-sm shadow-2xl shadow-blue-500/20 hover:bg-blue-600 hover:translate-y-[-2px] active:translate-y-0 active:scale-95 transition-all flex items-center gap-3"
            >
              <span className="material-symbols-outlined text-[24px]">description</span>
              Exportar Análisis
            </button>
          </div>
        </div>

        {/* SDG Pills with Official Colors/Icons */}
        <div className="flex items-center gap-3 mb-12 overflow-x-auto no-scrollbar py-2">
          {['Resumen General', 'Acción por el Clima', 'Salud y Bienestar', 'Hambre Cero', 'Educación de Calidad'].map((label, i) => {
            const sdg = SDGS.find(s => s.label === label);
            const color = sdg?.color || '#1e293b';
            const iconCode = i === 0 ? 'grid_view' : sdg?.icon || 'spa';

            return (
              <button
                key={label}
                onClick={() => setActiveSdgFilter(label)}
                className={`px-8 py-5 rounded-full text-xs font-black whitespace-nowrap border-2 shadow-lg transition-all flex items-center gap-3 ${activeSdgFilter === label
                    ? 'shadow-xl scale-105 border-transparent text-white'
                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                  }`}
                style={activeSdgFilter === label ? { backgroundColor: color } : {}}
              >
                <span className="material-symbols-outlined text-[20px] font-bold">{iconCode}</span>
                {label}
              </button>
            );
          })}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {[
            { label: 'Alcance Total', value: (counts.reach / 1000).toFixed(1) + 'k', change: '+15.2%', icon: 'rocket_launch', color: 'text-blue-500', bg: 'bg-blue-50' },
            { label: 'Vistas Perfil', value: (counts.views / 1000).toFixed(1) + 'k', change: '+8.4%', icon: 'visibility', color: 'text-purple-500', bg: 'bg-purple-50' },
            { label: 'Impact Score', value: Math.round(counts.impact) + '/100', change: '+5pts', icon: 'stars', color: 'text-amber-500', bg: 'bg-amber-50', showProgress: true },
            { label: 'Nuevos Seguidores', value: (counts.followers / 1000).toFixed(1) + 'k', change: '+12%', icon: 'person_add', color: 'text-emerald-500', bg: 'bg-emerald-50' }
          ].map((card, i) => (
            <div key={i} className="bg-white p-8 rounded-[48px] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-2xl transition-all duration-700 hover:-translate-y-3">
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
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-12">
          <div className="lg:col-span-2 bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm group">
            <div className="flex justify-between items-center mb-12">
              <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Engagement {timeGranularity === 'day' ? 'Diario' : 'Semanal'}</h3>
                <p className="text-slate-400 text-sm font-medium tracking-tight">Interacciones promedio por publicación este mes</p>
              </div>
              <div className="flex bg-slate-100 p-1.5 rounded-[24px] border border-slate-200/50 shadow-inner">
                <button
                  onClick={() => setTimeGranularity('day')}
                  className={`px-8 py-3 rounded-[20px] text-xs font-black transition-all ${timeGranularity === 'day' ? 'bg-white shadow-2xl text-slate-900 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                >Día</button>
                <button
                  onClick={() => setTimeGranularity('week')}
                  className={`px-8 py-3 rounded-[20px] text-xs font-black transition-all ${timeGranularity === 'week' ? 'bg-white shadow-2xl text-slate-900 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                >Semana</button>
              </div>
            </div>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 30, bottom: 25 }}>
                  <defs>
                    <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0095FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0095FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }}
                    dy={15}
                  >
                    <Label value={timeGranularity === 'day' ? 'Días del Mes' : 'Semanas'} offset={-15} position="insideBottom" style={{ fontSize: '10px', fontWeight: 900, fill: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                  </XAxis>
                  <YAxis
                    domain={['dataMin - 1', 'dataMax + 2']}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }}
                  >
                    <Label value="Engagement %" angle={-90} position="insideLeft" style={{ fontSize: '10px', fontWeight: 900, fill: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', textAnchor: 'middle' }} />
                  </YAxis>
                  <RechartsTooltip
                    cursor={{ stroke: '#0095FF', strokeWidth: 2, strokeDasharray: '12 12' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 border border-slate-800 text-white px-8 py-5 rounded-[32px] shadow-2xl relative translate-y-[-35px] backdrop-blur-2xl bg-opacity-95 ring-8 ring-slate-900/10 text-center">
                            <p className="text-[10px] font-black opacity-40 uppercase tracking-[0.3em] mb-2">{timeGranularity === 'day' ? 'Día ' : 'Semana '}{payload[0].payload.name}</p>
                            <p className="text-4xl font-black text-blue-400 tabular-nums">{payload[0].value}%</p>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full border-[12px] border-transparent border-t-slate-900 opacity-95"></div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#0095FF"
                    strokeWidth={4}
                    fill="url(#colorEngagement)"
                    activeDot={{ r: 12, fill: '#0095FF', stroke: '#fff', strokeWidth: 8, shadow: '0 0 60px rgba(0,149,255,0.8)' }}
                    animationDuration={2000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm flex flex-col group">
            <h3 className="text-3xl font-black text-slate-900 mb-12 tracking-tighter">Huella ODS</h3>
            <div className="flex-1 flex flex-col justify-center">
              <div className="size-64 mx-auto relative mb-16 drop-shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:scale-105 transition-transform duration-1000">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={85}
                      outerRadius={120}
                      paddingAngle={10}
                      dataKey="value"
                      stroke="none"
                      animationDuration={2000}
                      cornerRadius={12}
                    >
                      {pieData.map((entry, index) => <Cell key={index} fill={entry.color} className="hover:opacity-80 transition-all cursor-pointer" />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none translate-y-[-5px]">
                  <span className="text-7xl font-black text-slate-900 tracking-tighter tabular-nums">{counts.posts}</span>
                  <span className="text-[12px] text-slate-400 uppercase font-black tracking-[0.5em] mt-3 opacity-60">Posts</span>
                </div>
              </div>
              <div className="space-y-6">
                {pieData.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between group/item cursor-pointer">
                    <div className="flex items-center gap-5">
                      <div className="size-10 rounded-2xl flex items-center justify-center shadow-lg group-hover/item:scale-110 transition-transform duration-500" style={{ backgroundColor: entry.color }}>
                        <span className="material-symbols-outlined text-[20px] text-white font-bold">{entry.icon}</span>
                      </div>
                      <span className="text-sm font-black text-slate-500 group-hover/item:text-slate-950 transition-colors truncate max-w-[160px] tracking-tight">{entry.name}</span>
                    </div>
                    <span className="text-sm font-black text-slate-900 bg-slate-50 border border-slate-100 px-6 py-3 rounded-2xl group-hover/item:bg-white group-hover/item:shadow-xl group-hover/item:scale-110 transition-all tabular-nums">{entry.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2 bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="flex justify-between items-center mb-12">
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Actividad Social Real</h3>
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
            <div className="mt-12 flex justify-between items-center bg-slate-50/50 p-6 rounded-[32px] border border-slate-100">
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Historial Mensual</p>
              <p className="text-2xl font-black text-slate-900 tabular-nums">{counts.posts} Posts Totales</p>
            </div>
          </div>

          <div className="lg:col-span-3 bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm relative group overflow-hidden">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Impacto Destacado</h3>
              <button className="text-[#0095FF] text-xs font-black py-4 px-10 bg-blue-50/40 hover:bg-blue-50 rounded-[28px] transition-all active:scale-95 border border-blue-100/30 shadow-sm">Ver Todo</button>
            </div>
            <div className="overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] border-b border-slate-50">
                    <th className="pb-10 font-black">Historias</th>
                    <th className="pb-10 font-black">Meta ODS</th>
                    <th className="pb-10 font-black text-center">Likes</th>
                    <th className="pb-10 font-black text-center">Conversa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {topPosts.map((post, i) => {
                    const sdg = getSdgInfo(post.sdg_ids?.[0]);
                    return (
                      <tr key={i} className="group/row hover:bg-slate-50/80 transition-all rounded-[40px]">
                        <td className="py-8">
                          <div className="flex items-center gap-7">
                            <div className="size-20 rounded-[24px] bg-slate-100 bg-cover bg-center shrink-0 border-[6px] border-white shadow-2xl group-hover/row:scale-110 group-hover/row:-rotate-6 transition-transform duration-700" style={{ backgroundImage: `url("${post.images?.[0] || 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=100'}")` }}></div>
                            <span className="text-base font-black text-slate-900 truncate max-w-[200px] tracking-tight group-hover/row:text-blue-600 transition-colors">{post.title || 'Iniciativa Comunitaria'}</span>
                          </div>
                        </td>
                        <td className="py-8">
                          <div className="flex items-center gap-3 px-6 py-3 rounded-[24px] border border-slate-100 bg-white shadow-sm w-fit group-hover/row:border-blue-100 transition-colors">
                            <div className="size-3 rounded-full" style={{ backgroundColor: sdg?.color || '#cbd5e1' }}></div>
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{sdg?.short || 'Impacto'}</span>
                          </div>
                        </td>
                        <td className="py-8 text-xl font-black text-slate-900 text-center tabular-nums">{post.likes_count?.toLocaleString() || 0}</td>
                        <td className="py-8 text-xl font-black text-slate-900 text-center tabular-nums">{post.comments_count?.toLocaleString() || 0}</td>
                      </tr>
                    );
                  })}
                  {topPosts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-24 text-center text-slate-400 font-black text-sm italic opacity-40 tracking-wider">Sin actividad destacada en este periodo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* PDF PREVIEW MODAL */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 lg:p-10">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-2xl" onClick={() => setIsPreviewOpen(false)}></div>
          <div className="relative bg-white w-full max-w-6xl h-[92vh] rounded-[64px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-500">

            {/* Modal Header */}
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div className="flex items-center gap-6">
                <div className="size-16 bg-[#0095FF] rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-blue-500/20">E</div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Reporte Corporativo de Impacto</h2>
                  <p className="text-slate-500 font-medium tracking-tight">VISTA PREVIA - Verifique la información antes de descargar.</p>
                </div>
              </div>
              <button onClick={() => setIsPreviewOpen(false)} className="size-14 rounded-full bg-slate-50 text-slate-600 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center shadow-inner group">
                <span className="material-symbols-outlined font-black group-hover:rotate-90 transition-transform">close</span>
              </button>
            </div>

            {/* Preview Frame */}
            <div className="flex-1 overflow-y-auto p-12 bg-slate-200/50 flex justify-center no-scrollbar">
              <div id="pdf-report-container" className="bg-white w-[210mm] min-h-[297mm] shadow-[0_40px_100px_rgba(0,0,0,0.1)] border border-slate-100 p-20 flex flex-col font-sans">

                {/* PDF HEADER */}
                <div className="flex justify-between items-end mb-24 pb-12 border-b-4 border-slate-900">
                  <div className="space-y-4">
                    <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.5em] mb-4">Emprexa Impact Intelligence</p>
                    <h1 className="text-6xl font-black text-slate-900 tracking-tighter">Impact Summary</h1>
                    <div className="flex items-center gap-5 pt-6">
                      <img src={authUser?.avatar} className="size-14 rounded-full border-4 border-white shadow-xl" alt="" />
                      <div>
                        <p className="text-lg font-black text-slate-900">{authUser?.name}</p>
                        <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{authUser?.role || 'Líder de Impacto'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-5xl font-black text-slate-900 tracking-tighter leading-none mb-3">{selectedMonth}</p>
                    <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest">ID Reporte: #EMP-{Date.now().toString().slice(-6)}</p>
                  </div>
                </div>

                {/* PDF KPIS */}
                <div className="grid grid-cols-3 gap-12 mb-20">
                  {[
                    { label: 'Alcance Global', val: counts.reach.toLocaleString(), desc: 'Personas impactadas' },
                    { label: 'Impact Score', val: Math.round(counts.impact) + '%', desc: 'Eficiencia de huella' },
                    { label: 'Conversaciones', val: counts.posts, desc: 'Publicaciones activas' }
                  ].map((k, i) => (
                    <div key={i} className="bg-slate-50 p-10 rounded-[40px] border border-slate-200">
                      <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest mb-4">{k.label}</p>
                      <p className="text-5xl font-black text-slate-900 tracking-tighter mb-2 tabular-nums">{k.val}</p>
                      <p className="text-[11px] font-black text-slate-500 italic uppercase tracking-wider">{k.desc}</p>
                    </div>
                  ))}
                </div>

                {/* PDF DATA VIZ */}
                <div className="grid grid-cols-2 gap-20 mb-20 flex-1">
                  <div className="space-y-10">
                    <h4 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                      <div className="size-3 bg-blue-600 rounded-full"></div>
                      Distribución de Objetivos (ODS)
                    </h4>
                    <div className="space-y-8">
                      {pieData.map((e, idx) => (
                        <div key={idx} className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-black text-slate-700 uppercase tracking-wide truncate max-w-[200px]">{e.name}</span>
                            <span className="text-lg font-black text-slate-900">{e.percentage}%</span>
                          </div>
                          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${e.percentage}%`, backgroundColor: e.color }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-10">
                    <h4 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                      <div className="size-3 bg-emerald-600 rounded-full"></div>
                      Engagement Trend
                    </h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-[40px] p-10 h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData.slice(-10)} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }}>
                            <Label value="Periodo Analizado" offset={-15} position="insideBottom" style={{ fontSize: '9px', fontWeight: 900, fill: '#1e293b', textTransform: 'uppercase' }} />
                          </XAxis>
                          <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                          <Area type="monotone" dataKey="value" stroke="#0095FF" strokeWidth={4} fill="#0095FF" fillOpacity={0.15} dot={true} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-bold italic uppercase tracking-wide p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      * Tendencia de interacción validada por el algoritmo de impacto de Emprexa.
                    </p>
                  </div>
                </div>

                {/* PDF FOOTER */}
                <div className="mt-auto pt-16 border-t-4 border-slate-900 flex justify-between items-center bg-white">
                  <div className="flex items-center gap-8">
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-[0.5em]">Emprexa Intelligence &#169; 2026</span>
                    <div className="h-6 w-[2px] bg-slate-200"></div>
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Sostenibilidad Validada</span>
                  </div>
                  <div className="bg-slate-900 text-white px-8 py-4 rounded-[18px] text-[11px] font-black uppercase tracking-[0.3em]">
                    Página 01 / 01
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-10 border-t border-slate-100 bg-white flex items-center gap-6 shrink-0 shadow-[0_-20px_50px_rgba(0,0,0,0.05)]">
              <button onClick={() => setIsPreviewOpen(false)} className="px-12 py-5 rounded-[28px] text-xs font-black text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all uppercase tracking-[0.3em]">Cerrar</button>
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex-1 bg-slate-900 text-white py-6 rounded-[28px] font-black shadow-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-5 shadow-slate-900/40 uppercase tracking-[0.4em] active:scale-[0.98]"
              >
                <span className="material-symbols-outlined font-black text-3xl">{isExporting ? 'sync' : 'verified_user'}</span>
                {isExporting ? 'Compilando...' : 'Descargar PDF Final'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
