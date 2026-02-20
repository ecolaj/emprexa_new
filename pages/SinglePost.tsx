import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { View, NavProps, ID } from '../types';
import { POSTS, USERS, SDGS } from '../constants';
import { ImageLightbox } from '../components/ImageLightbox';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_USER } from '../utils/defaults';
import { renderBadge, renderContent } from '../utils/renderers';
import { Logo } from '../components/Logo';
import { ShareSuccessModal } from '../components/ShareSuccessModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { getBaseUrl } from '../utils/environment';
import { formatRelativeTime } from '../utils/timeUtils';

export const SinglePost: React.FC<NavProps> = ({ navigate, params }) => {
    const { user, savedPostIds, toggleSavedPost } = useAuth();
    const postId = params?.postId || params?.id;
    const [post, setPost] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [actionRequiringLogin, setActionRequiringLogin] = useState<'like' | 'comment' | 'save' | 'view_profile' | 'view_sdg' | null>(null);
    const [showShareSuccessModal, setShowShareSuccessModal] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState('');
    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);

    // Fetch post from Supabase
    useEffect(() => {
        const fetchPost = async () => {
            if (!postId) {
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);

                // Buscar post en Supabase
                const { data: postData, error } = await supabase
                    .from('posts')
                    .select('*')
                    .eq('id', postId)
                    .single();

                if (error) throw error;

                if (postData) {
                    // Buscar usuario del post
                    const { data: userData } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', postData.user_id)
                        .single();

                    // Fetch user like status
                    let userHasLiked = false;
                    if (user) {
                        const { data: likeData } = await supabase
                            .from('post_likes')
                            .select('id')
                            .eq('post_id', postId)
                            .eq('user_id', user.id)
                            .maybeSingle();
                        userHasLiked = !!likeData;
                    }

                    const formattedPost = {
                        ...postData,
                        user: userData || DEFAULT_USER,
                        time: postData.created_at ? formatRelativeTime(postData.created_at) : 'Hoy',
                        sdgIds: postData.sdg_ids || [],
                        likes: postData.likes_count || 0,
                        isLiked: userHasLiked,
                        comments: postData.comments_count || 0,
                        recentComments: []
                    };

                    setPost(formattedPost);
                    setIsLiked(userHasLiked);
                    setLikesCount(formattedPost.likes);

                    // Fetch Comments for this post
                    const { data: commentsData } = await supabase
                        .from('comments')
                        .select('*')
                        .eq('post_id', postId)
                        .order('created_at', { ascending: true });

                    if (commentsData) {
                        // 1. Fetch User Likes for these comments
                        let userLikesSet = new Set<string>();
                        if (user) {
                            const commentIds = commentsData.map(c => c.id);
                            if (commentIds.length > 0) {
                                const { data: likesData } = await supabase
                                    .from('coment_like')
                                    .select('comment_id')
                                    .eq('user_id', user.id)
                                    .in('comment_id', commentIds);
                                if (likesData) likesData.forEach(l => userLikesSet.add(l.comment_id));
                            }
                        }

                        // 2. Fetch Users
                        const userIds = [...new Set(commentsData.map(c => c.user_id).filter(Boolean))];
                        const { data: users } = await supabase
                            .from('profiles')
                            .select('*')
                            .in('id', userIds);

                        const usersMap = users?.reduce((acc: any, u: any) => {
                            acc[u.id] = u;
                            return acc;
                        }, {}) || {};
                        if (user) usersMap[user.id] = user;

                        // 3. Group and Process
                        const mainComments = commentsData.filter(c => !c.parent_id);
                        const replies = commentsData.filter(c => c.parent_id);

                        const formattedComments = mainComments.map(c => {
                            const userData = usersMap[c.user_id] || USERS.find(u => u.id === c.user_id) || (user && user.id === c.user_id ? user : DEFAULT_USER);
                            return {
                                ...c,
                                user: userData,
                                userId: c.user_id,
                                time: c.created_at ? formatRelativeTime(new Date(c.created_at)) : 'Ahora',
                                likes: c.likes_count || 0,
                                isLiked: userLikesSet.has(c.id),
                                replies: replies.filter(r => r.parent_id === c.id).map(r => {
                                    const replyUser = usersMap[r.user_id] || USERS.find(u => u.id === r.user_id) || (user && user.id === r.user_id ? user : DEFAULT_USER);
                                    return {
                                        ...r,
                                        user: replyUser,
                                        userId: r.user_id,
                                        time: r.created_at ? formatRelativeTime(new Date(r.created_at)) : 'Ahora',
                                        likes: r.likes_count || 0,
                                        isLiked: userLikesSet.has(r.id)
                                    };
                                })
                            };
                        });
                        setLocalComments(formattedComments);
                    }
                } // Closes postData check
            } catch (error) {
                console.error('Error fetching post:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPost();
    }, [postId]);

    // Initial fetch handled above in useEffect

    // Comments State for SinglePost
    const [localComments, setLocalComments] = useState<any[]>([]);
    const [newCommentText, setNewCommentText] = useState('');
    const [activeReplyToId, setActiveReplyToId] = useState<string | null>(null);
    const [newReplyText, setNewReplyText] = useState<{ [commentId: string]: string }>({});
    const [activeMenuCommentId, setActiveMenuCommentId] = useState<string | null>(null);
    const [editingComment, setEditingComment] = useState<{ id: string, text: string } | null>(null);
    const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

    // Lightbox
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxImages, setLightboxImages] = useState<string[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 min-h-screen">
                <div className="size-20 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-400">
                    <span className="material-symbols-outlined text-4xl">broken_image</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">Publicación no encontrada</h2>
                <p className="text-slate-500 mt-2 mb-6">El enlace podría estar roto o la publicación fue eliminada.</p>
                <button onClick={() => navigate(View.FEED)} className="text-primary font-bold hover:underline">Ir al Feed</button>
            </div>
        );
    }

    const isSaved = user ? savedPostIds.includes(post.id) : false;

    const handleLike = async () => {
        if (!user) {
            setActionRequiringLogin('like');
            setShowLoginModal(true);
            return;
        }

        const newIsLiked = !isLiked;
        const newLikesCount = newIsLiked ? likesCount + 1 : Math.max(0, likesCount - 1);

        // Optimistic update
        setIsLiked(newIsLiked);
        setLikesCount(newLikesCount);

        try {
            if (newIsLiked) {
                const { error } = await supabase
                    .from('post_likes')
                    .insert({ user_id: user.id, post_id: post.id });
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('post_likes')
                    .delete()
                    .match({ user_id: user.id, post_id: post.id });
                if (error) throw error;
            }
        } catch (error) {
            console.error("Error toggling like:", error);
            // Revert on error
            setIsLiked(!newIsLiked);
            setLikesCount(likesCount);
        }
    };

    const handleBookmark = () => {
        if (!user) {
            setActionRequiringLogin('save');
            setShowLoginModal(true);
            return;
        }
        toggleSavedPost(post.id);
    };

    const handleShare = (postId: ID) => {
        const shareUrl = `${getBaseUrl()}/post/${postId}`;

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

    const handleAddComment = async () => {
        if (!user) {
            setActionRequiringLogin('comment');
            setShowLoginModal(true);
            return;
        }
        const text = newCommentText.trim();
        if (!text) return;

        // DB insert
        try {
            const { data, error } = await supabase
                .from('comments')
                .insert({
                    post_id: post.id,
                    user_id: user.id,
                    text: text
                })
                .select()
                .single();

            if (error) throw error;

            if (data) {
                const newComment = {
                    id: data.id,
                    userId: user.id,
                    user: user, // Ensure user object is present for rendering
                    text: text,
                    time: formatRelativeTime(new Date()),
                    likes: 0,
                    isLiked: false,
                    replies: []
                };

                setLocalComments(prev => [...prev, newComment]);
                setNewCommentText('');
                // FIX: Update post comments count
                setPost((prev: any) => ({ ...prev, comments: (prev.comments || 0) + 1 }));
            }
        } catch (error) {
            console.error("Error adding comment:", error);
            alert("No se pudo enviar el comentario.");
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!user) return;
        setCommentToDelete(commentId);
    };

    const confirmDeleteComment = async () => {
        if (!commentToDelete) return;

        // Optimistic remove (including replies)
        setLocalComments(prev => prev.filter(c => c.id !== commentToDelete).map(c => ({
            ...c,
            replies: (c.replies || []).filter((r: any) => r.id !== commentToDelete)
        })));
        setCommentToDelete(null);
        setActiveMenuCommentId(null);

        // DB remove
        try {
            const { error } = await supabase.from('comments').delete().eq('id', commentToDelete);
            if (error) throw error;
            // FIX: Update total comments count
            setPost((prev: any) => ({ ...prev, comments: Math.max(0, (prev.comments || 0) - 1) }));
        } catch (error) {
            console.error("Error deleting comment:", error);
            alert("No se pudo eliminar el comentario.");
        }
    };

    const onStartEditComment = (comment: any) => {
        setEditingComment({ id: comment.id, text: comment.text });
        setActiveMenuCommentId(null);
    };

    const saveEditedComment = async (commentId: string, newText: string) => {
        // Optimistic update (including replies)
        setLocalComments(prev => prev.map(c => {
            if (c.id === commentId) return { ...c, text: newText };
            return {
                ...c,
                replies: (c.replies || []).map((r: any) => r.id === commentId ? { ...r, text: newText } : r)
            };
        }));
        setEditingComment(null);

        // DB update
        try {
            const { error } = await supabase.from('comments').update({ text: newText }).eq('id', commentId);
            if (error) throw error;
        } catch (error) {
            console.error("Error saving comment:", error);
            alert("No se pudo guardar el comentario.");
        }
    };

    const handleToggleCommentLike = (commentId: string) => {
        if (!user) {
            setActionRequiringLogin('like');
            setShowLoginModal(true);
            return;
        }
        setLocalComments(prev => prev.map((c: any) => {
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
        }));
    };

    const handleAddReply = async (commentId: string) => {
        if (!user) {
            setActionRequiringLogin('comment');
            setShowLoginModal(true);
            return;
        }
        const text = newReplyText[commentId]?.trim();
        if (!text) return;

        try {
            const { data, error } = await supabase
                .from('comments')
                .insert([{
                    post_id: post.id,
                    user_id: user.id,
                    text: text,
                    parent_id: commentId
                }])
                .select()
                .single();

            if (error) throw error;

            if (data) {
                const newReply = {
                    ...data,
                    user: user,
                    time: 'Ahora',
                    likes: 0,
                    isLiked: false
                };

                setLocalComments(prev => prev.map((c: any) => {
                    if (c.id === commentId) {
                        return { ...c, replies: [...(c.replies || []), newReply] };
                    }
                    return c;
                }));

                // FIX: Update total comments count
                setPost((prev: any) => ({ ...prev, comments: (prev.comments || 0) + 1 }));

                setNewReplyText({ ...newReplyText, [commentId]: '' });
                setActiveReplyToId(null);
            }
        } catch (error) {
            console.error("Error adding reply:", error);
            alert("No se pudo enviar la respuesta.");
        }
    };

    const handleProfileClick = () => {
        if (!user) {
            setActionRequiringLogin('view_profile');
            setShowLoginModal(true);
            return;
        }
        navigate(View.PROFILE, { userId: post.user.id });
    };

    const handleSdgClick = (sdgId: number) => {
        if (!user) {
            setActionRequiringLogin('view_sdg');
            setShowLoginModal(true);
            return;
        }
        navigate(View.SDG_FEED, { id: sdgId });
    };

    const handleCommenterProfileClick = (userId: string) => {
        if (!user) {
            setActionRequiringLogin('view_profile');
            setShowLoginModal(true);
            return;
        }
        navigate(View.PROFILE, { userId });
    };

    return (
        <div className="h-screen bg-[#f0f2f5] flex flex-col overflow-hidden">
            {/* Public Header (only visible if no sidebar/user) */}
            {!user && (
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(View.LOGIN)}>
                        <Logo className="h-8" />
                    </div>
                    <div className="flex gap-4 text-sm">
                        <button onClick={() => navigate(View.LOGIN)} className="font-bold text-slate-600 hover:text-slate-900">Entrar</button>
                        <button onClick={() => navigate(View.ONBOARDING)} className="font-bold bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors">Registrarse</button>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex justify-center p-4 md:p-8 overflow-y-auto">
                <div className="w-full max-w-2xl">
                    {/* Back Button */}
                    <button
                        onClick={() => user ? navigate(View.FEED) : navigate(View.LOGIN)}
                        className="mb-6 flex items-center gap-2 text-slate-500 font-bold hover:text-slate-800 transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        {user ? 'Volver al Feed' : 'Ver más publicaciones'}
                    </button>

                    <article className="rounded-2xl overflow-hidden max-w-2xl mx-auto">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-4">
                            {/* Author Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="size-12 rounded-full bg-slate-200 bg-cover bg-center border border-slate-100 cursor-pointer hover:opacity-80 transition-opacity"
                                        style={{ backgroundImage: `url("${post.user.avatar}")` }}
                                        onClick={handleProfileClick}
                                    ></div>
                                    <div>
                                        <h3
                                            className="font-bold text-slate-900 text-lg cursor-pointer hover:text-primary hover:underline"
                                            onClick={handleProfileClick}
                                        >
                                            {post.user.name}
                                        </h3>
                                        <p className="text-sm text-slate-500">{post.user.role} • {post.time}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 justify-end max-w-[250px]">
                                    {post.sdgIds.map(id => {
                                        const sdg = SDGS.find(s => s.id === id);
                                        if (!sdg) return null;
                                        return (
                                            <span
                                                key={id}
                                                onClick={() => handleSdgClick(sdg.id)}
                                                className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:bg-slate-100 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-sm" style={{ color: sdg.color }}>{sdg.icon}</span>
                                                ODS {sdg.id}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Content */}
                            <h1 className="text-2xl font-bold text-slate-900 mb-4">{post.title}</h1>
                            <p className="text-slate-700 text-base leading-relaxed mb-6 whitespace-pre-wrap">{renderContent(post.content, navigate)}</p>

                            {/* YouTube Video */}
                            {post.youtube_url && (
                                <div className="mb-6 rounded-2xl overflow-hidden aspect-video bg-slate-900 border border-slate-200">
                                    <iframe
                                        className="w-full h-full"
                                        src={`https://www.youtube.com/embed/${((url) => {
                                            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                                            const match = url.match(regExp);
                                            return (match && match[2].length === 11) ? match[2] : null;
                                        })(post.youtube_url)}`}
                                        title="YouTube video player"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                    ></iframe>
                                </div>
                            )}

                            {/* Images */}
                            {post.images.length > 0 && (
                                <div className={`grid gap-2 rounded-xl overflow-hidden mb-6 ${post.images.length > 1 ? 'grid-cols-2' : ''}`}>
                                    {post.images.map((img, idx) => (
                                        <div
                                            key={idx}
                                            className="cursor-pointer"
                                            onClick={() => {
                                                setLightboxImages(post.images);
                                                setLightboxIndex(idx);
                                                setIsLightboxOpen(true);
                                            }}
                                        >
                                            <img src={img} alt="Post media" className="w-full h-auto object-cover max-h-[500px]" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Interaction Buttons - Similar to PostCard */}
                            <div className="border-t border-slate-100 pt-4 mt-6 flex items-center justify-between text-slate-500">
                                <div className="flex gap-6">
                                    <button
                                        onClick={handleLike}
                                        className={`flex items-center gap-2 text-sm transition-all group ${isLiked ? 'text-red-500 font-bold' : 'hover:text-red-500'}`}
                                    >
                                        <span className={`material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform ${isLiked ? 'filled animate-[pulse_0.2s_ease-out]' : ''}`}>favorite</span>
                                        {likesCount} {isLiked ? 'Te gusta' : 'Me gusta'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!user) {
                                                setActionRequiringLogin('comment');
                                                setShowLoginModal(true);
                                                return;
                                            }
                                            // Focus en el textarea de comentarios
                                            document.querySelector('textarea')?.focus();
                                        }}
                                        className="flex items-center gap-2 hover:text-primary text-sm transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">chat_bubble</span> Comentar
                                    </button>
                                    <button
                                        onClick={() => handleShare(post.id)}
                                        className="flex items-center gap-2 hover:text-primary text-sm transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">share</span> Compartir
                                    </button>
                                </div>
                                <button
                                    onClick={handleBookmark}
                                    className={`text-slate-400 hover:text-indigo-600 transition-colors ${isSaved ? 'text-indigo-600' : ''}`}
                                    title={isSaved ? "Quitar marcador" : "Guardar para leer después"}
                                >
                                    <span className={`material-symbols-outlined ${isSaved ? 'filled' : ''}`}>bookmark</span>
                                </button>
                            </div>
                        </div>
                    </article>

                    {/* Comment Section - Separate Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-4 max-w-2xl mx-auto">
                        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">chat_bubble</span>
                            Comentarios ({post.comments})
                        </h3>

                        {/* Comment Input */}
                        {user ? (
                            <div className="flex gap-4 mb-8">
                                <div className="size-10 rounded-full bg-cover bg-center shrink-0 border border-slate-200" style={{ backgroundImage: `url("${user.avatar}")` }}></div>
                                <div className="flex-1 relative">
                                    <textarea
                                        placeholder="Añade un comentario..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-primary resize-none h-12"
                                        value={newCommentText}
                                        onChange={(e) => setNewCommentText(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                                    />
                                    <button
                                        onClick={handleAddComment}
                                        className="absolute right-3 top-3 text-primary"
                                    >
                                        <span className="material-symbols-outlined filled">send</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 rounded-xl p-4 mb-8 border border-slate-200 text-center">
                                <p className="text-sm text-slate-600">Inicia sesión para dejar un comentario.</p>
                            </div>
                        )}

                        {/* Comments List */}
                        <div className="space-y-6">
                            {localComments.map((comment: any) => {
                                const author = comment.user || (user && comment.userId === user.id ? user : DEFAULT_USER);
                                return (
                                    <div key={comment.id} className="space-y-4 group/comment">
                                        <div className="flex gap-3 items-start">
                                            <div
                                                className="size-10 rounded-full bg-cover bg-center shrink-0 border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                                                style={{ backgroundImage: `url("${author.avatar}")` }}
                                                onClick={() => handleCommenterProfileClick(author.id)}
                                            ></div>
                                            <div className="flex-1">
                                                <div className="bg-slate-50 rounded-2xl px-4 py-2.5 relative group">
                                                    <div className="flex justify-between items-start">
                                                        <p
                                                            className="text-sm font-bold text-slate-900 cursor-pointer hover:text-primary hover:underline"
                                                            onClick={() => handleCommenterProfileClick(author.id)}
                                                        >
                                                            {author.name}
                                                        </p>

                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-slate-400 font-medium">{comment.time}</span>
                                                            {user && (author.id === user.id || post.user_id === user.id || user.isAdmin) && (
                                                                <div className="relative">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setActiveMenuCommentId(activeMenuCommentId === comment.id ? null : comment.id); }}
                                                                        className="text-slate-400 hover:text-slate-600 opacity-0 group-hover/comment:opacity-100 transition-opacity"
                                                                    >
                                                                        <span className="material-symbols-outlined text-sm">more_vert</span>
                                                                    </button>
                                                                    {activeMenuCommentId === comment.id && (
                                                                        <div className="absolute right-0 top-6 w-32 bg-white rounded-lg shadow-xl border border-slate-100 z-30 overflow-hidden">
                                                                            {author.id === user.id && (
                                                                                <button onClick={() => onStartEditComment(comment)} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2">
                                                                                    <span className="material-symbols-outlined text-sm">edit</span> Editar
                                                                                </button>
                                                                            )}
                                                                            <button onClick={() => handleDeleteComment(comment.id)} className="w-full text-left px-3 py-2 hover:bg-red-50 text-xs font-bold text-red-600 flex items-center gap-2">
                                                                                <span className="material-symbols-outlined text-sm">delete</span> Eliminar
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {editingComment?.id === comment.id ? (
                                                        <div className="mt-1">
                                                            <textarea
                                                                value={editingComment.text}
                                                                onChange={(e) => setEditingComment({ ...editingComment, text: e.target.value })}
                                                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary resize-none h-20"
                                                            />
                                                            <div className="flex justify-end gap-2 mt-2">
                                                                <button onClick={() => setEditingComment(null)} className="text-xs font-bold text-slate-500 hover:underline">Cancelar</button>
                                                                <button onClick={() => saveEditedComment(comment.id, editingComment.text)} className="text-xs font-bold text-primary hover:underline">Guardar</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-slate-700 mt-1">{comment.text}</p>
                                                    )}
                                                </div>
                                                <div className="flex gap-4 mt-1.5 ml-2 text-xs font-bold text-slate-400">
                                                    <button
                                                        onClick={() => handleToggleCommentLike(comment.id)}
                                                        className={`hover:text-primary transition-colors flex items-center gap-1 ${comment.isLiked ? 'text-primary' : ''}`}
                                                    >
                                                        {comment.isLiked ? 'Me gusta' : 'Me gusta'} {comment.likes > 0 && <span>• {comment.likes}</span>}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (!user) {
                                                                setActionRequiringLogin('comment');
                                                                setShowLoginModal(true);
                                                                return;
                                                            }
                                                            setActiveReplyToId(activeReplyToId === comment.id ? null : comment.id);
                                                        }}
                                                        className="hover:text-primary transition-colors"
                                                    >
                                                        Responder
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Replies */}
                                        {comment.replies && comment.replies.length > 0 && (
                                            <div className="ml-12 space-y-4 border-l-2 border-slate-100 pl-4">
                                                {comment.replies.map((reply: any) => {
                                                    // FIX: Use enriched user object from DB fetch
                                                    const replyAuthor = reply.user || (user && reply.userId === user.id ? user : DEFAULT_USER);
                                                    return (
                                                        <div key={reply.id} className="flex gap-3 items-start">
                                                            <div
                                                                className="size-8 rounded-full bg-cover bg-center shrink-0 border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                                                                style={{ backgroundImage: `url("${replyAuthor.avatar}")` }}
                                                                onClick={() => handleCommenterProfileClick(replyAuthor.id)}
                                                            ></div>
                                                            <div className="flex-1">
                                                                <div className="bg-slate-50/50 rounded-xl px-4 py-2 border border-slate-100 relative group/reply">
                                                                    <div className="flex justify-between items-start">
                                                                        <p
                                                                            className="text-xs font-bold text-slate-900 cursor-pointer hover:text-primary hover:underline"
                                                                            onClick={() => handleCommenterProfileClick(replyAuthor.id)}
                                                                        >
                                                                            {replyAuthor.name}
                                                                        </p>

                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] text-slate-400 font-medium">{reply.time}</span>
                                                                            {user && (replyAuthor.id === user.id || post.user_id === user.id || user.isAdmin) && (
                                                                                <div className="relative">
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); setActiveMenuCommentId(activeMenuCommentId === reply.id ? null : reply.id); }}
                                                                                        className="text-slate-400 hover:text-slate-600 opacity-0 group-hover/reply:opacity-100 transition-opacity"
                                                                                    >
                                                                                        <span className="material-symbols-outlined text-xs">more_vert</span>
                                                                                    </button>
                                                                                    {activeMenuCommentId === reply.id && (
                                                                                        <div className="absolute right-0 top-6 w-32 bg-white rounded-lg shadow-xl border border-slate-100 z-30 overflow-hidden">
                                                                                            {replyAuthor.id === user.id && (
                                                                                                <button onClick={() => onStartEditComment(reply)} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2">
                                                                                                    <span className="material-symbols-outlined text-sm">edit</span> Editar
                                                                                                </button>
                                                                                            )}
                                                                                            <button onClick={() => handleDeleteComment(reply.id)} className="w-full text-left px-3 py-2 hover:bg-red-50 text-xs font-bold text-red-600 flex items-center gap-2">
                                                                                                <span className="material-symbols-outlined text-sm">delete</span> Eliminar
                                                                                            </button>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {editingComment?.id === reply.id ? (
                                                                        <div className="mt-1">
                                                                            <textarea
                                                                                value={editingComment.text}
                                                                                onChange={(e) => setEditingComment({ ...editingComment, text: e.target.value })}
                                                                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-primary resize-none h-16"
                                                                            />
                                                                            <div className="flex justify-end gap-2 mt-2">
                                                                                <button onClick={() => setEditingComment(null)} className="text-[10px] font-bold text-slate-500 hover:underline">Cancelar</button>
                                                                                <button onClick={() => saveEditedComment(reply.id, editingComment.text)} className="text-[10px] font-bold text-primary hover:underline">Guardar</button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs text-slate-700 mt-1">{reply.text}</p>
                                                                    )}
                                                                </div>
                                                                <div className="flex gap-4 mt-1 ml-1 text-[10px] font-bold text-slate-400">
                                                                    <button
                                                                        onClick={() => handleToggleCommentLike(reply.id)}
                                                                        className={`hover:text-primary transition-colors flex items-center gap-1 ${reply.isLiked ? 'text-primary' : ''}`}
                                                                    >
                                                                        {reply.isLiked ? 'Me gusta' : 'Me gusta'} {reply.likes > 0 && <span>• {reply.likes}</span>}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Reply Input */}
                                        {activeReplyToId === comment.id && user && (
                                            <div className="ml-12 mt-2 flex gap-3 items-start animate-[fade-in_0.2s_ease-out]">
                                                <div className="size-8 rounded-full bg-cover bg-center shrink-0 border border-slate-200" style={{ backgroundImage: `url("${user.avatar}")` }}></div>
                                                <div className="flex-1 relative">
                                                    <textarea
                                                        placeholder={`Responde a ${author.name}...`}
                                                        className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-3 pr-10 text-xs focus:outline-none focus:border-primary resize-none h-10"
                                                        value={newReplyText[comment.id] || ''}
                                                        onChange={(e) => setNewReplyText({ ...newReplyText, [comment.id]: e.target.value })}
                                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddReply(comment.id); } }}
                                                    />
                                                    <button
                                                        onClick={() => handleAddReply(comment.id)}
                                                        className="absolute right-2 top-2 text-primary"
                                                    >
                                                        <span className="material-symbols-outlined text-base filled">send</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                    </div>

                </div>

                {/* Public CTA Footer - Separate Card */}
                {!user && (
                    <div className="bg-slate-50 p-6 border border-slate-200 rounded-2xl mt-4 text-center max-w-2xl mx-auto">
                        <h4 className="font-bold text-slate-900 mb-2">¿Te interesa este proyecto?</h4>
                        <p className="text-sm text-slate-600 mb-4">Únete a Emprexa para conectar con {post.user.name} y miles de otros agentes de cambio.</p>
                        <button onClick={() => navigate(View.ONBOARDING)} className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-primary-dark transition-all">
                            Crear Cuenta Gratis
                        </button>
                    </div>
                )}
            </div >

            <ImageLightbox
                isOpen={isLightboxOpen}
                onClose={() => setIsLightboxOpen(false)}
                images={lightboxImages}
                initialIndex={lightboxIndex}
            />

            {/* Elegant Login Modal */}
            {
                showLoginModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fade-in_0.3s_ease-out]"
                            onClick={() => setShowLoginModal(false)}
                        ></div>

                        {/* Modal Card */}
                        <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-[scale-in_0.2s_ease-out]">
                            <div className="p-8 text-center">
                                {/* Icon based on action */}
                                <div className={`size-16 rounded-full flex items-center justify-center mx-auto mb-6 ${actionRequiringLogin === 'like' ? 'bg-red-50 text-red-500' :
                                    actionRequiringLogin === 'comment' ? 'bg-blue-50 text-blue-500' :
                                        actionRequiringLogin === 'view_profile' ? 'bg-purple-50 text-purple-500' :
                                            actionRequiringLogin === 'view_sdg' ? 'bg-green-50 text-green-500' :
                                                'bg-indigo-50 text-indigo-500'
                                    }`}>
                                    <span className="material-symbols-outlined text-3xl">
                                        {actionRequiringLogin === 'like' ? 'favorite' :
                                            actionRequiringLogin === 'comment' ? 'chat_bubble' :
                                                actionRequiringLogin === 'view_profile' ? 'person' :
                                                    actionRequiringLogin === 'view_sdg' ? 'target' :
                                                        'bookmark'}
                                    </span>
                                </div>

                                <h2 className="text-xl font-bold text-slate-900 mb-2">
                                    {actionRequiringLogin === 'like' ? 'Me gusta esta publicación' :
                                        actionRequiringLogin === 'comment' ? 'Comentar en esta publicación' :
                                            actionRequiringLogin === 'view_profile' ? 'Ver perfil del usuario' :
                                                actionRequiringLogin === 'view_sdg' ? 'Explorar ODS' :
                                                    'Guardar esta publicación'}
                                </h2>

                                <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                                    {actionRequiringLogin === 'like'
                                        ? 'Únete a Emprexa para apoyar esta historia de impacto y conectar con otros agentes de cambio.'
                                        : actionRequiringLogin === 'comment'
                                            ? 'Regístrate para compartir tu perspectiva y construir comunidad alrededor de este proyecto.'
                                            : actionRequiringLogin === 'view_profile'
                                                ? 'Crea una cuenta para ver perfiles de otros agentes de cambio y conectar con ellos.'
                                                : actionRequiringLogin === 'view_sdg'
                                                    ? 'Únete a la comunidad para explorar más proyectos relacionados con los Objetivos de Desarrollo Sostenible.'
                                                    : 'Crea una cuenta para guardar esta publicación y revisarla más tarde.'
                                    }
                                </p>

                                <div className="space-y-3">
                                    <button
                                        onClick={() => {
                                            setShowLoginModal(false);
                                            navigate(View.LOGIN);
                                        }}
                                        className="w-full py-3.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20"
                                    >
                                        Iniciar Sesión
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowLoginModal(false);
                                            navigate(View.ONBOARDING);
                                        }}
                                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                                    >
                                        Crear Cuenta Gratis
                                    </button>

                                    <button
                                        onClick={() => setShowLoginModal(false)}
                                        className="w-full py-3 text-slate-500 hover:text-slate-900 font-medium"
                                    >
                                        Seguir viendo como invitado
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            <ShareSuccessModal
                isOpen={showShareSuccessModal}
                onClose={() => setShowShareSuccessModal(false)}
                copiedUrl={copiedUrl}
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
        </div >
    );
};