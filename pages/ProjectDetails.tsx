import React, { useState, useEffect } from 'react';
import { View, NavProps, Project, User, ProjectUpdate } from '../types';
import { useAuth } from '../context/AuthContext';
import { PROJECTS, USERS, SDGS } from '../constants';
import { ImageLightbox } from '../components/ImageLightbox';
import { ConfirmModal } from '../components/ConfirmModal';
import { Loading } from '../components/Loading';
import { supabase } from '../utils/supabase';
import { compressImage } from '../utils/imageUtils';

export const ProjectDetails: React.FC<NavProps> = ({ navigate, params }) => {
    const { user: authUser, followedProjectIds, toggleFollowProject } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [owner, setOwner] = useState<User | null>(null);
    const [team, setTeam] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
    const [isPostingUpdate, setIsPostingUpdate] = useState(false);
    const [newUpdate, setNewUpdate] = useState({ title: '', content: '' });
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    // Stats Management
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [isUpdatingStats, setIsUpdatingStats] = useState(false);
    const [tempStats, setTempStats] = useState({
        progress: 0,
        raised_amount: 0,
        volunteers_count: 0,
        start_date: '',
        end_date: '',
        location: ''
    });

    const [isContactTypeLocked, setIsContactTypeLocked] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false);

    const openStatsModal = () => {
        setTempStats({
            progress: project?.progress || 0,
            raised_amount: project?.raisedAmount || 0,
            volunteers_count: project?.volunteersCount || 0,
            start_date: project?.startDate || '',
            end_date: project?.endDate || '',
            location: project?.location || ''
        });
        setShowStatsModal(true);
    };

    // Gallery Management
    const [showGalleryModal, setShowGalleryModal] = useState(false);
    const [isUploadingGallery, setIsUploadingGallery] = useState(false);

    // Gallery State
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [lightboxImages, setLightboxImages] = useState<string[]>([]);

    // Team Management State
    const [showAddMemberMode, setShowAddMemberMode] = useState(false);
    const [searchMemberQuery, setSearchMemberQuery] = useState('');
    const [memberSuggestions, setMemberSuggestions] = useState<User[]>([]);

    // --- TEAM LOGIC ---
    useEffect(() => {
        const searchUsers = async () => {
            if (searchMemberQuery.length < 2) {
                setMemberSuggestions([]);
                return;
            }

            const { data } = await supabase
                .from('profiles')
                .select('*')
                .ilike('name', `%${searchMemberQuery}%`)
                .limit(5);

            if (data) {
                // Filter out already added members and owner
                const currentTeamIds = team.map(m => m.id);
                setMemberSuggestions(data.filter((u: User) =>
                    u.id !== project?.owner_id &&
                    !currentTeamIds.includes(u.id)
                ));
            }
        };

        const debounce = setTimeout(searchUsers, 300);
        return () => clearTimeout(debounce);
    }, [searchMemberQuery, team, project]);

    const handleAddMember = async (user: User) => {
        if (!project) return;

        const { error } = await supabase
            .from('project_members')
            .insert({ project_id: project.id, user_id: user.id, role: 'Miembro' });

        if (!error) {
            setTeam([...team, user]);
            setSearchMemberQuery('');
            setMemberSuggestions([]);
            setShowAddMemberMode(false);
        } else {
            console.error(error);
            alert("Error al agregar miembro");
        }
    };

    const handleRemoveMember = async (userId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigating to profile
        if (!project || !confirm("¿Seguro que quieres quitar a este miembro del equipo?")) return;

        const { error } = await supabase
            .from('project_members')
            .delete()
            .eq('project_id', project.id)
            .eq('user_id', userId);

        if (!error) {
            setTeam(team.filter(m => m.id !== userId));
        } else {
            console.error(error);
            alert("Error al eliminar miembro");
        }
    };

    const openGalleryLightbox = (index: number) => {
        const allImages = [project?.image, ...(project?.gallery || [])].filter(Boolean) as string[];
        setLightboxImages(allImages);
        setLightboxIndex(index);
        setIsLightboxOpen(true);
    };

    const handleUploadGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !project || !authUser) return;

        const currentGallery = project.gallery || [];
        const remainingSlots = 10 - currentGallery.length;

        if (remainingSlots <= 0) {
            alert("Límite alcanzado: Máximo 10 fotos en la galería.");
            return;
        }

        const filesToUpload = Array.from(files).slice(0, remainingSlots) as File[];
        setIsUploadingGallery(true);

        try {
            const uploadPromises = filesToUpload.map(async (file: File) => {
                // Compress image before upload
                const compressedBlob = await compressImage(file);
                const compressedFile = new File([compressedBlob], file.name, { type: file.type });

                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
                const filePath = `${authUser.id}/projects/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, compressedFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                return publicUrl;
            });

            const newUrls = await Promise.all(uploadPromises);
            const newGallery = [...currentGallery, ...newUrls];

            const { error: updateError } = await supabase
                .from('projects')
                .update({ gallery: newGallery })
                .eq('id', project.id);

            if (updateError) throw updateError;

            setProject({ ...project, gallery: newGallery });
            if (files.length > remainingSlots) {
                alert(`Solo se pudieron subir ${remainingSlots} fotos (límite de 10).`);
            }
        } catch (err) {
            console.error("Error uploading to gallery:", err);
            alert("Error al subir una o más imágenes. Por favor verifica que el archivo no sea demasiado grande o que tengas conexión a internet estable.");
        } finally {
            setIsUploadingGallery(false);
        }
    };

    const handleApplyNeed = (need: string) => {
        if (!project || !owner) return;

        const prefillMessage = `Hola @${owner.username || owner.name}, estoy interesado en aplicar a tu proyecto "${project.title}" para apoyar en: "${need}". Me gustaría conocer más detalles sobre cómo puedo trabajar con ustedes.`;

        setContactType('volunteer');
        setIsContactTypeLocked(true);
        setContactMessage(prefillMessage);
        setShowContactModal(true);
    };

    const handleDeleteGalleryImage = async (imgUrl: string) => {
        if (!project) return;
        const newGallery = (project.gallery || []).filter(img => img !== imgUrl);

        try {
            const { error } = await supabase
                .from('projects')
                .update({ gallery: newGallery })
                .eq('id', project.id);

            if (error) throw error;
            setProject({ ...project, gallery: newGallery });
        } catch (err) {
            console.error("Error deleting gallery image:", err);
        }
    };

    const handleUpdateStats = async () => {
        setIsUpdatingStats(true);
        try {
            const { error } = await supabase
                .from('projects')
                .update(tempStats)
                .eq('id', project?.id);

            if (error) throw error;

            setProject(prev => prev ? {
                ...prev,
                progress: tempStats.progress,
                raisedAmount: tempStats.raised_amount,
                volunteersCount: tempStats.volunteers_count,
                startDate: tempStats.start_date,
                endDate: tempStats.end_date,
                location: tempStats.location
            } : null);
            setShowStatsModal(false);
        } catch (err) {
            console.error("Error updating stats:", err);
            alert("No se pudieron actualizar las estadísticas.");
        } finally {
            setIsUpdatingStats(false);
        }
    };

    const handleToggleStatus = async () => {
        if (!project) return;
        const newStatus = project.status === 'Activo' ? 'Concluido' : 'Activo';

        try {
            const { error } = await supabase
                .from('projects')
                .update({ status: newStatus })
                .eq('id', project.id);

            if (error) throw error;
            setProject({ ...project, status: newStatus });
        } catch (err) {
            console.error("Error updating status:", err);
            alert("No se pudo cambiar el estado del proyecto.");
        }
    };

    // Extract ID safely and avoid fallback if ID is missing but intended
    const projectId = params?.projectId;

    useEffect(() => {
        const fetchProjectDetails = async () => {
            setIsLoading(true);

            if (!projectId) {
                console.error("ProjectDetails: No projectId provided in params.");
                setIsLoading(false);
                return;
            }

            console.log("Searching for Project ID:", projectId, "Type:", typeof projectId);

            // DEBUG: See what is actually visible to this client
            const { data: visibleTests } = await supabase.from('projects').select('id, title').limit(5);
            console.log("Sample of visible projects:", visibleTests);

            const searchId = isNaN(Number(projectId)) ? projectId : Number(projectId);

            // 1. Fetch Project - Explicitly specify owner_id relationship to avoid ambiguity
            let { data: projData, error: projError } = await supabase
                .from('projects')
                .select('*, owner:profiles!owner_id(*)')
                .eq('id', searchId)
                .maybeSingle();

            // FALLBACK 1: If searchId is number, try string match
            if (!projData && typeof searchId === 'number') {
                const { data: stringMatch, error: stringError } = await supabase
                    .from('projects')
                    .select('*, owner:profiles!owner_id(*)')
                    .eq('id', String(searchId))
                    .maybeSingle();
                if (stringMatch) {
                    projData = stringMatch;
                    projError = stringError;
                }
            }

            // FALLBACK 2: If everything above failed, try simple fetch without any joins
            if (!projData) {
                console.log("Joined fetch failed or returned nothing, trying simple fetch...");
                const { data: simpleData, error: simpleError } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', searchId)
                    .maybeSingle();

                if (simpleData) {
                    console.log("Simple fetch worked!");
                    projData = simpleData;
                    projError = null; // Clear join error if simple fetch works
                } else if (simpleError) {
                    projError = simpleError;
                }
            }

            if (projError) {
                console.error('Error fetching project details:', projError);
            }

            if (projData) {
                setProject({
                    ...projData,
                    ownerId: projData.owner_id,
                    sdgId: projData.sdg_id,
                    lookingFor: projData.looking_for || [],
                    raisedAmount: projData.raised_amount || 0,
                    volunteersCount: projData.volunteers_count || 0,
                    startDate: projData.start_date,
                    endDate: projData.end_date,
                    location: projData.location,
                    team: []
                });

                // If owner was joined
                if (projData.owner) {
                    setOwner(projData.owner);
                } else {
                    // Manual fetch for owner if join failed
                    const { data: ownerData } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', projData.owner_id)
                        .maybeSingle();
                    if (ownerData) setOwner(ownerData);
                }
            } else {
                console.warn(`Project with ID ${projectId} not found in database.`);
            }

            // 2. Fetch Team
            const { data: teamData } = await supabase
                .from('project_members')
                .select('profiles(*)')
                .eq('project_id', projectId);

            if (teamData) {
                setTeam(teamData.map((m: any) => m.profiles));
            }

            // 3. Fetch Updates
            const { data: updateData } = await supabase
                .from('project_updates')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });
            if (updateData) setUpdates(updateData.map(u => ({
                id: u.id,
                projectId: u.project_id,
                title: u.title,
                content: u.content,
                image: u.image,
                createdAt: u.created_at
            })));

            setIsLoading(false);
        };

        fetchProjectDetails();
    }, [projectId]);

    const [activeTab, setActiveTab] = useState('overview');
    const sdg = project ? SDGS.find(s => s.id === project.sdgId) : null;
    const isOwner = authUser?.id === project?.owner_id;
    const isFollowing = followedProjectIds.includes(Number(projectId));

    // Contact Modal
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactType, setContactType] = useState<'funding' | 'volunteer' | 'partnership'>('funding');
    const [contactMessage, setContactMessage] = useState('');

    if (isLoading) return <Loading />; // Handle loading state properly
    if (!project) return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
            <div className="size-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-4xl text-slate-400">search_off</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Proyecto no encontrado</h2>
            <p className="text-slate-500 mb-6 text-center max-w-sm">No pudimos encontrar los detalles del proyecto que buscas. Es posible que haya sido eliminado o el enlace sea incorrecto.</p>
            <button onClick={() => navigate(View.EXPLORE)} className="bg-primary text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-primary/20">Volver a Explorar</button>
        </div>
    );

    const handleDeleteProject = async () => {
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId);

            if (error) throw error;
            navigate(View.EXPLORE);
        } catch (err) {
            console.error("Error deleting project:", err);
            alert("No se pudo eliminar el proyecto.");
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const handlePostUpdate = async () => {
        if (!newUpdate.title || !newUpdate.content) return;
        setIsPostingUpdate(true);
        try {
            const { data, error } = await supabase
                .from('project_updates')
                .insert({
                    project_id: projectId,
                    title: newUpdate.title,
                    content: newUpdate.content
                })
                .select()
                .single();

            if (error) throw error;

            setUpdates([{
                id: data.id,
                projectId: data.project_id,
                title: data.title,
                content: data.content,
                createdAt: data.created_at
            }, ...updates]);
            setNewUpdate({ title: '', content: '' });
        } catch (err) {
            console.error("Error posting update:", err);
        } finally {
            setIsPostingUpdate(false);
        }
    };


    const handleSendMessage = async () => {
        if (!authUser || !owner || !contactMessage.trim()) return;

        setIsSendingMessage(true);
        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    sender_id: authUser.id,
                    receiver_id: owner.id,
                    content: contactMessage.trim(),
                    read: false
                });

            if (error) throw error;

            setShowContactModal(false);
            setShowSuccessModal(true);
            setContactMessage('');
        } catch (err) {
            console.error("Error sending message:", err);
            alert("No se pudo enviar el mensaje. Por favor intenta de nuevo.");
        } finally {
            setIsSendingMessage(false);
        }
    };

    const tabs = [
        { id: 'overview', label: 'Visión General', icon: 'info' },
        { id: 'updates', label: 'Actualizaciones', icon: 'newspaper' },
        { id: 'team', label: 'Equipo', icon: 'groups' }
    ];

    if (isLoading || !project) return <Loading />;

    return (
        <>
            <div className="flex-1 overflow-y-auto bg-slate-50">

                {/* Hero Header */}
                <div className="relative h-[300px] md:h-[400px] w-full bg-slate-900 group overflow-hidden">
                    {(() => {
                        const [posX, posY] = (project.image || '').split('#pos=')[1]?.split(',') || ['50', '50'];
                        return (
                            <img
                                src={project.image?.split('#pos=')[0]}
                                alt={project.title}
                                className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-[3s] cursor-pointer"
                                style={{ objectPosition: `${posX}% ${posY}%` }}
                                onClick={() => openGalleryLightbox(0)}
                            />
                        );
                    })()}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>

                    {/* Top Nav Overlay */}
                    <div className="absolute top-0 left-0 p-6 z-10">
                        <button onClick={() => navigate(View.EXPLORE)} className="flex items-center gap-2 text-white/80 hover:text-white bg-black/20 backdrop-blur-md px-4 py-2 rounded-full font-bold text-sm transition-colors">
                            <span className="material-symbols-outlined text-lg">arrow_back</span> Volver a Explorar
                        </button>
                    </div>

                    {/* Hero Content */}
                    <div className="absolute bottom-0 left-0 w-full p-6 md:p-10 z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                        <div className="max-w-3xl">
                            <div className="flex flex-wrap gap-2 mb-4">
                                {sdg && (
                                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm">
                                        <span className="material-symbols-outlined text-sm" style={{ color: sdg.color }}>{sdg.icon}</span>
                                        ODS {sdg.id}: {sdg.label}
                                    </div>
                                )}
                            </div>

                            <h1 className="text-3xl md:text-5xl font-black text-white mb-2 leading-tight drop-shadow-md">
                                {project.title}
                            </h1>
                            <div className="flex items-center gap-3 text-white/90">
                                <div className="flex items-center gap-2">
                                    <img src={owner.avatar} className="size-6 rounded-full border border-white/50" alt={owner.name} />
                                    <span className="font-bold text-sm">{owner.name}</span>
                                </div>
                                <span>•</span>
                                <span className="text-sm opacity-80 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">location_on</span>
                                    {project.location || owner?.location || 'Mundo'}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            {isOwner ? (
                                <>
                                    <button
                                        onClick={() => navigate(View.EDIT_PROJECT, { projectId })}
                                        className="px-6 py-3 rounded-xl font-bold bg-white text-slate-900 border-2 border-white shadow-lg flex items-center gap-2 hover:bg-slate-50 transition-all"
                                    >
                                        <span className="material-symbols-outlined">edit</span> Editar
                                    </button>
                                    <button
                                        onClick={() => setShowDeleteModal(true)}
                                        className="size-12 rounded-xl bg-red-500/20 backdrop-blur-md flex items-center justify-center text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white transition-all"
                                    >
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => toggleFollowProject(project.id)}
                                        className={`px-6 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 ${isFollowing
                                            ? 'bg-white/10 backdrop-blur-md text-white border-2 border-white/30'
                                            : 'bg-primary text-white hover:bg-primary-dark border-2 border-transparent'
                                            }`}
                                    >
                                        {isFollowing ? (
                                            <><span className="material-symbols-outlined filled">check_circle</span> Siguiendo</>
                                        ) : (
                                            <><span className="material-symbols-outlined">add</span> Seguir Proyecto</>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Main Content */}
                    <div className="lg:col-span-2">

                        {/* Tabs */}
                        <div className="flex border-b border-slate-200 mb-6 overflow-x-auto no-scrollbar">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="animate-[fade-in_0.3s_ease-out]">
                            {activeTab === 'overview' && (
                                <div className="space-y-8">
                                    {/* Description */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                        <h3 className="text-xl font-bold text-slate-900 mb-4">Sobre el Proyecto</h3>
                                        <p className="text-slate-600 leading-relaxed text-base mb-6">
                                            {project.description}
                                        </p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                                                <div>
                                                    <span className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Estado</span>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-900 font-bold flex items-center gap-2">
                                                            <span className={`size-2 rounded-full ${project.status === 'Activo' ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                                            {project.status}
                                                        </span>
                                                        {isOwner && (
                                                            <button
                                                                onClick={handleToggleStatus}
                                                                className={`text-[10px] font-black uppercase px-2 py-1 rounded-md transition-all ${project.status === 'Activo'
                                                                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                    }`}
                                                            >
                                                                {project.status === 'Activo' ? 'Finalizar' : 'Reactivar'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                <span className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Fecha de Inicio</span>
                                                <span className="text-slate-900 font-bold">
                                                    {project.startDate ? new Date(project.startDate + 'T12:00:00').toLocaleDateString() : 'Por definir'}
                                                </span>
                                            </div>
                                            {project.endDate && (
                                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                    <span className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Fecha Final</span>
                                                    <span className="text-slate-900 font-bold">{new Date(project.endDate + 'T12:00:00').toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Needs */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-amber-500">handshake</span> ¿Qué buscamos?
                                        </h3>
                                        <div className="space-y-3">
                                            {project.lookingFor.map((need, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50 transition-colors group cursor-pointer">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                                                            {idx + 1}
                                                        </div>
                                                        <span className="font-bold text-slate-700 group-hover:text-amber-800">{need}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleApplyNeed(need)}
                                                        className="text-xs font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 group-hover:border-amber-300 group-hover:text-amber-700 hover:bg-amber-100 transition-colors"
                                                    >
                                                        Aplicar
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Gallery Preview */}
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-xl font-bold text-slate-900">Galería de Impacto</h3>
                                            {isOwner && (
                                                <button
                                                    onClick={() => setShowGalleryModal(true)}
                                                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-sm">settings_photo_camera</span>
                                                    Gestionar Galería
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 h-40">
                                            <div
                                                className="col-span-2 h-full rounded-l-2xl bg-cover bg-center overflow-hidden relative group cursor-pointer"
                                                onClick={() => openGalleryLightbox(0)}
                                            >
                                                <img src={project.image} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-white text-3xl">zoom_in</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2 h-full">
                                                {project.gallery && project.gallery.length > 0 ? (
                                                    <div
                                                        className="h-[calc(50%-4px)] rounded-tr-2xl bg-cover bg-center overflow-hidden relative group cursor-pointer"
                                                        onClick={() => openGalleryLightbox(1)}
                                                    >
                                                        <img src={project.gallery[0]} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-white text-xl">zoom_in</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-[calc(50%-4px)] rounded-tr-2xl bg-slate-100 flex items-center justify-center border border-slate-200 border-dashed">
                                                        <span className="material-symbols-outlined text-slate-300">image</span>
                                                    </div>
                                                )}
                                                <div
                                                    className="h-[calc(50%-4px)] rounded-br-2xl bg-slate-900 flex items-center justify-center text-white cursor-pointer hover:bg-slate-800 transition-colors relative"
                                                    onClick={() => openGalleryLightbox(0)}
                                                >
                                                    <span className="font-bold text-sm">+{project.gallery?.length || 0} Ver más</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'updates' && (
                                <div className="space-y-6">
                                    {isOwner && (
                                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-primary">add_circle</span> Publicar Actualización
                                            </h4>
                                            <div className="space-y-4">
                                                <input
                                                    type="text"
                                                    placeholder="Título del hito (ej. ¡Meta de reforestación alcanzada!)"
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none"
                                                    value={newUpdate.title}
                                                    onChange={(e) => setNewUpdate({ ...newUpdate, title: e.target.value })}
                                                />
                                                <textarea
                                                    placeholder="Describe el avance del proyecto..."
                                                    className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none resize-none"
                                                    value={newUpdate.content}
                                                    onChange={(e) => setNewUpdate({ ...newUpdate, content: e.target.value })}
                                                ></textarea>
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={handlePostUpdate}
                                                        disabled={isPostingUpdate || !newUpdate.title}
                                                        className="px-6 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-all disabled:opacity-50"
                                                    >
                                                        {isPostingUpdate ? 'Publicando...' : 'Publicar Hito'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {updates.length > 0 ? (
                                        updates.map(update => (
                                            <div key={update.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-[fade-in_0.3s_ease-out]">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-xl">campaign</span>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-slate-900">{update.title}</h4>
                                                            <p className="text-xs text-slate-400">{new Date(update.createdAt).toLocaleDateString()} • Actualización de Equipo</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                                                    {update.content}
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                                            <div className="size-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <span className="material-symbols-outlined text-slate-400 text-3xl">campaign</span>
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900">Aún no hay actualizaciones</h3>
                                            <p className="text-slate-500 text-sm">El equipo publicará hitos importantes aquí.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'team' && (
                                <div>
                                    {isOwner && (
                                        <div className="mb-6 bg-white p-4 rounded-xl border border-slate-200">
                                            {!showAddMemberMode ? (
                                                <button
                                                    onClick={() => setShowAddMemberMode(true)}
                                                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
                                                >
                                                    <span className="material-symbols-outlined">person_add</span> Agregar Miembro
                                                </button>
                                            ) : (
                                                <div className="animate-[fade-in_0.2s_ease-out]">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <label className="text-sm font-bold text-slate-700">Buscar Usuario</label>
                                                        <button onClick={() => setShowAddMemberMode(false)} className="text-xs font-bold text-red-500 hover:underline">Cancelar</button>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            placeholder="Escribe el nombre del usuario..."
                                                            className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none"
                                                            value={searchMemberQuery}
                                                            onChange={(e) => setSearchMemberQuery(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <span className="material-symbols-outlined absolute left-3 top-3.5 text-slate-400">search</span>

                                                        {memberSuggestions.length > 0 && (
                                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-20 max-h-60 overflow-y-auto">
                                                                {memberSuggestions.map(user => (
                                                                    <button
                                                                        key={user.id}
                                                                        onClick={() => handleAddMember(user)}
                                                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0"
                                                                    >
                                                                        <img src={user.avatar} className="size-8 rounded-full border border-slate-100 bg-slate-200" alt={user.name} />
                                                                        <div>
                                                                            <p className="font-bold text-sm text-slate-800">{user.name}</p>
                                                                            <p className="text-xs text-slate-500 truncate">{user.role || 'Usuario'}</p>
                                                                        </div>
                                                                        <span className="material-symbols-outlined text-primary ml-auto">add_circle</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {team.map(member => (
                                            <div key={member.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all cursor-pointer group" onClick={() => navigate(View.PROFILE, { userId: member.id })}>
                                                <img src={member.avatar} alt={member.name} className="size-14 rounded-full object-cover border border-slate-100" />
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-slate-900 truncate">{member.name}</h4>
                                                    <p className="text-xs text-slate-500 truncate">{member.role}</p>
                                                </div>
                                                {isOwner && (
                                                    <button
                                                        onClick={(e) => handleRemoveMember(member.id, e)}
                                                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-all"
                                                        title="Eliminar miembro"
                                                    >
                                                        <span className="material-symbols-outlined">delete</span>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {team.length === 0 && (
                                            <div className="col-span-full py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-100 rounded-2xl">
                                                <div className="size-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                                    <span className="material-symbols-outlined text-slate-300 text-3xl">groups_2</span>
                                                </div>
                                                <p className="text-slate-500 font-medium">Aún no hay miembros en el equipo.</p>
                                                {isOwner && <p className="text-xs text-slate-400 mt-1">¡Invita a colaboradores para comenzar!</p>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Sidebar Actions */}
                    <div className="space-y-6">

                        {/* Progress Card */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-50">
                                    <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Estado del Proyecto</h3>
                                    {isOwner && (
                                        <button
                                            onClick={openStatsModal}
                                            className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all"
                                            title="Gestionar Estadísticas"
                                        >
                                            <span className="material-symbols-outlined text-lg">settings</span>
                                        </button>
                                    )}
                                </div>

                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <p className="text-3xl font-black text-slate-900">{project.progress}%</p>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Completado</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-slate-700">
                                            {project.progress < 30 ? 'Fase Inicial' : project.progress < 70 ? 'En Desarrollo' : 'Fase Final'}
                                        </p>
                                    </div>
                                </div>
                                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                    <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${project.progress}%` }}></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6 pt-6 border-t border-slate-100">
                                <div>
                                    <span className="material-symbols-outlined text-green-500 mb-1">paid</span>
                                    <p className="text-xl font-bold text-slate-900">
                                        ${project.raisedAmount?.toLocaleString() || '0'}
                                    </p>
                                    <p className="text-xs text-slate-500">Recaudado</p>
                                </div>
                                <div>
                                    <span className="material-symbols-outlined text-blue-500 mb-1">groups</span>
                                    <p className="text-xl font-bold text-slate-900">{project.volunteersCount || '0'}</p>
                                    <p className="text-xs text-slate-500">Voluntarios</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {!isOwner ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                setContactType('funding');
                                                setIsContactTypeLocked(false);
                                                setShowContactModal(true);
                                            }}
                                            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined filled">volunteer_activism</span> Donar / Apoyar
                                        </button>
                                        <button
                                            onClick={() => {
                                                setContactType('volunteer');
                                                setIsContactTypeLocked(false);
                                                setShowContactModal(true);
                                            }}
                                            className="w-full py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:border-slate-300 hover:bg-slate-50 transition-colors"
                                        >
                                            Contactar Equipo
                                        </button>
                                    </>
                                ) : (
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                                        <p className="text-sm font-bold text-slate-900">Vista de Propietario</p>
                                        <p className="text-xs text-slate-500">Gestiona las solicitudes de apoyo desde tu bandeja de mensajes.</p>
                                        <button onClick={() => navigate(View.MESSAGES)} className="mt-2 text-primary text-xs font-bold hover:underline">Ir a Mensajes</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Related SDG */}
                        {sdg && (
                            <div
                                className="p-6 rounded-2xl text-white relative overflow-hidden cursor-pointer hover:opacity-95 transition-opacity"
                                style={{ backgroundColor: sdg.color }}
                                onClick={() => navigate(View.SDG_FEED, { id: sdg.id })}
                            >
                                <div className="relative z-10">
                                    <span className="opacity-80 text-xs font-bold uppercase tracking-wider">Alineado con</span>
                                    <h3 className="text-2xl font-black mt-1 mb-2">ODS {sdg.id}</h3>
                                    <p className="text-sm opacity-90 leading-tight font-medium">{sdg.label}</p>
                                </div>
                                <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-9xl opacity-20">{sdg.icon}</span>
                            </div>
                        )}
                    </div>

                </div>

                <ImageLightbox
                    isOpen={isLightboxOpen}
                    onClose={() => setIsLightboxOpen(false)}
                    images={lightboxImages}
                    initialIndex={lightboxIndex}
                />

                {/* Contact Modal */}
                {
                    showContactModal && (
                        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-[fade-in_0.2s_ease-out] overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                    <h3 className="font-bold text-slate-900">Contactar al Proyecto</h3>
                                    <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-slate-600">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>

                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo de Apoyo</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => !isContactTypeLocked && setContactType('funding')}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${contactType === 'funding' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-600'} ${isContactTypeLocked && contactType !== 'funding' ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                disabled={isContactTypeLocked && contactType !== 'funding'}
                                            >
                                                Financiero
                                            </button>
                                            <button
                                                onClick={() => !isContactTypeLocked && setContactType('volunteer')}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${contactType === 'volunteer' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600'} ${isContactTypeLocked && contactType !== 'volunteer' ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                disabled={isContactTypeLocked && contactType !== 'volunteer'}
                                            >
                                                Voluntariado
                                            </button>
                                            <button
                                                onClick={() => !isContactTypeLocked && setContactType('partnership')}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${contactType === 'partnership' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-600'} ${isContactTypeLocked && contactType !== 'partnership' ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                disabled={isContactTypeLocked && contactType !== 'partnership'}
                                            >
                                                Alianza
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mensaje</label>
                                        <textarea
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:border-primary outline-none h-32 resize-none"
                                            placeholder={contactType === 'funding' ? "Estoy interesado en apoyar económicamente este proyecto. Por favor contáctenme para detalles." : "Me gustaría colaborar con mis habilidades..."}
                                            value={contactMessage}
                                            onChange={(e) => setContactMessage(e.target.value)}
                                        ></textarea>
                                    </div>

                                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800">
                                        <span className="font-bold">Nota:</span> Este mensaje se enviará directamente a la bandeja de entrada del líder del proyecto.
                                    </div>
                                </div>

                                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                                    <button onClick={() => setShowContactModal(false)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-lg">Cancelar</button>
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={isSendingMessage || !contactMessage.trim()}
                                        className="px-6 py-2 bg-slate-900 text-white font-bold text-sm rounded-lg hover:bg-slate-800 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {isSendingMessage ? (
                                            <>
                                                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                                Enviando...
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-sm filled">send</span>
                                                Enviar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                <ConfirmModal
                    isOpen={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={handleDeleteProject}
                    title="¿Eliminar Proyecto?"
                    description="Esta acción es permanente y se perderá toda la información, seguidores y avances registrados."
                    confirmText={isDeleting ? "Eliminando..." : "Sí, eliminar proyecto"}
                    type="danger"
                    icon="delete_forever"
                />

                {/* Stats Management Modal */}
                {
                    showStatsModal && (
                        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-[scale-in_0.2s_ease-out]">
                                <div className="p-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-900">Gestionar Métricas</h3>
                                            <p className="text-slate-500 text-sm">Actualiza el progreso y resultados de tu impacto.</p>
                                        </div>
                                        <button onClick={() => setShowStatsModal(false)} className="size-10 rounded-full bg-slate-50 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors">
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Progreso (%)</label>
                                                <span className="text-primary font-black">{tempStats.progress}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                                                value={tempStats.progress}
                                                onChange={(e) => setTempStats({ ...tempStats, progress: Number(e.target.value) })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dinero Recaudado ($)</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-3.5 text-slate-400 font-bold">$</span>
                                                    <input
                                                        type="number"
                                                        className="w-full pl-7 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none text-sm"
                                                        value={tempStats.raised_amount}
                                                        onChange={(e) => setTempStats({ ...tempStats, raised_amount: Number(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Voluntarios (#)</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-3.5 text-slate-400 font-bold">#</span>
                                                    <input
                                                        type="number"
                                                        className="w-full pl-7 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none text-sm"
                                                        value={tempStats.volunteers_count}
                                                        onChange={(e) => setTempStats({ ...tempStats, volunteers_count: Number(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fecha de Inicio</label>
                                                <input
                                                    type="date"
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none text-sm"
                                                    value={tempStats.start_date}
                                                    onChange={(e) => setTempStats({ ...tempStats, start_date: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fecha Estimada Fin</label>
                                                <input
                                                    type="date"
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none text-sm"
                                                    value={tempStats.end_date}
                                                    onChange={(e) => setTempStats({ ...tempStats, end_date: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Ubicación del Impacto</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-3.5 text-slate-400 font-bold material-symbols-outlined text-sm">location_on</span>
                                                <input
                                                    type="text"
                                                    placeholder="Ej. Ciudad de México, México"
                                                    className="w-full pl-9 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none text-sm"
                                                    value={tempStats.location}
                                                    onChange={(e) => setTempStats({ ...tempStats, location: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex gap-3">
                                        <button
                                            onClick={() => setShowStatsModal(false)}
                                            className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleUpdateStats}
                                            disabled={isUpdatingStats}
                                            className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-xl shadow-slate-900/20 hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isUpdatingStats ? (
                                                <><span className="material-symbols-outlined animate-spin text-sm">progress_activity</span> Guardando...</>
                                            ) : (
                                                'Guardar Cambios'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Gallery Management Modal */}
                {
                    showGalleryModal && (
                        <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-[scale-in_0.2s_ease-out]">
                                <div className="p-8 md:p-12">
                                    <div className="flex justify-between items-start mb-8">
                                        <div>
                                            <h3 className="text-3xl font-black text-slate-900">Galería del Proyecto</h3>
                                            <p className="text-slate-500 font-medium">Sube fotos de tus avances. Límite: 10 imágenes.</p>
                                        </div>
                                        <button onClick={() => setShowGalleryModal(false)} className="size-12 rounded-full bg-slate-50 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors">
                                            <span className="material-symbols-outlined">close</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
                                        {/* Upload Button */}
                                        {(project.gallery?.length || 0) < 10 && (
                                            <label className={`aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group ${isUploadingGallery ? 'pointer-events-none opacity-50' : ''}`}>
                                                <input type="file" className="hidden" accept="image/*" multiple onChange={handleUploadGallery} />
                                                <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors text-3xl">add_a_photo</span>
                                                <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Subir</span>
                                            </label>
                                        )}

                                        {project.gallery?.map((img, idx) => (
                                            <div key={idx} className="aspect-square rounded-2xl overflow-hidden relative group">
                                                <img src={img} className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => handleDeleteGalleryImage(img)}
                                                    className="absolute top-1 right-1 size-6 bg-red-500 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {isUploadingGallery && (
                                        <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl text-primary mb-8 animate-pulse">
                                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                            <span className="text-sm font-bold">Subiendo imagen de impacto...</span>
                                        </div>
                                    )}

                                    <div className="bg-slate-50 p-6 rounded-[24px]">
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            <span className="font-bold text-slate-900 block mb-1">Consejo:</span>
                                            Sube fotos que muestren resultados reales: árboles plantados, entregas de comida, o prototipos funcionales. Las fotos de impacto aumentan la confianza de los donantes.
                                        </p>
                                    </div>

                                    <div className="mt-8">
                                        <button
                                            onClick={() => setShowGalleryModal(false)}
                                            className="w-full py-4 bg-primary text-white font-black text-lg rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                                        >
                                            Aceptar y Guardar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Success Message Modal */}
                {
                    showSuccessModal && (
                        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
                            <div className="bg-white rounded-[40px] shadow-2xl p-8 max-w-sm w-full text-center animate-[scale-in_0.3s_ease-out]">
                                <div className="size-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <span className="material-symbols-outlined text-green-500 text-5xl">check_circle</span>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-2">¡Mensaje Enviado!</h3>
                                <p className="text-slate-500 leading-relaxed mb-8">
                                    Tu solicitud ha sido enviada al líder del proyecto. Recibirás una respuesta en tu bandeja de mensajes.
                                </p>
                                <button
                                    onClick={() => setShowSuccessModal(false)}
                                    className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-colors"
                                >
                                    Entendido
                                </button>
                            </div>
                        </div>
                    )
                }
            </div>
        </>
    );
};
