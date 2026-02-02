import React, { useState } from 'react';
import { Post, User, View, ID } from '../types';
import { supabase } from '../utils/supabase';

export const usePostInteractions = (
    posts: Post[],
    setPosts: React.Dispatch<React.SetStateAction<Post[]>>,
    currentUser: User,
    sendMentionNotifications: (text: string) => void
) => {
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

    const handleShare = (postId: ID) => {
        const shareUrl = `${window.location.origin}${window.location.pathname}?view=post&id=${postId}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert("¡Enlace de impacto copiado! Ahora puedes compartir esta historia en cualquier red social.");
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

    const handleAddCommentReply = (postId: number, commentId: string, text: string) => {
        const newReply = {
            id: `reply-${Date.now()}`,
            userId: currentUser.id,
            text: text,
            time: 'Ahora',
            likes: 0,
            isLiked: false
        };

        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                const updatedComments = p.recentComments.map((c: any) => {
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
    };

    const handleDeleteComment = (postId: number, commentId: string) => {
        if (window.confirm("¿Eliminar comentario?")) {
            setPosts(prev => prev.map(p => {
                if (p.id === postId) {
                    const updatedComments = (p.recentComments || []).filter((c: any) => c.id !== commentId);
                    return { ...p, recentComments: updatedComments, comments: Math.max(0, (p.comments || 0) - 1) };
                }
                return p;
            }));
            setActiveMenuCommentId(null);
        }
    };

    const onSaveEditComment = (postId: number, commentId: string, text: string) => {
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                const updatedComments = p.recentComments.map((c: any) => c.id === commentId ? { ...c, text } : c);
                return { ...p, recentComments: updatedComments };
            }
            return p;
        }));
        setEditingComment(null);
    };

    return {
        // State
        activeCommentSectionId,
        activeMenuPostId,
        activeMenuCommentId,
        activeReplyToId,
        editingComment,

        // Setters (if needed directly)
        setActiveCommentSectionId,
        setActiveMenuPostId,
        setActiveMenuCommentId,
        setActiveReplyToId,
        setEditingComment,

        // Handlers
        handleToggleLike,
        handleDeletePost,
        handleShare,
        handleAddComment,
        handleToggleCommentLike,
        handleAddCommentReply,
        handleDeleteComment,
        onSaveEditComment
    };
};
