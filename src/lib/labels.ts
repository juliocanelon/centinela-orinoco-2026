// Etiquetas legibles para los códigos internos (severidad, estados, categorías).
const LABELS: Record<string, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  MODERATE: 'Moderada',
  LOW: 'Baja',
  INFO: 'Informativa',
  NORMAL: 'Normal',
  OPTIMAL: 'Normal',
  ELEVATED: 'Elevado',
  ALERT_CRECIDA: 'Crecida',
  SIN_REFERENCIA: 'Sin referencia',
  SUSPICIOUS: 'Sospechosa',
  CONFIRMED_INTERDICTION: 'Interdicción confirmada',
  REJECTED_NATURAL: 'Descartada (natural)',
  ACTIVO: 'Activo',
  EN_VERIFICACION: 'En verificación',
  OPERATIVO_EN_CURSO: 'Operativo en curso',
  RESUELTO: 'Resuelto',
  ARCHIVADO: 'Archivado',
  IDLE: 'En espera',
  RUNNING: 'En ejecución',
  SUCCESS: 'Correcta',
  ERROR: 'Error',
  WARNING: 'Advertencia',
  ACTIVE: 'Activo',
  AVAILABLE: 'Disponible',
  TOKENS_EXHAUSTED: 'Tokens agotados',
  QUOTA_EXHAUSTED: 'Cuota agotada',
  COOLING_DOWN: 'En pausa',
  PENDIENTE_VALIDACION: 'Pendiente de validación',
  CONFIRMADA_EN_TERRENO: 'Confirmada en terreno',
  OPERATIVO_ENVIADO: 'Operativo enviado',
  DESESTIMADA: 'Desestimada',
  MINERIA_ILEGAL: 'Minería ilegal',
  CONTAMINACION_MERCURIO: 'Contaminación por mercurio',
  CONTAMINACION_HIDRICA: 'Contaminación hídrica',
  DERRAME_HIDROCARBUROS: 'Derrame de hidrocarburos',
  PISTA_CLANDESTINA: 'Pista clandestina',
  DEFORESTACION: 'Deforestación',
  CRECIDA_SUBITA: 'Crecida súbita',
  AFECTACION_FAUNA_FLORA: 'Afectación de fauna y flora',
  INVASION_ABRAE: 'Invasión de ABRAE',
  OTRO: 'Otro',
};

export const formatLabel = (code?: string | null): string => {
  if (!code) return '';
  if (LABELS[code]) return LABELS[code];
  // Códigos desconocidos: MI_CODIGO -> "Mi codigo"
  if (/^[A-Z0-9_]+$/.test(code)) {
    const text = code.replace(/_/g, ' ').toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return code;
};
