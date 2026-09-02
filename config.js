/**
 * CONFIGURACIÓN DE SUPABASE
 * Reemplaza con tus credenciales reales
 */

const SUPABASE_CONFIG = {
  url: 'https://tu-proyecto.supabase.co',
  anonKey: 'tu-anon-key-aqui',
  apiUrl: 'https://tu-proyecto.supabase.co/rest/v1'
};

// URLs de APIs externas
const EXTERNAL_APIS = {
  bankApi: 'https://preview--bankrpmx.lovable.app',
  aiApi: 'https://api.openai.com/v1/chat/completions' // Opcional
};

// Configuración de la aplicación
const APP_CONFIG = {
  appName: 'MexCity RP',
  version: '1.0.0',
  
  // Precios y límites
  prices: {
    homeTypes: {
      'Departamento': 350000,
      'Casa': 650000,
      'Rancho': 1500000,
      'Villa': 2500000
    },
    maxSalary: 1000000,
    loanInterest: 2, // 2% semanal
    servicePrice: 150, // Servicios cada 15 días
    startingBalance: 100000 // $100k RP inicial
  },

  // Ciudades disponibles
  cities: [
    'Ciudad de México',
    'Guadalajara',
    'Monterrey',
    'Tijuana',
    'Puebla',
    'Cancún',
    'Querétaro',
    'León',
    'Chihuahua',
    'Veracruz'
  ],

  // Géneros disponibles
  genders: ['Hombre', 'Mujer', 'No binario', 'Prefiero no especificar'],

  // Tipos de sangre
  bloodTypes: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],

  // Colores de vehículos
  carColors: [
    'Negro', 'Blanco', 'Rojo', 'Azul', 'Gris', 'Plata',
    'Dorado', 'Verde', 'Naranja', 'Marrón', 'Beige', 'Púrpura'
  ],

  // Tipos de transporte
  transportTypes: {
    'A pie': ['Caminar', 'Trotar', 'Correr'],
    'Automóvil': ['Toyota Corolla', 'Honda Civic', 'Volkswagen Jetta', 'Nissan Versa', 'Chevy Spark'],
    'SUV': ['Ford Explorer', 'Toyota Highlander', 'Chevrolet Tahoe', 'Jeep Wrangler'],
    'Motocicleta': ['Harley Davidson', 'Kawasaki Ninja', 'Yamaha YZF', 'Honda CB500'],
    'Camión': ['Ford F-150', 'Chevrolet Silverado', 'Ram 2500', 'Toyota Tundra'],
    'Bicicleta': ['Montaña', 'Carrera', 'Urbana'],
    'Taxi': ['Taxi Blanco', 'Uber', 'Didi']
  },

  // Tipos de empresa
  businessTypes: [
    'Tienda',
    'Restaurante',
    'Bar',
    'Taller Mecánico',
    'Peluquería',
    'Oficina',
    'Hospital',
    'Hotel',
    'Discoteca',
    'Otro'
  ],

  // Días laborales
  workDays: [
    'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'
  ],

  // Períodos de pago
  paymentPeriods: ['Semanal', 'Quincenal', 'Mensual'],

  // Roles en familia
  familyRoles: [
    'Padre', 'Madre', 'Hijo', 'Hermano', 'Abuelo', 'Tío', 'Primo', 'Cónyuge'
  ],

  // Cargos en organización
  orgRoles: [
    'Líder',
    'Co-líder',
    'Gerente',
    'Capo',
    'Soldado',
    'Recluta',
    'Informante',
    'Otro'
  ],

  // Giro de organizaciones
  orgGiros: [
    'Narcotráfico',
    'Crimen Organizado',
    'Banda',
    'Cartel',
    'Pandilla',
    'Sindicato',
    'Grupo de Vigilancia',
    'Otro'
  ]
};

// Funciones helper
function getTransportModels(type) {
  return APP_CONFIG.transportTypes[type] || [];
}

function getHomePrice(type) {
  return APP_CONFIG.prices.homeTypes[type] || 350000;
}

function getCities() {
  return APP_CONFIG.cities;
}

// Export para módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SUPABASE_CONFIG, EXTERNAL_APIS, APP_CONFIG };
}
