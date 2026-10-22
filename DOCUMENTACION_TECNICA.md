# Sistema de cartera de clientes y cuenta corriente

**Documento técnico y de producto**
Última actualización: 20/10/2026

---

## 1. Qué es este sistema

Aplicación web para que un comercio administre a sus clientes de **cuenta corriente** ("fiado"): qué compró cada uno, cuánto pagó, cuánto debe, hace cuánto no paga, y el historial completo de esos movimientos.

No es un sistema exclusivo para kioscos. Está diseñado para **cualquier comercio que venda productos a crédito a sus clientes habituales**: kioscos, despensas, ferreterías, bazares, verdulerías, etc. El rubro no condiciona el modelo de datos ni la lógica de la aplicación; el único lugar donde aparece un rubro concreto es como dato informativo del negocio y como catálogo de productos de ejemplo para precargar más rápido.

## 2. Alcance

### 2.1 Incluido (funcionalidades actuales)

**Clientes**
- Alta, edición, archivado y eliminación.
- Búsqueda sin distinguir tildes ni mayúsculas ("jose" encuentra "José").
- Filtros (Todos / Deben / Atrasados / Al día) y 6 criterios de orden. Se recuerdan mientras la pestaña esté abierta, así al entrar a un cliente y volver la lista sigue como estaba.
- Selección múltiple para archivar, restaurar o eliminar en bloque, con botón **Todos / Ninguno** junto a la acción principal. Selecciona solo los clientes que se ven con el filtro actual.
- Estados de la lista: esqueleto gris mientras carga, guía de bienvenida (con "Agregar cliente" e "Importar desde Excel") en un negocio sin clientes, y mensaje con "Limpiar filtros" cuando la búsqueda o el filtro no encuentran resultados (ver 5.29).

**Compras y pagos**
- Compra **rápida** (monto + descripción opcional) o **con productos** (planilla con varios productos, cálculo automático de cantidad × precio = total y viceversa, navegación con Enter y flechas). El modo elegido se recuerda en el navegador.
- Autocompletado de productos desde el catálogo (producto y precio; el foco pasa a Cantidad).
- Fecha editable de cada compra y pago.
- Pagos parciales o totales (botón "Pagar todo").
- Edición de compras ya cargadas.
- Saldo automático por cliente: compras activas − pagos activos.
- Anular (reversible), restaurar y eliminar definitivamente (solo lo ya anulado). Selección múltiple de movimientos, con botón **Todos / Ninguno** (solo los movimientos visibles con el filtro y la vista actuales).
- **Deshacer** al registrar una compra desde el aviso en pantalla: la compra se anula y se elimina, sin dejar rastro en "anulados".
- Historial filtrable por tipo y ordenable por fecha o monto, con vista separada de anulados.

**Cobranza**
- "Días sin pagar": el **menor** entre los días desde el último pago activo y los días desde la deuda más antigua sin cubrir (los pagos se aplican primero a las compras más viejas, criterio FIFO). Solo se calcula si hoy debe algo. Así un buen cliente que pagó todo y hoy compró algo no figura como atrasado (ver 5.23).
- Cuatro niveles de color según antigüedad de la deuda: al día, reciente, atención (más de 20 días), atrasado (más de 30 días). Los umbrales son constantes en `cobranza.js`.
- Aviso en la lista cuando hay clientes atrasados, con acceso directo al filtro.
- Recordatorio por WhatsApp con el mensaje armado (el envío lo hace la persona; el sistema abre el chat). Normaliza teléfonos argentinos (el código de área es un dato de cada negocio, se configura en Configuración).
- Pantalla **Avisar a deudores**: elegir a quiénes, y recorrerlos uno por uno (abrir WhatsApp → confirmar si se envió → siguiente). Queda registrado a quién se avisó.
- "Marcar aviso enviado" desde la ficha, y "Último aviso" visible en la lista y en la ficha.

**Catálogo de productos**
- Productos por negocio: nombre, categoría, precio de referencia, código de barras opcional; activar/desactivar, buscador y filtro por categoría.
- Se muestra como panel fijo a la derecha (pantallas de 1500 px o más), como ventana emergente (PC más angosta) o como pantalla propia (celular). Las ventanas se sincronizan entre sí.
- Con una compra abierta, tocar un producto del catálogo lo suma a la compra.

