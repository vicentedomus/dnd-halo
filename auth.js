/** Restaura la sesión de Supabase al sessionStorage (para getters sincrónicos) */
async function initAuth() {
  const { data: { session } } = await sbClient.auth.getSession();
  if (session && session.user) {
    const role = session.user.user_metadata?.role || 'player';
    sessionStorage.setItem('role', role);
    sessionStorage.setItem('loggedIn', 'true');
  }
}

/**
 * Login genérico: intenta primero como DM (dm@{slug}.local),
 * luego como Player (player@{slug}.local).
 * El password es lo que el usuario escribe — Supabase Auth valida.
 */
async function login(password) {
  const slug = CONFIG.SLUG;
  const attempts = [
    { email: `dm@${slug}.local`,     role: 'dm' },
    { email: `player@${slug}.local`, role: 'player' },
  ];
  for (const attempt of attempts) {
    const { data, error } = await sbClient.auth.signInWithPassword({
      email: attempt.email,
      password,
    });
    if (!error && data.user) {
      const role = data.user.user_metadata?.role || attempt.role;
      sessionStorage.setItem('role', role);
      sessionStorage.setItem('loggedIn', 'true');
      if (role === 'dm') sessionStorage.setItem('dm_password', password);
      return role;
    }
  }
  return null;
}

function getRole()    { return sessionStorage.getItem('role'); }
function isLoggedIn() { return sessionStorage.getItem('loggedIn') === 'true'; }
function isDM()       { return getRole() === 'dm'; }

async function logout() {
  await sbClient.auth.signOut();
  sessionStorage.clear();
  window.location.reload();
}
