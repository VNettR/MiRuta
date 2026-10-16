// =====================================================================
//  auth.js — Registro, login y manejo de sesión
//  - Hash de contraseña con SHA-256 vía crypto.subtle (Web Crypto API).
//  - La sesión guarda SOLO el id del usuario en localStorage, nunca la
//    contraseña ni el hash.
//
//  NOTA HONESTA DE SEGURIDAD: sin backend, todo vive en el navegador.
//  SHA-256 a secas no es ideal para contraseñas reales (no usa salt ni
//  un algoritmo lento tipo bcrypt/argon2). Para una demo educativa es
//  suficiente; en producción el hashing va SIEMPRE en el servidor.
// =====================================================================

(function () {
    "use strict";

    var SESION_KEY = "miruta_sesion"; // guarda { id_usuario }

    // -----------------------------------------------------------------
    // Hash SHA-256 de un texto -> string hexadecimal.
    // crypto.subtle es asíncrono, por eso devolvemos una promesa.
    // -----------------------------------------------------------------
    async function hashPassword(texto) {
        var datos = new TextEncoder().encode(texto);
        var buffer = await crypto.subtle.digest("SHA-256", datos);
        // Convertir el ArrayBuffer a hex legible.
        var bytes = Array.from(new Uint8Array(buffer));
        return bytes.map(function (b) {
            return b.toString(16).padStart(2, "0");
        }).join("");
    }

    // -----------------------------------------------------------------
    // Validaciones simples reutilizables.
    // -----------------------------------------------------------------
    function correoValido(correo) {
        // Validación básica suficiente para una demo.
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
    }

    // -----------------------------------------------------------------
    // REGISTRO
    // Crea usuario + autenticacion. Devuelve { ok, error?, usuario? }.
    // -----------------------------------------------------------------
    async function registrar(datos) {
        var nombres = (datos.nombres || "").trim();
        var apellidos = (datos.apellidos || "").trim();
        var correo = (datos.correo || "").trim().toLowerCase();
        var nombreUsuario = (datos.nombre_usuario || "").trim();
        var password = datos.password || "";

        // --- Validaciones ---
        if (!nombres || !apellidos) {
            return { ok: false, error: "Nombres y apellidos son obligatorios." };
        }
        if (!correoValido(correo)) {
            return { ok: false, error: "El correo no es válido." };
        }
        if (!nombreUsuario) {
            return { ok: false, error: "El nombre de usuario es obligatorio." };
        }
        if (password.length < 6) {
            return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
        }
        if (DB.getAuthPorCorreo(correo)) {
            return { ok: false, error: "Ya existe una cuenta con ese correo." };
        }

        // --- Crear perfil + credenciales ---
        var usuario = DB.crearUsuario({
            nombres: nombres,
            apellidos: apellidos,
            documento: datos.documento || "",
            telefono: datos.telefono || "",
            fecha_nacimiento: datos.fecha_nacimiento || ""
        });

        var hash = await hashPassword(password);

        DB.crearAuth({
            id_usuario: usuario.id_usuario,
            correo: correo,
            nombre_usuario: nombreUsuario,
            contrasena_hash: hash
        });

        return { ok: true, usuario: usuario };
    }

    // -----------------------------------------------------------------
    // LOGIN
    // Compara el hash de la contraseña ingresada con el guardado.
    // -----------------------------------------------------------------
    async function login(correo, password) {
        correo = (correo || "").trim().toLowerCase();

        if (!correoValido(correo)) {
            return { ok: false, error: "Correo o contraseña incorrectos." };
        }

        var auth = DB.getAuthPorCorreo(correo);
        if (!auth) {
            // Mensaje genérico a propósito (no revelar si el correo existe).
            return { ok: false, error: "Correo o contraseña incorrectos." };
        }

        var hash = await hashPassword(password || "");
        if (hash !== auth.contrasena_hash) {
            return { ok: false, error: "Correo o contraseña incorrectos." };
        }

        // Sesión OK: guardamos solo el id del usuario.
        DB.registrarUltimoAcceso(auth.id_auth);
        localStorage.setItem(SESION_KEY, JSON.stringify({ id_usuario: auth.id_usuario }));

        return { ok: true, usuario: DB.getUsuarioPorId(auth.id_usuario) };
    }

    // -----------------------------------------------------------------
    // Sesión: leer usuario actual / cerrar sesión.
    // -----------------------------------------------------------------
    function usuarioActual() {
        var crudo = localStorage.getItem(SESION_KEY);
        if (!crudo) return null;
        try {
            var sesion = JSON.parse(crudo);
            return DB.getUsuarioPorId(sesion.id_usuario);
        } catch (e) {
            return null;
        }
    }

    function logout() {
        localStorage.removeItem(SESION_KEY);
    }

    function esAdmin() {
        var usuario = usuarioActual();
        return Boolean(usuario && usuario.rol === "admin" && usuario.activo !== false);
    }

    // -----------------------------------------------------------------
    // Exponer API en window.Auth.
    // -----------------------------------------------------------------
    window.Auth = {
        registrar: registrar,
        login: login,
        usuarioActual: usuarioActual,
        esAdmin: esAdmin,
        logout: logout,
        hashPassword: hashPassword // expuesto por si se necesita en otros módulos
    };
})();
