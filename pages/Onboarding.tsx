
import React, { useState, useEffect, useRef } from 'react';
import { View, NavProps } from '../types';
import { SDGS } from '../constants';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';

export const Onboarding: React.FC<NavProps> = ({ navigate }) => {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: user?.name || '',
    role: '',
    identity: '',
    goals: [] as string[],
    sdgs: [] as number[],
    avatar: user?.avatar || ''
  });

  const [errors, setErrors] = useState({
    name: ''
  });

  // Sync with user data if it loads later
  useEffect(() => {
    if (user) {
      // Solo actualizar si el nombre es diferente al correo o al valor por defecto
      if (user.name && user.name !== user.email?.split('@')[0]) {
        setFormData(prev => ({ ...prev, name: user.name }));
      }
      if (user.avatar) {
        setFormData(prev => ({ ...prev, avatar: user.avatar }));
      }
    }
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;

    setIsUploading(true);
    const file = e.target.files[0];

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update form state
      setFormData(prev => ({ ...prev, avatar: publicUrl }));

    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Error al cargar la imagen. Intenta de nuevo.');
    } finally {
      setIsUploading(false);
    }
  };

  const finishOnboarding = async () => {
    try {
      // 1. Prepare updates for Supabase
      const updates = {
        name: formData.name,
        role: formData.role || 'Agente de Cambio',
        sdgInterests: formData.sdgs,
        status: 'active' as const, // Change status to active after completion
        bio: `Enfocado en: ${formData.goals.join(', ')}. Rol en el ecosistema: ${formData.identity}.`,
        avatar: formData.avatar || user?.avatar || '' // Include avatar
      };

      // 2. Save to database
      await updateUser(updates);

      // 3. Final navigation
      navigate(View.FEED);
    } catch (error) {
      console.error('Error in onboarding finish:', error);
      alert('Hubo un error al guardar tu perfil. Intenta nuevamente.');
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        setErrors({ ...errors, name: 'El nombre es obligatorio.' });
        return;
      } else {
        setErrors({ ...errors, name: '' });
      }
    }
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      finishOnboarding();
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
    else navigate(View.LOGIN);
  };

  const handleGoalToggle = (goal: string) => {
    if (formData.goals.includes(goal)) {
      setFormData({ ...formData, goals: formData.goals.filter(g => g !== goal) });
    } else {
      setFormData({ ...formData, goals: [...formData.goals, goal] });
    }
  };

  const handleSdgToggle = (id: number) => {
    if (formData.sdgs.includes(id)) {
      setFormData({ ...formData, sdgs: formData.sdgs.filter(i => i !== id) });
    } else if (formData.sdgs.length < 5) {
      setFormData({ ...formData, sdgs: [...formData.sdgs, id] });
    }
  };

  // STEP 1: IDENTITY
  const renderStep1 = () => (
    <div className="max-w-xl mx-auto animate-[fade-in_0.3s_ease-out]">
      <h1 className="text-3xl font-black text-slate-900 mb-2">Crea tu perfil de impacto</h1>
      <p className="text-slate-500 mb-8">Únete como individuo. Si tienes una organización, podrás registrarla más adelante.</p>

      <div className="flex flex-col items-center mb-8">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          className="hidden"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="size-24 bg-slate-50 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-primary hover:text-primary transition-colors text-slate-400 mb-2 group relative overflow-hidden"
        >
          {isUploading ? (
            <div className="flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl animate-spin">sync</span>
            </div>
          ) : formData.avatar ? (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url("${formData.avatar}")` }}
              ></div>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-2xl">edit</span>
              </div>
            </>
          ) : (
            <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">add_a_photo</span>
          )}
        </div>
        <span className="text-xs font-bold text-slate-400 uppercase">
          {formData.avatar ? 'Cambiar Foto' : 'Tu Foto'}
        </span>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-1">Nombre Completo <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              if (e.target.value.trim()) setErrors({ ...errors, name: '' });
            }}
            className={`w-full h-12 rounded-xl border ${errors.name ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-slate-50'} px-4 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-medium`}
            placeholder="Ej. Juan Pérez"
          />
        </div>
        <div>
          <div className="flex justify-between">
            <label className="block text-sm font-bold text-slate-700 mb-1">¿Cómo te defines?</label>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Visible en perfil</span>
          </div>
          <input
            type="text"
            placeholder="Ej. Activista Climático, Estudiante, Emprendedor Social..."
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all font-medium"
          />
          <p className="text-xs text-slate-400 mt-1">Tu rol principal como agente de cambio, no necesariamente tu cargo laboral.</p>
        </div>
      </div>
    </div>
  );

  // STEP 2: PROFILE TYPE
  const renderStep2 = () => (
    <div className="max-w-3xl mx-auto animate-[fade-in_0.3s_ease-out]">
      <h1 className="text-3xl font-black text-slate-900 mb-2">Tu Rol en el Ecosistema</h1>
      <p className="text-slate-500 mb-8">Elige el perfil que mejor describe tu actividad principal actual.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { id: 'creator', label: 'Creador / Emprendedor', icon: 'lightbulb', desc: 'Estoy construyendo soluciones.' },
          { id: 'supporter', label: 'Colaborador / Voluntario', icon: 'volunteer_activism', desc: 'Quiero apoyar causas existentes.' },
          { id: 'investor', label: 'Inversionista / Donante', icon: 'savings', desc: 'Busco financiar impacto.' },
          { id: 'expert', label: 'Experto / Mentor', icon: 'psychology', desc: 'Ofrezco conocimiento y guía.' },
        ].map((type) => (
          <div
            key={type.id}
            onClick={() => setFormData({ ...formData, identity: type.id })}
            className={`p-6 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${formData.identity === type.id
              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
              : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-md'
              }`}
          >
            <div className={`size-12 rounded-full flex items-center justify-center shrink-0 ${formData.identity === type.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
              <span className="material-symbols-outlined">{type.icon}</span>
            </div>
            <div>
              <h3 className={`font-bold text-lg ${formData.identity === type.id ? 'text-primary' : 'text-slate-900'}`}>{type.label}</h3>
              <p className="text-sm text-slate-500 leading-snug">{type.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="max-w-2xl mx-auto animate-[fade-in_0.3s_ease-out]">
      <h1 className="text-3xl font-black text-slate-900 mb-2">Tus Objetivos</h1>
      <div className="flex flex-wrap gap-3 mt-6">
        {['Encontrar Socios', 'Aprender', 'Financiación', 'Voluntariado', 'Inspiración', 'Mentoria'].map(goal => (
          <button key={goal} onClick={() => handleGoalToggle(goal)} className={`px-6 py-3 rounded-full font-bold text-sm transition-all border ${formData.goals.includes(goal) ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:border-primary'}`}>
            {goal}
          </button>
        ))}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="animate-[fade-in_0.3s_ease-out]">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Tus Causas (ODS)</h1>
      <p className="text-slate-500 mb-6">¿Qué problemas quieres ayudar a resolver?</p>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-9 gap-3">
        {SDGS.map((sdg) => {
          const isSelected = formData.sdgs.includes(sdg.id);
          return (
            <div key={sdg.id} onClick={() => handleSdgToggle(sdg.id)} className={`relative aspect-square rounded-xl cursor-pointer flex flex-col items-center justify-center p-2 text-center transition-all ${isSelected ? 'ring-2 ring-slate-900 scale-95 opacity-100' : 'hover:scale-105 opacity-70'}`} style={{ backgroundColor: sdg.color }}>
              {isSelected && <div className="absolute top-1 right-1 bg-white rounded-full size-4 text-black flex items-center justify-center"><span className="material-symbols-outlined text-[10px]">check</span></div>}
              <span className="material-symbols-outlined text-3xl text-white mb-1">{sdg.icon}</span>
              <span className="text-white text-[9px] font-bold hidden sm:block">{sdg.short}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="max-w-md mx-auto text-center animate-[fade-in_0.3s_ease-out]">
      <div className="size-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="material-symbols-outlined text-5xl">celebration</span>
      </div>
      <h1 className="text-4xl font-black text-slate-900 mb-4">¡Bienvenido, Agente de Cambio!</h1>
      <p className="text-slate-500 text-lg mb-8">Tu perfil personal está listo. Comienza a explorar proyectos o crea el tuyo propio.</p>
    </div>
  );

  return (
    <div className="h-screen w-full bg-background-light flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col h-[90vh]">
        <div className="shrink-0 bg-white z-10 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-500">Paso {step} de {totalSteps}</span>
          <span className="text-sm font-bold text-primary">{Math.round((step / totalSteps) * 100)}%</span>
        </div>
        <div className="p-8 md:p-12 overflow-y-auto flex-1 h-full">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </div>
        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
          <button onClick={prevStep} className={`text-slate-500 font-bold hover:text-slate-900 ${step === 1 ? 'invisible' : ''}`}>Atrás</button>
          <button onClick={handleNext} className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary-dark shadow-lg shadow-primary/20">
            {step === totalSteps ? 'Ir al Feed' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
};
