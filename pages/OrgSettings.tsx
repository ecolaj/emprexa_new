
import React, { useState } from 'react';
import { View, NavProps } from '../types';
import { ORGANIZATIONS } from '../constants';

export const OrgSettings: React.FC<NavProps> = ({ navigate, params }) => {
  const orgId = params?.orgId ? Number(params.orgId) : 2;
  const organization = ORGANIZATIONS.find(o => o.id === orgId) || ORGANIZATIONS[1];
  
  // Local state for form
  const [formData, setFormData] = useState({
      name: organization.name,
      description: organization.description,
      location: organization.location,
      website: organization.website
  });

  const handleSave = () => {
      // Simulation of save
      // In a real app, updates API/Context
      alert("Cambios guardados correctamente.");
      navigate(View.ORG_SETTINGS, { orgId: organization.id }); // Reload or stay
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex items-center gap-2 mb-6">
             <button onClick={() => navigate(View.ORG_SETTINGS, { orgId: organization.id })} className="text-slate-400 hover:text-slate-600">
                 <span className="material-symbols-outlined">arrow_back</span>
             </button>
             <h1 className="text-2xl font-black text-slate-900">Gestionar Página: {organization.name}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
                {/* Identity Section */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Identidad de Marca</h2>
                    
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Logo</label>
                        <div className="flex items-center gap-4">
                            <div className="size-20 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden">
                                <img src={organization.logo} alt="Logo" className="w-full h-full object-cover" />
                            </div>
                            <button className="text-sm font-bold text-primary border border-primary/20 px-4 py-2 rounded-lg hover:bg-primary/5">Cambiar Logo</button>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Portada</label>
                        <div className="h-32 w-full rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative group cursor-pointer">
                             <img src={organization.cover} alt="Cover" className="w-full h-full object-cover" />
                             <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                 <span className="text-white font-bold text-sm">Cambiar Imagen</span>
                             </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre de la Organización</label>
                            <input 
                                type="text" 
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descripción (Bio)</label>
                            <textarea 
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary h-24 resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Contact Info */}
                 <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Información Pública</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sitio Web</label>
                            <input 
                                type="text" 
                                value={formData.website}
                                onChange={(e) => setFormData({...formData, website: e.target.value})}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ubicación Sede</label>
                            <input 
                                type="text" 
                                value={formData.location}
                                onChange={(e) => setFormData({...formData, location: e.target.value})}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar Actions */}
            <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-4">Acciones</h3>
                    <button 
                        onClick={handleSave}
                        className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all mb-3"
                    >
                        Guardar Cambios
                    </button>
                    <button 
                        onClick={() => navigate(View.ORG_SETTINGS, { orgId: organization.id })}
                        className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50"
                    >
                        Ver Página Pública
                    </button>
                </div>

                <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-green-600">verified</span>
                        <h3 className="font-bold text-green-800">Estado: Verificado</h3>
                    </div>
                    <p className="text-xs text-green-700 leading-relaxed">
                        Tu organización tiene la insignia de verificación activa. Esto aumenta la confianza de inversores y socios.
                    </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
