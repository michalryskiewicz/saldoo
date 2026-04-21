import { NEW_ENTITY_ID } from '@/constant.ts';

export const checkIfOpen = <T extends object>(id?: string, objectToBePresent?: T) => {
  if (!id) return false;
  if (id === NEW_ENTITY_ID) return true;
  if (
    id !== NEW_ENTITY_ID &&
    objectToBePresent &&
    typeof objectToBePresent === 'object' &&
    Object.keys(objectToBePresent).length > 0
  ) {
    return true;
  }
  return false;
};

export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  // Convert ArrayBuffer to hex string
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
