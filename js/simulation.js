/**
 * MÃS ALLÃ DE LO SALVAJE - Motor de SimulaciÃ³n por Turnos
 * Sistema de extracciÃ³n de recursos, poblaciÃ³n y ciclo econÃ³mico
 */

// =====================================================
// ESTADO DE SIMULACIÃ“N
// =====================================================
let estadoSimulacion = {
    turno: 0,
    // Cuotas de poblaciÃ³n: [{ id, rol, naturaleza, medidas, asignacion }]
    poblacion: [],
    // AlmacÃ©n: { "Madera Ãštil": 0, ... }
    almacen: {},
    // EconomÃ­a
    doblones: 0,
    alimentos: 0,
    // InmigraciÃ³n latente por tipo de poblaciÃ³n
    inmigracionPendientePorTipo: {
        Neutral: 0,
        Positiva: 0,
        Negativa: 0,
        Monstruo: 0,
        Artificial: 0
    },
    // Tipo de poblaciÃ³n para inmigraciÃ³n externa
    tipoInmigracion: "Neutral",
    // Subtipo para inmigraciÃ³n Artificial (Neutral, Positiva, Negativa, Monstruo)
    subtipoInmigracionArtificial: "Neutral",
    // Recursos especiales (no ocupan almacÃ©n)
    recursosEspeciales: {
        ideas: 0,
        influencia: 0
    },
    // Estado de edificios: { nombreEdificio: { grado, cuotasAsignadas, recetaActual } }
    edificiosEstado: {},
    // Log del Ãºltimo turno
    logTurno: [],
    // Historial de turnos para deshacer (Ãºltimos 5 snapshots)
    historialTurnos: [],
    // Construcciones en progreso: [{ id, nombre, turnosRestantes, turnosTotales, poblacionAsignada, costoOpcion }]
    construccionesEnProgreso: [],
    // Historial de comercio: [{ turno, recurso, cantidad, tipo: 'entrada'|'salida', comerciante }]
    historialComercio: [],
    // Estado de DevociÃ³n
    estadoDevocion: {
        // Pool de puntos por tipo de devociÃ³n (cap 100 cada uno)
        poolPorTipo: { Positiva: 0, Negativa: 0, Neutral: 0, Salvaje: 0 },
        // Flag de sincretismo activo
        isSyncretic: false,
        // Tipos en sincretismo (mÃ¡x 2)
        syncreticTypes: [],
        // Tipo de devociÃ³n dominante (con mÃ¡s devotos)
        dominantType: null,
        // Flag de sacrilegio (devociones opuestas activas)
        sacrilegio: false,
        // Contador de turnos de sacrilegio
        turnosSacrilegio: 0
    }
};

/**
 * Carga un estado de simulaciÃ³n existente
 */
function cargarEstadoSimulacion(estadoGuardado) {
    if (estadoGuardado) {
        estadoSimulacion = { ...estadoGuardado };

        // Copia profunda de poblacion
        if (estadoGuardado.poblacion) {
            estadoSimulacion.poblacion = JSON.parse(JSON.stringify(estadoGuardado.poblacion));
        }
        if (estadoGuardado.almacen) {
            estadoSimulacion.almacen = { ...estadoGuardado.almacen };
        }

        // === MIGRACIÃ“N: inmigracionPendiente => inmigracionPendientePorTipo ===
        if (typeof estadoGuardado.inmigracionPendiente === 'number' && !estadoGuardado.inmigracionPendientePorTipo) {
            // Migrar el valor antiguo al tipo "Neutral"
            estadoSimulacion.inmigracionPendientePorTipo = {
                Neutral: estadoGuardado.inmigracionPendiente,
                Positiva: 0,
                Negativa: 0,
                Monstruo: 0,
                Artificial: 0
            };
            delete estadoSimulacion.inmigracionPendiente;
        }

        // Asegurar que exista tipoInmigracion
        if (!estadoSimulacion.tipoInmigracion) {
            estadoSimulacion.tipoInmigracion = "Neutral";
        }
    }
}

// =====================================================
// INICIALIZACIÃ“N DE POBLACIÃ“N
// =====================================================

/**
 * Crea la poblaciÃ³n inicial del asentamiento
 * @param {Array} configuracion - [{rol: "Plebeyo", naturaleza: "Neutral", cantidad: 2, subtipo: "Neutral"}, ...]
 */
function inicializarPoblacion(configuracion) {
    estadoSimulacion.poblacion = [];
    let idCounter = 1;

    configuracion.forEach(config => {
        for (let i = 0; i < config.cantidad; i++) {
            const cuota = {
                id: idCounter++,
                rol: config.rol,
                naturaleza: config.naturaleza,
                medidas: CONVERSION.CUOTA_POBLACION,
                asignacion: null
            };

            // Para Artificiales, agregar subtipo (default: Neutral)
            if (config.naturaleza === "Artificial") {
                cuota.subtipo = config.subtipo || "Neutral";
            }

            estadoSimulacion.poblacion.push(cuota);
        }
    });

    return estadoSimulacion.poblacion;
}

/**
 * Obtiene el total de poblaciÃ³n en medidas
 */
function obtenerPoblacionTotal() {
    return estadoSimulacion.poblacion.reduce((sum, cuota) => sum + cuota.medidas, 0);
}

/**
 * Obtiene el total de cuotas de un rol especÃ­fico
 */
function obtenerCuotasPorRol(rol) {
    return estadoSimulacion.poblacion.filter(c => c.rol === rol);
}

// =====================================================
// ASIGNACIÃ“N DE TRABAJO
// =====================================================

/**
 * Asigna una cuota de poblaciÃ³n a trabajar un recurso
 * @param {number} cuotaId - ID de la cuota
 * @param {string|null} recurso - Nombre del recurso o null para desasignar
 */
function asignarTrabajo(cuotaId, recurso) {
    const cuota = estadoSimulacion.poblacion.find(c => c.id === cuotaId);
    if (cuota) {
        cuota.asignacion = recurso;
        return true;
    }
    return false;
}

/**
 * Obtiene las cuotas asignadas a un recurso
 */
function obtenerTrabajadoresRecurso(recurso) {
    return estadoSimulacion.poblacion.filter(c => c.asignacion === recurso);
}

// =====================================================
// CÃLCULO DE EXTRACCIÃ“N
// =====================================================

/**
 * Calcula la producciÃ³n pasiva de un recurso (sin trabajadores asignados)
 * FÃ³rmula: (Mod_Abundancia + Mod_Propiedades) - 1
 * Si el resultado es < 0, la producciÃ³n es 0.
 */
function calcularExtraccionPasiva(recurso, abundancia, modPropiedades) {
    // Obtener modificador de abundancia (-2, 0, +1, +2, etc)
    // Nota: Necesitamos acceder a obtenerModificadorAbundancia desde data.js
    // Si no estÃ¡ global, usamos el objeto directamente
    const modAbundancia = NIVELES_ABUNDANCIA[abundancia]?.modificador ?? 0;

    // Formula: (ModAbundancia + ModBioma) - 1
    const produccion = (modAbundancia + modPropiedades) - 1;

    return Math.max(0, produccion);
}

