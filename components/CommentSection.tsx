import React, { useState, useRef, useEffect } from 'react';
import { User, ID, View, Post } from '../types';
import { USERS } from '../constants';
import { DEFAULT_USER } from '../utils/defaults';
import { useAuth } from '../context/AuthContext';
import { MentionDropdown } from './MentionDropdown';
import { supabase } from '../utils/supabase';
import { renderContent } from '../utils/renderers';
import { formatRelativeTime } from '../utils/timeUtils';

interface CommentSectionProps {
    post: Post;
    currentUser: User | null; // Allow null for public views
    onNavigate: (view: View, params?: any) => void;
    onToggleCommentLike: (postId: number, commentId: string) => void;
    onAddCommentReply: (postId: number, commentId: string, text: string) => void;
    onDeleteComment: (postId: number, commentId: string) => void;
    onStartEditComment: (postId: number, comment: any) => void;
    onSaveEditComment: (postId: number, commentId: string, text: string) => void;
    onAddComment: (postId: number, text: string) => void;
    activeReplyToId: string | null;
    setActiveReplyToId: (id: string | null) => void;
    editingComment: { postId: number; commentId: string; text: string } | null;
    setEditingComment: (val: any) => void;
    activeMenuCommentId: string | null;
    setActiveMenuCommentId: (id: string | null) => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
    post,
    currentUser,
    onNavigate,
    onToggleCommentLike,
    onAddCommentReply,
    onDeleteComment,
    onStartEditComment,
    onSaveEditComment,
    onAddComment,
    activeReplyToId,
    setActiveReplyToId,
    editingComment,
    setEditingComment,
    activeMenuCommentId,
    setActiveMenuCommentId
}) => {
    const { user: authUser, followedUserIds } = useAuth();
    const [comments, setComments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newCommentText, setNewCommentText] = useState('');
    const [newReplyText, setNewReplyText] = useState<{ [commentId: string]: string }>({});

    // Fetch Comments from Supabase
    // Fetch Comments from Supabase
    useEffect(() => {
        const fetchComments = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('comments')
                .select('*')
                .eq('post_id', post.id)
                .order('created_at', { ascending: true });

            if (data) {
                // 1. Fetch User Likes for these comments
                let userLikesSet = new Set<string>();
                if (authUser) {
                    const commentIds = data.map(c => c.id);
                    if (commentIds.length > 0) {
                        const { data: likesData } = await supabase
                            .from('coment_like')
                            .select('comment_id')
                            .eq('user_id', authUser.id)
                            .in('comment_id', commentIds);

                        if (likesData) {
                            likesData.forEach(l => userLikesSet.add(l.comment_id));
                        }
                    }
                }

                // 2. Fetch Users
                const userIds = [...new Set(data.map(c => c.user_id).filter(Boolean))];
                const { data: users } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('id', userIds);

                const usersMap = users?.reduce((acc, user) => {
                    acc[user.id] = user;
                    return acc;
                }, {}) || {};

                // Ensure usersMap also has the current authUser to override any staleness if needed
                if (authUser) {
                    usersMap[authUser.id] = authUser;
                }

                // 3. Group and Process
                const mainComments = data.filter(c => !c.parent_id);
                const replies = data.filter(c => c.parent_id);

                const combined = mainComments.map(c => {
                    let userData = usersMap[c.user_id] || USERS.find(u => u.id === c.user_id) || (currentUser && currentUser.id === c.user_id ? currentUser : DEFAULT_USER);

                    // Force usage of authUser if IDs match
                    if (authUser && c.user_id === authUser.id) {
                        userData = authUser;
                    }

                    return {
                        ...c,
                        user: userData,
                        userId: c.user_id,
                        time: c.created_at ? formatRelativeTime(c.created_at) : 'Ahora',
                        // Map likes_count from DB to likes prop
                        likes: c.likes_count || c.likes || 0,
                        isLiked: userLikesSet.has(c.id),
                        replies: replies.filter(r => r.parent_id === c.id).map(r => {
                            let replyUser = usersMap[r.user_id] || USERS.find(u => u.id === r.user_id) || (currentUser && currentUser.id === r.user_id ? currentUser : DEFAULT_USER);

                            // Force usage of authUser if IDs match
                            if (authUser && r.user_id === authUser.id) {
                                replyUser = authUser;
                            }

                            return {
                                ...r,
                                user: replyUser,
                                userId: r.user_id,
                                time: r.created_at ? formatRelativeTime(r.created_at) : 'Ahora',
                                likes: r.likes_count || r.likes || 0,
                                isLiked: userLikesSet.has(r.id)
                            };
                        })
                    };
                });
                setComments(combined);
            }
            setIsLoading(false);
        };

        fetchComments();
    }, [post.id, authUser]);

    // Mention State
    const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
    const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
    const [activeMentionIndex, setActiveMentionIndex] = useState(0);
    const [activeInputRef, setActiveInputRef] = useState<React.RefObject<HTMLTextAreaElement> | null>(null);

    const mainInputRef = useRef<HTMLTextAreaElement>(null);
    const replyInputRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});

    const handleTextChange = (text: string, ref: React.RefObject<HTMLTextAreaElement>, setter: (val: string) => void) => {
        setter(text);
        setActiveInputRef(ref);

        const cursor = ref.current?.selectionStart || 0;
        const lastAtIndex = text.lastIndexOf('@', cursor - 1);

        if (lastAtIndex !== -1) {
            const query = text.slice(lastAtIndex + 1, cursor);
            if (!query.includes(' ') && !query.includes('\n')) {
                // Priority: Post Author -> Thread Participants -> Followed -> General
                const participants = new Set([post.user.id, ...post.recentComments.map(c => c.userId)]);

                const filtered = USERS
                    .filter(u => u.name.toLowerCase().replace(/\s/g, '').includes(query.toLowerCase()))
                    .sort((a, b) => {
                        const aPart = participants.has(a.id);
                        const bPart = participants.has(b.id);
                        if (aPart && !bPart) return -1;
                        if (!aPart && bPart) return 1;

                        const aFollow = followedUserIds.includes(a.id);
                        const bFollow = followedUserIds.includes(b.id);
                        if (aFollow && !bFollow) return -1;
                        if (!aFollow && bFollow) return 1;

                        return 0;
                    })
                    .slice(0, 5);

                setMentionSuggestions(filtered);
                if (ref.current) {
                    const rect = ref.current.getBoundingClientRect();
                    setMentionPosition({ top: rect.top - 180, left: rect.left }); // Show above input for comments
                }
                return;
            }
        }
        setMentionSuggestions([]);
    };

    const handleSelectMention = (user: User) => {
        if (!activeInputRef?.current) return;
        const textarea = activeInputRef.current;
        const text = textarea.value;
        const cursor = textarea.selectionStart;
        const lastAtIndex = text.lastIndexOf('@', cursor - 1);
        const username = user.name.replace(/\s/g, '');

        const newText = text.slice(0, lastAtIndex) + `@${username} ` + text.slice(cursor);

        // Update either main comment or reply
        if (activeInputRef === mainInputRef) {
            setNewCommentText(newText);
        } else {
            const replyId = Object.keys(replyInputRefs.current).find(key => replyInputRefs.current[key] === textarea);
            if (replyId) {
                setNewReplyText(prev => ({ ...prev, [replyId]: newText }));
            }
        }

        setMentionSuggestions([]);
        setTimeout(() => textarea.focus(), 10);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (mentionSuggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveMentionIndex(prev => (prev + 1) % mentionSuggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleSelectMention(mentionSuggestions[activeMentionIndex]);
            } else if (e.key === 'Escape') {
                setMentionSuggestions([]);
            }
        }
    };

    const handleAddComment = async () => {
        if (!newCommentText.trim() || !authUser) return;

        const { data, error } = await supabase
            .from('comments')
            .insert([{
                post_id: post.id,
                user_id: authUser.id,
                text: newCommentText
            }])
            .select('*')
            .single();

        if (error) {
            console.error("Error adding comment:", error);
            alert("No se pudo enviar el comentario. Intenta de nuevo.");
            return;
        }

        if (data) {
            // Se comenta ya que ahora el conteo se maneja por Triggers en la DB 
            // await supabase.from('posts').update({ comments_count: (post.comments || 0) + 1 }).eq('id', post.id);

            let userData = authUser;
            if (data.user_id) {
                const { data: user } = await supabase.from('profiles').select('*').eq('id', data.user_id).single();
                if (user) userData = user;
            }

            setComments([...comments, {
                ...data,
                // Use authUser directly for the most up-to-date profile info instantly
                user: authUser,
                time: 'Ahora',
                replies: [],
                likes: 0,
                isLiked: false
            }]);
            setNewCommentText('');
            if (onAddComment) onAddComment(post.id, newCommentText);
        }
    };

    const handleAddReply = async (parentId: string) => {
        const text = newReplyText[parentId]?.trim();
        if (!text || !authUser) return;

        // Determine Root Parent (Flattening nested replies)
        let rootCommentId = parentId;
        const isRoot = comments.some(c => c.id === parentId);
        if (!isRoot) {
            const foundRoot = comments.find(c => c.replies && c.replies.some((r: any) => r.id === parentId));
            if (foundRoot) {
                rootCommentId = foundRoot.id;
            }
        }

        const { data, error } = await supabase
            .from('comments')
            .insert([{
                post_id: post.id,
                user_id: authUser.id,
                text: text,
                parent_id: rootCommentId // Use root parent to ensure visibility
            }])
            .select('*') // No join here, fetch author separately if needed or reuse authUser
            .single();

        if (error) {
            console.error("Error adding reply:", error);
            alert("Error al publicar respuesta. Intenta de nuevo.");
            return;
        }

        if (data) {
            console.log("Reply published successfully:", data);
            // Se comenta ya que ahora el conteo se maneja por Triggers en la DB 
            // await supabase.from('posts').update({ comments_count: (post.comments || 0) + 1 }).eq('id', post.id);

            setComments(comments.map(c => c.id === rootCommentId ? {
                ...c,
                replies: [...(c.replies || []), {
                    ...data,
                    user: authUser, // Optimistic author
                    time: 'Ahora',
                    likes: 0,
                    isLiked: false
                }]
            } : c));
            setNewReplyText({ ...newReplyText, [parentId]: '' });
            setActiveReplyToId(null);
            if (onAddCommentReply) onAddCommentReply(post.id, rootCommentId, text);
        }
    };

    const handleLocalDelete = (commentId: string) => {
        // Optimistic remove
        setComments(prev => prev.filter(c => c.id !== commentId).map(c => ({
            ...c,
            replies: (c.replies || []).filter((r: any) => r.id !== commentId)
        })));

        onDeleteComment(post.id, commentId);
    };

    const handleLocalToggleLike = async (commentId: string) => {
        if (!authUser) return;

        let targetComment: any = comments.find(c => c.id === commentId);
        let isReply = false;

        if (!targetComment) {
            for (const c of comments) {
                const reply = c.replies?.find((r: any) => r.id === commentId);
                if (reply) {
                    targetComment = reply;
                    isReply = true;
                    break;
                }
            }
        }

        if (!targetComment) return;

        const currentIsLiked = targetComment.isLiked;
        const currentLikes = targetComment.likes || 0;
        const newIsLiked = !currentIsLiked;
        const newLikes = newIsLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1);

        // Optimistic Update
        setComments(prev => prev.map(c => {
            if (c.id === commentId) {
                return { ...c, isLiked: newIsLiked, likes: newLikes };
            }
            if (c.replies) {
                return {
                    ...c,
                    replies: c.replies.map((r: any) =>
                        r.id === commentId ? { ...r, isLiked: newIsLiked, likes: newLikes } : r
                    )
                };
            }
            return c;
        }));

        // DB Update
        if (newIsLiked) {
            const { error } = await supabase.from('coment_like').insert({ user_id: authUser.id, comment_id: commentId });
            if (error) {
                console.error("Error liking comment:", error);
            } else {
                await supabase.from('comments').update({ likes_count: newLikes }).eq('id', commentId);
            }
        } else {
            const { error } = await supabase.from('coment_like').delete().eq('user_id', authUser.id).eq('comment_id', commentId);
            if (error) {
                console.error("Error unliking comment:", error);
            } else {
                await supabase.from('comments').update({ likes_count: newLikes }).eq('id', commentId);
            }
        }
    };

    return (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 animate-[fade-in_0.2s_ease-out]">
            {comments.length > 0 && (
                <div className="space-y-4 mb-4">
                    {comments.map((comment: any) => {
                        const author = comment.user;
                        const isCommentOwner = authUser?.id === comment.user_id;
                        const isPostOwner = authUser?.id === post.user_id || authUser?.id === post.user?.id;
                        const isAdmin = currentUser?.isAdmin;
                        const canDelete = isCommentOwner || isPostOwner || isAdmin;
                        const canEdit = isCommentOwner;
                        const isCommentEditing = editingComment?.commentId === comment.id;

                        return (
                            <div key={comment.id} className="space-y-3 group/comment">
                                <div className="flex gap-3 items-start">
                                    <div
                                        className="size-8 rounded-full bg-cover bg-center shrink-0 border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                                        style={{ backgroundImage: `url("${author.avatar}")` }}
                                        onClick={(e) => { e.stopPropagation(); onNavigate(View.PROFILE, { userId: author.id }); }}
                                    ></div>
                                    <div className="flex-1">
                                        <div className="bg-white border border-slate-100 rounded-2xl px-4 py-2 shadow-sm relative group">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <p
                                                    className="text-xs font-bold text-slate-900 cursor-pointer hover:text-primary hover:underline"
                                                    onClick={(e) => { e.stopPropagation(); onNavigate(View.PROFILE, { userId: author.id }); }}
                                                >
                                                    {author.name}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-slate-400 font-medium">{comment.time}</span>
                                                    {(canDelete || canEdit) && (
                                                        <div className="relative">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setActiveMenuCommentId(activeMenuCommentId === comment.id ? null : comment.id); }}
                                                                className="text-slate-400 hover:text-slate-600 opacity-0 group-hover/comment:opacity-100 transition-opacity"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">more_vert</span>
                                                            </button>
                                                            {activeMenuCommentId === comment.id && (
                                                                <div className="absolute right-0 top-4 w-32 bg-white rounded-lg shadow-xl border border-slate-100 z-30 overflow-hidden animate-[fade-in_0.1s_ease-out]">
                                                                    {canEdit && (
                                                                        <button onClick={() => { onStartEditComment(post.id, comment); setActiveMenuCommentId(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2">
                                                                            <span className="material-symbols-outlined text-sm">edit</span> Editar
                                                                        </button>
                                                                    )}
                                                                    {canDelete && (
                                                                        <button onClick={(e) => { e.stopPropagation(); handleLocalDelete(comment.id); setActiveMenuCommentId(null); }} className="w-full text-left px-3 py-2 hover:bg-red-50 text-xs font-bold text-red-600 flex items-center gap-2">
                                                                            <span className="material-symbols-outlined text-sm">delete</span> Eliminar
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {isCommentEditing ? (
                                                <div className="mt-1">
                                                    <textarea
                                                        value={editingComment.text}
                                                        onChange={(e) => setEditingComment({ ...editingComment, text: e.target.value })}
                                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-primary resize-none h-16"
                                                    />
                                                    <div className="flex justify-end gap-2 mt-2">
                                                        <button onClick={() => setEditingComment(null)} className="text-[10px] font-bold text-slate-500 hover:underline">Cancelar</button>
                                                        <button onClick={() => onSaveEditComment(post.id, comment.id, editingComment.text)} className="text-[10px] font-bold text-primary hover:underline">Guardar</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-600 mt-0.5">{renderContent(comment.text, onNavigate)}</p>
                                            )}
                                        </div>

                                        <div className="flex gap-4 mt-1 ml-2 text-[10px] font-bold text-slate-400">
                                            <button
                                                onClick={() => handleLocalToggleLike(comment.id)}
                                                className={`hover:text-primary transition-colors flex items-center gap-1 ${comment.isLiked ? 'text-primary' : ''}`}
                                            >
                                                {comment.isLiked ? 'Me gusta' : 'Me gusta'} {comment.likes > 0 && <span>• {comment.likes}</span>}
                                            </button>
                                            <button
                                                onClick={() => setActiveReplyToId(activeReplyToId === comment.id ? null : comment.id)}
                                                className="hover:text-primary transition-colors"
                                            >
                                                Responder
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Replies Section */}
                                {comment.replies && comment.replies.length > 0 && (
                                    <div className="ml-10 space-y-3 border-l-2 border-slate-100 pl-4 mt-2">
                                        {comment.replies.map((reply: any) => {
                                            // FIX: Use the enriched user object directly from the reply
                                            // This ensures we use the loaded profile from Supabase instead of falling back to hardcoded USERS[0]
                                            const replyAuthor = reply.user || DEFAULT_USER;

                                            const isReplyOwner = (authUser?.id === reply.user_id) || (authUser?.id === reply.userId);
                                            const isReplyEditing = editingComment?.commentId === reply.id;
                                            const canDeleteReply = isReplyOwner || isPostOwner || isAdmin;
                                            const canEditReply = isReplyOwner;

                                            return (
                                                <div key={reply.id} className="flex gap-2 items-start group/reply">
                                                    <div
                                                        className="size-6 rounded-full bg-cover bg-center shrink-0 border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                                                        style={{ backgroundImage: `url("${replyAuthor.avatar}")` }}
                                                        onClick={(e) => { e.stopPropagation(); onNavigate(View.PROFILE, { userId: replyAuthor.id }); }}
                                                    ></div>
                                                    <div className="flex-1">
                                                        <div className="bg-white/50 border border-slate-100 rounded-xl px-3 py-1.5 shadow-sm relative group">
                                                            <div className="flex justify-between items-baseline mb-0.5">
                                                                <p
                                                                    className="text-[10px] font-bold text-slate-900 cursor-pointer hover:text-primary hover:underline"
                                                                    onClick={(e) => { e.stopPropagation(); onNavigate(View.PROFILE, { userId: replyAuthor.id }); }}
                                                                >
                                                                    {replyAuthor.name}
                                                                </p>

                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] text-slate-400 font-medium">{reply.time}</span>
                                                                    {(canDeleteReply || canEditReply) && (
                                                                        <div className="relative">
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setActiveMenuCommentId(activeMenuCommentId === reply.id ? null : reply.id); }}
                                                                                className="text-slate-400 hover:text-slate-600 opacity-0 group-hover/reply:opacity-100 transition-opacity"
                                                                            >
                                                                                <span className="material-symbols-outlined text-xs">more_vert</span>
                                                                            </button>
                                                                            {activeMenuCommentId === reply.id && (
                                                                                <div className="absolute right-0 top-4 w-32 bg-white rounded-lg shadow-xl border border-slate-100 z-30 overflow-hidden animate-[fade-in_0.1s_ease-out]">
                                                                                    {canEditReply && (
                                                                                        <button onClick={() => { onStartEditComment(post.id, reply); setActiveMenuCommentId(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-[10px] font-bold text-slate-700 flex items-center gap-2">
                                                                                            <span className="material-symbols-outlined text-sm">edit</span> Editar
                                                                                        </button>
                                                                                    )}
                                                                                    {canDeleteReply && (
                                                                                        <button onClick={(e) => { e.stopPropagation(); handleLocalDelete(reply.id); setActiveMenuCommentId(null); }} className="w-full text-left px-3 py-2 hover:bg-red-50 text-[10px] font-bold text-red-600 flex items-center gap-2">
                                                                                            <span className="material-symbols-outlined text-sm">delete</span> Eliminar
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {isReplyEditing ? (
                                                                <div className="mt-1">
                                                                    <textarea
                                                                        value={editingComment.text}
                                                                        onChange={(e) => setEditingComment({ ...editingComment, text: e.target.value })}
                                                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] focus:outline-none focus:border-primary resize-none h-12"
                                                                    />
                                                                    <div className="flex justify-end gap-2 mt-1">
                                                                        <button onClick={() => setEditingComment(null)} className="text-[9px] font-bold text-slate-500 hover:underline">Cancelar</button>
                                                                        <button onClick={() => onSaveEditComment(post.id, reply.id, editingComment.text)} className="text-[9px] font-bold text-primary hover:underline">Guardar</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-slate-600 leading-normal">{renderContent(reply.text, onNavigate)}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-3 mt-1 ml-1 text-[9px] font-bold text-slate-400">
                                                            <button
                                                                onClick={() => handleLocalToggleLike(reply.id)}
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
                                {activeReplyToId === comment.id && authUser && (
                                    <div className="ml-10 mt-2 flex gap-2 items-start animate-[fade-in_0.2s_ease-out]">
                                        <div className="size-6 rounded-full bg-cover bg-center shrink-0 border border-slate-200" style={{ backgroundImage: `url("${authUser.avatar}")` }}></div>
                                        <div className="flex-1 relative">
                                            <textarea
                                                ref={(el) => (replyInputRefs.current[comment.id] = el)}
                                                placeholder={`Responde a ${author.name}...`}
                                                className="w-full bg-white border border-slate-200 rounded-xl py-1.5 pl-3 pr-10 text-xs focus:outline-none focus:border-primary resize-none h-8"
                                                value={newReplyText[comment.id] || ''}
                                                onChange={(e) => handleTextChange(e.target.value, { current: replyInputRefs.current[comment.id] } as any, (val) => setNewReplyText({ ...newReplyText, [comment.id]: val }))}
                                                onKeyDown={handleKeyDown}
                                            />
                                            <button onClick={() => handleAddReply(comment.id)} className="absolute right-1.5 top-1.5 text-primary">
                                                <span className="material-symbols-outlined text-base filled">send</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* New Comment Input */}
            {authUser ? (
                <div className="flex gap-3 items-start">
                    <div className="size-8 rounded-full bg-cover bg-center shrink-0 border border-slate-200" style={{ backgroundImage: `url("${authUser.avatar}")` }}></div>
                    <div className="flex-1 relative">
                        <textarea
                            ref={mainInputRef}
                            placeholder="Escribe un comentario..."
                            className="w-full bg-white border border-slate-200 rounded-2xl py-2 pl-4 pr-12 text-sm focus:outline-none focus:border-primary resize-none h-10"
                            value={newCommentText}
                            onChange={(e) => handleTextChange(e.target.value, mainInputRef, setNewCommentText)}
                            onKeyDown={handleKeyDown}
                        />
                        <button onClick={handleAddComment} className="absolute right-2 top-2 text-primary">
                            <span className="material-symbols-outlined filled">send</span>
                        </button>

                        <MentionDropdown
                            suggestions={mentionSuggestions}
                            onSelect={handleSelectMention}
                            position={mentionPosition}
                            activeIndex={activeMentionIndex}
                        />
                    </div>
                </div>
            ) : (
                <div className="bg-white/50 rounded-xl p-3 border border-slate-100 text-center">
                    <button
                        onClick={() => onNavigate(View.LOGIN)}
                        className="text-xs font-bold text-slate-500 hover:text-primary transition-colors"
                    >
                        Inicia sesión para participar en la conversación
                    </button>
                </div>
            )}
        </div>
    );
};
