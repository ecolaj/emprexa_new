
import React, { useState, useEffect } from 'react';
import { View, NavProps, ID } from '../types';
import { SDGS, USERS } from '../constants';
import { DEFAULT_USER } from '../utils/defaults';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { compressImage } from '../utils/imageUtils';
import { ProjectSuccessModal } from '../components/ProjectSuccessModal';
import { useLanguage } from '../context/LanguageContext';

export const CreateProject: React.FC<NavProps> = ({ navigate, currentView, params }) => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const currentUser = user || DEFAULT_USER; // Fallback to neutral data if no auth

    const isEditing = currentView === View.EDIT_PROJECT;
    const editingProjectId = params?.projectId;

    // Enterprise Gate Logic
    if (currentUser.plan !== 'enterprise') {
        return (
            <div className="flex-1 flex items-center justify-center p-4 bg-slate-50">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
                    <div className="size-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-4xl text-purple-600">domain</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">{t('createProject.enterpriseTitle')}</h2>
                    <p className="text-slate-500 mb-8 leading-relaxed">
                        {t('createProject.enterpriseDesc', { enterprise: <strong>Enterprise</strong> })}
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={() => navigate(View.PRICING)}
                            className="w-full py-3.5 bg-purple-600 text-white rounded-xl font-bold shadow-lg shadow-purple-600/20 hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined">upgrade</span> {t('createProject.upgradeBtn')}
                        </button>
                        <button
                            onClick={() => navigate(View.EXPLORE)}
                            className="w-full py-3 text-slate-500 font-bold hover:text-slate-700"
                        >
                            {t('createProject.returnBtn')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const totalSteps = 3;

    const [formData, setFormData] = useState({
        title: '',
        sdgId: 0,
        description: '',
        location: '',
        lookingFor: [] as string[],
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        customTag: '',
        imagePositionX: 50,
        imagePositionY: 50
    });

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [createdProjectId, setCreatedProjectId] = useState<ID | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0, pos: { x: 50, y: 50 } });
    const [originalImage, setOriginalImage] = useState<string | null>(null);

    // Load project data if editing
    useEffect(() => {
        if (isEditing && editingProjectId) {
            const fetchProject = async () => {
                setLoading(true);
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', editingProjectId)
                    .single();

                if (!error && data) {
                    const [posX, posY] = (data.image || '').split('#pos=')[1]?.split(',') || ['50', '50'];
                    setFormData({
                        title: data.title || '',
                        sdgId: data.sdg_id || 0,
                        description: data.description || '',
                        location: data.location || '',
                        lookingFor: data.looking_for || [],
                        imagePositionX: parseInt(posX),
                        imagePositionY: parseInt(posY),
                        customTag: ''
                    } as any);
                    setOriginalImage(data.image);
                }
                setLoading(false);
            };
            fetchProject();
        }
    }, [isEditing, editingProjectId]);

    const nextStep = () => {
        if (step < totalSteps) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
        else navigate(View.EXPLORE);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePublish = async () => {
        if (!formData.title || !formData.sdgId) {
            alert(t('createProject.validationError'));
            return;
        }

        // Validación de Auth: No permitir publicar con IDs de mock (números)
        if (typeof currentUser.id === 'number') {
            alert(t('createProject.guestError'));
            return;
        }

        setLoading(true);
        try {
            // Default image
            const fallbackImage = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80';

            // Si hay un preview pero no es la de la organización y no hemos subido nada aún, usamos el fallback
            // o lo que ya tenga si estamos editando.
            let imageUrl = isEditing ? imagePreview : (currentUser.cover || fallbackImage);

            // 1. Upload Image if exists
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${currentUser.id}/projects/${fileName}`;

                // Compress image before upload
                const compressedBlob = await compressImage(imageFile);
                const compressedFile = new File([compressedBlob], imageFile.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' });

                console.log('📤 Subiendo imagen a storage:', filePath);
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, compressedFile);

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('avatars')
                        .getPublicUrl(filePath);
                    imageUrl = publicUrl;
                    console.log('✅ Imagen subida con éxito:', imageUrl);
                } else {
                    console.error('❌ Error subiendo imagen:', uploadError);
                    alert(t('createProject.uploadError'));
                    // Reset to original or fallback to avoid base64 payload crash
                    imageUrl = isEditing ? (originalImage || fallbackImage) : (currentUser.cover || fallbackImage);
                }
            } else if (imagePreview && imagePreview.startsWith('data:')) {
                // Si llegamos aquí y sigue siendo base64 (y no se subió), usamos fallback para evitar el reset de conexión
                console.warn('⚠️ Se detectó imagen en Base64 no subida. Usando imagen por defecto para evitar error de red.');
                imageUrl = fallbackImage;
            }

            // 2. Insert or Update Project
            // Append position to URL if not already there or update it
            const cleanImageUrl = imageUrl.split('#pos=')[0];
            const finalImageUrl = `${cleanImageUrl}#pos=${formData.imagePositionX || 50},${formData.imagePositionY || 50}`;

            const projectPayload = {
                title: formData.title,
                description: formData.description,
                sdg_id: formData.sdgId,
                image: finalImageUrl,
                location: formData.location,
                looking_for: formData.lookingFor,
                start_date: formData.startDate,
                end_date: formData.endDate || null,
                progress: isEditing ? undefined : 0,
                status: isEditing ? undefined : 'Activo',
                donations_enabled: true
            };

            console.log('💾 Guardando proyecto en DB...', isEditing ? 'Update' : 'Insert');
            let finalProjectId = isEditing ? editingProjectId : null;

            if (isEditing) {
                const { error } = await supabase
                    .from('projects')
                    .update(projectPayload)
                    .eq('id', editingProjectId);
                if (error) throw error;
                finalProjectId = editingProjectId;
            } else {
                const { data, error } = await supabase
                    .from('projects')
                    .insert({
                        ...projectPayload,
                        owner_id: currentUser.id
                    })
                    .select()
                    .single();

                if (error) {
                    console.error('❌ Error en el insert de projects:', error);
                    throw error;
                }
                finalProjectId = data.id;
            }

            console.log('✨ Proyecto procesado con éxito. ID:', finalProjectId);
            setCreatedProjectId(finalProjectId);
            setShowSuccess(true);
        } catch (err: any) {
            console.error("Error publishing project:", err);
            // Si el error es Failed to fetch, sugerir que puede ser el tamaño de la imagen o conexión literal
            const helpfulMessage = err.message === 'Failed to fetch'
                ? t('createProject.connectionError')
                : err.message;
            alert(t('createProject.publishError', { error: helpfulMessage }));
        } finally {
            setLoading(false);
        }
    };

    const toggleTag = (tag: string) => {
        const current = formData.lookingFor;
        if (current.includes(tag)) {
            setFormData({ ...formData, lookingFor: current.filter(t => t !== tag) });
        } else {
            setFormData({ ...formData, lookingFor: [...current, tag] });
        }
    };

    const toggleSdg = (id: number) => {
        setFormData({ ...formData, sdgId: id });
    };

    const handleAddCustomTag = () => {
        if (!formData.customTag?.trim()) return;
        const tag = formData.customTag.trim();
        if (!formData.lookingFor.includes(tag)) {
            setFormData({
                ...formData,
                lookingFor: [...formData.lookingFor, tag],
                customTag: ''
            });
        } else {
            setFormData({ ...formData, customTag: '' });
        }
    };

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (!imagePreview) return;
        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        setDragStart({
            x: clientX,
            y: clientY,
            pos: { x: formData.imagePositionX, y: formData.imagePositionY }
        });
    };

    const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        const deltaX = (dragStart.x - clientX) * 0.2; // Sensibilidad ajustable
        const deltaY = (dragStart.y - clientY) * 0.2;

        const nextX = Math.max(0, Math.min(100, dragStart.pos.x + deltaX));
        const nextY = Math.max(0, Math.min(100, dragStart.pos.y + deltaY));

        setFormData(prev => ({ ...prev, imagePositionX: Math.round(nextX), imagePositionY: Math.round(nextY) }));
    };

    const handleDragEnd = () => setIsDragging(false);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 flex items-center justify-center p-2 md:p-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header with Progress */}
                <div className="px-8 py-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={prevStep} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm font-bold">
                            <span className="material-symbols-outlined text-lg">arrow_back</span> {t('createProject.back')}
                        </button>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('createProject.step', { current: step, total: totalSteps })}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${(step / totalSteps) * 100}%` }}></div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-8 md:p-12 overflow-y-auto">

                    {/* STEP 1: BASICS */}
                    {step === 1 && (
                        <div className="animate-[fade-in_0.3s_ease-out]">
                            <h2 className="text-3xl font-black text-slate-900 mb-2">
                                {isEditing ? t('createProject.step1Edit') : t('createProject.step1')}
                            </h2>
                            <p className="text-slate-500 mb-8 text-lg">{t('createProject.step1Desc')}</p>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('createProject.nameLabel')}</label>
                                    <input
                                        type="text"
                                        placeholder={t('createProject.namePlaceholder')}
                                        className="w-full text-xl p-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none transition-colors"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-3">{t('createProject.sdgLabel')}</label>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                                        {SDGS.map(sdg => (
                                            <button
                                                key={sdg.id}
                                                onClick={() => toggleSdg(sdg.id)}
                                                className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all ${formData.sdgId === sdg.id
                                                    ? 'scale-105 shadow-md ring-4 ring-offset-2 ring-primary'
                                                    : 'opacity-60 hover:opacity-100 hover:scale-105'
                                                    }`}
                                                style={{ backgroundColor: sdg.color }}
                                                title={t(`sdgs.${sdg.id}.label`) || sdg.label}
                                            >
                                                <span className="material-symbols-outlined text-white text-2xl">{sdg.icon}</span>
                                                <span className="text-[10px] text-white font-bold mt-1">{t('feed.sdgAbbr')} {sdg.id}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: DETAILS */}
                    {step === 2 && (
                        <div className="animate-[fade-in_0.3s_ease-out]">
                            <h2 className="text-3xl font-black text-slate-900 mb-2">{t('createProject.step2')}</h2>
                            <p className="text-slate-500 mb-8 text-lg">{t('createProject.step2Desc')}</p>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('createProject.descLabel')}</label>
                                    <textarea
                                        placeholder={t('createProject.descPlaceholder')}
                                        className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none transition-colors leading-relaxed"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    ></textarea>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('createProject.locationLabel')}</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-4 top-3.5 text-slate-400">location_on</span>
                                        <input
                                            type="text"
                                            placeholder={t('createProject.locationPlaceholder')}
                                            className="w-full p-3 pl-12 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none transition-colors"
                                            value={formData.location}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('createProject.coverLabel')}</label>
                                    <input
                                        type="file"
                                        id="project-image"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                    />
                                    <label
                                        htmlFor="project-image"
                                        className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden relative group min-h-[240px] ${imagePreview ? 'border-primary border-solid' : 'border-slate-300 text-slate-400 hover:bg-slate-50 hover:border-primary hover:text-primary'
                                            }`}
                                        onMouseDown={handleDragStart}
                                        onMouseMove={handleDragMove}
                                        onMouseUp={handleDragEnd}
                                        onMouseLeave={handleDragEnd}
                                        onTouchStart={handleDragStart}
                                        onTouchMove={handleDragMove}
                                        onTouchEnd={handleDragEnd}
                                    >
                                        {imagePreview ? (
                                            <>
                                                <img
                                                    src={imagePreview.split('#pos=')[0]}
                                                    className={`absolute inset-0 w-full h-full object-cover opacity-60 select-none pointer-events-none transition-opacity ${isDragging ? 'opacity-40' : 'opacity-60'}`}
                                                    style={{ objectPosition: `${formData.imagePositionX}% ${formData.imagePositionY}%` }}
                                                    alt="Preview"
                                                />
                                                <div className={`relative z-10 flex flex-col items-center bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/30 shadow-xl transition-all ${isDragging ? 'scale-90 opacity-0' : 'scale-100 opacity-100'}`}>
                                                    <span className="material-symbols-outlined text-4xl mb-1 text-slate-900">drag_pan</span>
                                                    <span className="font-bold text-sm text-slate-900">{t('createProject.dragToMove')}</span>
                                                    <div className="mt-2 text-[10px] uppercase tracking-widest font-black text-slate-700 bg-white/50 px-2 py-0.5 rounded">{t('createProject.clickToChange')}</div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-4xl mb-2">add_photo_alternate</span>
                                                <span className="font-bold text-sm">{t('createProject.uploadLabel')}</span>
                                            </>
                                        )}
                                    </label>

                                    {imagePreview && (
                                        <div className="mt-3 text-center">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                {t('createProject.touchTip')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: NEEDS & REVIEW */}
                    {step === 3 && (
                        <div className="animate-[fade-in_0.3s_ease-out]">
                            <h2 className="text-3xl font-black text-slate-900 mb-2">{t('createProject.step3')}</h2>
                            <p className="text-slate-500 mb-8 text-lg">{t('createProject.step3Desc')}</p>

                            <div className="space-y-4">
                                <div className="flex flex-wrap gap-3">
                                    {[
                                        { key: 'volunteers', label: t('needs.volunteers') },
                                        { key: 'funding', label: t('needs.funding') },
                                        { key: 'partners', label: t('needs.partners') },
                                        { key: 'mentorship', label: t('needs.mentorship') },
                                        { key: 'materials', label: t('needs.materials') },
                                        { key: 'diffusion', label: t('needs.diffusion') },
                                        { key: 'developers', label: t('needs.developers') },
                                        { key: 'designers', label: t('needs.designers') }
                                    ].map(need => (
                                        <button
                                            key={need.key}
                                            onClick={() => toggleTag(need.label)}
                                            className={`px-4 py-2 rounded-full border font-bold text-sm transition-all ${formData.lookingFor.includes(need.label)
                                                ? 'bg-primary border-primary text-white shadow-md'
                                                : 'border-slate-200 text-slate-600 hover:border-primary hover:text-primary bg-white'
                                                }`}
                                        >
                                            {formData.lookingFor.includes(need.label) ? '✓ ' : '+ '} {need.label}
                                        </button>
                                    ))}

                                    {/* Render custom tags that are not in the default list */}
                                    {formData.lookingFor.filter(t_tag => ![t('needs.volunteers'), t('needs.funding'), t('needs.partners'), t('needs.mentorship'), t('needs.materials'), t('needs.diffusion'), t('needs.developers'), t('needs.designers')].includes(t_tag)).map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => toggleTag(tag)}
                                            className="px-4 py-2 rounded-full border bg-primary border-primary text-white shadow-md font-bold text-sm transition-all"
                                        >
                                            ✓ {tag}
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-6">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">{t('createProject.customNeedLabel')}</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder={t('createProject.customNeedPlaceholder')}
                                            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none transition-colors"
                                            value={formData.customTag}
                                            onChange={(e) => setFormData({ ...formData, customTag: (e.target as HTMLInputElement).value })}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddCustomTag()}
                                        />
                                        <button
                                            onClick={handleAddCustomTag}
                                            className="px-6 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                                        >
                                            {t('createProject.add')}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-6">
                                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><span className="material-symbols-outlined">info</span> {t('createProject.summary')}</h4>
                                <p className="text-sm text-blue-800/80 mb-1"><span className="font-bold">{t('createProject.name')}:</span> {formData.title || t('needs.noName')}</p>
                                <p className="text-sm text-blue-800/80"><span className="font-bold">{t('createProject.sdg')}:</span> {formData.sdgId ? `${t('feed.sdgAbbr')} ${formData.sdgId}` : t('needs.notSelected')}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-8 border-t border-slate-100 bg-white flex justify-end gap-4 sticky bottom-0 z-10">
                    {step < totalSteps ? (
                        <button
                            onClick={nextStep}
                            className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-lg shadow-slate-900/20"
                        >
                            {t('createProject.next')} <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    ) : (
                        <button
                            onClick={handlePublish}
                            disabled={loading}
                            className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-lg shadow-primary/30 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <><span className="material-symbols-outlined animate-spin">progress_activity</span> {isEditing ? t('createProject.saving') : t('createProject.publishing')}</>
                            ) : (
                                <><span className="material-symbols-outlined">{isEditing ? 'save' : 'rocket_launch'}</span> {isEditing ? t('createProject.save') : t('createProject.publish')}</>
                            )}
                        </button>
                    )}
                </div>

            </div>

            <ProjectSuccessModal
                isOpen={showSuccess}
                projectName={formData.title}
                isEdit={isEditing}
                onClose={() => navigate(View.EXPLORE)}
                onGoToProject={() => navigate(View.PROJECT_DETAILS, { projectId: createdProjectId })}
            />
        </div>
    );
};