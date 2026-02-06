import React, { useState, useEffect } from 'react';
import { View, NavProps, Post, Project, User, ID } from '../types';
import { SDGS, USERS, POSTS, PROJECTS } from '../constants';
import { ImageLightbox } from '../components/ImageLightbox';
import { useAuth } from '../context/AuthContext';
import { renderBadge, renderContent } from '../utils/renderers';
import { getSdgInfo } from '../utils/sdgUtils';
import { PostCard } from '../components/PostCard';
import { ConfirmModal } from '../components/ConfirmModal';
import { ShareSuccessModal } from '../components/ShareSuccessModal';
import { supabase } from '../utils/supabase';
import { formatRelativeTime } from '../utils/timeUtils';

export const Profile: React.FC<NavProps> = ({ navigate, params }) => {
  const { user: authUser, followedUserIds, toggleFollowUser, sendMentionNotifications } = useAuth();
  type TabType = 'projects' | 'posts' | 'about';
  // State for fetched data
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [localUserPosts, setLocalUserPosts] = useState<Post[]>([]);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [stats, setStats] = useState({
    projects: 0,
    posts: 0,
    followers: 0,
    impact: 0
  });

  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [activeCommentSectionId, setActiveCommentSectionId] = useState<number | null>(null);
  const [activeMenuPostId, setActiveMenuPostId] = useState<number | null>(null);
  const [activeMenuCommentId, setActiveMenuCommentId] = useState<string | null>(null);
  const [activeReplyToId, setActiveReplyToId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<{ postId: number, commentId: string, text: string } | null>(null);

  const [postToDelete, setPostToDelete] = useState<number | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<{ postId: number, commentId: string } | null>(null);

  // Lightbox State - Moved up to fix hook ordering
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState('');

  const profileId = params?.userId;
  const profileUsername = params?.username;

  useEffect(() => {
    const fetchProfileData = async () => {
      // Si no hay userId ni username, y hay un authUser, mostrar el perfil propio
      // Si no, necesitamos uno de los dos para buscar
      const targetId = profileId || (!profileUsername ? authUser?.id : null);

      if (!targetId && !profileUsername) return;
      setIsLoadingProfile(true);

      // 1. Fetch Profile
      let query = supabase
        .from('profiles')
        .select('*, organization:organizations(*)');

      if (targetId) {
        query = query.eq('id', targetId);
      } else {
        query = query.eq('username', profileUsername);
      }

      const { data: profile, error: profileError } = await query.single();

      if (profile) {
        const actualProfileId = profile.id;
        setProfileUser({
          id: profile.id,
          name: profile.name,
          role: profile.role,
          avatar: profile.avatar,
          email: profile.email,
          cover: profile.cover,
          bio: profile.bio,
          location: profile.location,
          organizationId: profile.organization_id,
          organizationName: profile.organization?.name,
          sdgInterests: profile.sdg_interests,
          website: profile.website,
          linkedin: profile.linkedin,
          phone: profile.phone,
          plan: profile.plan,
          status: profile.status,
          joinedAt: profile.created_at
        });
      } else if (profileError) {
        console.error('Error fetching profile:', profileError);
        setIsLoadingProfile(false);
        return;
      } else {
        // Profile not found but no error?
        setIsLoadingProfile(false);
        return;
      }

      // 2. Fetch User Projects
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', profile.id);

      if (projects) {
        setUserProjects(projects.map(p => ({ ...p, sdgId: p.sdg_id, team: [] })));
      }

      // 3. Fetch User Posts
      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (posts) {
        // Use the profile data we already fetched
        const postAuthor = profile ? {
          id: profile.id,
          name: profile.name,
          role: profile.role,
          avatar: profile.avatar,
          plan: profile.plan
        } : authUser;

        setLocalUserPosts(posts.map(p => ({
          ...p,
          user: postAuthor,
          time: p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Hoy',
          sdgIds: p.sdg_ids || [],
          likes: p.likes_count || 0,
          comments: p.comments_count || 0,
          recentComments: []
        })));
      }

      // 4. Fetch Stats (Followers)
      const { count: followersCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', profile.id);

      // 5. Calculate Impact (simplified for now: projects * 100 + posts * 10 + followers * 5)
      const impactScore = ((projects?.length || 0) * 100) + ((posts?.length || 0) * 10) + ((followersCount || 0) * 5);

      setStats({
        projects: projects?.length || 0,
        posts: posts?.length || 0,
        followers: followersCount || 0,
        impact: impactScore
      });

      setIsLoadingProfile(false);
    };

    fetchProfileData();
  }, [profileId, profileUsername, authUser?.id]);

  const hasParams = !!profileId || !!profileUsername;
  const isCurrentUser = profileUsername
    ? (profileUser?.id === authUser?.id)
    : (profileId ? profileId === authUser?.id : !hasParams);

  // Cuando es el usuario actual, usa authUser directamente para evitar el parpadeo
  const user = (isCurrentUser && authUser) ? authUser : profileUser;
  const currentUser = authUser || (USERS[0] as any);

  if (!user && !isLoadingProfile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Usuario no encontrado</h2>
          <button onClick={() => navigate(View.FEED)} className="text-primary font-bold hover:underline">Volver al inicio</button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const isFollowing = followedUserIds.includes(user.id);


  const openLightbox = (images: string[], index: number) => {
    if (!images.length) return;
    setLightboxImages(images);
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  // --- ACTIONS ---
  const handleToggleLike = (postId: number) => {
    setLocalUserPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const isNowLiked = !p.isLiked;
        return {
          ...p,
          isLiked: isNowLiked,
          likes: isNowLiked ? p.likes + 1 : Math.max(0, p.likes - 1)
        };
      }
      return p;
    }));
  };

  const handleDeletePost = (postId: number) => {
    setPostToDelete(postId);
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;
    setLocalUserPosts(prev => prev.filter(p => p.id !== postToDelete));
    setActiveMenuPostId(null);
    const { error } = await supabase.from('posts').delete().eq('id', postToDelete);
    if (error) console.error("Error deleting post:", error);
    setPostToDelete(null);
  };

  const handleShare = (postId: ID) => {
    const shareUrl = `${window.location.origin}${window.location.pathname.startsWith('/dist/') ? '/dist/' : '/'}?view=post&id=${postId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedUrl(shareUrl);
      setShowShareModal(true);
      setTimeout(() => setShowShareModal(false), 3000);
    }).catch(err => {
      console.error('Error copying link:', err);
      setCopiedUrl(shareUrl);
      setShowShareModal(true);
    });
  };

  const handleAddComment = (postId: number, text: string) => {
    const newComment = { id: `new-${Date.now()}`, userId: currentUser.id, text, time: formatRelativeTime(new Date()), likes: 0, isLiked: false, replies: [] };
    setLocalUserPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return { ...p, recentComments: [...(p.recentComments || []), newComment], comments: (p.comments || 0) + 1 };
      }
      return p;
    }));
    sendMentionNotifications(text);
  };

  const handleToggleCommentLike = (postId: number, commentId: string) => {
    setLocalUserPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const updatedComments = p.recentComments.map((c: any) => {
          if (c.id === commentId) {
            const isNowLiked = !c.isLiked;
            return { ...c, isLiked: isNowLiked, likes: isNowLiked ? (c.likes || 0) + 1 : Math.max(0, (c.likes || 0) - 1) };
          }
          return c;
        });
        return { ...p, recentComments: updatedComments };
      }
      return p;
    }));
  };

  const handleAddCommentReply = (postId: number, commentId: string, text: string) => {
    const newReply = { id: `reply-${Date.now()}`, userId: currentUser.id, text, time: formatRelativeTime(new Date()), likes: 0, isLiked: false };
    setLocalUserPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const updatedComments = p.recentComments.map((c: any) => {
          if (c.id === commentId) {
            return { ...c, replies: [...(c.replies || []), newReply] };
          }
          return c;
        });
        return { ...p, recentComments: updatedComments };
      }
      return p;
    }));
    setActiveReplyToId(null);
  };

  const handleDeleteComment = (postId: number, commentId: string) => {
    setCommentToDelete({ postId, commentId });
  };

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;
    const { postId, commentId } = commentToDelete;

    // Optimistic remove
    setLocalUserPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const updatedComments = (p.recentComments || []).filter((c: any) => c.id !== commentId);
        return { ...p, recentComments: updatedComments, comments: Math.max(0, (p.comments || 0) - 1) };
      }
      return p;
    }));
    setActiveMenuCommentId(null);
    setCommentToDelete(null);

    // DB Remove
    try {
      const { error } = await supabase.from('comments').delete().eq('id', commentId);
      if (error) throw error;
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("No se pudo eliminar el comentario.");
    }
  };

  const onSaveEditComment = async (postId: number, commentId: string, text: string) => {
    // Optimistic update
    setLocalUserPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const updatedComments = p.recentComments.map((c: any) => c.id === commentId ? { ...c, text } : c);
        return { ...p, recentComments: updatedComments };
      }
      return p;
    }));
    setEditingComment(null);

    // DB update
    try {
      const { error } = await supabase.from('comments').update({ text }).eq('id', commentId);
      if (error) throw error;
    } catch (error) {
      console.error("Error saving comment edit:", error);
      alert("No se pudo guardar la edición.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50" onClick={() => { setActiveMenuPostId(null); setActiveMenuCommentId(null); }}>
      {/* Banner & Header */}
      <div className="bg-white pb-0 border-b border-slate-200">
        <div className="h-64 bg-slate-900 relative group overflow-hidden">
          <img
            src={user.cover}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover"
            crossOrigin="anonymous"
            onClick={() => openLightbox([user.cover || ''], 0)}
            style={{ cursor: 'pointer' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-60 pointer-events-none"></div>

          {isCurrentUser && (
            <button className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100" aria-label="Change cover photo">
              <span className="material-symbols-outlined">camera_alt</span>
            </button>
          )}
        </div>

        <div className="px-4 md:px-8 relative mb-6">
          <div className="flex flex-col md:flex-row items-end -mt-20 gap-6 mb-4">
            {/* Avatar */}
            <div
              className="size-36 rounded-2xl border-4 border-white bg-slate-200 shadow-xl relative overflow-hidden bg-cover bg-center group cursor-pointer z-10 shrink-0"
              style={{ backgroundImage: `url("${user.avatar}")` }}
              onClick={() => openLightbox([user.avatar], 0)}
            >
              {isCurrentUser && (
                <div className="absolute inset-0 bg-black/20 hidden group-hover:flex items-center justify-center transition-all">
                  <span className="material-symbols-outlined text-white">edit</span>
                </div>
              )}
            </div>

            <div className="flex-1 hidden md:block"></div>

            <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
              {isCurrentUser ? (
                <button onClick={() => navigate(View.SETTINGS)} className="flex-1 md:flex-none px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors shadow-sm">
                  Editar Perfil
                </button>
              ) : (
                <button
                  onClick={() => navigate(View.MESSAGES, { userId: user.id })}
                  className="flex-1 md:flex-none px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Mensaje
                </button>
              )}
              <button
                onClick={() => isCurrentUser ? {} : toggleFollowUser(user.id)}
                className={`flex-1 md:flex-none px-4 py-2 ${isCurrentUser ? 'bg-primary' : isFollowing ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-slate-900 text-white'} rounded-lg font-bold hover:opacity-90 shadow-sm transition-colors flex items-center justify-center gap-2`}
              >
                {isCurrentUser ? (
                  <><span className="material-symbols-outlined">share</span> Compartir</>
                ) : (
                  <>
                    <span className={`material-symbols-outlined ${isFollowing ? 'filled text-primary' : ''}`}>
                      {isFollowing ? 'person_check' : 'person_add'}
                    </span>
                    {isFollowing ? 'Siguiendo' : 'Seguir'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* User Info */}
          <div>
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
              <h1 className="text-3xl font-black text-slate-900">{user.name}</h1>
              {renderBadge(user.plan || 'free')}
            </div>
            <p className="text-slate-500 font-medium text-lg mb-2">{user.role}</p>
            {user.organizationId ? (
              <div
                className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full text-sm font-bold text-slate-700 mb-3"
              >
                <span className="material-symbols-outlined text-base">domain</span>
                {user.organizationName}
                <span className="material-symbols-outlined text-base text-blue-500 filled">verified</span>
              </div>
            ) : (
              user.organizationName && (
                <div className="inline-flex items-center gap-2 text-sm text-slate-500 mb-3"><span className="material-symbols-outlined text-base">work</span> {user.organizationName}</div>
              )
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mt-2">
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-lg text-slate-400">location_on</span> {user.location}</span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-lg text-slate-400">calendar_month</span>
                {user.joinedAt
                  ? `Se unió en ${new Date(user.joinedAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`
                  : 'Se unió en 2023'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 md:px-8 py-6 flex gap-8 md:gap-12 border-t border-slate-50 overflow-x-auto no-scrollbar">
          {(user.plan && user.plan !== 'free') ? (
            [
              { label: 'Proyectos', value: stats.projects },
              { label: 'Posts', value: stats.posts },
              { label: 'Seguidores', value: stats.followers >= 1000 ? (stats.followers / 1000).toFixed(1) + 'k' : stats.followers },
              { label: 'Impacto', value: stats.impact, color: 'text-green-600' }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col shrink-0">
                <span className={`text-xl font-bold ${stat.color || 'text-slate-900'}`}>{stat.value}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{stat.label}</span>
              </div>
            ))
          ) : (
            <div className="py-2 px-4 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-400">lock</span>
              <p className="text-xs text-slate-500 font-medium">Las métricas avanzadas están disponibles para usuarios <span className="text-primary font-bold">Basic, Pro y Enterprise</span>.</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-4 md:px-8 flex gap-8 mt-2">
          {[{ id: 'projects', label: 'Proyectos' }, { id: 'posts', label: 'Publicaciones' }, { id: 'about', label: 'Información' }].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-[500px]">
        {activeTab === 'projects' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-[fade-in_0.3s_ease-out]">
            {userProjects.map(project => {
              const sdg = getSdgInfo(project.sdgId);
              return (
                <div key={project.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                  <div className="h-48 bg-slate-200 bg-cover bg-center relative cursor-pointer" style={{ backgroundImage: `url("${project.image}")` }} onClick={() => openLightbox([project.image], 0)}>
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                    <div className="absolute top-4 left-4 flex gap-2">
                      {sdg && <span className="bg-white/95 backdrop-blur-sm text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5"><span className="material-symbols-outlined text-sm" style={{ color: sdg.color }}>{sdg.icon}</span>{sdg.label}</span>}
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="font-bold text-xl text-slate-900 mb-2 leading-tight group-hover:text-primary transition-colors cursor-pointer" onClick={() => navigate(View.PROJECT_DETAILS, { projectId: project.id })}>{project.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-4">{project.description}</p>
                    <button onClick={() => navigate(View.PROJECT_DETAILS, { projectId: project.id })} className="mt-auto px-4 py-2 bg-slate-50 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-100 transition-colors self-start border border-slate-200">Ver Proyecto</button>
                  </div>
                </div>
              );
            })}
            {userProjects.length === 0 && <div className="col-span-full text-center py-16 text-slate-500"><p>No hay proyectos activos.</p></div>}
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="max-w-2xl mx-auto space-y-6 animate-[fade-in_0.3s_ease-out]">
            {localUserPosts.length === 0 && <div className="text-center py-12 text-slate-500"><p>No hay publicaciones recientes.</p></div>}
            {localUserPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={currentUser}
                onNavigate={navigate}
                onToggleLike={handleToggleLike}
                onShare={handleShare}
                onToggleSavedPost={() => { }} // Not implemented in profile yet
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
                isOwner={isCurrentUser}
                activeMenuPostId={activeMenuPostId}
                setActiveMenuPostId={setActiveMenuPostId}
                onStartEditPost={() => { }} // Modal edit not implemented in profile refactor yet
                onDeletePost={handleDeletePost}
              />
            ))}
          </div>
        )}

        {activeTab === 'about' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-[fade-in_0.3s_ease-out]">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-900 mb-4">Biografía</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{user.bio}</p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-900 mb-4">Intereses ODS</h3>
                <div className="grid grid-cols-5 gap-2">
                  {user.sdgInterests?.map(id => {
                    const sdg = getSdgInfo(id);
                    if (!sdg) return null;
                    return (
                      <div key={id} className="aspect-square rounded-lg flex flex-col items-center justify-center text-white font-black text-sm shadow-sm" style={{ backgroundColor: sdg.color }}>
                        <span className="material-symbols-outlined text-xl mb-1">{sdg.icon}</span>
                        <span className="text-[10px] leading-none">{sdg.id}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ImageLightbox isOpen={isLightboxOpen} onClose={() => setIsLightboxOpen(false)} images={lightboxImages} initialIndex={lightboxIndex} />

      <ConfirmModal
        isOpen={postToDelete !== null}
        onClose={() => setPostToDelete(null)}
        onConfirm={confirmDeletePost}
        title="¿Eliminar publicación?"
        description="Esta acción no se puede deshacer. Tu rastro de impacto se perderá."
        confirmText="Sí, eliminar"
        cancelText="No, mantener"
      />

      <ConfirmModal
        isOpen={commentToDelete !== null}
        onClose={() => setCommentToDelete(null)}
        onConfirm={confirmDeleteComment}
        title="¿Eliminar comentario?"
        description="¿Estás seguro de que quieres borrar este comentario? No podrás recuperarlo."
        confirmText="Eliminar"
        cancelText="Cancelar"
        icon="comment_bank"
      />

      <ShareSuccessModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        copiedUrl={copiedUrl}
      />
    </div>
  );
};
