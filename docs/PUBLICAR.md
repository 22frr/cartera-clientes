# Publicar FIADO$ gratis para el CV

La configuración usa un servicio web Free de Render para React y Express, y una
base Free de Neon para PostgreSQL. No requiere comprar un dominio.

Demo publicada: <https://fiados-demo.onrender.com>.
El 27/11/2026 se verificaron el login, los cuatro clientes iniciales y la creación
de un cliente ficticio adicional con una compra de $5.000 y un pago de $2.000.
Después de recargar su ficha, se conservaron ambos movimientos y el saldo de $3.000.
Los datos son compartidos: los totales actuales pueden cambiar con las pruebas.

## 1. Crear las cuentas

1. Entrar en <https://neon.com> y crear una cuenta, por ejemplo con GitHub.
2. Crear un proyecto `fiados-demo` con el plan **Free** y una base vacía.
3. En **Connect**, copiar la conexión PostgreSQL, con `sslmode=require`.
   Es una credencial privada: ingresarla solo en Render, nunca en el repositorio
   ni en capturas o mensajes públicos.
4. Entrar en <https://render.com> y crear una cuenta. Vincular GitHub para que
   Render pueda leer el repositorio `22frr/cartera-clientes`.

Usar una base exclusiva para la demo. No conectar la base de un comercio real.

## 2. Subir la configuración y desplegar

Los cambios de esta preparación deben estar subidos a la rama elegida del
repositorio antes de crear el servicio.

1. En Render, elegir **New > Blueprint** y seleccionar el repositorio.
2. Seleccionar la rama que contiene `render.yaml`.
3. Comprobar que el servicio `fiados-demo` tenga el plan **Free**.
4. Completar `DATABASE_URL` con la conexión de Neon.
5. Crear el Blueprint y esperar el primer despliegue. `JWT_SECRET` se genera
   automáticamente. No crear una base PostgreSQL adicional en Render.

El build instala las dependencias y compila React. Express sirve el frontend
y `/api` en una sola URL. En el primer inicio, `DEMO_MODE=true` crea las tablas
y los ejemplos dentro de una transacción. En siguientes inicios no duplica ni
restablece los datos. El chequeo `/api/health` comprueba la conexión a PostgreSQL.

Si se crea el Web Service manualmente, usar la raíz del repositorio, runtime
Node, plan Free, build `npm run setup && npm run build`, start `npm start`,
health check `/api/health` y las variables declaradas en `render.yaml`.
En ese caso, generar también un `JWT_SECRET` privado y aleatorio.

## 3. Probar el enlace

1. Abrir la URL HTTPS que indique Render.
2. Pulsar **Completar acceso de prueba** e **Ingresar**.
3. Verificar los cuatro clientes ficticios y un total adeudado de $27.000.
4. Crear otro cliente ficticio, registrar una compra de $5.000 y un pago de
   $2.000; comprobar un saldo de $3.000 después de recargar su ficha.
5. Revisar la vista móvil y abrir el enlace en una ventana privada.

Acceso público de la demo: usuario `demo`, contraseña `FiadosDemo2026`.
Estas credenciales son intencionalmente públicas y no deben reutilizarse.
Los visitantes comparten la cuenta y sus cambios quedan guardados. La demo
permite editar datos: no ingresar información real ni teléfonos personales.
No hay reinicio automático de los ejemplos; revisar la demo antes de entrevistas.
La opción `VITE_DEMO_MODE` se aplica durante el build; `DEMO_MODE`, en el servidor.

## 4. Incluirlo en el CV

Reemplazar los marcadores por el enlace real y el repositorio accesible:

> **FIADO$ — Aplicación full stack de cuentas corrientes para comercios.**
> React, Node.js, Express y PostgreSQL. API REST con autenticación JWT,
> aislamiento de datos por negocio, registro de compras y pagos,
> importación/exportación de Excel e interfaz responsive.
> Demo: https://fiados-demo.onrender.com · Código: https://github.com/22frr/cartera-clientes

El README incluye el enlace a la demo pública.
Si el repositorio es privado, los reclutadores no podrán consultar su código
sin acceso; el enlace de la demo puede compartirse de todos modos.

## Límites del alojamiento gratuito

Render suspende el servicio tras 15 minutos sin tráfico. La primera visita
posterior puede tardar alrededor de un minuto en responder. Cada plan tiene
cuotas de uso: mantener ambos servicios en Free. Neon ofrece una base Free
sin vencimiento temporal, sujeta a sus límites. La base PostgreSQL gratuita
de Render vence a los 30 días, por eso esta configuración usa Neon.

Referencias oficiales: <https://render.com/docs/free>,
<https://render.com/docs/blueprint-spec> y <https://neon.com/pricing>.
