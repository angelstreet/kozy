export function kozyDeeplink(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

export function kozyPropertyDeeplink(propertyId?: number | null) {
  return propertyId ? `/properties/${propertyId}` : '/properties';
}