/**
 * Calcula la producciÃ³n activa de un recurso (con trabajadores asignados)
 * FÃ³rmula: Mod_Abundancia + Mod_Propiedades + 2 + (trabajadores adicionales) + Calidad/5
 * El primer trabajador produce 2, cada trabajador adicional produce 1
 * (No se multiplica por 10, el resultado son Medidas directas)
 */
function calcularExtraccionActiva(recurso, abundancia, modPropiedades, calidad, numTrabajadores) {
    const modAbundancia = NIVELES_ABUNDANCIA[abundancia]?.modificador ?? 0;

    // Primer trabajador produce 2, cada adicional produce 1
    // Eso equivale a: 2 + (numTrabajadores - 1) = numTrabajadores + 1
    // + Mod_Abundancia + Mod_Propiedades + Calidad / 5

    const base = modAbundancia + modPropiedades + numTrabajadores + 1 + (calidad / 5);

    const produccionTotal = Math.floor(base);

    return Math.max(0, produccionTotal);
}

/**
 * Calcula la producciÃ³n total de todos los recursos
 * @param {object} recursos - { nombreRecurso: { abundancia, modPropiedades } }
 * @param {number} calidad - Calidad total del asentamiento
 * @param {object} bonificaciones - { "nombreRecurso": valor } bonificadores de peculiaridades/propiedades
 */
function calcularProduccionTotal(recursos, calidad, bonificaciones = {}) {
    const produccion = {};

    Object.entries(recursos).forEach(([nombre, data]) => {
        const trabajadores = obtenerTrabajadoresRecurso(nombre);
        const numTrabajadores = trabajadores.length;

        // modPropiedades base del recurso + bonificadores de peculiaridades/propiedades
        let modTotal = data.modPropiedades || 0;

        // Aplicar bonificaciones especÃ­ficas del recurso
        if (bonificaciones[nombre]) {
            modTotal += bonificaciones[nombre];
        }

        // Aplicar bonificaciones con "Cualquier" (ej: "Cualquier pesca: +1")
        Object.entries(bonificaciones).forEach(([key, valor]) => {
            if (key.startsWith('Cualquier ')) {
                const tipo = key.replace('Cualquier ', '').toLowerCase();
                if (nombre.toLowerCase().includes(tipo)) {
                    modTotal += valor;
                }
            }
        });

        if (numTrabajadores > 0) {
            produccion[nombre] = {
                tipo: "activa",
                medidas: calcularExtraccionActiva(nombre, data.abundancia, modTotal, calidad, numTrabajadores),
                trabajadores: numTrabajadores
            };
        } else {
            // Recursos exÃ³ticos NO tienen producciÃ³n pasiva - solo activa con trabajadores
            const esExotico = data.esExotico === true;
            produccion[nombre] = {
                tipo: "pasiva",
                medidas: esExotico ? 0 : calcularExtraccionPasiva(nombre, data.abundancia, modTotal),
                trabajadores: 0,
                esExotico: esExotico
            };
        }
    });

    return produccion;
}

/**
 * Asigna una cuota de poblaciÃ³n a un recurso especÃ­fico
 */
function asignarPoblacionARecurso(idCuota, nombreRecurso) {
    const cuota = estadoSimulacion.poblacion.find(c => c.id === parseInt(idCuota));
    if (cuota) {
        cuota.asignacion = nombreRecurso;
        return true;
    }
    return false;
}

// =====================================================
// CICLO DE TURNO
// =====================================================

/**
 * Ejecuta un turno completo (3 fases)
 * @param {object} asentamiento - El asentamiento actual
 * @returns {object} Resultado del turno con sustento, economia, crecimiento
 */
function ejecutarTurno(asentamiento) {
    // Defensive check
    if (!asentamiento) {
        console.error('ejecutarTurno: asentamiento is null or undefined');
        return { error: 'No settlement provided', turno: estadoSimulacion.turno };
    }

    // Save snapshot for undo functionality BEFORE making changes
    if (typeof guardarSnapshotTurno === 'function') {
        guardarSnapshotTurno(asentamiento);
    }

    // Initialize log array
    estadoSimulacion.logTurno = [];
    estadoSimulacion.turno++;

    logear(`â•â•â• TURNO ${estadoSimulacion.turno} â•â•â•`);

    try {
        // Fase 1: Sustento
        const resultadoSustento = faseAlimentacion();

        // Fase 2: EconomÃ­a
        const resultadoEconomia = faseEconomia(asentamiento);

        // Fase 2.5: Avanzar construcciones si existe la funciÃ³n
        if (typeof avanzarConstrucciones === 'function') {
            avanzarConstrucciones(asentamiento);
        }

        // Fase 3: Crecimiento
        const resultadoCrecimiento = faseCrecimiento(asentamiento);

        // Fase 4: DevociÃ³n (generar puntos por devotos)
        const resultadoDevocion = faseDevocion();

        return {
            turno: estadoSimulacion.turno,
            sustento: resultadoSustento,
            economia: resultadoEconomia,
            crecimiento: resultadoCrecimiento,
            devocion: resultadoDevocion,
            log: estadoSimulacion.logTurno
        };
    } catch (error) {
        console.error('Error en ejecutarTurno:', error);
        logear(`âŒ Error durante el turno: ${error.message}`);
        return {
            turno: estadoSimulacion.turno,
            error: error.message,
            log: estadoSimulacion.logTurno
        };
    }
}

/**
 * Fase 1: AlimentaciÃ³n
 * Cada Cuota completa consume 1 medida de alimento
 */
