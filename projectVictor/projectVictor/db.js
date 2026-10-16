// =====================================================================
//  db.js — Capa de "base de datos" sobre localStorage
//  Refleja el schema MySQL de db/schema.sql usando colecciones en JSON.
//  No hay backend: todo vive en el navegador. Aquí está el CRUD basico,
//  los IDs autoincrementales y los datos semilla (planes + rutas).
// =====================================================================

(function () {
    "use strict";

    // Clave raíz donde guardamos TODA la "base de datos" en localStorage.
    var STORAGE_KEY = "miruta_db";

    // -----------------------------------------------------------------
    // Estructura inicial vacía (espejo de las tablas del schema).
    // -----------------------------------------------------------------
    function estructuraVacia() {
        return {
            usuario: [],
            autenticacion: [],
            ruta_bus: [],
            tipo_suscripcion: [],
            suscripcion: [],
            pago: [],
            viaje: [],
            // contador para simular AUTO_INCREMENT por tabla
            _secuencias: {}
        };
    }

    // -----------------------------------------------------------------
    // Leer / guardar el objeto completo desde localStorage.
    // -----------------------------------------------------------------
    function leer() {
        var crudo = localStorage.getItem(STORAGE_KEY);
        if (!crudo) {
            return estructuraVacia();
        }
        try {
            return JSON.parse(crudo);
        } catch (e) {
            // Si el JSON está corrupto, reiniciamos para no romper la app.
            console.warn("DB corrupta, reiniciando.", e);
            return estructuraVacia();
        }
    }

    function guardar(db) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }

    // -----------------------------------------------------------------
    // ID autoincremental por tabla (simula AUTO_INCREMENT de MySQL).
    // -----------------------------------------------------------------
    function siguienteId(db, tabla) {
        if (!db._secuencias[tabla]) {
            db._secuencias[tabla] = 0;
        }
        db._secuencias[tabla] += 1;
        return db._secuencias[tabla];
    }

    // -----------------------------------------------------------------
    // DATOS SEMILLA
    // -----------------------------------------------------------------

    // Los 2 planes del schema (Básico 10% / Premium 25%).
    function planesSemilla() {
        return [
            {
                nombre: "Básico",
                descuento_pct: 10,
                precio_mensual: 15000,
                duracion_dias: 30,
                descripcion: "Descuento del 10% en pasajes",
                activo: true
            },
            {
                nombre: "Premium",
                descuento_pct: 25,
                precio_mensual: 30000,
                duracion_dias: 30,
                descripcion: "Descuento del 25% en pasajes",
                activo: true
            }
        ];
    }

    // Las 7 rutas hardcodeadas que ya existían en app.js, ahora como datos.
    // tipo  = la clave usada por el mapa (mostrarRuta).
    // coordenadas = la polilínea que dibuja Leaflet.
    function rutasSemilla() {
        return [
            {
                tipo: "sobusa",
                nombre: "Sobusa 101",
                numero: "101",
                precio_pasaje: 2800,
                hora_salida: "05:00",
                origen: "Terminal Sobusa",
                destino: "Centro",
                frecuencia: "8 minutos",
                horario: "5:00 AM - 10:00 PM",
                color: "#ef4444",
                activo: true,
                coordenadas: [
                    [10.9980, -74.8040], [10.9975, -74.8010], [10.9960, -74.7980],
                    [10.9940, -74.7950], [10.9910, -74.7920], [10.9880, -74.7900],
                    [10.9850, -74.7870], [10.9820, -74.7840]
                ]
            },
            {
                tipo: "coolitoral",
                nombre: "Coolitoral C2",
                numero: "C2",
                precio_pasaje: 2900,
                hora_salida: "04:30",
                origen: "Coolitoral",
                destino: "Centro",
                frecuencia: "12 minutos",
                horario: "4:30 AM - 9:30 PM",
                color: "#3b82f6",
                activo: true,
                coordenadas: [
                    [10.9740, -74.8120], [10.9760, -74.8090], [10.9790, -74.8060],
                    [10.9820, -74.8030], [10.9860, -74.8000], [10.9900, -74.7970],
                    [10.9940, -74.7940]
                ]
            },
            {
                tipo: "transmetro",
                nombre: "Transmetro T1",
                numero: "T1",
                precio_pasaje: 3000,
                hora_salida: "05:00",
                origen: "Portal Sur",
                destino: "Portal Norte",
                frecuencia: "6 minutos",
                horario: "5:00 AM - 11:00 PM",
                color: "#22c55e",
                activo: true,
                coordenadas: [
                    [10.9700, -74.7920], [10.9720, -74.7900], [10.9750, -74.7880],
                    [10.9790, -74.7860], [10.9830, -74.7840], [10.9870, -74.7820],
                    [10.9910, -74.7800]
                ]
            },
            {
                tipo: "rapido",
                nombre: "Rápido Ochoa R7",
                numero: "R7",
                precio_pasaje: 3200,
                hora_salida: "04:00",
                origen: "Soledad",
                destino: "Centro",
                frecuencia: "15 minutos",
                horario: "4:00 AM - 11:30 PM",
                color: "#a855f7",
                activo: true,
                coordenadas: [
                    [10.9650, -74.8200], [10.9690, -74.8150], [10.9730, -74.8100],
                    [10.9780, -74.8050], [10.9830, -74.8000], [10.9880, -74.7950]
                ]
            },
            {
                tipo: "caribe",
                nombre: "Caribe Express",
                numero: "CE",
                precio_pasaje: 3100,
                hora_salida: "05:00",
                origen: "Barrio Abajo",
                destino: "Riomar",
                frecuencia: "11 minutos",
                horario: "5:00 AM - 9:00 PM",
                color: "#f97316",
                activo: true,
                coordenadas: [
                    [10.9900, -74.8200], [10.9920, -74.8150], [10.9940, -74.8100],
                    [10.9960, -74.8050], [10.9980, -74.8000]
                ]
            },
            {
                tipo: "metroplus",
                nombre: "MetroPlus M5",
                numero: "M5",
                precio_pasaje: 2700,
                hora_salida: "05:30",
                origen: "Sur",
                destino: "Centro",
                frecuencia: "7 minutos",
                horario: "5:30 AM - 10:30 PM",
                color: "#eab308",
                activo: true,
                coordenadas: [
                    [10.9500, -74.7900], [10.9550, -74.7880], [10.9600, -74.7860],
                    [10.9650, -74.7840], [10.9700, -74.7820]
                ]
            },
            {
                tipo: "urbano",
                nombre: "Urbano Norte",
                numero: "UN",
                precio_pasaje: 2600,
                hora_salida: "06:00",
                origen: "Norte",
                destino: "Centro",
                frecuencia: "18 minutos",
                horario: "6:00 AM - 8:00 PM",
                color: "#d1d5db",
                activo: true,
                coordenadas: [
                    [11.0000, -74.7900], [10.9970, -74.7870], [10.9940, -74.7840],
                    [10.9910, -74.7810], [10.9880, -74.7780]
                ]
            }
        ];
    }

    // -----------------------------------------------------------------
    // init(): crea la DB si no existe y siembra planes + rutas una sola vez.
    // -----------------------------------------------------------------
    function init() {
        var db = leer();

        // Sembrar planes si están vacíos.
        if (db.tipo_suscripcion.length === 0) {
            planesSemilla().forEach(function (plan) {
                plan.id_tipo = siguienteId(db, "tipo_suscripcion");
                db.tipo_suscripcion.push(plan);
            });
        }

        // Sembrar rutas si están vacías.
        if (db.ruta_bus.length === 0) {
            rutasSemilla().forEach(function (ruta) {
                ruta.id_ruta = siguienteId(db, "ruta_bus");
                db.ruta_bus.push(ruta);
            });
        }

        // Cuenta administrativa para la demostración académica.
        // Credenciales: admin@miruta.com / Admin123!
        var adminAuth = db.autenticacion.some(function (a) {
            return String(a.correo || "").toLowerCase() === "admin@miruta.com";
        });
        if (!adminAuth) {
            var admin = {
                id_usuario: siguienteId(db, "usuario"),
                nombres: "Administrador", apellidos: "MiRuta", documento: "", telefono: "",
                fecha_nacimiento: "", fecha_registro: new Date().toISOString(), activo: true, rol: "admin"
            };
            db.usuario.push(admin);
            db.autenticacion.push({
                id_auth: siguienteId(db, "autenticacion"), id_usuario: admin.id_usuario,
                correo: "admin@miruta.com", nombre_usuario: "admin",
                contrasena_hash: "3eb3fe66b31e3b4d10fa70b5cad49c7112294af6ae4e476a1c405155d45aa121",
                ultimo_acceso: null, creado_en: new Date().toISOString()
            });
        } else {
            var adminCred = db.autenticacion.filter(function (a) { return String(a.correo || "").toLowerCase() === "admin@miruta.com"; })[0];
            if (adminCred) {
                db.usuario.forEach(function (u) { if (u.id_usuario === adminCred.id_usuario) u.rol = "admin"; });
            }
        }
        db.usuario.forEach(function (u) { if (!u.rol) u.rol = "usuario"; });

        guardar(db);
    }

    // -----------------------------------------------------------------
    // API pública de consulta / escritura.
    // Cada función abre la DB, opera y guarda. Simple y predecible.
    // -----------------------------------------------------------------

    // --- RUTAS ---
    function getRutas() {
        return leer().ruta_bus.filter(function (r) { return r.activo !== false; });
    }

    function getTodasLasRutas() {
        return leer().ruta_bus;
    }

    function getRutaPorTipo(tipo) {
        return leer().ruta_bus.filter(function (r) { return r.tipo === tipo; })[0] || null;
    }

    function getRutaPorId(idRuta) {
        return leer().ruta_bus.filter(function (r) { return r.id_ruta === idRuta; })[0] || null;
    }

    // --- PLANES ---
    function getPlanes() {
        return leer().tipo_suscripcion.filter(function (p) { return p.activo !== false; });
    }

    function getTodosLosPlanes() {
        return leer().tipo_suscripcion;
    }

    function getPlanPorId(idTipo) {
        return leer().tipo_suscripcion.filter(function (p) { return p.id_tipo === idTipo; })[0] || null;
    }

    // --- USUARIO ---
    function crearUsuario(datos) {
        var db = leer();
        var usuario = {
            id_usuario: siguienteId(db, "usuario"),
            nombres: datos.nombres || "",
            apellidos: datos.apellidos || "",
            documento: datos.documento || "",
            telefono: datos.telefono || "",
            fecha_nacimiento: datos.fecha_nacimiento || "",
            fecha_registro: new Date().toISOString(),
            activo: true,
            rol: datos.rol || "usuario"
        };
        db.usuario.push(usuario);
        guardar(db);
        return usuario;
    }

    function getUsuarioPorId(idUsuario) {
        return leer().usuario.filter(function (u) { return u.id_usuario === idUsuario; })[0] || null;
    }

    function actualizarUsuario(idUsuario, cambios) {
        var db = leer();
        var encontrado = null;
        db.usuario = db.usuario.map(function (u) {
            if (u.id_usuario === idUsuario) {
                // Solo dejamos editar datos de perfil básicos.
                u.nombres = cambios.nombres !== undefined ? cambios.nombres : u.nombres;
                u.apellidos = cambios.apellidos !== undefined ? cambios.apellidos : u.apellidos;
                u.documento = cambios.documento !== undefined ? cambios.documento : u.documento;
                u.telefono = cambios.telefono !== undefined ? cambios.telefono : u.telefono;
                u.fecha_nacimiento = cambios.fecha_nacimiento !== undefined ? cambios.fecha_nacimiento : u.fecha_nacimiento;
                encontrado = u;
            }
            return u;
        });
        guardar(db);
        return encontrado;
    }

    // --- AUTENTICACION ---
    function crearAuth(datos) {
        var db = leer();
        var auth = {
            id_auth: siguienteId(db, "autenticacion"),
            id_usuario: datos.id_usuario,
            correo: datos.correo,
            nombre_usuario: datos.nombre_usuario,
            contrasena_hash: datos.contrasena_hash,
            ultimo_acceso: null,
            creado_en: new Date().toISOString()
        };
        db.autenticacion.push(auth);
        guardar(db);
        return auth;
    }

    function getAuthPorCorreo(correo) {
        var objetivo = (correo || "").toLowerCase();
        return leer().autenticacion.filter(function (a) {
            return a.correo.toLowerCase() === objetivo;
        })[0] || null;
    }

    function getAuthPorUsuario(idUsuario) {
        return leer().autenticacion.filter(function (a) {
            return a.id_usuario === idUsuario;
        })[0] || null;
    }

    function registrarUltimoAcceso(idAuth) {
        var db = leer();
        db.autenticacion = db.autenticacion.map(function (a) {
            if (a.id_auth === idAuth) {
                a.ultimo_acceso = new Date().toISOString();
            }
            return a;
        });
        guardar(db);
    }

    // --- SUSCRIPCION ---
    function crearSuscripcion(datos) {
        var db = leer();
        var sus = {
            id_suscripcion: siguienteId(db, "suscripcion"),
            id_usuario: datos.id_usuario,
            id_tipo: datos.id_tipo,
            fecha_inicio: datos.fecha_inicio,
            fecha_fin: datos.fecha_fin,
            estado: "activa",
            creado_en: new Date().toISOString()
        };
        db.suscripcion.push(sus);
        guardar(db);
        return sus;
    }

    // Devuelve la suscripción activa y vigente (no vencida) del usuario.
    function getSuscripcionActiva(idUsuario) {
        var hoy = new Date();
        var activas = leer().suscripcion.filter(function (s) {
            if (s.id_usuario !== idUsuario) return false;
            if (s.estado !== "activa") return false;
            // Tomamos solo la parte YYYY-MM-DD por robustez (aunque llegue un
            // ISO completo) y la tratamos como fin del día en hora local.
            var soloFecha = String(s.fecha_fin).slice(0, 10);
            var fin = new Date(soloFecha + "T23:59:59");
            if (isNaN(fin.getTime())) return false; // fecha inválida -> no vigente
            return fin >= hoy; // sigue vigente
        });
        // Si hubiera varias, tomamos la de mayor descuento (como el SQL).
        activas.sort(function (a, b) {
            var pa = getPlanPorId(a.id_tipo);
            var pb = getPlanPorId(b.id_tipo);
            return (pb ? pb.descuento_pct : 0) - (pa ? pa.descuento_pct : 0);
        });
        return activas[0] || null;
    }

    function cancelarSuscripcion(idSuscripcion) {
        var db = leer();
        db.suscripcion = db.suscripcion.map(function (s) {
            if (s.id_suscripcion === idSuscripcion) {
                s.estado = "cancelada";
            }
            return s;
        });
        guardar(db);
    }

    // --- PAGO ---
    function crearPago(datos) {
        var db = leer();
        var pago = {
            id_pago: siguienteId(db, "pago"),
            id_usuario: datos.id_usuario,
            concepto: datos.concepto,            // 'suscripcion' | 'pasaje'
            monto: datos.monto,
            proveedor: datos.proveedor || "PasarelaDemo",
            referencia_externa: datos.referencia_externa || "",
            metodo: datos.metodo || "tarjeta",
            estado: datos.estado || "completado", // 'completado' | 'fallido'
            creado_en: new Date().toISOString()
        };
        db.pago.push(pago);
        guardar(db);
        return pago;
    }

    function getPagosPorUsuario(idUsuario) {
        return leer().pago.filter(function (p) { return p.id_usuario === idUsuario; });
    }

    // --- VIAJE ---
    function crearViaje(datos) {
        var db = leer();
        var viaje = {
            id_viaje: siguienteId(db, "viaje"),
            id_usuario: datos.id_usuario,
            id_ruta: datos.id_ruta,
            id_pago: datos.id_pago || null,
            precio_base: datos.precio_base,
            descuento_pct: datos.descuento_pct,
            precio_final: datos.precio_final,
            fecha_viaje: new Date().toISOString()
        };
        db.viaje.push(viaje);
        guardar(db);
        return viaje;
    }

    function getViajesPorUsuario(idUsuario) {
        return leer().viaje
            .filter(function (v) { return v.id_usuario === idUsuario; })
            // más recientes primero
            .sort(function (a, b) { return new Date(b.fecha_viaje) - new Date(a.fecha_viaje); });
    }

    // --- ADMINISTRACION ---
    function getUsuarios() { return leer().usuario; }
    function getTodosPagos() { return leer().pago; }
    function getTodasSuscripciones() { return leer().suscripcion; }
    function getTodosViajes() { return leer().viaje; }
    function actualizarUsuarioAdmin(idUsuario, cambios) {
        var db = leer(), encontrado = null;
        db.usuario = db.usuario.map(function (u) {
            if (u.id_usuario === Number(idUsuario)) {
                Object.keys(cambios || {}).forEach(function (key) {
                    if (["nombres","apellidos","documento","telefono","fecha_nacimiento","activo","rol"].indexOf(key) >= 0) u[key] = cambios[key];
                }); encontrado = u;
            } return u;
        }); guardar(db); return encontrado;
    }
    function actualizarRutaAdmin(idRuta, cambios) {
        var db = leer(), encontrado = null;
        db.ruta_bus = db.ruta_bus.map(function (r) {
            if (r.id_ruta === Number(idRuta)) {
                Object.keys(cambios || {}).forEach(function (key) {
                    if (["nombre","numero","precio_pasaje","hora_salida","origen","destino","frecuencia","horario","color","activo"].indexOf(key) >= 0) r[key] = cambios[key];
                }); encontrado = r;
            } return r;
        }); guardar(db); return encontrado;
    }
    function crearRutaAdmin(datos) {
        var db = leer();
        var ruta = { id_ruta:siguienteId(db,"ruta_bus"), tipo:String(datos.tipo || ("ruta-"+Date.now())), nombre:String(datos.nombre||"Nueva ruta"), numero:String(datos.numero||""), precio_pasaje:Number(datos.precio_pasaje)||0, hora_salida:String(datos.hora_salida||""), origen:String(datos.origen||""), destino:String(datos.destino||""), frecuencia:String(datos.frecuencia||""), horario:String(datos.horario||""), color:String(datos.color||"#0f766e"), activo:true, coordenadas:Array.isArray(datos.coordenadas)?datos.coordenadas:[] };
        db.ruta_bus.push(ruta); guardar(db); return ruta;
    }
    function actualizarPlanAdmin(idTipo, cambios) {
        var db = leer(), encontrado = null;
        db.tipo_suscripcion = db.tipo_suscripcion.map(function (pl) {
            if (pl.id_tipo === Number(idTipo)) {
                Object.keys(cambios || {}).forEach(function (key) { if (["nombre","descuento_pct","precio_mensual","duracion_dias","descripcion","activo"].indexOf(key) >= 0) pl[key] = cambios[key]; });
                encontrado = pl;
            } return pl;
        }); guardar(db); return encontrado;
    }
    function crearPlanAdmin(datos) {
        var db = leer();
        var plan = { id_tipo:siguienteId(db,"tipo_suscripcion"), nombre:String(datos.nombre||"Nuevo plan"), descuento_pct:Number(datos.descuento_pct)||0, precio_mensual:Number(datos.precio_mensual)||0, duracion_dias:Number(datos.duracion_dias)||30, descripcion:String(datos.descripcion||""), activo:true };
        db.tipo_suscripcion.push(plan); guardar(db); return plan;
    }
    function adminCancelarSuscripcion(idSuscripcion) { cancelarSuscripcion(Number(idSuscripcion)); return true; }

// -----------------------------------------------------------------
    // Exponer la API en window.DB (frontend) o module.exports (backend/Node.js)
    // -----------------------------------------------------------------
    const DB_API = {
        init: init,
        // rutas
        getRutas: getRutas,
        getTodasLasRutas: getTodasLasRutas,
        getRutaPorTipo: getRutaPorTipo,
        getRutaPorId: getRutaPorId,
        // planes
        getPlanes: getPlanes,
        getTodosLosPlanes: getTodosLosPlanes,
        getPlanPorId: getPlanPorId,
        getUsuarios: getUsuarios,
        getTodosPagos: getTodosPagos,
        getTodasSuscripciones: getTodasSuscripciones,
        getTodosViajes: getTodosViajes,
        actualizarUsuarioAdmin: actualizarUsuarioAdmin,
        actualizarRutaAdmin: actualizarRutaAdmin,
        crearRutaAdmin: crearRutaAdmin,
        actualizarPlanAdmin: actualizarPlanAdmin,
        crearPlanAdmin: crearPlanAdmin,
        adminCancelarSuscripcion: adminCancelarSuscripcion,
        // usuario
        crearUsuario: crearUsuario,
        getUsuarioPorId: getUsuarioPorId,
        actualizarUsuario: actualizarUsuario,
        // auth
        crearAuth: crearAuth,
        getAuthPorCorreo: getAuthPorCorreo,
        getAuthPorUsuario: getAuthPorUsuario,
        registrarUltimoAcceso: registrarUltimoAcceso,
        // suscripcion
        crearSuscripcion: crearSuscripcion,
        getSuscripcionActiva: getSuscripcionActiva,
        cancelarSuscripcion: cancelarSuscripcion,
        // pago
        crearPago: crearPago,
        getPagosPorUsuario: getPagosPorUsuario,
        // viaje
        crearViaje: crearViaje,
        getViajesPorUsuario: getViajesPorUsuario
    };

    if (typeof window !== 'undefined') {
        window.DB = DB_API;
        init();
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = DB_API;
    }
})();
