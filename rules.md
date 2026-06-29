# Reglas del Proyecto FunAndCloser

1. **Verificación Local Primero**: Todos los cambios y nuevas fases deben probarse y verificarse en un entorno local (usando Live Server o abriendo los archivos en el navegador) antes de considerar la fase terminada.
2. **Aprobación para GitHub**: Una vez que la funcionalidad ha sido verificada en local y el usuario da "luz verde", recién entonces se procederá a hacer commit y push a GitHub.
3. **Paso a Paso**: No avanzar a la siguiente fase hasta que la fase actual esté 100% funcional y aprobada.
4. **Sincronización server.js ↔ api/generate.js (OBLIGATORIO ANTES DE CADA PUSH)**: Cualquier cambio realizado en la lógica del prompt, reglas de calidad, niveles de intensidad, categorías personales o cualquier otra lógica de negocio dentro de `server.js` DEBE replicarse de forma idéntica en `api/generate.js` antes de hacer `git push`. `server.js` es el backend local y `api/generate.js` es el backend de producción (Vercel); ambos deben permanecer siempre en sincronía.
