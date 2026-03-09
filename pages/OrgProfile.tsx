
import React, { useState, useEffect } from 'react';
import { View, NavProps } from '../types';
import { SDGS, USERS, ORGANIZATIONS, PROJECTS } from '../constants';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_USER } from '../utils/defaults';
import { useLanguage } from '../context/LanguageContext';

export const OrgProfile: React.FC<NavProps> = ({ navigate, params }) => {
   type TabType = 'overview' | 'projects' | 'team';
   const [activeTab, setActiveTab] = useState<TabType>('overview');
   const [isFollowing, setIsFollowing] = useState(false);
   const [isMenuOpen, setIsMenuOpen] = useState(false);
   const { t } = useLanguage();

   // 1. Get Organization ID from params, default to 1 if not present
   const orgId = params?.orgId ? Number(params.orgId) : 1;
   const organization = ORGANIZATIONS.find(o => o.id === orgId) || ORGANIZATIONS[0];

   const { user: authUser } = useAuth();
   // 2. Identify Current User & Admin Status
   const currentUser = authUser || DEFAULT_USER;
   const isAdmin = organization.adminIds?.includes(currentUser.id);

   // 3. Filter data for this organization
   const orgProjects = PROJECTS.filter(p => p.orgId === organization.id);
   const orgMembers = USERS.filter(u => u.organizationId === organization.id);

   const getSdgInfo = (id: number) => SDGS.find(s => s.id === id);

   return (
      <div className="flex-1 overflow-y-auto bg-slate-50">
         {/* Organization Header */}
         <div className="bg-white border-b border-slate-200">
            {/* Banner */}
            <div className="h-64 bg-slate-900 relative group overflow-hidden">
               <img
                  src={organization.cover}
                  alt="Cover"
                  className="absolute inset-0 w-full h-full object-cover"
                  crossOrigin="anonymous"
               />
               <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>

               {/* Admin / Claim Button Top Right */}
               <div className="absolute top-6 right-6 z-20">
                  {isAdmin && (
                     <button
                        onClick={() => navigate(View.ORG_SETTINGS, { orgId: organization.id, editMode: true })}
                        className="bg-black/40 hover:bg-black/60 text-white backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold border border-white/20 transition-all flex items-center gap-2"
                     >
                        <span className="material-symbols-outlined text-sm">edit</span> {t('orgProfile.editCover')}
                     </button>
                  )}
               </div>
            </div>

            {/* Header Content with Improved Layout */}
            <div className="px-6 md:px-8 pb-0 relative">

               {/* Main Flex Container: Avatar overlaps, Text sits below */}
               <div className="flex flex-col md:flex-row gap-6 items-start">

                  {/* Logo / Avatar - Negative Margin to overlap banner */}
                  <div className="-mt-16 z-10 shrink-0 mx-auto md:mx-0">
                     <div className="size-32 md:size-40 bg-white rounded-2xl shadow-lg p-1.5 overflow-hidden">
                        <img src={organization.logo} alt="Logo" className="w-full h-full object-cover rounded-xl border border-slate-100" />
                     </div>
                  </div>

                  {/* Text Info - Padded top to clear banner on mobile, aligns right on desktop */}
                  <div className="flex-1 pt-2 md:pt-4 w-full">
                     <div className="flex flex-col md:flex-row justify-between items-start gap-4">

                        {/* Name & Bio */}
                        <div className="text-center md:text-left w-full">
                           <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                              <h1 className="text-3xl font-black text-slate-900 leading-tight">{organization.name}</h1>
                              {organization.verified && (
                                 <span className="material-symbols-outlined text-blue-500 filled text-xl" title={t('orgProfile.verifiedTitle')}>verified</span>
                              )}
                           </div>
                           <p className="text-slate-500 text-lg leading-relaxed max-w-3xl mb-4">{organization.description}</p>

                           {/* Meta Data */}
                           <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm font-medium text-slate-600 mb-6">
                              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-slate-400">location_on</span> {organization.location}</span>
                              <a href={`https://${organization.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline"><span className="material-symbols-outlined">link</span> {organization.website}</a>
                              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-slate-400">group</span> {t('orgProfile.members').replace('{count}', String(organization.membersCount))}</span>
                              <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-xs uppercase tracking-wide text-slate-500 border border-slate-200">{organization.category}</span>
                           </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 w-full md:w-auto shrink-0 justify-center md:justify-end">
                           {isAdmin ? (
                              <button
                                 onClick={() => navigate(View.ORG_SETTINGS, { orgId: organization.id, editMode: true })}
                                 className="px-5 py-2.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
                              >
                                 <span className="material-symbols-outlined text-sm">settings</span> {t('orgProfile.managePage')}
                              </button>
                           ) : (
                              <button
                                 onClick={() => setIsFollowing(!isFollowing)}
                                 className={`px-5 py-2.5 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 ${isFollowing
                                    ? 'bg-white border-2 border-slate-200 text-slate-700 hover:border-red-200 hover:text-red-500'
                                    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
                                    }`}
                              >
                                 {isFollowing ? (
                                    <><span className="material-symbols-outlined filled">check</span> {t('orgProfile.following')}</>
                                 ) : (
                                    <><span className="material-symbols-outlined">add</span> {t('orgProfile.follow')}</>
                                 )}
                              </button>
                           )}

                           <div className="relative">
                              <button
                                 onClick={() => setIsMenuOpen(!isMenuOpen)}
                                 className="px-3 py-2.5 bg-white border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
                              >
                                 <span className="material-symbols-outlined">more_horiz</span>
                              </button>
                              {isMenuOpen && (
                                 <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-30 overflow-hidden animate-[fade-in_0.2s_ease-out]">
                                    <button className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-2">
                                       <span className="material-symbols-outlined text-sm">share</span> {t('orgProfile.share')}
                                    </button>
                                    <button className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-medium text-slate-700 flex items-center gap-2">
                                       <span className="material-symbols-outlined text-sm">flag</span> {t('orgProfile.report')}
                                    </button>
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Navigation Tabs */}
               <div className="flex gap-8 mt-4 border-t border-slate-100 pt-1 overflow-x-auto no-scrollbar">
                  {[
                     { id: 'overview', label: t('orgProfile.tabs.impact') },
                     { id: 'projects', label: t('orgProfile.tabs.projects').replace('{count}', String(orgProjects.length)) },
                     { id: 'team', label: t('orgProfile.tabs.team') },
                  ].map(tab => (
                     <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`py-4 text-sm font-bold border-t-2 -mt-1.5 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                     >
                        {tab.label}
                     </button>
                  ))}
               </div>
            </div>
         </div>

         {/* Content Area */}
         <div className="p-4 md:p-8 max-w-7xl mx-auto">

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-[fade-in_0.3s_ease-out]">
                  {/* Left Column */}
                  <div className="lg:col-span-2 space-y-8">

                     {/* Impact Stats */}
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-green-50 p-6 rounded-2xl border border-green-100 text-center">
                           <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-3">
                              <span className="material-symbols-outlined text-2xl">forest</span>
                           </div>
                           <h4 className="text-3xl font-black text-slate-900">{organization.stats.trees}</h4>
                           <p className="text-xs font-bold text-green-700 uppercase tracking-wide mt-1">{t('orgProfile.stats.ecosystem')}</p>
                        </div>
                        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-center">
                           <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3">
                              <span className="material-symbols-outlined text-2xl">groups</span>
                           </div>
                           <h4 className="text-3xl font-black text-slate-900">{organization.stats.lives}</h4>
                           <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mt-1">{t('orgProfile.stats.people')}</p>
                        </div>
                        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 text-center">
                           <div className="w-12 h-12 mx-auto bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-3">
                              <span className="material-symbols-outlined text-2xl">co2</span>
                           </div>
                           <h4 className="text-3xl font-black text-slate-900">{organization.stats.carbon}</h4>
                           <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mt-1">{t('orgProfile.stats.carbon')}</p>
                        </div>
                     </div>

                     <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                           <h3 className="text-lg font-bold text-slate-900">{t('orgProfile.sections.focus')}</h3>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-2">
                           {[...(organization.focusSdgs || [])].sort((a, b) => a - b).map(sdgId => {
                              const sdg = getSdgInfo(sdgId);
                              if (!sdg) return null;
                              return (
                                 <div key={sdg.id} className="shrink-0 w-24 flex flex-col items-center gap-2 group cursor-pointer" onClick={() => navigate(View.SDG_FEED, { id: sdg.id })}>
                                    <div className="size-20 rounded-xl shadow-sm flex items-center justify-center text-white font-black transition-transform group-hover:scale-105"
                                       style={{ backgroundColor: sdg.color }}>
                                       <span className="material-symbols-outlined text-4xl">{sdg.icon}</span>
                                    </div>
                                    <span className="text-xs font-bold text-slate-500 text-center leading-tight">
                                       {t(`sdgs.${sdg.id}.short`) || sdg.short}
                                    </span>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                     <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-900 mb-4">{t('orgProfile.sections.transparency')}</h3>
                        {organization.verified ? (
                           <div className="space-y-3">
                              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                                 <span className="material-symbols-outlined text-green-600">verified_user</span>
                                 <div>
                                    <p className="font-bold text-sm text-green-800">{t('orgProfile.sections.verifiedEntity')}</p>
                                    <p className="text-xs text-green-600">{t('orgProfile.sections.verifiedDesc')}</p>
                                 </div>
                              </div>
                              <button className="w-full py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg text-sm hover:bg-slate-50">
                                 {t('orgProfile.sections.viewReport')}
                              </button>
                           </div>
                        ) : (
                           <div className="bg-slate-50 p-4 rounded-xl text-center">
                              <p className="text-sm text-slate-500 mb-2">{t('orgProfile.sections.noVerification')}</p>
                              {isAdmin ? (
                                 <button onClick={() => navigate(View.ORG_SETTINGS, { orgId: organization.id, editMode: true })} className="text-primary text-xs font-bold hover:underline">{t('orgProfile.sections.verifyNow')}</button>
                              ) : (
                                 <span className="text-xs text-slate-400">{t('orgProfile.sections.onlyAdmins')}</span>
                              )}
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            )}

            {/* TAB: PROJECTS */}
            {activeTab === 'projects' && (
               <div className="animate-[fade-in_0.3s_ease-out]">
                  {isAdmin && (
                     <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                        <div>
                           <h4 className="font-bold text-primary text-sm">{t('orgProfile.projects.manage')}</h4>
                           <p className="text-xs text-slate-500">{t('orgProfile.projects.manageDesc')}</p>
                        </div>
                        <button onClick={() => navigate(View.CREATE_PROJECT)} className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary-dark">
                           {t('orgProfile.projects.newProject')}
                        </button>
                     </div>
                  )}

                  {orgProjects.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {orgProjects.map((project) => {
                           const sdg = getSdgInfo(project.sdgId);
                           return (
                              <div key={project.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden group hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate(View.PROJECT_DETAILS, { projectId: project.id })}>
                                 <div className="h-48 bg-slate-200 relative overflow-hidden">
                                    <img src={project.image} alt="Project" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-slate-900 shadow-sm flex items-center gap-1">
                                       <span className="material-symbols-outlined text-xs" style={{ color: sdg?.color }}>{sdg?.icon}</span>
                                       {t('feed.sdgAbbr')} {sdg?.id}
                                    </div>
                                    <div className="absolute bottom-3 right-3 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold shadow-sm flex items-center gap-1">
                                       <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span> {project.status === 'Activo' ? t('projectDetails.statusActive') : project.status === 'Concluido' ? t('projectDetails.statusConcluded') : project.status}
                                    </div>
                                 </div>
                                 <div className="p-5">
                                    <h3 className="font-bold text-lg text-slate-900 mb-2 line-clamp-1">{project.title}</h3>
                                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">{project.description}</p>
                                    <div className="w-full bg-slate-100 h-2 rounded-full mb-2 overflow-hidden">
                                       <div className="bg-primary h-full rounded-full" style={{ width: `${project.progress}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-xs font-medium text-slate-500">
                                       <span>{t('orgProfile.projects.progress')}</span>
                                       <span className="text-slate-900 font-bold">{project.progress}%</span>
                                    </div>
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  ) : (
                     <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                        <p>{t('orgProfile.projects.noProjects')}</p>
                     </div>
                  )}
               </div>
            )}

            {/* TAB: TEAM */}
            {activeTab === 'team' && (
               <div className="animate-[fade-in_0.3s_ease-out]">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                     {orgMembers.map((member) => (
                        <div
                           key={member.id}
                           className="bg-white p-6 rounded-2xl border border-slate-200 text-center hover:shadow-md transition-shadow cursor-pointer"
                           onClick={() => navigate(View.PROFILE, { userId: member.id })}
                        >
                           <div className="size-24 mx-auto rounded-full bg-slate-200 mb-4 overflow-hidden border-4 border-slate-50 shadow-sm">
                              <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                           </div>
                           <h3 className="font-bold text-slate-900 text-lg hover:text-primary transition-colors">{member.name}</h3>
                           <p className="text-primary text-sm font-medium mb-3">{member.role}</p>
                        </div>
                     ))}

                     {orgMembers.length === 0 && (
                        <div className="col-span-full text-center py-12 text-slate-500">
                           <p>{t('orgProfile.team.noMembers')}</p>
                        </div>
                     )}
                  </div>
               </div>
            )}

         </div>
      </div>
   );
};
