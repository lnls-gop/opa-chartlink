export interface BookmarkInput {
  title: string;
  url: string;
  originalCategory: string;
  originalSubcategory: string;
}

export interface BookmarkClassification {
  category: string;
  subcategory: string;
  confidence: number;
  reasons: string[];
}

export interface ClassifiedBookmark extends BookmarkInput, BookmarkClassification {}

export interface CatalogLike { title: string; url: string; category: string; subcategory: string; }

interface Rule {
  category: string;
  subcategory?: string;
  weight: number;
  keywords: string[];
  reason: string;
}

const CATEGORY_ALIASES: Record<string, string> = {
  'linac': 'LINAC', 'linac ': 'LINAC',
  'anel': 'ANEL (SI)', 'anel (si)': 'ANEL (SI)', 'si': 'ANEL (SI)',
  'booster': 'BOOSTER', 'ltb': 'LTB', 'bts': 'BTS',
  'rf': 'RF', 'front-end': 'FRONT-END', 'front end': 'FRONT-END',
  'beamlines': 'BEAMLINES', 'beamlines ': 'BEAMLINES',
  'pulsados': 'PULSADOS', 'rad': 'RAD', 'synchrotrons': 'SYNCHROTRONS',
  'ponte rolante': 'PONTE ROLANTE', 'machine pvs - gop': 'Machine PVs - GOP',
  'general links': 'GENERAL LINKs', 'outros': 'OUTROS', 'geral': 'Geral',
};

