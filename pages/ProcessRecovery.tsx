import React, { useEffect } from 'react';
import { View, NavProps } from '../types';
import { supabase } from '../utils/supabase';
import { Logo } from '../components/Logo';

export const ProcessRecovery: React.FC<NavProps> = ({ navigate }) => {
  useEffect(() => {
    const processToken = async () => {
      console.log('🔄 ProcessRecovery: Procesando token...');
      
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const type = urlParams.get('type');
      
      console.log('🔍 Parámetros URL:', { token: token?.substring(0, 20) + '...', type });
      
      if (!token || type !== 'recovery') {
        console.error('❌ Token o tipo inválido');
        navigate(View.LOGIN);
        return;
      }
      
      try {
        console.log('🔐 Verificando token con Supabase...');
        
        // Verificar token con Supabase
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'recovery'
        });
        
        if (error) {
          console.error('❌ Error verificando token:', error);
          navigate(View.LOGIN);
          return;
        }
        
        console.log('✅ Token verificado exitosamente');
        console.log('📍 Redirigiendo a reset-password...');
        
        // Redirigir a reset-password
        navigate(View.RESET_PASSWORD);
        
      } catch (error: any) {
        console.error('❌ Error procesando token:', error);
        navigate(View.LOGIN);
      }
    };
    
    processToken();
  }, [navigate]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <Logo className="h-12 mx-auto mb-6" />
        <div className="flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          <p className="text-slate-600 font-medium">Procesando recuperación de contraseña...</p>
        </div>
        <p className="text-slate-400 text-sm mt-4">Esto puede tomar unos segundos</p>
      </div>
    </div>
  );
};