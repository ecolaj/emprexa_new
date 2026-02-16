import { User, Project, Post } from '../types';

/**
 * Estos objetos sirven como 'fallbacks' seguros. 
 * Tienen la misma estructura que los datos reales pero con información neutra.
 */

export const DEFAULT_USER: User = {
  id: 'anonymous',
  name: 'Usuario',
  role: 'Miembro de la comunidad',
  avatar: 'https://cdn-icons-png.flaticon.com/512/847/847969.png',
  plan: 'free',
  status: 'active',
  sdgInterests: []
};

export const DEFAULT_PROJECT: Project = {
  id: 'empty-project',
  title: 'Proyecto no disponible',
  description: 'La información de este proyecto no se pudo cargar en este momento.',
  image: 'https://images.unsplash.com/photo-1516383740770-fbcc5c2477ff?auto=format&fit=crop&w=800&q=80',
  progress: 0,
  status: 'Inactivo',
  sdgId: 1,
  ownerId: 'none',
  orgId: 0,
  lookingFor: [],
  team: [],
  donationsEnabled: false
};

export const DEFAULT_POST: Post = {
  id: 'empty-post',
  userId: 'none',
  title: 'Publicación no disponible',
  content: 'El contenido no está disponible.',
  images: [],
  sdgIds: [],
  likes: 0,
  comments: 0
};