**Importar y exportar (Excel)**
- Importar **productos** y **clientes** desde un `.xlsx` (ver 5.9 y 5.10): plantilla descargable, vista previa antes de guardar, sin duplicados.
- Importar clientes con **saldo inicial** y fecha aproximada de la deuda.
- Exportar la **lista de clientes** (tal como se está viendo, con filtros y orden) y la **ficha de un cliente** (historial con saldo acumulado y detalle de productos), con formato listo para imprimir.

**Configuración del negocio**
- Pantalla propia (menú del círculo con la inicial del negocio → Configuración).
- Nombre del negocio, **código de área** (para completar teléfonos cargados sin código), **alias o CBU** para cobrar y **mensaje del recordatorio editable** con las palabras `{cliente}`, `{saldo}`, `{negocio}` y `{pago}` (ver 5.26).
- Cambio de contraseña (pide la actual).
- En "Avisar a deudores" el mensaje de cada cliente se puede ajustar antes de abrir WhatsApp.

**Experiencia de uso**
- Avisos en pantalla (toasts) para todo resultado de una acción, con "Deshacer" en anular y archivar.
- Ventana de confirmación propia para acciones irreversibles.
- Menú "⋯ Más" para las acciones ocasionales.
- **Pantallas siempre actualizadas:** cualquier cambio (compra, pago, anulación, "Deshacer"...) recarga solas las pantallas abiertas, tanto en la misma pestaña como en otras pestañas o ventanas, y al volver a una pestaña que quedó en segundo plano (ver 5.19).
- Modo claro/oscuro con cambio instantáneo (sin retrasos de animación), uso desde computadora y celular (responsive), acceso por red local sin internet.

**Plataforma**
- Autenticación por usuario y contraseña, con sesión de 30 días.
- **Multi-negocio (multi-tenant):** varios comercios usan la misma aplicación, cada uno ve únicamente sus propios datos.

### 2.2 Explícitamente fuera de alcance (por ahora)

- Registro público de cuentas nuevas (hoy el alta de un negocio la hace el administrador por línea de comandos).
- Recuperación de contraseña por correo.
- Panel de administración de la plataforma.
- Roles o múltiples usuarios por negocio (hoy es un usuario = un negocio).
- Facturación electrónica o integración con AFIP/ARCA.
- Ventas de contado / caja diaria (el sistema asume que toda venta registrada es a cuenta corriente).
- Lectura de código de barras con cámara o pistola lectora (el campo y el endpoint de búsqueda existen, pero no hay interfaz de escaneo).
- Envío automático de notificaciones (el recordatorio por WhatsApp es asistido: lo envía la persona).
- Importar formatos distintos de `.xlsx` (por ejemplo `.xls` o `.csv`).
- Deshacer una importación desde la interfaz (decisión deliberada, ver sección 5).

## 3. Requerimientos

### 3.1 Requerimientos funcionales (resumen)

| # | Requerimiento |
|---|---|
| RF1 | Registrar, editar, archivar y restaurar clientes. |
| RF2 | Registrar una compra con uno o más productos en una sola operación, o como monto único. |
| RF3 | Calcular el saldo de cada cliente como compras activas menos pagos activos. |
| RF4 | Anular un movimiento sin eliminarlo, y restaurarlo si fue anulado por error. |
| RF5 | Eliminar definitivamente solo movimientos que ya estén anulados. |
| RF6 | Impedir que un negocio acceda a los datos de otro negocio. |
| RF7 | Operar desde computadora y celular sin pérdida de funcionalidad. |
| RF8 | Mantener un catálogo de productos propio por negocio, reutilizable al cargar compras. |
| RF9 | Informar en pantalla el resultado de cada acción del usuario (éxito o error), sin diálogos del navegador. |
| RF10 | Importar productos y clientes desde Excel, mostrando antes un resumen de lo que se va a guardar y sin duplicar lo existente. |
| RF11 | Permitir cargar el saldo que cada cliente ya debe al migrar desde otro sistema o un cuaderno. |
| RF12 | Exportar a Excel la lista de clientes y el detalle de un cliente. |
| RF13 | Identificar clientes atrasados y registrar los avisos de cobranza enviados. |
| RF14 | Rechazar fechas inverosímiles (futuras o de más de 10 años de antigüedad) en compras, pagos e importaciones. |
| RF15 | Mantener sincronizadas las pantallas abiertas (misma pestaña u otras) cuando cambian los datos, sin tener que refrescar. |
| RF16 | Permitir seleccionar todos los elementos visibles en toda pantalla con selección múltiple. |
| RF17 | Permitir a cada negocio configurar su código de área, sus datos de pago y el texto del recordatorio, y cambiar su contraseña. |
| RF18 | No marcar como atrasado a un cliente que pagó su deuda anterior y solo tiene una compra reciente. |

