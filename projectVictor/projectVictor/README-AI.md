# Asistente IA de MiRuta (Gemini)

La aplicación ahora incluye un chatbot con capacidades de agente IA. Gemini puede consultar herramientas de solo lectura para obtener rutas, tarifas y planes de suscripción del catálogo de MiRuta.

## 1. Configuración

1. Crea una clave de Gemini API en Google AI Studio.
2. Copia `.env.example` como `.env`.
3. Conserva las variables de Wompi existentes y agrega:

```env
GEMINI_API_KEY=TU_CLAVE_DE_GEMINI
GEMINI_MODEL=gemini-3.5-flash-lite
```

La clave debe permanecer en `.env`; no se coloca en `index.html`, `ui.js` ni `ai.js`.

## 2. Instalar y ejecutar

Desde la carpeta del proyecto:

```bash
npm install
npm start
```

Después abre `http://localhost:3000`.

## 3. Comprobar que Gemini funciona

Entra a una cuenta de MiRuta y abre **Asistente IA**.

Pulsa **Probar IA** o pregunta:

> ¿La IA está funcionando correctamente?

Una respuesta correcta muestra debajo un indicador como:

`Gemini conectado · gemini-3.5-flash-lite`

Cuando el asistente consulta una herramienta, también aparece el nombre de la herramienta utilizada, por ejemplo:

`Gemini conectado · gemini-3.5-flash-lite · herramienta: buscar_rutas`

También puedes abrir:

`http://localhost:3000/api/health`

y comprobar que aparezca:

```json
{
  "ok": true,
  "aiConfigured": true,
  "aiModel": "gemini-3.5-flash-lite"
}
```

## 4. Pruebas recomendadas para la presentación

- `¿Qué rutas están disponibles?`
- `¿Cuánto cuesta un pasaje?`
- `¿Qué planes de suscripción tienen?`
- `¿Cuánto cuesta?` → debe pedir aclaración.
- `¿Cuál es la ruta que va de Portal Sur a Portal Norte?`
- `¿Cuál es el precio de una ruta que no existe?` → no debe inventarla.
- `¿Quién ganó el Mundial?` → debe indicar que el asistente solo ayuda con MiRuta.

## 5. Seguridad y límites

El asistente solo dispone de herramientas de lectura para rutas, tarifas y suscripciones. No tiene herramientas para ejecutar pagos, modificar usuarios ni cancelar suscripciones.

Wompi sigue funcionando por separado y su información sensible permanece en el backend.


## Actualización de modelo (septiembre de 2026)

MiRuta usa `gemini-3.5-flash-lite`. Google restringe el acceso de nuevos usuarios a los modelos 2.5 y recomienda los modelos 3.5 Flash-Lite o superiores para proyectos nuevos. Si tu archivo `.env` todavía tiene `GEMINI_MODEL=gemini-2.5-flash-lite`, el backend lo migra automáticamente a `gemini-3.5-flash-lite`.
