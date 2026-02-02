import React, { useState, useEffect } from 'react';
import { View, NavProps, Project, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { PROJECTS, USERS, SDGS } from '../constants';
import { ImageLightbox } from '../components/ImageLightbox';
import { supabase } from '../utils/supabase';

export const ProjectDetails: React.FC<NavProps> = ({ navigate, params }) => {
    const { user: authUser, followedProjectIds, toggleFollowProject } = useAuth();
    const [project, setProject] = useState<Project | null>(null);
    const [owner, setOwner] = useState<User | null>(null);
    const [team, setTeam] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const projectId = params?.projectId || 101;

    useEffect(() => {
        const fetchProjectDetails = async () => {
            setIsLoading(true);

            // 1. Fetch Project
            const { data: projData } = await supabase
                .from('projects')
                .select('*, owner:profiles(*)')
                .eq('id', projectId)
                .single();

            if (projData) {
                setProject({
                    ...projData,
                    sdgId: projData.sdg_id,
                    lookingFor: projData.looking_for,
                    team: [] // Will fetch separately
                });
                setOwner(projData.owner);
            }

            // 2. Fetch Team
            const { data: teamData } = await supabase
                .from('project_members')
                .select('profiles(*)')
                .eq('project_id', projectId);

            if (teamData) {
                setTeam(teamData.map((m: any) => m.profiles));
            }

            setIsLoading(false);
        };

        fetchProjectDetails();
    }, [projectId]);

    const [activeTab, setActiveTab] = useState('overview');
    const sdg = project ? SDGS.find(s => s.id === project.sdgId) : null;
    const isOwner = authUser?.id === project?.owner_id;
    const isFollowing = followedProjectIds.includes(Number(projectId));

    // Lightbox
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);

    // Contact Modal
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactType, setContactType] = useState<'funding' | 'volunteer' | 'partnership'>('funding');
    const [contactMessage, setContactMessage] = useState('');

    if (!project) return <div>Project not found</div>;

    const handleSendMessage = () => {
        // Here you would trigger the API call to send the message
        setShowContactModal(false);
        // Optional: Navigate to messages or show success toast
        alert("Mensaje enviado al líder del proyecto.");
    };

    const tabs = [
        { id: 'overview', label: 'Visión General', icon: 'info' },
        { id: 'updates', label: 'Actualizaciones', icon: 'newspaper' },
        { id: 'team', label: 'Equipo', icon: 'groups' }
    ];

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50">

            {/* Hero Header */}
            <div className="relative h-[300px] md:h-[400px] w-full bg-slate-900 group">
                <img
                    src={project.image}
                    alt={project.title}
                    className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[2s]"
                    onClick={() => setIsLightboxOpen(true)}
                />
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
                            <span className="text-sm opacity-80 flex items-center gap-1"><span className="material-symbols-outlined text-sm">location_on</span> Ciudad de México</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button className="size-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white hover:text-slate-900 transition-colors">
                            <span className="material-symbols-outlined">share</span>
                        </button>
                        <button
                            onClick={() => isOwner ? {} : toggleFollowProject(project.id)}
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
                        </button>                  </div>
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
                                        {project.description} Este proyecto busca integrar soluciones basadas en la naturaleza para mitigar los efectos de las islas de calor urbano. A través de la colaboración comunitaria y el uso de tecnología IoT, monitoreamos el impacto en tiempo real.
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Estado</span>
                                            <span className="text-slate-900 font-bold flex items-center gap-2">
                                                <span className="size-2 rounded-full bg-green-500 animate-pulse"></span> {project.status}
                                            </span>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="block text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Fecha de Inicio</span>
                                            <span className="text-slate-900 font-bold">Septiembre 2023</span>
                                        </div>
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
                                                <button className="text-xs font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 group-hover:border-amber-300 group-hover:text-amber-700">Aplicar</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Gallery Preview */}
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-4">Galería de Impacto</h3>
                                    <div className="grid grid-cols-3 gap-2 h-40">
                                        <div className="col-span-2 h-full rounded-l-2xl bg-cover bg-center" style={{ backgroundImage: `url("https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80")` }}></div>
                                        <div className="space-y-2 h-full">
                                            <div className="h-[calc(50%-4px)] rounded-tr-2xl bg-cover bg-center" style={{ backgroundImage: `url("https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?auto=format&fit=crop&w=800&q=80")` }}></div>
                                            <div className="h-[calc(50%-4px)] rounded-br-2xl bg-slate-900 flex items-center justify-center text-white cursor-pointer hover:bg-slate-800 transition-colors">
                                                <span className="font-bold text-sm">+5 Ver más</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'updates' && (
                            <div className="space-y-6">
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                                    <div className="size-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="material-symbols-outlined text-slate-400 text-3xl">campaign</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900">Aún no hay actualizaciones</h3>
                                    <p className="text-slate-500 text-sm">El equipo publicará hitos importantes aquí.</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'team' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {team.map(member => (
                                    <div key={member.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 hover:shadow-md transition-all cursor-pointer" onClick={() => navigate(View.PROFILE, { userId: member.id })}>
                                        <img src={member.avatar} alt={member.name} className="size-14 rounded-full object-cover border border-slate-100" />
                                        <div>
                                            <h4 className="font-bold text-slate-900">{member.name}</h4>
                                            <p className="text-xs text-slate-500">{member.role}</p>
                                        </div>
                                    </div>
                                ))}
                                {team.length === 0 && <div className="col-span-full text-center py-12 text-slate-500">Solo el líder está en este equipo actualmente.</div>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Sidebar Actions */}
                <div className="space-y-6">

                    {/* Progress Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-6">
                        <div className="mb-6">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <p className="text-3xl font-black text-slate-900">35%</p>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Completado</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-slate-700">Fase 1: Diseño</p>
                                </div>
                            </div>
                            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${project.progress}%` }}></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6 pt-6 border-t border-slate-100">
                            <div>
                                <span className="material-symbols-outlined text-green-500 mb-1">paid</span>
                                <p className="text-xl font-bold text-slate-900">$12,400</p>
                                <p className="text-xs text-slate-500">Recaudado</p>
                            </div>
                            <div>
                                <span className="material-symbols-outlined text-blue-500 mb-1">groups</span>
                                <p className="text-xl font-bold text-slate-900">24</p>
                                <p className="text-xs text-slate-500">Voluntarios</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {!isOwner ? (
                                <>
                                    <button
                                        onClick={() => {
                                            setContactType('funding');
                                            setShowContactModal(true);
                                        }}
                                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined filled">volunteer_activism</span> Donar / Apoyar
                                    </button>
                                    <button
                                        onClick={() => {
                                            setContactType('volunteer');
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
                images={[project.image]}
                initialIndex={0}
            />

            {/* Contact Modal */}
            {showContactModal && (
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
                                        onClick={() => setContactType('funding')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${contactType === 'funding' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-600'}`}
                                    >
                                        Financiero
                                    </button>
                                    <button
                                        onClick={() => setContactType('volunteer')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${contactType === 'volunteer' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}
                                    >
                                        Voluntariado
                                    </button>
                                    <button
                                        onClick={() => setContactType('partnership')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${contactType === 'partnership' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-600'}`}
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
                            <button onClick={handleSendMessage} className="px-6 py-2 bg-slate-900 text-white font-bold text-sm rounded-lg hover:bg-slate-800 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm filled">send</span> Enviar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};