### 3.2 Requerimientos no funcionales

- **Seguridad:** contraseñas nunca almacenadas en texto plano (hash con bcrypt); sesión mediante JWT; toda ruta de datos exige autenticación y filtra por negocio.
- **Aislamiento de datos:** modelo multi-tenant a nivel de base de datos (columna `negocio_id` en cada tabla relevante), no solo a nivel de interfaz.
- **Usabilidad:** cualquier acción irreversible exige confirmación explícita; las acciones reversibles (anular, archivar) se prefieren sobre el borrado directo y ofrecen "Deshacer".
- **Consistencia de interfaz:** patrones repetidos en toda la aplicación (selección múltiple, botones de formulario, avisos, confirmaciones, navegación "atrás" respetando el origen real de la navegación).
- **Rendimiento:** la librería de Excel (`exceljs`, pesada) se carga solo cuando el usuario importa o exporta; los avisos usan animaciones CSS livianas, sin librerías.
- **Límites de importación:** hasta 5.000 productos o 2.000 clientes por archivo, 10 MB; el servidor acepta cuerpos de hasta 5 MB.
- **Portabilidad de rubro:** ninguna lógica de negocio debe asumir un rubro específico; lo único orientado a un rubro es contenido de referencia (catálogo de ejemplo), nunca código.
- **Disponibilidad (etapa actual):** uso en red local, sin garantía de disponibilidad 24/7. Pasar a hosting con disponibilidad continua y backup automático es un requisito pendiente antes de la venta a terceros (ver sección 6).

## 4. Arquitectura

### 4.1 Stack tecnológico (PERN)

- **Frontend:** React 19 (Vite) + Tailwind CSS 3 + React Router 7. Excel en el navegador con `exceljs`.
- **Backend:** Node.js + Express 5.
- **Base de datos:** PostgreSQL.
- **Autenticación:** JWT (jsonwebtoken) + bcryptjs.

### 4.2 Estructura del repositorio

```
kiosco-app/
├── frontend/                  React + Vite + Tailwind
│   └── src/
│       ├── main.jsx               Rutas y providers (Toast > Confirm > Router > Catálogo)
│       ├── App.jsx                Lista de clientes, resumen, filtros, acciones masivas
│       ├── Cliente.jsx            Ficha: saldo, compras, pagos, historial
│       ├── Login.jsx              Autenticación
│       ├── Layout.jsx             Panel lateral del catálogo (pantallas anchas)
│       ├── Catalogo.jsx           Catálogo como pantalla / ventana emergente
│       ├── CatalogoContenido.jsx  Contenido del catálogo (se reutiliza en las 3 vistas)
│       ├── CatalogoContext.jsx    Estado del catálogo y sincronización entre ventanas
│       ├── AvisarDeudores.jsx     Recordatorios por WhatsApp, uno por uno (mensaje editable)
│       ├── Configuracion.jsx      Datos del negocio, mensaje del recordatorio, contraseña
│       ├── LineaCobranza.jsx      "Sin pagar hace X días · Último aviso: ..."
│       ├── ImportarExcel.jsx      Ventana de importación (productos y clientes)
│       ├── MenuMas.jsx            Menú desplegable "⋯ Más"
│       ├── ToastContext.jsx       Avisos en pantalla + AvisoForm (validación en formularios)
│       ├── ConfirmContext.jsx     Ventana de confirmación propia
│       ├── ThemeToggle.jsx        Modo claro/oscuro
│       ├── api.js                 Cliente HTTP hacia el backend
│       ├── cobranza.js            Reglas de cobranza, teléfonos y WhatsApp
│       ├── excel.js               Lectura de Excel, plantillas y exportaciones
│       ├── teclado.js             Flechas ↑ ↓ entre campos de un formulario
│       ├── sync.js                Aviso de cambios entre pantallas y pestañas (recarga automática)
│       └── index.css              Tema (variables claro/oscuro) y estilo "libreta"
└── backend/
    └── src/
        ├── index.js               Entrada, registro de rutas, /api/resumen
        ├── db.js                  Conexión a PostgreSQL
        ├── auth.js                Middleware de autenticación (JWT)
        ├── fechas.js              Validación de fechas razonables
        ├── crear-negocio.js       Script: alta de negocio + usuario
        ├── cambiar-clave.js       Script: reseteo de contraseña
        ├── importar-productos.js  Script: precarga el catálogo de ejemplo de un negocio
        └── routes/
            ├── auth.js            Login
            ├── clientes.js        CRUD, archivado, historial, importación
            ├── ventas.js          Compras (con múltiples productos)
            ├── pagos.js           Pagos
            ├── productos.js       Catálogo e importación
            ├── avisos.js          Registro de avisos de cobranza
            └── negocio.js         Configuración del negocio y cambio de contraseña
```

