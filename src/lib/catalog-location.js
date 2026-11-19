import { coordinates } from './catalog.js';

export const CATALOG_GEOLOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: false,
  maximumAge: 30_000,
  timeout: 60_000,
});

export function catalogLocationErrorMessage(error) {
  if (error?.kind === 'insecure-context') {
    return 'La ubicación requiere una conexión segura. Abre MERYO con HTTPS o busca por distrito.';
  }
  if (error?.kind === 'unsupported') {
    return 'Este navegador no ofrece ubicación. Puedes buscar por distrito.';
  }
  if (error?.kind === 'invalid-position') {
    return 'El dispositivo no devolvió coordenadas válidas. Puedes intentarlo otra vez o buscar por distrito.';
  }

  switch (Number(error?.code)) {
    case 1:
      return 'El navegador o el dispositivo bloqueó la ubicación. Revisa el permiso de MERYO y los ajustes del dispositivo, o busca por distrito.';
    case 2:
      return 'La ubicación no está disponible. Comprueba que esté activada en el dispositivo y vuelve a intentarlo, o busca por distrito.';
    case 3:
      return 'La ubicación tardó demasiado. Comprueba la señal GPS o de red y vuelve a intentarlo, o busca por distrito.';
    default:
      return 'No se pudo obtener la ubicación. Puedes intentarlo otra vez o buscar por distrito.';
  }
}

export function requestCatalogLocation({ geolocation, isSecureContext }) {
  if (!isSecureContext) return Promise.reject({ kind: 'insecure-context' });
  if (typeof geolocation?.getCurrentPosition !== 'function') {
    return Promise.reject({ kind: 'unsupported' });
  }

  return new Promise((resolve, reject) => {
    try {
      geolocation.getCurrentPosition(
        position => {
          const point = coordinates({
            lat: position?.coords?.latitude,
            lng: position?.coords?.longitude,
          });
          if (!point) reject({ kind: 'invalid-position' });
          else resolve(point);
        },
        error => reject({ code: Number(error?.code) || (error?.name === 'SecurityError' ? 1 : 0) }),
        CATALOG_GEOLOCATION_OPTIONS,
      );
    } catch (error) {
      reject({ code: Number(error?.code) || (error?.name === 'SecurityError' ? 1 : 0) });
    }
  });
}
