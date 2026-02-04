import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, NavProps, Post, ID } from '../types';
import { SDGS, POSTS, USERS } from '../constants';
import { ImageLightbox } from '../components/ImageLightbox';
import { useAuth } from '../context/AuthContext';
import { renderBadge, renderContent } from '../utils/renderers';
import { getSdgInfo } from '../utils/sdgUtils';
import { PostCard } from '../components/PostCard';
import { PostFormModal } from '../components/PostFormModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { ShareSuccessModal } from '../components/ShareSuccessModal';
import { supabase } from '../utils/supabase';
import { getBaseUrl } from '../utils/environment';

export const Feed: React.FC<NavProps> = ({ navigate }) => {
  const { user, savedPostIds, toggleSavedPost, followedUserIds, followedSdgIds, sendMentionNotifications, isLoading: authLoading, activateTrial } = useAuth();

  // AUDIT FIX: Removed fallback to hardcoded "Juan Pérez".
  // If user is not logged in, we shouldn't show fake data.
  if (authLoading) return <div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!user) return null; // Or redirect to login handled by router/layout

  const currentUser = user;

  // ... (existing state) ...

  // --- USER STATS ---
  const [userStats, setUserStats] = useState({
    followers: 0,
    projects: 0,
    posts: 0
  });

  useEffect(() => {
    async function fetchUserStats() {
      if (!currentUser?.id) return;

      try {
        // 1. Followers: Count where following_id = currentUser.id
        const { count: followersCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', currentUser.id);

        // 2. Projects: Count where owner_id = currentUser.id
        const { count: projectsCount } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', currentUser.id);

        // 3. Posts: Count where user_id = currentUser.id
        const { count: postsCount } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', currentUser.id);

        setUserStats({
          followers: followersCount || 0,
          projects: projectsCount || 0,
          posts: postsCount || 0
        });
      } catch (error) {
        console.error("Error fetching user stats:", error);
      }
    }

    fetchUserStats();
  }, [currentUser.id]);

  // ... (existing state) ...
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
  const [localProjects, setLocalProjects] = useState<any[]>([]);
  const [activeTooltipSdg, setActiveTooltipSdg] = useState<number | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const POSTS_PER_PAGE = 20;
  const [showShareSuccessModal, setShowShareSuccessModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState('');
  const [showTrialConfirmModal, setShowTrialConfirmModal] = useState(false);


  // Ref for infinite scroll
  const feedEndRef = useRef<HTMLDivElement>(null);

  // Fetch posts from Supabase with pagination and smart filtering
  const fetchPosts = async (pageNum: number, append: boolean = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsInitialLoading(true);
    }

    try {
      console.log(`Fetching posts - Page ${pageNum}, Per Page: ${POSTS_PER_PAGE}`);

      // Build query: Global Chronological Feed (Discovery Mode)
      // We prioritize showing ALL content ordered by time to encourage discovery and avoid "Filter Bubbles".
      // Users will see their interests naturally within the stream, but won't miss out on other causes.
      let query = supabase
        .from('posts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(pageNum * POSTS_PER_PAGE, (pageNum + 1) * POSTS_PER_PAGE - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      if (data) {
        // Check if there are more posts
        const totalFetched = (pageNum + 1) * POSTS_PER_PAGE;
        setHasMore(count ? totalFetched < count : false);

        // Fetch user likes for posts
        let likedPostIds = new Set<number>();
        if (currentUser && currentUser.id) {
          const { data: likesData } = await supabase
            .from('post_likes')
            .select('post_id')
            .eq('user_id', currentUser.id);

          if (likesData) {
            likesData.forEach((l: any) => likedPostIds.add(l.post_id));
          }
        }

        const formattedPosts: Post[] = await Promise.all(
          data.map(async (p) => {
            let userData = null;

            if (p.user_id) {
              const { data: user, error: userError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', p.user_id)
                .single();

              if (!userError && user) userData = user;
            }

            if (!userData) {
              userData = USERS.find(u => u.id === p.user_id) || USERS[0] || {
                id: 'unknown', name: 'Usuario', role: 'Miembro', avatar: '', plan: 'free'
              };
            }

            return {
              ...p,
              user: userData,
              time: p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Hoy',
              sdgIds: p.sdg_ids || [],
              likes: p.likes_count || 0,
              isLiked: likedPostIds.has(p.id),
              comments: p.comments_count || 0,
              recentComments: []
            };
          })
        );

        if (append) {
          setLocalPosts(prev => [...prev, ...formattedPosts]);
        } else {
          setLocalPosts(formattedPosts);
        }
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      if (!append) {
        setLocalPosts(POSTS); // Fallback to mock data only on initial load
      }
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsInitialLoading(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    fetchPosts(0, false);

    const fetchProjects = async () => {
      const { data: projects } = await supabase.from('projects').select('*');
      if (projects) setLocalProjects(projects);
    };
    fetchProjects();
  }, [currentUser.id]);

  // Infinite scroll observer
  useEffect(() => {
    if (!feedEndRef.current || isLoadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchPosts(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(feedEndRef.current);

    return () => observer.disconnect();
  }, [page, hasMore, isLoadingMore]);

  // Discovery Feed Logic:
  // We explicitly do NOT sort by preferences client-side anymore.
  // We want strict chronological order to ensure users see the pulse of the community as it happens.
  // This avoids "shuffling" posts in a confusing way and ensures new content (regardless of topic) is seen.
  const postsToDisplay = localPosts;

  // Personalized Impact Hub Calculation (V3)
  const trendingSdgs = useMemo(() => {
    // 1. Reference time for "new" activity
    const lastLogin = currentUser.lastSignInAt
      ? new Date(currentUser.lastSignInAt)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 2. Select target ODS (Interests or Top in feed)
    let targetIds = Array.isArray(currentUser.sdgInterests) && currentUser.sdgInterests.length > 0
      ? [...currentUser.sdgInterests]
      : [];

    if (targetIds.length === 0) {
      // Fallback: analyze global frequency across ALL posts and projects
      const counts: Record<number, number> = {};
      localPosts.forEach(p => (p.sdgIds || []).forEach(id => counts[id] = (counts[id] || 0) + 1));
      localProjects.forEach(p => counts[p.sdg_id] = (counts[p.sdg_id] || 0) + 1);
      targetIds = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(e => Number(e[0]));
    }

    // 3. Sort by ODS ID
    targetIds.sort((a, b) => a - b);

    // 4. Map to object with activity stats
    return targetIds.map(id => {
      const sdg = getSdgInfo(id);

      const newPostsCount = localPosts.filter(p =>
        (p.sdgIds || []).includes(id) &&
        new Date(p.created_at || 0).getTime() > lastLogin.getTime()
      ).length;

      const newProjCount = localProjects.filter(prj =>
        prj.sdg_id === id &&
        new Date(prj.created_at || 0).getTime() > lastLogin.getTime()
      ).length;

      const totalActivity = localPosts.filter(p => (p.sdgIds || []).includes(id)).length +
        localProjects.filter(prj => prj.sdg_id === id).length;

      return {
        ...sdg,
        id,
        newActivity: newPostsCount + newProjCount,
        totalActivity
      };
    });
  }, [localPosts, localProjects, currentUser.sdgInterests, currentUser.lastSignInAt]);

  const [showPostModal, setShowPostModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formPostId, setFormPostId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formSdgs, setFormSdgs] = useState<number[]>([]);
  const [formImages, setFormImages] = useState<string[]>([]);

  const [activeMenuPostId, setActiveMenuPostId] = useState<number | null>(null);
  const [activeCommentSectionId, setActiveCommentSectionId] = useState<number | null>(null);
  const [activeMenuCommentId, setActiveMenuCommentId] = useState<string | null>(null);
  const [activeReplyToId, setActiveReplyToId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<{ postId: number, commentId: string, text: string } | null>(null);

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [postToDelete, setPostToDelete] = useState<number | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<{ postId: number, commentId: string } | null>(null);

  // --- ACTIONS ---
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const newPreviewUrls = newFiles.map((file: File) => URL.createObjectURL(file));
      setFormImages(prev => [...prev, ...newPreviewUrls]);
    }
  };

  const removeFormImage = (index: number) => {
    setFormImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitPost = async () => {
    // Validación CRÍTICA: El campo 'content' es NOT NULL en la base de datos
    if (!formContent.trim()) {
      alert("El contenido de la publicación no puede estar vacío");
      return;
    }

    if (!formTitle.trim() && !formContent.trim()) return;

    if (isEditing && formPostId) {
      const { error } = await supabase
        .from('posts')
        .update({
          title: formTitle,
          content: formContent,
          sdg_ids: formSdgs,
          images: formImages
        })
        .eq('id', formPostId);

      if (!error) {
        setLocalPosts(prev => prev.map(p =>
          p.id === formPostId
            ? { ...p, title: formTitle, content: formContent, sdgIds: formSdgs, images: formImages }
            : p
        ));
      }
    } else {
      const { data, error } = await supabase
        .from('posts')
        .insert([{
          user_id: currentUser.id,
          location: currentUser.location || 'Global',
          sdg_ids: formSdgs,
          title: formTitle,
          content: formContent,
          images: formImages
        }])
        .select(`*, profiles!posts_user_id_fkey(*)`)
        .single();

      // AÑADE ESTAS LÍNEAS para debuggear:
      console.log('Insert post result:', { data, error });

      if (error) {
        console.error('Error inserting post:', error);
        alert('Error al publicar: ' + error.message);
        return;
      }

      if (data) {
        console.log('Post inserted successfully:', data);

        // Necesitamos obtener el usuario por separado
        let userData = data.user;

        // Si no viene en la data, buscar en USERS constantes o usar currentUser
        if (!userData) {
          userData = USERS.find(u => u.id === data.user_id) || currentUser;
        }

        const newPost: Post = {
          ...data,
          user: userData,
          time: 'Ahora mismo',
          sdgIds: data.sdg_ids || [],
          likes: 0,
          comments: 0,
          recentComments: []
        };
        setLocalPosts(prev => [newPost, ...prev]);
        sendMentionNotifications(formTitle + " " + formContent);
      }
    }
    resetPostForm();
  };

  const resetPostForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormSdgs([]);
    setFormImages([]);
    setFormPostId(null);
    setIsEditing(false);
    setShowPostModal(false);
  };

  const startEditPost = (post: Post) => {
    setFormPostId(post.id);
    setFormTitle(post.title);
    setFormContent(post.content);
    setFormSdgs([...post.sdgIds]);
    setFormImages([...post.images]);
    setIsEditing(true);
    setShowPostModal(true);
    setActiveMenuPostId(null);
  };

  const handleToggleLike = async (postId: number) => {
    const post = localPosts.find(p => p.id === postId);
    if (!post) return;

    const isNowLiked = !post.isLiked;
    const newLikesCount = isNowLiked ? post.likes + 1 : Math.max(0, post.likes - 1);

    // Optimistic Update
    setLocalPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          isLiked: isNowLiked,
          likes: newLikesCount
        };
      }
      return p;
    }));

    if (isNowLiked) {
      // Insert into post_likes
      const { error: likeError } = await supabase
        .from('post_likes')
        .insert({ user_id: currentUser.id, post_id: postId });

      if (!likeError) {
        // Increment count
        await supabase.from('posts').update({ likes_count: newLikesCount }).eq('id', postId);
      } else {
        console.error("Error liking post:", likeError);
        // Revert optimistic? For now simplified.
      }
    } else {
      // Delete from post_likes
      const { error: unlikeError } = await supabase
        .from('post_likes')
        .delete()
        .match({ user_id: currentUser.id, post_id: postId });

      if (!unlikeError) {
        // Decrement count
        await supabase.from('posts').update({ likes_count: newLikesCount }).eq('id', postId);
      } else {
        console.error("Error unliking post:", unlikeError);
      }
    }
  };

  const handleDeletePost = (postId: number) => {
    setPostToDelete(postId);
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;

    // Optimistic remove
    setLocalPosts(prev => prev.filter(p => p.id !== postToDelete));
    setActiveMenuPostId(null);

    // DB Remove
    const { error } = await supabase.from('posts').delete().eq('id', postToDelete);
    if (error) {
      console.error("Error deleting post:", error);
      alert("No se pudo eliminar la publicación. Intenta de nuevo.");
      // We might want to re-fetch or re-add the post here for robustness, 
      // but keeping it simple as per original logic.
    }
  };

  const handleShare = (postId: ID) => {
    // Usar URL dinámica para localhost y producción
    const shareUrl = `${getBaseUrl()}/?view=post&id=${postId}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedUrl(shareUrl);
      setShowShareSuccessModal(true);

      // Auto cerrar después de 3 segundos
      setTimeout(() => {
        setShowShareSuccessModal(false);
      }, 3000);
    }).catch(err => {
      console.error('Error copying to clipboard:', err);
      setCopiedUrl(shareUrl);
      setShowShareSuccessModal(true);
    });
  };

  const handleAddComment = (postId: number, text: string) => {
    const newComment = {
      id: `new-${Date.now()}`,
      userId: currentUser.id,
      text: text,
      time: 'Ahora',
      likes: 0,
      isLiked: false,
      replies: []
    };

    setLocalPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return { ...p, recentComments: [...(p.recentComments || []), newComment], comments: (p.comments || 0) + 1 };
      }
      return p;
    }));
    sendMentionNotifications(text);
  };

  const handleToggleCommentLike = (postId: number, commentId: string) => {
    setLocalPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const updatedComments = p.recentComments.map((c: any) => {
          if (c.id === commentId) {
            const isNowLiked = !c.isLiked;
            return { ...c, isLiked: isNowLiked, likes: isNowLiked ? (c.likes || 0) + 1 : Math.max(0, (c.likes || 0) - 1) };
          }
          const updatedReplies = (c.replies || []).map((r: any) => {
            if (r.id === commentId) {
              const isNowLiked = !r.isLiked;
              return { ...r, isLiked: isNowLiked, likes: isNowLiked ? (r.likes || 0) + 1 : Math.max(0, (r.likes || 0) - 1) };
            }
            return r;
          });
          return { ...c, replies: updatedReplies };
        });
        return { ...p, recentComments: updatedComments };
      }
      return p;
    }));
  };

  const handleAddCommentReply = (postId: number, commentId: string, text: string) => {
    const newReply = {
      id: `reply-${Date.now()}`,
      userId: currentUser.id,
      text: text,
      time: 'Ahora',
      likes: 0,
      isLiked: false
    };

    setLocalPosts(prev => prev.map(p => {
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

  const confirmDeleteComment = () => {
    if (!commentToDelete) return;
    const { postId, commentId } = commentToDelete;
    setLocalPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const updatedComments = (p.recentComments || []).filter((c: any) => c.id !== commentId);
        return { ...p, recentComments: updatedComments, comments: Math.max(0, (p.comments || 0) - 1) };
      }
      return p;
    }));
    setActiveMenuCommentId(null);
    setCommentToDelete(null);
  };

  const onSaveEditComment = (postId: number, commentId: string, text: string) => {
    setLocalPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const updatedComments = p.recentComments.map((c: any) => c.id === commentId ? { ...c, text } : c);
        return { ...p, recentComments: updatedComments };
      }
      return p;
    }));
    setEditingComment(null);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f0f2f5] p-0 md:p-6 lg:p-8" onClick={() => { setActiveMenuPostId(null); setActiveMenuCommentId(null); }}>
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Sidebar */}
        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-6 space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
              <div className="flex items-center gap-4 mb-4 cursor-pointer group" onClick={() => navigate(View.PROFILE, { userId: currentUser.id })}>
                <div
                  className="size-12 rounded-full bg-cover bg-center group-hover:scale-105 transition-transform"
                  style={{ backgroundImage: `url("${currentUser.avatar}")` }}
                ></div>
                <div>
                  <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors">{currentUser.name}</h3>
                  <div className="mt-1">{renderBadge(currentUser.plan || 'free')}</div>
                </div>
              </div>
              <div className="flex justify-between text-center text-sm pt-4 border-t border-slate-100">
                <div><span className="block font-bold text-slate-900">{userStats.followers}</span><span className="text-xs text-slate-500">Seguidores</span></div>
                <div><span className="block font-bold text-slate-900">{userStats.projects}</span><span className="text-xs text-slate-500">Proyectos</span></div>
                <div><span className="block font-bold text-slate-900">{userStats.posts}</span><span className="text-xs text-slate-500">Posts</span></div>
              </div>
            </div>

            {/* Trial Coupon / Status Widget */}
            {currentUser.plan === 'free' && !currentUser.hasUsedTrial && (
              <div className="bg-gradient-to-br from-primary to-purple-600 rounded-xl p-4 shadow-lg border border-primary/20 animate-[fade-in_0.5s_ease-out]">
                <div className="flex items-start gap-3 mb-3">
                  <div className="size-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-white text-2xl">redeem</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-white text-sm mb-1">¡Regalo de Bienvenida!</h3>
                    <p className="text-white/90 text-xs leading-relaxed">Activa tu kit PRO gratis: 5 posts o 30 días</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTrialConfirmModal(true)}
                  className="w-full bg-white text-primary font-bold py-2.5 rounded-lg hover:bg-slate-50 transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 text-sm flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">celebration</span>
                  Activar Ahora
                </button>
              </div>
            )}

            {currentUser.isTrialActive && (
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 shadow-lg border border-green-400/30">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-white filled">workspace_premium</span>
                  <h3 className="font-black text-white text-sm">Modo PRO Activo</h3>
                </div>
                <div className="space-y-2">
                  {currentUser.trialPostsRemaining !== undefined && currentUser.trialPostsRemaining > 0 && (
                    <div className="flex items-center justify-between text-white/90 text-xs">
                      <span>Posts restantes:</span>
                      <span className="font-bold bg-white/20 px-2 py-1 rounded">{currentUser.trialPostsRemaining}</span>
                    </div>
                  )}
                  {currentUser.trialEndsAt && (
                    <div className="flex items-center justify-between text-white/90 text-xs">
                      <span>Días restantes:</span>
                      <span className="font-bold bg-white/20 px-2 py-1 rounded">
                        {Math.max(0, Math.ceil((new Date(currentUser.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => navigate(View.PRICING)}
                  className="w-full mt-3 bg-white/20 backdrop-blur text-white font-bold py-2 rounded-lg hover:bg-white/30 transition-all text-xs"
                >
                  Mantener PRO después
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Center Feed */}
        <div className="col-span-1 lg:col-span-6 space-y-6 pb-8">
          {/* Create Post Widget */}
          {currentUser.plan !== 'free' ? (
            <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
              <div className="flex gap-4">
                <div className="size-10 rounded-full bg-gray-200 shrink-0 bg-cover bg-center cursor-pointer" style={{ backgroundImage: `url("${currentUser.avatar}")` }} onClick={() => navigate(View.PROFILE, { userId: currentUser.id })}></div>
                <button onClick={() => { resetPostForm(); setShowPostModal(true); }} className="flex-1 bg-slate-100 rounded-full px-4 text-left text-slate-500 text-sm hover:bg-slate-200 transition-colors">Comparte tu impacto...</button>
              </div>
              <div className="flex justify-between items-center mt-3 pl-14">
                <div className="flex gap-2">
                  <button onClick={() => { resetPostForm(); setShowPostModal(true); }} className="p-2 text-primary hover:bg-primary/5 rounded-full"><span className="material-symbols-outlined text-[20px]">image</span></button>
                  <button onClick={() => { resetPostForm(); setShowPostModal(true); }} className="p-2 text-primary hover:bg-primary/5 rounded-full"><span className="material-symbols-outlined text-[20px]">link</span></button>
                </div>
                <button onClick={() => { resetPostForm(); setShowPostModal(true); }} className="bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-primary-dark">Post</button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-400">lock</span>
                <div>
                  <p className="text-sm font-bold text-slate-700">Modo Observador</p>
                  <p className="text-xs text-slate-500">Actualiza a Básico para publicar contenido.</p>
                </div>
              </div>
              <button onClick={() => navigate(View.PRICING)} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-200 transition-colors">Ver Planes</button>
            </div>
          )}

          {/* Posts Feed */}
          {postsToDisplay.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onNavigate={navigate}
              onToggleLike={handleToggleLike}
              onShare={handleShare}
              onToggleSavedPost={toggleSavedPost}
              isSaved={savedPostIds.includes(post.id)}
              activeCommentSectionId={activeCommentSectionId}
              onToggleCommentSection={(id) => setActiveCommentSectionId(activeCommentSectionId === id ? null : id)}
              onOpenLightbox={(imgs, idx) => { setLightboxImages(imgs); setLightboxIndex(idx); setIsLightboxOpen(true); }}
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
              onStartEditPost={startEditPost}
              onDeletePost={handleDeletePost}
            />
          ))}

          <div className="py-8 text-center">
            <p className="text-slate-400 text-sm font-medium">Has llegado al final</p>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="hidden lg:block lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100 sticky top-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-slate-900 flex items-center gap-2 text-base">
                <span className="material-symbols-outlined text-primary text-xl">hub</span> Tu Centro de Impacto
              </h3>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                Desde tu última sesión
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {trendingSdgs.map((t) => (
                <div
                  key={t.id}
                  className="group relative flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-all cursor-pointer border border-transparent hover:border-slate-100"
                  onMouseEnter={() => setActiveTooltipSdg(t.id)}
                  onMouseLeave={() => setActiveTooltipSdg(null)}
                  onClick={() => navigate(View.SDG_FEED, { id: t.id })}
                >
                  {/* SDG Icon with Numeric Level */}
                  <div
                    className="size-11 rounded-lg flex flex-col items-center justify-center text-white shrink-0 shadow-md transform group-hover:scale-110 transition-transform relative"
                    style={{ backgroundColor: t.color }}
                  >
                    <span className="material-symbols-outlined text-xl">{t.icon}</span>
                    <span className="text-[10px] font-black leading-none">{t.id}</span>

                    {/* Tooltip Estilo PostFormModal */}
                    {activeTooltipSdg === t.id && (
                      <div
                        className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 py-1 px-2.5 rounded-lg shadow-xl animate-[fade-in_0.2s_ease-out] pointer-events-none whitespace-nowrap transition-all duration-200"
                        style={{ backgroundColor: t.color }}
                      >
                        <span className="text-white text-[10px] font-bold tracking-wide">
                          {t.short || t.label}
                        </span>
                        <div
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
                          style={{ backgroundColor: t.color }}
                        ></div>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-slate-800 truncate" style={{ maxWidth: '100%' }}>{t.label}</h4>
                      {t.newActivity > 0 && (
                        <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-black animate-pulse">
                          +{t.newActivity}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(t.totalActivity * 10, 100)}%`, backgroundColor: t.color }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{t.totalActivity} total</span>
                    </div>
                  </div>
                </div>
              ))}

              {trendingSdgs.length === 0 && (
                <div className="text-center py-8">
                  <div className="size-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="material-symbols-outlined text-2xl">search_off</span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold italic px-4">Configura tus preferencias para ver tu impacto.</p>
                </div>
              )}
            </div>

            <button
              onClick={() => navigate(View.SETTINGS)}
              className="w-full mt-6 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-dashed border-slate-200"
            >
              Configurar Mis Causas
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

      <PostFormModal
        show={showPostModal}
        isEditing={isEditing}
        formTitle={formTitle}
        setFormTitle={setFormTitle}
        formContent={formContent}
        setFormContent={setFormContent}
        formSdgs={formSdgs}
        setFormSdgs={setFormSdgs}
        formImages={formImages}
        setFormImages={setFormImages}
        onClose={resetPostForm}
        onSubmit={handleSubmitPost}
        onImageSelect={handleImageSelect}
        onRemoveImage={removeFormImage}
      />

      <ConfirmModal
        isOpen={postToDelete !== null}
        onClose={() => setPostToDelete(null)}
        onConfirm={confirmDeletePost}
        title="¿Eliminar publicación?"
        description="Esta acción no se puede deshacer. Tu historia de impacto dejará de ser visible para la comunidad."
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
        isOpen={showShareSuccessModal}
        onClose={() => setShowShareSuccessModal(false)}
        copiedUrl={copiedUrl}
      />

      {/* Trial Activation Confirmation Modal */}
      {showTrialConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fade-in_0.3s_ease-out]"
            onClick={() => setShowTrialConfirmModal(false)}
          ></div>

          {/* Modal Card */}
          <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-[scale-in_0.2s_ease-out]">
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-primary to-purple-600 p-8 text-center relative overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute -top-10 -right-10 size-40 bg-white/10 rounded-full"></div>
              <div className="absolute -bottom-10 -left-10 size-40 bg-white/10 rounded-full"></div>

              <div className="relative z-10">
                <div className="size-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-white text-5xl">workspace_premium</span>
                </div>
                <h2 className="text-2xl font-black text-white mb-2">¡Activa tu Kit PRO!</h2>
                <p className="text-white/90 text-sm">Desbloquea el poder completo de Emprexa</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-8">
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="size-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-green-600">check_circle</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">5 Publicaciones PRO</h4>
                    <p className="text-slate-500 text-xs">Comparte tu impacto con herramientas avanzadas</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="size-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-blue-600">calendar_month</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">30 Días de Acceso</h4>
                    <p className="text-slate-500 text-xs">Disfruta todas las funciones premium</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="size-10 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-purple-600">trending_up</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Métricas Avanzadas</h4>
                    <p className="text-slate-500 text-xs">Mide tu impacto real en la comunidad</p>
                  </div>
                </div>
              </div>

              {/* Important Note */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-600 text-lg">info</span>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Nota:</strong> Este cupón es único y se activará inmediatamente. Lo que ocurra primero (5 posts o 30 días) determinará cuándo expira.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTrialConfirmModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Más Tarde
                </button>
                <button
                  onClick={() => {
                    activateTrial();
                    setShowTrialConfirmModal(false);
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-primary to-purple-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-primary/30 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">celebration</span>
                  Activar Ahora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div >
  );
};
