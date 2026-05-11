import React, { useRef, useState, useEffect } from 'react';
import { SDGS, USERS } from '../constants';
import { Post, User } from '../types';
import { MentionDropdown } from './MentionDropdown';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { compressImage } from '../utils/imageUtils';
import { useLanguage } from '../context/LanguageContext';

interface PostFormModalProps {
    show: boolean;
    isEditing: boolean;
    formTitle: string;
    setFormTitle: (val: string) => void;
    formContent: string;
    setFormContent: (val: string) => void;
    formSdgs: number[];
    setFormSdgs: (val: number[]) => void;
    formImages: string[];
    setFormImages: (val: string[]) => void;
    formYoutubeUrl: string;
    setFormYoutubeUrl: (val: string) => void;
    onClose: () => void;
    onSubmit: () => void;
    onRemoveImage: (index: number) => void;
}

export const PostFormModal: React.FC<PostFormModalProps> = ({
    show,
    isEditing,
    formTitle,
    setFormTitle,
    formContent,
    setFormContent,
    formSdgs,
    setFormSdgs,
    formImages,
    setFormImages,
    formYoutubeUrl,
    setFormYoutubeUrl,
    onClose,
    onSubmit,
    onRemoveImage
}) => {
    const { user: authUser, followedUserIds } = useAuth();
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Mention Suggestions State
    const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
    const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
    const [activeMentionIndex, setActiveMentionIndex] = useState(0);
    const [mentionSearchQuery, setMentionSearchQuery] = useState('');

    const handleContentChange = (val: string) => {
        setFormContent(val);

        const selectionStart = textareaRef.current?.selectionStart || val.length;
        const textBeforeCursor = val.slice(0, selectionStart);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        if (lastAtIndex !== -1) {
            const query = textBeforeCursor.slice(lastAtIndex + 1);
            // Si hay un espacio después del @ el query se rompe (no es mención)
            if (!query.includes(' ')) {
                setMentionSearchQuery(query);

                // Mostrar dropdown aunque query esté vacío (si acaban de poner @)
                // Usamos un valor especial para trigger el useEffect
                return;
            }
        }
        setMentionSearchQuery('');
        setMentionSuggestions([]);
    };

    // Real-time Mentions Search Effect
    useEffect(() => {
        const fetchSuggestions = async () => {
            try {
                // 1. Fetch Users
                let userQuery = supabase
                    .from('profiles')
                    .select('id, name, role, avatar, username, plan')
                    .order('name', { ascending: true })
                    .limit(20);

                if (mentionSearchQuery.trim()) {
                    userQuery = userQuery.or(`name.ilike.%${mentionSearchQuery}%,username.ilike.%${mentionSearchQuery}%`);
                }

                const { data: userResults, error } = await userQuery;

                if (userResults && !error) {
                    const mappedResults = userResults.map(u => ({
                        ...u,
                        avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`,
                    }));
                    setMentionSuggestions(mappedResults);
                }

                if (textareaRef.current) {
                    const rect = textareaRef.current.getBoundingClientRect();
                    setMentionPosition({ top: rect.top + 40, left: rect.left + 10 });
                }
            } catch (err) {
                console.error("Error fetching mention suggestions:", err);
            }
        };

        const timer = setTimeout(() => {
            const selectionStart = textareaRef.current?.selectionStart || formContent.length;
            const textBeforeCursor = formContent.slice(0, selectionStart);
            const lastAtIndex = textBeforeCursor.lastIndexOf('@');

            if (lastAtIndex !== -1) {
                const querySinceAt = textBeforeCursor.slice(lastAtIndex + 1);
                if (!querySinceAt.includes(' ')) {
                    fetchSuggestions();
                    return;
                }
            }
            setMentionSuggestions([]);
        }, 300);

        return () => clearTimeout(timer);
    }, [mentionSearchQuery, formContent]);

    const handleSelectMention = (user: any) => {
        const mentionName = user.username || user.name.replace(/\s/g, '');
        const selectionStart = textareaRef.current?.selectionStart || formContent.length;
        const textBeforeCursor = formContent.slice(0, selectionStart);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');

        const before = lastAtIndex;
        const after = selectionStart;

        const newText = formContent.slice(0, before) + `@${mentionName} ` + formContent.slice(after);
        setFormContent(newText);
        setMentionSuggestions([]);
        setMentionSearchQuery('');

        // Refocus
        setTimeout(() => textareaRef.current?.focus(), 10);
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

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !authUser) return;

        setIsUploading(true);
        const files = Array.from(e.target.files);
        const uploadedUrls: string[] = [];

        try {
            for (const file of files as File[]) {
                // Compress image before upload
                const compressedBlob = await compressImage(file);
                const fileToUpload = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' });

                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                const filePath = `${authUser.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('post-images')
                    .upload(filePath, fileToUpload);

                if (uploadError) {
                    console.error("Error al subir imagen individual:", uploadError);
                    continue;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('post-images')
                    .getPublicUrl(filePath);

                uploadedUrls.push(publicUrl);
            }

            if (uploadedUrls.length > 0) {
                setFormImages([...formImages, ...uploadedUrls]);
            }
        } catch (err) {
            console.error("Error crítico en selección de imágenes:", err);
            alert(t('feed.imageUploadError'));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center sm:p-4">
            <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-[600px] flex flex-col overflow-hidden animate-[fade-in_0.2s_ease-out]">
                <div className="flex justify-between items-center px-5 py-3 border-b border-slate-100 bg-white">
                    <h2 className="text-base font-bold text-slate-800">{isEditing ? t('feed.editPost') : t('feed.createPost')}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <div className="p-5 space-y-3 flex-1 overflow-y-auto sm:max-h-[75vh] overflow-x-hidden">
                    <input
                        type="text"
                        placeholder={t('feed.titlePlaceholder')}
                        className="w-full text-lg font-bold placeholder-slate-400 outline-none bg-transparent"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        autoFocus
                    />
                    <textarea
                        ref={textareaRef}
                        placeholder={t('feed.contentPlaceholder')}
                        className="w-full h-20 resize-none outline-none text-sm text-slate-600 placeholder-slate-400 bg-transparent leading-relaxed"
                        value={formContent}
                        onChange={(e) => handleContentChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                    ></textarea>

                    <div className="relative group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                            <span className="material-symbols-outlined text-[20px]">play_circle</span>
                        </div>
                        <input
                            type="text"
                            placeholder={t('feed.youtubePlaceholder')}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            value={formYoutubeUrl}
                            onChange={(e) => setFormYoutubeUrl(e.target.value)}
                        />
                    </div>


                    {isUploading && (
                        <div className="flex items-center gap-2 text-xs font-bold text-primary animate-pulse">
                            <span className="material-symbols-outlined spin">sync</span> {t('feed.loadingImages')}
                        </div>
                    )}

                    <MentionDropdown
                        suggestions={mentionSuggestions}
                        onSelect={handleSelectMention}
                        position={mentionPosition}
                        activeIndex={activeMentionIndex}
                    />

                    {/* Image Preview Grid */}
                    {formImages.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-2">
                            {formImages.map((img, idx) => (
                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group border border-slate-200">
                                    <img src={img} className="w-full h-full object-cover" alt="Preview" />
                                    <button
                                        onClick={() => onRemoveImage(idx)}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <span className="material-symbols-outlined text-sm">close</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Hidden File Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={handleImageSelect}
                    />

                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                        <span className="material-symbols-outlined text-2xl mb-1 group-hover:text-primary transition-colors">add_photo_alternate</span>
                        <span className="text-xs font-bold group-hover:text-primary transition-colors">{t('feed.addMedia')}</span>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">{t('feed.selectSdg')}</label>
                            <span className={`text-xs font-bold ${formSdgs.length > 0 ? 'text-primary' : 'text-slate-400'}`}>{formSdgs.length} {t('feed.selected')}</span>
                        </div>
                        <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 justify-items-center">
                            {SDGS.map(sdg => (
                                <button
                                    key={sdg.id}
                                    onClick={() => setFormSdgs(formSdgs.includes(sdg.id) ? formSdgs.filter(p => p !== sdg.id) : [...formSdgs, sdg.id])}
                                    className={`size-9 rounded-lg flex items-center justify-center text-white font-bold transition-all relative group ${formSdgs.includes(sdg.id) ? 'ring-2 ring-offset-1 ring-slate-900 scale-105 z-10 shadow-md' : 'opacity-80 hover:opacity-100 hover:scale-110'}`}
                                    style={{ backgroundColor: sdg.color }}
                                >
                                    <span className="material-symbols-outlined text-[22px]">{sdg.icon}</span>

                                    <div
                                        className="absolute -top-9 left-1/2 -translate-x-1/2 text-white text-[10px] py-1 px-2.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-all duration-200 shadow-xl font-bold tracking-wide -translate-y-2 group-hover:translate-y-0"
                                        style={{ backgroundColor: sdg.color }}
                                    >
                                        {t(`sdgs.${sdg.id}.short`) || sdg.short}
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45" style={{ backgroundColor: sdg.color }}></div>
                                    </div>

                                    {formSdgs.includes(sdg.id) && (
                                        <div className="absolute -top-1.5 -right-1.5 bg-white text-slate-900 rounded-full size-3.5 flex items-center justify-center shadow-sm z-20"><span className="material-symbols-outlined text-[8px] font-bold">check</span></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="px-5 py-3 bg-slate-50 flex justify-end gap-3 border-t border-slate-100 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-bold text-xs hover:bg-slate-200 rounded-lg transition-colors">{t('feed.cancel')}</button>
                    <button
                        onClick={onSubmit}
                        disabled={!formTitle.trim() && !formContent.trim()}
                        className={`px-6 py-2 text-white font-bold text-xs rounded-lg shadow-sm transition-colors ${(!formTitle.trim() && !formContent.trim()) ? 'bg-slate-300 cursor-not-allowed' : 'bg-primary hover:bg-primary-dark'}`}
                    >
                        {isEditing ? t('feed.saveChanges') : t('feed.publish')}
                    </button>
                </div>
            </div>
        </div>
    );
};