### 4.3 Modelo de datos (resumen conceptual)

```
negocios ──< usuarios
negocios ──< clientes ──< ventas ──< venta_items
negocios ──< clientes ──< pagos
negocios ──< clientes ──< avisos
negocios ──< productos
```

Toda tabla de datos operativos (`clientes`, `ventas`, `pagos`, `avisos`, `productos`) tiene una columna `negocio_id`, y **toda consulta del backend filtra por el negocio del usuario autenticado**. Este es el mecanismo central de aislamiento multi-tenant. El detalle completo está en `schema.sql`. `negocios` guarda además la configuración propia de cada comercio: `codigo_area`, `datos_pago` y `mensaje_recordatorio`.

Las compras (`ventas`) y sus productos (`venta_items`) están separados para permitir múltiples productos por operación sin duplicar cabecera (fecha, cliente, total). La vista `saldos` calcula el saldo de cada cliente.

### 4.4 API (todas bajo `/api`, con `Authorization: Bearer <token>` salvo el login)

| Recurso | Endpoints |
|---|---|
| Auth | `POST /auth/login` |
| Clientes | `GET /clientes` (`?archivados=1`), `GET /clientes/:id`, `POST`, `PUT /:id`, `DELETE /:id` (solo archivados), `PATCH /:id/archivar`, `PATCH /:id/restaurar`, `GET /:id/movimientos`, `POST /clientes/importar` |
| Ventas | `POST /ventas`, `PUT /:id`, `PATCH /:id/anular`, `PATCH /:id/restaurar`, `DELETE /:id` (solo anuladas) |
| Pagos | `POST /pagos`, `PATCH /:id/anular`, `PATCH /:id/restaurar`, `DELETE /:id` (solo anulados) |
| Productos | `GET /productos` (`?activos=1`), `GET /productos/codigo/:codigo`, `POST`, `PUT /:id`, `PATCH /:id/activo`, `DELETE /:id`, `POST /productos/importar` |
| Avisos | `POST /avisos` (`recordatorio` o `cuenta`) |
| Negocio | `GET /negocio`, `PUT /negocio` (nombre, código de área, datos de pago, mensaje), `PATCH /negocio/clave` |
| Resumen | `GET /resumen` (deuda total, clientes con deuda, total; excluye archivados) |

`GET /clientes` y `GET /clientes/:id` incluyen, además de los datos del cliente y su saldo, `dias_sin_pagar`, `dias_ultimo_recordatorio` y `dias_ultima_cuenta`.

### 4.5 Arquitectura del frontend

- **Providers** (en `main.jsx`): `ToastProvider` → `ConfirmProvider` → `BrowserRouter`. Las rutas privadas agregan `CatalogoProvider`, que no se destruye al navegar entre pantallas.
- **Estado compartido** solo donde hace falta (catálogo, avisos, confirmaciones). El resto es estado local de cada pantalla.
- **Sincronización entre ventanas** del catálogo con `BroadcastChannel`.
- **Eventos de ventana:** `clientes-cambiaron` avisa a la lista que recargue (lo usa el "Deshacer" de un archivado hecho desde la ficha).
- **Sincronización de datos (`sync.js`):** `api.js` llama a `avisarCambio()` después de toda petición que modifica datos (POST, PUT, PATCH, DELETE, salvo `/api/productos`). Las pantallas `App.jsx` y `Cliente.jsx` se suscriben con `alCambiarDatos(cargar)` y se recargan solas. Ver 5.19.

## 5. Decisiones de diseño relevantes

Estas decisiones no son obvias leyendo solo el código, así que quedan documentadas explícitamente:

