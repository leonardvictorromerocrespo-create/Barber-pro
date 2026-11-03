const LOGO_SOURCES = {
  dark: '/meryo-logo.png',
  light: '/meryo-logo-light.png',
};

export default function MeryoLogo({ variant = 'dark', className = '', ...props }) {
  const source = LOGO_SOURCES[variant] ?? LOGO_SOURCES.dark;
  return <img src={source} alt="MERYO" className={className} {...props} />;
}
