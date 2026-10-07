# Sistema de cartera de clientes y cuenta corriente

**Documento técnico y de producto**
Última actualización: 30/09/2026

---

## 1. Qué es este sistema

Aplicación web para que un comercio administre a sus clientes de **cuenta corriente** ("fiado"): qué compró cada uno, cuánto pagó, cuánto debe, y el historial completo de esos movimientos.

No es un sistema exclusivo para kioscos. Está diseñado para **cualquier comercio que venda productos a crédito a sus clientes habituales**: kioscos, despensas, ferreterías, bazares, verdulerías, etc. El rubro no condiciona el modelo de datos ni la lógica de la aplicación; el único lugar donde aparece un rubro concreto es como dato informativo del negocio y como catálogo de productos de ejemplo para precargar más rápido.

## 2. Alcance

### 2.1 Incluido (funcionalidades actuales)

- Alta, edición, archivado y eliminación de clientes.
- Registro de compras con **múltiples productos por operación**, con cálculo automático de totales.
- Registro de pagos (parciales o totales).
- Cálculo automático de saldo por cliente (compras - pagos).
- Edición y anulación de compras y pagos ya cargados, con posibilidad de restaurarlos.
- Eliminación definitiva, restringida a movimientos ya anulados.
- Selección múltiple para archivar/anular/restaurar/eliminar en bloque (clientes y movimientos).
- Historial filtrable (por tipo) y ordenable (fecha, monto).
- Catálogo de productos por negocio (nombre, categoría, precio de referencia, código de barras opcional), editable desde la propia aplicación.
- Autenticación por usuario y contraseña, con sesión de 30 días.
- **Multi-negocio (multi-tenant):** varios comercios usan la misma aplicación, cada uno ve únicamente sus propios datos.
- Modo claro/oscuro.
- Uso desde computadora y desde celular (responsive), incluyendo acceso por red local sin necesidad de internet.

### 2.2 Explícitamente fuera de alcance (por ahora)

- Registro público de cuentas nuevas (hoy el alta de un negocio la hace el administrador de la plataforma por línea de comandos).
- Recuperación de contraseña por correo.
- Panel de administración de la plataforma (ver/gestionar todos los negocios dados de alta).
- Roles o múltiples usuarios por negocio (hoy es un usuario = un negocio).
- Facturación electrónica o integración con AFIP/ARCA.
- Ventas de contado / caja diaria (el sistema hoy asume que toda venta registrada es a cuenta corriente).
- Lectura de código de barras con cámara o pistola lectora (el campo existe en la base de datos, pero no hay lógica de escaneo implementada todavía).
- Notificaciones automáticas a clientes (WhatsApp, SMS, email).

## 3. Requerimientos

### 3.1 Requerimientos funcionales (resumen)

| # | Requerimiento |
|---|---|
| RF1 | El sistema debe permitir registrar, editar, archivar y restaurar clientes. |
| RF2 | El sistema debe permitir registrar una compra con uno o más productos en una sola operación. |
| RF3 | El sistema debe calcular el saldo de cada cliente como la suma de sus compras activas menos la suma de sus pagos activos. |
| RF4 | El sistema debe permitir anular un movimiento sin eliminarlo, y restaurarlo si fue anulado por error. |
| RF5 | El sistema debe permitir eliminar definitivamente solo movimientos que ya estén anulados. |
| RF6 | El sistema debe impedir que un negocio acceda a los datos de otro negocio. |
| RF7 | El sistema debe permitir operar tanto desde una computadora como desde un celular, sin pérdida de funcionalidad. |
| RF8 | El sistema debe mantener un catálogo de productos propio por negocio, reutilizable al cargar compras. |

### 3.2 Requerimientos no funcionales

- **Seguridad:** contraseñas nunca almacenadas en texto plano (hash con bcrypt); sesión mediante JWT; toda ruta de datos exige autenticación y filtra por negocio.
- **Aislamiento de datos:** modelo multi-tenant a nivel de base de datos (columna `negocio_id` en cada tabla relevante), no solo a nivel de interfaz.
- **Usabilidad:** cualquier acción destructiva (eliminar, archivar) exige confirmación explícita; las acciones reversibles (anular, archivar) se prefieren sobre el borrado directo.
- **Consistencia de interfaz:** patrones repetidos en toda la aplicación (selección múltiple, botones de formulario, navegación "atrás" respetando el origen real de la navegación).
- **Portabilidad de rubro:** ninguna lógica de negocio debe asumir un rubro específico; lo único orientado a un rubro es contenido de referencia (ej. catálogo de ejemplo para precarga), nunca código.
- **Disponibilidad (etapa actual):** uso en red local, sin garantía de disponibilidad 24/7. Pasar a hosting con disponibilidad continua es un requisito pendiente antes de la venta a terceros (ver sección 6).

## 4. Arquitectura

### 4.1 Stack tecnológico (PERN)

- **Frontend:** React (Vite) + Tailwind CSS + React Router.
- **Backend:** Node.js + Express.
- **Base de datos:** PostgreSQL.
- **Autenticación:** JWT (jsonwebtoken) + bcryptjs para hashing de contraseñas.

### 4.2 Estructura del repositorio

