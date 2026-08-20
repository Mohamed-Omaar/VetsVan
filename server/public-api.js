// Public CMS API helpers. The website can use these endpoints without authentication.
// This module documents the public contract used by the VETS VAN website.
export const publicCmsRoutes = [
  'GET /api/content',
  'GET /api/services',
  'GET /api/site-settings',
  'POST /api/bookings',
  'POST /api/messages'
];