1. **Archivar en vez de eliminar (clientes):** eliminar borra el historial completo de forma irreversible. La acción por defecto es "archivar" (reversible); "eliminar" solo está disponible sobre clientes ya archivados, como segunda confirmación deliberada.
2. **Anular en vez de eliminar (movimientos):** mismo criterio. Anular saca el movimiento del saldo sin perder el registro; eliminar definitivamente solo es posible sobre movimientos ya anulados.
3. **Catálogo como texto libre en las ventas:** `venta_items.producto` guarda el nombre como texto, no como referencia al catálogo. Editar o eliminar un producto del catálogo nunca altera las compras históricas.
4. **Multi-tenant por columna, no por base separada:** esquema compartido con `negocio_id`; más simple de mantener y suficiente para decenas o cientos de negocios pequeños.
5. **Login con usuario, no email:** baja la fricción en comercios que no gestionan un correo propio.
6. **Navegación "atrás" con el historial real del navegador** (`navigate(-1)`), no con rutas fijas.
7. **Avisos propios, sin librerías:** toasts de ~100 líneas con animación CSS. Siempre en el mismo lugar (abajo, centrados, ancho máximo 380 px) para no chocar con el panel del catálogo en PC ni quedar lejos del pulgar en el celular. Detalle en la sección 8.
8. **Confirmaciones propias en lugar de `window.confirm`:** el diálogo del navegador se ve distinto en cada dispositivo y no respeta la estética. Se usa solo para lo irreversible o lo que cambia el resumen (archivar, eliminar, registrar aviso).
9. **"Deshacer" en vez de preguntar** al anular: es lo que más se repite durante el día y es totalmente reversible. Anular no pide confirmación; ofrece "Deshacer" durante 6 segundos.
10. **Importación en dos pasos con simulación en el servidor:** el navegador lee el Excel y envía JSON; con `probar: true` el servidor calcula qué haría (nuevos, ya existentes, repetidos) sin guardar nada. Así la vista previa es exacta y no se duplica la lógica en el cliente. No se suben archivos al servidor.
11. **Lectura de Excel en el navegador (`exceljs`, carga diferida):** evita procesar archivos de desconocidos en el servidor. En Vite se importa el bundle de navegador (`exceljs/dist/exceljs.min.js`); la resolución automática del paquete falla.
12. **Saldo inicial = una compra:** al importar un cliente con deuda previa se crea una compra llamada «Saldo inicial» (un único ítem, cantidad 1). No hay un campo especial: se ve en el historial, se edita y se anula como cualquier compra, y el saldo y la cobranza funcionan sin lógica extra. Lleva la fecha "Deuda desde" (o la de hoy) para que "días sin pagar" sea correcto desde el primer día.
13. **Duplicados en importaciones:** se omiten los productos con el mismo nombre (sin distinguir mayúsculas) y con código de barras repetido; los clientes con el mismo nombre, incluso archivados. Dos clientes distintos con igual nombre deben diferenciarse en el archivo.
14. **No hay "deshacer importación" en la interfaz:** la importación es poco frecuente, tiene vista previa y omite duplicados. Si hiciera falta, se corrige por SQL usando `creado_en`. Se reevalúa si varios comercios lo piden.
15. **Fechas razonables:** el servidor rechaza fechas futuras o de más de 10 años de antigüedad (`fechas.js`). Un año mal tipeado dejaba "334.036 días sin pagar" y arruinaba los atrasados.
16. **Acciones por frecuencia de uso:** lo de todos los días (Avisar, Seleccionar) queda a la vista; lo ocasional (importar, exportar, ver archivados) va en "⋯ Más".
17. **Ventanas modales con portal:** el panel del catálogo usa `transform`, que atrapa a los elementos `fixed` hijos. Los modales que se abren desde el panel (importación) se montan en `document.body`.
18. **Recordatorio por WhatsApp asistido:** WhatsApp no permite enviar solo desde una página web. El sistema arma el mensaje y abre el chat; la persona lo envía y confirma, y queda registrado.
19. **Sincronización automática de pantallas (`sync.js`):** cada pantalla tiene su propio estado y antes solo recargaba al montarse, así que un cambio hecho en otra pestaña, o un "Deshacer" tocado desde otra pantalla, no se veía hasta refrescar. Ahora `api.js` avisa cada modificación (así no hay que acordarse de avisar en cada acción) por dos vías: un evento de `window` para la misma pestaña y un `BroadcastChannel` (`cartera-datos`) para las demás. Las pantallas también recargan al volver a la pestaña (`visibilitychange` / `focus`). Los eventos se agrupan con 150 ms de espera para recargar una sola vez. Consecuencia aceptada: cada acción recarga además la pantalla actual con un GET extra. Los cambios del catálogo (`/api/productos`) quedan fuera porque ya se sincronizan con el `BroadcastChannel` propio de `CatalogoContext`.
20. **"Deshacer" al registrar una compra elimina, no anula:** deshacer una carga recién hecha debe dejar todo como estaba. Si solo anulara, cada error de tipeo dejaría una compra en "Ver anulados". Se hace con `anularVenta` + `eliminarVenta` (el servidor solo permite eliminar lo anulado).
21. **Cambio de tema sin transiciones:** casi todos los botones tienen `transition-colors` y los fondos no, así que al cambiar de tema los botones parecían "tardar". `ThemeToggle.jsx` agrega la clase `sin-transiciones` a `<html>` durante el cambio y la quita dos cuadros después, así todo cambia junto.
22. **"Seleccionar todos" respeta el filtro:** el botón Todos / Ninguno actúa solo sobre lo que se ve (cliente filtrados, movimientos filtrados por tipo y vista). Evita archivar, anular o eliminar elementos que el usuario no está viendo. Va dentro del grupo de botones de acción, a la izquierda del botón principal (Anular, Archivar o Restaurar), con `ml-auto` para quedar pegado a la derecha.

