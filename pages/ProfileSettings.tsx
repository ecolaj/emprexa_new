
import React, { useState, useRef, useEffect } from 'react';
import { View, NavProps, ID, User } from '../types';
import { SDGS } from '../constants';
import { useAuth } from '../context/AuthContext';
import { LogoutModal } from '../components/LogoutModal';
import { SuccessModal } from '../components/SuccessModal';
import { AccountActionModal } from '../components/AccountActionModal';
import { supabase } from '../utils/supabase';
import { compressImage } from '../utils/imageUtils';

export const ProfileSettings: React.FC<NavProps> = ({ navigate }) => {
  const { user, updateUser, logout, deactivateAccount, deleteAccount } = useAuth();

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [activeSdgIds, setActiveSdgIds] = useState<number[]>(user?.sdgInterests || []);
  const [tempAvatar, setTempAvatar] = useState<string | null>(null);
  const [tempCover, setTempCover] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    role: user?.role || '',
    bio: user?.bio || '',
    username: user?.username || '',
    organizationName: user?.organizationName || '',
    location: user?.location || '',
    website: user?.website || '',
    linkedin: user?.linkedin || '',
    phone: user?.phone || ''
  });

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        role: user.role || '',
        bio: user.bio || '',
        username: user.username || '',
        organizationName: user.organizationName || '',
        location: user.location || '',
        website: user.website || '',
        linkedin: user.linkedin || '',
        phone: user.phone || ''
      });
      setActiveSdgIds(user.sdgInterests || []);
    }
  }, [user]);

  if (!user) return null;

  const handleDeactivate = async () => {
    await deactivateAccount();
    setShowAccountModal(false);
    navigate(View.LOGIN);
  };

  const handleDelete = async () => {
    await deleteAccount();
    setShowAccountModal(false);
    navigate(View.LOGIN);
  };

  const toggleSdg = (id: number) => {
    if (activeSdgIds.includes(id)) {
      setActiveSdgIds(activeSdgIds.filter(sdgId => sdgId !== id));
    } else {
      setActiveSdgIds([...activeSdgIds, id]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const previewUrl = URL.createObjectURL(file);
      if (type === 'avatar') {
        setTempAvatar(previewUrl);
        setAvatarFile(file);
      } else {
        setTempCover(previewUrl);
        setCoverFile(file);
      }
    }
  };

  const [loading, setLoading] = useState(false);

  // Deep comparison to detect any changes ("dot or comma")
  const isDirty = (() => {
    if (!user) return false;

    // Check files first
    if (avatarFile || coverFile) return true;

    // Check strict equality on fields
    if (formData.name !== (user.name || '')) return true;
    if (formData.role !== (user.role || '')) return true;
    if (formData.bio !== (user.bio || '')) return true;
    if (formData.username !== (user.username || '')) return true;
    if (formData.organizationName !== (user.organizationName || '')) return true;
    if (formData.location !== (user.location || '')) return true;
    if (formData.website !== (user.website || '')) return true;
    if (formData.linkedin !== (user.linkedin || '')) return true;
    if (formData.phone !== (user.phone || '')) return true;

    // Check text area specifically (sometimes trimming causes issues, but we want strict)

    // Check SDGs array equality
    const currentSdgs = (activeSdgIds || []).sort().join(',');
    const originalSdgs = (user.sdgInterests || []).sort().join(',');
    if (currentSdgs !== originalSdgs) return true;

    return false;
  })();

  const uploadProfileImage = async (file: File, type: 'avatar' | 'cover'): Promise<string> => {
    try {
      // Compress image before upload
      const compressedBlob = await compressImage(file);
      const fileToUpload = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' });

      const fileName = `${user.id}/${Date.now()}.jpg`;
      const bucketName = type === 'avatar' ? 'avatars' : 'covers';

      console.log(`Uploading ${type} to ${bucketName}/${fileName}... (Compressed)`);

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, fileToUpload, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        console.error(`Error uploading ${type}:`, uploadError);
        throw new Error(`Error al subir ${type}: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(fileName);
      return publicUrl;
    } catch (error: any) {
      throw error;
    }
  };

  const handleSave = async () => {
    if (!isDirty && !loading) return;

    setLoading(true);
    try {
      let finalAvatarUrl = user.avatar;
      let finalCoverUrl = user.cover;

      // Handle Image Uploads with Validation
      if (avatarFile) {
        try {
          finalAvatarUrl = await uploadProfileImage(avatarFile, 'avatar');
        } catch (uploadErr) {
          alert('Fallo al subir la foto de perfil. Intenta de nuevo.');
          setLoading(false);
          return;
        }
      }

      if (coverFile) {
        try {
          finalCoverUrl = await uploadProfileImage(coverFile, 'cover');
        } catch (uploadErr) {
          alert('Fallo al subir la imagen de portada. Verifica tu conexión.');
          setLoading(false);
          return;
        }
      }

      // Update User Profile
      await updateUser({
        ...formData,
        sdgInterests: activeSdgIds,
        avatar: finalAvatarUrl,
        cover: finalCoverUrl
      });

      // Clear file states on success
      setAvatarFile(null);
      setCoverFile(null);
      // We keep temp previews until page refresh or we can set them to null and rely on user.avatar updates
      // But user object update might take a split second. 
      // Ideally updateUser updates the context which triggers re-render with new URLs.

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Save error:', error);
      alert('Hubo un error al guardar los cambios. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const confirmLogout = async () => {
    await logout();
    setShowLogoutModal(false);
    navigate(View.LOGIN);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Configuración</h1>
            <p className="text-slate-500">Gestiona tu perfil público y preferencias de cuenta.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate(View.PROFILE)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={loading || !isDirty}
              className={`px-6 py-2 font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 ${loading ? 'bg-slate-400 cursor-wait' :
                isDirty ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20' :
                  'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Guardando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">save</span> Guardar Cambios
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Perfil Público</h3>
              <div className="mb-8">
                <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'cover')} />
                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'avatar')} />
                <div
                  className="h-32 bg-slate-100 rounded-xl w-full mb-[-40px] relative overflow-hidden group cursor-pointer border-2 border-dashed border-slate-300 hover:border-primary transition-colors bg-cover bg-center"
                  style={tempCover || user.cover ? { backgroundImage: `url("${tempCover || user.cover}")` } : {}}
                  onClick={() => coverInputRef.current?.click()}
                >
                  {!tempCover && !user.cover && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400"><span className="text-xs font-bold">Clic para subir Portada</span></div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <span className="bg-white/90 text-slate-700 px-3 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">upload</span> Cambiar Portada
                    </span>
                  </div>
                </div>
                <div className="flex items-end px-4">
                  <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                    <div className="size-24 rounded-2xl bg-slate-200 border-4 border-white shadow-md bg-cover bg-center" style={{ backgroundImage: `url("${tempAvatar || user.avatar}")` }}></div>
                    <div className="absolute inset-0 bg-black/40 rounded-2xl hidden group-hover:flex items-center justify-center transition-all border-4 border-white">
                      <span className="material-symbols-outlined text-white">photo_camera</span>
                    </div>
                  </div>
                  {tempAvatar && <button onClick={() => setTempAvatar(null)} className="ml-4 mb-2 text-red-500 text-sm font-bold hover:underline">Restaurar Original</button>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nombre Completo</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-primary transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Título Profesional</label>
                  <input type="text" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:border-primary transition-all" />
                </div>
              </div>

              <div className="mb-6">
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nombre de usuario</label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-slate-400 font-bold">@</span>
                  <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-10 py-2.5 text-sm font-medium outline-none focus:border-primary transition-all" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Biografía</label>
                <textarea value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none h-32 resize-none focus:border-primary transition-all leading-relaxed"></textarea>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Información Profesional</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Organización / Empresa</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">business</span>
                    <input type="text" value={formData.organizationName} onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-primary transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Sitio Web</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">language</span>
                    <input type="text" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-primary transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Ubicación</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">location_on</span>
                    <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-primary transition-all" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">LinkedIn</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">link</span>
                    <input type="text" value={formData.linkedin} onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-primary transition-all" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-4">Información de Contacto</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Email</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">mail</span>
                    <input type="email" value={user.email || ""} disabled className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-500 cursor-not-allowed" />
                    <span className="absolute right-3 top-3 text-[10px] bg-green-100 text-green-700 font-bold px-1.5 rounded">VERIFIED</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Teléfono</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">phone</span>
                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-primary transition-all" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center space-y-4">
              <button onClick={() => setShowLogoutModal(true)} className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                <span className="material-symbols-outlined">logout</span> Cerrar Sesión
              </button>
              <button onClick={() => setShowAccountModal(true)} className="text-slate-400 text-xs font-bold hover:underline hover:text-slate-600 transition-colors">Desactivar o eliminar cuenta</button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-4">Intereses ODS</h3>
              <div className="grid grid-cols-4 gap-2">
                {SDGS.map((sdg) => {
                  const isActive = activeSdgIds.includes(sdg.id);
                  return (
                    <div
                      key={sdg.id}
                      onClick={() => toggleSdg(sdg.id)}
                      className={`group relative aspect-square rounded-xl border-2 flex items-center justify-center cursor-pointer transition-all ${isActive ? 'border-primary bg-primary/10 text-primary' : 'border-slate-100 text-slate-300 hover:border-slate-300 hover:text-slate-400'}`}
                      style={isActive ? { borderColor: sdg.color, color: sdg.color, backgroundColor: `${sdg.color}10` } : {}}
                    >
                      <span className="material-symbols-outlined">{sdg.icon}</span>

                      <div
                        className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 z-50 whitespace-nowrap px-3 py-1.5 rounded-lg text-[10px] font-bold text-white shadow-xl pointer-events-none"
                        style={{ backgroundColor: sdg.color }}
                      >
                        {sdg.label}
                        <div
                          className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-current"
                          style={{ color: sdg.color }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <LogoutModal isOpen={showLogoutModal} onClose={() => setShowLogoutModal(false)} onConfirm={confirmLogout} />
      <SuccessModal isOpen={showSuccessModal} onClose={() => { setShowSuccessModal(false); navigate(View.PROFILE); }} title="¡Perfil Actualizado!" message="Tus cambios se han guardado correctamente." />
      <AccountActionModal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} onDeactivate={handleDeactivate} onDelete={handleDelete} />
    </div>
  );
};
