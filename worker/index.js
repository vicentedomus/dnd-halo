// Cloudflare Worker: proxy Notion API para dnd-halo
// Token de Notion se configura como secreto: wrangler secret put NOTION_TOKEN

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// Mapeo de endpoints a Notion Database IDs
const DB_MAP = {
  ciudades:         '325bece6f7da81c8a35cd3b01080783c',
  npcs:             '325bece6f7da8124bcfbff68c5ade8e1',
  establecimientos: '325bece6f7da811d8b6ffeedc633f811',
  players:          '325bece6f7da81888d04ef0759006e21',
  items:            '325bece6f7da81ff8d23d9a9e0b8d9f0',
  quests:           '325bece6f7da8156976bee7f99f6bd03',
  notas_dm:         '325bece6f7da81b0a73fd430c9509c35',
  notas_jugadores:  '325bece6f7da8154a8eff964dd7bac12',
  lugares:          '325bece6f7da816f9cf2ca30ac4cceda',
};

// --- Helpers de extracción de propiedades Notion ---

function getText(prop) {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title?.map(t => t.plain_text).join('') || '';
  if (prop.type === 'rich_text') return prop.rich_text?.map(t => t.plain_text).join('') || '';
  return '';
}

function getSelect(prop) {
  return prop?.select?.name || '';
}

function getNumber(prop) {
  return prop?.number ?? null;
}

function getCheckbox(prop) {
  return prop?.checkbox ?? false;
}

function getRelation(prop) {
  if (!prop?.relation?.length) return null;
  return prop.relation.map(r => r.id);
}

function getRelationSingle(prop) {
  const ids = getRelation(prop);
  return ids?.[0] || null;
}

// --- Resolución de relaciones (obtener nombre de página referenciada) ---

async function resolvePageTitle(pageId, token) {
  try {
    const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
      },
    });
    if (!res.ok) return null;
    const page = await res.json();
    // Buscar la propiedad title
    for (const [, prop] of Object.entries(page.properties)) {
      if (prop.type === 'title') {
        return prop.title?.map(t => t.plain_text).join('') || '';
      }
    }
    return '';
  } catch { return null; }
}

async function resolveRelation(prop, token) {
  const id = getRelationSingle(prop);
  if (!id) return null;
  const nombre = await resolvePageTitle(id, token);
  return nombre !== null ? { notion_id: id, nombre } : null;
}

async function resolveRelationMulti(prop, token) {
  const ids = getRelation(prop);
  if (!ids?.length) return [];
  const results = await Promise.all(
    ids.map(async (id) => {
      const nombre = await resolvePageTitle(id, token);
      return nombre !== null ? { notion_id: id, nombre } : null;
    })
  );
  return results.filter(Boolean);
}

// --- Transformadores por entidad ---

async function transformCiudad(page, token) {
  const p = page.properties;
  return {
    notion_id: page.id,
    nombre: getText(p['burg_nombre']),
    burg_id: getNumber(p['burg_id']),
    descripcion: getText(p['descripcion_burg']),
    descripcion_lider: getText(p['descripcion_lider']),
    estado: getText(p['estado_burg']),
    lider: getText(p['lider']),
    poblacion: getNumber(p['poblacion']),
    conocida_jugadores: getCheckbox(p['Conocida por Jugadores?']),
  };
}

async function transformNpc(page, token) {
  const p = page.properties;
  const [ciudad, establecimiento] = await Promise.all([
    resolveRelation(p['Ciudad'], token),
    resolveRelation(p['Establecimiento'], token),
  ]);
  return {
    notion_id: page.id,
    nombre: getText(p['Name']),
    raza: getSelect(p['Raza']),
    tipo_npc: getSelect(p['Tipo de NPC']),
    estado: getSelect(p['Estado']),
    rol: getSelect(p['Rol']),
    ciudad: ciudad || { notion_id: '', nombre: '' },
    establecimiento: establecimiento || { notion_id: '', nombre: '' },
    descripcion: getText(p['Descripción']),
    conocido_jugadores: getCheckbox(p['Conocido por Jugadores']),
  };
}

async function transformEstablecimiento(page, token) {
  const p = page.properties;
  const [ciudad, dueno] = await Promise.all([
    resolveRelation(p['Ciudad'], token),
    resolveRelation(p['Dueño'], token),
  ]);
  return {
    notion_id: page.id,
    nombre: getText(p['Nombre Establecimiento ']),
    tipo: getSelect(p['Tipo']),
    ciudad: ciudad || { notion_id: '', nombre: '' },
    dueno: dueno || { notion_id: '', nombre: '' },
    descripcion: getText(p['Descripcion']),
    conocido_jugadores: getCheckbox(p['Conocido por Jugadores?']),
  };
}