23. **"Días sin pagar" con criterio FIFO:** contar solo desde el último pago daba un falso positivo grave: quien pagó todo en enero y hoy compra $500 aparecía con 270 días, en rojo y listo para "Avisar". Ahora se toma el **menor** entre los días desde el último pago y los días desde la deuda más antigua sin cubrir (los pagos se aplican a las compras más viejas primero, con una función de ventana en `clientes.js`). Un cliente que sigue pagando algo, o que recién compró, no figura como atrasado; uno que nunca pagó sigue contando desde su primera compra.
24. **Configuración del negocio cacheada en `localStorage`:** los links de WhatsApp se arman de forma síncrona al dibujar la pantalla, y necesitan el código de área y el mensaje ya cargados. `Privada` (en `main.jsx`) llama a `cargarConfigNegocio()` antes de mostrar la app, y `api.js` guarda la copia en `negocio_config` (se borra al cerrar sesión). Si no hay conexión se usa la última copia. La alternativa, volver asíncronas todas las pantallas que arman links, no justificaba la complejidad.
25. **Contraseña actual incorrecta responde 400, no 401:** el frontend interpreta cualquier 401 como "sesión vencida" y cierra la sesión. Un error de tipeo al cambiar la contraseña no debe sacar al usuario de la app.
26. **Mensaje del recordatorio como plantilla simple:** texto libre con cuatro palabras entre llaves (`{cliente}`, `{saldo}`, `{negocio}`, `{pago}`, sin distinguir mayúsculas). Si el negocio no cargó alias, la línea que contiene `{pago}` no se envía. Si el campo se guarda vacío se usa `PLANTILLA_POR_DEFECTO` (en `cobranza.js`), así los cambios del mensaje base llegan a quien no lo personalizó. Se descartó un editor con botones y vista previa por ser más engorroso que útil. Los clientes al día reciben siempre un mensaje fijo ("tu cuenta está al día"). El punto final del mensaje base va separado del alias (`{pago} .`) para que al copiar el alias no se copie el punto.
27. **Código de área vacío por defecto en negocios nuevos:** antes estaba fijo en `342` (la zona del primer cliente). Asumirlo en otro comercio abriría el WhatsApp de otra persona; es preferible que un teléfono sin código figure como "Sin teléfono válido". La normalización en `cobranza.js` funciona con áreas de 2, 3 o 4 dígitos (un número argentino son 10 dígitos entre área y local).
28. **Índices sobre las claves foráneas:** PostgreSQL no las indexa solo. Se agregaron `ventas(cliente_id, fecha)`, `pagos(cliente_id, fecha)`, `venta_items(venta_id)` y `clientes(negocio_id, archivado)`, porque la lista de clientes hace varias subconsultas por fila.
29. **Tres estados distintos para la lista de clientes:** antes un solo texto ("No hay clientes para mostrar") cubría tres situaciones distintas y confundía. Ahora `App.jsx` distingue: (a) `cargando`: tres tarjetas grises con la forma de la lista real (`animate-pulse`), solo en la primera carga y al cambiar entre activos y archivados; las recargas automáticas de `sync.js` no lo disparan, así que no parpadea. (b) Negocio sin clientes: guía con "Agregar cliente" e "Importar desde Excel", solo si no hay ningún cliente cargado y no hubo error (si falla la carga se ve la caja roja, no la guía). En archivados vacíos se muestra un texto simple. (c) Filtros o búsqueda sin resultados: mensaje corto con "Limpiar filtros". No toca backend ni base de datos. El mismo criterio se aplica en otras dos pantallas: los archivados vacíos muestran una tarjeta que explica para qué sirve la pantalla, y el historial de un cliente distingue tres casos (cliente sin movimientos: guía para registrar el primero; filtro por tipo sin resultados: "Limpiar filtros", que solo resetea el tipo y no el orden; anulados vacío: texto simple, porque esa vista casi nunca se ve vacía).
30. **Zona horaria fija y negocios desactivables:** (a) `db.js` ejecuta `SET TIME ZONE 'America/Argentina/Buenos_Aires'` en cada conexión nueva del pool, así `CURRENT_DATE` (fecha por defecto de compras y pagos, y "días sin pagar") no depende de la zona del servidor; en un hosting suele ser UTC y de noche las fechas quedarían corridas un día. (b) `negocios.activo = FALSE` bloquea la cuenta: el login responde 403 con "Esta cuenta está desactivada" (se chequea después de la contraseña, para no revelar si el usuario existe) y `requiereAuth` consulta `activo` en cada pedido, así también queda afuera quien ya tenía la sesión abierta (responde 401 "Cuenta desactivada"). Costo aceptado: una consulta por clave primaria en cada pedido. Limitación conocida: el frontend trata todo 401 como sesión vencida, así que quien estaba logueado ve "Tu sesión expiró" y no el mensaje de cuenta desactivada hasta que intente entrar de nuevo. Para suspender o reactivar: `UPDATE negocios SET activo = FALSE WHERE id = X;` (o `TRUE`).
31. **Redondeo a 2 decimales, aviso de pago excedido y montos con centavos:** (a) `ventas.js` usa un helper `redondear` para cada subtotal y para el total (que pasa a ser la suma de los subtotales ya redondeados), así la suma de los ítems siempre coincide con el total y se evitan errores de coma flotante como `0.1 * 3 = 0.30000000000000004`. (b) Al registrar un pago mayor al saldo (o a un cliente sin deuda), `confirmarPago` en `Cliente.jsx` pide confirmación con el texto "El pago supera la deuda" y el monto que quedaría a favor del cliente. Se eligió confirmar y no bloquear, porque el pago adelantado es un caso válido; el botón no es rojo porque el pago se puede anular. Si se cancela, vuelve al formulario con lo escrito. El backend no redondea pagos porque `monto` ya es `NUMERIC(12,2)`. (c) `dinero()` en `api.js` muestra decimales solo cuando el monto los tiene (`minimumFractionDigits: 0`, `maximumFractionDigits: 2`): `$ 55.472` sigue igual y `$ 3,33` ya no se ve como `$ 3`. Las exportaciones a Excel usan su propio formato y no cambian.

