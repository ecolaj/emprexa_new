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
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [flippedCardIndex, setFlippedCardIndex] = useState<number | null>(null);
  const [isChartFlipped, setIsChartFlipped] = useState(false);
  const [isOdsFlipped, setIsOdsFlipped] = useState(false);
  const [isActivityFlipped, setIsActivityFlipped] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<{ value: string; label: string }[]>([]);

  // --- SMART RANGE FETCHER ---
  useEffect(() => {
    const fetchRange = async () => {
      if (!authUser) return;

      const { data } = await supabase
        .from('posts')
        .select('created_at')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: true });

      if (data && data.length > 0) {
        const start = new Date(data[0].created_at);
        const end = new Date(); // Always allow up to current month
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
        // Fallback to current month if no posts
        const now = new Date();
        const val = now.toISOString().substring(0, 7);
        const lbl = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(now);
        setAvailableMonths([{ value: val, label: lbl.charAt(0).toUpperCase() + lbl.slice(1) }]);
      }
    };
    fetchRange();
  }, [authUser]);

  // Function to toggle SDG filters
  const toggleSdg = (id: number) => {
    setActiveSdgIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

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

        if (activeSdgIds.length > 0) {
          postsQuery = postsQuery.filter('sdg_ids', 'ov', `{${activeSdgIds.join(',')}}`);
          projectsQuery = projectsQuery.in('sdg_id', activeSdgIds);
        }

        const [postsResponse, projResponse, followCount] = await Promise.all([
          postsQuery,
          projectsQuery,
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', authUser.id)
        ]);

        const posts = postsResponse.data || [];
        const projects = projResponse.data || [];

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

        const sorted = [...posts].sort((a, b) => {
          const engagementA = (a.likes_count || 0) + (a.comments_count || 0);
          const engagementB = (b.likes_count || 0) + (b.comments_count || 0);
          return engagementB - engagementA;
        });
        setTopPosts(sorted);

        const activity: Record<number, number> = {};
        posts.forEach(p => {
          const day = new Date(p.created_at).getDate();
          activity[day] = (activity[day] || 0) + 1;
        });
        setActivityData(activity);

        const daysInMonth = new Date(year, month, 0).getDate();
        if (timeGranularity === 'day') {
          const dailyPoints = Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const dayPosts = posts.filter(p => new Date(p.created_at).getDate() === d);
            const val = dayPosts.reduce((acc, p) => acc + (p.likes_count || 0) + (p.comments_count || 0), 0);
            return { name: `${d}`, value: val };
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
            const val = weekPosts.reduce((acc, p) => acc + (p.likes_count || 0) + (p.comments_count || 0), 0);
            return { name: `${i + 1}`, value: val };
          });
          setChartData(weeklyPoints);
        }

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
  }, [authUser, selectedMonth, activeSdgIds, timeGranularity]);

  const handleExportImage = async () => {
    const element = document.getElementById('pdf-report-container');
    if (!element) return;
    setIsExporting(true);

    try {
      // Capturamos el reporte con una resolución 4x para que se vea impecable
      // Aseguramos que el scroll esté al inicio para evitar cortes por posición
      const originalScrollY = window.scrollY;
      window.scrollTo(0, 0);

      const canvas = await html2canvas(element, {
        scale: 4,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        x: 0,
        y: 0,
        onclone: (clonedDoc) => {
          const el = clonedDoc.getElementById('pdf-report-container');
          if (el) {
            el.style.boxShadow = 'none';
            el.style.border = 'none';
            el.style.borderRadius = '0';
            el.style.height = 'auto';
            el.style.paddingBottom = '400px'; // Aire masivo para el footer
            el.style.overflow = 'visible';
          }

          // Forzado de visibilidad y color para elementos críticos
          const corpBadge = clonedDoc.getElementById('pdf-corp-analysis');
          if (corpBadge) {
            corpBadge.style.color = '#1e3a8a';
            corpBadge.style.display = 'inline-block';
            corpBadge.style.opacity = '1';
          }

          const reportIdBox = clonedDoc.getElementById('pdf-report-id');
          if (reportIdBox) {
            reportIdBox.style.background = '#1e3a8a';
            const texts = reportIdBox.getElementsByTagName('p');
            for (let t of texts) {
              t.style.color = '#ffffff';
              t.style.opacity = '1';
            }
          }

          // Estabilización del gráfico: Usamos 100% para que se adapte al contenedor clonado
          const chartBox = clonedDoc.getElementById('pdf-chart-box');
          if (chartBox) {
            chartBox.style.width = '100%';
            chartBox.style.height = '350px';
            chartBox.style.display = 'block';
            chartBox.style.visibility = 'visible';
          }
        }
      });

      window.scrollTo(0, originalScrollY);

      // Descargamos directamente como imagen (estilo Canva)
      // Esto soluciona los problemas de cortes y colores que daban los PDFs
      const link = document.createElement('a');
      link.download = `Reporte_Impacto_${authUser?.name}_${selectedMonth.replace('/', '-')}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();

      setIsPreviewOpen(false);
    } catch (err) {
      console.error('Error al exportar imagen:', err);
    }

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

  const heatmapGrid = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    const padding = Array.from({ length: firstDay });
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const remaining = Array.from({ length: 42 - (padding.length + days.length) });

    return { padding, days, remaining };
  }, [selectedMonth]);

  const monthName = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    const name = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(date);
    return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + year;
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
            <div className="flex items-center bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-sm gap-4 focus-within:ring-4 focus-within:ring-blue-50 transition-all min-w-[220px]">
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

        {/* SDG Pills */}
        <div className="flex flex-col gap-4 mb-12">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Filtrar por Objetivos (ODS)</h3>
            {activeSdgIds.length > 0 && (
              <button
                onClick={() => setActiveSdgIds([])}
                className="text-xs font-black text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">filter_list_off</span>
                Limpiar Filtros
              </button>
            )}
          </div>
          <div className="flex flex-col gap-5 py-4 px-1">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setActiveSdgIds([])}
                className={`px-8 py-5 rounded-[24px] text-xs font-black whitespace-nowrap border-2 shadow-lg transition-all flex items-center gap-3 ${activeSdgIds.length === 0
                  ? 'bg-slate-900 border-transparent text-white shadow-xl scale-105'
                  : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                  }`}
              >
                <span className="material-symbols-outlined text-[20px] font-bold">grid_view</span>
                Resumen General
              </button>
              <div className="h-10 w-[2px] bg-slate-100 mx-2 shrink-0"></div>
              {SDGS.slice(0, 9).map((sdg) => {
                const isActive = activeSdgIds.includes(sdg.id);
                return (
                  <div key={sdg.id} className="relative group">
                    <button
                      onClick={() => toggleSdg(sdg.id)}
                      className={`size-14 rounded-2xl flex items-center justify-center transition-all border-2 ${isActive
                        ? 'shadow-xl scale-110 border-transparent text-white'
                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300 hover:scale-105'
                        }`}
                      style={isActive ? { backgroundColor: sdg.color, boxShadow: `0 10px 25px -5px ${sdg.color}40` } : {}}
                    >
                      <span className="material-symbols-outlined text-[20px] font-black">{sdg.icon}</span>
                    </button>
                    <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 px-4 py-2 bg-white border border-slate-100 text-[10px] font-black rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50 shadow-2xl scale-75 group-hover:scale-100 origin-top flex items-center gap-2">
                      <div className="size-1.5 rounded-full" style={{ backgroundColor: sdg.color }}></div>
                      <span style={{ color: sdg.color }}>{sdg.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:pl-[246px]">
              {SDGS.slice(9).map((sdg) => {
                const isActive = activeSdgIds.includes(sdg.id);
                return (
                  <div key={sdg.id} className="relative group">
                    <button
                      onClick={() => toggleSdg(sdg.id)}
                      className={`size-14 rounded-2xl flex items-center justify-center transition-all border-2 ${isActive
                        ? 'shadow-xl scale-110 border-transparent text-white'
                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300 hover:scale-105'
                        }`}
                      style={isActive ? { backgroundColor: sdg.color, boxShadow: `0 10px 25px -5px ${sdg.color}40` } : {}}
                    >
                      <span className="material-symbols-outlined text-[20px] font-black">{sdg.icon}</span>
                    </button>
                    <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 px-4 py-2 bg-white border border-slate-100 text-[10px] font-black rounded-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50 shadow-2xl scale-75 group-hover:scale-100 origin-top flex items-center gap-2">
                      <div className="size-1.5 rounded-full" style={{ backgroundColor: sdg.color }}></div>
                      <span style={{ color: sdg.color }}>{sdg.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
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
                    <p className="text-slate-400 text-sm font-medium tracking-tight">Interacciones en {monthName}</p>
                  </div>
                  <div className="flex bg-slate-100 p-1.5 rounded-[24px] border border-slate-200/50 shadow-inner">
                    <button
                      onClick={(e) => { e.stopPropagation(); setTimeGranularity('day'); }}
                      className={`px-8 py-3 rounded-[20px] text-xs font-black transition-all ${timeGranularity === 'day' ? 'bg-white shadow-2xl text-slate-900 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                    >Día</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setTimeGranularity('week'); }}
                      className={`px-8 py-3 rounded-[20px] text-xs font-black transition-all ${timeGranularity === 'week' ? 'bg-white shadow-2xl text-slate-900 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                    >Semana</button>
                  </div>
                </div>
                <div className="h-[400px] w-full" onClick={() => setIsChartFlipped(true)} style={{ cursor: 'pointer' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 30, bottom: 25 }}>
                      <defs>
                        <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0095FF" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#0095FF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }} dy={15}>
                        <Label value={timeGranularity === 'day' ? 'Días del Mes' : 'Semanas'} offset={-15} position="insideBottom" style={{ fontSize: '10px', fontWeight: 900, fill: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                      </XAxis>
                      <YAxis domain={['0', 'dataMax + 5']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#cbd5e1' }}>
                        <Label value="Interacciones" angle={-90} position="insideLeft" style={{ fontSize: '10px', fontWeight: 900, fill: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', textAnchor: 'middle' }} />
                      </YAxis>
                      <RechartsTooltip
                        cursor={{ stroke: '#0095FF', strokeWidth: 2, strokeDasharray: '12 12' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 border border-slate-800 text-white px-8 py-5 rounded-[32px] shadow-2xl relative translate-y-[-35px] backdrop-blur-2xl bg-opacity-95 ring-8 ring-slate-900/10 text-center">
                                <p className="text-[10px] font-black opacity-40 uppercase tracking-[0.3em] mb-2">{timeGranularity === 'day' ? 'Día ' : 'Semana '}{payload[0].payload.name}</p>
                                <p className="text-4xl font-black text-blue-400 tabular-nums">{payload[0].value}</p>
                                <p className="text-[8px] font-black uppercase text-slate-400 mt-1">Interacciones</p>
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 translate-y-full border-[12px] border-transparent border-t-slate-900 opacity-95"></div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#0095FF" strokeWidth={4} fill="url(#colorEngagement)" activeDot={{ r: 12, fill: '#0095FF', stroke: '#fff', strokeWidth: 8, shadow: '0 0 60px rgba(0,149,255,0.8)' }} animationDuration={2000} />
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
                    Este gráfico visualiza la intensidad de la interacción social generada por tus publicaciones en <span className="text-blue-400 font-black">{monthName}</span>.
                  </p>
                  <p className="text-sm font-medium leading-relaxed opacity-70">
                    Cada punto representa la suma total de <span className="text-white font-bold">Me gusta</span> y <span className="text-white font-bold">Comentarios</span> recibidos en un periodo determinado ({timeGranularity === 'day' ? 'día' : 'semana'}).
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
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Huella ODS</h3>
                  <div className="size-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
                    <span className="material-symbols-outlined filled">eco</span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  <div className="size-64 mx-auto relative mb-12 drop-shadow-[0_20px_40px_rgba(0,0,0,0.1)] hover:scale-105 transition-transform duration-1000 cursor-pointer" onClick={() => setIsOdsFlipped(true)}>
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

                  <div className="space-y-4 max-h-[160px] overflow-y-auto no-scrollbar pr-2">
                    {pieData.map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between group/item cursor-pointer hover:bg-slate-50 p-2 rounded-2xl transition-all">
                        <div className="flex items-center gap-4">
                          <div className="size-8 rounded-xl flex items-center justify-center shadow-lg group-hover/item:scale-110 transition-transform duration-500" style={{ backgroundColor: entry.color }}>
                            <span className="material-symbols-outlined text-[16px] text-white font-bold">{entry.icon}</span>
                          </div>
                          <span className="text-xs font-black text-slate-500 group-hover/item:text-slate-950 transition-colors truncate max-w-[140px] tracking-tight">{entry.name}</span>
                        </div>
                        <span className="text-xs font-black text-slate-900 bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl group-hover/item:bg-white group-hover/item:shadow-lg transition-all tabular-nums">{entry.percentage}%</span>
                      </div>
                    ))}
                  </div>
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
                    Tu huella ODS se calcula analizando cada publicación y proyecto activo del mes.
                  </p>
                  <p className="text-sm font-medium leading-relaxed opacity-70">
                    El gráfico muestra la distribución porcentual basada en las <span className="text-emerald-400 font-bold">menciones directas</span> de los Objetivos de Desarrollo Sostenible.
                  </p>
                  <p className="text-sm font-medium leading-relaxed opacity-70 italic">
                    * Un solo post puede contribuir a múltiples ODS, lo que fortalece tu Impact Score global.
                  </p>
                </div>
                <div className="mt-12 px-8 py-4 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                  Click para volver a la Huella
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2 h-[600px]" style={{ perspective: '2000px' }}>
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
                <div className="flex justify-between items-start mb-12 cursor-pointer" onClick={() => setIsActivityFlipped(true)}>
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Actividad Social</h3>
                    <p className="text-slate-400 text-sm font-medium tracking-tight">Historial en {monthName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/30"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Posteos</span>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-7 gap-4 content-start">
                  {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, i) => (
                    <span key={i} className="text-center text-[10px] font-black text-slate-300 mb-4">{day}</span>
                  ))}
                  {heatmapGrid.padding.map((_, i) => <div key={`p-${i}`} className="aspect-square"></div>)}
                  {heatmapGrid.days.map((day) => {
                    const count = activityData[day] || 0;
                    const bgColor = count > 3 ? 'bg-blue-600' : count > 1 ? 'bg-blue-400' : count === 1 ? 'bg-blue-200' : 'bg-slate-50';
                    const textColor = count > 1 ? 'text-white/40' : 'text-slate-300';
                    return (
                      <div
                        key={day}
                        title={`${day}: ${count} posts`}
                        className={`aspect-square rounded-[18px] ${bgColor} hover:ring-8 hover:ring-blue-50 transition-all cursor-crosshair shadow-sm relative group/cell flex items-center justify-center`}
                        onClick={() => setIsActivityFlipped(true)}
                      >
                        <span className={`text-[9px] font-black select-none ${textColor}`}>{day}</span>
                        {count > 0 && (
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">
                            {count} Publicaciones
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 flex justify-between items-center bg-slate-50/50 p-6 rounded-[32px] border border-slate-100">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Volumen Mensual</p>
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
                <h4 className="text-2xl font-black text-slate-900 uppercase tracking-widest mb-6">Mapa de Calor Social</h4>
                <div className="space-y-6 max-w-sm">
                  <p className="text-lg font-medium text-slate-600 leading-relaxed">
                    Visualiza tu consistencia y ritmo de publicación a lo largo de <span className="text-blue-600 font-extrabold">{monthName}</span>.
                  </p>
                  <p className="text-sm font-medium text-slate-400 leading-relaxed">
                    La intensidad del azul indica el volumen de historias compartidas. Un color más oscuro refleja una <span className="text-slate-900 font-bold">mayor presencia social</span> durante ese día.
                  </p>
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-full">
                    Regularidad = Mayor Impacto
                  </p>
                </div>
                <div className="mt-12 px-8 py-4 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                  Click para volver al Calendario
                </div>
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
          <div className="overflow-x-auto no-scrollbar flex-1 max-h-[600px]">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] border-b border-slate-50 sticky top-0 bg-white z-10">
                  <th className="pb-10 font-black">Historias</th>
                  <th className="pb-10 font-black">Meta ODS</th>
                  <th className="pb-10 font-black text-center">Likes</th>
                  <th className="pb-10 font-black text-center">Conversa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topPosts.map((post, i) => {
                  return (
                    <tr key={i} className="group/row hover:bg-slate-50/80 transition-all rounded-[40px]">
                      <td className="py-8 min-w-[300px]">
                        <div className="flex items-center gap-7">
                          <div className="size-20 rounded-[24px] bg-slate-100 bg-cover bg-center shrink-0 border-[6px] border-white shadow-2xl group-hover/row:scale-110 group-hover/row:-rotate-6 transition-transform duration-700" style={{ backgroundImage: `url("${post.images?.[0] || 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=100'}")` }}></div>
                          <span className="text-base font-black text-slate-900 truncate max-w-[200px] tracking-tight group-hover/row:text-blue-600 transition-colors uppercase">{post.title || 'Iniciativa Comunitaria'}</span>
                        </div>
                      </td>
                      <td className="py-8">
                        <div className="flex flex-wrap items-center gap-2 max-w-[150px]">
                          {(post.sdg_ids || []).map((id: number, idx: number) => {
                            const sdg = getSdgInfo(id);
                            return (
                              <div key={idx} className="relative group/sdg cursor-help">
                                <div className="size-10 rounded-xl flex items-center justify-center shadow-sm border border-slate-100 transition-all hover:scale-110 hover:-translate-y-1" style={{ backgroundColor: sdg?.color || '#f1f5f9' }}>
                                  <span className="material-symbols-outlined text-white text-[18px] font-bold">{sdg?.icon || 'eco'}</span>
                                </div>
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover/sdg:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-slate-800">
                                  {sdg?.label || `ODS ${id}`}
                                </div>
                              </div>
                            );
                          })}
                          {(post.sdg_ids || []).length === 0 && (
                            <div className="text-[10px] font-black text-slate-300 uppercase italic">General</div>
                          )}
                        </div>
                      </td>
                      <td className="py-8">
                        <div className="flex flex-col items-center">
                          <span className="text-xl font-black text-slate-900 tabular-nums">{post.likes_count?.toLocaleString() || 0}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total</span>
                        </div>
                      </td>
                      <td className="py-8">
                        <div className="flex flex-col items-center">
                          <span className="text-xl font-black text-slate-900 tabular-nums">{post.comments_count?.toLocaleString() || 0}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Chats</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* PDF PREVIEW MODAL */}
      {/* PDF PREVIEW MODAL */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 lg:p-10">
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-3xl" onClick={() => setIsPreviewOpen(false)}></div>
          <div className="relative bg-[#f8fafc] w-full max-w-6xl h-[95vh] rounded-[72px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-700 border border-white/20">
            {/* Modal Header */}
            <div className="px-12 py-8 border-b border-slate-200 flex justify-between items-center bg-white/50 backdrop-blur-xl shrink-0">
              <div className="flex items-center gap-8">
                <div className="size-16 bg-gradient-to-br from-blue-600 to-blue-400 rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-2xl shadow-blue-500/30">E</div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Impact Executive Report</h2>
                  <div className="flex items-center gap-3">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <p className="text-slate-500 text-sm font-bold tracking-tight uppercase">Dashboard Intelligence Live Preview</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right mr-4 hidden md:block">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Periodo Reportado</p>
                  <p className="text-lg font-black text-slate-900 leading-none">{monthName}</p>
                </div>
                <button onClick={() => setIsPreviewOpen(false)} className="size-14 rounded-full bg-white text-slate-400 hover:text-red-500 transition-all flex items-center justify-center shadow-sm border border-slate-100 group">
                  <span className="material-symbols-outlined font-black group-hover:rotate-90 transition-transform">close</span>
                </button>
              </div>
            </div>

            {/* Preview Content Area */}
            <div className="flex-1 overflow-y-auto p-16 bg-slate-100/50 flex justify-center no-scrollbar">
              <div id="pdf-report-container" className="bg-white w-[210mm] min-h-[297mm] shadow-[0_60px_120px_rgba(0,0,0,0.1)] border border-slate-200 p-20 flex flex-col font-sans relative">

                {/* PDF BRANDING WATERMARK */}
                <div className="absolute top-[-5%] right-[-5%] size-[400px] bg-blue-50/30 rounded-full blur-[100px] pointer-events-none"></div>

                {/* PDF HEADER */}
                <div className="flex justify-between items-start mb-20 relative">
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-3 px-5 py-2 bg-blue-50 rounded-full border border-blue-100">
                      <span className="size-2 rounded-full bg-blue-500"></span>
                      <span id="pdf-corp-analysis" className="text-[11px] font-black uppercase tracking-[0.3em] leading-normal" style={{ color: '#1e3a8a', display: 'inline-block', opacity: 1 }}>Corporate Impact Analysis</span>
                    </div>
                    <h1 className="text-7xl font-black text-slate-900 tracking-tighter leading-[1.1] mb-8">
                      Board Summary<span className="text-blue-600">.</span>
                    </h1>
                    <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-[32px] border border-slate-100 w-fit">
                      <img src={authUser?.avatar} className="size-14 rounded-2xl border-2 border-white shadow-xl object-cover" alt="" />
                      <div>
                        <p className="text-lg font-black text-slate-900 leading-tight">{authUser?.name}</p>
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-normal">{authUser?.role || 'Senior Impact Officer'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-6xl font-black text-slate-900 tracking-tighter leading-none mb-4 tabular-nums">{monthName.split(' ')[1]}</p>
                    <p className="text-2xl font-black text-blue-600 uppercase tracking-widest leading-none mb-8">{monthName.split(' ')[0]}</p>
                    <div id="pdf-report-id" className="p-4 rounded-2xl inline-block shadow-xl border border-blue-800" style={{ backgroundColor: '#1e3a8a', display: 'block' }}>
                      <p className="text-[9px] font-black uppercase tracking-widest leading-normal" style={{ color: '#ffffff', opacity: 1 }}>Report ID</p>
                      <p className="text-xs font-black tabular-nums" style={{ color: '#ffffff', opacity: 1 }}>#EMP-{Date.now().toString().slice(-6)}</p>
                    </div>
                  </div>
                </div>

                {/* KPI SECTION WITH INTERPRETATION */}
                <div className="grid grid-cols-3 gap-8 mb-16">
                  {[
                    { label: 'Visibilidad Global', val: counts.reach.toLocaleString(), meta: 'Alcance Estimado', desc: 'Representa el volumen de personas impactadas por la narrativa de sostenibilidad de este periodo.' },
                    { label: 'Eficiencia de Impacto', val: Math.round(counts.impact) + '%', meta: 'Impact Score', desc: 'Indice de cumplimiento de metas ODS basado en la densidad de menciones y proyectos activos.' },
                    { label: 'Flujo de Conversación', val: counts.posts, meta: 'Nivel de Actividad', desc: 'Volumen de publicaciones validadas que contribuyen directamente a la huella social corporativa.' }
                  ].map((k, i) => (
                    <div key={i} className="flex flex-col h-full group">
                      <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-200/60 transition-all flex flex-col flex-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 leading-normal">{k.meta}</p>
                        <p className="text-5xl font-black text-slate-900 tracking-tighter mb-2 tabular-nums leading-tight">{k.val}</p>
                        <p className="text-xs font-black text-blue-600 mb-6 leading-relaxed">{k.label}</p>
                        <div className="mt-auto pt-6 border-t border-slate-200">
                          <p className="text-[10px] font-medium italic text-slate-500 leading-relaxed">
                            <span className="font-black text-slate-700 uppercase mr-1">Insight:</span> {k.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* BOTTOM ANALYTICS GRID */}
                <div className="grid grid-cols-5 gap-12 mb-16">
                  {/* SDG Analysis column */}
                  <div className="col-span-2 space-y-10">
                    <div className="space-y-3">
                      <h4 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-4 leading-tight">
                        Distribución ODS
                      </h4>
                      <p className="text-xs font-medium text-slate-500 leading-relaxed">
                        Mapeo visual de la contribución a los Objetivos de Desarrollo Sostenible en este periodo.
                      </p>
                    </div>
                    <div className="space-y-6">
                      {pieData.slice(0, 8).map((e, idx) => (
                        <div key={idx} className="flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="size-6 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: e.color }}>
                                <span className="material-symbols-outlined text-[14px] font-bold">{e.icon}</span>
                              </div>
                              <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide leading-normal">{e.name}</span>
                            </div>
                            <span className="text-sm font-black text-slate-900 tabular-nums leading-normal ml-4">{e.percentage}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${e.percentage}%`, backgroundColor: e.color }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                      <p className="text-[10px] font-medium text-blue-800 leading-relaxed italic">
                        * El análisis detecta que {pieData[0]?.name || 'el ODS principal'} lidera la agenda estratégica este mes con un {pieData[0]?.percentage}% del total de impacto.
                      </p>
                    </div>
                  </div>

                  {/* Trend Analysis column */}
                  <div className="col-span-3 space-y-10">
                    <div className="space-y-3">
                      <h4 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
                        Tendencia de Engagement
                      </h4>
                      <p className="text-xs font-medium text-slate-500 leading-relaxed">
                        Fluctuación de la interacción social y relevancia del contenido a lo largo del mes.
                      </p>
                    </div>
                    <div id="pdf-chart-box" className="bg-white border border-slate-100 rounded-[48px] p-10 h-[320px] shadow-inner relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-10">
                        <span className="material-symbols-outlined text-8xl font-black">insights</span>
                      </div>
                      <ResponsiveContainer width="99%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 20, right: 40, left: 10, bottom: 20 }}>
                          <defs>
                            <linearGradient id="pdfGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0095FF" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#0095FF" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }}>
                            <Label value="Flujo Mensual" offset={-15} position="insideBottom" style={{ fontSize: '9px', fontWeight: 900, fill: '#1e293b', textTransform: 'uppercase' }} />
                          </XAxis>
                          <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                          <Area isAnimationActive={false} type="monotone" dataKey="value" stroke="#0095FF" strokeWidth={5} fill="url(#pdfGrad)" dot={{ r: 4, fill: '#0095FF', stroke: '#fff', strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex gap-6">
                      <div className="flex-1 p-6 bg-slate-900 rounded-3xl text-white">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-2">Interacciones Max.</p>
                        <p className="text-3xl font-black tabular-nums">{Math.max(...chartData.map(d => d.value))}</p>
                      </div>
                      <div className="flex-1 p-6 bg-white border border-slate-200 rounded-3xl">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Promedio Diario</p>
                        <p className="text-3xl font-black text-slate-900 tabular-nums">{(chartData.reduce((acc, d) => acc + d.value, 0) / (chartData.length || 1)).toFixed(1)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PDF FOOTER */}
                <div className="mt-auto pt-16 border-t-4 border-slate-900 relative">
                  <div className="flex justify-between items-start mb-12">
                    <div className="space-y-2 max-w-sm">
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.4em] mb-4">Emprexa Intelligence Reports © 2026</p>
                      <p className="text-[9px] font-medium text-slate-400 leading-relaxed uppercase">
                        Este documento ha sido generado automáticamente mediante el motor de inteligencia de Emprexa. La veracidad de los datos reflejados es responsabilidad directa del usuario que gestiona la cuenta y las fuentes de datos vinculadas.
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">Fecha de Generación</p>
                      <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-1">{new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                      <p className="text-xs font-black text-blue-600 tabular-nums">{new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} HRS</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-6 rounded-2xl">
                    <div className="flex items-center gap-6">
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] px-4 py-2 border border-slate-200 rounded-lg bg-white">Firma Validada</span>
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] px-4 py-2 border border-slate-200 rounded-lg bg-white">Cifrado de Impacto</span>
                    </div>
                    <div className="bg-slate-900 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.3em]">
                      Página 01 / 01
                    </div>
                  </div>
                  {/* Espaciador de seguridad ultra-profundo para proteger el footer */}
                  <div className="h-48 w-full bg-transparent"></div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="p-10 border-t border-slate-200 bg-white/50 backdrop-blur-xl flex items-center gap-8 shrink-0 shadow-[0_-20px_80px_rgba(0,0,0,0.05)]">
              <div className="flex-1 md:flex items-center gap-6 hidden">
                <div className="size-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined font-black">verified</span>
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Análisis Verificado</p>
                  <p className="text-xs text-slate-500 font-medium tracking-tight whitespace-nowrap">Listo para descarga en alta resolución (A4 300DPI)</p>
                </div>
              </div>
              <div className="flex items-center gap-4 ml-auto">
                <button onClick={() => setIsPreviewOpen(false)} className="px-12 py-5 rounded-3xl text-sm font-black text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-all uppercase tracking-[0.3em]">Cancelar</button>
                <button onClick={handleExportImage} disabled={isExporting} className="bg-slate-900 text-white px-16 py-6 rounded-3xl font-black shadow-2xl hover:bg-slate-800 hover:scale-[1.02] transition-all flex items-center justify-center gap-6 shadow-slate-900/40 uppercase tracking-[0.4em] active:scale-[0.98] disabled:opacity-50 min-w-[340px]">
                  <span className="material-symbols-outlined font-black text-3xl animate-pulse">{isExporting ? 'sync' : 'verified_user'}</span>
                  {isExporting ? 'Procesando...' : 'Descargar Reporte (Imagen)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
