// =====================================================================
// payment.js — Integración REAL con Wompi + registro local de la app
//
// IMPORTANTE:
// - Este archivo NO contiene llaves privadas ni secretos.
// - El backend (/api/wompi/...) genera la firma de integridad y consulta
//   el estado real de las transacciones.
// - El navegador abre el Widget oficial de Wompi; nunca pedimos el número
//   de tarjeta dentro de MiRuta.
// =====================================================================

(function () {
    "use strict";

    function calcularPrecioFinal(base, descuentoPct) {
        var b = Number(base);
        var pct = Number(descuentoPct) || 0;
        var final = b - (b * pct / 100);
        return Math.round(final * 100) / 100;
    }

    async function prepararPago(datos) {
        var resp;
        try {
            resp = await fetch("/api/wompi/prepare", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    concepto: datos.concepto,
                    monto: datos.monto,
                    id_usuario: datos.id_usuario,
                    id_tipo: datos.id_tipo || null,
                    id_ruta: datos.id_ruta || null
                })
            });
        } catch (e) {
            return { ok: false, error: "No se pudo conectar con el servidor de pagos." };
        }

        var data = {};
        try { data = await resp.json(); } catch (e) {}

        if (!resp.ok || !data.ok) {
            return {
                ok: false,
                error: data.error || "No fue posible preparar el pago con Wompi."
            };
        }
        return data;
    }

    function normalizarMetodo(tipo) {
        var t = String(tipo || "").toUpperCase();
        if (t === "CARD") return "tarjeta";
        if (t === "PSE") return "pse";
        if (t === "NEQUI") return "nequi";
        if (t === "BANCOLOMBIA_TRANSFER") return "otro";
        return "otro";
    }

    async function consultarTransaccion(transactionId) {
        var resp;
        try {
            resp = await fetch("/api/wompi/transactions/" + encodeURIComponent(transactionId));
        } catch (e) {
            return { ok: false, error: "No se pudo verificar la transacción." };
        }

        var data = {};
        try { data = await resp.json(); } catch (e) {}

        if (!resp.ok || !data.ok) {
            return { ok: false, error: data.error || "No se pudo consultar el estado del pago." };
        }
        return data;
    }

    function abrirWidget(config, callback) {
        if (typeof window.WidgetCheckout !== "function") {
            return {
                ok: false,
                error: "No se cargó el Widget de Wompi. Verifica tu conexión a Internet."
            };
        }

        try {
            var checkout = new window.WidgetCheckout({
                currency: "COP",
                amountInCents: config.amountInCents,
                reference: config.reference,
                publicKey: config.publicKey,
                signature: { integrity: config.integrity },
                customerData: config.customerData || undefined
            });

            checkout.open(function (result) {
                callback(result && result.transaction ? result.transaction : null);
            });

            return { ok: true };
        } catch (e) {
            console.error("Wompi Widget:", e);
            return { ok: false, error: "No fue posible abrir el checkout de Wompi." };
        }
    }

    // Abre Wompi y espera a que el backend confirme el estado real.
    async function iniciarPago(datos) {
        var preparado = await prepararPago(datos);
        if (!preparado.ok) return preparado;

        var apertura = abrirWidget(preparado, async function (transaction) {
            if (!transaction || !transaction.id) {
                datos.onResultado({ ok: false, error: "Wompi no devolvió el identificador de la transacción." });
                return;
            }

            // El callback del navegador no se toma como prueba suficiente.
            // El backend consulta Wompi con la llave privada.
            var verificacion = await consultarTransaccion(transaction.id);

            if (!verificacion.ok) {
                datos.onResultado(verificacion);
                return;
            }

            datos.onResultado({
                ok: verificacion.status === "APPROVED",
                status: verificacion.status,
                transaction: verificacion.transaction,
                reference: preparado.reference,
                error: verificacion.status === "APPROVED"
                    ? null
                    : ("El pago terminó con estado: " + verificacion.status)
            });
        });

        if (!apertura.ok) return apertura;
        return { ok: true, waiting: true, reference: preparado.reference };
    }

    async function comprarSuscripcion(idUsuario, idTipo, onResultado) {
        var plan = DB.getPlanPorId(idTipo);
        if (!plan) {
            return { ok: false, error: "El plan seleccionado no existe." };
        }

        return iniciarPago({
            id_usuario: idUsuario,
            id_tipo: idTipo,
            concepto: "suscripcion",
            monto: Number(plan.precio_mensual),
            onResultado: async function (resultado) {
                if (!resultado.ok) {
                    onResultado(resultado);
                    return;
                }

                var inicio = new Date();
                var fin = new Date();
                fin.setDate(fin.getDate() + plan.duracion_dias);

                var pago = DB.crearPago({
                    id_usuario: idUsuario,
                    concepto: "suscripcion",
                    monto: plan.precio_mensual,
                    proveedor: "Wompi",
                    referencia_externa: resultado.transaction.id,
                    metodo: normalizarMetodo(resultado.transaction.payment_method_type),
                    estado: "completado"
                });

                var suscripcion = DB.crearSuscripcion({
                    id_usuario: idUsuario,
                    id_tipo: idTipo,
                    fecha_inicio: aIsoFecha(inicio),
                    fecha_fin: aIsoFecha(fin)
                });

                onResultado({
                    ok: true,
                    pago: pago,
                    suscripcion: suscripcion,
                    plan: plan,
                    transaction: resultado.transaction
                });
            }
        });
    }

    async function registrarViaje(idUsuario, idRuta, onResultado) {
        var ruta = DB.getRutaPorId(idRuta);
        if (!ruta) {
            return { ok: false, error: "La ruta seleccionada no existe." };
        }

        var precioBase = Number(ruta.precio_pasaje);
        var suscripcion = DB.getSuscripcionActiva(idUsuario);
        var plan = suscripcion ? DB.getPlanPorId(suscripcion.id_tipo) : null;
        var descuentoPct = plan ? Number(plan.descuento_pct) : 0;
        var precioFinal = calcularPrecioFinal(precioBase, descuentoPct);

        return iniciarPago({
            id_usuario: idUsuario,
            id_ruta: idRuta,
            concepto: "pasaje",
            monto: precioFinal,
            onResultado: function (resultado) {
                if (!resultado.ok) {
                    onResultado(resultado);
                    return;
                }

                var pago = DB.crearPago({
                    id_usuario: idUsuario,
                    concepto: "pasaje",
                    monto: precioFinal,
                    proveedor: "Wompi",
                    referencia_externa: resultado.transaction.id,
                    metodo: normalizarMetodo(resultado.transaction.payment_method_type),
                    estado: "completado"
                });

                var viaje = DB.crearViaje({
                    id_usuario: idUsuario,
                    id_ruta: idRuta,
                    id_pago: pago.id_pago,
                    precio_base: precioBase,
                    descuento_pct: descuentoPct,
                    precio_final: precioFinal
                });

                onResultado({
                    ok: true,
                    viaje: viaje,
                    plan: plan,
                    pago: pago,
                    transaction: resultado.transaction
                });
            }
        });
    }

    function aIsoFecha(fecha) {
        var y = fecha.getFullYear();
        var m = String(fecha.getMonth() + 1).padStart(2, "0");
        var d = String(fecha.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + d;
    }

    window.Payment = {
        comprarSuscripcion: comprarSuscripcion,
        registrarViaje: registrarViaje,
        consultarTransaccion: consultarTransaccion,
        calcularPrecioFinal: calcularPrecioFinal
    };
})();
