export const THEME_APPEARANCES = {
  barberia: [
    { id: 'marfil', label: 'Marfil', mode: 'light', colors: ['#F4EFE6', '#FFFBF4', '#9B7548'] },
    { id: 'petroleo-plata', label: 'Petróleo y plata', mode: 'dark', colors: ['#10191F', '#1B2A32', '#AECAD6'] },
    { id: 'negro-gris', label: 'Negro con gris claro', mode: 'dark', colors: ['#111111', '#292929', '#D6D6D6'] },
  ],
  belleza: [
    { id: 'rosa-marfil', label: 'Rosa y marfil', mode: 'light', colors: ['#FAF7F4', '#EEDDE2', '#955568'] },
    { id: 'ciruela-ahumado', label: 'Ciruela ahumado', mode: 'dark', colors: ['#342C33', '#413740', '#E3B1BF'] },
    { id: 'malva-lino', label: 'Malva y lino · propuesta', mode: 'light', colors: ['#F3EEF0', '#E8DCE1', '#916475'] },
  ],
};

export const DEFAULT_THEME_APPEARANCE = {
  barberia: { light: 'marfil', dark: 'petroleo-plata' },
  belleza: { light: 'rosa-marfil', dark: 'ciruela-ahumado' },
};

export function themeAppearanceOption(category, id) {
  return THEME_APPEARANCES[category]?.find(option => option.id === id) || null;
}