function faseAlimentacion() {
    logear("ðŸ“ Fase 1: Sustento");

    // Calcular cuotas que consumen alimentos (excluir Artificiales)
    const cuotasQueConsumen = estadoSimulacion.poblacion.filter(c => {
        // Artificiales NUNCA consumen alimento
        if (c.naturaleza === "Artificial") return false;
        const nat = NATURALEZAS_POBLACION[c.naturaleza];
        return nat?.consumeAlimento !== false; // Por defecto true
    });

    const numCuotas = cuotasQueConsumen.length;
    const alimentosNecesarios = numCuotas; // 1 medida por cuota

    // Sumar todos los recursos categorizados como "Alimento"
    let poolAlimentos = 0;
    const recursosAlmacen = Object.entries(estadoSimulacion.almacen || {});

    recursosAlmacen.forEach(([nombre, cantidad]) => {
        if (RECURSOS[nombre]?.categoria === "Alimento") {
            poolAlimentos += cantidad;
        }
    });

    let hambruna = false;
    let consumido = 0;

    if (poolAlimentos >= alimentosNecesarios) {
        // Consumir proporcionalmente o secuencialmente
        // Secuencial es mÃ¡s sencillo y predecible
        let restante = alimentosNecesarios;

        // Orden de preferencia: "Alimento" genÃ©rico primero, luego el resto
        const listaAlimentos = recursosAlmacen
            .filter(([n]) => RECURSOS[n]?.categoria === "Alimento")
            .sort((a, b) => (a[0] === "Alimento" ? -1 : 1));

        for (const [nombre, cantidad] of listaAlimentos) {
            if (restante <= 0) break;
            const aConsumir = Math.min(cantidad, restante);
            estadoSimulacion.almacen[nombre] -= aConsumir;
            restante -= aConsumir;
            consumido += aConsumir;
        }

        logear(`  âœ“ Alimentados: ${numCuotas} cuotas (${consumido} medidas)`);
    } else {
        // Consumir todo lo que hay
        recursosAlmacen.forEach(([nombre, cantidad]) => {
            if (RECURSOS[nombre]?.categoria === "Alimento") {
                estadoSimulacion.almacen[nombre] = 0;
                consumido += cantidad;
            }
        });

        hambruna = true;
        logear(`  âš ï¸ HAMBRUNA: Solo ${consumido}/${alimentosNecesarios} medidas disponibles`);

        // En hambruna: muertes aleatorias (1d4)
        const muertes = Math.floor(Math.random() * 4) + 1;
        aplicarMuertes(muertes);
        logear(`  ðŸ’€ Muertes por hambruna: ${muertes}`);
    }

    return { hambruna, consumido, necesarios: alimentosNecesarios };
}

/**
 * Fase 2: EconomÃ­a
 * ProducciÃ³n, tributos, mantenimiento
 */
function faseEconomia(asentamiento) {
    logear("ðŸ“ Fase 2: EconomÃ­a");

    // Calcular calidad total
    const stats = calcularEstadisticasTotales(asentamiento);
    const calidad = stats.calidadTotal;

    // ProducciÃ³n de recursos
    const produccion = calcularProduccionTotal(asentamiento.recursos || {}, calidad);

    // Sumar al almacÃ©n
    let totalProducido = 0;
    Object.entries(produccion).forEach(([recurso, data]) => {
        if (data.medidas > 0) {
            estadoSimulacion.almacen[recurso] = (estadoSimulacion.almacen[recurso] || 0) + data.medidas;
            totalProducido += data.medidas;
        }
    });

    // Sumar producciÃ³n de Edificios al almacÃ©n
    const produccionEdificios = calcularProduccionEdificios(asentamiento.edificios || [], stats);

    Object.entries(produccionEdificios).forEach(([recurso, data]) => {
        // Handle Doblones specially - they go to doblones, not almacen
        if (recurso === "Doblones") {
            if (data.total > 0) {
                estadoSimulacion.doblones += data.total;
                logear(`  ðŸ’° ProducciÃ³n de edificios: +${data.total} Doblones`);
            }
            return;
        }

        // Handle positive production
        if (data.total > 0) {
            estadoSimulacion.almacen[recurso] = (estadoSimulacion.almacen[recurso] || 0) + data.total;
            totalProducido += data.total;
        }
        // Handle consumption (negative total)
        else if (data.total < 0) {
            // Ensure we don't go below zero
            // (Strictly speaking, we should have checked availability BEFORE this phase, 
            // but for now we deduct what we can or go to zero?)
            // The simulation loop calculated consumption based on *potential*, we should deduct it.
            // If storage goes negative, we clamp to 0 (loss of efficiency was not simulated yet).
            estadoSimulacion.almacen[recurso] = (estadoSimulacion.almacen[recurso] || 0) + data.total;
            if (estadoSimulacion.almacen[recurso] < 0) {
                // Log shortage?
                logear(`  âš ï¸ Escasez de insumos: ${recurso}`);
                estadoSimulacion.almacen[recurso] = 0;
            }
        }
    });

    logear(`  ðŸ“¦ ProducciÃ³n total: ${totalProducido} medidas`);

    // Tributos
    const cuotasPoblacion = estadoSimulacion.poblacion.length;
    const tributoData = TRIBUTOS[asentamiento.tributo] || TRIBUTOS["Sin Tributo"];
    const dobleonesTributo = cuotasPoblacion * tributoData.doblones;
    estadoSimulacion.doblones += dobleonesTributo;

    if (dobleonesTributo > 0) {
        logear(`  ðŸ’° Tributos recaudados: ${dobleonesTributo} doblones`);
    }

    // --- MANTENIMIENTO EDIFICIOS ---
    let mantDoblones = 0;
    let mantRecursos = {};
    const edificiosList = asentamiento.edificios || [];

    // Obtener modificador global de Mantenimiento desde las stats (Bioma/Propiedades)
    // Nota: "stats" ya se calculÃ³ arriba en lÃ­nea 304
    const modMantenimientoGlobal = stats.bonificaciones["Mantenimiento"] || 0;

    edificiosList.forEach(item => {
        const nombre = (typeof item === 'string') ? item : item.nombre;
        const itemInstancia = (typeof item === 'object') ? item : null;

        // Obtener estado real (grado)
        let grado = 1;
        if (itemInstancia && itemInstancia.id && estadoSimulacion.edificiosEstado[itemInstancia.id]) {
            grado = estadoSimulacion.edificiosEstado[itemInstancia.id].grado || 1;
        }

        const edificio = EDIFICIOS[nombre];
        if (!edificio) return;

        // Mantenimiento Base (V6 uses edificio.mantenimiento.Doblones)
        let baseDoblones = 0;

        if (edificio.mantenimiento) {
            baseDoblones = edificio.mantenimiento.Doblones || 0;
            // Si hay otros recursos de mantenimiento, sumarlos a mantRecursos
            Object.entries(edificio.mantenimiento).forEach(([k, v]) => {
                if (k !== 'Doblones') mantRecursos[k] = (mantRecursos[k] || 0) + v;
            });
        }
        // Legacy support
        else if (edificio.maintenance) {
            baseDoblones = edificio.maintenance;
        }

        // Aplicar Modificador Global al Mantenimiento en Doblones de ESTE edificio
        // "Que el Mantenimiento en Stats_Invertidas se le sume al valor del Mantenimiento de cualquier edificio."
        let costeFinal = baseDoblones + modMantenimientoGlobal;

        // Evitar costes negativos (Â¿o permitimos descuentos que den dinero? Asumimos coste >= 0)
        if (costeFinal < 0) costeFinal = 0;

        mantDoblones += costeFinal;
    });

    if (mantDoblones > 0) {
        estadoSimulacion.doblones -= mantDoblones;
        logear(`  ðŸ’¸ Mantenimiento pagado: ${mantDoblones} Doblones`);
        // Handle Debt? Simple for now.
    }

    // Deduct Resource Maintenance
    Object.entries(mantRecursos).forEach(([k, v]) => {
        // Maintenance Logic
        if (estadoSimulacion.almacen[k] && estadoSimulacion.almacen[k] >= v) {
            estadoSimulacion.almacen[k] -= v;
            if (estadoSimulacion.almacen[k] <= 0) delete estadoSimulacion.almacen[k];
            logear(`  ðŸ’¸ Mantenimiento pagado: ${v} ${k}`);
        } else {
            // Not enough maintenance resources?
            logear(`  âš ï¸ Falta mantenimiento: ${v} ${k}`);
        }
    });

    // --- MANTENIMIENTO POBLACIÃ“N ARTIFICIAL ---
    let mantArtificial = 0;
    estadoSimulacion.poblacion.forEach(cuota => {
        const nat = NATURALEZAS_POBLACION[cuota.naturaleza];
        if (cuota.naturaleza === "Artificial") {
            mantArtificial += 1; // 1 Doblón per Artificial quota
        }
    });

    if (mantArtificial > 0) {
        estadoSimulacion.doblones -= mantArtificial;
        logear(`  ðŸ¤– Mantenimiento Artificial: ${mantArtificial} Doblones`);
    }

    return { produccion, tributos: dobleonesTributo, mantenimiento: mantDoblones + mantArtificial };
}

