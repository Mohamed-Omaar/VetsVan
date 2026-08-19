export const ROLES = {
  super_admin: ['*'],
  admin: ['dashboard:read','bookings:read','bookings:write','services:read','services:write','experts:read','experts:write','partnerships:read','partnerships:write','content:read','content:write','media:read','media:write','messages:read','messages:write','seo:read','seo:write','settings:read','settings:write'],
  content_manager: ['dashboard:read','services:read','services:write','experts:read','experts:write','partnerships:read','partnerships:write','content:read','content:write','media:read','media:write','seo:read','seo:write','customization:read','customization:write'],
  booking_manager: ['dashboard:read','bookings:read','bookings:write','messages:read','messages:write'],
  viewer: ['dashboard:read','bookings:read','services:read','experts:read','partnerships:read','content:read','media:read','messages:read','seo:read','customization:read']
};

export function normalizeRole(role = '') {
  return String(role).toLowerCase().replace(/[-\s]/g, '_');
}

export function hasPermission(role, permission) {
  const list = ROLES[normalizeRole(role)] || [];
  return list.includes('*') || list.includes(permission);
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!hasPermission(req.user.role, permission)) return res.status(403).json({ error: 'Forbidden', permission });
    next();
  };
}
