import React, { useState, useEffect } from 'react';
import { View, NavProps, ID } from '../types';
import { SDGS, USERS } from '../constants';
import { DEFAULT_USER } from '../utils/defaults';
import { ImageLightbox } from '../components/ImageLightbox';
import { PostCard } from '../components/PostCard';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { useAuth } from '../context/AuthContext';
import { ShareSuccessModal } from '../components/ShareSuccessModal';
import { renderContent } from '../utils/renderers';
import { supabase } from '../utils/supabase'; // Keep renderContent if needed for other things, but PostCard handles post content.

export const HashtagFeed: React.FC<NavProps> = ({ navigate, params }) => {
  const { user: authUser, sendMentionNotifications } = useAuth();
  const currentUser = authUser || DEFAULT_USER;

  const tag = params?.tag || '#Impact';
  const cleanTag = tag.replace('#', '').toLowerCase();

  // State for posts
  const [relevantPosts, setRelevantPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Follow Hashtag Logic (Real DB Persistence)
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!currentUser?.id) return;
      try {
        const { data, error } = await supabase
          .from('hashtag_follows')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('hashtag', cleanTag)
          .maybeSingle();

        if (!error && data) {
          setIsFollowing(true);
        }
      } catch (err) {
        console.error("Error checking hashtag status:", err);
      }
    };

    checkFollowStatus();
  }, [currentUser.id, cleanTag]);

  const toggleFollow = async () => {
    if (!currentUser?.id) {
      alert("Inicia sesión para seguir hashtags");
      return;
    }

    setFollowLoading(true);
    const oldState = isFollowing;

    // Optimistic update
    setIsFollowing(!oldState);

    try {

      if (oldState) {
        // Unfollow
        const { error } = await supabase
          .from('hashtag_follows')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('hashtag', cleanTag);

        if (error) throw error;
      } else {
        // Follow
        const { error } = await supabase
          .from('hashtag_follows')
          .insert({
            user_id: currentUser.id,
            hashtag: cleanTag
          });

        if (error) throw error;
      }
    } catch (err: any) {
      console.error("Error toggling follow:", err);
      // Revert on error
      setIsFollowing(oldState);
      alert("Error al actualizar el seguimiento. Asegúrate de ejecutar el script de base de datos 'setup_hashtag_follows.sql'.");
    } finally {
      setFollowLoading(false);
    }
  };

  // Interaction hook
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

  // Lightbox
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  const getSdgInfo = (id: number) => SDGS.find(s => s.id === id);

  // Fetch posts from Supabase matching the hashtag
  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        const { data: postsData, error } = await supabase
          .from('posts')
          .select('*')
          .or(`content.ilike.%#${cleanTag}%,title.ilike.%#${cleanTag}%`)
          .order('created_at', { ascending: false });

        if (postsData && !error) {
          const formattedPosts = await Promise.all(postsData.map(async (p) => {
            // Resolve User
            let userData = null;
            if (p.user_id) {
              const { data: user } = await supabase.from('profiles').select('*').eq('id', p.user_id).single();
              userData = user;
            }
            if (!userData) userData = USERS.find(u => u.id === p.user_id) || DEFAULT_USER;

            return {
              ...p,
              user: userData,
              time: p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Reciente',
              sdgIds: p.sdg_ids || [],
              likes: p.likes_count || 0,
              comments: p.comments_count || 0,
              recentComments: [], // In a full app, we'd fetch these too or lazy load
              images: p.images || []
            };
          }));
          setRelevantPosts(formattedPosts);
        } else {
          console.error(error);
          setRelevantPosts([]);
        }
      } catch (err) {
        console.error("Error fetching hashtag posts:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, [cleanTag]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      {/* Elegant Header */}
      <div className="relative bg-slate-900 border-b border-slate-200 overflow-hidden">
        {/* Abstract animated background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-0 -right-20 w-96 h-96 bg-primary rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-32 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 flex flex-col items-center text-center">
          <span className="inline-block p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-4 shadow-lg">
            <span className="material-symbols-outlined text-white text-3xl">tag</span>
          </span>
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 mb-4 tracking-tight">
            {tag}
          </h1>
          <p className="text-slate-300 text-lg md:text-xl max-w-2xl font-medium">
            Explorando conversaciones y proyectos sobre este tema.
          </p>

          <div className="flex gap-8 mt-8 text-white/80">
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white">{relevantPosts.length}</span>
              <span className="text-xs uppercase tracking-wider font-bold">Publicaciones</span>
            </div>
            <div className="w-px bg-white/20"></div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white">
                {new Set(relevantPosts.map(p => p.user?.id || p.user_id)).size}
              </span>
              <span className="text-xs uppercase tracking-wider font-bold">Personas</span>
            </div>
          </div>

          <button
            onClick={toggleFollow}
            disabled={followLoading}
            className={`mt-8 px-8 py-3 rounded-full font-bold transition-all shadow-lg flex items-center gap-2 ${isFollowing
              ? 'bg-primary text-white shadow-primary/30 hover:bg-primary-dark'
              : 'bg-white text-slate-900 hover:bg-slate-100 hover:shadow-xl hover:-translate-y-1'
              } ${followLoading ? 'opacity-70 cursor-wait' : ''}`}
          >
            {followLoading ? (
              <span className="size-5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <span className={`material-symbols-outlined ${isFollowing ? 'filled' : ''}`}>
                {isFollowing ? 'notifications_active' : 'notifications'}
              </span>
            )}
            {isFollowing ? 'Siguiendo' : 'Seguir Hashtag'}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-slate-700">Resultados para <span className="text-primary">{tag}</span></h2>
          <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
            <button className="px-3 py-1 bg-slate-100 text-slate-800 rounded text-xs font-bold">Top</button>
            <button className="px-3 py-1 text-slate-500 hover:bg-slate-50 rounded text-xs font-bold">Recientes</button>
          </div>
        </div>

        {relevantPosts.length > 0 ? (
          <div className="space-y-6 animate-[fade-in_0.3s_ease-out]">
            {relevantPosts.map(post => {
              return (
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
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="size-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <span className="material-symbols-outlined text-4xl">tag</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900">No hay resultados</h3>
            <p className="text-slate-500">Sé el primero en usar este hashtag.</p>
          </div>
        )}
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
    </div>
  );
};