/**
 * Fase 3: Crecimiento poblacional
 */
function faseCrecimiento(asentamiento) {
    logear("ðŸ“ Fase 3: Crecimiento");

    const stats = calcularEstadisticasTotales(asentamiento);
    let calidad = stats.calidadTotal;
    const gradoData = GRADOS[asentamiento.grado];

    // Inicializar tracking por tipo si no existe
    if (!estadoSimulacion.inmigracionPendientePorTipo) {
        estadoSimulacion.inmigracionPendientePorTipo = {
            Neutral: 0, Positiva: 0, Negativa: 0, Monstruo: 0, Artificial: 0
        };
    }

    // CÃLCULO DE HAMBRUNA (excluyendo Artificiales)
    const recursos = asentamiento.recursos || {};
    const produccionBioma = calcularProduccionTotal(recursos, calidad, stats.bonificaciones || {});
    const produccionEdificios = calcularProduccionEdificios(asentamiento.edificios || [], stats);

    // Sumar todos los alimentos (no solo "Alimento")
    let prodAlimento = 0;
    Object.entries(produccionBioma).forEach(([nombre, data]) => {
        const def = typeof RECURSOS !== 'undefined' ? RECURSOS[nombre] : null;
        const esAlimento = nombre === "Alimento" ||
            (def && (def.categoria === "Alimento" || (def.tags && def.tags.includes("Alimento"))));
        if (esAlimento) prodAlimento += data.medidas || 0;
    });
    Object.entries(produccionEdificios).forEach(([nombre, data]) => {
        const def = typeof RECURSOS !== 'undefined' ? RECURSOS[nombre] : null;
        const esAlimento = nombre === "Alimento" ||
            (def && (def.categoria === "Alimento" || (def.tags && def.tags.includes("Alimento"))));
        if (esAlimento) prodAlimento += data.total || 0;
    });

    // Solo las poblaciones que consumen alimentos cuentan
    const cuotasQueConsumen = estadoSimulacion.poblacion.filter(c => {
        // Artificiales NUNCA consumen alimento
        if (c.naturaleza === "Artificial") return false;
        const nat = NATURALEZAS_POBLACION[c.naturaleza];
        return nat?.consumeAlimento !== false; // Por defecto true
    }).length;

    const consumo = cuotasQueConsumen * 1;
    const balanceAlimentos = prodAlimento - consumo;
    const almacenAlimento = estadoSimulacion.almacen?.["Alimento"] || 0;

    console.log('faseCrecimiento DEBUG:', { calidad, prodAlimento, consumo, balanceAlimentos, almacenAlimento });

    estadoSimulacion.esHambruna = false;
    let globalPuedeReproducir = true;

    if (balanceAlimentos < 0) {
        logear(`  âš ï¸ DÃ©ficit Alimentario (${balanceAlimentos}). Crecimiento natural detenido.`);
        globalPuedeReproducir = false;

        if (almacenAlimento <= 0) {
            estadoSimulacion.esHambruna = true;
            calidad -= 8;
            logear(`  â˜ ï¸ Â¡HAMBRUNA! Sin reservas. Calidad -8.`);
        }
    }

    // === REPRODUCCIÃ“N POR TIPO ===
    // Solo las naturalezas que pueden reproducir
    const reproduccionPorTipo = { Neutral: 0, Positiva: 0, Negativa: 0, Monstruo: 0, Artificial: 0 };

    if (globalPuedeReproducir) {
        // ReproducciÃ³n = 1 por cada cuota de poblaciÃ³n (sin importar rol)
        estadoSimulacion.poblacion.forEach(cuota => {
            const tipo = cuota.naturaleza || "Neutral";
            const nat = NATURALEZAS_POBLACION[tipo];

            // Solo reproduce si la naturaleza lo permite
            if (nat?.puedeReproducir !== false) {
                if (reproduccionPorTipo[tipo] !== undefined) {
                    reproduccionPorTipo[tipo] += 1;
                }
            }
        });
    }

    // === INMIGRACIÃ“N ===
    let inmigracionBase = gradoData.inmigracion + calidad;

    // Bono por monstruos (global)
    estadoSimulacion.poblacion.forEach(cuota => {
        const nat = typeof NATURALEZAS_POBLACION !== 'undefined' ? NATURALEZAS_POBLACION[cuota.naturaleza] : null;
        if (nat) inmigracionBase += nat.bonoInmigracion;
    });

    const inmigracionTotal = Math.max(0, inmigracionBase);
    const tipoInmigracion = estadoSimulacion.tipoInmigracion || "Neutral";

    // Aplicar inmigraciÃ³n al tipo seleccionado
    estadoSimulacion.inmigracionPendientePorTipo[tipoInmigracion] =
        (estadoSimulacion.inmigracionPendientePorTipo[tipoInmigracion] || 0) + inmigracionTotal;

    // Aplicar reproducciÃ³n por tipo
    Object.keys(reproduccionPorTipo).forEach(tipo => {
        if (reproduccionPorTipo[tipo] > 0) {
            estadoSimulacion.inmigracionPendientePorTipo[tipo] =
                (estadoSimulacion.inmigracionPendientePorTipo[tipo] || 0) + reproduccionPorTipo[tipo];
        }
    });

    logear(`  ðŸ‘¥ InmigraciÃ³n (${tipoInmigracion}): +${inmigracionTotal}`);
    logear(`  ðŸ‘¶ ReproducciÃ³n: ${Object.entries(reproduccionPorTipo).filter(([k, v]) => v > 0).map(([k, v]) => `${k}: +${v}`).join(', ') || 'Ninguna'}`);

    console.log('faseCrecimiento IMMIGRATION:', {
        inmigracionBase,
        inmigracionTotal,
        tipoInmigracion,
        reproduccionPorTipo,
        inmigracionPendientePorTipo: { ...estadoSimulacion.inmigracionPendientePorTipo },
        CUOTA_POBLACION: CONVERSION.CUOTA_POBLACION
    });

    // === CONSOLIDACIÃ“N POR TIPO ===
    let nuevasCuotas = 0;
    const tiposPoblacion = ["Neutral", "Positiva", "Negativa", "Monstruo", "Artificial"];

    tiposPoblacion.forEach(tipo => {
        while ((estadoSimulacion.inmigracionPendientePorTipo[tipo] || 0) >= CONVERSION.CUOTA_POBLACION) {
            estadoSimulacion.inmigracionPendientePorTipo[tipo] -= CONVERSION.CUOTA_POBLACION;

            const maxId = Math.max(...estadoSimulacion.poblacion.map(c => c.id), 0);
            const nuevaCuota = {
                id: maxId + 1,
                rol: "Plebeyo",
                naturaleza: tipo,
                medidas: CONVERSION.CUOTA_POBLACION,
                asignacion: null
            };

            // Para Artificiales, agregar subtipo
            if (tipo === "Artificial") {
                nuevaCuota.subtipo = estadoSimulacion.subtipoInmigracionArtificial || "Neutral";
            }

            estadoSimulacion.poblacion.push(nuevaCuota);
            nuevasCuotas++;
            logear(`  ðŸŽ‰ Nueva cuota de ${tipo}${tipo === "Artificial" ? ` (${nuevaCuota.subtipo})` : ''} formada.`);
        }
    });

    // Log pendientes
    const pendientesLog = tiposPoblacion
        .map(t => `${t}: ${estadoSimulacion.inmigracionPendientePorTipo[t] || 0}`)
        .join(', ');
    logear(`  ðŸ“Š Pendiente por tipo: ${pendientesLog}`);

    return { inmigracionTotal, reproduccionPorTipo, nuevasCuotas };
}

