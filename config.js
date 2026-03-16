// Contraseñas hasheadas con SHA-256
// "halo-dm"      → 6a4781a35aeb48a44fc04326e4f13a345fb5ae8af62b856a93c6f0e2814894ca
// "halo-players" → 00f0130dc651a5b6e2dee0194bae3d18fb5b30d2de0e2abbdbd7d3f4747bc980
const CONFIG = {
  DM_HASH:     "6a4781a35aeb48a44fc04326e4f13a345fb5ae8af62b856a93c6f0e2814894ca",
  PLAYER_HASH: "00f0130dc651a5b6e2dee0194bae3d18fb5b30d2de0e2abbdbd7d3f4747bc980",
  GITHUB_OWNER: "vicentedomus",
  GITHUB_REPO:  "dnd-halo",
  // Cloudflare Worker como proxy a Notion (fuente de datos en tiempo real)
  // Si USE_NOTION es false o el Worker falla, cae a los JSON locales en /data/
  USE_NOTION: true,
  WORKER_URL: "https://dnd-halo-api.vichomiguel.workers.dev"
  // GitHub token se guarda en localStorage del DM, nunca en este archivo
};