## 6. Estado actual y pendientes conocidos

### 6.1 Pendiente de corto plazo
- Estados vacíos y de carga (la lista dice "No hay clientes" mientras carga; un negocio nuevo no ve guía).
- "Enviar cuenta" por WhatsApp (saldo y últimos movimientos; el tipo `cuenta` de avisos ya existe).
- Rotar credenciales (contraseña de PostgreSQL y `JWT_SECRET`) antes de publicar.
- Límite de intentos en el login, `helmet` y CORS restringido al publicar.
- Manual de usuario para comercios (lenguaje no técnico).
- Hosting con disponibilidad continua + backup automático de la base de datos.
- Estados vacíos y de carga (la lista dice "No hay clientes" mientras carga; un negocio nuevo no ve guía).


### 6.2 Pendiente antes de vender a terceros
- Alta de cuenta autoservicio (sin depender de scripts de línea de comandos).
- Recuperación de contraseña.
- Hosting y backups (ver 6.1).
- Definición de modelo de cobro (suscripción, licencia única, etc.) — decisión de negocio, no técnica.
- Plantilla `.env.example` para facilitar la instalación.

### 6.3 Pendiente de mediano plazo
- Panel de administración de la plataforma.
- Roles y múltiples usuarios por negocio.
- Lectura de código de barras (campo y endpoint ya existen; falta la interfaz).
- Paginación o carga progresiva si un negocio llega a miles de clientes (hoy se cargan todos).
- Evaluar "Deshacer importación" desde la interfaz (ver decisión 14).

