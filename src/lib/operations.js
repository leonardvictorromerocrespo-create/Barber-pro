// UI only: authorization, prices and transitions belong to the database.
export async function savedOperation(operation) {
  const { data, error } = await operation();
  if (error) throw new Error(error.message || 'No se pudo guardar la operación');
  if (!data || (Array.isArray(data) && !data.length)) {
    throw new Error('El servidor no confirmó la operación');
  }
  return data;
}

export async function endSession(client, clear) {
  const { error } = await client.auth.signOut();
  if (error) throw error;
  clear();
}

export function commissionLabel(cents) {
  return cents === 100 || cents === 200 ? `S/ ${(cents / 100).toFixed(2)}` : 'Por definir';
}

export async function signInWithProfile(client, credentials, allowedRoles) {
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error) throw error;
  try {
    if (!data?.user) throw new Error('No se confirmó la sesión');
    const { data: profile, error: profileError } = await client.from('profiles').select('*').eq('id', data.user.id).single();
    if (profileError || !profile?.activo || !allowedRoles.includes(profile.rol)) {
      throw new Error('Necesitas un perfil activo con el rol correspondiente');
    }
    if (profile.rol === 'barbero' && !profile.barberia_id) throw new Error('Falta asignar la barbería');
    return profile;
  } catch (failure) {
    await client.auth.signOut();
    throw failure;
  }
}
