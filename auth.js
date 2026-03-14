async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function login(password) {
  const hash = await hashPassword(password);
  if (hash === CONFIG.DM_HASH) {
    sessionStorage.setItem('role', 'dm');
    sessionStorage.setItem('loggedIn', 'true');
    return 'dm';
  } else if (hash === CONFIG.PLAYER_HASH) {
    sessionStorage.setItem('role', 'player');
    sessionStorage.setItem('loggedIn', 'true');
    return 'player';
  }
  return null;
}

function getRole() { return sessionStorage.getItem('role'); }
function isLoggedIn() { return sessionStorage.getItem('loggedIn') === 'true'; }
function isDM() { return getRole() === 'dm'; }
function logout() { sessionStorage.clear(); window.location.reload(); }
