# Instrucciones del proyecto MERYO

- No usar Docker. No iniciar Docker Desktop ni crear, arrancar o ejecutar contenedores para este proyecto. Restricción explícita del propietario del 24 de octubre de 2026 por consumo de recursos/costos; se mantiene en futuras sesiones salvo revocación explícita.
- Para pruebas de base de datos, usar PostgreSQL nativo con instancia y datos exclusivos del proyecto, o un entorno de staging separado. Detener la instancia local de pruebas al terminar. No tocar otros proyectos ni borrar sus datos.
- Nunca usar producción para probar. No desplegar, aplicar migraciones a producción ni habilitar cobros sin demostrar el flujo real en staging y obtener autorización explícita.
- Conservar el diseño y los avances existentes. Consultar docs/MERYO-estado-2026-10-24.md antes de repetir verificaciones.
- El SQL en db/candidate es un esquema candidato local; no representa el esquema existente de Supabase. Contrastarlo con el export real antes de integrar.
- No exponer ni registrar secretos. Comisión configurable S/1 o S/2, criterio pendiente; no implementar reparto de fondos sin validar al proveedor.
