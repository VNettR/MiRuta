-- =====================================================================
--  SISTEMA DE TRANSPORTES - Esquema MySQL
--  Perfil de usuario, autenticación, rutas de bus, suscripciones,
--  pasarela de pago y registro de viajes con descuento.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS transportes
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE transportes;

-- ---------------------------------------------------------------------
-- 1. PERFIL DEL USUARIO (datos principales)
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
    id_usuario        INT AUTO_INCREMENT PRIMARY KEY,
    nombres           VARCHAR(80)  NOT NULL,
    apellidos         VARCHAR(80)  NOT NULL,
    documento         VARCHAR(30)  UNIQUE,            -- cédula / DNI
    telefono          VARCHAR(20),
    fecha_nacimiento  DATE,
    fecha_registro    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activo            BOOLEAN      NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. AUTENTICACIÓN (usuario + correo, separada del perfil)
--    Relación 1:1 con usuario.
-- ---------------------------------------------------------------------
CREATE TABLE autenticacion (
    id_auth           INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario        INT NOT NULL UNIQUE,
    correo            VARCHAR(120) NOT NULL UNIQUE,
    nombre_usuario    VARCHAR(50)  NOT NULL UNIQUE,
    contrasena_hash   VARCHAR(255) NOT NULL,          -- guarda SIEMPRE el hash, nunca texto plano
    ultimo_acceso     DATETIME,
    creado_en         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auth_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. RUTAS DE BUS
--    nombre, número, precio de pasaje, hora y recorrido (origen/destino).
-- ---------------------------------------------------------------------
CREATE TABLE ruta_bus (
    id_ruta           INT AUTO_INCREMENT PRIMARY KEY,
    nombre            VARCHAR(100) NOT NULL,
    numero            VARCHAR(20)  NOT NULL UNIQUE,    -- ej: "B-12"
    precio_pasaje     DECIMAL(10,2) NOT NULL,          -- DECIMAL para dinero, nunca FLOAT
    hora_salida       TIME         NOT NULL,
    origen            VARCHAR(120) NOT NULL,
    destino           VARCHAR(120) NOT NULL,
    descripcion_ruta  VARCHAR(255),                    -- recorrido / paradas
    activo            BOOLEAN      NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. TIPOS / PLANES DE SUSCRIPCIÓN
--    Define el descuento que aplica cada plan.
-- ---------------------------------------------------------------------
CREATE TABLE tipo_suscripcion (
    id_tipo           INT AUTO_INCREMENT PRIMARY KEY,
    nombre            VARCHAR(50)  NOT NULL UNIQUE,    -- ej: "Premium"
    descuento_pct     DECIMAL(5,2) NOT NULL DEFAULT 0, -- 0.00 a 100.00
    precio_mensual    DECIMAL(10,2) NOT NULL,
    duracion_dias     INT          NOT NULL DEFAULT 30,
    descripcion       VARCHAR(255),
    activo            BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_descuento CHECK (descuento_pct >= 0 AND descuento_pct <= 100)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. SUSCRIPCIÓN DEL USUARIO
--    Un usuario puede tener varias en el tiempo; solo una "activa".
-- ---------------------------------------------------------------------
CREATE TABLE suscripcion (
    id_suscripcion    INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario        INT NOT NULL,
    id_tipo           INT NOT NULL,
    fecha_inicio      DATE NOT NULL,
    fecha_fin         DATE NOT NULL,
    estado            ENUM('activa','vencida','cancelada') NOT NULL DEFAULT 'activa',
    creado_en         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sus_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_sus_tipo    FOREIGN KEY (id_tipo)    REFERENCES tipo_suscripcion(id_tipo),
    INDEX idx_sus_usuario (id_usuario, estado)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. PAGO / PASARELA DE PAGO
--    Registra TODA transacción de dinero, sea de suscripción o de pasaje.
--    Aquí guardas la referencia que devuelve la pasarela (Stripe, PayU,
--    MercadoPago, etc.). La pasarela real vive fuera de la DB; esta tabla
--    es el "registro contable" de lo que ocurrió.
-- ---------------------------------------------------------------------
CREATE TABLE pago (
    id_pago           INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario        INT NOT NULL,
    concepto          ENUM('suscripcion','pasaje') NOT NULL,
    monto             DECIMAL(10,2) NOT NULL,
    proveedor         VARCHAR(40),                     -- ej: "Stripe", "PayU"
    referencia_externa VARCHAR(120),                   -- id de transacción de la pasarela
    metodo            ENUM('tarjeta','pse','nequi','efectivo','otro') DEFAULT 'tarjeta',
    estado            ENUM('pendiente','completado','fallido','reembolsado')
                          NOT NULL DEFAULT 'pendiente',
    creado_en         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pago_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    INDEX idx_pago_usuario (id_usuario),
    INDEX idx_pago_ref (referencia_externa)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. VIAJE (el usuario toma un bus)
--    Guarda el precio base, el descuento aplicado y el precio final,
--    y enlaza con el pago que lo respalda.
-- ---------------------------------------------------------------------
CREATE TABLE viaje (
    id_viaje          INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario        INT NOT NULL,
    id_ruta           INT NOT NULL,
    id_pago           INT,                             -- NULL hasta que el pago se confirme
    precio_base       DECIMAL(10,2) NOT NULL,
    descuento_pct     DECIMAL(5,2)  NOT NULL DEFAULT 0,
    precio_final      DECIMAL(10,2) NOT NULL,
    fecha_viaje       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_viaje_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),
    CONSTRAINT fk_viaje_ruta    FOREIGN KEY (id_ruta)    REFERENCES ruta_bus(id_ruta),
    CONSTRAINT fk_viaje_pago    FOREIGN KEY (id_pago)    REFERENCES pago(id_pago),
    INDEX idx_viaje_usuario (id_usuario),
    INDEX idx_viaje_fecha (fecha_viaje)
) ENGINE=InnoDB;

-- =====================================================================
--  LÓGICA DE DESCUENTO
--  Procedimiento que registra un viaje calculando automáticamente si el
--  usuario tiene suscripción activa y aplicando el descuento del plan.
-- =====================================================================
DELIMITER //

CREATE PROCEDURE registrar_viaje (
    IN  p_id_usuario INT,
    IN  p_id_ruta    INT,
    OUT p_id_viaje   INT
)
BEGIN
    DECLARE v_precio_base   DECIMAL(10,2);
    DECLARE v_descuento_pct DECIMAL(5,2) DEFAULT 0;
    DECLARE v_precio_final  DECIMAL(10,2);

    -- precio del pasaje de la ruta
    SELECT precio_pasaje INTO v_precio_base
    FROM ruta_bus WHERE id_ruta = p_id_ruta;

    -- ¿el usuario tiene suscripción activa y vigente?
    SELECT ts.descuento_pct INTO v_descuento_pct
    FROM suscripcion s
    JOIN tipo_suscripcion ts ON ts.id_tipo = s.id_tipo
    WHERE s.id_usuario = p_id_usuario
      AND s.estado = 'activa'
      AND CURDATE() BETWEEN s.fecha_inicio AND s.fecha_fin
    ORDER BY ts.descuento_pct DESC
    LIMIT 1;

    SET v_precio_final = v_precio_base - (v_precio_base * v_descuento_pct / 100);

    INSERT INTO viaje (id_usuario, id_ruta, precio_base, descuento_pct, precio_final)
    VALUES (p_id_usuario, p_id_ruta, v_precio_base, v_descuento_pct, v_precio_final);

    SET p_id_viaje = LAST_INSERT_ID();
END //

DELIMITER ;

-- =====================================================================
--  DATOS DE EJEMPLO (opcional)
-- =====================================================================
INSERT INTO tipo_suscripcion (nombre, descuento_pct, precio_mensual, descripcion) VALUES
    ('Básico',  10.00,  15000, 'Descuento del 10% en pasajes'),
    ('Premium', 25.00,  30000, 'Descuento del 25% en pasajes');

INSERT INTO ruta_bus (nombre, numero, precio_pasaje, hora_salida, origen, destino) VALUES
    ('Centro - Norte', 'B-12', 2800.00, '06:30:00', 'Terminal Centro', 'Portal Norte'),
    ('Sur - Universidad', 'B-07', 3000.00, '07:00:00', 'Portal Sur', 'Ciudad Universitaria');

-- Ejemplo de uso del procedimiento:
-- CALL registrar_viaje(1, 1, @nuevo_viaje);
-- SELECT @nuevo_viaje;