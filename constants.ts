
import { User, Organization, Post, Project } from './types';

export interface SdgType {
  id: number;
  label: string;
  color: string;
  icon: string;
  short: string;
  description: string;
}

export const SDGS: SdgType[] = [
  { id: 1, label: 'Fin de la Pobreza', short: 'Fin Pobreza', color: '#E5243B', icon: 'savings', description: 'Para lograr este Objetivo de acabar con la pobreza, el crecimiento económico debe ser inclusivo, con el fin de crear empleos sostenibles y de promover la igualdad.' },
  { id: 2, label: 'Hambre Cero', short: 'Hambre Cero', color: '#DDA63A', icon: 'soup_kitchen', description: 'El sector alimentario y el sector agrícola ofrecen soluciones claves para el desarrollo y son vitales para la eliminación del hambre y la pobreza.' },
  { id: 3, label: 'Salud y Bienestar', short: 'Salud', color: '#4C9F38', icon: 'cardiology', description: 'Para lograr los Objetivos de Desarrollo Sostenible, es fundamental garantizar una vida saludable y promover el bienestar universal.' },
  { id: 4, label: 'Educación de Calidad', short: 'Educación', color: '#C5192D', icon: 'school', description: 'La educación es la base para mejorar nuestra vida y el desarrollo sostenible.' },
  { id: 5, label: 'Igualdad de Género', short: 'Igualdad', color: '#FF3A21', icon: 'female', description: 'La igualdad entre los géneros no es solo un derecho humano fundamental, sino la base necesaria para conseguir un mundo pacífico, próspero y sostenible.' },
  { id: 6, label: 'Agua Limpia y Saneamiento', short: 'Agua Limpia', color: '#26BDE2', icon: 'water_drop', description: 'El agua libre de impurezas y accesible para todos es parte esencial del mundo en que queremos vivir.' },
  { id: 7, label: 'Energía Asequible y No Contaminante', short: 'Energía', color: '#FCC30B', icon: 'solar_power', description: 'La energía es central para casi todos los grandes desafíos y oportunidades a los que se enfrenta el mundo en la actualidad.' },
  { id: 8, label: 'Trabajo Decente y Crecimiento', short: 'Trabajo', color: '#A21942', icon: 'trending_up', description: 'Debemos reflexionar sobre este progreso lento y desigual, y revisar nuestras políticas económicas y sociales destinadas a erradicar la pobreza.' },
  { id: 9, label: 'Industria, innovación e infraestructuras', short: 'Industria', color: '#FD6925', icon: 'precision_manufacturing', description: 'Las inversiones en infraestructura son fundamentales para lograr un desarrollo sostenible.' },
  { id: 10, label: 'Reducción de las Desigualdades', short: 'Reducción', color: '#DD1367', icon: 'equalizer', description: 'Reducir la desigualdad en y entre los países.' },
  { id: 11, label: 'Ciudades y Comunidades Sostenibles', short: 'Ciudades', color: '#FD9D24', icon: 'location_city', description: 'Las inversiones en infraestructura son cruciales para lograr el desarrollo sostenible.' },
  { id: 12, label: 'Producción y Consumo Responsables', short: 'Consumo', color: '#BF8B2E', icon: 'recycling', description: 'El objetivo del consumo y la producción sostenibles es hacer más y mejores cosas con menos recursos.' },
  { id: 13, label: 'Acción por el Clima', short: 'Clima', color: '#3F7E44', icon: 'globe', description: 'El cambio climático es un reto global que no respeta las fronteras nacionales.' },
  { id: 14, label: 'Vida Submarina', short: 'Submarina', color: '#0A97D9', icon: 'scuba_diving', description: 'Conservar y utilizar en forma sostenible los océanos, los mares y los recursos marinos para el desarrollo sostenible.' },
  { id: 15, label: 'Vida de Ecosistemas Terrestres', short: 'Terrestre', color: '#56C02B', icon: 'forest', description: 'Gestionar sosteniblemente los bosques, luchar contra la desertificación, detener e invertir la degradación de las tierras y detener la pérdida de biodiversidad.' },
  { id: 16, label: 'Paz, Justicia e Instituciones Sólidas', short: 'Paz y Justicia', color: '#00689D', icon: 'gavel', description: 'Acceso universal a la justicia y la construcción de instituciones responsables y eficaces a todos los niveles.' },
  { id: 17, label: 'Alianzas para lograr los Objetivos', short: 'Alianzas', color: '#19486A', icon: 'handshake', description: 'Revitalizar la Alianza Mundial para el Desarrollo Sostenible.' },
];

