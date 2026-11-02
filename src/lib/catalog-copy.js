export function catalogCountLabel(category, count) {
  if (category === 'belleza') return `${count} ${count === 1 ? 'salón encontrado' : 'salones encontrados'}`;
  return `${count} ${count === 1 ? 'barbería encontrada' : 'barberías encontradas'}`;
}
