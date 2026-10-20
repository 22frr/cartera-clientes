-- ============================================================
-- Schema consolidado - Cartera de clientes (PERN)
-- Base de datos: kiosco_db (PostgreSQL)
-- Refleja el estado actual del proyecto al 20/10/2026.
-- Ejecutar sobre una base vacia. Es el resultado final de todas
-- las migraciones aplicadas durante el desarrollo (no es un
-- historial de ALTER TABLE, es la foto final).
-- ============================================================

-- ------------------------------------------------------------
-- NEGOCIOS
-- Cada comercio que usa el sistema (multi-tenant).
-- ------------------------------------------------------------
CREATE TABLE negocios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  telefono VARCHAR(30),
  rubro VARCHAR(80),
  direccion VARCHAR(150),
  codigo_area VARCHAR(5),             -- para completar teléfonos y armar links de WhatsApp (ej. 342, 11)
  datos_pago VARCHAR(200),            -- alias/CBU, se usa en la palabra {pago} del recordatorio
  mensaje_recordatorio VARCHAR(600),  -- plantilla del recordatorio; NULL = mensaje por defecto
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- USUARIOS
-- Login por usuario + contraseña (no email). Hoy: 1 usuario = 1 negocio.
-- ------------------------------------------------------------
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  negocio_id INT NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  usuario VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- CLIENTES
-- Clientes de cuenta corriente de cada negocio.
-- archivado = TRUE => oculto de la lista normal y del resumen,
-- pero conserva todo su historial y se puede restaurar.
-- ------------------------------------------------------------
CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  negocio_id INT NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  telefono VARCHAR(30),
  direccion VARCHAR(150),
  notas TEXT,
  archivado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- VENTAS (compras)
-- Una venta = una operacion de compra, con uno o mas productos
-- (ver venta_items). anulado = TRUE => no cuenta en el saldo,
-- pero queda en el historial y se puede restaurar.
-- ------------------------------------------------------------
CREATE TABLE ventas (
  id SERIAL PRIMARY KEY,
  negocio_id INT NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  total NUMERIC(12,2) NOT NULL,
  observacion TEXT,
  anulado BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- VENTA_ITEMS
-- Productos de cada venta. "producto" es TEXTO LIBRE a proposito:
-- no es FK al catalogo, para que editar/eliminar un producto del
-- catalogo nunca altere el historial de ventas ya registradas.
-- ------------------------------------------------------------
CREATE TABLE venta_items (
  id SERIAL PRIMARY KEY,
  venta_id INT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto VARCHAR(150) NOT NULL,
  cantidad NUMERIC(10,2) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL
);

-- ------------------------------------------------------------
-- PAGOS
-- anulado = TRUE => no cuenta en el saldo, pero queda en el
-- historial y se puede restaurar.
-- ------------------------------------------------------------
CREATE TABLE pagos (
  id SERIAL PRIMARY KEY,
  negocio_id INT NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  monto NUMERIC(12,2) NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  observacion TEXT,
  anulado BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- PRODUCTOS (catalogo)
-- Catalogo propio de cada negocio. codigo_barras es opcional;
-- el indice unico condicional permite muchos productos sin
-- codigo, pero no permite repetir un mismo codigo dentro del
-- mismo negocio. Pensado para una futura pistola lectora
-- (no implementada todavia, solo modelado).
-- ------------------------------------------------------------
CREATE TABLE productos (
  id SERIAL PRIMARY KEY,
  negocio_id INT NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  categoria VARCHAR(80),
  nombre VARCHAR(150) NOT NULL,
  precio NUMERIC(12,2),
  codigo_barras VARCHAR(50),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- AVISOS (cobranza)
-- Registro de cada recordatorio / cuenta que se le envio a un cliente.
-- tipo: 'recordatorio' | 'cuenta'. "saldo" es lo que debia en ese momento.
-- Se usa para mostrar "Ultimo aviso: hace X dias" y a quien ya se aviso.
-- ------------------------------------------------------------
CREATE TABLE avisos (
  id SERIAL PRIMARY KEY,
  negocio_id INT NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  cliente_id INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('recordatorio', 'cuenta')),
  saldo NUMERIC(12,2),
  creado_en TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- INDICES
-- ------------------------------------------------------------
CREATE INDEX idx_productos_negocio ON productos(negocio_id);

CREATE INDEX idx_avisos_cliente ON avisos(cliente_id, tipo, creado_en);

CREATE INDEX idx_ventas_cliente    ON ventas(cliente_id, fecha);
CREATE INDEX idx_pagos_cliente     ON pagos(cliente_id, fecha);
CREATE INDEX idx_venta_items_venta ON venta_items(venta_id);
CREATE INDEX idx_clientes_negocio  ON clientes(negocio_id, archivado);

CREATE UNIQUE INDEX idx_productos_codigo_barras
  ON productos(negocio_id, codigo_barras)
  WHERE codigo_barras IS NOT NULL;

-- ------------------------------------------------------------
-- VISTA: SALDOS
-- Saldo de cada cliente = ventas activas - pagos activos.
-- Se usa para listar clientes con su deuda y para /api/resumen
-- (que ademas filtra por NOT archivado).
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW saldos AS
SELECT
  c.id,
  c.negocio_id,
  c.nombre,
  COALESCE((SELECT SUM(total) FROM ventas WHERE cliente_id = c.id AND NOT anulado), 0)
  - COALESCE((SELECT SUM(monto) FROM pagos WHERE cliente_id = c.id AND NOT anulado), 0)
  AS saldo,
  c.archivado
FROM clientes c;

-- ============================================================
-- Fin del schema.
-- Para dar de alta el primer negocio, usar el script de Node:
--   node backend/src/crear-negocio.js "Nombre" usuario clave telefono rubro direccion
-- (genera el hash de la contraseña con bcrypt; no insertar
-- usuarios a mano por SQL).
-- ============================================================