// Nueva entidad: ORGANIZACIONES
export const ORGANIZATIONS: Organization[] = [
  {
    id: 1,
    name: 'Fundación Tierra Viva',
    handle: 'tierraviva',
    category: 'Sin Fines de Lucro',
    verified: true,
    logo: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=200&q=80',
    cover: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop',
    description: 'Restaurando ecosistemas degradados y empoderando comunidades locales a través de la educación ambiental.',
    location: 'Bogotá, Colombia',
    website: 'tierraviva.org',
    membersCount: 45,
    stats: { trees: '150k', lives: '12k', carbon: '500t' },
    focusSdgs: [13, 15, 6],
    adminIds: [1] // Maria administra Tierra Viva
  },
  {
    id: 2,
    name: 'GreenTech Solutions',
    handle: 'greentech',
    category: 'Startup',
    verified: true,
    logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=200&q=80',
    cover: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=2070&q=80',
    description: 'Desarrollando tecnología IoT para ciudades inteligentes y monitoreo ambiental.',
    location: 'Ciudad de México, MX',
    website: 'greentech.io',
    membersCount: 12,
    stats: { trees: '0', lives: '50k', carbon: '120t' },
    focusSdgs: [9, 11],
    adminIds: [0] // Juan (usuario logueado) administra GreenTech
  }
];

export const USERS: User[] = [
  {
    id: 0,
    name: 'Juan Pérez',
    role: 'Arquitecto de Soluciones',
    organizationId: 2,
    organizationName: 'GreenTech Solutions',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    location: 'Ciudad de México, MX',
    cover: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop',
    bio: 'Apasionado por la sostenibilidad y el impacto social. Buscando conectar con innovadores en el sector de energías renovables.',
    sdgInterests: [7, 11, 13, 9, 12],
    plan: 'enterprise'
  },
  {
    id: 1,
    name: 'Maria Rodriguez',
    role: 'Activista Alimentaria',
    organizationId: 1,
    organizationName: 'Fundación Tierra Viva',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    location: 'Bogota, Colombia',
    cover: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=800&q=80',
    bio: 'Creyente en que la seguridad alimentaria comienza en casa. Fundadora de Huertos Urbanos.',
    sdgInterests: [2, 11, 15],
    plan: 'pro'
  },
  {
    id: 2,
    name: 'Carlos Mendez',
    role: 'Ingeniero Solar',
    organizationId: null,
    organizationName: 'Freelance',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
    location: 'Mexico City, Mexico',
    cover: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=800&q=80',
    bio: 'Promoviendo la transición energética en Latinoamérica.',
    sdgInterests: [7, 13],
    plan: 'basic'
  },
  {
    id: 3, name: 'Sarah Lin', role: 'Educadora', organizationId: null, organizationName: null, avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80', location: 'Lima, Peru', cover: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80', bio: 'Democratizando el acceso a la educación.', sdgInterests: [4, 10, 5], plan: 'free'
  },
  {
    id: 4, name: 'Ocean Cleanup Team', role: 'Cuenta Oficial', organizationId: null, organizationName: 'Ocean Cleanup', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80', location: 'Global', cover: 'https://images.unsplash.com/photo-1484291470158-b8f8d608850d?auto=format&fit=crop&w=800&q=80', bio: 'Limpiando el plástico.', sdgInterests: [14, 13, 6], plan: 'enterprise'
  },
  {
    id: 5, name: 'Amara Okaru', role: 'Defensora DDHH', organizationId: null, organizationName: null, avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=150&q=80', location: 'São Paulo, Brazil', cover: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80', bio: 'Igualdad de género.', sdgInterests: [5, 10, 16], plan: 'pro'
  },
  {
    id: 6, name: 'Dr. James Wilson', role: 'Médico Rural', organizationId: null, organizationName: 'Cruz Roja', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80', location: 'Quito, Ecuador', cover: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80', bio: 'Salud pública.', sdgInterests: [3, 1, 6], plan: 'basic'
  },
  {
    id: 7, name: 'Sofia Green', role: 'Arquitecta', organizationId: 2, organizationName: 'GreenTech Solutions', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', location: 'Medellin, Colombia', cover: 'https://images.unsplash.com/photo-1518005020951-ecc8e5613b5d?auto=format&fit=crop&w=800&q=80', bio: 'Materiales sostenibles.', sdgInterests: [11, 9, 12], plan: 'enterprise'
  },
];