/**
 * Fase 4: DevociÃ³n
 * Genera puntos de devociÃ³n por cada Devoto activo
 */
function faseDevocion() {
    logear("ðŸ“ Fase 4: DevociÃ³n");

    // Inicializar estado de devociÃ³n si no existe
    if (!estadoSimulacion.estadoDevocion) {
        estadoSimulacion.estadoDevocion = {
            poolPorTipo: { Positiva: 0, Negativa: 0, Neutral: 0, Salvaje: 0 },
            isSyncretic: false,
            syncreticTypes: [],
            dominantType: null,
            sacrilegio: false,
            turnosSacrilegio: 0
        };
    }

    const devocion = estadoSimulacion.estadoDevocion;
    const CAP_DEVOCION = 100;

    // Contar devotos por tipo de naturaleza
    const devotosPorTipo = { Positiva: 0, Negativa: 0, Neutral: 0, Salvaje: 0 };
    let totalDevotos = 0;

    if (estadoSimulacion.poblacion) {
        estadoSimulacion.poblacion.forEach(cuota => {
            if (cuota.rol === "Devoto") {
                const tipoNat = cuota.naturaleza || "Neutral";

                // Mapear naturaleza a tipo de devociÃ³n
                if (tipoNat === "Positiva" || tipoNat === "Negativa" || tipoNat === "Neutral") {
                    devotosPorTipo[tipoNat]++;
                    totalDevotos++;
                } else if (tipoNat === "Monstruo") {
                    // Monstruos generan devociÃ³n Salvaje
                    devotosPorTipo["Salvaje"]++;
                    totalDevotos++;
                }
                // Artificiales no generan devociÃ³n
            }
        });
    }

    // Generar puntos de devociÃ³n (+1 por devoto)
    let generacion = {};
    Object.entries(devotosPorTipo).forEach(([tipo, count]) => {
        if (count > 0) {
            const antes = devocion.poolPorTipo[tipo] || 0;
            devocion.poolPorTipo[tipo] = Math.min(CAP_DEVOCION, antes + count);
            generacion[tipo] = count;

            if (devocion.poolPorTipo[tipo] >= CAP_DEVOCION) {
                logear(`  ðŸ™ ${tipo}: +${count} â†’ ${devocion.poolPorTipo[tipo]} (Â¡MÃXIMO!)`);
            } else {
                logear(`  ðŸ™ ${tipo}: +${count} â†’ ${devocion.poolPorTipo[tipo]}`);
            }
        }
    });

    // Detectar sacrilegio (tipos opuestos con devotos activos)
    const haySacrilegio = (devotosPorTipo["Positiva"] > 0 && devotosPorTipo["Negativa"] > 0) ||
        (devotosPorTipo["Neutral"] > 0 && devotosPorTipo["Salvaje"] > 0);

    if (haySacrilegio && !devocion.sacrilegio) {
        logear("  âš ï¸ Â¡SACRILEGIO! Devociones opuestas detectadas.");
    }
    devocion.sacrilegio = haySacrilegio;

    if (haySacrilegio) {
        devocion.turnosSacrilegio++;
        logear(`  ðŸ’€ Turnos en sacrilegio: ${devocion.turnosSacrilegio}`);
    } else {
        devocion.turnosSacrilegio = 0;
    }

    // Determinar tipo dominante
    let maxDevotos = 0;
    let dominante = null;
    Object.entries(devotosPorTipo).forEach(([tipo, count]) => {
        if (count > maxDevotos) {
            maxDevotos = count;
            dominante = tipo;
        }
    });
    devocion.dominantType = dominante;

    if (totalDevotos === 0) {
        logear("  âšª Sin devotos activos.");
    }

    return {
        totalDevotos,
        generacion,
        sacrilegio: haySacrilegio,
        dominante,
        pools: { ...devocion.poolPorTipo }
    };
}

// =====================================================
// HELPERS
// =====================================================

function logear(mensaje) {
    estadoSimulacion.logTurno.push(mensaje);
    console.log(mensaje);
}

function aplicarMuertes(cantidad) {
    // Quitar medidas de las cuotas existentes
    let restantes = cantidad;

    for (const cuota of estadoSimulacion.poblacion) {
        if (restantes <= 0) break;

        const quitar = Math.min(restantes, cuota.medidas);
        cuota.medidas -= quitar;
        restantes -= quitar;
    }

    // Eliminar cuotas vacÃ­as
    estadoSimulacion.poblacion = estadoSimulacion.poblacion.filter(c => c.medidas > 0);
}

/**
 * Obtiene un resumen del estado actual
 */
function obtenerResumenEstado() {
    return {
        turno: estadoSimulacion.turno,
        poblacionTotal: obtenerPoblacionTotal(),
        cuotas: estadoSimulacion.poblacion.length,
        doblones: estadoSimulacion.doblones,
        alimentos: estadoSimulacion.alimentos,
        almacen: { ...estadoSimulacion.almacen },
        inmigracionPendiente: estadoSimulacion.inmigracionPendiente
    };
}

/**
 * Resetea el estado de simulaciÃ³n
 */
function resetearSimulacion() {
    estadoSimulacion = {
        turno: 0,
        poblacion: [],
        almacen: {},
        doblones: 0,
        inmigracionPendiente: 0,
        recursosEspeciales: {
            ideas: 0,
            influencia: 0
        },
        edificiosEstado: {},
        logTurno: [],
        historialTurnos: [],
        construccionesEnProgreso: [],
        historialComercio: []
    };
}

