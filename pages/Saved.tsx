
import React, { useState, useEffect } from 'react';
import { View, NavProps, Post, ID } from '../types';
import { USERS } from '../constants';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_USER } from '../utils/defaults';
import { supabase } from '../utils/supabase';
import { PostCard } from '../components/PostCard';
import { ImageLightbox } from '../components/ImageLightbox';
import { usePostInteractions } from '../hooks/usePostInteractions';
import { useLanguage } from '../context/LanguageContext';

export const Saved: React.FC<NavProps> = ({ navigate }) => {
    const { savedPostIds, toggleSavedPost, user } = useAuth();
    const { t } = useLanguage();
    const currentUser = user || DEFAULT_USER;

    const [savedPosts, setSavedPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // States for post interactions (using unified hook)
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
    } = usePostInteractions(savedPosts, setSavedPosts, currentUser, () => { });

    const startEditPost = (postId: number) => {
        console.log('Edit post from saved not implemented yet:', postId);
    };

    // Lightbox states
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxImages, setLightboxImages] = useState<string[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    // Fetch saved posts from Supabase
    useEffect(() => {
        const fetchSavedPosts = async () => {
            if (!user || savedPostIds.length === 0) {
                setSavedPosts([]);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            try {
                const { data, error } = await supabase
                    .from('posts')
                    .select('*')
                    .in('id', savedPostIds)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('Error fetching saved posts:', error);
                    setIsLoading(false);
                    return;
                }

                if (data) {
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

                    // Format posts with user data
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
                                userData = USERS.find(u => u.id === p.user_id) || DEFAULT_USER;
                            }

                            return {
                                ...p,
                                user: userData,
                                time: p.created_at ? new Date(p.created_at).toLocaleDateString() : t('time.today'),
                                sdgIds: p.sdg_ids || [],
                                likes: p.likes_count || 0,
                                isLiked: likedPostIds.has(p.id),
                                comments: p.comments_count || 0,
                                recentComments: []
                            };
                        })
                    );

                    setSavedPosts(formattedPosts);
                }
            } catch (error) {
                console.error('Exception fetching saved posts:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSavedPosts();
    }, [savedPostIds, user]);

    return (
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50">
            <div className="max-w-2xl mx-auto p-4 md:p-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="size-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl filled">bookmark</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">{t('saved.title')}</h1>
                        <p className="text-slate-500 text-sm">{t('saved.subtitle')}</p>
                    </div>
                </div>

                {/* Loading State */}
                {isLoading ? (
                    <div className="text-center py-20">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        <p className="text-slate-500 mt-4">{t('saved.loading')}</p>
                    </div>
                ) : savedPosts.length > 0 ? (
                    /* Posts using PostCard component (same as Feed) */
                    <div className="space-y-4">
                        {savedPosts.map(post => (
                            <PostCard
                                key={post.id}
                                post={post}
                                currentUser={currentUser}
                                onNavigate={navigate}
                                onToggleLike={handleToggleLike}
                                onShare={handleShare}
                                onToggleSavedPost={toggleSavedPost}
                                isSaved={savedPostIds.includes(String(post.id))}
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
                    </div>
                ) : (
                    /* Empty State */
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                        <div className="size-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <span className="material-symbols-outlined text-4xl">bookmark_add</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">{t('saved.noBookmarks')}</h3>
                        <p className="text-slate-500 mb-6 max-w-sm mx-auto">{t('saved.emptyDesc')}</p>
                        <button onClick={() => navigate(View.FEED)} className="text-primary font-bold hover:underline">{t('saved.goToFeed')}</button>
                    </div>
                )}
            </div>

            {/* Image Lightbox */}
            {isLightboxOpen && (
                <ImageLightbox
                    images={lightboxImages}
                    initialIndex={lightboxIndex}
                    onClose={() => setIsLightboxOpen(false)}
                />
            )}
        </div>
    );
};
