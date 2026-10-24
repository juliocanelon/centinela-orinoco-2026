import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Búsqueda sobre environmental_rag_documents por coincidencia de texto y distancia.
 * La tabla no tiene embeddings, así que no hay similitud coseno: el puntaje es la
 * fracción de términos de la consulta presentes en el documento.
 */

export interface RagDocument {
  id: string;
  doc_type: string;
  source_reference_id: string | null;
  title: string;
  location_name: string | null;
  sub_basin: string | null;
  latitude: number | null;
  longitude: number | null;
  content_chunk: string | null;
  created_at: string;
}

export interface RagMatch {
  id: string;
  source: string;
  title: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  distanceKmFromQueryTarget?: number;
  relevanceScore: number;
  contentSnippet: string;
  createdAt: string;
}

export type CandidateFetcher = (terms: string[], limit: number) => Promise<RagDocument[]>;

const STOPWORDS = new Set([
  "para", "como", "entre", "sobre", "desde", "hasta", "donde", "cuando", "este", "esta", "estos", "estas",
  "del", "las", "los", "una", "unos", "unas", "que", "con", "por", "sin", "más", "mas", "muy", "hay",
]);

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Términos de búsqueda: palabras de 4+ letras sin tildes ni signos (seguras para filtros ilike). */
export function extractTerms(query: string): string[] {
  const words = normalize(query).match(/[a-z0-9]{4,}/g) || [];
  return [...new Set(words.filter(w => !STOPWORDS.has(w)))].slice(0, 8);
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export async function searchRagDocuments(
  fetchCandidates: CandidateFetcher,
  params: { query: string; filterLat?: number; filterLng?: number; radiusKm?: number; maxMatches?: number }
): Promise<{ terms: string[]; matches: RagMatch[] }> {
  const terms = extractTerms(params.query || "");
  if (terms.length === 0) return { terms, matches: [] };

  const candidates = await fetchCandidates(terms, 300);
  const hasPoint = Number.isFinite(params.filterLat) && Number.isFinite(params.filterLng);

  const scored = candidates.map(doc => {
    const haystack = normalize(`${doc.title} ${doc.location_name || ""} ${doc.sub_basin || ""} ${doc.content_chunk || ""}`);
    const hits = terms.filter(t => haystack.includes(t)).length;
    const distance = hasPoint && doc.latitude != null && doc.longitude != null
      ? haversineKm(params.filterLat as number, params.filterLng as number, doc.latitude, doc.longitude)
      : undefined;
    return { doc, score: hits / terms.length, distance };
  });

  const matches = scored
    .filter(s => s.score > 0)
    .filter(s => !params.radiusKm || s.distance === undefined || s.distance <= params.radiusKm)
    .sort((a, b) => b.score - a.score || (a.distance ?? Infinity) - (b.distance ?? Infinity))
    .slice(0, Math.max(1, Math.min(params.maxMatches || 8, 25)))
    .map(({ doc, score, distance }) => ({
      id: doc.id,
      source: doc.doc_type,
      title: doc.title,
      location: doc.location_name || doc.sub_basin || "Sin ubicación",
      latitude: doc.latitude,
      longitude: doc.longitude,
      distanceKmFromQueryTarget: distance === undefined ? undefined : Math.round(distance * 10) / 10,
      relevanceScore: Math.round(score * 100) / 100,
      contentSnippet: (doc.content_chunk || "").slice(0, 400),
      createdAt: doc.created_at,
    }));

  return { terms, matches };
}

/** Candidatos desde Supabase: documentos que contienen al menos un término en título, lugar o contenido. */
export function supabaseCandidateFetcher(client: SupabaseClient): CandidateFetcher {
  return async (terms, limit) => {
    // Vocal -> "_" (comodín de un carácter) para que "bolivar" recupere "Bolívar".
    const patterns = terms.map(t => t.replace(/[aeiou]/g, "_"));
    const filters = patterns.flatMap(p => [`title.ilike.*${p}*`, `location_name.ilike.*${p}*`, `content_chunk.ilike.*${p}*`]);
    const { data, error } = await client
      .from("environmental_rag_documents")
      .select("id,doc_type,source_reference_id,title,location_name,sub_basin,latitude,longitude,content_chunk,created_at")
      .or(filters.join(","))
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`environmental_rag_documents: ${error.message}`);
    return (data as RagDocument[]) || [];
  };
}
