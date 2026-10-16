# MiRuta + Wompi

## Requisitos

- Node.js 18 o superior.
- Un comercio Wompi activo.
- Llaves de Wompi del ambiente elegido.

## Configuración

1. Copia `.env.example` como `.env`.
2. Coloca las llaves en `.env`.
3. Para dinero real usa:
   - `WOMPI_ENV=production`
   - `pub_prod_...`
   - `prv_prod_...`
   - `prod_integrity_...`
   - `prod_events_...`
4. Instala dependencias:

```bash
npm install
```

5. Inicia:

```bash
npm start
```

6. Abre:

`http://localhost:3000`

## Importante sobre seguridad

La llave privada y los secretos de integración permanecen en el backend.
No los pongas en `payment.js`, `ui.js`, `index.html` ni los subas a GitHub.

El frontend abre el Widget oficial de Wompi. Después del pago, el backend consulta
el estado de la transacción usando la llave privada antes de registrar el pago
como completado en la aplicación.

## Webhook

Wompi recomienda usar el evento `transaction.updated` como fuente de verdad para
finalizar la integración. El endpoint preparado es:

`POST /api/wompi/webhook`

Para producción debe ser una URL HTTPS pública. Configúrala en el dashboard de
Wompi en la sección de eventos/seguimiento de transacciones.

## Nota sobre la base de datos del proyecto

La aplicación original usa `localStorage` como capa de datos del navegador.
La integración Wompi agrega un registro de órdenes en `data/wompi-orders.json`,
pero no convierte automáticamente toda la aplicación a MySQL.

Para un proyecto académico esto permite conservar la arquitectura existente y
cobrar mediante Wompi real. Para un sistema comercial, convendría trasladar
usuarios, pagos, viajes y suscripciones a una base de datos del servidor.
