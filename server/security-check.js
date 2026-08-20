// Production safety checks for VETS VAN.
// Import this module before creating the server so Render cannot start with an unsafe JWT fallback.
export function assertProductionSecrets() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production');
  }
}