// =====================================================
// SISTEMA DE UNDO (DESHACER TURNO)
// =====================================================

/**
 * Guarda una copia profunda del estado actual antes de ejecutar un turno
 */
function guardarSnapshotTurno(asentamiento) {
    const snapshot = JSON.parse(JSON.stringify({
        turno: estadoSimulacion.turno,
        poblacion: estadoSimulacion.poblacion,
        almacen: estadoSimulacion.almacen,
        doblones: estadoSimulacion.doblones,
        alimentos: estadoSimulacion.alimentos,
        inmigracionPendiente: estadoSimulacion.inmigracionPendiente,
        inmigracionPendientePorTipo: estadoSimulacion.inmigracionPendientePorTipo,
        recursosEspeciales: estadoSimulacion.recursosEspeciales,
        edificiosEstado: estadoSimulacion.edificiosEstado,
        construccionesEnProgreso: estadoSimulacion.construccionesEnProgreso,
        historialComercio: estadoSimulacion.historialComercio,
        // Guardar edificios del asentamiento para restaurar al deshacer
        asentamientoEdificios: asentamiento?.edificios || []
    }));

    // Mantener solo los Ãºltimos 5 snapshots
    estadoSimulacion.historialTurnos.push(snapshot);
    if (estadoSimulacion.historialTurnos.length > 5) {
        estadoSimulacion.historialTurnos.shift();
    }
}

/**
 * Deshace el Ãºltimo turno restaurando el snapshot anterior
 * @returns {boolean} true si se pudo deshacer, false si no hay historial
 */
function deshacerTurno() {
    if (estadoSimulacion.historialTurnos.length === 0) {
        console.log("No hay turnos para deshacer");
        return null;
    }

    const snapshot = estadoSimulacion.historialTurnos.pop();

    // Restaurar estado (mantener historialTurnos actual)
    const historialActual = estadoSimulacion.historialTurnos;

    estadoSimulacion.turno = snapshot.turno;
    estadoSimulacion.poblacion = snapshot.poblacion;
    estadoSimulacion.almacen = snapshot.almacen;
    estadoSimulacion.doblones = snapshot.doblones;
    estadoSimulacion.alimentos = snapshot.alimentos || 0;
    estadoSimulacion.inmigracionPendiente = snapshot.inmigracionPendiente;
    estadoSimulacion.inmigracionPendientePorTipo = snapshot.inmigracionPendientePorTipo || {
        Neutral: 0, Positiva: 0, Negativa: 0, Monstruo: 0, Artificial: 0
    };
    estadoSimulacion.recursosEspeciales = snapshot.recursosEspeciales;
    estadoSimulacion.edificiosEstado = snapshot.edificiosEstado;
    estadoSimulacion.construccionesEnProgreso = snapshot.construccionesEnProgreso || [];
    estadoSimulacion.historialComercio = snapshot.historialComercio || [];
    estadoSimulacion.historialTurnos = historialActual;
    estadoSimulacion.logTurno = ["âª Turno deshecho"];

    // Devolver los edificios del asentamiento para restaurarlos en la UI
    return {
        success: true,
        asentamientoEdificios: snapshot.asentamientoEdificios || null
    };
}

// =====================================================
// SISTEMA DE CONSTRUCCIÃ“N EN PROGRESO
// =====================================================

/**
 * Inicia una nueva construcciÃ³n
 * @param {string} nombreEdificio - Nombre del edificio
 * @param {object} costoOpcion - Coste elegido
 * @param {number} turnosTotales - Turnos necesarios (default 1)
 */
function iniciarConstruccion(nombreEdificio, costoOpcion, turnosTotales = 1, esMejora = false, edificioId = null) {
    const id = `${nombreEdificio}_${Date.now()}`;
    estadoSimulacion.construccionesEnProgreso.push({
        id: id,
        nombre: nombreEdificio,
        turnosRestantes: turnosTotales,
        turnosTotales: turnosTotales,
        poblacionAsignada: 0,
        costoOpcion: costoOpcion,
        esMejora: esMejora,
        edificioId: edificioId
    });
    logear(`ðŸ—ï¸ ConstrucciÃ³n iniciada: ${nombreEdificio} (${turnosTotales} turnos)`);
    return id;
}

/**
 * Asigna poblaciÃ³n a una construcciÃ³n en progreso
 * @param {string} construccionId - ID de la construcciÃ³n
 * @param {number} cuotas - NÃºmero de cuotas a asignar
 */
function asignarPoblacionConstruccion(construccionId, cuotas) {
    const construccion = estadoSimulacion.construccionesEnProgreso.find(c => c.id === construccionId);
    if (construccion) {
        construccion.poblacionAsignada = cuotas;
    }
}

/**
 * Avanza las construcciones que tienen poblaciÃ³n asignada
 * @param {object} asentamiento - Datos del asentamiento para agregar edificios completados
 * @returns {Array} Lista de edificios completados
 */
function avanzarConstrucciones(asentamiento) {
    const completados = [];

    estadoSimulacion.construccionesEnProgreso = estadoSimulacion.construccionesEnProgreso.filter(c => {
        // Solo avanza si tiene poblaciÃ³n asignada
        if (c.poblacionAsignada > 0) {
            // El progreso es igual a la cantidad de cuotas asignadas
            // MÃ¡s cuotas = mÃ¡s rÃ¡pido (reduce mÃ¡s "turnos" o puntos de construcciÃ³n)
            c.turnosRestantes -= c.poblacionAsignada;

            logear(`ðŸ”¨ ${c.nombre}: Progreso ${c.poblacionAsignada} puntos. Restan ${Math.max(0, c.turnosRestantes)}/${c.turnosTotales}`);

            if (c.turnosRestantes <= 0) {
                // ConstrucciÃ³n completada
                logear(`âœ… Â¡${c.nombre} completado!`);
                completados.push(c);

                // Agregar al asentamiento
                if (asentamiento && asentamiento.edificios) {
                    if (c.esMejora) {
                        // Es una mejora de edificio existente
                        const edificioExistente = asentamiento.edificios.find(e => e.id === c.edificioId);
                        if (edificioExistente) {
                            // Actualizar el grado en el objeto del edificio
                            edificioExistente.grado = (edificioExistente.grado || 1) + 1;

                            // TambiÃ©n actualizar en edificiosEstado para sincronizar
                            if (!estadoSimulacion.edificiosEstado) {
                                estadoSimulacion.edificiosEstado = {};
                            }
                            if (!estadoSimulacion.edificiosEstado[c.edificioId]) {
                                estadoSimulacion.edificiosEstado[c.edificioId] = { grado: 1 };
                            }
                            estadoSimulacion.edificiosEstado[c.edificioId].grado = edificioExistente.grado;

                            logear(`ðŸ“ˆ ${c.nombre} mejorado a Grado ${edificioExistente.grado}`);
                        }
                    } else {
                        // Nuevo edificio
                        const nuevoEdificio = {
                            id: c.id,
                            nombre: c.nombre
                        };
                        asentamiento.edificios.push(nuevoEdificio);

                        // Inicializar estado del edificio
                        estadoSimulacion.edificiosEstado[c.id] = { grado: 1 };
                    }
                }

                return false; // Remover de en progreso
            }
        } else {
            logear(`â³ ${c.nombre}: Pausado (Sin trabajadores)`);
        }
        return true; // Mantener en lista
    });

    return completados;
}

