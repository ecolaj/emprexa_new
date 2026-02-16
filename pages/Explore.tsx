import React, { useState, useEffect } from 'react';
import { View, NavProps, ID, Post, Project, User } from '../types';
import { SDGS, POSTS, USERS, PROJECTS } from '../constants';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { UpgradeModal } from '../components/UpgradeModal';

export const Explore: React.FC<NavProps> = ({ navigate }) => {
  const { user, followedUserIds, toggleFollowUser } = useAuth();

  type TabType = 'trends' | 'projects' | 'ods' | 'users';
  const [activeTab, setActiveTab] = useState<TabType>('trends');
  const [trendingProjects, setTrendingProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sortedSdgs, setSortedSdgs] = useState<any[]>(SDGS);
  const [trendingTopics, setTrendingTopics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeContent, setUpgradeContent] = useState({ title: '', description: '', plan: '' });

  // FIX: Safe currentUser reference - never use users[0] when array might be empty
  const currentUser = user || {
    id: 'guest',
    name: 'Usuario',
    role: 'Invitado',
    avatar: 'https://cdn-icons-png.flaticon.com/512/847/847969.png',
    sdgInterests: [],
    plan: 'free'
  };

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch Projects
        const { data: projData, error: projError } = await supabase
          .from('projects')
          .select('*, team:project_members(profiles(*))')
          .order('progress', { ascending: false })
          .limit(3);

        if (projError) {
          console.error('Error fetching projects:', projError);
          setTrendingProjects([]);
        } else if (projData) {
          const formattedProjects = projData.map(p => ({
            ...p,
            id: p.id,
            sdgId: p.sdg_id || p.sdgId,
            ownerId: p.owner_id || p.ownerId,
            orgId: p.org_id || p.orgId,
            title: p.title || 'Proyecto sin título',
            description: p.description || '',
            image: p.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
            progress: p.progress || 0,
            status: p.status || 'Activo',
            lookingFor: p.looking_for || [],
            team: (p.team || []).map((m: any) => m.profiles || {}).filter((t: any) => t && t.id),
            donationsEnabled: p.donations_enabled || false
          }));
          setTrendingProjects(formattedProjects);
        }

        // Fetch ALL Projects for the new tab
        const { data: allProjData, error: allProjError } = await supabase
          .from('projects')
          .select('*, team:project_members(profiles(*))')
          .order('created_at', { ascending: false });

        if (allProjData) {
          const formattedAllProjects = allProjData.map(p => ({
            ...p,
            id: p.id,
            sdgId: p.sdg_id || p.sdgId,
            ownerId: p.owner_id || p.ownerId,
            orgId: p.org_id || p.orgId,
            title: p.title || 'Proyecto sin título',
            description: p.description || '',
            image: p.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
            progress: p.progress || 0,
            status: p.status || 'Activo',
            lookingFor: p.looking_for || [],
            team: (p.team || []).map((m: any) => m.profiles || {}).filter((t: any) => t && t.id),
            donationsEnabled: p.donations_enabled || false
          }));
          setAllProjects(formattedAllProjects);
        }

        // Fetch All Users for recommendations
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('*')
          .select('*')
          .limit(50);

        if (userError) {
          console.error('Error fetching users:', userError);
          setUsers([]);
        } else if (userData) {
          const formattedUsers = userData.map(u => ({
            id: u.id,
            name: u.name || 'Usuario',
            role: u.role || 'Miembro',
            avatar: u.avatar || 'https://cdn-icons-png.flaticon.com/512/847/847969.png',
            email: u.email,
            cover: u.cover,
            bio: u.bio,
            location: u.location,
            organizationId: u.organization_id,
            organizationName: u.organization_name,
            sdgInterests: u.sdg_interests || [],
            plan: (u.plan as any) || 'free',
            status: u.status || 'active'
          }));
          setUsers(formattedUsers);
        }

        // --- NEW: FETCH TRENDING TOPICS ---
        // We look for posts with high engagement
        const { data: popularPosts } = await supabase
          .from('posts')
          .select('*')
          .order('likes_count', { ascending: false })
          .limit(20);

        if (popularPosts) {
          // Algorithm: 
          // 1. Get most active SDGs (from posts)
          // 2. Identify hashtags in content
          // 3. Balance between user interests and "Discovery" (popular items outside interests)

          const interests = currentUser.sdgInterests || [];

          // Count SDG occurrences in popular posts
          const sdgWeight: Record<number, number> = {};
          popularPosts.forEach(p => {
            (p.sdg_ids || []).forEach((id: number) => {
              sdgWeight[id] = (sdgWeight[id] || 0) + (p.likes_count || 0) + (p.comments_count || 0) + 5;
            });
          });

          // SOCIAL SIGNAL: Boost SDGs from people the user follows
          (followedUserIds || []).forEach(followedId => {
            const followedProfile = users.find(u => u.id === followedId);
            if (followedProfile) {
              (followedProfile.sdgInterests || []).forEach(id => {
                sdgWeight[id] = (sdgWeight[id] || 0) + 15; // Higher weight for network connections
              });
            }
          });

          // Sort SDGs by weight
          const topSdgs = Object.entries(sdgWeight)
            .map(([id, weight]) => ({ id: Number(id), weight }))
            .sort((a, b) => b.weight - a.weight);

          const topics = [];

          // Slot 1: Top Interest SDG (Discovery)
          const interestSdgs = topSdgs.filter(s => interests.includes(s.id));
          const discoverySdgs = topSdgs.filter(s => !interests.includes(s.id));

          // Fill 4 slots
          // Slot 1 & 2: Interests (if any)
          if (interestSdgs[0]) topics.push(interestSdgs[0].id);
          if (interestSdgs[1]) topics.push(interestSdgs[1].id);

          // Slot 3 & 4: Discovery (Popular things the user doesn't follow yet)
          if (discoverySdgs[0]) topics.push(discoverySdgs[0].id);
          if (discoverySdgs[1]) topics.push(discoverySdgs[1].id);

          // Fill remaining from topSdgs if not enough
          topSdgs.forEach(s => {
            if (topics.length < 4 && !topics.includes(s.id)) topics.push(s.id);
          });

          // Final Fallback if empty
          if (topics.length < 4) {
            [13, 7, 5, 2].forEach(id => {
              if (topics.length < 4 && !topics.includes(id)) topics.push(id);
            });
          }

          // Map to UI format
          const formattedTopics = topics.map(id => {
            const sdg = SDGS.find(s => s.id === id);
            const count = sdgWeight[id] || Math.floor(Math.random() * 100);

            // Lógica para elegir una de las 3 fotos locales (.avif) al azar
            const randomPhotoNum = Math.floor(Math.random() * 3) + 1;
            const sdgStr = id.toString().padStart(2, '0');
            const photoStr = randomPhotoNum.toString().padStart(2, '0');
            const localImage = `/assets/sdgs/${sdgStr}-${photoStr}.avif`;

            return {
              id: id,
              tag: sdg?.label || `ODS ${id}`,
              short: sdg?.short || 'Impacto',
              posts: count > 1000 ? `${(count / 1000).toFixed(1)}k` : count,
              image: localImage,
              color: sdg?.color || '#000',
              icon: sdg?.icon || 'grade',
              isInterest: interests.includes(id)
            };
          });

          setTrendingTopics(formattedTopics);
        }
      } catch (error) {
        console.error('Error fetching explore data:', error);
        if (mounted) {
          setTrendingProjects(PROJECTS.slice(0, 3));
          setUsers(USERS.filter(u => u.id !== user?.id).slice(0, 8));
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [user]);

  const [sdgStats, setSdgStats] = useState<Record<number, { projects: number, posts: number }>>({});

  useEffect(() => {
    let mounted = true;
    const fetchSdgStats = async () => {
      try {
        // Fetch ALL projects SDG IDs only
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('sdg_id');

        // Fetch ALL posts SDG IDs only
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select('sdg_ids');

        if (mounted) {
          const stats: Record<number, { projects: number, posts: number }> = {};

          // Initialize stats
          SDGS.forEach(sdg => {
            stats[sdg.id] = { projects: 0, posts: 0 };
          });

          // Count Projects
          if (!projectError && projectData) {
            projectData.forEach((p: any) => {
              const id = p.sdg_id;
              if (stats[id]) {
                stats[id].projects++;
              }
            });
          } else {
            // Do nothing, leave at 0
          }

          // Count Posts
          if (!postError && postData) {
            postData.forEach((p: any) => {
              const ids: number[] = p.sdg_ids || [];
              ids.forEach(id => {
                if (stats[id]) {
                  stats[id].posts++;
                }
              });
            });
          } else {
            // Do nothing, leave at 0
          }

          setSdgStats(stats);
        }
      } catch (err) {
        console.error("Error fetching SDG stats", err);
      }
    };

    fetchSdgStats();
    return () => { mounted = false; };
  }, []);

  const getProjectCount = (sdgId: number) => {
    return sdgStats[sdgId]?.projects || 0;
  };

  const getPostCount = (sdgId: number) => {
    return sdgStats[sdgId]?.posts || 0;
  };

  const getSdgInfo = (id: number) => SDGS.find(s => s.id === id);

  const getUser = (id: ID) => {
    const foundUser = users.find(u => u.id === id);
    if (foundUser) return foundUser;

    // Fallback user object
    return {
      id: id,
      name: 'Usuario',
      role: 'Miembro',
      avatar: 'https://cdn-icons-png.flaticon.com/512/847/847969.png',
      plan: 'free'
    };
  };

  // Mock Trending Hashtags
  const trendingTags = [
    { tag: '#ClimateAction', posts: '15.2k', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80', color: 'bg-green-600' },
    { tag: '#Tech4Good', posts: '8.5k', image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=400&q=80', color: 'bg-blue-600' },
    { tag: '#WomenLeaders', posts: '12k', image: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&w=400&q=80', color: 'bg-purple-600' },
    { tag: '#CircularEconomy', posts: '5.4k', image: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=400&q=80', color: 'bg-amber-600' },
  ];

  // Users Logic
  const otherUsers = users.filter(u => u.id !== user?.id);
  // Display all fetched users, not just a slice
  const displayUsers = otherUsers;

  const renderBadge = (plan: string | undefined) => {
    if (!plan) return null;

    switch (plan) {
      case 'basic':
        return <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">Basic</span>;
      case 'pro':
        return <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1 shrink-0"><span className="material-symbols-outlined text-[10px] filled">verified</span> Pro</span>;
      case 'enterprise':
        return <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider flex items-center gap-1 shrink-0"><span className="material-symbols-outlined text-[10px] filled">verified_user</span> Enterprise</span>;
      default:
        return null; // Free users get no badge
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-500">Cargando contenido de exploración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 pt-8 pb-0">
          <h1 className="text-3xl font-black text-slate-900 mb-2">Explorar el Impacto</h1>
          <p className="text-slate-500 mb-6">Descubre lo que está moviendo al mundo hoy.</p>

          <div className="flex gap-8">
            {[
              { id: 'trends', label: 'Tendencias' },
              { id: 'projects', label: 'Proyectos' },
              { id: 'ods', label: 'ODS' },
              { id: 'users', label: 'Usuarios' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`pb-3 border-b-2 text-sm font-bold transition-colors ${activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto animate-[fade-in_0.3s_ease-out]">

        {/* --- TENDENCIAS TAB --- */}
        {activeTab === 'trends' && (
          <div className="space-y-10">
            {/* Hero Section: Trending Topics */}
            <section>
              <h2 className="font-bold text-slate-900 text-xl mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">trending_up</span> Temas del Momento
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(trendingTopics.length > 0 ? trendingTopics : trendingTags).map((t, i) => (
                  <div
                    key={i}
                    onClick={() => t.id ? navigate(View.SDG_FEED, { id: t.id }) : navigate(View.HASHTAG, { tag: t.tag })}
                    className="group relative h-40 rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 border border-slate-100"
                  >
                    <img src={t.image} alt={t.tag} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>

                    {/* Badge for interests */}
                    {t.isInterest && (
                      <div className="absolute top-3 right-3 bg-primary/90 backdrop-blur-sm text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg animate-pulse">
                        Para ti
                      </div>
                    )}

                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-sm opacity-80">{t.icon || 'trending_up'}</span>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{t.short || 'Tendencia'}</p>
                      </div>
                      <p className="font-bold text-lg leading-tight group-hover:underline line-clamp-2">{t.tag}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex -space-x-1">
                          {[1, 2, 3].map(dot => (
                            <div key={dot} className="size-3 rounded-full border border-white/20 bg-slate-400/50"></div>
                          ))}
                        </div>
                        <p className="text-[10px] opacity-70 font-bold uppercase">{t.posts} interacciones</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Featured Projects (PROJECT CARDS) */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-slate-900 text-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 filled">star</span> Proyectos Destacados
                </h2>
                <button
                  className="text-sm font-bold text-slate-500 hover:text-primary"
                  onClick={() => setActiveTab('projects')}
                >
                  Ver todos
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {trendingProjects.map(project => {
                  const sdg = getSdgInfo(project.sdgId);
                  const owner = getUser(project.ownerId);
                  return (
                    <div
                      key={project.id}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer flex flex-col h-full group"
                      onClick={() => navigate(View.PROJECT_DETAILS, { projectId: project.id })}
                    >
                      {(() => {
                        const [posX, posY] = (project.image || '').split('#pos=')[1]?.split(',') || ['50', '50'];
                        return (
                          <div
                            className="h-48 bg-slate-200 bg-cover relative"
                            style={{
                              backgroundImage: `url("${project.image.split('#pos=')[0]}")`,
                              backgroundPosition: `${posX}% ${posY}%`
                            }}
                          >
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                            {sdg && (
                              <div className="absolute top-3 left-3 bg-white/95 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1" style={{ color: sdg.color }}>
                                <span className="material-symbols-outlined text-sm">{sdg.icon}</span> {sdg.short}
                              </div>
                            )}
                            <div className="absolute bottom-3 right-3">
                              <span className={`text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm uppercase tracking-wide ${project.status === 'Activo' ? 'bg-green-500' : 'bg-slate-400'}`}>
                                {project.status}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="font-bold text-slate-900 text-lg mb-2 line-clamp-2 leading-tight group-hover:text-primary transition-colors">{project.title}</h3>
                        <p className="text-sm text-slate-500 line-clamp-3 mb-4 flex-1">{project.description}</p>

                        <div className="mt-auto">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-1">
                            <span>Meta alcanzada</span>
                            <span className="text-primary">{project.progress}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-4">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${project.progress}%` }}></div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                              <div
                                className="size-6 rounded-full bg-cover bg-center"
                                style={{ backgroundImage: `url("${owner.avatar}")` }}
                              ></div>
                              <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]">{owner.name}</span>
                            </div>
                            <div className="flex -space-x-1.5">
                              {project.team && project.team.slice(0, 3).map((m: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="size-6 rounded-full border-2 border-white bg-cover bg-center bg-slate-200"
                                  style={{ backgroundImage: `url("${m.avatar}")` }}
                                ></div>
                              ))}
                              {project.team && project.team.length > 3 && (
                                <div className="size-6 rounded-full border-2 border-white bg-slate-100 text-[9px] flex items-center justify-center font-bold text-slate-500">
                                  +{project.team.length - 3}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[48px] p-12 text-center text-white relative overflow-hidden shadow-2xl border border-white/5 group">
              <div className="absolute top-0 right-0 size-96 bg-blue-500/10 blur-[120px] rounded-full group-hover:bg-blue-500/20 transition-all duration-1000"></div>
              <div className="relative z-10">
                <div className="size-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
                  <span className="material-symbols-outlined text-3xl text-blue-400">rocket_launch</span>
                </div>
                <h3 className="text-3xl font-black mb-4 tracking-tighter">¿Tienes una iniciativa de impacto?</h3>
                <p className="text-slate-400 mb-8 max-w-xl mx-auto text-lg leading-relaxed">
                  Conecta con organizaciones, encuentra voluntarios y amplifica tu alcance global.
                </p>
                <button
                  onClick={() => {
                    if (user?.plan === 'enterprise') {
                      navigate(View.CREATE_PROJECT);
                    } else {
                      setUpgradeContent({
                        title: 'Gestión Institucional',
                        description: 'La creación de proyectos y equipos está reservada para cuentas Enterprise.',
                        plan: 'Enterprise'
                      });
                      setShowUpgradeModal(true);
                    }
                  }}
                  className="bg-white text-slate-900 px-12 py-4 rounded-2xl font-black hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-3 mx-auto"
                >
                  <span className="material-symbols-outlined font-black">add_circle</span> Empezar Proyecto
                </button>
              </div>
            </div>

            <UpgradeModal
              isOpen={showUpgradeModal}
              onClose={() => setShowUpgradeModal(false)}
              onUpgrade={() => navigate(View.PRICING)}
              title={upgradeContent.title}
              description={upgradeContent.description}
              planName={upgradeContent.plan}
              icon="domain"
            />
          </div>
        )}

        {/* --- PROYECTOS TAB (ALL NEW) --- */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="font-bold text-slate-900 text-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">rocket_launch</span> Todos los Proyectos
                </h2>
                <p className="text-sm text-slate-500">Explora todas las iniciativas de la comunidad.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allProjects.map(project => {
                const sdg = getSdgInfo(project.sdgId);
                const owner = getUser(project.ownerId);
                return (
                  <div
                    key={project.id}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer flex flex-col h-full group"
                    onClick={() => navigate(View.PROJECT_DETAILS, { projectId: project.id })}
                  >
                    {(() => {
                      const [posX, posY] = (project.image || '').split('#pos=')[1]?.split(',') || ['50', '50'];
                      return (
                        <div
                          className="h-48 bg-slate-200 bg-cover relative"
                          style={{
                            backgroundImage: `url("${project.image.split('#pos=')[0]}")`,
                            backgroundPosition: `${posX}% ${posY}%`
                          }}
                        >
                          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                          {sdg && (
                            <div className="absolute top-3 left-3 bg-white/95 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1" style={{ color: sdg.color }}>
                              <span className="material-symbols-outlined text-sm">{sdg.icon}</span> {sdg.short}
                            </div>
                          )}
                          <div className="absolute bottom-3 right-3">
                            <span className={`text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm uppercase tracking-wide ${project.status === 'Activo' ? 'bg-green-500' : 'bg-slate-400'}`}>
                              {project.status}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-bold text-slate-900 text-lg mb-2 line-clamp-2 leading-tight group-hover:text-primary transition-colors">{project.title}</h3>
                      <p className="text-sm text-slate-500 line-clamp-3 mb-4 flex-1">{project.description}</p>

                      <div className="mt-auto">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-1">
                          <span>Meta alcanzada</span>
                          <span className="text-primary">{project.progress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-4">
                          <div className="bg-primary h-full rounded-full" style={{ width: `${project.progress}%` }}></div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            <div
                              className="size-6 rounded-full bg-cover bg-center"
                              style={{ backgroundImage: `url("${owner.avatar}")` }}
                            ></div>
                            <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]">{owner.name}</span>
                          </div>
                          <div className="flex -space-x-1.5">
                            {project.team && project.team.slice(0, 3).map((m: any, idx: number) => (
                              <div
                                key={idx}
                                className="size-6 rounded-full border-2 border-white bg-cover bg-center bg-slate-200"
                                style={{ backgroundImage: `url("${m.avatar}")` }}
                              ></div>
                            ))}
                            {project.team && project.team.length > 3 && (
                              <div className="size-6 rounded-full border-2 border-white bg-slate-100 text-[9px] flex items-center justify-center font-bold text-slate-500">
                                +{project.team.length - 3}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {activeTab === 'ods' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6">
            {sortedSdgs.map((sdg) => {
              const projectCount = getProjectCount(sdg.id);
              const postCount = getPostCount(sdg.id);
              return (
                <div
                  key={sdg.id}
                  onClick={() => navigate(View.SDG_FEED, { id: sdg.id })}
                  className="group relative aspect-[4/5] rounded-xl overflow-hidden cursor-pointer hover:shadow-xl transition-all hover:scale-[1.02] bg-slate-900"
                  style={{ backgroundColor: sdg.color }}
                >
                  <div className="absolute top-4 right-4 text-white opacity-90 text-xl font-black z-20">{sdg.id}</div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:opacity-40 transition-opacity">
                    <span className="material-symbols-outlined text-[120px] text-white">{sdg.icon}</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 p-5 w-full z-20">
                    <h3 className="text-white text-lg font-bold leading-tight mb-2">{sdg.label}</h3>
                    <div className="flex flex-col gap-1 text-white/90">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">folder_open</span>
                        <span className="text-xs font-bold">{projectCount} proyectos</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">dynamic_feed</span>
                        <span className="text-xs font-bold">{postCount} publicaciones</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- USUARIOS TAB --- */}
        {activeTab === 'users' && (
          <div className="space-y-10">
            <section>
              <div className="mb-6">
                <h2 className="font-bold text-slate-900 text-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">handshake</span> Recomendados para ti
                </h2>
                <p className="text-sm text-slate-500">Personas que comparten tus intereses en ODS.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {displayUsers.map(recUser => {
                  const commonSdgs = recUser.sdgInterests?.filter(id =>
                    currentUser.sdgInterests?.includes(id)
                  ) || [];
                  return (
                    <div key={recUser.id} className="bg-white p-5 rounded-xl border border-slate-200 flex items-start gap-4 hover:shadow-md transition-shadow">
                      <div
                        className="size-16 rounded-full bg-cover bg-center shrink-0 border border-slate-100 cursor-pointer"
                        style={{ backgroundImage: `url("${recUser.avatar}")` }}
                        onClick={() => navigate(View.PROFILE, { userId: recUser.id })}
                      ></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3
                                className="font-bold text-slate-900 truncate cursor-pointer hover:underline"
                                onClick={() => navigate(View.PROFILE, { userId: recUser.id })}
                              >
                                {recUser.name}
                              </h3>
                              {renderBadge(recUser.plan)}
                            </div>
                            <p className="text-sm text-slate-500 truncate mb-2">{recUser.role}</p>
                          </div>
                          <button
                            onClick={() => toggleFollowUser(recUser.id)}
                            className={`p-2 rounded-full transition-colors shrink-0 ${followedUserIds.includes(recUser.id)
                              ? 'text-primary bg-primary/10'
                              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                              }`}
                          >
                            <span className={`material-symbols-outlined ${followedUserIds.includes(recUser.id) ? 'filled' : ''}`}>
                              {followedUserIds.includes(recUser.id) ? 'person_check' : 'person_add'}
                            </span>
                          </button>
                        </div>
                        {commonSdgs.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-medium shrink-0">Intereses comunes:</span>
                            <div className="flex -space-x-1">
                              {commonSdgs.slice(0, 3).map(id => {
                                const sdg = getSdgInfo(id);
                                if (!sdg) return null;
                                return (
                                  <div
                                    key={id}
                                    className="size-5 rounded-full border border-white flex items-center justify-center text-white text-[8px] font-bold"
                                    style={{ backgroundColor: sdg.color }}
                                    title={sdg.short}
                                  >
                                    {sdg.id}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};