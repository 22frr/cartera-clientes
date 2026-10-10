# Cartera de clientes — sistema de cuenta corriente para comercios

Aplicación web para administrar clientes de cuenta corriente ("fiado"): registro de
compras, pagos, saldo automático, seguimiento de cobranza (días sin pagar y recordatorios
por WhatsApp), catálogo de productos propio por negocio, e importación y exportación con Excel.

Pensada para cualquier comercio que venda a crédito a clientes habituales
(kioscos, despensas, ferreterías, bazares, etc.), con soporte para múltiples
negocios sobre la misma instalación (multi-tenant).

Ver [`DOCUMENTACION_TECNICA.md`](./DOCUMENTACION_TECNICA.md) para alcance,
requerimientos, arquitectura y decisiones de diseño.

## Stack

PERN: PostgreSQL · Express · React (Vite + Tailwind) · Node.js. Excel con `exceljs`.

## Requisitos previos

- Node.js 18+
- PostgreSQL instalado localmente (o acceso a una instancia)

## Puesta en marcha

### 1. Base de datos

Crear la base `kiosco_db` en PostgreSQL y ejecutar `schema.sql` sobre ella
(ver `DOCUMENTACION_TECNICA.md`, sección 4.3, para el modelo de datos completo).

### 2. Backend

```bash
cd backend
npm install
```

Crear `backend/.env`:
```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=tu_contraseña
DB_NAME=kiosco_db
JWT_SECRET=un_texto_largo_y_aleatorio
```

```bash
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Si agregás una dependencia nueva, reiniciá `npm run dev`.

Abrir `http://localhost:5173`.

### 4. Crear el primer negocio

```bash
cd backend
node src/crear-negocio.js "Nombre del negocio" usuario contraseña telefono rubro direccion
```

## Scripts útiles

| Script | Uso |
|---|---|
| `backend/src/crear-negocio.js` | Alta de un negocio nuevo con su usuario |
| `backend/src/cambiar-clave.js` | Restablecer la contraseña de un usuario existente |
| `backend/src/importar-productos.js` | Precargar un catálogo de ejemplo (`.xlsx`) en un negocio. Usar `--probar` para simular. Requiere `npm install exceljs` en `backend/` |

Los comercios pueden importar sus propios productos y clientes (con saldo inicial) desde la
aplicación, con una plantilla de Excel descargable, y exportar listas y fichas a Excel.

## Estado del proyecto

En desarrollo activo. Ver la sección 6 de `DOCUMENTACION_TECNICA.md` para el
detalle de funcionalidades pendientes, y `estado_proyecto.md` para el punto en que se está trabajando.

## Licencia

Proyecto privado. Todos los derechos reservados.