// =====================================================
// REGISTRO DE COMERCIO
// =====================================================

/**
 * Registra una transacciÃ³n comercial
 * @param {string} recurso - Nombre del recurso
 * @param {number} cantidad - Cantidad intercambiada
 * @param {string} tipo - 'entrada' o 'salida'
 * @param {string} comerciante - Nombre del comerciante (opcional)
 * @param {number} turno - Turno en que ocurriÃ³ (opcional, usa turno actual si no se especifica)
 */
function registrarComercio(recurso, cantidad, tipo, comerciante = '', turno = null) {
    estadoSimulacion.historialComercio.push({
        id: Date.now(), // Unique ID for reliable identification
        turno: turno !== null ? turno : estadoSimulacion.turno,
        recurso: recurso,
        cantidad: cantidad,
        tipo: tipo,
        comerciante: comerciante
    });
}

// =====================================================
// FUNCIONES DE EDIFICIOS v4
// =====================================================

// =====================================================
// FUNCIONES DE EDIFICIOS v3 & SIMULACIÃ“N
// =====================================================

/**
 * Calcula la capacidad de cuotas asignables de un edificio
 * Prioriza propiedades V3 (reqCitizen), fallback a datos V4
 */
function calcularCapacidadEdificio(nombreEdificio, grado = 1) {
    const edificio = EDIFICIOS[nombreEdificio];
    if (!edificio) return 0;

    // LÃ³gica V3
    if (edificio.reqCitizen !== undefined) {
        return edificio.reqCitizen;
    }
    if (edificio.citizenEffect && edificio.citizenEffect.capacidad) {
        // Si es un efecto global (e.g. Zona Residencial), Â¿cuenta como capacidad DE TRABAJO para este edificio?
        // Zona Residencial aumenta el lÃ­mite de poblaciÃ³n GLOBAL, no asigna trabajadores a sÃ­ misma (normalmente).
        // Pero si el usuario puede asignar gente a la Zona Residencial (ej. Mantenimiento?), entonces sÃ­.
        // Asumiremos que si hay citizenEffect.capacidad, esa es la capacidad.
        return edificio.citizenEffect.capacidad;
    }

    // V6 Logic (New Data Structure)
    if (edificio.capacidad) {
        let cap = edificio.capacidad.base || 0;
        if (edificio.capacidad.porGrado) {
            cap += (grado - 1) * edificio.capacidad.porGrado;
        }
        return cap;
    }

    // Legacy V4 Fallback (datos array)
    if (edificio.datos) {
        const capBase = edificio.datos[8] || 0;
        const capInc = edificio.datos[9] || 0;
        return capBase + (grado - 1) * capInc;
    }

    return 0;
}

/**
 * Obtiene el recurso producido, considerando receta activa
 */
function obtenerRecursoEdificio(nombreEdificio, receta = null) {
    const edificio = EDIFICIOS[nombreEdificio];
    if (!edificio) return null;

    // Si tiene receta asignada, el output de la receta manda
    if (receta && receta.output && receta.output.Recurso) {
        return receta.output.Recurso; // E.g. "Suministros"
    } else if (receta && receta.output && typeof receta.output === 'object') {
        // Caso complejo
        return "Procesados";
    }

    // V6 Support
    if (edificio.produccionTrabajo) {
        if (edificio.produccionTrabajo.recurso) return edificio.produccionTrabajo.recurso;
        if (edificio.produccionTrabajo.tipo === 'Transformacion' && edificio.produccionTrabajo.output) return edificio.produccionTrabajo.output;
        if (edificio.produccionTrabajo.tipo === 'Procesado') return "Procesados";
    }

    // ProducciÃ³n Base V3
    if (edificio.produccionBase) {
        return Object.keys(edificio.produccionBase)[0];
    }

    // Fallback Etiqueta V4
    if (edificio.etiqueta) {
        const mapeo = {
            "Alimento": "Alimento", "Ideas": "Ideas", "Aceros": "Acero",
            "Herramientas": "Herramientas", "Metales/Sal": "Metales",
            "Pesca": "Pesca", "Soldados": "Soldados", "GuarniciÃ³n": "GuarniciÃ³n",
            "DevociÃ³n": "DevociÃ³n", "Magia/Arc": "Magia", "Artilugios": "Artilugios"
        };
        return mapeo[edificio.etiqueta] || null;
    }

    return null;
}

/**
 * Calcula la producciÃ³n total de todos los edificios
 * Soporta Recetas V3, ProducciÃ³n Base y Modificadores (Agricola, Calidad)
 */
