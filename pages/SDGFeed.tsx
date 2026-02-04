import React, { useState } from 'react';
import { View, NavProps, ID } from '../types';
import { useAuth } from '../context/AuthContext';
import { SDGS, POSTS, USERS, PROJECTS } from '../constants';
import { ImageLightbox } from '../components/ImageLightbox';
import { renderBadge, renderContent } from '../utils/renderers';
import { PostCard } from '../components/PostCard';
import { ShareSuccessModal } from '../components/ShareSuccessModal';
import { ComingSoonModal } from '../components/ComingSoonModal';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { ProjectCard } from '../components/ProjectCard';

export const SDGFeed: React.FC<NavProps> = ({ navigate, params }) => {
  const { followedSdgIds, toggleFollowSdg, sendMentionNotifications } = useAuth();
  // Use param id or default to 13 (Climate) if none provided
  const sdgId = params?.id || 13;
  const sdg = SDGS.find(s => s.id === sdgId);
  const currentUser = useAuth().user || USERS[0];

  const isFollowing = followedSdgIds.includes(Number(sdgId));

  // Lightbox State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  // State for dynamic data
  const [relevantPosts, setRelevantPosts] = useState<any[]>([]);
  const [relevantProjects, setRelevantProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [globalStats, setGlobalStats] = useState({ totalPosts: 0, totalProjects: 0, totalInteractions: 0 });
  const [activeFeedTab, setActiveFeedTab] = useState<'posts' | 'projects'>('posts');

  // Use the interaction hook
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
  } = usePostInteractions(relevantPosts, setRelevantPosts, currentUser, sendMentionNotifications);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const targetSdgId = Number(sdgId);

        // Fetch Posts for this SDG
        const { data: postsData, error: postsError } = await import('../utils/supabase')
          .then(mod => mod.supabase
            .from('posts')
            .select('*')
            .contains('sdg_ids', [targetSdgId])
            .order('created_at', { ascending: false })
          );

        // Fetch Global Counts and Metrics for this SDG
        const supabase = (await import('../utils/supabase')).supabase;

        const [postsCountRes, projectsCountRes, interactionsRes] = await Promise.all([
          // Total global posts for this SDG
          supabase.from('posts').select('*', { count: 'exact', head: true }).contains('sdg_ids', [targetSdgId]),
          // Total global projects for this SDG
          supabase.from('projects').select('*', { count: 'exact', head: true }).eq('sdg_id', targetSdgId),
          // Total global interactions (sum of likes and comments from all posts of this SDG)
          supabase.from('posts').select('likes_count, comments_count').contains('sdg_ids', [targetSdgId])
        ]);

        const totalInteractions = (interactionsRes.data || []).reduce(
          (acc, curr) => acc + (Number(curr.likes_count) || 0) + (Number(curr.comments_count) || 0),
          0
        );

        setGlobalStats({
          totalPosts: postsCountRes.count || 0,
          totalProjects: projectsCountRes.count || 0,
          totalInteractions: totalInteractions
        });

        if (postsData && !postsError) {
          const formattedPosts = await Promise.all(postsData.map(async (p) => {
            // Resolve User
            let userData = null;
            if (p.user_id) {
              const { data: user } = await import('../utils/supabase')
                .then(mod => mod.supabase.from('profiles').select('*').eq('id', p.user_id).single());
              userData = user;
            }
            if (!userData) userData = USERS.find(u => u.id === p.user_id) || USERS[0] || { id: 'unknown', name: 'Usuario', avatar: '' };

            return {
              ...p,
              user: userData,
              time: p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Reciente',
              sdgIds: p.sdg_ids || [],
              likes: p.likes_count || 0,
              comments: p.comments_count || 0,
              recentComments: [],
              images: p.images || []
            };
          }));
          setRelevantPosts(formattedPosts);
        }

        // Fetch Projects for this SDG
        const { data: projectsData } = await import('../utils/supabase')
          .then(mod => mod.supabase
            .from('projects')
            .select('*')
            .eq('sdg_id', targetSdgId)
          );

        if (projectsData) {
          setRelevantProjects(projectsData.map(p => ({
            ...p,
            ownerId: p.owner_id,
            sdgId: p.sdg_id,
            raisedAmount: p.raised_amount,
            volunteersCount: p.volunteers_count,
            lookingFor: p.looking_for || []
          })));
        }

      } catch (error) {
        console.error("Error fetching SDG feed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [sdgId]);

  // Total Interactions helper
  const totalInteractions = relevantPosts.reduce((acc, p) => acc + (p.likes || 0) + (p.comments || 0), 0);

  if (!sdg) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Banner */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto pt-6 px-6">
          <div className="relative overflow-hidden rounded-2xl shadow-lg text-white mb-8" style={{ backgroundColor: sdg.color }}>
            <div className="absolute -right-20 -top-20 opacity-10 pointer-events-none"><span className="material-symbols-outlined text-[400px]">{sdg.icon}</span></div>
            <div className="relative z-10 p-10 flex flex-col md:flex-row items-end justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-block bg-white/20 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider mb-4">ODS {sdg.id}</div>
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-2">{sdg.id}. {sdg.label}</h1>
                <p className="text-lg opacity-90 font-medium">Conectando innovadores para alcanzar esta meta global.</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right border-r border-white/20 pr-6">
                  <span className="block text-2xl font-bold">{globalStats.totalPosts}</span>
                  <span className="text-xs opacity-80 uppercase">Publicaciones</span>
                </div>
                <button
                  onClick={() => toggleFollowSdg(sdg.id)}
                  className={`px-6 py-3 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2 ${isFollowing ? 'bg-white/10 backdrop-blur-md text-white border border-white/30' : 'bg-white text-slate-900 hover:bg-slate-50'}`}
                  style={{ color: isFollowing ? 'white' : sdg.color }}
                >
                  <span className={`material-symbols-outlined ${isFollowing ? 'filled text-white' : ''}`}>
                    {isFollowing ? 'check_circle' : 'add'}
                  </span>
                  {isFollowing ? 'Siguiendo ODS' : 'Seguir ODS'}
                </button>
              </div>
            </div>
            <div className="w-full h-1.5 bg-black/20 mt-4"><div className="h-full bg-yellow-400 w-[65%]"></div></div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          {/* Feed Filter */}
          <div className="flex gap-8 border-b border-slate-200 pb-1 mb-6 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveFeedTab('posts')}
              className={`pb-3 border-b-2 font-bold transition-all flex items-center gap-2 ${activeFeedTab === 'posts' ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}
            >
              <span className="material-symbols-outlined text-xl">feed</span>
              Publicaciones
            </button>
            <button
              onClick={() => setActiveFeedTab('projects')}
              className={`pb-3 border-b-2 font-bold transition-all flex items-center gap-2 ${activeFeedTab === 'projects' ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}
            >
              <span className="material-symbols-outlined text-xl">rocket_launch</span>
              Proyectos de Impacto
            </button>
          </div>

          {activeFeedTab === 'posts' ? (
            relevantPosts.length > 0 ? (
              relevantPosts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onNavigate={navigate}
                  onToggleLike={handleToggleLike}
                  onShare={handleShare}
                  onToggleSavedPost={() => { }} // Not implemented here yet
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
                  onStartEditPost={() => { }} // Need modal logic if we want edit
                  onDeletePost={handleDeletePost}
                />
              ))
            ) : (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                <div className="size-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <span className="material-symbols-outlined text-3xl">post_add</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Aún no hay publicaciones</h3>
                <p className="text-slate-500 mb-4">Sé el primero en compartir un proyecto sobre {sdg.label}.</p>
                <button
                  onClick={() => navigate(View.FEED)} // Just a redirect to start posting
                  className="text-primary font-bold hover:underline"
                >
                  Ir al Feed
                </button>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-[fade-in_0.3s_ease-out]">
              {relevantProjects.length > 0 ? (
                relevantProjects.map(proj => (
                  <ProjectCard
                    key={proj.id}
                    project={proj}
                    onNavigate={navigate}
                  />
                ))
              ) : (
                <div className="col-span-full text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                  <div className="size-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                    <span className="material-symbols-outlined text-3xl">rocket_launch</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">No hay proyectos activos</h3>
                  <p className="text-slate-500 mb-4">¿Tienes una iniciativa para el ODS {sdg.id}? ¡Iníciala hoy!</p>
                  <button
                    onClick={() => navigate(View.CREATE_PROJECT)}
                    className="bg-primary text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-primary/20"
                  >
                    Crear Proyecto
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900">Métricas de Impacto</h3>
              <span className="material-symbols-outlined text-primary">monitoring</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <span className="block text-2xl font-bold text-green-700">+{globalStats.totalProjects}</span>
                <span className="text-xs font-bold text-slate-600">Proyectos</span>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <span className="block text-2xl font-bold text-blue-700">{globalStats.totalInteractions}</span>
                <span className="text-xs font-bold text-slate-600">Interacciones</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-2">¿Trabajas en el ODS {sdg.id}?</h4>
            <p className="text-sm text-slate-600 mb-4">Únete a la red de expertos y consigue financiación para tu proyecto.</p>
            <button
              onClick={() => setShowComingSoon(true)}
              className="w-full py-2 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition-colors"
            >
              Aplicar a Grants
            </button>
          </div>
        </div>
      </div>

      <ImageLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        images={lightboxImages}
        initialIndex={lightboxIndex}
      />

      <ShareSuccessModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        copiedUrl={copiedUrl}
      />

      <ComingSoonModal
        isOpen={showComingSoon}
        onClose={() => setShowComingSoon(false)}
        title="Beneficio Enterprise"
        message="Próximamente más funcionalidades de financiación y grants disponibles para usuarios Enterprise."
        icon="stars"
      />
    </div>
  );
};
