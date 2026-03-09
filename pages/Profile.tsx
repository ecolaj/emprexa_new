import React, { useState, useEffect } from 'react';
import { View, NavProps, Post, Project, User, ID } from '../types';
import { SDGS, USERS, POSTS, PROJECTS } from '../constants';
import { DEFAULT_USER } from '../utils/defaults';
import { ImageLightbox } from '../components/ImageLightbox';
import { useAuth } from '../context/AuthContext';
import { renderBadge, renderContent } from '../utils/renderers';
import { getSdgInfo } from '../utils/sdgUtils';
import { PostCard } from '../components/PostCard';
import { ConfirmModal } from '../components/ConfirmModal';
import { ShareSuccessModal } from '../components/ShareSuccessModal';
import { supabase } from '../utils/supabase';
import { formatRelativeTime } from '../utils/timeUtils';
import { Logo } from '../components/Logo';
import { useLanguage } from '../context/LanguageContext';

export const Profile: React.FC<NavProps> = ({ navigate, params }) => {
  const { user: authUser, followedUserIds, toggleFollowUser, sendMentionNotifications, savedPostIds, toggleSavedPost } = useAuth();
  const { t, language } = useLanguage();
  type TabType = 'projects' | 'posts' | 'followers' | 'about';
  // State for fetched data
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [localUserPosts, setLocalUserPosts] = useState<Post[]>([]);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [userFollowers, setUserFollowers] = useState<User[]>([]);
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
          username: profile.username, // <-- Añadido
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
          time: p.created_at ? formatRelativeTime(p.created_at, t) : t('feed.now'),
          sdgIds: p.sdg_ids || [],
          likes: p.likes_count || 0,
          comments: p.comments_count || 0,
          recentComments: []
        })));
      }

      // 4. Fetch Stats (Followers)
      const { data: followers, count: followersCount } = await supabase
        .from('follows')
        .select('follower:profiles!follower_id(*)', { count: 'exact' })
        .eq('following_id', profile.id);

      if (followers) {
        setUserFollowers(followers.map((f: any) => ({
          ...f.follower,
          id: f.follower.id,
          name: f.follower.name,
          role: f.follower.role,
          avatar: f.follower.avatar
        })));
      }

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
  const currentUser = authUser || DEFAULT_USER;

  if (!user && !isLoadingProfile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">{t('profile.userNotFound')}</h2>
          <button onClick={() => navigate(View.FEED)} className="text-primary font-bold hover:underline">{t('profile.backToHome')}</button>
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
  const handleToggleLike = async (postId: number) => {
    const post = localUserPosts.find(p => p.id === postId);
    if (!post || !authUser) return;

    const isNowLiked = !post.isLiked;

    // Optimistic Update
    setLocalUserPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          isLiked: isNowLiked,
          likes: isNowLiked ? p.likes + 1 : Math.max(0, p.likes - 1)
        };
      }
      return p;
    }));

    try {
      if (isNowLiked) {
        const { error } = await supabase
          .from('post_likes')
          .insert({ user_id: authUser.id, post_id: postId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .match({ user_id: authUser.id, post_id: postId });
        if (error) throw error;
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      // Revert on error
      setLocalUserPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            isLiked: !isNowLiked,
            likes: !isNowLiked ? p.likes + 1 : Math.max(0, p.likes - 1)
          };
        }
        return p;
      }));
    }
  };

  const handleDeletePost = (postId: number) => {
    setPostToDelete(postId);
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;
    setLocalUserPosts(prev => prev.filter(p => p.id !== postToDelete));
    setActiveMenuPostId(null);
    const { error } = await supabase.from('posts').delete().eq('id', postToDelete);
    if (!error) {
      // Actualizar estadísticas del perfil reactivamente
      setStats(prev => ({ ...prev, posts: Math.max(0, prev.posts - 1) }));
    } else {
      console.error("Error deleting post:", error);
    }
    setPostToDelete(null);
  };

  const handleShare = (postId: ID) => {
    // Usar la nueva ruta de react-router-dom /post/:postId
    const shareUrl = `${window.location.origin}/post/${postId}`;
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

  // NEW: Handle Share Profile
  const handleShareProfile = () => {
    if (!user) return;
    // Usar la ruta limpia /u/:username o fallback a /profile/:id
    const profilePath = user.username ? `/u/${user.username}` : `/profile/${user.id}`;
    const shareUrl = `${window.location.origin}${profilePath}`;

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

  const handleAddComment = async (postId: number, text: string) => {
    if (!authUser) return;

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert([{
          post_id: postId,
          user_id: authUser.id,
          text: text
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newComment = {
          ...data,
          user: authUser,
          time: t('feed.now'),
          likes: 0,
          isLiked: false,
          replies: []
        };

        setLocalUserPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return { ...p, recentComments: [...(p.recentComments || []), newComment], comments: (p.comments || 0) + 1 };
          }
          return p;
        }));

        sendMentionNotifications(text);
      }
    } catch (error) {
      console.error("Error adding comment in profile:", error);
      alert(t('feed.errorSendingComment'));
    }
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

  const handleAddCommentReply = async (postId: number, commentId: string, text: string) => {
    if (!authUser) return;

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert([{
          post_id: postId,
          user_id: authUser.id,
          text: text,
          parent_id: commentId
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newReply = {
          ...data,
          user: authUser,
          time: t('feed.now'),
          likes: 0,
          isLiked: false
        };

        setLocalUserPosts(prev => prev.map(p => {
          if (p.id === postId) {
            const updatedComments = p.recentComments.map((c: any) => {
              if (c.id === commentId) {
                return { ...c, replies: [...(c.replies || []), newReply] };
              }
              return c;
            });
            // FIX: Increment comments count for replies too
            return { ...p, recentComments: updatedComments, comments: (p.comments || 0) + 1 };
          }
          return p;
        }));
      }
    } catch (error) {
      console.error("Error adding reply in profile:", error);
      alert(t('feed.errorPublishingReply'));
    }
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
        // FIX: Also filter out replies if the deleted commentId refers to a reply
        const updatedComments = (p.recentComments || []).filter((c: any) => c.id !== commentId).map((c: any) => ({
          ...c,
          replies: (c.replies || []).filter((r: any) => r.id !== commentId)
        }));
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
      alert(t('feed.errorDeletingComment'));
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
      alert(t('feed.errorSavingEdit'));
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-slate-50" onClick={() => { setActiveMenuPostId(null); setActiveMenuCommentId(null); }}>
        {/* Public Header (only visible if no sidebar/user) */}
        {!authUser && (
          <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(View.LOGIN)}>
              <Logo className="h-8" />
            </div>
            <div className="flex gap-4 text-sm">
              <button onClick={() => navigate(View.LOGIN)} className="font-bold text-slate-600 hover:text-slate-900">{t('profile.enter')}</button>
              <button onClick={() => navigate(View.ONBOARDING)} className="font-bold bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors">{t('profile.register')}</button>
            </div>
          </div>
        )}

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
                    {t('profile.editProfile')}
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(View.MESSAGES, { userId: user.id })}
                    className="flex-1 md:flex-none px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    {t('profile.message')}
                  </button>
                )}
                <button
                  onClick={() => isCurrentUser ? handleShareProfile() : toggleFollowUser(user.id)}
                  className={`flex-1 md:flex-none px-4 py-2 ${isCurrentUser ? 'bg-primary' : isFollowing ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-slate-900 text-white'} rounded-lg font-bold hover:opacity-90 shadow-sm transition-colors flex items-center justify-center gap-2`}
                >
                  {isCurrentUser ? (
                    <><span className="material-symbols-outlined">share</span> {t('profile.share')}</>
                  ) : (
                    <>
                      <span className={`material-symbols-outlined ${isFollowing ? 'filled text-primary' : ''}`}>
                        {isFollowing ? 'person_check' : 'person_add'}
                      </span>
                      {isFollowing ? t('profile.following') : t('profile.follow')}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* User Info */}
            <div>
              <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                <h1 className="text-3xl font-black text-slate-900">{user.name}</h1>
                {renderBadge(user.plan || 'free', t)}
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
                    ? t('profile.joinedIn').replace('{date}', new Date(user.joinedAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' }))
                    : t('profile.joinedIn').replace('{date}', '2023')}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="px-4 md:px-8 py-6 flex gap-8 md:gap-12 border-t border-slate-50 overflow-x-auto no-scrollbar">
            {(user.plan && user.plan !== 'free') ? (
              [
                { label: t('profile.projects'), value: stats.projects },
                { label: t('profile.posts'), value: stats.posts },
                { label: t('profile.followers'), value: stats.followers >= 1000 ? (stats.followers / 1000).toFixed(1) + 'k' : stats.followers },
                { label: t('profile.impact'), value: stats.impact, color: 'text-green-600' }
              ].map((stat, i) => (
                <div key={i} className="flex flex-col shrink-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => stat.label === t('profile.followers') && setActiveTab('followers')}>
                  <span className={`text-xl font-bold ${stat.color || 'text-slate-900'}`}>{stat.value}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{stat.label}</span>
                </div>
              ))
            ) : (
              <div className="py-2 px-4 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-400">lock</span>
                <p className="text-xs text-slate-500 font-medium">{t('profile.unlockedMetrics').replace('{plans}', <span className="text-primary font-bold">Basic, Pro y Enterprise</span> as any)}</p>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="px-4 md:px-8 flex gap-8 mt-2">
            {[
              { id: 'projects', label: t('profile.projects') },
              { id: 'posts', label: t('profile.posts') },
              { id: 'followers', label: `${t('profile.followers')} (${stats.followers})` },
              { id: 'about', label: t('profile.about') }
            ].map(tab => (
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
                    {(() => {
                      const [posX, posY] = (project.image || '').split('#pos=')[1]?.split(',') || ['50', '50'];
                      return (
                        <div
                          className="h-48 bg-slate-200 bg-cover relative cursor-pointer"
                          style={{
                            backgroundImage: `url("${project.image.split('#pos=')[0]}")`,
                            backgroundPosition: `${posX}% ${posY}%`
                          }}
                          onClick={() => openLightbox([project.image], 0)}
                        >
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                          <div className="absolute top-4 left-4 flex gap-2">
                            {sdg && <span className="bg-white/95 backdrop-blur-sm text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5"><span className="material-symbols-outlined text-sm" style={{ color: sdg.color }}>{sdg.icon}</span>{t(`sdgs.${sdg.id}.label`) || sdg.label}</span>}
                          </div>
                          <div className="absolute bottom-4 right-4">
                            <span className={`text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm uppercase tracking-wide ${project.status === 'Activo' || project.status === t('projectDetails.statusActive') ? 'bg-green-500' : 'bg-slate-400'}`}>
                              {project.status === 'Activo' ? t('projectDetails.statusActive') : project.status === 'Concluido' ? t('projectDetails.statusConcluded') : project.status}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="p-6 flex-1 flex flex-col">
                      <h3 className="font-bold text-xl text-slate-900 mb-2 leading-tight group-hover:text-primary transition-colors cursor-pointer" onClick={() => navigate(View.PROJECT_DETAILS, { projectId: project.id })}>{project.title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-4">{project.description}</p>
                      <button onClick={() => navigate(View.PROJECT_DETAILS, { projectId: project.id })} className="mt-auto px-4 py-2 bg-slate-50 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-100 transition-colors self-start border border-slate-200">{t('profile.viewProject')}</button>
                    </div>
                  </div>
                );
              })}
              {userProjects.length === 0 && <div className="col-span-full text-center py-16 text-slate-500"><p>{t('profile.noProjects')}</p></div>}
            </div>
          )}

          {activeTab === 'posts' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-[fade-in_0.3s_ease-out]">
              {localUserPosts.length === 0 && <div className="text-center py-12 text-slate-500"><p>{t('profile.noPosts')}</p></div>}
              {localUserPosts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onNavigate={navigate}
                  onToggleLike={handleToggleLike}
                  onShare={handleShare}
                  onToggleSavedPost={toggleSavedPost}
                  isSaved={authUser ? savedPostIds.includes(String(post.id)) : false}
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

          {activeTab === 'followers' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-[fade-in_0.3s_ease-out]">
              {userFollowers.length > 0 ? (
                userFollowers.map(follower => (
                  <div
                    key={follower.id}
                    className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => navigate(View.PROFILE, { userId: follower.id })}
                  >
                    <div className="size-14 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                      <img src={follower.avatar} alt={follower.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 truncate group-hover:text-primary transition-colors">{follower.name}</h4>
                      <p className="text-xs text-slate-500 truncate">{follower.role}</p>
                    </div>
                    {!isCurrentUser && authUser?.id === follower.id ? null : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFollowUser(follower.id);
                        }}
                        className={`size-10 rounded-full flex items-center justify-center transition-all ${followedUserIds.includes(follower.id)
                          ? 'bg-slate-100 text-primary'
                          : 'bg-slate-50 text-slate-400 hover:bg-primary/10 hover:text-primary'
                          }`}
                      >
                        <span className={`material-symbols-outlined text-2xl ${followedUserIds.includes(follower.id) ? 'filled' : ''}`}>
                          {followedUserIds.includes(follower.id) ? 'person_check' : 'person_add'}
                        </span>
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-16 text-slate-500">
                  <div className="size-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl">group</span>
                  </div>
                  <p>{t('profile.noFollowers')}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-[fade-in_0.3s_ease-out]">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="font-bold text-slate-900 mb-4">{t('profile.bio')}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{user.bio}</p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="font-bold text-slate-900 mb-4">{t('profile.sdgInterests')}</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[...(user.sdgInterests || [])].sort((a, b) => a - b).map(id => {
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
          title={t('feed.deletePostTitle')}
          description={t('feed.deletePostDesc')}
          confirmText={t('feed.yesDelete')}
          cancelText={t('feed.noKeep')}
        />

        <ConfirmModal
          isOpen={commentToDelete !== null}
          onClose={() => setCommentToDelete(null)}
          onConfirm={confirmDeleteComment}
          title={t('feed.deleteCommentTitle')}
          description={t('feed.deleteCommentDesc')}
          confirmText={t('feed.delete')}
          cancelText={t('feed.cancel')}
          icon="comment_bank"
        />

        <ShareSuccessModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          copiedUrl={copiedUrl}
        />
      </div>
    </>
  );
};