export const PROJECTS: Project[] = [
  {
    id: 101,
    ownerId: 0,
    orgId: 2,
    title: 'Corredores Verdes CDMX',
    description: 'Iniciativa para conectar los principales parques de la Ciudad de México mediante corredores biológicos que reduzcan la temperatura urbana y mejoren la calidad del aire.',
    sdgId: 11,
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
    progress: 35,
    status: 'Activo',
    lookingFor: ['Voluntarios', 'Alianzas Gubernamentales'],
    team: [USERS[0], USERS[7]],
    donationsEnabled: true
  },
  {
    id: 102,
    ownerId: 0,
    orgId: 2,
    title: 'Sensores de Calidad de Aire Low-Cost',
    description: 'Desarrollo de una red de sensores IoT de bajo costo para monitorear la calidad del aire en escuelas públicas en tiempo real.',
    sdgId: 3,
    image: 'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?auto=format&fit=crop&w=800&q=80',
    progress: 78,
    status: 'Fase de Prueba',
    lookingFor: ['Inversión Semilla', 'Desarrolladores'],
    team: [USERS[0]],
    donationsEnabled: false
  },
  {
    id: 103,
    ownerId: 1,
    orgId: 1,
    title: 'Huertos Urbanos Verticales',
    description: 'Sistema modular de agricultura vertical para espacios reducidos en apartamentos de Bogotá.',
    sdgId: 2,
    image: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=800&q=80',
    progress: 15,
    status: 'Planeación',
    lookingFor: ['Materiales', 'Arquitectos'],
    team: [USERS[1]],
    donationsEnabled: false
  }
];

