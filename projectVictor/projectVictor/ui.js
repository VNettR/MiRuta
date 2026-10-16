// =====================================================================
//  ui.js — SPA (Single Page App) sin framework
//  Renderiza todas las vistas dentro de #app y coordina:
//    Auth (login/registro) · Rutas+Mapa · Detalle · Suscripción ·
//    Perfil · Historial de viajes.
//  Usa DB, Auth, Payment y MapaApp (los módulos previos).
// =====================================================================

(function () {
    "use strict";

    // Vista actual y datos auxiliares (ej: ruta seleccionada en Detalle).
    var estado = {
        vista: "rutas",     // por defecto, si hay sesión
        rutaTipo: null      // tipo de ruta abierto en Detalle
    };

    var $app; // contenedor raíz
    var historialAI = [];
    var aiOcupado = false;

    // -----------------------------------------------------------------
    // Helpers cortos.
    // -----------------------------------------------------------------
    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

    // Escapa texto para evitar inyección de HTML al renderizar datos.
    function esc(texto) {
        return String(texto == null ? "" : texto)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // Formatea un número como pesos colombianos.
    function plata(valor) {
        return "$" + Number(valor).toLocaleString("es-CO");
    }

    // Formatea una fecha ISO a algo legible.
    function fechaLegible(iso) {
        if (!iso) return "—";
        var d = new Date(iso);
        return d.toLocaleDateString("es-CO") + " " +
            d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
    }

    // Icono de marca (bus) como SVG inline sobrio — reemplaza el emoji.
    var ICONO_MARCA =
        '<svg class="marca-icon" width="22" height="22" viewBox="0 0 24 24" ' +
        'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9H4z"/>' +
        '<path d="M4 11h16"/>' +
        '<path d="M4 15v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1"/>' +
        '<path d="M16 17v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2"/>' +
        '<circle cx="7.5" cy="13" r="0.6"/>' +
        '<circle cx="16.5" cy="13" r="0.6"/></svg>';

    // -----------------------------------------------------------------
    // Navegación: cambia de vista y re-renderiza.
    // -----------------------------------------------------------------
    function ir(vista, extra) {
        estado.vista = vista;
        if (extra && extra.rutaTipo !== undefined) estado.rutaTipo = extra.rutaTipo;
        render();
    }

    // =================================================================
    //  RENDER PRINCIPAL
    // =================================================================
    function render() {
        var usuario = Auth.usuarioActual();

        // Sin sesión: solo se permite la pantalla de autenticación.
        if (!usuario) {
            $app.innerHTML = vistaAuth();
            enlazarAuth();
            return;
        }

        // Con sesión: layout con barra de navegación + vista activa.
        if (estado.vista === "admin" && !Auth.esAdmin()) estado.vista = "rutas";
        $app.innerHTML =
            barraNav(usuario) +
            '<main class="vista" id="vista">' + contenidoVista(usuario) + "</main>" +
            asistenteIA();

        enlazarNav();
        enlazarVista(usuario);
        enlazarAsistente();
    }

    function contenidoVista(usuario) {
        switch (estado.vista) {
            case "rutas": return vistaRutas();
            case "detalle": return vistaDetalle();
            case "suscripcion": return vistaSuscripcion(usuario);
            case "perfil": return vistaPerfil(usuario);
            case "historial": return vistaHistorial(usuario);
            case "admin": return vistaAdmin(usuario);
            default: return vistaRutas();
        }
    }

    // =================================================================
    //  VISTA: AUTENTICACIÓN (login / registro)
    // =================================================================
    function vistaAuth() {
        return '' +
        '<div class="auth-wrap">' +
        '  <div class="auth-card glass">' +
        '    <h1>' + ICONO_MARCA + '<span>MiRuta</span></h1>' +
        '    <p class="sub">Sistema inteligente de rutas urbanas</p>' +
        '    <div class="tabs" role="tablist">' +
        '      <button class="tab activa" id="tab-login" role="tab">Iniciar sesión</button>' +
        '      <button class="tab" id="tab-registro" role="tab">Registrarse</button>' +
        '    </div>' +
        '    <div id="auth-msg" class="msg" role="alert" aria-live="polite"></div>' +
        '    <form id="form-login" class="form" novalidate>' +
        campo("login-correo", "Correo", "email", "tucorreo@ejemplo.com") +
        campo("login-password", "Contraseña", "password", "••••••") +
        '      <button type="submit" class="btn-primario">Entrar</button>' +
        '    </form>' +
        '    <form id="form-registro" class="form oculto" novalidate>' +
        '      <div class="grid2">' +
        campo("reg-nombres", "Nombres", "text", "Juan") +
        campo("reg-apellidos", "Apellidos", "text", "Pérez") +
        '      </div>' +
        campo("reg-usuario", "Nombre de usuario", "text", "juanp") +
        campo("reg-correo", "Correo", "email", "tucorreo@ejemplo.com") +
        '      <div class="grid2">' +
        campo("reg-telefono", "Teléfono (opcional)", "text", "3001234567") +
        campo("reg-documento", "Documento (opcional)", "text", "12345678") +
        '      </div>' +
        campo("reg-password", "Contraseña (mín. 6)", "password", "••••••") +
        '      <button type="submit" class="btn-primario">Crear cuenta</button>' +
        '    </form>' +
        '  </div>' +
        '</div>';
    }

    // Genera un campo de formulario con label accesible.
    function campo(id, etiqueta, tipo, placeholder) {
        return '' +
        '<div class="campo">' +
        '  <label for="' + id + '">' + esc(etiqueta) + '</label>' +
        '  <input id="' + id + '" name="' + id + '" type="' + tipo + '" ' +
        '    placeholder="' + esc(placeholder) + '" autocomplete="off">' +
        '</div>';
    }

    function enlazarAuth() {
        var tabLogin = $("#tab-login");
        var tabRegistro = $("#tab-registro");
        var formLogin = $("#form-login");
        var formRegistro = $("#form-registro");
        var msg = $("#auth-msg");

        function limpiarMsg() { msg.textContent = ""; msg.className = "msg"; }
        function mostrarError(t) { msg.textContent = t; msg.className = "msg error"; }
        function mostrarOk(t) { msg.textContent = t; msg.className = "msg ok"; }

        tabLogin.addEventListener("click", function () {
            tabLogin.classList.add("activa");
            tabRegistro.classList.remove("activa");
            formLogin.classList.remove("oculto");
            formRegistro.classList.add("oculto");
            limpiarMsg();
        });

        tabRegistro.addEventListener("click", function () {
            tabRegistro.classList.add("activa");
            tabLogin.classList.remove("activa");
            formRegistro.classList.remove("oculto");
            formLogin.classList.add("oculto");
            limpiarMsg();
        });

        // --- LOGIN ---
        formLogin.addEventListener("submit", async function (e) {
            e.preventDefault();
            limpiarMsg();
            var btn = formLogin.querySelector("button[type=submit]");
            cargando(btn, true, "Entrando...");

            var r = await Auth.login($("#login-correo").value, $("#login-password").value);

            cargando(btn, false, "Entrar");
            if (!r.ok) { mostrarError(r.error); return; }
            estado.vista = "rutas";
            render();
        });

        // --- REGISTRO ---
        formRegistro.addEventListener("submit", async function (e) {
            e.preventDefault();
            limpiarMsg();
            var btn = formRegistro.querySelector("button[type=submit]");
            cargando(btn, true, "Creando...");

            var r = await Auth.registrar({
                nombres: $("#reg-nombres").value,
                apellidos: $("#reg-apellidos").value,
                nombre_usuario: $("#reg-usuario").value,
                correo: $("#reg-correo").value,
                telefono: $("#reg-telefono").value,
                documento: $("#reg-documento").value,
                password: $("#reg-password").value
            });

            cargando(btn, false, "Crear cuenta");
            if (!r.ok) { mostrarError(r.error); return; }

            mostrarOk("Cuenta creada. Iniciando sesión...");
            // Auto-login tras registro.
            var rl = await Auth.login($("#reg-correo").value, $("#reg-password").value);
            if (rl.ok) { estado.vista = "rutas"; render(); }
        });
    }

    // =================================================================
    //  BARRA DE NAVEGACIÓN (con sesión)
    // =================================================================
    function barraNav(usuario) {
        function item(vista, etiqueta) {
            var activa = estado.vista === vista ? " activa" : "";
            return '<button class="nav-item' + activa + '" data-vista="' + vista + '">' + etiqueta + '</button>';
        }
        return '' +
        '<nav class="navbar glass">' +
        '  <div class="marca">' + ICONO_MARCA + '<span>MiRuta</span></div>' +
        '  <div class="nav-links">' +
        item("rutas", "Rutas") +
        item("suscripcion", "Suscripción") +
        item("historial", "Historial") +
        item("perfil", "Perfil") +
        (usuario.rol === "admin" ? item("admin", "Administración") : "") +
        '  </div>' +
        '  <div class="nav-user">' +
        '    <span>Hola, ' + esc(usuario.nombres) + '</span>' +
        '    <button id="btn-logout" class="btn-secundario">Salir</button>' +
        '  </div>' +
        '</nav>';
    }

    function enlazarNav() {
        $all(".nav-item").forEach(function (btn) {
            btn.addEventListener("click", function () {
                ir(btn.getAttribute("data-vista"));
            });
        });
        var logout = $("#btn-logout");
        if (logout) {
            logout.addEventListener("click", function () {
                Auth.logout();
                estado.vista = "rutas";
                render();
            });
        }
    }

    // =================================================================
    //  VISTA: RUTAS + MAPA
    // =================================================================
    function vistaRutas() {
        var rutas = DB.getRutas();

        var tarjetas = rutas.map(function (r) {
            return '' +
            '<button class="ruta-card glass" data-tipo="' + esc(r.tipo) + '">' +
            '  <span class="punto" style="background:' + esc(r.color) + '"></span>' +
            '  <span class="ruta-info">' +
            '    <strong>' + esc(r.nombre) + '</strong>' +
            '    <small>' + esc(r.origen) + ' → ' + esc(r.destino) + '</small>' +
            '  </span>' +
            '  <span class="precio">' + plata(r.precio_pasaje) + '</span>' +
            '</button>';
        }).join("");

        return '' +
        '<section class="rutas-intro glass">' +
        '  <div><span class="eyebrow">MOVILIDAD URBANA</span><h1>Encuentra tu ruta sin complicaciones</h1><p>Busca una ruta, revisa su recorrido y consulta el mapa. Si tienes dudas, usa el Asistente IA.</p></div>' +
        '  <div class="rutas-stats"><strong>' + rutas.length + '</strong><span>rutas disponibles</span></div>' +
        '</section>' +
        '<div class="rutas-layout">' +
        '  <aside class="panel glass">' +
        '    <div class="panel-title-row"><div><h2>Rutas disponibles</h2><p>Selecciona una para ver el detalle.</p></div></div>' +
        '    <input id="buscador" type="text" placeholder="Buscar por nombre, origen o destino..." aria-label="Buscar ruta">' +
        '    <div class="ruta-lista" id="ruta-lista">' + tarjetas + '</div>' +
        '    <button class="btn-secundario" id="btn-ocultar">Ver todas las rutas</button>' +
        '  </aside>' +
        '  <div id="map" class="mapa"></div>' +
        '</div>';
    }

    function enlazarRutas() {
        // Inicializar el mapa (el contenedor ya está en el DOM).
        MapaApp.initMapa();
        // Estado por defecto de la vista general: todas las rutas visibles.
        MapaApp.mostrarTodasLasRutas();

        $all(".ruta-card").forEach(function (card) {
            card.addEventListener("click", function () {
                ir("detalle", { rutaTipo: card.getAttribute("data-tipo") });
            });
        });

        var ocultar = $("#btn-ocultar");
        if (ocultar) ocultar.addEventListener("click", function () { MapaApp.mostrarTodasLasRutas(); });

        // Buscador en vivo sobre las tarjetas.
        var buscador = $("#buscador");
        if (buscador) {
            // 'input' cubre teclado, pegado y autocompletar (mejor que keyup).
            buscador.addEventListener("input", function () {
                var texto = this.value.toLowerCase();
                $all(".ruta-card").forEach(function (card) {
                    var visible = card.textContent.toLowerCase().indexOf(texto) !== -1;
                    card.style.display = visible ? "" : "none";
                });
            });
        }
    }

    // =================================================================
    //  VISTA: DETALLE DE RUTA
    // =================================================================
    function vistaDetalle() {
        var ruta = DB.getRutaPorTipo(estado.rutaTipo);
        if (!ruta) {
            return mensajeVacio("Ruta no encontrada.", "rutas", "Volver a rutas");
        }

        var usuario = Auth.usuarioActual();
        var suscripcion = DB.getSuscripcionActiva(usuario.id_usuario);
        var plan = suscripcion ? DB.getPlanPorId(suscripcion.id_tipo) : null;
        var descuento = plan ? Number(plan.descuento_pct) : 0;
        // Mismo helper que usa el cobro: lo que muestro = lo que se cobra.
        var precioFinal = Payment.calcularPrecioFinal(ruta.precio_pasaje, descuento);

        var avisoDescuento = plan
            ? '<p class="badge ok">Plan ' + esc(plan.nombre) + ': -' + descuento + '%</p>'
            : '<p class="badge neutro">Sin suscripción activa (sin descuento)</p>';

        return '' +
        '<div class="detalle-layout">' +
        '  <div class="panel glass">' +
        '    <button class="btn-link" id="volver">← Volver</button>' +
        '    <h2><span class="punto" style="background:' + esc(ruta.color) + '"></span> ' + esc(ruta.nombre) + '</h2>' +
        '    <ul class="datos">' +
        '      <li><span>N.º de ruta</span><strong>' + esc(ruta.numero) + '</strong></li>' +
        '      <li><span>Recorrido</span><strong>' + esc(ruta.origen) + ' → ' + esc(ruta.destino) + '</strong></li>' +
        '      <li><span>Horario</span><strong>' + esc(ruta.horario) + '</strong></li>' +
        '      <li><span>Frecuencia</span><strong>' + esc(ruta.frecuencia) + '</strong></li>' +
        '      <li><span>Paradas</span><strong>' + ruta.coordenadas.length + '</strong></li>' +
        '      <li><span>Pasaje base</span><strong>' + plata(ruta.precio_pasaje) + '</strong></li>' +
        '    </ul>' +
        avisoDescuento +
        '    <div class="total-box">' +
        '      <span>Pagarías</span>' +
        '      <strong class="total">' + plata(precioFinal) + '</strong>' +
        '    </div>' +
        '    <button class="btn-primario" id="tomar-ruta">Tomar esta ruta</button>' +
        '  </div>' +
        '  <div id="map" class="mapa"></div>' +
        '</div>';
    }

    function enlazarDetalle() {
        MapaApp.initMapa();
        MapaApp.mostrarRuta(estado.rutaTipo); // pintar la ruta abierta

        var volver = $("#volver");
        if (volver) volver.addEventListener("click", function () { ir("rutas"); });

        var tomar = $("#tomar-ruta");
        if (tomar) {
            tomar.addEventListener("click", function () {
                var ruta = DB.getRutaPorTipo(estado.rutaTipo);
                abrirCheckout({
                    titulo: "Pagar pasaje — " + ruta.nombre,
                    onPagar: async function (cerrar, setMsg, setLoading) {
                        var usuario = Auth.usuarioActual();
                        setLoading(true);
                        var iniciado = await Payment.registrarViaje(usuario.id_usuario, ruta.id_ruta, function (r) {
                            setLoading(false);
                            if (!r.ok) { setMsg(r.error, "error"); return; }
                            var txt = "¡Pago aprobado! Viaje registrado por " + plata(r.viaje.precio_final);
                            if (r.plan) txt += " (descuento " + r.viaje.descuento_pct + "%)";
                            setMsg(txt, "ok");
                            setTimeout(function () { cerrar(); ir("historial"); }, 1400);
                        });
                        if (!iniciado.ok) {
                            setLoading(false);
                            setMsg(iniciado.error, "error");
                        } else {
                            setMsg("Completa el pago en el checkout seguro de Wompi.", "ok");
                        }
                    }
                });
            });
        }
    }

    // =================================================================
    //  VISTA: SUSCRIPCIÓN
    // =================================================================
    function vistaSuscripcion(usuario) {
        var activa = DB.getSuscripcionActiva(usuario.id_usuario);
        var planes = DB.getPlanes();

        var estadoActual = "";
        if (activa) {
            var plan = DB.getPlanPorId(activa.id_tipo);
            estadoActual = '' +
            '<div class="panel glass">' +
            '  <h2>Tu suscripción</h2>' +
            '  <p class="badge ok">Activa · Plan ' + esc(plan.nombre) + ' (-' + plan.descuento_pct + '%)</p>' +
            '  <ul class="datos">' +
            '    <li><span>Inicio</span><strong>' + esc(activa.fecha_inicio) + '</strong></li>' +
            '    <li><span>Vence</span><strong>' + esc(activa.fecha_fin) + '</strong></li>' +
            '  </ul>' +
            '  <button class="btn-secundario" id="cancelar-sus" data-id="' + activa.id_suscripcion + '">Cancelar suscripción</button>' +
            '</div>';
        } else {
            estadoActual = '<div class="panel glass"><h2>Tu suscripción</h2>' +
                '<p class="badge neutro">No tienes una suscripción activa.</p></div>';
        }

        var tarjetasPlanes = planes.map(function (p) {
            var deshabilitar = activa ? " disabled" : "";
            return '' +
            '<div class="plan-card glass">' +
            '  <h3>' + esc(p.nombre) + '</h3>' +
            '  <p class="plan-precio">' + plata(p.precio_mensual) + '<small>/mes</small></p>' +
            '  <p class="plan-desc">' + esc(p.descripcion) + '</p>' +
            '  <p class="badge ok">-' + p.descuento_pct + '% en pasajes</p>' +
            '  <button class="btn-primario comprar-plan" data-id="' + p.id_tipo + '"' + deshabilitar + '>' +
            (activa ? "Ya suscrito" : "Suscribirme") + '</button>' +
            '</div>';
        }).join("");

        return '' +
        '<div class="suscripcion-layout">' +
        estadoActual +
        '  <div class="planes-grid">' + tarjetasPlanes + '</div>' +
        '</div>';
    }

    function enlazarSuscripcion(usuario) {
        // Comprar plan.
        $all(".comprar-plan").forEach(function (btn) {
            if (btn.disabled) return;
            btn.addEventListener("click", function () {
                var idTipo = Number(btn.getAttribute("data-id"));
                var plan = DB.getPlanPorId(idTipo);
                abrirCheckout({
                    titulo: "Suscribirme — " + plan.nombre + " (" + plata(plan.precio_mensual) + ")",
                    onPagar: async function (cerrar, setMsg, setLoading) {
                        setLoading(true);
                        var iniciado = await Payment.comprarSuscripcion(usuario.id_usuario, idTipo, function (r) {
                            setLoading(false);
                            if (!r.ok) { setMsg(r.error, "error"); return; }
                            setMsg("¡Pago aprobado! Suscripción activada: " + r.plan.nombre, "ok");
                            setTimeout(function () { cerrar(); render(); }, 1400);
                        });
                        if (!iniciado.ok) {
                            setLoading(false);
                            setMsg(iniciado.error, "error");
                        } else {
                            setMsg("Completa el pago en el checkout seguro de Wompi.", "ok");
                        }
                    }
                });
            });
        });

        // Cancelar suscripción.
        var cancelar = $("#cancelar-sus");
        if (cancelar) {
            cancelar.addEventListener("click", function () {
                if (!confirm("¿Seguro que quieres cancelar tu suscripción?")) return;
                DB.cancelarSuscripcion(Number(cancelar.getAttribute("data-id")));
                render();
            });
        }
    }

    // =================================================================
    //  VISTA: PERFIL
    // =================================================================
    function vistaPerfil(usuario) {
        var auth = DB.getAuthPorUsuario(usuario.id_usuario);
        return '' +
        '<div class="perfil-layout">' +
        '  <div class="panel glass">' +
        '    <h2>Mi perfil</h2>' +
        '    <div id="perfil-msg" class="msg" role="alert" aria-live="polite"></div>' +
        '    <form id="form-perfil" class="form" novalidate>' +
        '      <div class="grid2">' +
        campoValor("p-nombres", "Nombres", usuario.nombres) +
        campoValor("p-apellidos", "Apellidos", usuario.apellidos) +
        '      </div>' +
        '      <div class="grid2">' +
        campoValor("p-telefono", "Teléfono", usuario.telefono) +
        campoValor("p-documento", "Documento", usuario.documento) +
        '      </div>' +
        '      <div class="campo">' +
        '        <label>Correo (no editable)</label>' +
        '        <input type="text" value="' + esc(auth ? auth.correo : "") + '" disabled>' +
        '      </div>' +
        '      <button type="submit" class="btn-primario">Guardar cambios</button>' +
        '    </form>' +
        '  </div>' +
        '</div>';
    }

    // Campo con valor precargado (para formularios de edición).
    function campoValor(id, etiqueta, valor) {
        return '' +
        '<div class="campo">' +
        '  <label for="' + id + '">' + esc(etiqueta) + '</label>' +
        '  <input id="' + id + '" type="text" value="' + esc(valor) + '">' +
        '</div>';
    }

    function enlazarPerfil(usuario) {
        var form = $("#form-perfil");
        var msg = $("#perfil-msg");
        if (!form) return;

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            var nombres = $("#p-nombres").value.trim();
            var apellidos = $("#p-apellidos").value.trim();

            if (!nombres || !apellidos) {
                msg.textContent = "Nombres y apellidos no pueden quedar vacíos.";
                msg.className = "msg error";
                return;
            }

            DB.actualizarUsuario(usuario.id_usuario, {
                nombres: nombres,
                apellidos: apellidos,
                telefono: $("#p-telefono").value.trim(),
                documento: $("#p-documento").value.trim()
            });

            msg.textContent = "Cambios guardados.";
            msg.className = "msg ok";
            // Refrescar la barra (saludo con el nuevo nombre).
            setTimeout(render, 800);
        });
    }

    // =================================================================
    //  VISTA: HISTORIAL DE VIAJES
    // =================================================================
    function vistaHistorial(usuario) {
        var viajes = DB.getViajesPorUsuario(usuario.id_usuario);

        if (viajes.length === 0) {
            return '<div class="historial-layout">' +
                mensajeVacio("Aún no has tomado ningún viaje.", "rutas", "Ver rutas") +
                '</div>';
        }

        var filas = viajes.map(function (v) {
            var ruta = DB.getRutaPorId(v.id_ruta);
            var nombreRuta = ruta ? ruta.nombre : "Ruta #" + v.id_ruta;
            return '' +
            '<tr>' +
            '  <td>' + esc(fechaLegible(v.fecha_viaje)) + '</td>' +
            '  <td>' + esc(nombreRuta) + '</td>' +
            '  <td>' + plata(v.precio_base) + '</td>' +
            '  <td>' + (v.descuento_pct > 0 ? "-" + v.descuento_pct + "%" : "—") + '</td>' +
            '  <td><strong>' + plata(v.precio_final) + '</strong></td>' +
            '</tr>';
        }).join("");

        // Total gastado real (precio final).
        var total = viajes.reduce(function (acc, v) { return acc + Number(v.precio_final); }, 0);

        return '' +
        '<div class="historial-layout">' +
        '  <div class="panel glass">' +
        '    <h2>Historial de viajes</h2>' +
        '    <div class="tabla-wrap">' +
        '      <table class="tabla">' +
        '        <thead><tr>' +
        '          <th>Fecha</th><th>Ruta</th><th>Base</th><th>Descuento</th><th>Pagado</th>' +
        '        </tr></thead>' +
        '        <tbody>' + filas + '</tbody>' +
        '      </table>' +
        '    </div>' +
        '    <p class="total-historial">Total viajes: ' + viajes.length + ' · Gastado: ' + plata(total) + '</p>' +
        '  </div>' +
        '</div>';
    }

    // =================================================================
    //  COMPONENTE: MODAL DE CHECKOUT Wompi
    // =================================================================
    var checkoutAbierto = false;

    function abrirCheckout(opciones) {
        // opciones = { titulo, onPagar(cerrar, setMsg, setLoading) }
        if (checkoutAbierto) return;
        checkoutAbierto = true;

        var overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.innerHTML = '' +
        '<div class="modal glass" role="dialog" aria-modal="true" aria-label="Pago con Wompi">' +
        '  <button class="modal-cerrar" id="m-cerrar" aria-label="Cerrar">×</button>' +
        '  <h2>' + esc(opciones.titulo) + '</h2>' +
        '  <p class="hint">Serás dirigido al checkout seguro de Wompi. Los datos de tu tarjeta no pasan por MiRuta.</p>' +
        '  <div id="m-msg" class="msg" role="alert" aria-live="polite"></div>' +
        '  <button type="button" class="btn-primario" id="m-pagar">Continuar con Wompi</button>' +
        '  <button type="button" class="btn-secundario" id="m-cancelar">Cancelar</button>' +
        '</div>';

        document.body.appendChild(overlay);

        var msg = $("#m-msg", overlay);
        var btn = $("#m-pagar", overlay);

        function setMsg(t, tipo) {
            msg.textContent = t;
            msg.className = "msg " + (tipo || "");
        }

        function setLoading(on) {
            cargando(btn, on, on ? "Abriendo Wompi..." : "Continuar con Wompi");
        }

        function cerrar() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            checkoutAbierto = false;
        }

        $("#m-cerrar", overlay).addEventListener("click", cerrar);
        $("#m-cancelar", overlay).addEventListener("click", cerrar);
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) cerrar();
        });

        btn.addEventListener("click", function () {
            setMsg("", "");
            opciones.onPagar(cerrar, setMsg, setLoading);
        });
    }

    // =================================================================
    //  ASISTENTE IA — chatbot + capacidades de agente
    // =================================================================
    function asistenteIA() {
        return '' +
        '<button class="ai-fab" id="ai-fab" type="button" aria-expanded="false" aria-controls="ai-panel">' +
        '  <span class="ai-dot"></span><span>Asistente IA</span>' +
        '</button>' +
        '<section class="ai-panel" id="ai-panel" aria-label="Asistente IA de MiRuta">' +
        '  <header class="ai-head">' +
        '    <div class="ai-avatar">AI</div>' +
        '    <div class="ai-head-copy"><strong>Asistente MiRuta</strong><small>Gemini · rutas y servicios de la app</small></div>' +
        '    <button class="ai-close" id="ai-close" type="button" aria-label="Cerrar asistente">×</button>' +
        '  </header>' +
        '  <div class="ai-messages" id="ai-messages" aria-live="polite"></div>' +
        '  <div class="ai-quick" id="ai-quick">' +
        '    <button type="button" data-ai-question="¿Qué rutas están disponibles?">Rutas disponibles</button>' +
        '    <button type="button" data-ai-question="¿Cuánto cuesta un pasaje?">Tarifas</button>' +
        '    <button type="button" data-ai-question="¿Qué planes de suscripción tienen?">Suscripciones</button>' +
        '    <button type="button" data-ai-question="¿La IA está funcionando correctamente?">Probar IA</button>' +
        '  </div>' +
        '  <form class="ai-form" id="ai-form">' +
        '    <input class="ai-input" id="ai-input" type="text" maxlength="1200" placeholder="Pregunta sobre MiRuta..." autocomplete="off">' +
        '    <button class="btn-primario ai-send" id="ai-send" type="submit">Enviar</button>' +
        '  </form>' +
        '</section>';
    }

    function enlazarAsistente() {
        var fab = $("#ai-fab");
        var panel = $("#ai-panel");
        var close = $("#ai-close");
        var form = $("#ai-form");
        var input = $("#ai-input");
        var send = $("#ai-send");
        var messages = $("#ai-messages");
        var quick = $("#ai-quick");
        if (!fab || !panel || !form || !input || !messages) return;

        function agregarMensaje(texto, tipo) {
            var el = document.createElement("div");
            el.className = "ai-msg " + tipo;
            el.textContent = String(texto || "");
            messages.appendChild(el);
            messages.scrollTop = messages.scrollHeight;
            return el;
        }

        function abrir() {
            panel.classList.add("abierto");
            fab.setAttribute("aria-expanded", "true");
            if (!messages.children.length) {
                agregarMensaje("Hola 👋 Soy el asistente de MiRuta. Puedo consultar las rutas, tarifas y planes disponibles en la aplicación. También puedo pedirte un dato adicional cuando una pregunta sea ambigua.", "bot");
            }
            setTimeout(function () { input.focus(); }, 50);
        }
        function cerrar() {
            panel.classList.remove("abierto");
            fab.setAttribute("aria-expanded", "false");
        }

        fab.addEventListener("click", function () {
            panel.classList.contains("abierto") ? cerrar() : abrir();
        });
        if (close) close.addEventListener("click", cerrar);

        async function enviar(texto) {
            texto = String(texto || "").trim();
            if (!texto || aiOcupado) return;
            abrir();
            agregarMensaje(texto, "user");
            historialAI.push({ role: "user", text: texto });
            historialAI = historialAI.slice(-6);

            aiOcupado = true;
            input.disabled = true;
            send.disabled = true;
            send.textContent = "...";
            var cargandoMsg = agregarMensaje("Consultando MiRuta...", "system");

            try {
                var r = await MiRutaAI.chat(texto, historialAI.slice(0, -1));
                if (cargandoMsg.parentNode) cargandoMsg.parentNode.removeChild(cargandoMsg);
                agregarMensaje(r.answer, "bot");
                historialAI.push({ role: "model", text: r.answer });
                historialAI = historialAI.slice(-6);

                // Indicador visible para la demostración académica: confirma
                // que la respuesta pasó por Gemini y si se usó una herramienta.
                if (r.model) {
                    var info = "Gemini conectado · " + r.model + (r.usedAgentTools ? " · herramienta: " + r.tools.join(", ") : "");
                    agregarMensaje(info, "system");
                }
            } catch (error) {
                if (cargandoMsg.parentNode) cargandoMsg.parentNode.removeChild(cargandoMsg);
                agregarMensaje(error.message || "No se pudo conectar con la IA.", "system");
            } finally {
                aiOcupado = false;
                input.disabled = false;
                send.disabled = false;
                send.textContent = "Enviar";
                input.focus();
            }
        }

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            var texto = input.value;
            input.value = "";
            enviar(texto);
        });

        if (quick) {
            quick.addEventListener("click", function (e) {
                var button = e.target.closest("[data-ai-question]");
                if (!button) return;
                enviar(button.getAttribute("data-ai-question"));
            });
        }
    }

    // =================================================================
    //  VISTA: PANEL DE ADMINISTRACION
    // =================================================================
    function vistaAdmin(usuario) {
        if (!Auth.esAdmin()) return mensajeVacio("No tienes permisos para acceder al panel de administración.", "rutas", "Volver a rutas");
        var usuarios=DB.getUsuarios(), rutas=DB.getTodasLasRutas(), planes=DB.getTodosLosPlanes(), sus=DB.getTodasSuscripciones(), pagos=DB.getTodosPagos(), viajes=DB.getTodosViajes();
        var activos=usuarios.filter(function(u){return u.activo!==false&&u.rol!=="admin";}).length;
        var ingresos=pagos.filter(function(p){return p.estado==="completado";}).reduce(function(a,p){return a+Number(p.monto||0);},0);
        var usuariosRows=usuarios.map(function(u){var a=DB.getAuthPorUsuario(u.id_usuario)||{};return '<tr><td>#'+u.id_usuario+'</td><td><strong>'+esc(u.nombres+' '+u.apellidos)+'</strong><small class="admin-muted">'+esc(a.correo||'')+'</small></td><td><span class="badge '+(u.rol==='admin'?'admin-badge':'neutro')+'">'+esc(u.rol||'usuario')+'</span></td><td><span class="badge '+(u.activo===false?'error-badge':'ok')+'">'+(u.activo===false?'Inactivo':'Activo')+'</span></td><td><button class="admin-mini-btn" data-admin-user-toggle="'+u.id_usuario+'" '+(u.rol==='admin'?'disabled':'')+'>'+(u.activo===false?'Activar':'Desactivar')+'</button></td></tr>';}).join('');
        var routeRows=rutas.map(function(r){return '<tr><td><strong>'+esc(r.nombre)+'</strong><small class="admin-muted">'+esc(r.numero)+'</small></td><td>'+esc(r.origen)+' → '+esc(r.destino)+'</td><td>'+plata(r.precio_pasaje)+'</td><td>'+esc(r.horario||'—')+'</td><td><span class="badge '+(r.activo===false?'error-badge':'ok')+'">'+(r.activo===false?'Inactiva':'Activa')+'</span></td><td><button class="admin-mini-btn" data-admin-route-toggle="'+r.id_ruta+'">'+(r.activo===false?'Activar':'Desactivar')+'</button></td></tr>';}).join('');
        var planRows=planes.map(function(pl){return '<tr><td><strong>'+esc(pl.nombre)+'</strong></td><td>'+plata(pl.precio_mensual)+'</td><td>'+Number(pl.descuento_pct)+'%</td><td>'+Number(pl.duracion_dias||30)+' días</td><td><span class="badge '+(pl.activo===false?'error-badge':'ok')+'">'+(pl.activo===false?'Inactivo':'Activo')+'</span></td><td><button class="admin-mini-btn" data-admin-plan-toggle="'+pl.id_tipo+'">'+(pl.activo===false?'Activar':'Desactivar')+'</button></td></tr>';}).join('');
        var susRows=sus.length?sus.map(function(x){var u=DB.getUsuarioPorId(x.id_usuario),pl=DB.getPlanPorId(x.id_tipo);return '<tr><td>#'+x.id_suscripcion+'</td><td>'+esc(u?u.nombres+' '+u.apellidos:'Usuario #'+x.id_usuario)+'</td><td>'+esc(pl?pl.nombre:'Plan')+'</td><td>'+esc(x.fecha_inicio)+'</td><td>'+esc(x.fecha_fin)+'</td><td><span class="badge '+(x.estado==='activa'?'ok':'neutro')+'">'+esc(x.estado)+'</span></td><td>'+(x.estado==='activa'?'<button class="admin-mini-btn danger" data-admin-sub-cancel="'+x.id_suscripcion+'">Cancelar</button>':'—')+'</td></tr>';}).join(''):'<tr><td colspan="7" class="admin-empty">No hay suscripciones registradas.</td></tr>';
        var pagoRows=pagos.length?pagos.slice().sort(function(a,b){return new Date(b.creado_en)-new Date(a.creado_en);}).map(function(x){var u=DB.getUsuarioPorId(x.id_usuario);return '<tr><td>'+esc(fechaLegible(x.creado_en))+'</td><td>'+esc(u?u.nombres+' '+u.apellidos:'Usuario #'+x.id_usuario)+'</td><td>'+esc(x.concepto)+'</td><td>'+plata(x.monto)+'</td><td><span class="badge '+(x.estado==='completado'?'ok':'error-badge')+'">'+esc(x.estado)+'</span></td><td>'+esc(x.referencia_externa||'—')+'</td></tr>';}).join(''):'<tr><td colspan="6" class="admin-empty">No hay pagos locales registrados.</td></tr>';
        return ''+
        '<section class="admin-head glass"><div><span class="eyebrow">CENTRO DE CONTROL</span><h1>Administración de MiRuta</h1><p>Gestiona usuarios, rutas, planes, suscripciones, pagos y el asistente IA desde un solo lugar.</p></div><span class="admin-role">Administrador</span></section>'+
        '<section class="admin-stats">'+statAdmin('Usuarios activos',activos,'personas con acceso')+statAdmin('Rutas',rutas.length,'rutas configuradas')+statAdmin('Suscripciones',sus.filter(function(x){return x.estado==='activa';}).length,'activas')+statAdmin('Ingresos locales',plata(ingresos),pagos.length+' pagos')+'</section>'+
        '<div class="admin-grid">'+
        '<section class="panel glass admin-section"><div class="admin-section-head"><div><h2>Usuarios</h2><p>Activa o desactiva cuentas y revisa sus roles.</p></div></div><div class="tabla-wrap"><table class="tabla admin-table"><thead><tr><th>ID</th><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead><tbody>'+usuariosRows+'</tbody></table></div></section>'+
        '<section class="panel glass admin-section"><div class="admin-section-head"><div><h2>Rutas</h2><p>Control rápido del catálogo que consulta el asistente.</p></div><button class="btn-primario admin-add-btn" id="admin-add-route">+ Nueva ruta</button></div><div class="tabla-wrap"><table class="tabla admin-table"><thead><tr><th>Ruta</th><th>Trayecto</th><th>Precio</th><th>Horario</th><th>Estado</th><th>Acción</th></tr></thead><tbody>'+routeRows+'</tbody></table></div></section>'+
        '<section class="panel glass admin-section"><div class="admin-section-head"><div><h2>Planes</h2><p>Gestiona precios y descuentos de suscripción.</p></div><button class="btn-primario admin-add-btn" id="admin-add-plan">+ Nuevo plan</button></div><div class="tabla-wrap"><table class="tabla admin-table"><thead><tr><th>Plan</th><th>Precio</th><th>Descuento</th><th>Duración</th><th>Estado</th><th>Acción</th></tr></thead><tbody>'+planRows+'</tbody></table></div></section>'+
        '<section class="panel glass admin-section"><div class="admin-section-head"><div><h2>Suscripciones</h2><p>Consulta y cancela suscripciones activas.</p></div></div><div class="tabla-wrap"><table class="tabla admin-table"><thead><tr><th>ID</th><th>Usuario</th><th>Plan</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Acción</th></tr></thead><tbody>'+susRows+'</tbody></table></div></section>'+
        '<section class="panel glass admin-section"><div class="admin-section-head"><div><h2>Pagos</h2><p>Resumen de pagos registrados por MiRuta.</p></div></div><div class="tabla-wrap"><table class="tabla admin-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Concepto</th><th>Monto</th><th>Estado</th><th>Referencia</th></tr></thead><tbody>'+pagoRows+'</tbody></table></div></section>'+
        '<section class="panel glass admin-section"><div class="admin-section-head"><div><h2>Asistente IA</h2><p>Comprueba la configuración de Gemini y ejecuta una prueba.</p></div><button class="btn-secundario" id="admin-ai-test">Probar Gemini</button></div><div id="admin-ai-status" class="admin-ai-status"><span class="status-dot"></span><span>Sin comprobar</span></div><p class="admin-help">El asistente utiliza los datos de rutas y planes de MiRuta. Si cambias el catálogo aquí, la IA recibe esos datos en la siguiente consulta.</p></section>'+
        '<section class="panel glass admin-section"><div class="admin-section-head"><div><h2>Actividad</h2><p>Indicadores generales del sistema.</p></div></div><div class="admin-activity"><div><strong>'+viajes.length+'</strong><span>viajes registrados</span></div><div><strong>'+pagos.length+'</strong><span>pagos locales</span></div><div><strong>'+usuarios.length+'</strong><span>cuentas totales</span></div></div></section>'+
        '</div>';
    }
    function statAdmin(titulo,valor,detalle){return '<div class="admin-stat glass"><span>'+esc(titulo)+'</span><strong>'+esc(valor)+'</strong><small>'+esc(detalle)+'</small></div>';}
    function abrirAdminModal(tipo){
        var esRuta=tipo==='ruta', overlay=document.createElement('div'); overlay.className='modal-overlay';
        overlay.innerHTML='<div class="modal glass admin-modal"><button class="modal-cerrar" id="admin-modal-close">×</button><h2>'+(esRuta?'Nueva ruta':'Nuevo plan')+'</h2><div class="admin-form-grid">'+(esRuta?
        '<div class="campo"><label>Nombre</label><input id="adm-nombre" placeholder="Ej. Ruta Centro"></div><div class="campo"><label>Número</label><input id="adm-numero" placeholder="R-01"></div><div class="campo"><label>Origen</label><input id="adm-origen" placeholder="Origen"></div><div class="campo"><label>Destino</label><input id="adm-destino" placeholder="Destino"></div><div class="campo"><label>Precio</label><input id="adm-precio" type="number" min="0" placeholder="2800"></div><div class="campo"><label>Horario</label><input id="adm-horario" placeholder="5:00 AM - 10:00 PM"></div><div class="campo"><label>Frecuencia</label><input id="adm-frecuencia" placeholder="10 minutos"></div><div class="campo"><label>Color</label><input id="adm-color" type="color" value="#0f766e"></div>':
        '<div class="campo"><label>Nombre</label><input id="adm-nombre" placeholder="Ej. Premium"></div><div class="campo"><label>Precio mensual</label><input id="adm-precio" type="number" min="0" placeholder="30000"></div><div class="campo"><label>Descuento %</label><input id="adm-descuento" type="number" min="0" max="100" placeholder="25"></div><div class="campo"><label>Duración (días)</label><input id="adm-duracion" type="number" min="1" placeholder="30"></div><div class="campo admin-field-full"><label>Descripción</label><input id="adm-descripcion" placeholder="Descripción del beneficio"></div>')+'</div><div id="admin-modal-msg" class="msg"></div><button class="btn-primario" id="admin-modal-save">Guardar</button></div>';
        document.body.appendChild(overlay); function cerrar(){if(overlay.parentNode)overlay.parentNode.removeChild(overlay);}
        $('#admin-modal-close',overlay).addEventListener('click',cerrar);
        $('#admin-modal-save',overlay).addEventListener('click',function(){var msg=$('#admin-modal-msg',overlay);if(esRuta){var n=$('#adm-nombre',overlay).value.trim(),o=$('#adm-origen',overlay).value.trim(),d=$('#adm-destino',overlay).value.trim();if(!n||!o||!d){msg.textContent='Completa nombre, origen y destino.';msg.className='msg error';return;}DB.crearRutaAdmin({nombre:n,numero:$('#adm-numero',overlay).value,origen:o,destino:d,precio_pasaje:Number($('#adm-precio',overlay).value)||0,horario:$('#adm-horario',overlay).value,frecuencia:$('#adm-frecuencia',overlay).value,color:$('#adm-color',overlay).value});}else{var pl=$('#adm-nombre',overlay).value.trim();if(!pl){msg.textContent='Escribe el nombre del plan.';msg.className='msg error';return;}DB.crearPlanAdmin({nombre:pl,precio_mensual:Number($('#adm-precio',overlay).value)||0,descuento_pct:Number($('#adm-descuento',overlay).value)||0,duracion_dias:Number($('#adm-duracion',overlay).value)||30,descripcion:$('#adm-descripcion',overlay).value});}cerrar();render();});
    }
    function enlazarAdmin(){
        if(!Auth.esAdmin())return;
        $all('[data-admin-user-toggle]').forEach(function(btn){btn.addEventListener('click',function(){var id=Number(btn.getAttribute('data-admin-user-toggle')),u=DB.getUsuarioPorId(id);if(u)DB.actualizarUsuarioAdmin(id,{activo:u.activo===false});render();});});
        $all('[data-admin-route-toggle]').forEach(function(btn){btn.addEventListener('click',function(){var id=Number(btn.getAttribute('data-admin-route-toggle')),r=DB.getRutaPorId(id);if(r)DB.actualizarRutaAdmin(id,{activo:r.activo===false});render();});});
        $all('[data-admin-plan-toggle]').forEach(function(btn){btn.addEventListener('click',function(){var id=Number(btn.getAttribute('data-admin-plan-toggle')),pl=DB.getPlanPorId(id);if(pl)DB.actualizarPlanAdmin(id,{activo:pl.activo===false});render();});});
        $all('[data-admin-sub-cancel]').forEach(function(btn){btn.addEventListener('click',function(){if(confirm('¿Cancelar esta suscripción?')){DB.adminCancelarSuscripcion(Number(btn.getAttribute('data-admin-sub-cancel')));render();}});});
        var ar=$('#admin-add-route');if(ar)ar.addEventListener('click',function(){abrirAdminModal('ruta');});
        var ap=$('#admin-add-plan');if(ap)ap.addEventListener('click',function(){abrirAdminModal('plan');});
        var at=$('#admin-ai-test');if(at)at.addEventListener('click',async function(){var st=$('#admin-ai-status');at.disabled=true;at.textContent='Comprobando...';try{var r=await fetch('/api/health'),d=await r.json();if(d.aiConfigured)st.innerHTML='<span class="status-dot ok-dot"></span><span>Gemini activo · '+esc(d.aiModel||'modelo configurado')+'</span>';else st.innerHTML='<span class="status-dot error-dot"></span><span>Gemini no está configurado en el servidor.</span>';}catch(e){st.innerHTML='<span class="status-dot error-dot"></span><span>No se pudo consultar el servidor.</span>';}at.disabled=false;at.textContent='Probar Gemini';});
    }

    // =================================================================
    //  UTILIDADES DE UI
    // =================================================================

    // Estado vacío reutilizable con botón de acción.
    function mensajeVacio(texto, vistaDestino, etiquetaBoton) {
        return '' +
        '<div class="vacio panel glass">' +
        '  <p>' + esc(texto) + '</p>' +
        '  <button class="btn-primario" data-ir="' + vistaDestino + '">' + esc(etiquetaBoton) + '</button>' +
        '</div>';
    }

    // Pone/quita estado "cargando" en un botón.
    function cargando(btn, on, texto) {
        if (!btn) return;
        btn.disabled = on;
        if (texto) btn.textContent = texto;
        btn.classList.toggle("cargando", on);
    }

    // Conecta botones genéricos data-ir="vista".
    function enlazarIrGenerico() {
        $all("[data-ir]").forEach(function (b) {
            b.addEventListener("click", function () { ir(b.getAttribute("data-ir")); });
        });
    }

    // Conecta los handlers según la vista activa.
    function enlazarVista(usuario) {
        enlazarIrGenerico();
        switch (estado.vista) {
            case "rutas": enlazarRutas(); break;
            case "detalle": enlazarDetalle(); break;
            case "suscripcion": enlazarSuscripcion(usuario); break;
            case "perfil": enlazarPerfil(usuario); break;
            case "historial": /* sin handlers extra */ break;
            case "admin": enlazarAdmin(); break;
        }
    }

    // =================================================================
    //  ARRANQUE
    // =================================================================
    document.addEventListener("DOMContentLoaded", function () {
        $app = document.getElementById("app");
        render();
    });
})();