```
kiosco-app/
├── frontend/          React + Vite + Tailwind
│   └── src/
│       ├── App.jsx           Lista de clientes, resumen, alta
│       ├── Cliente.jsx       Ficha de cliente, compras, pagos, historial
│       ├── Catalogo.jsx      Catálogo de productos del negocio
│       ├── Login.jsx         Autenticación
│       ├── api.js            Cliente HTTP hacia el backend
│       └── ThemeToggle.jsx   Modo claro/oscuro
└── backend/
    └── src/
        ├── index.js               Punto de entrada, registro de rutas
        ├── db.js                  Conexión a PostgreSQL
        ├── auth.js                Middleware de autenticación (JWT)
        ├── crear-negocio.js       Script: alta de negocio + usuario
        ├── cambiar-clave.js       Script: reseteo de contraseña
        └── routes/
            ├── auth.js            Login
            ├── clientes.js        CRUD de clientes, archivado
            ├── ventas.js          Compras (con múltiples productos)
            ├── pagos.js           Pagos
            └── productos.js       Catálogo de productos
```

### 4.3 Modelo de datos (resumen conceptual)

```
negocios ──< usuarios
negocios ──< clientes ──< ventas ──< venta_items
negocios ──< clientes ──< pagos
negocios ──< productos
```

Toda tabla de datos operativos (`clientes`, `ventas`, `pagos`, `productos`) tiene una columna `negocio_id`, y **toda consulta del backend filtra por el negocio del usuario autenticado**. Este es el mecanismo central de aislamiento multi-tenant.

Las compras (`ventas`) y sus productos (`venta_items`) están separados en dos tablas para permitir múltiples productos por operación sin duplicar cabecera (fecha, cliente, total).

## 5. Decisiones de diseño relevantes

Estas decisiones no son obvias leyendo solo el código, así que quedan documentadas explícitamente:

- **Archivar en vez de eliminar (clientes):** eliminar un cliente borra su historial completo de forma irreversible. Por eso la acción por defecto es "archivar" (reversible); "eliminar" solo está disponible sobre clientes ya archivados, como segunda confirmación deliberada.
- **Anular en vez de eliminar (movimientos):** mismo criterio aplicado a compras y pagos. Anular saca el movimiento del cálculo de saldo sin perder el registro; eliminar definitivamente solo es posible sobre movimientos ya anulados.
- **Catálogo de productos como texto libre en las ventas:** `venta_items.producto` guarda el nombre como texto, no como referencia (`foreign key`) al catálogo. Esto es intencional: si un producto se edita o elimina del catálogo más adelante, las compras históricas no cambian ni se rompen.
- **Multi-tenant por columna, no por base de datos separada:** se eligió un esquema compartido con `negocio_id` en lugar de una base de datos por cliente, por ser más simple de mantener y suficiente para el volumen esperado (decenas/cientos de negocios pequeños).
- **Sesión con nombre de usuario, no email:** decisión deliberada para bajar la fricción de uso en comercios que no necesariamente gestionan un correo electrónico propio del negocio.
- **Navegación "atrás" basada en historial real del navegador** (`navigate(-1)`), no en rutas fijas, para que "volver" respete siempre desde dónde entró el usuario (lista de clientes, vista de archivados, etc.).

## 6. Estado actual y pendientes conocidos

### 6.1 Pendiente de corto plazo
- Autocompletado de productos al cargar una compra, usando el catálogo.
- Exportación a Excel (lista de clientes, detalle de cliente).
- Manual de usuario para comercios (lenguaje no técnico).

### 6.2 Pendiente antes de vender a terceros
- Alta de cuenta autoservicio (sin depender de scripts de línea de comandos).
- Recuperación de contraseña.
- Hosting con disponibilidad continua (hoy corre en red local) + backup automático de la base de datos.
- Definición de modelo de cobro (suscripción, licencia única, etc.) — decisión de negocio, no técnica.

### 6.3 Pendiente de mediano plazo
- Panel de administración de la plataforma.
- Roles y múltiples usuarios por negocio.
- Soporte de lectura de código de barras (campo ya modelado en base de datos).

## 7. Cómo correr el proyecto en desarrollo

```powershell
# Backend
cd backend
npm install
npm run dev        # http://localhost:3000

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev         # http://localhost:5173
```

Requiere PostgreSQL corriendo localmente con la base `kiosco_db` creada, y un archivo `backend/.env` con las variables de conexión y `JWT_SECRET` (ver `.env.example` si se agrega, o solicitar la plantilla).

Para dar de alta el primer negocio:
```powershell
node src/crear-negocio.js "Nombre del negocio" usuario contraseña telefono rubro direccion
```

## 8. Convenciones de interfaz (obligatorias)

Reglas para toda pantalla nueva o modificada. Existen para que nada vuelva a verse mal en el celular o en modo claro.

**Legibilidad**
- Ningún dato que el usuario necesite leer (nombre, monto, teléfono, estado, descripción) se corta con "…" ni se sale de su caja. Si no entra, se achica la letra o baja a la línea siguiente. `truncate` solo se admite en texto decorativo o secundario que no aporte información.
- Los montos usan `whitespace-nowrap` y ajustan su tamaño según la cantidad de dígitos; las columnas y tarjetas deben aguantar montos de 8 dígitos o más.
- Una pantalla no se da por terminada hasta verla a **360 px de ancho** (celular chico), en modo claro y en modo oscuro.

**Contraste (modo claro)**
- Bordes de botones secundarios: `slate-500`. Bordes de campos de texto, buscadores y selectores: `slate-400`. Nunca más claros.
- Texto: mínimo `slate-700` sobre fondo claro. No usar `slate-400` ni `slate-500` para texto.
- El modo oscuro mantiene su paleta actual.

**Botones**
- Texto siempre con peso `font-semibold` o mayor. Hay una regla global en `index.css` (`button { font-weight: 600 }`) y los botones con clases propias usan `font-semibold`, no `font-medium`.

**Listas densas (catálogo, historial)**
- Filas compactas: dos líneas como máximo por elemento (título + detalle), monto alineado a la derecha, para que entren más elementos por pantalla sin perder legibilidad.