export const POSTS: Post[] = [
  {
    id: 101,
    user: USERS[0],
    time: '25 min',
    location: 'Ciudad de México, MX',
    sdgIds: [11],
    title: 'Avance en la Ley de Corredores Verdes',
    content: 'Hoy tuvimos una reunión clave con la secretaría de medio ambiente. La propuesta para interconectar los parques urbanos ha pasado a la siguiente fase de revisión. ¡Gracias a todos por firmar la petición! Esto reducirá la temperatura de la ciudad en 2°C para 2030. #CiudadSostenible #AccionClimatica',
    images: ['https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80'],
    likes: 245,
    isLiked: true,
    comments: 42,
    recentComments: [
      { id: 'c1', userId: 7, text: '¡Increíble noticia Juan! Cuenta con nuestro estudio para los renders.', time: '10 min' },
      { id: 'c2', userId: 2, text: 'Un gran paso. ¿Necesitan datos de radiación solar para las zonas?', time: '5 min' }
    ]
  },
  {
    id: 102,
    user: USERS[4],
    time: '1h',
    location: 'Océano Pacífico',
    sdgIds: [14],
    title: 'System 03: Despliegue Exitoso',
    content: 'Nuestro nuevo sistema de recolección ha sido desplegado exitosamente en el Gran Parche de Basura del Pacífico. Estimamos recolectar 50 toneladas de plástico por semana. Miren la diferencia entre la zona limpia y la zona contaminada. 🌊♻️ #OceanCleanup #VidaSubmarina',
    images: ['https://images.unsplash.com/photo-1484291470158-b8f8d608850d?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1621451537084-482c73073a0f?auto=format&fit=crop&w=800&q=80'],
    likes: 8902,
    isLiked: false,
    comments: 315,
    recentComments: []
  },
  {
    id: 103,
    user: USERS[1],
    time: '2h',
    location: 'Bogotá, Colombia',
    sdgIds: [2],
    title: 'Primera cosecha del Huerto Comunitario San Felipe',
    content: 'Lo que antes era un lote baldío lleno de escombros, hoy nos dio nuestra primera caja de tomates y lechugas orgánicas. Este alimento irá directo al comedor comunitario del barrio. La seguridad alimentaria empieza en casa. 🍅🥬 #HambreCero #HuertosUrbanos',
    images: ['https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=800&q=80'],
    likes: 189,
    isLiked: false,
    comments: 24,
    recentComments: [
      { id: 'c3', userId: 6, text: 'Nutrición de calidad para quien más lo necesita. ¡Bravo!', time: '1h' }
    ]
  },
  {
    id: 104,
    user: USERS[2],
    time: '3h',
    location: 'Oaxaca, México',
    sdgIds: [7],
    title: 'Energía para la Escuela "El Porvenir"',
    content: 'Terminamos la instalación de 12 paneles solares. Por primera vez, esta escuela rural tendrá electricidad constante para sus computadoras e iluminación. La educación no debe detenerse cuando se pone el sol. ☀️⚡ #EnergiaLimpia #SDG7',
    images: ['https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=800&q=80'],
    likes: 456,
    isLiked: true,
    comments: 56,
    recentComments: []
  },
  {
    id: 105,
    user: USERS[3],
    time: '5h',
    location: 'Lima, Perú',
    sdgIds: [4],
    title: 'Becas de Programación para Mujeres',
    content: 'Abrimos la convocatoria para nuestro bootcamp intensivo de desarrollo web. 50 becas completas disponibles para mujeres de comunidades vulnerables. ¡Ayúdanos a difundir! La tecnología es la herramienta más poderosa para cerrar brechas. 💻👩‍💻 #MujeresEnTech #EducacionDeCalidad',
    images: [],
    likes: 320,
    isLiked: false,
    comments: 89,
    recentComments: []
  },
  {
    id: 106,
    user: USERS[7],
    time: '1d',
    location: 'Medellín, Colombia',
    sdgIds: [12],
    title: '¿Ladrillos de plástico reciclado?',
    content: 'Estamos prototipando muros de carga utilizando 100% plástico reciclado post-consumo. Son más ligeros, aislantes térmicos y retiran 2kg de basura por ladrillo. Buscamos aliados en el sector construcción para pruebas piloto. 🧱♻️ #EconomiaCircular #Innovacion',
    images: ['https://images.unsplash.com/photo-1518005020951-ecc8e5613b5d?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80'],
    likes: 670,
    isLiked: true,
    comments: 95,
    recentComments: []
  },
  {
    id: 107,
    user: USERS[5],
    time: '1d',
    location: 'São Paulo, Brasil',
    sdgIds: [5],
    title: 'Marcha por la Igualdad Salarial',
    content: 'Ayer las calles se llenaron de voces exigiendo lo justo: a igual trabajo, igual salario. No podemos hablar de desarrollo sostenible si dejamos atrás a la mitad de la población. #IgualdadDeGenero #NiUnaMenos',
    images: ['https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80'],
    likes: 1200,
    isLiked: false,
    comments: 45,
    recentComments: []
  },
  {
    id: 108,
    user: USERS[6],
    time: '2d',
    location: 'Esmeraldas, Ecuador',
    sdgIds: [6],
    title: 'Agua Potable para 500 Familias',
    content: 'Inauguramos el sistema de filtración comunitaria. Se acabaron las enfermedades gastrointestinales por agua contaminada en este sector. Gracias a @GreenTech por la donación de los sensores de calidad. 💧🥤 #AguaLimpia #SaludPublica',
    images: ['https://images.unsplash.com/photo-1538300342682-cf57afb97285?auto=format&fit=crop&w=800&q=80'],
    likes: 540,
    isLiked: true,
    comments: 34,
    recentComments: []
  },
  {
    id: 109,
    user: USERS[0],
    time: '3d',
    location: 'Global',
    sdgIds: [17],
    title: 'Buscando Alianzas Estratégicas',
    content: 'Para escalar nuestro impacto en LATAM, necesitamos conectar con ONGs locales que ya tengan trabajo de campo. Nosotros ponemos la tecnología, ustedes el conocimiento del territorio. ¿Quién se suma? 🤝🌎 #Alianzas #TechForGood',
    images: [],
    likes: 150,
    isLiked: false,
    comments: 28,
    recentComments: []
  },
  {
    id: 110,
    user: USERS[1],
    time: '4d',
    location: 'Bogotá, Colombia',
    sdgIds: [15],
    title: 'Jornada de Reforestación: Resultados',
    content: 'Plantamos 300 árboles nativos en el cerro oriental. En 5 años, esto será un bosque que capturará toneladas de CO2 y dará hogar a cientos de aves. Gracias a los 50 voluntarios que madrugaron el domingo. 🌳🐦 #VidaTerrestre #Voluntariado',
    images: ['https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80'],
    likes: 410,
    isLiked: true,
    comments: 38,
    recentComments: []
  }
];

export const NOTIFICATIONS = [
  {
    id: 1,
    type: 'like',
    user: USERS[1],
    content: 'le gustó tu publicación: "Nueva propuesta para corredores verdes"',
    time: '2m ago',
    read: false,
    linkId: 0
  },
];