async function transformPlayer(page, token) {
  const p = page.properties;
  const items = await resolveRelationMulti(p['Items Mágicos'], token);
  return {
    notion_id: page.id,
    nombre: getText(p['Name']),
    clase: getSelect(p['Clase']),
    subclase: getSelect(p['Subclase']),
    raza: getSelect(p['Raza']),
    tipo: getSelect(p['Tipo']),
    es_pj: getCheckbox(p['Es PJ']),
    jugador: getSelect(p['Jugador']),
    nivel: getNumber(p['Nivel']),
    ac: getNumber(p['AC']),
    hp_maximo: getNumber(p['HP Máximo']),
    descripcion: getText(p['Descripción']),
    rol: getSelect(p['Rol']),
    items_magicos: items,
  };
}

async function transformItem(page, token) {
  const p = page.properties;
  const personaje = await resolveRelation(p['Personaje'], token);
  return {
    notion_id: page.id,
    nombre: getText(p['Name']),
    tipo: getSelect(p['Tipo']),
    rareza: getSelect(p['Rareza']),
    personaje: personaje || { notion_id: '', nombre: '' },
    requiere_sintonizacion: getCheckbox(p['Requiere attunement?']),
    fuente: getText(p['Fuente']),
    descripcion: getText(p['Descripción']),
  };
}

async function transformQuest(page, token) {
  const p = page.properties;
  return {
    notion_id: page.id,
    nombre: getText(p['Name']),
    estado: getSelect(p['Estado']),
    resumen: getText(p['Resumen']),
    recompensa_gp: getText(p['Recompensa (GP)']),
    visible_jugadores: getCheckbox(p['Visible por jugadores?']),
    npcs_importantes: getText(p['NPCs importantes']),
  };
}

async function transformNotaDm(page, token) {
  const p = page.properties;
  return {
    notion_id: page.id,
    nombre: getText(p['Name']) || getText(p['Nombre']),
    fecha: p['Fecha']?.date?.start || '',
    resumen: getText(p['Resumen']),
    session_prep: getText(p['Session Prep']) || getText(p['Preparación']),
  };
}

async function transformNotaJugador(page, token) {
  const p = page.properties;
  return {
    notion_id: page.id,
    nombre: getText(p['Name']) || getText(p['Nombre']),
    fecha: p['Fecha']?.date?.start || '',
    jugador: getSelect(p['Jugador']),
    resumen: getText(p['Resumen']),
    contenido: getText(p['Contenido']),
  };
}

async function transformLugar(page, token) {
  const p = page.properties;
  return {
    notion_id: page.id,
    nombre: getText(p['Name']) || getText(p['Nombre']),
    tipo: getSelect(p['Tipo']),
    region: getText(p['Región']) || getText(p['Region']),
    estado_exploracion: getSelect(p['Estado Exploración']) || getText(p['estado_exploracion']),
    descripcion: getText(p['Descripción']) || getText(p['Descripcion']),
  };
}

const TRANSFORMERS = {
  ciudades: transformCiudad,
  npcs: transformNpc,
  establecimientos: transformEstablecimiento,
  players: transformPlayer,
  items: transformItem,
  quests: transformQuest,
  notas_dm: transformNotaDm,
  notas_jugadores: transformNotaJugador,
  lugares: transformLugar,
};

// --- Query Notion Database ---

async function queryDatabase(dbId, token) {
  const pages = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion API error ${res.status}: ${err}`);
    }
    const data = await res.json();
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return pages;
}

// --- Request Handler ---

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [
      env.ALLOWED_ORIGIN || 'https://vicentedomus.github.io',
      'http://127.0.0.1:5500',
      'http://localhost:5500',
    ];
    const matchedOrigin = allowedOrigins.find(o => origin.startsWith(o)) || allowedOrigins[0];

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': matchedOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');

    if (!DB_MAP[path]) {
      return new Response(JSON.stringify({
        error: 'Not found',
        available: Object.keys(DB_MAP),
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const token = env.NOTION_TOKEN;
      if (!token) throw new Error('NOTION_TOKEN not configured');

      const dbId = DB_MAP[path];
      const pages = await queryDatabase(dbId, token);
      const transformer = TRANSFORMERS[path];
      const results = await Promise.all(pages.map(p => transformer(p, token)));

      return new Response(JSON.stringify(results, null, 2), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
