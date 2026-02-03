import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, ID, Notification } from '../types';
import { USERS } from '../constants';
import { supabase } from '../utils/supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  savedPostIds: number[];
  followedUserIds: ID[];
  followedSdgIds: number[];
  followedProjectIds: number[];
  unreadConversations: Record<ID, number>;
  totalUnreadMessages: number;
  notifications: Notification[];
  totalUnreadNotifications: number;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  toggleSavedPost: (postId: number) => Promise<void>;
  toggleFollowUser: (userId: ID) => Promise<void>;
  toggleFollowSdg: (sdgId: number) => void;
  toggleFollowProject: (projectId: number) => void;
  markAsRead: (userId: ID) => Promise<void>;
  markNotificationAsRead: (notificationId: ID) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  sendMentionNotifications: (text: string) => Promise<void>;
  deactivateAccount: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  checkEmailConfirmed: () => Promise<boolean>;
  activateTrial: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedPostIds, setSavedPostIds] = useState<number[]>([]);
  const [followedUserIds, setFollowedUserIds] = useState<ID[]>([]);
  const [followedSdgIds, setFollowedSdgIds] = useState<number[]>([]);
  const [followedProjectIds, setFollowedProjectIds] = useState<number[]>([]);
  const [unreadConversations, setUnreadConversations] = useState<Record<ID, number>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Refs para control preciso
  const mountedRef = useRef(true);
  const pollingIntervalsRef = useRef<{ messages: NodeJS.Timeout | null; notifications: NodeJS.Timeout | null }>({
    messages: null,
    notifications: null
  });
  const isAppVisibleRef = useRef(true);

  // Derived: Total unread
  const totalUnreadMessages = Object.values(unreadConversations).reduce((a, b) => (a as number) + (b as number), 0) as number;
  const totalUnreadNotifications = notifications.filter(n => !n.read).length;

  // ==================== FUNCIONES PRINCIPALES ====================

  // Función para cargar TODOS los datos del usuario
  const loadUserData = async (userId: ID) => {
    if (!mountedRef.current) return;

    try {
      console.log('🔍 Cargando datos para usuario:', userId);

      // Cargar todo en paralelo para mejor performance
      const [saved, following, notificationsResult, unreadData] = await Promise.all([
        supabase.from('saved_posts').select('post_id').eq('user_id', userId),
        supabase.from('follows').select('following_id').eq('follower_id', userId),
        supabase.from('notifications')
          .select('*, notifier:profiles!notifications_notifier_id_fkey(*)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50), // Limitar para performance
        supabase
          .from('messages')
          .select('sender_id')
          .eq('receiver_id', userId)
          .eq('read', false)
      ]);

      if (!mountedRef.current) return;

      // Procesar resultados
      if (saved.data) {
        setSavedPostIds(saved.data.map(p => p.post_id));
      }

      if (following.data) {
        setFollowedUserIds(following.data.map(f => f.following_id));
      }

      if (notificationsResult.data) {
        setNotifications(notificationsResult.data.map(n => ({
          ...n,
          user: n.notifier,
          time: n.created_at ? formatTimeAgo(new Date(n.created_at)) : 'Reciente',
          linkId: n.link_id
        })));
      }

      if (unreadData.data && mountedRef.current) {
        const counts: Record<ID, number> = {};
        unreadData.data.forEach(m => {
          counts[m.sender_id] = (counts[m.sender_id] || 0) + 1;
        });
        setUnreadConversations(counts);
      }

      console.log('✅ Datos cargados exitosamente');
    } catch (error) {
      console.error('❌ Error cargando datos del usuario:', error);
    }
  };

  // Función auxiliar para formatear tiempo
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays < 7) return `Hace ${diffDays} d`;
    return date.toLocaleDateString();
  };

  // Función para refrescar datos manualmente
  const refreshUserData = async () => {
    if (!user?.id) return;
    await loadUserData(user.id);
  };

  // Función para verificar si el email está confirmado
  const checkEmailConfirmed = async (): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.email_confirmed_at !== null;
    } catch (error) {
      console.error('Error verificando email confirmado:', error);
      return false;
    }
  };

  const checkTrialExpiration = async (currentUser: User) => {
    if (!currentUser.trialEndsAt && !currentUser.trialPostsRemaining) return;

    const now = new Date();
    const trialEnd = currentUser.trialEndsAt ? new Date(currentUser.trialEndsAt) : null;
    let shouldDowngrade = false;

    // Check time expiration
    if (trialEnd && now > trialEnd) {
      shouldDowngrade = true;
    }

    // Check posts expiration (if it reached 0 or less AND was a post-based trial)
    if (currentUser.trialPostsRemaining !== null && currentUser.trialPostsRemaining !== undefined && currentUser.trialPostsRemaining <= 0) {
      shouldDowngrade = true;
    }

    if (shouldDowngrade) {
      // Update DB to turn off trial flag FIRST
      await supabase.from('profiles').update({
        is_trial_active: false,
        trial_posts_remaining: 0
      }).eq('id', currentUser.id);

      // THEN update local user state to free
      await updateUser({ plan: 'free', status: 'active', organizationName: undefined });

      console.log('Trial expired. Downgraded to free.');
    }
  };

  const activateTrial = async () => {
    if (!user) return;

    // 30 days trial or 5 posts
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30); // 30 days from now

    try {
      const { error } = await supabase.from('profiles').update({
        plan: 'pro', // Give them PRO status
        is_trial_active: true,
        trial_posts_remaining: 5,
        trial_ends_at: endDate.toISOString(),
        has_used_trial: true
      }).eq('id', user.id);

      if (error) throw error;

      // Update local state
      await refreshUserData();

      // Force local update immediately for snappy UI
      setUser(prev => prev ? ({
        ...prev,
        plan: 'pro',
        isTrialActive: true,
        trialPostsRemaining: 5,
        trialEndsAt: endDate.toISOString(),
        hasUsedTrial: true
      }) : null);

    } catch (e) {
      console.error("Error activating trial:", e);
    }
  };

  // ==================== POLLING INTELIGENTE ====================

  // Iniciar polling solo cuando la app está visible
  const startPolling = (userId: ID) => {
    if (!mountedRef.current) return;

    // Limpiar intervals anteriores
    stopPolling();

    console.log('🔄 Iniciando polling para usuario:', userId);

    // Polling para mensajes: cada 30 segundos
    pollingIntervalsRef.current.messages = setInterval(async () => {
      if (!mountedRef.current || !user?.id || !isAppVisibleRef.current) return;

      try {
        const { data: unreadData } = await supabase
          .from('messages')
          .select('sender_id')
          .eq('receiver_id', userId)
          .eq('read', false);

        if (unreadData && mountedRef.current) {
          const counts: Record<ID, number> = {};
          unreadData.forEach(m => {
            counts[m.sender_id] = (counts[m.sender_id] || 0) + 1;
          });
          setUnreadConversations(counts);
        }
      } catch (error) {
        console.error('Error en polling de mensajes:', error);
      }
    }, 30000); // 30 segundos

    // Polling para notificaciones: cada 60 segundos
    pollingIntervalsRef.current.notifications = setInterval(async () => {
      if (!mountedRef.current || !user?.id || !isAppVisibleRef.current) return;

      try {
        const { data: notificationsResult } = await supabase
          .from('notifications')
          .select('*, notifier:profiles!notifications_notifier_id_fkey(*)')
          .eq('user_id', userId)
          .eq('read', false)
          .order('created_at', { ascending: false })
          .limit(20);

        if (notificationsResult && mountedRef.current) {
          // Actualizar solo si hay cambios
          setNotifications(prev => {
            const newNotifications = notificationsResult.map(n => ({
              ...n,
              user: n.notifier,
              time: n.created_at ? formatTimeAgo(new Date(n.created_at)) : 'Reciente',
              linkId: n.link_id
            }));

            // Solo actualizar si hay notificaciones nuevas
            if (JSON.stringify(prev) !== JSON.stringify(newNotifications)) {
              return newNotifications;
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('Error en polling de notificaciones:', error);
      }
    }, 60000); // 60 segundos
  };

  // Detener polling
  const stopPolling = () => {
    if (pollingIntervalsRef.current.messages) {
      clearInterval(pollingIntervalsRef.current.messages);
      pollingIntervalsRef.current.messages = null;
    }
    if (pollingIntervalsRef.current.notifications) {
      clearInterval(pollingIntervalsRef.current.notifications);
      pollingIntervalsRef.current.notifications = null;
    }
  };

  // ==================== EFECTOS PRINCIPALES ====================

  // 1. Inicializar sesión UNA SOLA VEZ al montar
  useEffect(() => {
    mountedRef.current = true;
    isAppVisibleRef.current = !document.hidden;

    // A. ESCUCHAR EVENTOS (Hacerlo de primero)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔔 Evento de Auth detectado:', event);
      if (event === 'PASSWORD_RECOVERY') {
        console.log('🔑 Modo recuperación de contraseña detectado por evento!');
        window.location.hash = 'reset-password';
      }
    });

    // B. DETECTAR URL MANUAL (Por si Supabase limpia el hash antes de disparar el evento)
    const rawHash = window.location.hash;
    const rawSearch = window.location.search;
    if (rawHash.includes('type=recovery') || rawSearch.includes('type=recovery')) {
      console.log('🕵️‍♂️ Detección manual de recuperación detectada en URL');
      window.location.hash = 'reset-password';
    }

    const initializeAuth = async () => {
      try {
        // PRIMERO: Intentar obtener la sesión actual
        const { data: { session }, error } = await supabase.auth.getSession();

        console.log('🔄 Inicializando auth, sesión encontrada:', !!session);

        if (error) {
          console.error('❌ Error obteniendo sesión:', error);
          if (mountedRef.current) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        if (session?.user && mountedRef.current) {
          console.log('✅ Sesión válida encontrada:', session.user.email);

          // Si acabamos de detectar recovery, asegurar que no nos movamos de ahí
          if (window.location.hash === '#reset-password') {
            console.log('🛑 Saltando carga normal para dar prioridad a RESET_PASSWORD');
          }

          // Cargar perfil del usuario
          const { data: profile } = await supabase
            .from('profiles')
            .select('*, organization:organizations(*)')
            .eq('id', session.user.id)
            .single();

          if (profile && mountedRef.current) {
            // REACTIVACIÓN: Si el usuario estaba 'deleted', se vuelve 'active' al entrar
            if (profile.status === 'deleted') {
              console.log('🔄 Reactivando cuenta de ex-miembro en inicialización...');
              await supabase.from('profiles').update({ status: 'active' }).eq('id', profile.id);
              profile.status = 'active'; // Actualizar copia local para el estado inicial
            }
            const formattedUser: User = {
              id: profile.id,
              name: profile.name,
              role: profile.role,
              avatar: profile.avatar,
              email: session.user.email,
              cover: profile.cover,
              bio: profile.bio,
              location: profile.location,
              organizationId: profile.organization_id,
              organizationName: profile.organization_name || profile.organization?.name,
              sdgInterests: profile.sdg_interests,
              plan: profile.plan as any,
              paypalSubscriptionId: profile.paypal_subscription_id,
              planUpdatedAt: profile.plan_updated_at,
              status: profile.status as any,
              username: profile.username,
              website: profile.website,
              phone: profile.phone,
              lastSignInAt: session.user.last_sign_in_at,
              joinedAt: profile.created_at,
              isTrialActive: profile.is_trial_active,
              trialPostsRemaining: profile.trial_posts_remaining,
              trialEndsAt: profile.trial_ends_at,
              hasUsedTrial: profile.has_used_trial
            };
            setUser(formattedUser);
          } else if (mountedRef.current) {
            // Perfil mínimo
            setUser({
              id: session.user.id,
              name: session.user.email?.split('@')[0] || 'Usuario',
              role: 'Miembro',
              avatar: 'https://cdn-icons-png.flaticon.com/512/847/847969.png',
              email: session.user.email,
              plan: 'free',
              status: 'active',
              lastSignInAt: session.user.last_sign_in_at
            });
          }
        } else if (mountedRef.current) {
          console.log('🔓 No hay sesión activa');
          setUser(null);
        }
      } catch (err) {
        console.error('❌ Error inicializando auth:', err);
        if (mountedRef.current) {
          setUser(null);
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Manejar visibilidad de la app
    const handleVisibilityChange = () => {
      isAppVisibleRef.current = !document.hidden;
      console.log('👁️ App visible:', isAppVisibleRef.current);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Limpieza
    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPolling();
    };
  }, []);

  // 2. Iniciar/Detener polling basado en usuario
  useEffect(() => {
    if (!user?.id) {
      stopPolling();
      return;
    }

    // Cargar datos iniciales
    // Cargar datos iniciales
    loadUserData(user.id);

    // Verificar estado del trial
    if (user.isTrialActive) {
      checkTrialExpiration(user);
    }

    // Iniciar polling
    startPolling(user.id);

    return () => {
      stopPolling();
    };
  }, [user?.id]);

  // ==================== FUNCIONES DE AUTENTICACIÓN ====================

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setIsLoading(false);
        throw error;
      }

      // Obtener sesión después del login
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, organization:organizations(*)')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          // REACTIVACIÓN: Si el usuario estaba 'deleted', se vuelve 'active' al loguearse
          if (profile.status === 'deleted') {
            console.log('🔄 Reactivando cuenta de ex-miembro durante login...');
            await supabase.from('profiles').update({ status: 'active' }).eq('id', profile.id);
            profile.status = 'active'; // Actualizar copia local
          }
          const formattedUser: User = {
            id: profile.id,
            name: profile.name,
            role: profile.role,
            avatar: profile.avatar,
            email: session.user.email,
            cover: profile.cover,
            bio: profile.bio,
            location: profile.location,
            organizationId: profile.organization_id,
            organizationName: profile.organization_name || profile.organization?.name,
            sdgInterests: profile.sdg_interests,
            plan: profile.plan as any,
            paypalSubscriptionId: profile.paypal_subscription_id,
            planUpdatedAt: profile.plan_updated_at,
            status: profile.status as any,
            username: profile.username,
            website: profile.website,
            linkedin: profile.linkedin,
            phone: profile.phone,
            lastSignInAt: session.user.last_sign_in_at,
            joinedAt: profile.created_at,
            isTrialActive: profile.is_trial_active,
            trialPostsRemaining: profile.trial_posts_remaining,
            trialEndsAt: profile.trial_ends_at,
            hasUsedTrial: profile.has_used_trial
          };
          setUser(formattedUser);
        }
      }
    } catch (error) {
      setIsLoading(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      // Limpiar localStorage completamente
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('sb-tkxfnjhzihbmjiiofhgo-auth-token');
    } catch (err) {
      console.error('Error en logout:', err);
    } finally {
      if (mountedRef.current) {
        setUser(null);
        setSavedPostIds([]);
        setFollowedUserIds([]);
        setFollowedSdgIds([]);
        setFollowedProjectIds([]);
        setUnreadConversations({});
        setNotifications([]);
        setIsLoading(false);
      }
    }
  };

  // ==================== FUNCIONES DE USUARIO ====================

  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;

    try {
      // Preparar datos para Supabase
      const supabaseUpdates: any = {};

      if (updates.name !== undefined) supabaseUpdates.name = updates.name;
      if (updates.role !== undefined) supabaseUpdates.role = updates.role;
      if (updates.bio !== undefined) supabaseUpdates.bio = updates.bio;
      if (updates.location !== undefined) supabaseUpdates.location = updates.location;
      if (updates.avatar !== undefined) supabaseUpdates.avatar = updates.avatar;
      if (updates.cover !== undefined) supabaseUpdates.cover = updates.cover;
      if (updates.website !== undefined) supabaseUpdates.website = updates.website;
      if (updates.linkedin !== undefined) supabaseUpdates.linkedin = updates.linkedin;
      if (updates.phone !== undefined) supabaseUpdates.phone = updates.phone;
      if (updates.sdgInterests !== undefined) supabaseUpdates.sdg_interests = updates.sdgInterests;
      if (updates.username !== undefined) supabaseUpdates.username = updates.username;
      if (updates.organizationName !== undefined) supabaseUpdates.organization_name = updates.organizationName;
      if (updates.plan !== undefined) supabaseUpdates.plan = updates.plan;
      if (updates.status !== undefined) supabaseUpdates.status = updates.status;
      if (updates.paypalSubscriptionId !== undefined) supabaseUpdates.paypal_subscription_id = updates.paypalSubscriptionId;
      if (updates.planUpdatedAt !== undefined) supabaseUpdates.plan_updated_at = updates.planUpdatedAt;

      // Actualizar en Supabase
      const { data, error } = await supabase
        .from('profiles')
        .update(supabaseUpdates)
        .eq('id', user.id)
        .select('*, organization:organizations(name)')
        .single();

      if (error) {
        console.error('Error updating user in Supabase:', error);
        throw error;
      }

      if (data && mountedRef.current) {
        const formattedUpdatedUser: User = {
          ...user,
          ...updates,
          id: data.id,
          name: data.name,
          role: data.role,
          avatar: data.avatar,
          cover: data.cover,
          bio: data.bio,
          location: data.location,
          organizationId: data.organization_id,
          organizationName: data.organization_name || data.organization?.name,
          sdgInterests: data.sdg_interests,
          plan: data.plan,
          status: data.status,
          username: data.username,
          website: data.website,
          linkedin: data.linkedin,
          phone: data.phone,
          isTrialActive: data.is_trial_active,
          trialPostsRemaining: data.trial_posts_remaining,
          trialEndsAt: data.trial_ends_at,
          hasUsedTrial: data.has_used_trial
        };
        setUser(formattedUpdatedUser);

        // Sync with mock array if exists
        const userIndex = USERS.findIndex(u => u.id === user.id);
        if (userIndex !== -1) {
          USERS[userIndex] = { ...USERS[userIndex], ...formattedUpdatedUser };
        }
      }

    } catch (error) {
      console.error('Error in updateUser:', error);
      throw error;
    }
  };

  const toggleSavedPost = async (postId: number) => {
    if (!user) {
      console.warn('toggleSavedPost: No user logged in');
      return;
    }

    const isSaved = savedPostIds.includes(postId);

    try {
      if (isSaved) {
        // Remove from saved
        const { error } = await supabase
          .from('saved_posts')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', postId);

        if (error) {
          console.error('Error removing saved post:', error);
          return;
        }

        setSavedPostIds(prev => prev.filter(id => id !== postId));
      } else {
        // Add to saved
        const { error } = await supabase
          .from('saved_posts')
          .insert({ user_id: user.id, post_id: postId });

        if (error) {
          console.error('Error saving post:', error);
          return;
        }

        setSavedPostIds(prev => [...prev, postId]);
      }
    } catch (error) {
      console.error('Exception in toggleSavedPost:', error);
    }
  };

  const toggleFollowUser = async (targetId: ID) => {
    if (!user) return;
    const isFollowing = followedUserIds.includes(targetId);

    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
      setFollowedUserIds(prev => prev.filter(id => id !== targetId));
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
      setFollowedUserIds(prev => [...prev, targetId]);
    }
  };

  const toggleFollowSdg = (sdgId: number) => {
    setFollowedSdgIds(prev => prev.includes(sdgId) ? prev.filter(id => id !== sdgId) : [...prev, sdgId]);
  };

  const toggleFollowProject = (projectId: number) => {
    setFollowedProjectIds(prev => prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]);
  };

  const markAsRead = async (userId: ID) => {
    if (!user) return;

    // Update Supabase
    const { error } = await supabase
      .from('messages')
      .update({ read: true })
      .eq('receiver_id', user.id)
      .eq('sender_id', userId)
      .eq('read', false);

    if (!error) {
      setUnreadConversations(prev => {
        if (!prev[userId]) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }
  };

  const markNotificationAsRead = async (notificationId: ID) => {
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
    await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
  };

  const markAllNotificationsAsRead = async () => {
    if (!user) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
  };

  const sendMentionNotifications = async (text: string) => {
    if (!user) return;

    const mentionRegex = /@(\w+)/g;
    let match;
    const mentionedHandles = new Set<string>();

    while ((match = mentionRegex.exec(text)) !== null) {
      mentionedHandles.add(match[1].toLowerCase());
    }

    if (mentionedHandles.size === 0) return;

    const { data: foundUsers } = await supabase
      .from('profiles')
      .select('id, username')
      .in('username', Array.from(mentionedHandles));

    if (foundUsers && foundUsers.length > 0) {
      const newNotifications = foundUsers
        .filter(u => u.id !== user.id)
        .map(u => ({
          user_id: u.id,
          notifier_id: user.id,
          type: 'mention',
          content: 'te mencionó en una publicación',
          read: false,
          created_at: new Date().toISOString()
        }));

      if (newNotifications.length > 0) {
        await supabase.from('notifications').insert(newNotifications);
      }
    }
  };

  const deactivateAccount = async () => {
    setIsLoading(true);
    try {
      if (user) {
        // 1. Actualizar estado en la base de datos
        await updateUser({ status: 'deactivated' });

        // 2. Cerrar sesión oficial en Supabase
        await supabase.auth.signOut();
      }
      if (mountedRef.current) {
        setUser(null);
      }
    } catch (err) {
      console.error('AuthContext: Error deactivating account:', err);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const deleteAccount = async () => {
    setIsLoading(true);
    try {
      if (user) {
        // 1. ANONIMIZACIÓN (Borrado Lógico)
        // Sobrescribimos datos privados con información genérica
        const { error: anonError } = await supabase
          .from('profiles')
          .update({
            name: 'Ex-miembro de Emprexa',
            avatar: 'https://cdn-icons-png.flaticon.com/512/847/847969.png',
            bio: '',
            role: 'Antiguo Agente de Cambio',
            website: '',
            linkedin: '',
            phone: '',
            status: 'deleted', // Bandera para saber que fue "borrado"
            username: `user_${Math.floor(Math.random() * 1000000)}` // Liberar su username original
          })
          .eq('id', user.id);

        if (anonError) throw anonError;

        // 2. CERRAR SESIÓN
        // Esto es lo que evita que al refrescar siga logueado
        await supabase.auth.signOut();
      }

      if (mountedRef.current) {
        setUser(null);
      }
    } catch (err) {
      console.error('AuthContext: Error anonymizing account:', err);
      alert('Hubo un error al procesar la solicitud.');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // ==================== PROVIDER ====================

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      savedPostIds,
      followedUserIds,
      followedSdgIds,
      followedProjectIds,
      unreadConversations,
      totalUnreadMessages,
      notifications,
      totalUnreadNotifications,
      login,
      logout,
      updateUser,
      toggleSavedPost,
      toggleFollowUser,
      toggleFollowSdg,
      toggleFollowProject,
      markAsRead,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      sendMentionNotifications,
      deactivateAccount,
      deleteAccount,
      refreshUserData,
      checkEmailConfirmed,
      activateTrial
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};