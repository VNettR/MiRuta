# Panel de administración de MiRuta

Acceso de demostración académica:
- Correo: `admin@miruta.com`
- Contraseña: `Admin123!`

El panel permite revisar usuarios, activar/desactivar cuentas, activar/desactivar rutas y planes, crear nuevas rutas y planes, consultar suscripciones y pagos locales y comprobar la conexión con Gemini.

## Importante
Esta versión conserva la arquitectura académica original: los datos principales de MiRuta están en `localStorage`. Por eso el panel administra el conjunto de datos del navegador donde se ejecuta la aplicación. Para un despliegue real multiusuario, los usuarios, roles y permisos deben trasladarse al backend y a una base de datos compartida.
