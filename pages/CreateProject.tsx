
import React, { useState, useEffect } from 'react';
import { View, NavProps } from '../types';
import { SDGS, USERS } from '../constants';

export const CreateProject: React.FC<NavProps> = ({ navigate }) => {
  const currentUser = USERS[0]; // Juan (Enterprise)
  
  // Enterprise Gate Logic
  if (currentUser.plan !== 'enterprise') {
    return (
      <div className="flex-1 flex items-center justify-center p-4 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
            <div className="size-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl text-purple-600">domain</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Exclusivo Enterprise</h2>
            <p className="text-slate-500 mb-8 leading-relaxed">
                La creación y gestión de proyectos de alto impacto requiere un plan <strong>Enterprise</strong>.
            </p>
            
            <div className="space-y-3">
                <button 
                    onClick={() => navigate(View.PRICING)}
                    className="w-full py-3.5 bg-purple-600 text-white rounded-xl font-bold shadow-lg shadow-purple-600/20 hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined">upgrade</span> Actualizar a Enterprise
                </button>
                <button 
                    onClick={() => navigate(View.EXPLORE)}
                    className="w-full py-3 text-slate-500 font-bold hover:text-slate-700"
                >
                    Volver
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
    lookingFor: [] as string[]
  });

  const nextStep = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
    else navigate(View.EXPLORE);
  };

  const handlePublish = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
        setLoading(false);
        navigate(View.SUCCESS); 
    }, 1500);
  };

  const toggleSdg = (id: number) => {
    setFormData({...formData, sdgId: id});
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col min-h-[600px]">
        
        {/* Header with Progress */}
        <div className="px-8 py-6 border-b border-slate-100 bg-white sticky top-0 z-10">
            <div className="flex justify-between items-center mb-4">
                <button onClick={prevStep} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm font-bold">
                    <span className="material-symbols-outlined text-lg">arrow_back</span> Atrás
                </button>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paso {step} de {totalSteps}</span>
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
                    <h2 className="text-3xl font-black text-slate-900 mb-2">Comencemos con lo básico</h2>
                    <p className="text-slate-500 mb-8 text-lg">Dale un nombre a tu iniciativa y selecciona su causa principal.</p>
                    
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Nombre del Proyecto</label>
                            <input 
                                type="text" 
                                placeholder="Ej. Reforestación Urbana Zona Norte" 
                                className="w-full text-xl p-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none transition-colors"
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-3">ODS Principal</label>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                                {SDGS.map(sdg => (
                                    <button 
                                        key={sdg.id}
                                        onClick={() => toggleSdg(sdg.id)}
                                        className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all ${
                                            formData.sdgId === sdg.id 
                                            ? 'scale-105 shadow-md ring-4 ring-offset-2 ring-primary' 
                                            : 'opacity-60 hover:opacity-100 hover:scale-105'
                                        }`}
                                        style={{ backgroundColor: sdg.color }}
                                        title={sdg.label}
                                    >
                                        <span className="material-symbols-outlined text-white text-2xl">{sdg.icon}</span>
                                        <span className="text-[10px] text-white font-bold mt-1">{sdg.id}</span>
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
                    <h2 className="text-3xl font-black text-slate-900 mb-2">Detalles del Impacto</h2>
                    <p className="text-slate-500 mb-8 text-lg">Describe qué quieres lograr y dónde.</p>

                    <div className="space-y-6">
                         <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Descripción Corta</label>
                            <textarea 
                                placeholder="Describe el objetivo, el problema que resuelves y cómo lo harás..." 
                                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none transition-colors resize-none leading-relaxed"
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                            ></textarea>
                            <div className="text-right mt-1 text-xs text-slate-400 font-bold">0 / 300</div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Ubicación</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-4 top-3.5 text-slate-400">location_on</span>
                                <input 
                                    type="text" 
                                    placeholder="Ciudad, País o 'Remoto'" 
                                    className="w-full p-3 pl-12 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none transition-colors"
                                    value={formData.location}
                                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Portada del Proyecto</label>
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-primary hover:text-primary transition-all cursor-pointer">
                                <span className="material-symbols-outlined text-4xl mb-2">add_photo_alternate</span>
                                <span className="font-bold text-sm">Subir Imagen de Portada</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: NEEDS & REVIEW */}
            {step === 3 && (
                <div className="animate-[fade-in_0.3s_ease-out]">
                    <h2 className="text-3xl font-black text-slate-900 mb-2">¿Qué necesitas?</h2>
                    <p className="text-slate-500 mb-8 text-lg">Selecciona las etiquetas para atraer a los colaboradores correctos.</p>

                    <div className="mb-8">
                        <div className="flex flex-wrap gap-3">
                            {['Voluntarios', 'Financiación', 'Socios', 'Mentoria', 'Materiales', 'Difusión', 'Desarrolladores', 'Diseñadores'].map(tag => (
                                <button 
                                    key={tag}
                                    className="px-4 py-2 rounded-full border border-slate-200 font-bold text-sm text-slate-600 hover:border-primary hover:text-primary focus:bg-primary focus:text-white transition-all"
                                >
                                    + {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-6">
                        <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><span className="material-symbols-outlined">info</span> Resumen</h4>
                        <p className="text-sm text-blue-800/80 mb-1"><span className="font-bold">Nombre:</span> {formData.title || 'Sin nombre'}</p>
                        <p className="text-sm text-blue-800/80"><span className="font-bold">ODS:</span> {formData.sdgId ? `ODS ${formData.sdgId}` : 'No seleccionado'}</p>
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
                    Continuar <span className="material-symbols-outlined">arrow_forward</span>
                </button>
            ) : (
                <button 
                    onClick={handlePublish}
                    disabled={loading}
                    className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-lg shadow-primary/30 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <><span className="material-symbols-outlined animate-spin">progress_activity</span> Publicando...</>
                    ) : (
                        <><span className="material-symbols-outlined">rocket_launch</span> Lanzar Proyecto</>
                    )}
                </button>
            )}
        </div>

      </div>
    </div>
  );
};