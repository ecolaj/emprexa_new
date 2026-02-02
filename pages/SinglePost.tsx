import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { View, NavProps, ID } from '../types';
import { POSTS, USERS, SDGS } from '../constants';
import { ImageLightbox } from '../components/ImageLightbox';
import { useAuth } from '../context/AuthContext';
import { renderBadge, renderContent } from '../utils/renderers';
import { Logo } from '../components/Logo';
import { getBaseUrl } from '../utils/environment';

export const SinglePost: React.FC<NavProps> = ({ navigate, params }) => {
    const { user, savedPostIds, toggleSavedPost } = useAuth();
    const postId = params?.postId;
    const [post, setPost] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [actionRequiringLogin, setActionRequiringLogin] = useState<'like' | 'comment' | 'save' | 'view_profile' | 'view_sdg' | null>(null);
    const [showShareSuccessModal, setShowShareSuccessModal] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState('');

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

                    const formattedPost = {
                        ...postData,
                        user: userData || USERS[0] || {
                            id: 'unknown',
                            name: 'Usuario',
                            role: 'Miembro',
                            avatar: '',
                            plan: 'free'
                        },
                        time: postData.created_at ? new Date(postData.created_at).toLocaleDateString() : 'Hoy',
                        sdgIds: postData.sdg_ids || [],
                        likes: postData.likes_count || 0,
                        isLiked: false,
                        comments: postData.comments_count || 0,
                        recentComments: []
                    };
                    
                    setPost(formattedPost);
                }
            } catch (error) {
                console.error('Error fetching post:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPost();
    }, [postId]);

    // States for interaction (only if logged in)
    const [isLiked, setIsLiked] = useState(post?.isLiked || false);
    const [likesCount, setLikesCount] = useState(post?.likes || 0);

    // Comments State for SinglePost
    const [localComments, setLocalComments] = useState((post?.recentComments || []).map((c, i) => ({
        ...c,
        id: `sp-${post?.id}-${i}`,
        likes: 0,
        isLiked: false,
        replies: []
    })));
    const [newCommentText, setNewCommentText] = useState('');
    const [activeReplyToId, setActiveReplyToId] = useState<string | null>(null);
    const [newReplyText, setNewReplyText] = useState<{ [commentId: string]: string }>({});

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

    const handleLike = () => {
        if (!user) {
            setActionRequiringLogin('like');
            setShowLoginModal(true);
            return;
        }
        setIsLiked(!isLiked);
        setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);
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
            // Fallback al alert si clipboard falla
            alert("¡Enlace de impacto copiado! Ahora puedes compartir esta historia en cualquier red social.");
        });
    };

    const handleAddComment = () => {
        if (!user) {
            setActionRequiringLogin('comment');
            setShowLoginModal(true);
            return;
        }
        const text = newCommentText.trim();
        if (!text) return;

        const newComment = {
            id: `sp-new-${Date.now()}`,
            userId: user.id,
            text: text,
            time: 'Ahora',
            likes: 0,
            isLiked: false,
            replies: []
        };

        setLocalComments(prev => [...prev, newComment]);
        setNewCommentText('');
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

    const handleAddReply = (commentId: string) => {
        if (!user) {
            setActionRequiringLogin('comment');
            setShowLoginModal(true);
            return;
        }
        const text = newReplyText[commentId]?.trim();
        if (!text) return;

        const newReply = {
            id: `sp-reply-${Date.now()}`,
            userId: user.id,
            text: text,
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

        setNewReplyText({ ...newReplyText, [commentId]: '' });
        setActiveReplyToId(null);
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
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Public Header (only visible if no sidebar/user) */}
            {!user && (
                <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                    <div className="flex items-center gap-2">
                        <Logo className="h-8" />
                    </div>
                    <div className="flex gap-4 text-sm">
                        <button onClick={() => navigate(View.LOGIN)} className="font-bold text-slate-600 hover:text-slate-900">Entrar</button>
                        <button onClick={() => navigate(View.LOGIN)} className="font-bold text-primary hover:text-primary-dark">Registrarse</button>
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

                    <article className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6">
                            {/* Author Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div 
                                        className="size-12 rounded-full bg-cover bg-center border border-slate-100 cursor-pointer hover:opacity-80 transition-opacity" 
                                        style={{ backgroundImage: `url("${(post.user.id === user?.id ? user : post.user).avatar}")` }}
                                        onClick={handleProfileClick}
                                    ></div>
                                    <div>
                                        <h3 
                                            className="font-bold text-slate-900 text-lg cursor-pointer hover:text-primary hover:underline"
                                            onClick={handleProfileClick}
                                        >
                                            {(post.user.id === user?.id ? user : post.user).name}
                                        </h3>
                                        <p className="text-sm text-slate-500">{(post.user.id === user?.id ? user : post.user).role} • {post.time}</p>
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

                        {/* Comment Section for Single Post */}
                        <div className="mt-8 border-t border-slate-100 pt-8 px-6">
                            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">chat_bubble</span>
                                Comentarios ({localComments.length})
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
                                    const rawAuthor = USERS.find(u => u.id === comment.userId) || USERS[0];
                                    const author = rawAuthor.id === user?.id ? user : rawAuthor;
                                    return (
                                        <div key={comment.id} className="space-y-4">
                                            <div className="flex gap-3 items-start">
                                                <div
                                                    className="size-10 rounded-full bg-cover bg-center shrink-0 border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                                                    style={{ backgroundImage: `url("${author.avatar}")` }}
                                                    onClick={() => handleCommenterProfileClick(author.id)}
                                                ></div>
                                                <div className="flex-1">
                                                    <div className="bg-slate-50 rounded-2xl px-4 py-2.5">
                                                        <p
                                                            className="text-sm font-bold text-slate-900 cursor-pointer hover:text-primary hover:underline"
                                                            onClick={() => handleCommenterProfileClick(author.id)}
                                                        >
                                                            {author.name}
                                                        </p>
                                                        <p className="text-sm text-slate-700 mt-1">{comment.text}</p>
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
                                                        <span>{comment.time}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Replies */}
                                            {comment.replies && comment.replies.length > 0 && (
                                                <div className="ml-12 space-y-4 border-l-2 border-slate-100 pl-4">
                                                    {comment.replies.map((reply: any) => {
                                                        const rawReplyAuthor = USERS.find(u => u.id === reply.userId) || USERS[0];
                                                        const replyAuthor = rawReplyAuthor.id === user?.id ? user : rawReplyAuthor;
                                                        return (
                                                            <div key={reply.id} className="flex gap-3 items-start">
                                                                <div
                                                                    className="size-8 rounded-full bg-cover bg-center shrink-0 border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                                                                    style={{ backgroundImage: `url("${replyAuthor.avatar}")` }}
                                                                    onClick={() => handleCommenterProfileClick(replyAuthor.id)}
                                                                ></div>
                                                                <div className="flex-1">
                                                                    <div className="bg-slate-50/50 rounded-xl px-4 py-2 border border-slate-100">
                                                                        <p
                                                                            className="text-xs font-bold text-slate-900 cursor-pointer hover:text-primary hover:underline"
                                                                            onClick={() => handleCommenterProfileClick(replyAuthor.id)}
                                                                        >
                                                                            {replyAuthor.name}
                                                                        </p>
                                                                        <p className="text-xs text-slate-700 mt-1">{reply.text}</p>
                                                                    </div>
                                                                    <div className="flex gap-4 mt-1 ml-1 text-[10px] font-bold text-slate-400">
                                                                        <button
                                                                            onClick={() => handleToggleCommentLike(reply.id)}
                                                                            className={`hover:text-primary transition-colors flex items-center gap-1 ${reply.isLiked ? 'text-primary' : ''}`}
                                                                        >
                                                                            {reply.isLiked ? 'Me gusta' : 'Me gusta'} {reply.likes > 0 && <span>• {reply.likes}</span>}
                                                                        </button>
                                                                        <span>{reply.time}</span>
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

                        {/* Public CTA Footer */}
                        {!user && (
                            <div className="bg-slate-50 p-6 border-t border-slate-200 text-center">
                                <h4 className="font-bold text-slate-900 mb-2">¿Te interesa este proyecto?</h4>
                                <p className="text-sm text-slate-600 mb-4">Únete a Emprexa para conectar con {post.user.name} y miles de otros agentes de cambio.</p>
                                <button onClick={() => navigate(View.ONBOARDING)} className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-primary-dark transition-all">
                                    Crear Cuenta Gratis
                                </button>
                            </div>
                        )}
                    </article>
                </div>
            </div>

            <ImageLightbox
                isOpen={isLightboxOpen}
                onClose={() => setIsLightboxOpen(false)}
                images={lightboxImages}
                initialIndex={lightboxIndex}
            />

            {/* Elegant Login Modal */}
            {showLoginModal && (
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
                            <div className={`size-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
                                actionRequiringLogin === 'like' ? 'bg-red-50 text-red-500' :
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
            )}

            {/* Share Success Modal */}
            {showShareSuccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-[fade-in_0.3s_ease-out]"
                        onClick={() => setShowShareSuccessModal(false)}
                    ></div>
                    
                    {/* Modal Card */}
                    <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-[scale-in_0.2s_ease-out]">
                        <div className="p-8 text-center">
                            {/* Icon */}
                            <div className="size-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="material-symbols-outlined text-3xl">check_circle</span>
                            </div>
                            
                            <h2 className="text-xl font-bold text-slate-900 mb-2">¡Enlace copiado!</h2>
                            
                            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                                El enlace de impacto ha sido copiado al portapapeles. Ahora puedes compartir esta historia en cualquier red social.
                            </p>
                            
                            {/* URL Preview */}
                            <div className="bg-slate-50 rounded-xl p-3 mb-6 text-left">
                                <p className="text-xs text-slate-400 font-bold mb-1">Enlace:</p>
                                <p className="text-sm text-slate-700 font-mono break-all">{copiedUrl}</p>
                            </div>
                            
                            <button
                                onClick={() => setShowShareSuccessModal(false)}
                                className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};