### 6.4 Limpieza técnica
- `backend/src/routes/movimientos.js` es código sin uso (apunta a la tabla `movimientos`, ya eliminada y no registrada en `index.js`): puede borrarse.
- `frontend/src/abrirCatalogo.js` fue reemplazado por `CatalogoContext.jsx`: puede borrarse si todavía existe.

## 7. Cómo correr el proyecto en desarrollo

```powershell
# Backend
cd backend
npm install
npm run dev        # http://localhost:3000

# Frontend (en otra terminal)
cd frontend
npm install        # incluye exceljs
npm run dev        # http://localhost:5173
```

Requiere PostgreSQL corriendo localmente con la base `kiosco_db` creada (ejecutar `schema.sql`) y un archivo `backend/.env` con las variables de conexión y `JWT_SECRET`.

Para dar de alta el primer negocio:
```powershell
node src/crear-negocio.js "Nombre del negocio" usuario contraseña telefono rubro direccion
```

Para precargar el catálogo de ejemplo en un negocio (requiere `exceljs` en el backend: `npm install exceljs`):
```powershell
node src/importar-productos.js ruta\catalogo_productos_extenso.xlsx usuario --probar   # solo simula
node src/importar-productos.js ruta\catalogo_productos_extenso.xlsx usuario            # importa
```

Si se instala una dependencia nueva en el frontend, reiniciar Vite (`Ctrl + C` y `npm run dev`).

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
- Filas compactas: dos líneas como máximo por elemento (título + detalle), monto alineado a la derecha.

**Avisos y confirmaciones**
- Nunca `window.alert` ni `window.confirm`. Usar `useToast()` y `useConfirmar()`.
- Resultado de una acción: `toast.ok` (verde, 3 s), `toast.error` (rojo, 6 s, con ×), `toast.info` (gris, 4,5 s). Máximo 3 a la vez; los iguales no se apilan.
- Acciones reversibles (anular, archivar, registrar una compra): `toast.deshacer(texto, funcionQueRevierte)`, 6 s.
- Validación de un formulario ("Ingresá un monto mayor a 0"): `AvisoForm` dentro del propio formulario, no un toast.
- Fallo de carga de una pantalla entera: caja roja fija arriba (no desaparece sola).
- Confirmación (`useConfirmar`): para lo irreversible (botón rojo, `peligro: true`, el foco inicia en "Cancelar") y para lo que cambia el resumen (archivar). Los textos dicen qué pasa y si se puede deshacer.
- Los avisos se muestran siempre abajo y centrados; no se reubican por pantalla.

**Temas**
- El cambio claro/oscuro desactiva las transiciones un instante (clase `sin-transiciones`) para que nada se anime por separado. Nuevos selectores con `transition` no requieren cambios: la clase los cubre a todos.

**Selección múltiple**
- Toda pantalla con selección múltiple lleva un botón **Todos / Ninguno** que actúa solo sobre lo visible. Va en la barra fija de selección, junto a los botones de acción (a su izquierda, pegado a la derecha de la barra). La barra usa `flex-wrap` para no cortarse a 360 px.

**Acciones por frecuencia**
- Las acciones de uso diario quedan visibles; las ocasionales van en el menú "⋯ Más". Evitar más de 2 o 3 botones secundarios en una misma fila.

**Fechas y montos**
- Fechas visibles como `dd/mm/aaaa`; internamente `AAAA-MM-DD`. Montos en pesos (`es-AR`), sin decimales salvo que el monto tenga centavos.
- Las fechas de compras, pagos e importaciones se validan en el servidor (`fechas.js`).

**Excel**
- Plantillas con columnas ya formateadas (fecha, monto, texto), ayuda en cada celda y hoja "Léame".
- Exportaciones con encabezado verde, líneas finas entre filas, total destacado y configuradas para imprimir en A4.
