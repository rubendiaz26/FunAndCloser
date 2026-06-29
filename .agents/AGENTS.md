# Reglas del Agente — FunAndCloser

## Regla Critica: Sincronizacion server.js <-> api/generate.js

**Antes de cualquier `git push` en este proyecto**, el agente DEBE verificar que `api/generate.js` y `server.js` estan en sincronía en cuanto a:

- Logica del prompt (reglas de calidad, estilo, perspectiva)
- Niveles de intensidad (`spicyLevel`)
- Lista de categorias personales (`isPersonalCategory`)
- Reglas de seguridad (ej. "Futuros Hijos" -> nivel 1)
- Instrucciones sobre el placeholder `{pareja}`
- Cualquier otro cambio de logica de negocio

**Razon:** `server.js` es el backend local (para desarrollo) y `api/generate.js` es el backend de produccion (Vercel). Si no estan sincronizados, los cambios probados en local no se reflejan en produccion.

**Protocolo:** Si se modifica `server.js`, el agente DEBE aplicar el cambio equivalente en `api/generate.js` en el mismo commit, sin necesidad de que el usuario lo recuerde.
