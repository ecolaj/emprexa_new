import React from 'react';
import { Project, View } from '../types';
import { SDGS } from '../constants';
import { useLanguage } from '../context/LanguageContext';

interface ProjectCardProps {
    project: Project;
    onNavigate: (view: View, params?: any) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onNavigate }) => {
    const { t } = useLanguage();
    const sdg = SDGS.find(s => s.id === project.sdgId);

    return (
        <div
            onClick={() => onNavigate(View.PROJECT_DETAILS, { projectId: project.id })}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full"
        >
            <div className="relative h-48 overflow-hidden">
                <img
                    src={project.image}
                    alt={project.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                {sdg && (
                    <div
                        className="absolute top-4 left-4 size-10 rounded-xl flex items-center justify-center text-white shadow-lg backdrop-blur-md"
                        style={{ backgroundColor: `${sdg.color}EE` }}
                    >
                        <span className="material-symbols-outlined text-2xl">{sdg.icon}</span>
                    </div>
                )}
                <div className="absolute bottom-4 left-4 right-4">
                    <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter text-white border border-white/20">
                        {project.status === 'Activo' || project.status === 'Active' ? t('projectCard.statusActive') : project.status === 'Concluido' || project.status === 'Concluded' ? t('projectCard.statusConcluded') : project.status}
                    </div>
                </div>
            </div>

            <div className="p-5 flex flex-col flex-1">
                <h3 className="text-xl font-black text-slate-900 mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                    {project.title}
                </h3>
                <p className="text-slate-500 text-sm line-clamp-2 mb-4 flex-1">
                    {project.description}
                </p>

                <div className="space-y-4">
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-xs">{t('projectCard.progress')}</span>
                        <span className="text-sm font-black text-slate-900">{project.progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-1000"
                            style={{ width: `${project.progress}%` }}
                        ></div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{t('projectCard.raised')}</span>
                            <span className="font-black text-slate-900 text-sm">${(project.raisedAmount || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{t('projectCard.volunteers')}</span>
                            <span className="font-black text-slate-900 text-sm">{project.volunteersCount || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
