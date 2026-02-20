import React, { useState, useMemo } from 'react';
import { View, NavProps, Project } from '../types';
import { SDGS, POSTS, USERS } from '../constants';
import { PostCard } from '../components/PostCard';
import { ShareSuccessModal } from '../components/ShareSuccessModal';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { useAuth } from '../context/AuthContext';
import { ImageLightbox } from '../components/ImageLightbox';
import { supabase } from '../utils/supabase';
import { formatRelativeTime } from '../utils/timeUtils';

type FilterType = 'all' | 'projects' | 'people' | 'orgs' | 'real_projects';

export const Search: React.FC<NavProps> = ({ navigate }) => {
  const { user, sendMentionNotifications, isLoading: authLoading, params } = useAuth();

  const [query, setQuery] = useState(params?.query || '');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'Todo' },
    { id: 'real_projects', label: 'Proyectos' },
    { id: 'projects', label: 'Publicaciones' },
    { id: 'people', label: 'Personas' },
  ];

  const getSdgInfo = (id: number) => SDGS.find(s => s.id === id);

  // --- FILTERING LOGIC ---
  const [dbPeople, setDbPeople] = useState<any[]>([]);
  const [dbProjects, setDbProjects] = useState<any[]>([]);
  const [dbOrgs, setDbOrgs] = useState<any[]>([]);
  const [dbRealProjects, setDbRealProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const currentUser = user;

  // Use interaction hook for posts (stored in dbProjects variable)
  const {
    activeCommentSectionId,
    setActiveCommentSectionId,
    activeMenuPostId,
    setActiveMenuPostId,
    activeMenuCommentId,
    setActiveMenuCommentId,
    activeReplyToId,
    setActiveReplyToId,
    editingComment,
    setEditingComment,
    handleToggleLike,
    handleDeletePost,
    handleShare,
    handleAddComment,
    handleToggleCommentLike,
    handleAddCommentReply,
    handleDeleteComment,
    onSaveEditComment,
    showShareModal,
    setShowShareModal,
    copiedUrl
  } = usePostInteractions(dbProjects, setDbProjects, currentUser, sendMentionNotifications);

  // Lightbox needed for PostCard
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  // Recent Searches State
  // Recent Searches State
  // STORAGE STRATEGY: LocalStorage
  // We use LocalStorage because it is the most SCALABLE solution. 
  // It costs $0 in database, has 0ms latency, and respects user privacy.
  // Storing millions of user searches in the DB would be inefficient and expensive.
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('recentSearches');
    return saved ? JSON.parse(saved) : []; // Default to empty, no fake data
  });

  const addToHistory = (term: string) => {
    if (!term.trim()) return;
    setRecentSearches(prev => {
      // Keep unique, put newest first, limit to 5 items
      const newHistory = [term, ...prev.filter(t => t !== term)].slice(0, 5);
      localStorage.setItem('recentSearches', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const clearHistory = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  React.useEffect(() => {
    const fetchResults = async () => {
      if (!query) {
        setDbPeople([]);
        setDbProjects([]);
        setDbRealProjects([]);
        return;
      }

      setLoading(true);

      try {
        let profilesFound: any[] = [];
        let matchingUserIds: string[] = [];

        // --- 1. SEARCH PEOPLE ---
        if (activeFilter === 'all' || activeFilter === 'people') {
          let peopleQuery = supabase
            .from('profiles')
            .select('*');

          if (query.startsWith('@')) {
            const handle = query.slice(1);
            peopleQuery = peopleQuery.ilike('username', `%${handle}%`);
          } else {
            peopleQuery = peopleQuery.or(`name.ilike.%${query}%,role.ilike.%${query}%,username.ilike.%${query}%`);
          }

          const { data: profiles, error: profilesError } = await peopleQuery.limit(20);

          if (profiles && !profilesError) {
            profilesFound = profiles.map(p => ({
              ...p,
              id: p.id,
              img: p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random`,
              mutual: Math.floor(Math.random() * 20) + 1
            }));
            setDbPeople(profilesFound);
            matchingUserIds = profiles.map(p => p.id);
          }
        } else {
          setDbPeople([]);
        }

        // --- 2. SEARCH ORGANIZATIONS ---
        if (activeFilter === 'all' || activeFilter === 'orgs') {
          let orgsQuery = supabase
            .from('organizations')
            .select('*');

          if (query.startsWith('@')) {
            const handle = query.slice(1);
            orgsQuery = orgsQuery.ilike('handle', `%${handle}%`);
          } else {
            orgsQuery = orgsQuery.or(`name.ilike.%${query}%,category.ilike.%${query}%,handle.ilike.%${query}%`);
          }

          const { data: orgs, error: orgsError } = await orgsQuery.limit(10);
          if (orgs && !orgsError) {
            setDbOrgs(orgs.map(o => ({
              ...o,
              img: o.logo || 'https://via.placeholder.com/150',
              members: o.members_count || 'Verificado'
            })));
          }
        } else {
          setDbOrgs([]);
        }

        // --- 2. SEARCH POSTS (PROJECTS) ---
        // Run this query if filter is 'all' OR 'projects'
        if (activeFilter === 'all' || activeFilter === 'projects') {
          // Strategy A: Content matches query
          const contentRes = await supabase
            .from('posts')
            .select('*, user:profiles!user_id(*)')
            .or(`title.ilike.%${query}%,content.ilike.%${query}%`);

          // Strategy B: Author matches query (using IDs found in step 1)
          let authorRes = { data: [], error: null } as any;

          if (matchingUserIds.length > 0) {
            authorRes = await supabase
              .from('posts')
              .select('*, user:profiles!user_id(*)')
              .in('user_id', matchingUserIds);
          }

          const contentPosts = contentRes.data || [];
          const authorPosts = authorRes.data || [];

          // Merge and Deduplicate
          const allPosts = [...contentPosts, ...authorPosts];
          const uniquePostsMap = new Map();
          allPosts.forEach(post => {
            uniquePostsMap.set(post.id, post);
          });
          const finalPosts = Array.from(uniquePostsMap.values());

          if (finalPosts.length > 0) {
            const mappedPosts = finalPosts.map(post => ({
              ...post,
              user: post.user || { name: 'Unknown', id: '' },
              isLiked: post.isLiked || false,
              likes: post.likes_count || 0,
              comments: post.comments_count || 0,
              sdgIds: post.sdg_ids || [],
              images: post.images || [],
              time: post.created_at ? formatRelativeTime(post.created_at) : 'Reciente'
            }));
            setDbProjects(mappedPosts);
          } else {
            setDbProjects([]);
          }
        } else {
          setDbProjects([]);
        }

        // --- 3. SEARCH REAL PROJECTS (from 'projects' table) ---
        if (activeFilter === 'all' || activeFilter === 'real_projects') {
          // Strategy A: Content matches query (title or description)
          const projContentRes = await supabase
            .from('projects')
            .select('*, owner:profiles!owner_id(*)')
            .or(`title.ilike.%${query}%,description.ilike.%${query}%`);

          // Strategy B: Owner name/username matches query
          let projOwnerRes = { data: [], error: null } as any;
          if (matchingUserIds.length > 0) {
            projOwnerRes = await supabase
              .from('projects')
              .select('*, owner:profiles!owner_id(*)')
              .in('owner_id', matchingUserIds);
          }

          const contentProjects = projContentRes.data || [];
          const ownerProjects = projOwnerRes.data || [];

          // Merge and Deduplicate
          const allRealProjects = [...contentProjects, ...ownerProjects];
          const uniqueProjectsMap = new Map();
          allRealProjects.forEach(proj => {
            uniqueProjectsMap.set(proj.id, proj);
          });
          const finalRealProjects = Array.from(uniqueProjectsMap.values());

          if (finalRealProjects.length > 0) {
            const mapped = finalRealProjects.map(p => ({
              ...p,
              sdgId: p.sdg_id || p.sdgId,
              ownerId: p.owner_id || p.ownerId,
              title: p.title || 'Proyecto sin título',
              description: p.description || '',
              image: p.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
              progress: p.progress || 0,
              status: p.status || 'Activo',
              lookingFor: p.looking_for || [],
            }));
            setDbRealProjects(mapped);
          } else {
            setDbRealProjects([]);
          }
        } else {
          setDbRealProjects([]);
        }

      } catch (error) {
        console.error("Error searching Supabase:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounce);
  }, [query, activeFilter]);

  const results = useMemo(() => {
    if (!query) return { people: [], projects: [], orgs: [], realProjects: [] };
    return { people: dbPeople, projects: dbProjects, orgs: dbOrgs, realProjects: dbRealProjects };
  }, [query, dbPeople, dbProjects, dbOrgs, dbRealProjects]);

  const hasResults = results.people.length > 0 || results.projects.length > 0 || results.orgs.length > 0 || results.realProjects.length > 0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 mb-6">Buscar</h1>

          <div className="relative mb-6">
            <span className="absolute left-5 top-4 text-slate-400 material-symbols-outlined text-2xl">search</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar proyectos, personas, ODS..."
              className="w-full h-14 pl-14 pr-6 rounded-2xl border-none shadow-lg shadow-slate-200/50 text-lg outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-slate-400"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && addToHistory(query)}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-4 top-4 text-slate-300 hover:text-slate-500"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {filters.map(filter => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors border ${activeFilter === filter.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Empty State / Suggestions */}
        {!query && (
          <div className="animate-[fade-in_0.3s_ease-out]">
            {recentSearches.length > 0 && (
              <div className="mb-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-900">Búsquedas Recientes</h3>
                  <button onClick={clearHistory} className="text-xs font-bold text-primary hover:underline">Borrar</button>
                </div>
                <div className="space-y-2">
                  {recentSearches.map((term, i) => (
                    <div key={i} onClick={() => setQuery(term)} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-slate-300 hover:shadow-sm cursor-pointer transition-all group">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-primary">history</span>
                        <span className="text-slate-600 font-medium">{term}</span>
                      </div>
                      <span className="material-symbols-outlined text-slate-300 text-sm -rotate-45">arrow_forward</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-bold text-slate-900 mb-4">Explorar por ODS</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {SDGS.map(sdg => (
                  <div
                    key={sdg.id}
                    onClick={() => navigate(View.SDG_FEED, { id: sdg.id })}
                    className="aspect-video rounded-xl flex flex-col items-center justify-center text-white cursor-pointer hover:scale-105 transition-transform shadow-sm relative overflow-hidden group"
                    style={{ backgroundColor: sdg.color }}
                  >
                    <span className="material-symbols-outlined text-3xl mb-1 relative z-10">{sdg.icon}</span>
                    <span className="text-xs font-bold relative z-10">ODS {sdg.id}</span>
                    <div className="absolute -right-4 -bottom-4 text-white/20">
                      <span className="material-symbols-outlined text-6xl">{sdg.icon}</span>
                    </div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center z-20">
                      <span className="text-[10px] font-bold leading-tight">{sdg.short}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {query && (
          <div className="space-y-8 animate-[fade-in_0.3s_ease-out]">

            {!hasResults && (
              <div className="text-center py-12 text-slate-500">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">search_off</span>
                <p>No se encontraron resultados para "{query}"</p>
              </div>
            )}

            {/* Organizations Results */}
            {(activeFilter === 'all' || activeFilter === 'orgs') && results.orgs.length > 0 && (
              <div>
                <h3 className="font-bold text-slate-900 mb-4 text-lg">Organizaciones</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {results.orgs.map(org => (
                    <div key={org.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
                      <div className="size-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                        <img src={org.img} alt={org.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 truncate">{org.name}</h4>
                        <p className="text-xs text-slate-500 uppercase font-bold">{org.category}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{org.members} miembros</p>
                      </div>
                      <button className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-bold hover:bg-slate-200">Seguir</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Real Projects Results */}
            {(activeFilter === 'all' || activeFilter === 'real_projects') && results.realProjects.length > 0 && (
              <div>
                <h3 className="font-bold text-slate-900 mb-4 text-lg">Proyectos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {results.realProjects.map((project: any) => {
                    const sdg = SDGS.find(s => s.id === project.sdgId);
                    const owner = project.owner || { name: 'Usuario', avatar: '' };
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
                              className="h-40 bg-slate-200 bg-cover relative"
                              style={{
                                backgroundImage: `url("${(project.image || '').split('#pos=')[0]}")`,
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
                        <div className="p-4 flex-1 flex flex-col">
                          <h3 className="font-bold text-slate-900 text-base mb-1 line-clamp-2 leading-tight group-hover:text-primary transition-colors">{project.title}</h3>
                          <p className="text-sm text-slate-500 line-clamp-2 mb-3 flex-1">{project.description}</p>
                          <div className="mt-auto">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-1">
                              <span>Progreso</span>
                              <span className="text-primary">{project.progress}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-3">
                              <div className="bg-primary h-full rounded-full" style={{ width: `${project.progress}%` }}></div>
                            </div>
                            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                              <div
                                className="size-6 rounded-full bg-cover bg-center bg-slate-200"
                                style={{ backgroundImage: `url("${owner.avatar}")` }}
                              ></div>
                              <span className="text-xs font-bold text-slate-700 truncate">{owner.name}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* People Results */}
            {(activeFilter === 'all' || activeFilter === 'people') && results.people.length > 0 && (
              <div>
                <h3 className="font-bold text-slate-900 mb-4 text-lg">Personas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.people.map(person => (
                    <div
                      key={person.id}
                      className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(View.PROFILE, { userId: person.id })}
                    >
                      <div className="size-14 rounded-full bg-slate-200 overflow-hidden shrink-0">
                        <img src={person.img} alt={person.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 truncate hover:text-primary transition-colors">{person.name}</h4>
                        <p className="text-sm text-slate-500 truncate">{person.role}</p>
                        <p className="text-xs text-slate-400 mt-1">{person.mutual} contactos en común</p>
                      </div>
                      <button className="size-8 rounded-full bg-slate-50 text-slate-400 hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-xl">person_add</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Projects (Posts) Results */}
            {(activeFilter === 'all' || activeFilter === 'projects') && results.projects.length > 0 && (
              <div>
                <h3 className="font-bold text-slate-900 mb-4 text-lg">Publicaciones</h3>
                <div className="grid grid-cols-1 gap-6">
                  {results.projects.map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={currentUser}
                      onNavigate={navigate}
                      onToggleLike={handleToggleLike}
                      onShare={handleShare}
                      onToggleSavedPost={() => { }}
                      isSaved={false}
                      activeCommentSectionId={activeCommentSectionId}
                      onToggleCommentSection={(id) => setActiveCommentSectionId(activeCommentSectionId === id ? null : id)}
                      onOpenLightbox={openLightbox}
                      onToggleCommentLike={handleToggleCommentLike}
                      onAddCommentReply={handleAddCommentReply}
                      onDeleteComment={handleDeleteComment}
                      onStartEditComment={(postId, comment) => setEditingComment({ postId, commentId: comment.id, text: comment.text })}
                      onSaveEditComment={onSaveEditComment}
                      onAddComment={handleAddComment}
                      activeReplyToId={activeReplyToId}
                      setActiveReplyToId={setActiveReplyToId}
                      editingComment={editingComment}
                      setEditingComment={setEditingComment}
                      activeMenuCommentId={activeMenuCommentId}
                      setActiveMenuCommentId={setActiveMenuCommentId}
                      isOwner={currentUser.id === post.user.id}
                      activeMenuPostId={activeMenuPostId}
                      setActiveMenuPostId={setActiveMenuPostId}
                      onStartEditPost={() => { }}
                      onDeletePost={handleDeletePost}
                    />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
      <ImageLightbox isOpen={isLightboxOpen} onClose={() => setIsLightboxOpen(false)} images={lightboxImages} initialIndex={lightboxIndex} />

      <ShareSuccessModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        copiedUrl={copiedUrl}
      />
    </div>
  );
};
