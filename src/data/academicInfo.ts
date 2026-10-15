/**
 * Ficha académica del proyecto. Fuente única para el modal "Acerca del proyecto"
 * y la línea al pie de la interfaz.
 */
export const ACADEMIC_INFO = {
  institutionalHeader: [
    'República Bolivariana de Venezuela',
    'Universidad Nacional Experimental de Guayana',
    'Vicerrectorado Académico',
    'Coordinación General de Investigación y Postgrado',
    'Maestría Tecnologías de la Información',
  ],
  universityShortName: 'UNEG',
  program: 'Maestría Tecnologías de la Información',
  campus: 'Puerto Ordaz',
  cohort: 'IX',
  course: 'Seminario I: Arquitectura de Datos Inteligentes',
  term: 'Trimestre III, 2026',
  professor: 'PhD. Livia Carolina Borjas Medina',
  students: [
    'Julio Cesar Canelón Rangel',
    'José Francisco Escalante Rosales',
    'Miguel Damián Mota Garrido',
  ],
  project: {
    name: 'Centinela Orinoco',
    title:
      'Arquitectura de Datos Inteligentes para la Detección Temprana y el Monitoreo de la Minería Ilegal en el Arco Minero del Orinoco',
    objective:
      'Diseñar una arquitectura de datos inteligente que permita detectar de forma temprana y monitorear la minería ilegal en el Arco Minero del Orinoco.',
  },
  logoUrl: '/logo-uneg.png',
} as const;
