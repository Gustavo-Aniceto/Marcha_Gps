// Conteúdo do QR de check-in: o membro mostra, o admin escaneia no encontro.
// O banco (admin_checkin) é quem decide se vale: só admin da equipe e só membro da equipe.

const PREFIX = 'marchagps:checkin:v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER = /^[A-Za-z0-9_-]{1,128}$/;

export function checkinPayload(crewId: string, userId: string): string {
  if (!UUID.test(crewId) || !USER.test(userId)) throw new Error('dados inválidos pro QR');
  return `${PREFIX}:${crewId}:${userId}`;
}

export function parseCheckin(text: string): { crewId: string; userId: string } | null {
  const parts = text.trim().split(':');
  if (parts.length !== 5 || `${parts[0]}:${parts[1]}:${parts[2]}` !== PREFIX) return null;
  const [, , , crewId, userId] = parts;
  if (!UUID.test(crewId) || !USER.test(userId)) return null;
  return { crewId, userId };
}