const RULES: Rule[] = [
  // Strong subsystem signatures from EPICS/PV naming used by the project.
  { category: 'LINAC', subcategory: 'LLRF', weight: 12, keywords: ['llrf', 'kly1', 'kly2', 'bun1', 'get_phase', 'get_amp', 'get_ch1_power', 'get_ch1_phase'], reason: 'assinatura LLRF/KLY/BUN na URL ou título' },
  { category: 'LINAC', subcategory: 'Fontes', weight: 11, keywords: ['e-gun', 'eg-biasps', 'eg-filaps', 'eg-hvps', 'ps-slnd', 'solenoid', 'fonte'], reason: 'assinatura de fontes do LINAC' },
  { category: 'LINAC', subcategory: 'Vácuo', weight: 10, keywords: ['linac:vácuo', 'vacuum', 'pressure', 'rdprs', 'vac', 'vacuo', 'vácuo'], reason: 'assinatura de vácuo/pressão' },
  { category: 'LINAC', subcategory: 'Temperatura', weight: 10, keywords: ['linac:temperatura', 'temperature', 'temperatura', 'temp-mon', 'umidade', 'humidity'], reason: 'assinatura de temperatura/umidade' },
  { category: 'LINAC', subcategory: 'SKID', weight: 12, keywords: ['ph2skidli', 'skidli', 'hd-ft-', 'hd-pt-', 'hd-tt-', 'hd-tcv-', 'flow-mon', 'pressure-mon', 'valveopening-mon'], reason: 'assinatura SKID/PH2 do LINAC' },
  { category: 'LINAC', subcategory: 'Diagnóstico', weight: 8, keywords: ['diagnostico', 'diagnóstico', 'dcct', 'beam current', 'current-mon'], reason: 'assinatura de diagnóstico do LINAC' },

  { category: 'ANEL (SI)', subcategory: 'Temperatura', weight: 9, keywords: ['si-13c4', 'temperature-mon', 'temperatura', 'temp-mon'], reason: 'assinatura de temperatura do ANEL' },
  { category: 'ANEL (SI)', subcategory: 'Fontes', weight: 9, keywords: ['si-13c4', 'ps-', 'power-supply', 'fonte', 'source', 'ps-'], reason: 'assinatura de fontes do ANEL' },
  { category: 'ANEL (SI)', subcategory: 'Diagnóstico', weight: 9, keywords: ['dcct', 'diagnostico', 'diagnóstico', 'beam', 'current-mon'], reason: 'assinatura de diagnóstico do ANEL' },
  { category: 'ANEL (SI)', subcategory: 'Vácuo', weight: 9, keywords: ['vacuum', 'pressure', 'vacuo', 'vácuo', 'ion-pump', 'gauge'], reason: 'assinatura de vácuo do ANEL' },
  { category: 'ANEL (SI)', subcategory: 'Contador Gama', weight: 10, keywords: ['gama', 'gamma', 'contador gama', 'gamma-counter'], reason: 'assinatura de contador gama' },
  { category: 'ANEL (SI)', subcategory: 'Injeção', weight: 10, keywords: ['injecao', 'injeção', 'injection', 'kicker', 'septum'], reason: 'assinatura de injeção' },
  { category: 'ANEL (SI)', subcategory: 'CRIOPLANTA', weight: 10, keywords: ['crio', 'crioplanta', 'cryogenic', 'cryogenics'], reason: 'assinatura da crioplanta' },
  { category: 'ANEL (SI)', subcategory: 'HLS', weight: 10, keywords: ['hls', 'hydrostatic'], reason: 'assinatura HLS' },
  { category: 'ANEL (SI)', subcategory: 'Interlock PPS', weight: 10, keywords: ['pps', 'interlock'], reason: 'assinatura de interlock/PPS' },
  { category: 'ANEL (SI)', subcategory: 'ID', weight: 10, keywords: ['insertion device', 'undulator', 'w16', 'id-'], reason: 'assinatura de insertion device' },
  { category: 'ANEL (SI)', subcategory: 'Scrapers', weight: 10, keywords: ['scraper'], reason: 'assinatura de scrapers' },
  { category: 'ANEL (SI)', subcategory: 'Poço', weight: 10, keywords: ['poço', 'poco', 'well'], reason: 'assinatura de poço' },
  { category: 'ANEL (SI)', subcategory: 'Acelerômetro', weight: 10, keywords: ['acelerometro', 'acelerômetro', 'accelerometer'], reason: 'assinatura de acelerômetro' },

  { category: 'RF', subcategory: 'LLRF', weight: 10, keywords: ['llrf', 'kly', 'buncher', 'phase', 'amplitude'], reason: 'assinatura de LLRF/RF' },
  { category: 'RF', subcategory: 'SSA', weight: 10, keywords: ['ssa', 'solid state amplifier', 'amplifier'], reason: 'assinatura SSA' },
  { category: 'RF', subcategory: 'CrioMódulo 1', weight: 10, keywords: ['criomodulo 1', 'criomódulo 1', 'cryo-module-1', 'cm1'], reason: 'assinatura CrioMódulo 1' },
  { category: 'RF', subcategory: 'CrioMódulo 2', weight: 10, keywords: ['criomodulo 2', 'criomódulo 2', 'cryo-module-2', 'cm2'], reason: 'assinatura CrioMódulo 2' },
  { category: 'RF', subcategory: 'Cavidade', weight: 10, keywords: ['cavidade', 'cavity'], reason: 'assinatura de cavidade RF' },
  { category: 'RF', subcategory: 'Vácuo', weight: 8, keywords: ['vacuum', 'vácuo', 'vacuo', 'pressure'], reason: 'assinatura de vácuo RF' },
  { category: 'RF', subcategory: 'Vazão', weight: 8, keywords: ['flow', 'vazão', 'flow-mon'], reason: 'assinatura de vazão RF' },
  { category: 'RF', subcategory: 'Temperatura', weight: 8, keywords: ['temperature', 'temperatura', 'temp-mon'], reason: 'assinatura de temperatura RF' },
  { category: 'RF', subcategory: 'Temperaturas', weight: 8, keywords: ['temperature', 'temperatura', 'temp-mon'], reason: 'assinatura de temperatura RF' },
  { category: 'RF', subcategory: 'Power', weight: 8, keywords: ['power', 'power-mon'], reason: 'assinatura de potência RF' },

  { category: 'BOOSTER', subcategory: 'Temperatura', weight: 9, keywords: ['booster', 'temperature', 'temperatura', 'temp-mon'], reason: 'assinatura Booster + temperatura' },
  { category: 'BOOSTER', subcategory: 'Vácuo', weight: 9, keywords: ['booster', 'vacuum', 'vácuo', 'pressure'], reason: 'assinatura Booster + vácuo' },
  { category: 'BOOSTER', subcategory: 'Fontes', weight: 9, keywords: ['booster', 'power supply', 'fonte', 'ps-'], reason: 'assinatura Booster + fontes' },
  { category: 'BOOSTER', subcategory: 'Diagnóstico', weight: 8, keywords: ['booster', 'diagnostico', 'diagnóstico', 'dcct'], reason: 'assinatura Booster + diagnóstico' },

  { category: 'LTB', subcategory: 'Temperatura', weight: 9, keywords: ['ltb', 'temperature', 'temperatura', 'temp-mon'], reason: 'assinatura LTB + temperatura' },
  { category: 'LTB', subcategory: 'Vácuo', weight: 9, keywords: ['ltb', 'vacuum', 'vácuo', 'pressure'], reason: 'assinatura LTB + vácuo' },
  { category: 'LTB', subcategory: 'Fontes', weight: 9, keywords: ['ltb', 'power supply', 'fonte', 'ps-'], reason: 'assinatura LTB + fontes' },
  { category: 'LTB', subcategory: 'Diagnóstico', weight: 8, keywords: ['ltb', 'diagnostico', 'diagnóstico', 'dcct'], reason: 'assinatura LTB + diagnóstico' },

  { category: 'BTS', subcategory: 'Temperatura', weight: 9, keywords: ['bts', 'temperature', 'temperatura', 'temp-mon'], reason: 'assinatura BTS + temperatura' },
  { category: 'BTS', subcategory: 'Vácuo', weight: 9, keywords: ['bts', 'vacuum', 'vácuo', 'pressure'], reason: 'assinatura BTS + vácuo' },
  { category: 'BTS', subcategory: 'Fontes', weight: 9, keywords: ['bts', 'power supply', 'fonte', 'ps-'], reason: 'assinatura BTS + fontes' },
  { category: 'BTS', subcategory: 'Diagnóstico', weight: 8, keywords: ['bts', 'diagnostico', 'diagnóstico', 'dcct'], reason: 'assinatura BTS + diagnóstico' },

  { category: 'FRONT-END', subcategory: 'Vácuo', weight: 9, keywords: ['front-end', 'frontend', 'front end', 'vacuum', 'vácuo', 'pressure'], reason: 'assinatura Front-End + vácuo' },
  { category: 'FRONT-END', subcategory: 'Temperaturas', weight: 9, keywords: ['front-end', 'frontend', 'front end', 'temperature', 'temperatura'], reason: 'assinatura Front-End + temperatura' },
  { category: 'BEAMLINES', subcategory: 'Vácuo', weight: 9, keywords: ['beamline', 'beamlines', 'vacuum', 'vácuo', 'pressure'], reason: 'assinatura Beamline + vácuo' },
  { category: 'BEAMLINES', subcategory: 'Temperaturas', weight: 9, keywords: ['beamline', 'beamlines', 'temperature', 'temperatura'], reason: 'assinatura Beamline + temperatura' },
  { category: 'BEAMLINES', subcategory: 'CAX', weight: 10, keywords: ['cax'], reason: 'assinatura CAX' },
  { category: 'PULSADOS', subcategory: 'Temperatura', weight: 9, keywords: ['pulsado', 'pulsados', 'temperature', 'temperatura'], reason: 'assinatura Pulsados + temperatura' },
  { category: 'PULSADOS', subcategory: 'Fontes', weight: 9, keywords: ['pulsado', 'pulsados', 'power supply', 'fonte', 'ps-'], reason: 'assinatura Pulsados + fontes' },
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function rawText(input: BookmarkInput): string {
  return normalize([input.title, input.url, input.originalCategory, input.originalSubcategory].join(' '));
}

function canonicalCategory(value: string): string | null {
  return CATEGORY_ALIASES[normalize(value)] || null;
}

export function classifyBookmark(input: BookmarkInput, knownCategories: string[] = [], knownSubcategories: { name: string; category: string }[] = [], catalog: CatalogLike[] = []): BookmarkClassification {
  const text = rawText(input);
  const exact = catalog.find(e => e.url === input.url || normalize(e.title) === normalize(input.title));
  if (exact) {
    return { category: exact.category.trim(), subcategory: exact.subcategory.trim(), confidence: 0.99, reasons: ['correspondência encontrada nos links já cadastrados'] };
  }
  const candidates = new Map<string, { score: number; reasons: string[] }>();

  const add = (key: string, score: number, reason: string) => {
    const old = candidates.get(key) || { score: 0, reasons: [] };
    old.score += score;
    if (!old.reasons.includes(reason)) old.reasons.push(reason);
    candidates.set(key, old);
  };

  for (const rule of RULES) {
    const hits = rule.keywords.filter(k => text.includes(normalize(k)));
    if (!hits.length) continue;
    // Multiple matching tokens strengthen the result, but cap the bonus.
    add(`${rule.category}::${rule.subcategory || ''}`, rule.weight + Math.min(hits.length - 1, 3) * 2, `${rule.reason}: ${hits.slice(0, 3).join(', ')}`);
  }

  const originalCat = canonicalCategory(input.originalCategory);
  if (originalCat) add(`${originalCat}::`, 3, `pasta original reconhecida como ${originalCat}`);
  if (input.originalSubcategory && originalCat) {
    const exact = knownSubcategories.some(s => s.category === originalCat && normalize(s.name) === normalize(input.originalSubcategory));
    if (exact) add(`${originalCat}::${input.originalSubcategory.trim()}`, 7, 'subpasta original coincide com a taxonomia do ChartLink');
  }

  if (!candidates.size) {
    return { category: 'OUTROS', subcategory: '', confidence: 0.15, reasons: ['nenhuma regra técnica reconhecida'] };
  }

  const ranked = Array.from(candidates.entries()).sort((a, b) => b[1].score - a[1].score);
  const [bestKey, best] = ranked[0];
  const second = ranked[1]?.[1].score || 0;
  const [category, subcategory] = bestKey.split('::');
  const confidence = Math.max(0.15, Math.min(0.99, 0.45 + Math.min(best.score, 25) / 40 + (best.score - second) / 60));

  // If the original category is a known ChartLink category and the classifier is weak,
  // preserve it rather than inventing a different subsystem.
  if (originalCat && confidence < 0.58) {
    const originalSub = input.originalSubcategory.trim();
    const validSub = originalSub && knownSubcategories.some(s => s.category === originalCat && normalize(s.name) === normalize(originalSub));
    return {
      category: originalCat,
      subcategory: validSub ? knownSubcategories.find(s => s.category === originalCat && normalize(s.name) === normalize(originalSub))!.name : '',
      confidence: Math.max(confidence, 0.58),
      reasons: ['classificação conservadora usando a pasta original', ...best.reasons],
    };
  }

  return { category, subcategory, confidence, reasons: best.reasons };
}

export function classifyBookmarks(inputs: BookmarkInput[], knownCategories: string[] = [], knownSubcategories: { name: string; category: string }[] = [], catalog: CatalogLike[] = []): ClassifiedBookmark[] {
  return inputs.map(input => ({ ...input, ...classifyBookmark(input, knownCategories, knownSubcategories, catalog) }));
}
