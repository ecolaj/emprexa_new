import React from 'react';
import { User, Post, View } from '../types';
import { renderBadge, renderContent } from '../utils/renderers';
import { SdgBadge } from './SdgBadge';
import { CommentSection } from './CommentSection';

interface PostCardProps {
    post: Post;
    currentUser: User;
    onNavigate: (view: View, params?: any) => void;
    onToggleLike: (postId: number) => void;
    onShare: (postId: number) => void;
    onToggleSavedPost: (postId: number) => void;
    isSaved: boolean;
    activeCommentSectionId: number | null;
    onToggleCommentSection: (postId: number) => void;
    onOpenLightbox: (images: string[], index: number) => void;

    // Comment props (proxied to CommentSection)
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

    // Post owner actions
    isOwner: boolean;
    activeMenuPostId: number | null;
    setActiveMenuPostId: (id: number | null) => void;
    onStartEditPost: (post: Post) => void;
    onDeletePost: (postId: number) => void;
    onLockedAction?: (reason: 'comment' | 'post' | 'dashboard') => void;
}

export const PostCard: React.FC<PostCardProps> = ({
    post,
    currentUser,
    onNavigate,
    onToggleLike,
    onShare,
    onToggleSavedPost,
    isSaved,
    activeCommentSectionId,
    onToggleCommentSection,
    onOpenLightbox,
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
    setActiveMenuCommentId,
    isOwner,
    activeMenuPostId,
    setActiveMenuPostId,
    onStartEditPost,
    onDeletePost,
    onLockedAction
}) => {
    const isCommentsOpen = activeCommentSectionId === post.id;
    const postUser = post.user.id === currentUser.id ? currentUser : post.user;

    return (
        <article className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-visible relative animate-[fade-in_0.3s_ease-out]">
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div
                        className="size-10 rounded-full bg-cover bg-center border border-slate-100 cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ backgroundImage: `url("${postUser.avatar}")` }}
                        onClick={() => onNavigate(View.PROFILE, { userId: postUser.id })}
                    ></div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-slate-900 cursor-pointer hover:text-primary hover:underline" onClick={() => onNavigate(View.PROFILE, { userId: postUser.id })}>{postUser.name}</h3>
                            {renderBadge(postUser.plan || 'free')}
                        </div>
                        <p className="text-xs text-slate-400">{post.time} • {post.location}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end max-w-[200px]" style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}>
                    {post.sdgIds.map(id => (
                        <SdgBadge key={id} sdgId={id} navigate={onNavigate} />
                    ))}

                    {isOwner && (
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); setActiveMenuPostId(activeMenuPostId === post.id ? null : post.id); }}
                                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                            >
                                <span className="material-symbols-outlined">more_horiz</span>
                            </button>
                            {activeMenuPostId === post.id && (
                                <div className="absolute right-0 top-8 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-[fade-in_0.1s_ease-out]">
                                    <button onClick={() => onStartEditPost(post)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">edit</span> Editar
                                    </button>
                                    <button onClick={() => onDeletePost(post.id)} className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-sm font-medium text-red-600 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-lg">delete</span> Eliminar
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="px-4 pb-3">
                <h2 className="font-bold text-lg mb-2 text-slate-900">{post.title}</h2>
                <p className="text-sm text-slate-600 mb-3 leading-relaxed whitespace-pre-wrap">
                    {renderContent(post.content, onNavigate)}
                </p>

                {post.images.length > 0 && (
                    <div className={`grid gap-1 rounded-xl overflow-hidden ${post.images.length > 1 ? 'grid-cols-2 h-80' : 'h-[420px]'}`}>
                        {post.images.slice(0, 2).map((img, idx) => {
                            const isLastVisible = idx === 1 && post.images.length > 2;
                            return (
                                <div
                                    key={idx}
                                    className="relative h-full overflow-hidden group/img"
                                    onClick={(e) => { e.stopPropagation(); onOpenLightbox(post.images, idx); }}
                                >
                                    <div
                                        className="bg-cover bg-center h-full hover:scale-105 transition-transform duration-700 cursor-pointer"
                                        style={{ backgroundImage: `url("${img}")` }}
                                    ></div>

                                    {isLastVisible && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center cursor-pointer group-hover/img:bg-black/40 transition-colors">
                                            <span className="text-white text-2xl font-black">
                                                +{post.images.length - 2}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-slate-500">
                <div className="flex gap-6">
                    <button
                        onClick={() => onToggleLike(post.id)}
                        className={`flex items-center gap-2 text-sm transition-all group ${post.isLiked ? 'text-red-500 font-bold' : 'hover:text-red-500'}`}
                    >
                        <span className={`material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform ${post.isLiked ? 'filled animate-[pulse_0.2s_ease-out]' : ''}`}>favorite</span> {post.likes}
                    </button>
                    <button
                        onClick={() => onToggleCommentSection(post.id)}
                        className={`flex items-center gap-2 text-sm transition-colors ${isCommentsOpen ? 'text-primary' : 'hover:text-primary'}`}
                    >
                        <span className={`material-symbols-outlined text-[20px] ${isCommentsOpen ? 'filled' : ''}`}>chat_bubble</span> {post.comments || (post.recentComments?.length || 0)}
                    </button>
                    <button
                        onClick={() => onShare(post.id)}
                        className="flex items-center gap-2 hover:text-primary text-sm transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">share</span> Compartir
                    </button>
                </div>
                <button
                    onClick={() => onToggleSavedPost(post.id)}
                    className={`text-slate-400 hover:text-indigo-600 transition-colors ${isSaved ? 'text-indigo-600' : ''}`}
                    title={isSaved ? "Quitar marcador" : "Guardar para leer después"}
                >
                    <span className={`material-symbols-outlined ${isSaved ? 'filled' : ''}`}>bookmark</span>
                </button>
            </div>

            {isCommentsOpen && (
                <CommentSection
                    post={post}
                    currentUser={currentUser}
                    onNavigate={onNavigate}
                    onToggleCommentLike={onToggleCommentLike}
                    onAddCommentReply={onAddCommentReply}
                    onDeleteComment={onDeleteComment}
                    onStartEditComment={onStartEditComment}
                    onSaveEditComment={onSaveEditComment}
                    onAddComment={onAddComment}
                    activeReplyToId={activeReplyToId}
                    setActiveReplyToId={setActiveReplyToId}
                    editingComment={editingComment}
                    setEditingComment={setEditingComment}
                    activeMenuCommentId={activeMenuCommentId}
                    setActiveMenuCommentId={setActiveMenuCommentId}
                />
            )}
        </article>
    );
};