function calcularProduccionEdificios(edificiosConstruidos, stats = null) {
    const produccion = {};
    const bonificaciones = stats ? stats.bonificaciones : {};
    const calidad = stats ? stats.calidadTotal : 0;

    // Safety check: ensure edificiosEstado exists
    if (!estadoSimulacion.edificiosEstado) {
        estadoSimulacion.edificiosEstado = {};
    }

    // 1. Mapear asignaciones por TIPO de edificio (UI based) y por INSTANCIA
    const cuotasPorEdificio = {};
    const cuotasPorId = {};

    if (estadoSimulacion.poblacion) {
        estadoSimulacion.poblacion.forEach(c => {
            if (c.asignacion) {
                if (c.asignacion.startsWith('edificio:')) {
                    const nombreEdificio = c.asignacion.substring(9);
                    cuotasPorEdificio[nombreEdificio] = (cuotasPorEdificio[nombreEdificio] || 0) + 1;
                } else if (c.asignacion.startsWith('edificio_id:')) {
                    const id = c.asignacion.substring(12);
                    cuotasPorId[id] = (cuotasPorId[id] || 0) + 1;
                }
            }
        });
    }

    // 2. Calcular producciÃ³n - DistribuciÃ³n Secuencial
    edificiosConstruidos.forEach(item => {
        const nombreEdificio = (typeof item === 'string') ? item : item.nombre;
        const instanciaId = (typeof item === 'object') ? item.id : null;
        const recetaInstancia = (typeof item === 'object') ? item.receta : null;

        const stateKey = instanciaId || nombreEdificio;

        // Inicializar estado
        if (!estadoSimulacion.edificiosEstado[stateKey]) {
            estadoSimulacion.edificiosEstado[stateKey] = { grado: 1 };
        }
        const estado = estadoSimulacion.edificiosEstado[stateKey];

        // Sincronizar receta
        if (recetaInstancia) {
            estado.recetaActual = recetaInstancia;
        }

        // DistribuciÃ³n de Trabajadores:
        // Prioridad 1: Asignados especÃ­ficamente a esta ID
        // Prioridad 2: Asignados genÃ©ricamente al Tipo (rellenando huecos)
        const capacidad = calcularCapacidadEdificio(nombreEdificio, estado.grado || 1);

        let asignadosEspecificos = 0;
        if (instanciaId && cuotasPorId[instanciaId]) {
            asignadosEspecificos = cuotasPorId[instanciaId];
        }

        let asignadosGenericos = 0;
        if (cuotasPorEdificio[nombreEdificio]) {
            // Tomar del pool genÃ©rico lo que quepa
            const hueco = Math.max(0, capacidad - asignadosEspecificos);
            const tomar = Math.min(cuotasPorEdificio[nombreEdificio], hueco);
            asignadosGenericos = tomar;

            // Restar del pool global
            cuotasPorEdificio[nombreEdificio] -= tomar;
        }

        const cuotasEfectivas = Math.min(asignadosEspecificos + asignadosGenericos, capacidad);


        estado.cuotasAsignadas = cuotasEfectivas;

        // === PRODUCCIÃ“N PASIVA DE EDIFICIOS ===
        // Mercado produce 1 DoblÃ³n pasivo por existir (sin necesidad de trabajadores)
        if (nombreEdificio === "Mercado") {
            const poblacionTotal = (estadoSimulacion.poblacion || []).reduce((sum, p) => sum + (p.cantidad || 1), 0);
            const modCalidad = Math.floor(calidad / 5);
            const produccionMercado = 1 + modCalidad + cuotasEfectivas * Math.floor(poblacionTotal / 5);

            if (produccionMercado > 0) {
                produccion["Doblones"] = produccion["Doblones"] || { total: 0, fuentes: [] };
                produccion["Doblones"].total += produccionMercado;
                produccion["Doblones"].fuentes.push({
                    edificio: nombreEdificio,
                    cuotas: cuotasEfectivas,
                    produccion: produccionMercado
                });
            }
            return;
        }

        if (cuotasEfectivas <= 0) return;

        const edificioDef = EDIFICIOS[nombreEdificio];
        let recurso = null;
        let cantidad = 0;
        let receta = null;

        // Modificadores específicos (Cultivo Agrícola)
        let modifier = 0;
        if (nombreEdificio === "Cultivo Agrícola") {
            const modAgricola = bonificaciones["Producción Agrícola"] || 0;
            const modCalidad = Math.floor(calidad / 5);
            modifier = modAgricola + modCalidad;
        }

        // Determinar Receta o ProducciÃ³n Base
        // Determinar Receta o ProducciÃ³n Base
        let recetaKey = recetaInstancia || estado.recetaActual;
        let opcionKey = null;

        if (recetaKey && recetaKey.includes(':')) {
            const parts = recetaKey.split(':');
            recetaKey = parts[0];
            opcionKey = parts[1];
        }

        if (recetaKey && typeof RECETAS_MANUFACTURA !== 'undefined') {
            for (const cat of Object.values(RECETAS_MANUFACTURA)) {
                if (cat[recetaKey]) {
                    receta = cat[recetaKey];
                    break;
                }
            }
        }

        if (receta) {
            // Handle complex recipes with options
            let inputData = receta.input;
            let outputData = receta.output;

            if (opcionKey && receta[opcionKey]) {
                const subReceta = receta[opcionKey];
                inputData = subReceta.input;
                outputData = subReceta.output;
            } else if (!inputData && !outputData && (receta.opcion_a || receta.opcion_b)) {
                // Default fallback
                const subReceta = receta.opcion_a;
                inputData = subReceta.input;
                outputData = subReceta.output;
            }

            // ProducciÃ³n por Receta (V6: Procesado or Legacy)
            const qtyPerQuota = (outputData?.Cantidad || 10);
            const outputQty = qtyPerQuota * cuotasEfectivas;
            recurso = outputData?.Recurso || "Procesados";
            cantidad = outputQty;

            // Registrar consumo de inputs
            if (inputData) {
                Object.entries(inputData).forEach(([inputRes, inputQty]) => {
                    const consumoTotal = inputQty * cuotasEfectivas;
                    produccion[inputRes] = produccion[inputRes] || { total: 0, fuentes: [] };
                    produccion[inputRes].total -= consumoTotal;
                    produccion[inputRes].fuentes.push({
                        edificio: `${nombreEdificio} (Insumo)`,
                        cuotas: cuotasEfectivas,
                        produccion: -consumoTotal
                    });
                });
            }
        }
        // V6 Logic: ProducciÃ³n Trabajo
        else if (edificioDef.produccionTrabajo) {
            const pt = edificioDef.produccionTrabajo;
            // Caso 1: Recurso Directo
            if (pt.recurso && pt.cantidad) {
                recurso = pt.recurso;
                // Check conditions
                if (pt.condicion === 'per_5_pop') {
                    const totalPop = estadoSimulacion.poblacion.length || 0;
                    const base = Math.floor(totalPop / 5);
                    // Bonificador de calidad: +1 por cada 5 puntos de calidad
                    const bonoCalidad = Math.floor(calidad / 5);
                    cantidad = (base + bonoCalidad) * cuotasEfectivas;
                } else {
                    cantidad = (pt.cantidad * cuotasEfectivas) + modifier;
                }
            }
            // Caso 2: Transformacion (Soldados)
            else if (pt.tipo === 'Transformacion' && pt.output === 'Soldados') {
                recurso = "Soldados";
                cantidad = (pt.cantidad || 0) * cuotasEfectivas;
            }
            // Caso 3: Regional (Placeholder - needs selection logic, defaulting to first Biome resource if possible)
            else if (pt.tipo === 'Regional') {
                // Try to find first biome resource
                // This requires accessing biome data. Simplified fallback:
                recurso = "Material Regional";
                cantidad = (pt.cantidad || 1) * cuotasEfectivas;
            }
        }
        // Legacy V3
        else if (edificioDef.produccionBase) {
            const [resBase, cantBase] = Object.entries(edificioDef.produccionBase)[0];
            recurso = resBase;
            cantidad = cantBase * cuotasEfectivas;
        }

        if (recurso) {
            produccion[recurso] = produccion[recurso] || { total: 0, fuentes: [] };
            produccion[recurso].total += cantidad;
            produccion[recurso].fuentes.push({
                edificio: nombreEdificio,
                cuotas: cuotasEfectivas,
                produccion: cantidad
            });
        }
    });

    return produccion;
}

// Export for verification/tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        estadoSimulacion,
        resetearSimulacion,
        cargarEstadoSimulacion,
        inicializarPoblacion,
        ejecutarTurno,
        faseEconomia,
        faseAlimentacion,
        faseCrecimiento,
        calcularProduccionTotal,
        calcularProduccionEdificios,
        calcularEstadisticasTotales,
        asignarTrabajo,
        // New turn system functions
        guardarSnapshotTurno,
        deshacerTurno,
        iniciarConstruccion,
        asignarPoblacionConstruccion,
        avanzarConstrucciones,
        registrarComercio
    };
}

