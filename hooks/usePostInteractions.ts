import React, { useState } from 'react';
import { Post, User, View, ID } from '../types';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';

export const usePostInteractions = (
    posts: Post[],
    setPosts: React.Dispatch<React.SetStateAction<Post[]>>,
    currentUser: User,
    sendMentionNotifications: (text: string) => void
) => {
    const { savedPostIds, toggleSavedPost } = useAuth();

    // UI State
    const [activeCommentSectionId, setActiveCommentSectionId] = useState<number | null>(null);
    const [activeMenuPostId, setActiveMenuPostId] = useState<number | null>(null);
    const [activeMenuCommentId, setActiveMenuCommentId] = useState<string | null>(null);
    const [activeReplyToId, setActiveReplyToId] = useState<string | null>(null);
    const [editingComment, setEditingComment] = useState<{ postId: number, commentId: string, text: string } | null>(null);

    // --- ACTIONS ---

    const handleToggleLike = async (postId: number) => {
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        const isNowLiked = !post.isLiked;
        // Optimistic update
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                return {
                    ...p,
                    isLiked: isNowLiked,
                    likes: isNowLiked ? p.likes + 1 : Math.max(0, p.likes - 1)
                };
            }
            return p;
        }));

        // DB Update
        if (postId > 1000) { // Assuming ID < 1000 are mocks if applicable, or just check logic. 
            // In this project, IDs are numbers but DB uses IDs. Seed data had 101, 102.
            // We'll just try to update.
        }

        // Using Supabase to persist like
        try {
            if (isNowLiked) {
                await supabase.from('post_likes').insert({ user_id: currentUser.id, post_id: postId });
            } else {
                await supabase.from('post_likes').delete().eq('user_id', currentUser.id).eq('post_id', postId);
            }
            // Update counter just in case trigger doesn't do it (usually trigger handles count too, but let's keep it safe)
            await supabase
                .from('posts')
                .update({ likes_count: isNowLiked ? post.likes + 1 : Math.max(0, post.likes - 1) })
                .eq('id', postId);
        } catch (error) {
            console.error("Error updating like interactions:", error);
        }
    };

    const handleDeletePost = async (postId: number) => {
        if (window.confirm("¿Estás seguro de que deseas eliminar esta publicación?")) {
            // Optimistic
            setPosts(prev => prev.filter(p => p.id !== postId));
            setActiveMenuPostId(null);

            // DB
            const { error } = await supabase.from('posts').delete().eq('id', postId);
            if (error) console.error("Error deleting post:", error);
        }
    };

    const [showShareModal, setShowShareModal] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState('');

    const handleShare = (postId: ID) => {
        // Usar la nueva ruta de react-router-dom /post/:postId
        const shareUrl = `${window.location.origin}/post/${postId}`;
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            setCopiedUrl(shareUrl);
            setShowShareModal(true);
            
            // Auto close after 3 seconds
            setTimeout(() => {
                setShowShareModal(false);
            }, 3000);
        }).catch(err => {
            console.error('Error copying to clipboard:', err);
            // Even if clipboard fails, we try to show the modal (or we could show an error, but usually it works)
            setCopiedUrl(shareUrl);
            setShowShareModal(true);
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

        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                return { ...p, recentComments: [...(p.recentComments || []), newComment], comments: (p.comments || 0) + 1 };
            }
            return p;
        }));
        
        // Persist comment in DB to trigger notification
        const persistComment = async () => {
             const { error } = await supabase.from('comments').insert({
                post_id: postId,
                user_id: currentUser.id,
                text: text
            });
            if (error) console.error("Error persisting comment:", error);
        };
        persistComment();
        
        // sendMentionNotifications(text); // Let the backend trigger handle generic notifications, but mentions might still need this if not in SQL
        // We'll keep sendMentionNotifications for now as redundancy or for Mentions specifically if SQL trigger doesn't cover parsing.
        sendMentionNotifications(text);
    };

    const handleToggleCommentLike = (postId: number, commentId: string) => {
        setPosts(prev => prev.map(p => {
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

    const handleAddCommentReply = async (postId: number, commentId: string, text: string) => {
        const tempId = `reply-${Date.now()}`;
        const newReply = {
            id: tempId,
            userId: currentUser.id,
            text: text,
            time: 'Ahora',
            likes: 0,
            isLiked: false
        };

        // Optimistic Update
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                const updatedComments = (p.recentComments || []).map((c: any) => {
                    if (c.id === commentId) {
                        return { ...c, replies: [...(c.replies || []), newReply] };
                    }
                    return c;
                });
                return { ...p, recentComments: updatedComments, comments: (p.comments || 0) + 1 };
            }
            return p;
        }));
        setActiveReplyToId(null);

        // DB Persistence
        try {
            const { data, error } = await supabase
                .from('comments')
                .insert([{
                    post_id: postId,
                    user_id: currentUser.id,
                    text: text,
                    parent_id: commentId
                }])
                .select()
                .single();

            if (error) throw error;

            // Optional: Replace temp ID with real DB ID if needed
            if (data && data.id) {
                setPosts(prev => prev.map(p => {
                    if (p.id === postId) {
                        const updatedComments = (p.recentComments || []).map((c: any) => {
                            if (c.id === commentId) {
                                return {
                                    ...c,
                                    replies: (c.replies || []).map((r: any) => r.id === tempId ? { ...r, id: data.id } : r)
                                };
                            }
                            return c;
                        });
                        return { ...p, recentComments: updatedComments };
                    }
                    return p;
                }));
            }
        } catch (err) {
            console.error("Error persisting reply:", err);
            // Revert optimistic if needed, but for now just logging
        }
    };

    const handleDeleteComment = async (postId: number, commentId: string) => {
        if (window.confirm("¿Eliminar comentario?")) {
            // Optimistic Update
            setPosts(prev => prev.map(p => {
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

            // DB Update
            try {
                const { error } = await supabase.from('comments').delete().eq('id', commentId);
                if (error) throw error;
            } catch (error) {
                console.error("Error deleting comment:", error);
                alert("No se pudo eliminar el comentario.");
            }
        }
    };

    const onSaveEditComment = async (postId: number, commentId: string, text: string) => {
        // Optimistic Update
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                const updatedComments = p.recentComments.map((c: any) => c.id === commentId ? { ...c, text } : c);
                return { ...p, recentComments: updatedComments };
            }
            return p;
        }));
        setEditingComment(null);

        // DB Update
        try {
            const { error } = await supabase.from('comments').update({ text }).eq('id', commentId);
            if (error) throw error;
        } catch (error) {
            console.error("Error updating comment:", error);
            alert("No se pudo guardar el comentario.");
        }
    };

    return {
        // State
        activeCommentSectionId,
        activeMenuPostId,
        activeMenuCommentId,
        activeReplyToId,
        editingComment,
        showShareModal,
        copiedUrl,

        // Setters (if needed directly)
        setActiveCommentSectionId,
        setActiveMenuPostId,
        setActiveMenuCommentId,
        setActiveReplyToId,
        setEditingComment,
        setShowShareModal,

        // Handlers
        handleToggleLike,
        handleDeletePost,
        handleShare,
        handleAddComment,
        handleToggleCommentLike,
        handleAddCommentReply,
        handleDeleteComment,
        onSaveEditComment,
        
        // Saved state logic
        savedPostIds,
        toggleSavedPost
    };
};
