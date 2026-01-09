/**
 * MÁS ALLÁ DE LO SALVAJE - Controladores de Interfaz v2.0
 * Sistema de Gestión de Asentamientos con Herencia de Biomas
 */

// Estado temporal para el wizard de creación
let wizardState = {
  paso: 1,
  nombre: '',
  imagenPersonalizada: null, // URL o base64 de imagen personalizada
  // Sistema de biomas
  tiradaD12: null,
  esBiomaEspecial: false,
  biomaBase: null,
  biomaEspecial: null,
  subBioma: null,
  tiradaSubBioma: null,
  biomaFusionado: null,
  // Propiedades (automáticas del bioma + manuales)
  propiedades: [],
  peculiaridades: [],
  peculiaridadFija: null,
  // Recursos con niveles de abundancia
  recursos: {}, // { nombreRecurso: { abundancia: "Normal", tirada: 5, esGarantizado: false, esExotico: false } }
  influenciaMagica: "Baja",
  // Población inicial (4 cuotas = 80 colonos)
  poblacion: [
    { rol: "Plebeyo", naturaleza: "Neutral", cantidad: 4 }
  ]
};

let pestanaActiva = 'resumen';


// =====================================================
// FUNCIONES DE COLOR INTELIGENTE
// =====================================================

function obtenerClaseColor(statName, valor) {
  if (valor === 0) return 'neutro';
  const esInvertida = esStatInvertida(statName);
  if (esInvertida) {
    return valor > 0 ? 'negativo' : 'positivo';
  } else {
    return valor > 0 ? 'positivo' : 'negativo';
  }
}

function formatearValor(valor) {
  if (valor === 0) return '0';
  return valor > 0 ? `+${valor}` : `${valor}`;
}

function obtenerClaseAbundancia(nivel) {
  switch (nivel) {
    case "Inexistente": return "inexistente";
    case "Escaso": return "escaso";
    case "Normal": return "normal";
    case "Abundante": return "abundante";
    case "Exuberante": return "exuberante";
    default: return "normal";
  }
}

// =====================================================
// CONTROL DE TURNOS
// =====================================================

// CONTROL DE TURNOS
// =====================================================

function btnPasarTurno() {
  // Get current settlement
  const asentamientoActual = obtenerAsentamientoActual();
  if (!asentamientoActual) {
    mostrarNotificacion('No hay asentamiento seleccionado', 'error');
    return;
  }

  // Execute the turn
  const resultado = ejecutarTurno(asentamientoActual);

  // Update settlement simulation state
  asentamientoActual.simulacion = JSON.parse(JSON.stringify(estadoSimulacion));

  // Save expedition
  guardarExpedicion();

  // Generate turn report
  generarReporteTurno(asentamientoActual, resultado);

  // Show notification
  mostrarNotificacion(`Turno ${resultado.turno} completado`, 'success');

  // Re-render UI
  renderizarPantalla();
}

/**
 * Generates a text report of the turn and triggers download
 */
function generarReporteTurno(asentamiento, resultadoTurno) {
  if (!asentamiento || !resultadoTurno) return;

  const turno = resultadoTurno.turno;
  const nombre = asentamiento.nombre || 'Asentamiento';
  const grado = asentamiento.grado || 'Campamento';

  // Calculate stats
  const stats = calcularEstadisticasTotales(asentamiento);
  const poblacionTotal = (estadoSimulacion.poblacion || []).reduce((sum, p) => sum + (p.cantidad || 1), 0);
  const calidadTotal = stats?.calidadTotal || 0;

  // Production data
  const produccionEdificios = calcularProduccionEdificios(asentamiento.edificios || [], stats);
  const alimentoProduccion = produccionEdificios?.["Alimento"]?.total || 0;
  const alimentoConsumo = poblacionTotal; // 1 per cuota

  // Storage
  const almacen = estadoSimulacion.almacen || {};
  const doblones = estadoSimulacion.doblones || 0;
  const doblonesProduccion = produccionEdificios?.["Doblones"]?.total || 0;

  // Buildings
  const edificiosConstruidos = (asentamiento.edificios || []).map(e => {
    const nombre = typeof e === 'string' ? e : e.nombre;
    const def = EDIFICIOS?.[nombre];
    return `${nombre} ${def?.efectos?.Calidad ? `(+${def.efectos.Calidad} Calidad)` : ''}`;
  });

  // Devotion
  const devocion = estadoSimulacion.devocion || {};
  const devocionDominante = Object.entries(devocion).find(([k, v]) => v?.activa)?.[0] || 'Ninguna';

  // Build report text
  let reporte = `# Comienzo Turno ${turno}

# ${nombre}

*Grado: ${grado}*

## Población y Calidad
Población: ${poblacionTotal} cuotas
Calidad Total: +${calidadTotal}

## Alimentos
Producción: +${alimentoProduccion} Medidas de Alimentos por Turno
Consumo: -${alimentoConsumo} Medidas de Alimentos por Turno

## Tributo
${asentamiento.tributo || 'Sin Tributo'}

## Producción
Doblones: ${doblonesProduccion >= 0 ? '+' : ''}${doblonesProduccion}/Turno

## Almacenamiento
`;

  // List storage items
  Object.entries(almacen).forEach(([recurso, cantidad]) => {
    reporte += `- ${cantidad} Cuotas de ${recurso}\n`;
  });
  reporte += `- ${doblones} Doblones\n`;

  reporte += `
## Devoción
Devoción Dominante: ${devocionDominante}

## Construcciones
`;

  edificiosConstruidos.forEach(e => {
    reporte += `- ${e}\n`;
  });

  reporte += `
---

# Turno ${turno}: Resumen de Cambios

`;

  // Add turn log if available
  if (resultadoTurno.log && resultadoTurno.log.length > 0) {
    resultadoTurno.log.forEach(entry => {
      reporte += `${entry}\n`;
    });
  }

  // Add production details
  if (produccionEdificios && Object.keys(produccionEdificios).length > 0) {
    reporte += `\n## Producción por Edificios\n`;
    Object.entries(produccionEdificios).forEach(([recurso, data]) => {
      if (data.fuentes) {
        data.fuentes.forEach(f => {
          reporte += `- ${f.edificio} (${f.cuotas} cuotas): +${f.produccion} ${recurso}\n`;
        });
      }
    });
  }

  // Trigger download
  descargarArchivoTexto(`turno_${turno}_${nombre.replace(/\s+/g, '_')}.txt`, reporte);
}

/**
 * Downloads a text file with the given content
 */
function descargarArchivoTexto(nombreArchivo, contenido) {
  const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function btnDeshacerTurno() {
  const resultado = deshacerTurno();

  if (resultado && resultado.success) {
    // Update settlement simulation state
    const asentamientoActual = obtenerAsentamientoActual();
    if (asentamientoActual) {
      // Restaurar los edificios del asentamiento si fueron guardados en el snapshot
      if (resultado.asentamientoEdificios) {
        asentamientoActual.edificios = resultado.asentamientoEdificios;
      }

      asentamientoActual.simulacion = JSON.parse(JSON.stringify(estadoSimulacion));
      guardarExpedicion();
    }

    mostrarNotificacion('Turno deshecho', 'info');
    renderizarPantalla();
  } else {
    mostrarNotificacion('No hay turnos para deshacer', 'warning');
  }
}

function obtenerAsentamientoActual() {
  if (!estadoApp.asentamientoActual || !estadoApp.expedicion || !estadoApp.expedicion.asentamientos) {
    return null;
  }

  // asentamientoActual can be either the object itself or just an ID
  const ref = estadoApp.asentamientoActual;

  // If it's already an object with an id, return it directly (or find it in the array)
  if (typeof ref === 'object' && ref.id !== undefined) {
    return estadoApp.expedicion.asentamientos.find(a => a.id === ref.id) || ref;
  }

  // If it's just an ID, find the matching settlement
  return estadoApp.expedicion.asentamientos.find(a => a.id === ref);
}

// RENDERIZADO DE PANTALLAS
// =====================================================

// UI State preservation
let uiStateCache = {
  scrollPosition: 0,
  detailsStates: {},
  activeElement: null
};

/**
 * Saves the current UI state (scroll position, open details, etc.)
 */
function guardarEstadoUI() {
  // Save scroll position
  uiStateCache.scrollPosition = window.scrollY || document.documentElement.scrollTop;

  // Save open/closed state of all details elements
  uiStateCache.detailsStates = {};
  document.querySelectorAll('details').forEach((det, idx) => {
    const id = det.id || `details-${idx}`;
    uiStateCache.detailsStates[id] = det.open;
  });

  // Save active element info
  const activeEl = document.activeElement;
  if (activeEl && activeEl.id) {
    uiStateCache.activeElement = activeEl.id;
  }
}

/**
 * Restores the saved UI state (scroll position, open details, etc.)
 */
function restaurarEstadoUI() {
  // Restore scroll position
  requestAnimationFrame(() => {
    window.scrollTo(0, uiStateCache.scrollPosition);
  });

  // Restore details states
  document.querySelectorAll('details').forEach((det, idx) => {
    const id = det.id || `details-${idx}`;
    if (uiStateCache.detailsStates[id] !== undefined) {
      det.open = uiStateCache.detailsStates[id];
    }
  });

  // Restore focus if possible
  if (uiStateCache.activeElement) {
    const el = document.getElementById(uiStateCache.activeElement);
    if (el) el.focus();
  }
}

function renderizarPantalla() {
  const container = document.getElementById('app-container');
  const esHUD = estadoApp.pantalla === 'hud';

  // Save UI state before re-rendering HUD
  if (esHUD) {
    guardarEstadoUI();
  }

  switch (estadoApp.pantalla) {
    case 'inicio':
      renderizarInicio(container);
      break;
    case 'expedicion':
      renderizarNombreExpedicion(container);
      break;
    case 'lista':
      renderizarListaAsentamientos(container);
      break;
    case 'crear':
      renderizarCreador(container);
      break;
    case 'hud':
      renderizarHUD(container);
      break;
    default:
      renderizarInicio(container);
  }

  // Restore UI state after rendering HUD
  if (esHUD) {
    restaurarEstadoUI();
  }
}

function actualizarHUD() {
  // Save UI state before re-render
  guardarEstadoUI();

  // Re-render
  renderizarPantalla();

  // Restore UI state after re-render
  restaurarEstadoUI();
}

/**
 * Pantalla de inicio - Bienvenida
 */
function renderizarInicio(container) {
  container.innerHTML = `
    <div class="pantalla-inicio">
      <div class="titulo-principal">
        <div class="logo-icono">⚔️</div>
        <h1>Más Allá de lo Salvaje</h1>
        <p class="subtitulo">Sistema de Gestión de Expediciones</p>
      </div>
      
      <div class="menu-principal">
        <button class="btn-principal" onclick="iniciarNuevaExpedicion()">
          <span class="btn-icono">🗺️</span>
          <span class="btn-texto">Nueva Expedición</span>
        </button>
        
        ${estadoApp.expedicion ? `
          <button class="btn-secundario" onclick="continuarExpedicion()">
            <span class="btn-icono">📜</span>
            <span class="btn-texto">Continuar: ${estadoApp.expedicion.nombre}</span>
          </button>
        ` : ''}
        
        <button class="btn-secundario" onclick="abrirImportarExpedicion()">
          <span class="btn-icono">📂</span>
          <span class="btn-texto">Cargar Expedición</span>
        </button>
      </div>
      
      <div class="footer-info">
        <p>Gestiona tu expedición y asentamientos</p>
      </div>
    </div>
  `;
}

/**
 * Pantalla para nombrar la expedición
 */
function renderizarNombreExpedicion(container) {
  container.innerHTML = `
    <div class="pantalla-inicio">
      <div class="titulo-principal">
        <div class="logo-icono">🗺️</div>
        <h1>Nueva Expedición</h1>
        <p class="subtitulo">Dale un nombre a tu aventura</p>
      </div>
      
      <div class="input-grupo expedicion-input">
        <input 
          type="text" 
          id="input-expedicion" 
          class="input-nombre" 
          placeholder="Nombre de la Expedición"
          autofocus
          onkeydown="if(event.key === 'Enter') confirmarExpedicion()"
        />
      </div>
      
      <div class="menu-principal">
        <button class="btn-principal" onclick="confirmarExpedicion()">
          <span class="btn-icono">✨</span>
          <span class="btn-texto">Comenzar Expedición</span>
        </button>
        
        <button class="btn-secundario" onclick="volverInicio()">
          <span class="btn-icono">←</span>
          <span class="btn-texto">Volver</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Pantalla de lista de asentamientos
 */
function renderizarListaAsentamientos(container) {
  const expedicion = estadoApp.expedicion;
  const asentamientos = expedicion?.asentamientos || [];
  const pestanaActiva = estadoApp.pestanaExpedicion || 'asentamientos';

  container.innerHTML = `
    <div class="pantalla-lista">
      <header class="lista-header">
        <div class="lista-titulo">
          <button class="btn-volver-mini" onclick="volverInicio()">←</button>
          <div>
            <h1>🗺️ ${expedicion?.nombre || 'Expedición'}</h1>
            <p class="lista-subtitulo">${asentamientos.length} asentamiento${asentamientos.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div class="lista-acciones">
          
          <!-- Dropdown for Export/Import -->
          <div class="dropdown-container" id="dropdown-datos">
            <button class="btn-datos-dropdown" onclick="toggleDropdownDatos()">
              📦 Datos ▼
            </button>
            <div class="dropdown-menu" id="dropdown-datos-menu" style="display: none;">
              <button class="dropdown-item" onclick="exportarTodosAsentamientos(); cerrarDropdownDatos();">
                📤 Exportar Todos
              </button>
              <button class="dropdown-item" onclick="importarAsentamientosUI(); cerrarDropdownDatos();">
                📥 Importar
              </button>
              <hr class="dropdown-divider">
              <button class="dropdown-item dropdown-item-muted" onclick="guardarYExportarExpedicion(); cerrarDropdownDatos();">
                💾 Exportar Expedición Completa
              </button>
            </div>
          </div>
          
          <button class="btn-crear-asentamiento" onclick="iniciarCreacionAsentamiento()">
            ➕ Crear Asentamiento
          </button>
        </div>
      </header>
      
      <!-- Pestañas de Expedición -->
      <nav class="expedicion-tabs">
        <button class="expedicion-tab ${pestanaActiva === 'mapa' ? 'activa' : ''}" 
                onclick="cambiarPestanaExpedicion('mapa')">
          🗺️ Mundo
        </button>
        <button class="expedicion-tab ${pestanaActiva === 'asentamientos' ? 'activa' : ''}" 
                onclick="cambiarPestanaExpedicion('asentamientos')">
          🏘️ Asentamientos
        </button>
        <button class="expedicion-tab ${pestanaActiva === 'conexiones' ? 'activa' : ''}" 
                onclick="cambiarPestanaExpedicion('conexiones')">
          🔗 Conexiones
        </button>
      </nav>
      
      <main class="lista-contenido">
        ${pestanaActiva === 'mapa' ? renderizarVisorMapa(expedicion) :
      (pestanaActiva === 'asentamientos' ? renderizarPestanaAsentamientos(asentamientos) : renderizarPestanaConexiones(asentamientos))}
      </main>
    </div>
  `;
}

function cambiarPestanaExpedicion(pestana) {
  estadoApp.pestanaExpedicion = pestana;
  renderizarPantalla();
}

function renderizarPestanaAsentamientos(asentamientos) {
  if (asentamientos.length === 0) {
    return `
      <div class="lista-vacia">
        <div class="lista-vacia-icono">🏕️</div>
        <h3>No hay asentamientos</h3>
        <p>Crea tu primer asentamiento para comenzar la expedición</p>
        <button class="btn-principal" onclick="iniciarCreacionAsentamiento()">
          <span class="btn-icono">➕</span>
          <span class="btn-texto">Crear Primer Asentamiento</span>
        </button>
      </div>
    `;
  }

  return `
    <div class="asentamientos-grid">
      ${asentamientos.map(a => renderizarCardAsentamiento(a)).join('')}
    </div>
  `;
}

function renderizarPestanaConexiones(asentamientos) {
  if (asentamientos.length < 2) {
    return `
      <div class="lista-vacia">
        <div class="lista-vacia-icono">🔗</div>
        <h3>Necesitas más asentamientos</h3>
        <p>Crea al menos 2 asentamientos para poder conectarlos</p>
      </div>
    `;
  }

  // Obtener todas las conexiones existentes
  const conexionesExistentes = [];
  asentamientos.forEach(a => {
    const conexiones = a.conexiones || (a.conectadoA ? [a.conectadoA] : []);
    conexiones.forEach(destId => {
      // Evitar duplicados (A-B y B-A son la misma conexión)
      const yaExiste = conexionesExistentes.some(c =>
        (c.desde === a.id && c.hacia === destId) ||
        (c.desde === destId && c.hacia === a.id)
      );
      if (!yaExiste) {
        const destino = asentamientos.find(as => as.id === destId);
        if (destino) {
          conexionesExistentes.push({ desde: a.id, hacia: destId, nombreDesde: a.nombre, nombreHacia: destino.nombre });
        }
      }
    });
  });

  return `
    <div class="conexiones-panel">
      <div class="conexiones-formulario">
        <h4>➕ Crear Nueva Conexión</h4>
        <div class="form-conexion">
          <select id="conexion-desde" class="select-form">
            <option value="">Desde...</option>
            ${asentamientos.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('')}
          </select>
          <span class="conexion-flecha">↔️</span>
          <select id="conexion-hacia" class="select-form">
            <option value="">Hacia...</option>
            ${asentamientos.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('')}
          </select>
          <button class="btn-principal" onclick="crearConexionDesdeUI()">
            <span class="btn-icono">🔗</span>
            <span class="btn-texto">Conectar</span>
          </button>
        </div>
      </div>
      
      <hr class="separador-seccion">
      
      <h4>📋 Conexiones Existentes (${conexionesExistentes.length})</h4>
      ${conexionesExistentes.length === 0 ? `
        <div class="conexiones-vacio">
          <p>No hay conexiones entre asentamientos.</p>
        </div>
      ` : `
        <div class="conexiones-lista">
          ${conexionesExistentes.map(c => `
            <div class="conexion-item">
              <div class="conexion-info">
                <span class="conexion-nodo">${c.nombreDesde}</span>
                <span class="conexion-linea">↔️</span>
                <span class="conexion-nodo">${c.nombreHacia}</span>
              </div>
              <button class="btn-mini btn-eliminar" onclick="eliminarConexionDesdeUI(${c.desde}, ${c.hacia})" title="Eliminar conexión">
                ✕
              </button>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function crearConexionDesdeUI() {
  const desdeId = parseInt(document.getElementById('conexion-desde')?.value);
  const haciaId = parseInt(document.getElementById('conexion-hacia')?.value);

  if (!desdeId || !haciaId) {
    alert("Selecciona ambos asentamientos");
    return;
  }

  if (desdeId === haciaId) {
    alert("No puedes conectar un asentamiento consigo mismo");
    return;
  }

  const asentamientos = estadoApp.expedicion?.asentamientos || [];
  const desde = asentamientos.find(a => a.id === desdeId);
  const hacia = asentamientos.find(a => a.id === haciaId);

  if (!desde || !hacia) return;

  // Inicializar arrays de conexiones si no existen
  if (!desde.conexiones) desde.conexiones = [];
  if (!hacia.conexiones) hacia.conexiones = [];

  // Verificar si ya están conectados
  if (desde.conexiones.includes(haciaId)) {
    alert("Estos asentamientos ya están conectados");
    return;
  }

  // Crear conexión bidireccional
  desde.conexiones.push(haciaId);
  hacia.conexiones.push(desdeId);

  guardarExpedicion();
  renderizarPantalla();

  if (typeof mostrarNotificacion === 'function') {
    mostrarNotificacion(`🔗 Conexión creada: ${desde.nombre} ↔️ ${hacia.nombre}`, 'exito');
  }
}

function eliminarConexionDesdeUI(desdeId, haciaId) {
  const asentamientos = estadoApp.expedicion?.asentamientos || [];
  const desde = asentamientos.find(a => a.id === desdeId);
  const hacia = asentamientos.find(a => a.id === haciaId);

  if (!desde || !hacia) return;

  // Eliminar de ambos lados
  if (desde.conexiones) {
    desde.conexiones = desde.conexiones.filter(id => id !== haciaId);
  }
  if (hacia.conexiones) {
    hacia.conexiones = hacia.conexiones.filter(id => id !== desdeId);
  }

  guardarExpedicion();
  renderizarPantalla();

  if (typeof mostrarNotificacion === 'function') {
    mostrarNotificacion(`Conexión eliminada`, 'info');
  }
}

/**
 * Renderiza una card de asentamiento para la lista
 */
function renderizarCardAsentamiento(asentamiento) {
  const gradoData = GRADOS[asentamiento.grado];
  // Manejar conexiones (array)
  const conexionesDisplay = (asentamiento.conexiones || (asentamiento.conectadoA ? [asentamiento.conectadoA] : []))
    .map(id => {
      const a = estadoApp.expedicion?.asentamientos.find(as => as.id === id);
      return a ? a.nombre : '';
    })
    .filter(Boolean)
    .join(', ');

  // Read from simulacion if available (contains current turn data), otherwise from initial config
  const simData = asentamiento.simulacion;
  const poblacionData = simData?.poblacion || asentamiento.poblacion;
  const poblacionTotal = poblacionData?.reduce((sum, p) => sum + ((p.cantidad || 1) * 20), 0) || 0;
  const doblonesActual = simData?.doblones ?? asentamiento.doblones ?? 0;

  return `
    <div class="asentamiento-card" onclick="seleccionarAsentamiento(${asentamiento.id})">
      <div class="card-header">
        ${asentamiento.imagenPersonalizada
      ? `<img src="${asentamiento.imagenPersonalizada}" class="card-imagen-custom" alt="Imagen del asentamiento">`
      : `<span class="card-icono">${gradoData?.icono || '🏕️'}</span>`
    }
        <div class="card-titulo">
          <h3>${asentamiento.nombre}</h3>
          <span class="card-grado">${asentamiento.grado}</span>
        </div>
        ${asentamiento.esPrimerAsentamiento ? '<span class="badge-primero">⭐ Principal</span>' : ''}
      </div>
      
      <div class="card-stats">
        <div class="card-stat">
          <span class="stat-label">Población</span>
          <span class="stat-value">${poblacionTotal}</span>
        </div>
        <div class="card-stat">
          <span class="stat-label">Doblones</span>
          <span class="stat-value">${doblonesActual}</span>
        </div>
      </div>
      
      ${conexionesDisplay ? `
        <div class="card-conexion">
          <span class="conexion-label">🔗 Conectado a:</span>
          <span class="conexion-valor">${conexionesDisplay}</span>
        </div>
      ` : ''}
      
      <div class="card-acciones">
        <button class="btn-gestionar" onclick="event.stopPropagation(); gestionarAsentamiento(${asentamiento.id})">
          Gestionar →
        </button>
        <button class="btn-exportar-card" onclick="event.stopPropagation(); exportarAsentamientoIndividual(${asentamiento.id})" title="Exportar asentamiento">📤</button>
        <button class="btn-eliminar-card" onclick="event.stopPropagation(); confirmarEliminarAsentamiento(${asentamiento.id})" title="Eliminar asentamiento">
          🗑️
        </button>
      </div>
    </div>
  `;
}

// =====================================================
// FUNCIONES DE NAVEGACIÓN EXPEDICIÓN
// =====================================================

function iniciarNuevaExpedicion() {
  estadoApp.pantalla = 'expedicion';
  renderizarPantalla();
}

function confirmarExpedicion() {
  const input = document.getElementById('input-expedicion');
  const nombre = input?.value?.trim();

  if (!nombre) {
    alert('Por favor, ingresa un nombre para la expedición');
    return;
  }

  // Crear nueva expedición
  estadoApp.expedicion = crearExpedicion(nombre);
  estadoApp.pantalla = 'lista';
  renderizarPantalla();
}

function continuarExpedicion() {
  estadoApp.pantalla = 'lista';
  renderizarPantalla();
}

function volverInicio() {
  estadoApp.pantalla = 'inicio';
  renderizarPantalla();
}

function volverALista() {
  // IMPORTANT: Save current settlement's simulation state before leaving
  const asentamientoActual = obtenerAsentamientoActual();
  if (asentamientoActual && estadoSimulacion) {
    asentamientoActual.simulacion = JSON.parse(JSON.stringify(estadoSimulacion));
    guardarExpedicion();
  }

  estadoApp.pantalla = 'lista';
  renderizarPantalla();
}

function guardarExpedicionUI() {
  // Guardar en localStorage
  if (guardarExpedicion()) {
    mostrarNotificacion('✅ Expedición guardada correctamente');
    // También exportar a archivo
    exportarExpedicionAArchivo();
  } else {
    mostrarNotificacion('❌ Error al guardar la expedición', 'error');
  }
}

function seleccionarAsentamiento(id) {
  gestionarAsentamiento(id);
}

function gestionarAsentamiento(id) {
  const asentamiento = obtenerAsentamientoPorId(id);
  if (asentamiento) {
    estadoApp.asentamiento = asentamiento;
    estadoApp.asentamientoActual = asentamiento;

    // CRITICAL: Load the simulation state for this settlement
    if (asentamiento.simulacion) {
      cargarEstadoSimulacion(asentamiento.simulacion);
    } else {
      // Initialize simulation if it doesn't exist
      resetearSimulacion();
      // Initialize population from settlement config
      if (asentamiento.poblacion && Array.isArray(asentamiento.poblacion)) {
        inicializarPoblacion(asentamiento.poblacion);
      }
      // Set initial doubloons
      estadoSimulacion.doblones = asentamiento.doblones || 0;
      // Initialize storage with 2 Alimento if first time
      if (!estadoSimulacion.almacen || Object.keys(estadoSimulacion.almacen).length === 0) {
        estadoSimulacion.almacen = { "Alimento": 2 };
      }
      // Save the initialized simulation state back to settlement
      asentamiento.simulacion = JSON.parse(JSON.stringify(estadoSimulacion));
      guardarExpedicion();
    }

    estadoApp.pantalla = 'hud';
    renderizarPantalla();
  }
}

/**
 * Muestra notificación temporal
 */
function mostrarNotificacion(mensaje, tipo = 'success') {
  const resultadoDiv = document.getElementById('resultado-dado');
  if (!resultadoDiv) return;

  resultadoDiv.innerHTML = `
    <div class="notificacion ${tipo}">
      ${mensaje}
    </div>
  `;

  setTimeout(() => {
    resultadoDiv.innerHTML = '';
  }, 3000);
}

/**
 * Inicia creación de asentamiento - muestra modal si corresponde
 */
function iniciarCreacionAsentamiento() {
  const asentamientos = estadoApp.expedicion?.asentamientos || [];

  if (asentamientos.length === 0) {
    // Es el primer asentamiento, no preguntar
    iniciarCreacionConOpciones(true, null);
  } else {
    // Mostrar modal preguntando
    mostrarModalPrimerAsentamiento();
  }
}

/**
 * Muestra modal preguntando si es el primer asentamiento
 */
function mostrarModalPrimerAsentamiento() {
  const container = document.getElementById('app-container');

  // Crear overlay del modal
  const modalHTML = `
    <div class="modal-overlay" id="modal-primer-asentamiento">
      <div class="modal-content">
        <div class="modal-icono">🏕️</div>
        <h2>Nuevo Asentamiento</h2>
        <p>¿Es este tu <strong>primer asentamiento</strong> de la expedición?</p>
        
        <div class="modal-info">
          <div class="modal-opcion primero">
            <strong>Sí, es el primero</strong>
            <p>Recibirás 50 doblones y 4 cuotas de población (80 colonos)</p>
          </div>
          <div class="modal-opcion adicional">
            <strong>No, es adicional</strong>
            <p>Comenzarás con 0 doblones y 1 cuota de población (20 colonos)</p>
          </div>
        </div>
        
        <div class="modal-acciones">
          <button class="btn-principal" onclick="responderModalPrimero(true)">
            <span class="btn-icono">⭐</span>
            <span class="btn-texto">Sí, es el primero</span>
          </button>
          <button class="btn-secundario" onclick="responderModalPrimero(false)">
            <span class="btn-icono">➕</span>
            <span class="btn-texto">No, es adicional</span>
          </button>
        </div>
        
        <button class="btn-cerrar-modal" onclick="cerrarModal()">✕</button>
      </div>
    </div>
  `;

  // Agregar modal al DOM
  container.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Responde a la pregunta del modal
 */
function responderModalPrimero(esPrimero) {
  cerrarModal();
  if (esPrimero) {
    // Si es el primer asentamiento, iniciar creación directamente
    iniciarCreacionConOpciones(true, null);
  } else {
    // Si es adicional, mostrar modal para seleccionar conexión
    mostrarModalConexionV2();
  }
}

/**
 * Muestra modal para seleccionar a qué asentamiento conectarse
 */
/**
 * Muestra modal para seleccionar a qué asentamiento conectarse (Múltiple)
 */
function mostrarModalConexion() {
  const container = document.getElementById('app-container');
  const asentamientos = estadoApp.expedicion?.asentamientos || [];

  if (asentamientos.length === 0) {
    iniciarCreacionConOpciones(false, []);
    return;
  }

  const opcionesHTML = asentamientos.map(a =>
    `<div class="conexion-opcion">
       <input type="checkbox" id="conexion-${a.id}" value="${a.id}" class="check-conexion">
       <label for="conexion-${a.id}">${a.nombre} (${a.grado})</label>
     </div>`
  ).join('');

  const modalHTML = `
    <div class="modal-overlay" id="modal-conexion">
      <div class="modal-content">
        <div class="modal-icono">🔗</div>
        <h2>Conectar Asentamiento</h2>
        <p>Selecciona los asentamientos a los que estarás conectado (opcional):</p>
        
        <div class="modal-campo lista-conexiones">
          ${opcionesHTML}
        </div>
        
        <div class="modal-acciones">
          <button class="btn-principal" onclick="confirmarConexion()">
            <span class="btn-icono">✓</span>
            <span class="btn-texto">Continuar</span>
          </button>
          <button class="btn-secundario" onclick="cerrarModalConexion()">
            <span class="btn-texto">Cancelar</span>
          </button>
        </div>
        
        <button class="btn-cerrar-modal" onclick="cerrarModalConexion()">✕</button>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Confirma la conexión y continúa con la creación
 */
function confirmarConexion() {
  const checkboxes = document.querySelectorAll('.check-conexion:checked');
  const conexiones = Array.from(checkboxes).map(cb => parseInt(cb.value));

  cerrarModalConexion();
  iniciarCreacionConOpciones(false, conexiones);
}

/**
 * Cierra el modal de conexión
 */
function cerrarModalConexion() {
  const modal = document.getElementById('modal-conexion');
  if (modal) modal.remove();
}

/**
 * Confirma la eliminación de un asentamiento
 */
function confirmarEliminarAsentamiento(id) {
  const asentamiento = obtenerAsentamientoPorId(id);
  if (!asentamiento) return;

  const confirmado = confirm(`¿Estás seguro de que deseas eliminar el asentamiento "${asentamiento.nombre}"?\n\nEsta acción no se puede deshacer.`);

  if (confirmado) {
    if (eliminarAsentamientoDeExpedicion(id)) {
      mostrarNotificacion('✅ Asentamiento eliminado');
      renderizarPantalla();
    } else {
      mostrarNotificacion('❌ Error al eliminar el asentamiento', 'error');
    }
  }
}

/**
 * Exporta expedición a archivo y guarda en localStorage
 */
function guardarYExportarExpedicion() {
  // Primero guardar en localStorage
  guardarExpedicion();

  // Luego exportar a archivo
  if (exportarExpedicionAArchivo()) {
    mostrarNotificacion('✅ Expedición guardada y exportada');
  }
}

/**
 * Cierra el modal activo
 */
function cerrarModal() {
  const modal = document.getElementById('modal-primer-asentamiento');
  if (modal) modal.remove();
}

/**
 * Inicia la creación del wizard con las opciones configuradas
 */
function iniciarCreacionConOpciones(esPrimerAsentamiento, conectadoA) {
  try {
    // Determinar población según si es primer asentamiento
    const poblacionInicial = esPrimerAsentamiento
      ? [{ rol: "Plebeyo", naturaleza: "Neutral", cantidad: 4 }]
      : [{ rol: "Plebeyo", naturaleza: "Neutral", cantidad: 1 }];

    wizardState = {
      paso: 1,
      nombre: '',
      tiradaD12: null,
      esBiomaEspecial: false,
      biomaBase: null,
      biomaEspecial: null,
      subBioma: null,
      tiradaSubBioma: null,
      biomaFusionado: null,
      propiedades: [],
      peculiaridades: [],
      peculiaridadFija: null,
      recursos: {},
      influenciaMagica: "Baja",
      poblacion: poblacionInicial,
      // Nuevos campos para expedición
      esPrimerAsentamiento: esPrimerAsentamiento,
      conexiones: conectadoA ? (Array.isArray(conectadoA) ? conectadoA : [conectadoA]) : [],
      // Para asentamientos secundarios, Zona Residencial es obligatoria
      edificios: esPrimerAsentamiento ? [] : ["Zona Residencial"]
    };
    estadoApp.pantalla = 'crear';
    renderizarPantalla();
  } catch (e) {
    console.error("Error en iniciarCreacionConOpciones:", e);
    alert("Error: " + e.message);
  }
}

// Mantener compatibilidad con función antigua
function iniciarCreacion() {
  iniciarCreacionAsentamiento();
}

function continuarAsentamiento() {
  estadoApp.pantalla = 'hud';
  renderizarPantalla();
}

function renderizarCreador(container) {
  const pasos = ['Nombre', 'Bioma', 'Propiedades', 'Recursos', 'Población', 'Construcciones', 'Confirmar'];

  container.innerHTML = `
    <div class="pantalla-crear">
      <div class="wizard-header">
        <button class="btn-volver" onclick="volverALista()">← Volver</button>
        <h2>Crear Asentamiento</h2>
        <div class="wizard-pasos">
          ${pasos.map((p, i) => `
            <div class="paso ${i + 1 === wizardState.paso ? 'activo' : ''} ${i + 1 < wizardState.paso ? 'completado' : ''}">
              <span class="paso-num">${i + 1}</span>
              <span class="paso-nombre">${p}</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="wizard-contenido">
        ${renderizarPasoActual()}
      </div>
      
      <div class="wizard-footer">
        ${wizardState.paso > 1 ? `<button class="btn-nav" onclick="pasoAnterior()">← Anterior</button>` : '<div></div>'}
      ${wizardState.paso < 7 ?
      `<button class="btn-nav btn-siguiente" onclick="pasoSiguiente()">Siguiente →</button>` :
      `<button class="btn-confirmar" onclick="confirmarCreacion()">✨ Crear Asentamiento</button>`
    }
      </div>
    </div>
  `;
}

function renderizarPasoActual() {
  switch (wizardState.paso) {
    case 1: return renderizarPasoNombre();
    case 2: return renderizarPasoBioma();
    case 3: return renderizarPasoPropiedades();
    case 4: return renderizarPasoRecursos();
    case 5: return renderizarPasoPoblacion();
    case 6: return renderizarPasoEdificios();
    case 7: return renderizarPasoConfirmacion();
    default: return '';
  }
}

// =====================================================
// PASO 1: NOMBRE
// =====================================================
function renderizarPasoNombre() {
  const tieneImagen = wizardState.imagenPersonalizada;

  return `
    <div class="paso-contenido paso-nombre">
      <div class="paso-icono">${tieneImagen ? `<img src="${wizardState.imagenPersonalizada}" class="imagen-preview-icono" alt="Imagen personalizada">` : '🏕️'}</div>
      <h3>Nombra tu Asentamiento</h3>
      <p>Elige un nombre memorable para tu nuevo hogar</p>
      
      <div class="input-grupo">
        <input 
          type="text" 
          id="input-nombre" 
          class="input-nombre" 
          placeholder="Ej: Valle del Crepúsculo"
          value="${wizardState.nombre}"
          onchange="actualizarNombre(this.value)"
          oninput="actualizarNombre(this.value)"
        />
      </div>
      
      <!-- Imagen Personalizada -->
      <div class="imagen-personalizada-grupo">
        <label class="imagen-label">🖼️ Imagen Personalizada (opcional)</label>
        <div class="imagen-opciones">
          ${tieneImagen ? `
            <div class="imagen-preview-container">
              <img src="${wizardState.imagenPersonalizada}" class="imagen-preview" alt="Preview">
              <button class="btn-eliminar-imagen" onclick="eliminarImagenPersonalizada()" title="Eliminar imagen">✕</button>
            </div>
          ` : `
            <div class="imagen-upload-zone" onclick="document.getElementById('input-imagen').click()">
              <span class="upload-icono">📷</span>
              <span class="upload-texto">Subir imagen</span>
            </div>
          `}
          <input 
            type="file" 
            id="input-imagen" 
            accept="image/*" 
            style="display:none"
            onchange="cargarImagenPersonalizada(this)"
          />
          <div class="imagen-url-input">
            <input 
              type="text" 
              id="input-imagen-url" 
              placeholder="...o pegar URL de imagen"
              onchange="cargarImagenDesdeURL(this.value)"
            />
          </div>
        </div>
        <small class="imagen-ayuda">La imagen aparecerá en el header del asentamiento</small>
      </div>
      
      <div class="grado-info">
        <div class="grado-badge">
          <span class="grado-icono">🏕️</span>
          <span>Comenzarás como <strong>Estamento</strong> (Grado 1)</span>
        </div>
        <div class="grado-stats">
          <div class="stat"><span>Calidad</span><strong>1</strong></div>
          <div class="stat"><span>Admin</span><strong>15</strong></div>
          <div class="stat"><span>Guarnición</span><strong>5</strong></div>
          <div class="stat"><span>Almacén</span><strong>20</strong></div>
        </div>
      </div>
    </div>
  `;
}

// =====================================================
// PASO 2: SELECCIÓN DE BIOMAS (MANUAL, MULTI-SELECCIÓN)
// =====================================================
function renderizarPasoBioma() {
  // Initialize if needed
  if (!wizardState.biomasSeleccionados) {
    wizardState.biomasSeleccionados = [];
  }

  const seleccionados = wizardState.biomasSeleccionados;

  // Aggregate properties from all selected biomes
  const propiedadesMerged = new Set();
  const recursosMerged = new Set();
  let influenciaMagica = null;

  seleccionados.forEach(nombre => {
    const bioma = BIOMAS_BASE[nombre] || BIOMAS_ESPECIALES[nombre];
    if (bioma) {
      (bioma.propiedadesBase || bioma.propiedades || []).forEach(p => propiedadesMerged.add(p));
      (bioma.recursos || []).forEach(r => recursosMerged.add(r));
      if (!influenciaMagica) influenciaMagica = bioma.influenciaMagica;
    }
  });

  return `
    <div class="paso-contenido paso-bioma">
      <h3>🌍 Seleccionar Biomas</h3>
      <p>Selecciona uno o más biomas para tu territorio. Las propiedades se combinarán.</p>
      
      <div class="bioma-seleccion-grid">
        <div class="bioma-botones">
          ${[...Object.entries(BIOMAS_BASE), ...Object.entries(BIOMAS_ESPECIALES)].map(([nombre, data]) => `
            <button class="btn-bioma-toggle ${seleccionados.includes(nombre) ? 'seleccionado' : ''}"
                    onclick="toggleBiomaSeleccion('${nombre}')">
              ${data.icono} ${nombre}
            </button>
          `).join('')}
        </div>
      </div>
      
      ${seleccionados.length > 0 ? `
        <div class="bioma-resumen" style="margin-top: 2rem;">
          <h4>📋 Resumen de Selección (${seleccionados.length} bioma${seleccionados.length > 1 ? 's' : ''})</h4>
          
          <div class="biomas-seleccionados-lista">
            ${seleccionados.map(n => {
    const b = BIOMAS_BASE[n] || BIOMAS_ESPECIALES[n];
    return `<span class="tag-mini">${b?.icono || '🌍'} ${n}</span>`;
  }).join('')}
          </div>
          
          <div class="resumen-seccion" style="margin-top: 1rem;">
            <h5>Propiedades Combinadas</h5>
            <div class="tags-mini">
              ${[...propiedadesMerged].map(p => `
                <span class="tag-mini">${PROPIEDADES[p]?.icono || '📍'} ${p}</span>
              `).join('')}
            </div>
          </div>
          
          ${influenciaMagica ? `
            <div class="resumen-seccion" style="margin-top: 0.5rem;">
              <h5>Influencia Mágica</h5>
              <span class="influencia-badge ${influenciaMagica.toLowerCase()}">${INFLUENCIA_MAGICA[influenciaMagica]?.icono} ${influenciaMagica}</span>
            </div>
          ` : ''}
        </div>
      ` : '<p class="sin-recursos" style="margin-top: 2rem;">Selecciona al menos un bioma</p>'}
    </div>
  `;
}

function toggleBiomaSeleccion(nombre) {
  if (!wizardState.biomasSeleccionados) {
    wizardState.biomasSeleccionados = [];
  }

  const idx = wizardState.biomasSeleccionados.indexOf(nombre);
  if (idx >= 0) {
    wizardState.biomasSeleccionados.splice(idx, 1);
  } else {
    wizardState.biomasSeleccionados.push(nombre);
  }

  // Rebuild Aggregations
  const propiedadesMerged = new Set();
  let influenciaMagica = null;

  wizardState.biomasSeleccionados.forEach(n => {
    const bioma = BIOMAS_BASE[n] || BIOMAS_ESPECIALES[n];
    if (bioma) {
      // Use propiedadesBase for base biomes, propiedadesCapa for special biomes
      const props = bioma.propiedadesBase || bioma.propiedadesCapa || [];
      props.forEach(p => propiedadesMerged.add(p));
      if (!influenciaMagica) influenciaMagica = bioma.influenciaMagica;
    }
  });

  wizardState.propiedades = [...propiedadesMerged];
  wizardState.influenciaMagica = influenciaMagica;

  // Set biomaBase for compatibility (first selected)
  if (wizardState.biomasSeleccionados.length > 0) {
    wizardState.biomaBase = wizardState.biomasSeleccionados[0];
  } else {
    wizardState.biomaBase = null;
  }

  renderizarPantalla();
}

function renderizarResumenBioma() {
  if (!wizardState.biomaBase && !wizardState.biomaFusionado) {
    return '<div class="bioma-resumen vacio"><p>Tira los dados para determinar tu bioma</p></div>';
  }

  let bioma, propiedades, recursos, influencia;

  if (wizardState.biomaFusionado) {
    bioma = wizardState.biomaFusionado;
    propiedades = bioma.propiedades;
    recursos = bioma.recursos;
    influencia = bioma.influenciaMagica;
  } else if (wizardState.biomaBase) {
    bioma = BIOMAS_BASE[wizardState.biomaBase];
    propiedades = bioma.propiedadesBase || [];
    recursos = bioma.recursos;
    influencia = bioma.influenciaMagica;
  }

  return `
    <div class="bioma-resumen">
      <div class="bioma-resumen-header">
        <span class="bioma-icono-grande">${wizardState.biomaFusionado?.icono || bioma?.icono || '🌍'}</span>
        <div>
          <h4>${wizardState.biomaFusionado?.nombre || wizardState.biomaBase}</h4>
          <span class="influencia-badge ${influencia?.toLowerCase()}">${INFLUENCIA_MAGICA[influencia]?.icono} ${influencia}</span>
        </div>
      </div>
      
      <div class="bioma-resumen-contenido">
        <div class="resumen-seccion">
          <h5>Propiedades del Terreno</h5>
          <div class="tags-mini">
            ${propiedades.map(p => `
              <span class="tag-mini">${PROPIEDADES[p]?.icono || '📍'} ${p}</span>
            `).join('')}
          </div>
        </div>
        
        ${wizardState.biomaFusionado?.recursosGarantizados?.length > 0 ? `
          <div class="resumen-seccion garantizados">
            <h5>✨ Recursos Garantizados</h5>
            <div class="tags-mini">
              ${wizardState.biomaFusionado.recursosGarantizados.map(r => `
                <span class="tag-mini garantizado">${RECURSOS[r]?.icono || '📦'} ${r}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${wizardState.biomaFusionado?.peculiaridadFija ? `
          <div class="resumen-seccion">
            <h5>⚠️ Peculiaridad Fija</h5>
            <span class="tag-mini peculiaridad">${PECULIARIDADES[wizardState.biomaFusionado.peculiaridadFija]?.icono} ${wizardState.biomaFusionado.peculiaridadFija}</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function tirarD12Bioma() {
  const resultado = determinarTipoBioma();

  wizardState.tiradaD12 = resultado.tiradaD12;
  wizardState.esBiomaEspecial = resultado.esBiomaEspecial;
  wizardState.biomaBase = resultado.biomaBase;
  wizardState.biomaEspecial = resultado.biomaEspecial;

  // Resetear sub-bioma y fusión
  wizardState.subBioma = null;
  wizardState.tiradaSubBioma = null;
  wizardState.biomaFusionado = null;


  // Si es bioma base, cargar propiedades automáticamente
  if (!resultado.esBiomaEspecial && resultado.biomaBase) {
    const biomaData = BIOMAS_BASE[resultado.biomaBase];
    wizardState.propiedades = [...biomaData.propiedadesBase];
    wizardState.influenciaMagica = biomaData.influenciaMagica;
  }

  renderizarPantalla();
}

function tirarD6SubBioma() {
  const resultado = determinarSubBioma();

  wizardState.subBioma = resultado.subBioma;
  wizardState.tiradaSubBioma = resultado.tiradaD6;

  // Fusionar biomas
  if (wizardState.biomaEspecial && wizardState.subBioma) {
    wizardState.biomaFusionado = fusionarBiomas(wizardState.biomaEspecial, wizardState.subBioma);
    wizardState.propiedades = [...wizardState.biomaFusionado.propiedades];
    wizardState.influenciaMagica = wizardState.biomaFusionado.influenciaMagica;

    // Agregar peculiaridad fija si existe
    if (wizardState.biomaFusionado.peculiaridadFija) {
      wizardState.peculiaridadFija = wizardState.biomaFusionado.peculiaridadFija;
      if (!wizardState.peculiaridades.includes(wizardState.peculiaridadFija)) {
        wizardState.peculiaridades.push(wizardState.peculiaridadFija);
      }
    }
  }

  renderizarPantalla();
}

function seleccionarBiomaManual(tipo, nombre) {
  if (tipo === 'base') {
    wizardState.esBiomaEspecial = false;
    wizardState.biomaBase = nombre;
    wizardState.biomaEspecial = null;
    wizardState.subBioma = null;
    wizardState.biomaFusionado = null;
    wizardState.tiradaD12 = BIOMAS_BASE[nombre].id;

    const biomaData = BIOMAS_BASE[nombre];
    wizardState.propiedades = [...biomaData.propiedadesBase];
    wizardState.influenciaMagica = biomaData.influenciaMagica;
  } else {
    wizardState.esBiomaEspecial = true;
    wizardState.biomaEspecial = nombre;
    wizardState.biomaBase = null;
    wizardState.tiradaD12 = BIOMAS_ESPECIALES[nombre].idRango[0];
  }

  renderizarPantalla();
}

// =====================================================
// PASO 3: PROPIEDADES DEL TERRENO (SELECCIÓN MANUAL)
// =====================================================
function renderizarPasoPropiedades() {
  // Collect suggested properties from selected biomes
  const propiedadesSugeridas = new Set();
  (wizardState.biomasSeleccionados || []).forEach(nombre => {
    const bioma = BIOMAS_BASE[nombre] || BIOMAS_ESPECIALES[nombre];
    if (bioma) {
      // Use propiedadesBase for base biomes, propiedadesCapa for special biomes
      const props = bioma.propiedadesBase || bioma.propiedadesCapa || [];
      props.forEach(p => {
        if (p !== 'Bioma Secundario') propiedadesSugeridas.add(p);
      });
    }
  });

  // Current selected properties
  const propiedadesActivas = wizardState.propiedades || [];

  return `
    <div class="paso-contenido paso-seleccion">
      <h3>🌍 Propiedades del Terreno</h3>
      <p>Selecciona las propiedades de tu territorio. Las sugeridas por los biomas están resaltadas.</p>
      
      <div class="propiedades-grid">
        ${Object.entries(PROPIEDADES)
      .filter(([nombre]) => nombre !== 'Bioma Secundario')
      .map(([nombre, data]) => {
        const esSugerida = propiedadesSugeridas.has(nombre);
        const seleccionada = propiedadesActivas.includes(nombre);
        return `
              <button class="btn-propiedad-toggle ${seleccionada ? 'seleccionado' : ''} ${esSugerida ? 'sugerida' : ''}"
                      onclick="togglePropiedad('${nombre}')">
                <span class="prop-icono">${data.icono}</span>
                <span class="prop-nombre">${nombre}</span>
                ${esSugerida ? '<span class="badge-sugerida">✓ Bioma</span>' : ''}
              </button>
            `;
      }).join('')}
      </div>
      
      <div class="propiedades-resumen" style="margin-top: 2rem;">
        <h4>Propiedades Activas (${propiedadesActivas.length})</h4>
        <div class="tags-lista">
          ${propiedadesActivas.length > 0 ? propiedadesActivas.map(p => `
            <span class="tag activo">${PROPIEDADES[p]?.icono} ${p}</span>
          `).join('') : '<span class="sin-recursos">Ninguna seleccionada</span>'}
        </div>
      </div>
      
      <div class="seccion-peculiaridades" style="margin-top: 2rem;">
        <h4>✨ Peculiaridades del Territorio</h4>
        <p>Características especiales adicionales</p>
        
        ${wizardState.peculiaridadFija ? `
          <div class="peculiaridad-fija">
            <span class="tag fija">🔒 ${PECULIARIDADES[wizardState.peculiaridadFija]?.icono} ${wizardState.peculiaridadFija} (Obligatoria)</span>
          </div>
        ` : ''}
        
        <div class="seleccion-grid">
          ${Object.entries(PECULIARIDADES).map(([nombre, data]) => {
        const esFija = wizardState.peculiaridadFija === nombre;
        const seleccionada = wizardState.peculiaridades.includes(nombre);
        return `
              <div class="opcion-card ${seleccionada ? 'seleccionado' : ''} ${esFija ? 'fija' : ''}" 
                   onclick="${esFija ? '' : `togglePeculiaridad('${nombre}')`}">
                <div class="opcion-header">
                  <span class="opcion-icono">${data.icono}</span>
                  <span class="opcion-nombre">${nombre}</span>
                  ${esFija ? '<span class="badge-fija">🔒</span>' : ''}
                </div>
                <p class="opcion-desc">${data.descripcion}</p>
                <div class="opcion-efectos">
                  ${Object.entries(data.efectos).slice(0, 3).map(([stat, val]) => `
                    <span class="efecto ${obtenerClaseColor(stat, val)}">${formatearValor(val)} ${stat}</span>
                  `).join('')}
                </div>
              </div>
            `;
      }).join('')}
        </div>
      </div>
    </div>
  `;
}

function togglePropiedad(nombre) {
  if (!wizardState.propiedades) wizardState.propiedades = [];

  const idx = wizardState.propiedades.indexOf(nombre);
  if (idx >= 0) {
    wizardState.propiedades.splice(idx, 1);
  } else {
    wizardState.propiedades.push(nombre);
  }
  renderizarPantalla();
}

// =====================================================
// PASO 4: RECURSOS DEL TERRITORIO (SELECCIÓN MANUAL)
// =====================================================
function renderizarPasoRecursos() {
  // Collect suggested resources from selected biomes
  const recursosSugeridos = new Set();
  (wizardState.biomasSeleccionados || []).forEach(nombre => {
    const bioma = BIOMAS_BASE[nombre] || BIOMAS_ESPECIALES[nombre];
    if (bioma) {
      (bioma.recursos || []).forEach(r => recursosSugeridos.add(r));
      (bioma.exoticos || []).forEach(r => recursosSugeridos.add(r));
      (bioma.recursosGarantizados || []).forEach(r => recursosSugeridos.add(r));
    }
  });

  // Current selected resources
  const recursosActivos = Object.keys(wizardState.recursos || {});
  const modificadoresPropiedades = calcularModificadoresRecursos(wizardState.propiedades || []);

  return `
    <div class="paso-contenido paso-recursos">
      <h3>📦 Recursos del Territorio</h3>
      <p>Selecciona qué recursos existen en tu territorio. Los de tus biomas están resaltados.</p>
      
      <div class="recursos-seleccion-grid">
        ${Object.entries(RECURSOS).map(([nombre, data]) => {
    const esSugerido = recursosSugeridos.has(nombre);
    const seleccionado = recursosActivos.includes(nombre);
    return `
              <button class="btn-recurso-toggle ${seleccionado ? 'seleccionado' : ''} ${esSugerido ? 'sugerido' : ''}"
                      onclick="toggleRecursoSeleccion('${nombre}')">
                <span class="rec-icono">${data.icono}</span>
                <span class="rec-nombre">${nombre}</span>
                ${esSugerido ? '<span class="badge-sugerida">✓ Bioma</span>' : ''}
              </button>
            `;
  }).join('')}
      </div>
      
      ${recursosActivos.length > 0 ? `
        <div class="recursos-configuracion" style="margin-top: 2rem;">
          <h4>Configurar Abundancia (${recursosActivos.length} recursos)</h4>
          <div class="recursos-tabla">
            <div class="recursos-tabla-header">
              <span>Recurso</span>
              <span>Abundancia</span>
              <span>Mod.</span>
              <span></span>
            </div>
            ${recursosActivos.map(recurso => {
    const estado = wizardState.recursos[recurso] || { abundancia: "Normal" };
    const mod = modificadoresPropiedades[recurso] || 0;
    const modAbundancia = obtenerModificadorAbundancia(estado.abundancia);
    const modTotal = mod + modAbundancia;

    return `
                  <div class="recurso-row">
                    <span class="recurso-nombre">
                      ${RECURSOS[recurso]?.icono || '📦'} ${recurso}
                    </span>
                    <div class="recurso-abundancia">
                      <select onchange="cambiarAbundancia('${recurso}', this.value)" class="select-abundancia ${obtenerClaseAbundancia(estado.abundancia)}">
                        ${Object.keys(NIVELES_ABUNDANCIA).filter(n => n !== 'Inexistente').map(nivel => `
                          <option value="${nivel}" ${estado.abundancia === nivel ? 'selected' : ''}>${nivel}</option>
                        `).join('')}
                      </select>
                    </div>
                    <span class="recurso-mod ${modTotal > 0 ? 'positivo' : modTotal < 0 ? 'negativo' : 'neutro'}">
                      ${modTotal !== 0 ? formatearValor(modTotal) : '-'}
                    </span>
                    <button class="btn-eliminar-recurso" onclick="toggleRecursoSeleccion('${recurso}')">🗑️</button>
                  </div>
                `;
  }).join('')}
          </div>
        </div>
      ` : '<p class="sin-recursos" style="margin-top: 2rem;">Selecciona los recursos que existen en tu territorio</p>'}
    </div>
  `;
}

function toggleRecursoSeleccion(nombre) {
  if (!wizardState.recursos) wizardState.recursos = {};

  if (wizardState.recursos[nombre]) {
    // Remove
    delete wizardState.recursos[nombre];
  } else {
    // Add with default abundance
    wizardState.recursos[nombre] = { abundancia: "Normal" };
  }
  renderizarPantalla();
}

/**
 * Tirar dados para determinar abundancia de recursos del bioma
 * Lógica: 1 Abundante, 2 Escasos, resto Normal
 */
function tirarRecursoBioma() {
  const biomaActual = wizardState.biomaFusionado || BIOMAS_BASE[wizardState.biomaBase];
  if (!biomaActual) return;

  const recursos = biomaActual.recursos;
  const dado = biomaActual.dado;
  const maxDado = parseInt(dado.replace('d', ''), 10);

  // Realizar las tiradas según el dado del bioma
  const tiradas = [];
  for (let i = 0; i < maxDado; i++) {
    tiradas.push(lanzarDado(dado));
  }

  // Ordenar tiradas para determinar abundancia
  // El más bajo = Abundante (recurso más común)
  // Los 2 más altos = Escasos (recursos más raros)
  const tiradasOrdenadas = [...tiradas].sort((a, b) => a - b);
  const tiradaAbundante = tiradasOrdenadas[0]; // Más bajo = abundante
  const tiradasEscasas = [tiradasOrdenadas[tiradasOrdenadas.length - 1], tiradasOrdenadas[tiradasOrdenadas.length - 2]]; // 2 más altos = escasos

  // Reiniciar recursos del bioma
  recursos.forEach((recurso, idx) => {
    const numRecurso = idx + 1; // Los recursos están indexados 1-N
    let abundancia = "Normal";

    if (numRecurso === tiradaAbundante) {
      abundancia = "Abundante";
    } else if (tiradasEscasas.includes(numRecurso)) {
      abundancia = "Escaso";
    }

    wizardState.recursos[recurso] = {
      abundancia: abundancia,
      tirada: numRecurso,
      esGarantizado: false,
      esExotico: false
    };
  });

  // Mostrar resultado
  mostrarResultadoTiradaCompleta(recursos, tiradaAbundante, tiradasEscasas);
  renderizarPantalla();
}

/**
 * Tirar dado para descubrir UN recurso exótico
 * El recurso descubierto entra en nivel Normal
 */
function tirarRecursoExotico() {
  const biomaActual = wizardState.biomaFusionado || BIOMAS_BASE[wizardState.biomaBase];
  if (!biomaActual) return;

  const exoticos = biomaActual.exoticos;
  const dado = biomaActual.dadoExotico;
  const tirada = lanzarDado(dado);

  // Seleccionar el exótico según la tirada (índice 1-N)
  const indice = Math.min(tirada - 1, exoticos.length - 1);
  const recursoSeleccionado = exoticos[indice];

  // El exótico descubierto entra en Normal
  wizardState.recursos[recursoSeleccionado] = {
    abundancia: "Normal",
    tirada: tirada,
    esGarantizado: false,
    esExotico: true
  };

  mostrarResultadoDadoExotico(recursoSeleccionado, tirada);
  renderizarPantalla();
}

function mostrarResultadoTiradaCompleta(recursos, abundante, escasos) {
  const resultadoDiv = document.getElementById('resultado-dado');
  if (!resultadoDiv) return;

  const recursoAbundante = recursos[abundante - 1];
  const recursosEscasos = escasos.map(t => recursos[t - 1]).filter(Boolean);
  const recursosNormales = recursos.filter((r, i) =>
    (i + 1) !== abundante && !escasos.includes(i + 1)
  );

  resultadoDiv.innerHTML = `
    <div class="tirada-completa-resultado animado">
      <button class="btn-cerrar-resultado" onclick="cerrarResultadoDado()">×</button>
      <div class="tirada-header-grande">
        <span class="dado-grande">🎲</span>
        <h4>¡Recursos Determinados!</h4>
      </div>
      <div class="tirada-resumen">
        <div class="tirada-item abundante destacado">
          <span class="tirada-badge">+1</span>
          <span class="tirada-label">ABUNDANTE:</span>
          <span class="tirada-recurso">${RECURSOS[recursoAbundante]?.icono || '📦'} <strong>${recursoAbundante}</strong></span>
        </div>
        <div class="tirada-item escaso destacado">
          <span class="tirada-badge">-2</span>
          <span class="tirada-label">ESCASOS:</span>
          <span class="tirada-recurso">${recursosEscasos.map(r => `${RECURSOS[r]?.icono || '📦'} <strong>${r}</strong>`).join(' • ')}</span>
        </div>
        <div class="tirada-item normal">
          <span class="tirada-badge">0</span>
          <span class="tirada-label">NORMALES:</span>
          <span class="tirada-recurso">${recursosNormales.map(r => `${RECURSOS[r]?.icono || '📦'} ${r}`).join(', ')}</span>
        </div>
      </div>
    </div>
  `;
}

function cerrarResultadoDado() {
  const resultadoDiv = document.getElementById('resultado-dado');
  if (resultadoDiv) resultadoDiv.innerHTML = '';
}

function mostrarResultadoDadoExotico(recurso, tirada) {
  const resultadoDiv = document.getElementById('resultado-dado');
  if (!resultadoDiv) return;

  resultadoDiv.innerHTML = `
    <div class="tirada-completa-resultado animado exotico-resultado">
      <button class="btn-cerrar-resultado" onclick="cerrarResultadoDado()">×</button>
      <div class="tirada-header-grande">
        <span class="dado-grande exotico-dado">🎲 ${tirada}</span>
        <h4>¡Recurso Exótico Descubierto!</h4>
      </div>
      <div class="exotico-descubierto">
        <span class="exotico-icono-grande">${RECURSOS[recurso]?.icono || '💎'}</span>
        <span class="exotico-nombre-grande">${recurso}</span>
        <span class="exotico-estado">Ahora disponible (Nivel: Normal)</span>
      </div>
    </div>
  `;
}

function mostrarResultadoDado(resultado, esExotico) {
  const resultadoDiv = document.getElementById('resultado-dado');
  if (!resultadoDiv) return;

  resultadoDiv.innerHTML = `
    <div class="dado-resultado ${esExotico ? 'exotico' : ''} ${obtenerClaseAbundancia(resultado.abundancia)}">
      <span class="dado-valor">🎲 ${resultado.tirada}</span>
      <span class="dado-recurso">${RECURSOS[resultado.recurso]?.icono || '📦'} ${resultado.recurso}</span>
      <span class="dado-abundancia ${obtenerClaseAbundancia(resultado.abundancia)}">
        ${resultado.abundancia} (${formatearValor(obtenerModificadorAbundancia(resultado.abundancia))})
      </span>
    </div>
  `;

  // Remover después de 5 segundos
  setTimeout(() => {
    if (resultadoDiv) resultadoDiv.innerHTML = '';
  }, 5000);
}

function cambiarAbundancia(recurso, nivel) {
  wizardState.recursos[recurso] = {
    ...wizardState.recursos[recurso],
    abundancia: nivel
  };
  renderizarPantalla();
}

function agregarRecursoManual() {
  const select = document.getElementById('select-recurso-manual');
  const nombreRecurso = select.value;

  if (!nombreRecurso) return;

  // Agregar con abundancia Normal por defecto
  wizardState.recursos[nombreRecurso] = {
    abundancia: "Normal",
    tirada: null,
    esGarantizado: false,
    esExotico: false,
    esManual: true
  };

  renderizarPantalla();
}

function eliminarRecursoManual(recurso) {
  if (wizardState.recursos[recurso]) {
    delete wizardState.recursos[recurso];
    renderizarPantalla();
  }
}

// =====================================================
// PASO 5: POBLACIÓN INICIAL
// =====================================================
function renderizarPasoPoblacion() {
  // Determinar cuotas según tipo de asentamiento
  const esPrimero = wizardState.esPrimerAsentamiento ?? true;
  const totalCuotas = esPrimero ? 4 : 1; // 4 cuotas primer asentamiento, 1 para adicionales

  // Asegurar inicialización para evitar crashes
  if (!wizardState.poblacion) {
    wizardState.poblacion = esPrimero
      ? [{ rol: "Plebeyo", naturaleza: "Neutral", cantidad: 4 }]
      : [{ rol: "Plebeyo", naturaleza: "Neutral", cantidad: 1 }];
  }

  const cuotasUsadas = wizardState.poblacion.reduce((sum, p) => sum + p.cantidad, 0);
  const cuotasRestantes = totalCuotas - cuotasUsadas;

  const descripcionTipo = esPrimero
    ? `Este es el <strong>primer asentamiento</strong> de la expedición. Cuentas con <strong>${totalCuotas} Cuotas</strong> (${totalCuotas * CONVERSION.CUOTA_POBLACION} colonos).`
    : `Este es un <strong>asentamiento adicional</strong>. Solo cuentas con <strong>${totalCuotas} Cuota</strong> (${totalCuotas * CONVERSION.CUOTA_POBLACION} colonos).`;

  return `
    <div class="paso-contenido paso-poblacion">
      <h3>👥 Población Inicial</h3>
      <p>${descripcionTipo}</p>
      
      <div class="cuotas-contador">
        <span class="cuotas-usadas">${cuotasUsadas}/${totalCuotas}</span>
        <span class="cuotas-label">Cuotas asignadas</span>
      </div>
      
      <div class="poblacion-grid">
        ${wizardState.poblacion.map((config, idx) => `
          <div class="poblacion-card">
            <div class="poblacion-header">
              <span class="poblacion-num">#${idx + 1}</span>
              <button class="btn-eliminar-poblacion" onclick="eliminarConfigPoblacion(${idx})" ${wizardState.poblacion.length <= 1 ? 'disabled' : ''}>🗑️</button>
            </div>
            
            <div class="poblacion-campo">
              <label>Rol:</label>
              <select onchange="actualizarPoblacion(${idx}, 'rol', this.value)" class="select-poblacion">
                ${Object.entries(ROLES_POBLACION).map(([rol, data]) => `
                  <option value="${rol}" ${config.rol === rol ? 'selected' : ''}>${data.icono} ${rol}</option>
                `).join('')}
              </select>
              <small>${ROLES_POBLACION[config.rol]?.beneficio || ''}</small>
            </div>
            
            <div class="poblacion-campo">
              <label>Naturaleza:</label>
              <select onchange="actualizarPoblacion(${idx}, 'naturaleza', this.value)" class="select-poblacion">
                ${Object.entries(NATURALEZAS_POBLACION).map(([nat, data]) => `
                  <option value="${nat}" ${config.naturaleza === nat ? 'selected' : ''}>${data.icono} ${nat}</option>
                `).join('')}
              </select>
              <small>${NATURALEZAS_POBLACION[config.naturaleza]?.descripcion || ''}</small>
            </div>
            
            ${config.naturaleza === 'Artificial' ? `
              <div class="poblacion-campo">
                <label>Subtipo Artificial:</label>
                <select onchange="actualizarPoblacion(${idx}, 'subtipo', this.value)" class="select-poblacion">
                  ${["Neutral", "Positiva", "Negativa", "Monstruo"].map(s => `
                    <option value="${s}" ${(config.subtipo || 'Neutral') === s ? 'selected' : ''}>${NATURALEZAS_POBLACION[s]?.icono || '⚪'} ${s}</option>
                  `).join('')}
                </select>
                <small>Define el subtipo base de los Artificiales</small>
              </div>
            ` : ''}
            
            <div class="poblacion-campo">
              <label>Cuotas:</label>
              <div class="cantidad-control">
                <button onclick="ajustarCantidadPoblacion(${idx}, -1)" class="btn-cantidad" ${config.cantidad <= 1 ? 'disabled' : ''}>−</button>
                <span class="cantidad-valor">${config.cantidad}</span>
                <button onclick="ajustarCantidadPoblacion(${idx}, 1)" class="btn-cantidad" ${cuotasRestantes <= 0 ? 'disabled' : ''}>+</button>
              </div>
              <small>${config.cantidad * CONVERSION.CUOTA_POBLACION} colonos</small>
            </div>
          </div>
        `).join('')}
        
        ${cuotasRestantes > 0 ? `
          <div class="poblacion-card agregar" onclick="agregarConfigPoblacion()">
            <span class="agregar-icono">➕</span>
            <span>Agregar grupo</span>
          </div>
        ` : ''}
      </div>
      
      <div class="poblacion-resumen">
        <h4>Resumen de Población</h4>
        <div class="resumen-stats">
          <div class="stat-item">
            <span class="stat-label">Total colonos:</span>
            <span class="stat-valor">${cuotasUsadas * CONVERSION.CUOTA_POBLACION}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Mod. Calidad:</span>
            <span class="stat-valor ${calcularModCalidadPoblacion() >= 0 ? 'positivo' : 'negativo'}">
              ${formatearValor(calcularModCalidadPoblacion())}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Bono Inmigración:</span>
            <span class="stat-valor">${formatearValor(calcularBonoInmigracionPoblacion())}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function actualizarPoblacion(idx, campo, valor) {
  if (wizardState.poblacion[idx]) {
    wizardState.poblacion[idx][campo] = valor;
    renderizarPantalla();
  }
}

function ajustarCantidadPoblacion(idx, delta) {
  if (wizardState.poblacion[idx]) {
    const nuevaCantidad = wizardState.poblacion[idx].cantidad + delta;
    const totalActual = wizardState.poblacion.reduce((sum, p, i) => sum + (i === idx ? 0 : p.cantidad), 0);

    if (nuevaCantidad >= 1 && totalActual + nuevaCantidad <= 4) {
      wizardState.poblacion[idx].cantidad = nuevaCantidad;
      renderizarPantalla();
    }
  }
}

function agregarConfigPoblacion() {
  const cuotasUsadas = wizardState.poblacion.reduce((sum, p) => sum + p.cantidad, 0);
  if (cuotasUsadas < 4) {
    wizardState.poblacion.push({ rol: "Plebeyo", naturaleza: "Neutral", cantidad: 1 });
    renderizarPantalla();
  }
}

function eliminarConfigPoblacion(idx) {
  if (wizardState.poblacion.length > 1) {
    wizardState.poblacion.splice(idx, 1);
    renderizarPantalla();
  }
}

function calcularModCalidadPoblacion() {
  return wizardState.poblacion.reduce((sum, config) => {
    const nat = NATURALEZAS_POBLACION[config.naturaleza];
    return sum + (nat?.modCalidad || 0) * config.cantidad;
  }, 0);
}

function calcularBonoInmigracionPoblacion() {
  return wizardState.poblacion.reduce((sum, config) => {
    const nat = NATURALEZAS_POBLACION[config.naturaleza];
    return sum + (nat?.bonoInmigracion || 0) * config.cantidad;
  }, 0);
}

// =====================================================
// PASO 6: EDIFICIOS
// =====================================================
function renderizarPasoEdificios() {
  const esPrimero = wizardState.esPrimerAsentamiento ?? true;

  // Asegurar inicialización
  if (!wizardState.edificios) {
    wizardState.edificios = [];
    if (!esPrimero) {
      // Si no es el primero, asignar Zona Residencial automáticamente
      wizardState.edificios = ["Zona Residencial"];
    }
  }

  const limiteEdificios = esPrimero ? 3 : 1;
  const seleccionados = wizardState.edificios.length;

  return `
    <div class="paso-contenido paso-edificios">
      <h3>🏗️ Construcciones Iniciales</h3>
      <p>
        ${esPrimero
      ? `Como primer asentamiento, puedes elegir <strong>3 edificios</strong> iniciales.`
      : `Los asentamientos adicionales comienzan solo con <strong>Zona Residencial</strong>.`}
      </p>

      <div class="edificios-grid">
        ${EDIFICIOS_INICIALES.map(edificio => {
        const esSeleccionado = wizardState.edificios.includes(edificio);
        const esBloqueado = !esPrimero && edificio === "Zona Residencial";
        const esDeshabilitado = !esSeleccionado && seleccionados >= limiteEdificios && esPrimero;

        return `
            <div class="opcion-card ${esSeleccionado ? 'seleccionado' : ''} ${esDeshabilitado ? 'deshabilitado' : ''}"
                 onclick="${!esBloqueado && (!esDeshabilitado || esSeleccionado) ? `toggleEdificio('${edificio}')` : ''}">
              <div class="opcion-header">
                <span class="opcion-icono">🏠</span>
                <span class="opcion-nombre">${edificio}</span>
              </div>
              <div class="opcion-check">
                ${esSeleccionado ? '✅' : '⬜'}
              </div>
            </div>
          `;
      }).join('')}
      </div>
      
      <div class="seleccion-resumen">
        ${seleccionados}/${limiteEdificios} edificios seleccionados
      </div>
    </div>
  `;
}

function toggleEdificio(nombre) {
  const esPrimero = wizardState.esPrimerAsentamiento ?? true;
  if (!esPrimero) return;

  const index = wizardState.edificios.indexOf(nombre);

  if (index >= 0) {
    wizardState.edificios.splice(index, 1);
  } else {
    if (wizardState.edificios.length < 3) {
      wizardState.edificios.push(nombre);
    }
  }
  renderizarPantalla();
}

// =====================================================
// PASO 7: CONFIRMACIÓN (EDITABLE)
// =====================================================
function renderizarPasoConfirmacion() {
  // Asegurar que las propiedades existan
  if (!wizardState.propiedades) wizardState.propiedades = [];
  if (!wizardState.peculiaridades) wizardState.peculiaridades = [];
  if (!wizardState.recursos) wizardState.recursos = {};

  const bonificaciones = calcularBonificaciones(wizardState.propiedades, wizardState.peculiaridades);
  const biomaActual = wizardState.biomaFusionado || BIOMAS_BASE[wizardState.biomaBase];

  const allProps = wizardState.propiedades.concat(wizardState.peculiaridades);
  const modificadoresPropiedades = calcularModificadoresRecursos(allProps);

  // Separar según lógica correcta
  const beneficios = [];
  const penalizaciones = [];

  Object.entries(bonificaciones).forEach(([stat, val]) => {
    if (val === 0) return;
    const esInvertida = esStatInvertida(stat);
    const esBueno = esInvertida ? (val < 0) : (val > 0);
    if (esBueno) beneficios.push([stat, val]);
    else penalizaciones.push([stat, val]);
  });

  const recursosActivos = Object.entries(wizardState.recursos)
    .filter(([, data]) => data.abundancia !== 'Inexistente');

  return `
    <div class="paso-contenido paso-confirmacion">
      <div class="confirmacion-header">
        <div class="confirmacion-icono">${biomaActual?.icono || '🏕️'}</div>
        <input type="text" class="input-nombre-confirmacion" value="${wizardState.nombre || ''}" 
               onchange="actualizarNombre(this.value)" placeholder="Nombre del asentamiento" />
        <div class="badges-confirmacion">
          <span class="badge-grado">Estamento (Grado 1)</span>
          <span class="badge-bioma">${wizardState.biomaFusionado?.nombre || wizardState.biomaBase}</span>
          <select class="select-magia-confirmacion ${wizardState.influenciaMagica.toLowerCase()}" 
                  onchange="cambiarInfluenciaMagica(this.value)">
            ${Object.keys(INFLUENCIA_MAGICA).map(nivel => `
              <option value="${nivel}" ${wizardState.influenciaMagica === nivel ? 'selected' : ''}>
                ${INFLUENCIA_MAGICA[nivel]?.icono} ${nivel}
              </option>
            `).join('')}
          </select>
        </div>
      </div>
      
      <div class="confirmacion-seccion">
        <h4>🌍 Propiedades <small>(volver a paso 3 para editar)</small></h4>
        <div class="tags-lista">
          ${wizardState.propiedades.map(p => `
            <span class="tag">${PROPIEDADES[p]?.icono} ${p}</span>
          `).join('')}
        </div>
      </div>
      
      ${wizardState.peculiaridades.length > 0 ? `
        <div class="confirmacion-seccion">
          <h4>✨ Peculiaridades</h4>
          <div class="tags-lista">
            ${wizardState.peculiaridades.map(p => `
              <span class="tag ${wizardState.peculiaridadFija === p ? 'fija' : ''}">${PECULIARIDADES[p]?.icono} ${p}</span>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="confirmacion-seccion recursos-seccion">
        <h4>📦 Recursos Disponibles <span class="editable-hint">(✏️ Editable)</span></h4>
        <div class="recursos-tabla-final">
          <div class="recursos-tabla-header-final">
            <span>Recurso</span>
            <span>Abundancia</span>
            <span>Mod. Abund.</span>
            <span>Mod. Prop.</span>
            <span>Mod. Total</span>
            <span>Pob. Asignada</span>
            <span>Prod./Turno</span>
          </div>
          ${recursosActivos.map(([nombre, data]) => {
    const modAbundancia = obtenerModificadorAbundancia(data.abundancia);
    const modPropiedades = modificadoresPropiedades[nombre] || 0;
    const modTotal = modAbundancia + modPropiedades;

    return `
              <div class="recurso-row-final ${obtenerClaseAbundancia(data.abundancia)}">
                <span class="recurso-nombre-final">
                  ${RECURSOS[nombre]?.icono || '📦'} ${nombre}
                </span>
                <div class="abundancia-cell-editable">
                  <select onchange="cambiarAbundanciaConfirmacion('${nombre}', this.value)" 
                          class="select-abundancia-mini ${obtenerClaseAbundancia(data.abundancia)}">
                    ${Object.keys(NIVELES_ABUNDANCIA).map(nivel => `
                      <option value="${nivel}" ${data.abundancia === nivel ? 'selected' : ''}>${nivel}</option>
                    `).join('')}
                  </select>
                </div>
                <span class="mod-cell ${modAbundancia > 0 ? 'positivo' : modAbundancia < 0 ? 'negativo' : 'neutro'}">
                  ${modAbundancia !== 0 ? formatearValor(modAbundancia) : '-'}
                </span>
                <span class="mod-cell ${modPropiedades > 0 ? 'positivo' : modPropiedades < 0 ? 'negativo' : 'neutro'}">
                  ${modPropiedades !== 0 ? formatearValor(modPropiedades) : '-'}
                </span>
                <span class="mod-total-cell ${modTotal > 0 ? 'positivo' : modTotal < 0 ? 'negativo' : 'neutro'}">
                  ${modTotal !== 0 ? formatearValor(modTotal) : '0'}
                </span>
                <span class="poblacion-cell">-</span>
                <span class="produccion-cell">-</span>
              </div>
            `;
  }).join('')}
        </div>
        
        ${recursosActivos.length === 0 ? `
          <p class="sin-recursos-nota">No hay recursos configurados. Vuelve al paso 4 para tirar los dados.</p>
        ` : ''}
      </div>
      
      <div class="confirmacion-seccion">
        <h4>📊 Modificadores Totales del Terreno</h4>
        <div class="bonificaciones-grid">
          <div class="bonificaciones-columna positivas">
            <h5>✅ Beneficios</h5>
            ${beneficios.length > 0 ? beneficios.map(([stat, val]) => `
              <div class="bonificacion-item positivo">
                <span class="stat-nombre">${stat}</span>
                <span class="stat-valor">${formatearValor(val)}</span>
              </div>
            `).join('') : '<p class="sin-bonificaciones">Ninguno</p>'}
          </div>
          <div class="bonificaciones-columna negativas">
            <h5>⚠️ Penalizaciones</h5>
            ${penalizaciones.length > 0 ? penalizaciones.map(([stat, val]) => `
              <div class="bonificacion-item negativo">
                <span class="stat-nombre">${stat}</span>
                <span class="stat-valor">${formatearValor(val)}</span>
              </div>
            `).join('') : '<p class="sin-bonificaciones">Ninguna</p>'}
          </div>
        </div>
      </div>
    </div>
  `;
}

function cambiarInfluenciaMagica(nuevoNivel) {
  if (INFLUENCIA_MAGICA[nuevoNivel]) {
    wizardState.influenciaMagica = nuevoNivel;
    renderizarPantalla();
  }
}

// Función para cambiar abundancia desde confirmación
function cambiarAbundanciaConfirmacion(recurso, nivel) {
  if (nivel === 'Inexistente') {
    delete wizardState.recursos[recurso];
  } else {
    wizardState.recursos[recurso] = {
      ...wizardState.recursos[recurso],
      abundancia: nivel
    };
  }
  renderizarPantalla();
}

// =====================================================
// MANEJADORES DE EVENTOS DEL WIZARD
// =====================================================

function actualizarNombre(valor) {
  wizardState.nombre = valor;
}

// Funciones para imagen personalizada
function cargarImagenPersonalizada(input) {
  const file = input.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    mostrarNotificacion('Por favor selecciona un archivo de imagen válido', 'error');
    return;
  }

  // Limitar tamaño a 2MB
  if (file.size > 2 * 1024 * 1024) {
    mostrarNotificacion('La imagen es muy grande. Máximo 2MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    wizardState.imagenPersonalizada = e.target.result;
    renderizarPantalla();
    mostrarNotificacion('Imagen cargada correctamente', 'success');
  };
  reader.readAsDataURL(file);
}

function cargarImagenDesdeURL(url) {
  if (!url || url.trim() === '') return;

  // Validar que parece una URL de imagen
  const urlLower = url.toLowerCase();
  if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i) || urlLower.includes('data:image')) {
    wizardState.imagenPersonalizada = url.trim();
    renderizarPantalla();
    mostrarNotificacion('Imagen URL cargada', 'success');
  } else {
    // Intentar cargarla de todas formas
    wizardState.imagenPersonalizada = url.trim();
    renderizarPantalla();
    mostrarNotificacion('URL cargada (verificar validez)', 'warning');
  }
}

function eliminarImagenPersonalizada() {
  wizardState.imagenPersonalizada = null;
  renderizarPantalla();
  mostrarNotificacion('Imagen eliminada', 'info');
}

function togglePeculiaridad(nombre) {
  if (wizardState.peculiaridadFija === nombre) return; // No permitir quitar la fija

  const idx = wizardState.peculiaridades.indexOf(nombre);
  if (idx >= 0) {
    wizardState.peculiaridades.splice(idx, 1);
  } else {
    wizardState.peculiaridades.push(nombre);
  }
  renderizarPantalla();
}

function pasoAnterior() {
  if (wizardState.paso > 1) {
    wizardState.paso--;
    renderizarPantalla();
  }
}

function pasoSiguiente() {
  if (wizardState.paso === 1 && !wizardState.nombre.trim()) {
    mostrarError('Por favor, ingresa un nombre para tu asentamiento');
    return;
  }

  if (wizardState.paso === 2) {
    // Require at least 1 biome selected
    const seleccionados = wizardState.biomasSeleccionados || [];
    if (seleccionados.length === 0) {
      mostrarError('Por favor, selecciona al menos un bioma.');
      return;
    }
  }

  if (wizardState.paso === 5) {
    const esPrimero = wizardState.esPrimerAsentamiento ?? true;
    const totalCuotas = esPrimero ? 4 : 1;
    const cuotasUsadas = (wizardState.poblacion || []).reduce((sum, p) => sum + p.cantidad, 0);
    if (cuotasUsadas !== totalCuotas) {
      mostrarError(`Debes asignar exactamente ${totalCuotas} cuotas de población. Actualmente tienes ${cuotasUsadas}.`);
      return;
    }
  }

  if (wizardState.paso === 6) {
    const esPrimero = wizardState.esPrimerAsentamiento ?? true;
    const numEdificios = wizardState.edificios ? wizardState.edificios.length : 0;
    if (esPrimero && numEdificios < 3) {
      mostrarError('Debes seleccionar 3 construcciones iniciales para tu primer asentamiento.');
      return;
    }
  }

  if (wizardState.paso < 7) {
    // Al pasar al paso de recursos, inicializar garantizados
    if (wizardState.paso === 3) {
      inicializarRecursosGarantizados();
    }
    wizardState.paso++;
    renderizarPantalla();
  }
}

function inicializarRecursosGarantizados() {
  const biomaActual = wizardState.biomaFusionado || BIOMAS_BASE[wizardState.biomaBase];
  if (!biomaActual) return;

  // Recursos garantizados entran en Normal automáticamente
  const garantizados = biomaActual.recursosGarantizados || [];
  garantizados.forEach(recurso => {
    if (!wizardState.recursos[recurso]) {
      wizardState.recursos[recurso] = {
        abundancia: "Normal",
        tirada: null,
        esGarantizado: true,
        esExotico: false
      };
    }
  });

  // Exóticos garantizados también
  const exoticosGarantizados = biomaActual.exoticosGarantizados || [];
  exoticosGarantizados.forEach(recurso => {
    if (!wizardState.recursos[recurso]) {
      wizardState.recursos[recurso] = {
        abundancia: "Normal",
        tirada: null,
        esGarantizado: true,
        esExotico: true
      };
    }
  });
}

function volverInicio() {
  estadoApp.pantalla = 'inicio';
  renderizarPantalla();
}

function confirmarCreacion() {
  if (!wizardState.nombre.trim()) {
    mostrarError('El asentamiento necesita un nombre');
    return;
  }

  try {
    // Usar crearAsentamiento con los parámetros de expedición
    const esPrimero = wizardState.esPrimerAsentamiento ?? true;
    const conectadoA = wizardState.conectadoA ?? null;

    const nuevoAsentamiento = {
      id: Date.now(),
      nombre: wizardState.nombre,
      fechaCreacion: new Date().toISOString(),
      grado: "Estamento",
      propiedades: wizardState.propiedades,
      peculiaridades: wizardState.peculiaridades,
      tributo: "Sin Tributo",
      edificios: wizardState.edificios || [],
      poblacion: wizardState.poblacion,
      recursos: wizardState.recursos,
      // Campos de expedición
      esPrimerAsentamiento: esPrimero,
      conectadoA: conectadoA,
      doblones: esPrimero ? 50 : 0
    };

    nuevoAsentamiento.tiradaD12 = wizardState.tiradaD12;
    nuevoAsentamiento.esBiomaEspecial = wizardState.esBiomaEspecial;
    nuevoAsentamiento.biomaBase = wizardState.biomaBase;
    nuevoAsentamiento.biomaEspecial = wizardState.biomaEspecial;
    nuevoAsentamiento.subBioma = wizardState.subBioma;
    nuevoAsentamiento.biomaFusionado = wizardState.biomaFusionado;
    nuevoAsentamiento.influenciaMagica = wizardState.influenciaMagica;
    nuevoAsentamiento.peculiaridadFija = wizardState.peculiaridadFija;
    nuevoAsentamiento.imagenPersonalizada = wizardState.imagenPersonalizada;


    // Inicializar estado de simulación
    if (typeof resetearSimulacion === 'function') resetearSimulacion();

    // Establecer recursos iniciales basados en tipo de asentamiento
    if (typeof estadoSimulacion !== 'undefined') {
      estadoSimulacion.doblones = esPrimero ? 50 : 0;
      estadoSimulacion.almacen = esPrimero ? { "Alimento": 20 } : { "Alimento": 0 };

      // Inicializar estado de edificios
      if (wizardState.edificios && Array.isArray(wizardState.edificios)) {
        wizardState.edificios.forEach(nombreEdificio => {
          if (typeof nombreEdificio === 'string') {
            estadoSimulacion.edificiosEstado[nombreEdificio] = { grado: 1 };
          }
        });
      }
    }

    // Validar población antes de inicializar
    if (!wizardState.poblacion || !Array.isArray(wizardState.poblacion)) {
      console.warn("Población no válida en confirmarCreacion, usando defecto");
      wizardState.poblacion = esPrimero
        ? [{ rol: "Plebeyo", naturaleza: "Neutral", cantidad: 4 }]
        : [{ rol: "Plebeyo", naturaleza: "Neutral", cantidad: 1 }];
    }

    if (typeof inicializarPoblacion === 'function') {
      inicializarPoblacion(wizardState.poblacion);
    } else {
      throw new Error("Función inicializarPoblacion no encontrada");
    }

    // Guardar estado inicial en el asentamiento (copia profunda básica)
    if (typeof estadoSimulacion !== 'undefined') {
      nuevoAsentamiento.simulacion = JSON.parse(JSON.stringify(estadoSimulacion));
    } else {
      throw new Error("estadoSimulacion no definido");
    }

    // Agregar a la expedición
    if (agregarAsentamientoExpedicion(nuevoAsentamiento)) {
      // Guardar expedición completa
      guardarExpedicion();
      mostrarNotificacion(`✅ Asentamiento "${nuevoAsentamiento.nombre}" creado`);

      // Volver a la lista de asentamientos
      estadoApp.pantalla = 'lista';
      renderizarPantalla();
    } else {
      // Fallback: guardar como asentamiento individual (sin expedición)
      estadoApp.asentamiento = nuevoAsentamiento;
      guardarAsentamiento(nuevoAsentamiento);
      estadoApp.pantalla = 'hud';
      renderizarPantalla();
    }
  } catch (err) {
    console.error("Error en confirmarCreacion:", err);
    alert("Error al crear asentamiento: " + err.message);
  }
}

// =====================================================
// HUD PRINCIPAL
// =====================================================

function renderizarHUD(container) {
  const a = estadoApp.asentamiento;

  // Defensive check
  if (!a) {
    container.innerHTML = `
      <div class="hud-error">
        <h2>⚠️ Error: No hay asentamiento seleccionado</h2>
        <button class="btn-principal" onclick="volverALista()">Volver a la lista</button>
      </div>
    `;
    return;
  }

  // Safe calculations with fallbacks
  const stats = typeof calcularEstadisticasTotales === 'function'
    ? calcularEstadisticasTotales(a)
    : { calidadTotal: 0, grado: {}, bonificaciones: {}, mantenimientoEdificios: 0 };

  const biomaActual = a.biomaFusionado || (typeof BIOMAS_BASE !== 'undefined' ? BIOMAS_BASE[a.biomaBase] : null) || {};
  const modificadoresPropiedades = typeof calcularModificadoresRecursos === 'function'
    ? calcularModificadoresRecursos(a.propiedades || [])
    : {};

  // Quick stats calculations with safe access
  const poblacionTotal = estadoSimulacion?.poblacion?.length || 0;
  const doblones = estadoSimulacion?.doblones || 0;
  const turnoActual = estadoSimulacion?.turno || 0;

  // Sum all food types in storage
  let alimentosEnAlmacen = 0;
  if (estadoSimulacion?.almacen) {
    Object.entries(estadoSimulacion.almacen).forEach(([nombre, cantidad]) => {
      const def = typeof RECURSOS !== 'undefined' ? RECURSOS[nombre] : null;
      const esAlimento = nombre === "Alimento" ||
        (def && (def.categoria === "Alimento" || (def.tags && def.tags.includes("Alimento"))));
      if (esAlimento) alimentosEnAlmacen += cantidad;
    });
  }

  const calidad = stats.calidadTotal || 0;
  const influenciaData = typeof INFLUENCIA_MAGICA !== 'undefined' ? INFLUENCIA_MAGICA[a.influenciaMagica] : null;
  const gradoData = typeof GRADOS !== 'undefined' ? GRADOS[a.grado] : null;

  container.innerHTML = `
    <div class="hud-container">
      <!-- HEADER PRINCIPAL -->
      <header class="hud-header">
        <div class="hud-header-left">
          ${a.imagenPersonalizada
      ? `<img src="${a.imagenPersonalizada}" class="hud-imagen-personalizada" alt="${a.nombre}">`
      : `<span class="hud-icono-grande">${biomaActual?.icono || gradoData?.icono || '🏕️'}</span>`
    }
          <div class="hud-info-asentamiento">
            <h1 class="hud-nombre">${a.nombre}</h1>
            <div class="hud-meta">
              <span class="hud-grado">${a.grado || 'Estamento'}</span>
              <span class="hud-bioma">${a.biomaFusionado?.nombre || a.biomaBase || 'Desconocido'}</span>
              <span class="hud-magia ${(a.influenciaMagica || 'baja').toLowerCase()}">${influenciaData?.icono || '🔵'} ${a.influenciaMagica || 'Baja'}</span>
            </div>
          </div>
        </div>
        
        <div class="hud-header-center">
          <!-- Turn Counter -->
          <div class="hud-turno-display">
            <span class="turno-label">Turno</span>
            <span class="turno-numero">${turnoActual}</span>
          </div>
          
          <div class="hud-quick-stats">
            <div class="quick-stat tooltip-container" data-tooltip="Cuotas de Población&#10;• Cada cuota = 20 habitantes&#10;• Total: ${poblacionTotal * 20} habitantes">
              <span class="qs-icon">👥</span>
              <span class="qs-value">${poblacionTotal}</span>
              <span class="qs-label">Población</span>
            </div>
            <div class="quick-stat tooltip-container" data-tooltip="💰 Doblones: ${doblones}&#10;&#10;📈 Ingresos por turno:&#10;• Tributo: ${Math.floor((stats.calidadTotal || 0) * (a.tributo || 1) / 10)} por cuota&#10;• Mercado: +pasivos de edificios&#10;&#10;📉 Gastos por turno:&#10;• Mantenimiento edificios: ${stats.mantenimientoEdificios || 0}&#10;• Artificiales: ${(estadoSimulacion?.poblacion || []).filter(c => c.naturaleza === 'Artificial').length}">
              <span class="qs-icon">💰</span>
              <span class="qs-value ${doblones < 0 ? 'negativo' : ''}">${doblones}</span>
              <span class="qs-label">Doblones</span>
            </div>
            <div class="quick-stat tooltip-container" data-tooltip="🏛️ Influencia: ${estadoSimulacion?.recursosEspeciales?.influencia || 0}&#10;&#10;• Usada para decretos políticos&#10;• Se genera por edificios políticos&#10;• Acumulativa entre turnos">
              <span class="qs-icon">🏛️</span>
              <span class="qs-value">${estadoSimulacion?.recursosEspeciales?.influencia || 0}</span>
              <span class="qs-label">Influencia</span>
            </div>
            <div class="quick-stat tooltip-container" data-tooltip="🌾 Alimento Total: ${alimentosEnAlmacen}&#10;&#10;📈 Producción: Campos, Granjas, etc.&#10;📉 Consumo: ${poblacionTotal} cuotas x turno&#10;&#10;${alimentosEnAlmacen >= poblacionTotal ? '✅ Suficiente' : '⚠️ ¡Riesgo de hambruna!'}">
              <span class="qs-icon">🌾</span>
              <span class="qs-value ${alimentosEnAlmacen < poblacionTotal ? 'warning' : ''}">${alimentosEnAlmacen}</span>
              <span class="qs-label">Alimento</span>
            </div>
            <div class="quick-stat tooltip-container" data-tooltip="⭐ Calidad Total: ${calidad >= 0 ? '+' : ''}${calidad}&#10;&#10;📊 Composición:&#10;• Base bioma/propiedades&#10;• Mod. población: ${stats.bonificaciones?.modCalidad || 0}&#10;• Mod. edificios&#10;• Hambruna: ${estadoSimulacion?.esHambruna ? '-8' : '0'}&#10;&#10;💡 Afecta tributo e inmigración">
              <span class="qs-icon">⭐</span>
              <span class="qs-value ${calidad >= 0 ? 'positivo' : 'negativo'}">${calidad >= 0 ? '+' : ''}${calidad}</span>
              <span class="qs-label">Calidad</span>
            </div>
            <div class="quick-stat tooltip-container" data-tooltip="💡 Ideas: ${estadoSimulacion?.ideas || 0}&#10;&#10;• Generadas por Académicos&#10;• Usadas para investigación&#10;• Acumulativas entre turnos">
              <span class="qs-icon">💡</span>
              <span class="qs-value">${estadoSimulacion?.ideas || 0}</span>
              <span class="qs-label">Ideas</span>
            </div>
            <div class="quick-stat tooltip-container" data-tooltip="🙏 Devoción: ${estadoSimulacion?.devocion || 0}&#10;&#10;• Generada por Devotos&#10;• Usada para milagros&#10;• Acumulativa entre turnos">
              <span class="qs-icon">🙏</span>
              <span class="qs-value">${estadoSimulacion?.devocion || 0}</span>
              <span class="qs-label">Devoción</span>
            </div>
          </div>
        </div>
        
        <div class="hud-header-right">
          <div class="hud-acciones-turno">
            <button class="btn-pasar-turno" onclick="btnPasarTurno()" title="Pasar al siguiente turno">
              ⏭️ Pasar Turno
            </button>
            <button class="btn-deshacer" onclick="btnDeshacerTurno()" title="Deshacer último turno" ${(estadoSimulacion?.historialTurnos?.length || 0) === 0 ? 'disabled' : ''}>
              ↩️
            </button>
          </div>
          <div class="hud-nav-buttons">
            <button class="btn-header" onclick="volverALista()" title="Ver Expedición">📋</button>
            <button class="btn-header" onclick="mostrarOpciones()" title="Opciones">⚙️</button>
          </div>
        </div>
      </header>
      
      <!-- PANEL DE TRIBUTO -->
      ${renderizarPanelTributo(a, stats)}
      
      ${estadoSimulacion && estadoSimulacion.esHambruna ? `
        <div class="alerta-hambruna">
            ☠️ ¡HAMBRUNA! Sin alimentos: Calidad -8, Crecimiento detenido
        </div>
      ` : ''}

      ${renderizarNavegacionHUD()}
      
      <div class="hud-contenido-dinamico">
        ${renderizarContenidoPestana(a, stats)}
      </div>
    </div>
  `;
}

// Estado de navegación del HUD

// Panel de Tributo desplegable
function renderizarPanelTributo(a, stats) {
  const tributoActual = a.tributo || "Sin Tributo";
  const tributoData = TRIBUTOS[tributoActual] || TRIBUTOS["Sin Tributo"];
  const poblacionTotal = estadoSimulacion?.poblacion?.length || 0;
  const limiteAdmin = stats.grado.admin || 10;
  const poblacionTributable = Math.min(poblacionTotal, limiteAdmin);
  const ingresosEstimados = poblacionTributable * tributoData.doblones;

  return `
    <details class="panel-tributo">
      <summary class="tributo-resumen">
        <span class="tributo-icono">${tributoData.icono}</span>
        <span class="tributo-titulo">Tributo: <strong>${tributoActual}</strong></span>
        <span class="tributo-preview">
          +${ingresosEstimados} 💰/turno | ${tributoData.calidad >= 0 ? '+' : ''}${tributoData.calidad} ⭐
        </span>
      </summary>
      <div class="tributo-contenido">
        <div class="tributo-info">
          <p>
            <strong>Límite Administrativo:</strong> ${limiteAdmin} cuotas 
            (Población actual: ${poblacionTotal})
          </p>
          <p class="tributo-nota">
            ⚠️ Solo puedes cobrar tributo a un máximo de <strong>${limiteAdmin}</strong> cuotas de población.
          </p>
        </div>
        
        <div class="tributo-opciones">
          ${Object.entries(TRIBUTOS).map(([nombre, data]) => {
    const esActual = nombre === tributoActual;
    const ingresosPrev = poblacionTributable * data.doblones;
    return `
              <div class="tributo-opcion ${esActual ? 'activa' : ''}" onclick="cambiarTributo('${nombre}')">
                <div class="tributo-opcion-header">
                  <span class="tributo-opcion-icono">${data.icono}</span>
                  <span class="tributo-opcion-nombre">${nombre}</span>
                  ${esActual ? '<span class="badge-actual">✓ Actual</span>' : ''}
                </div>
                <div class="tributo-opcion-stats">
                  <span class="stat-doblones">+${data.doblones} 💰/cuota</span>
                  <span class="stat-calidad ${data.calidad >= 0 ? 'positivo' : 'negativo'}">
                    ${data.calidad >= 0 ? '+' : ''}${data.calidad} ⭐ Calidad
                  </span>
                </div>
                <div class="tributo-opcion-preview">
                  Estimado: <strong>+${ingresosPrev}</strong> Doblones/turno
                </div>
              </div>
            `;
  }).join('')}
        </div>
      </div>
    </details>
  `;
}

function cambiarTributo(nuevoTributo) {
  if (!TRIBUTOS[nuevoTributo]) return;

  // Actualizar en el asentamiento
  if (estadoApp.asentamiento) {
    estadoApp.asentamiento.tributo = nuevoTributo;

    // Guardar cambios
    if (typeof guardarExpedicion === 'function') {
      guardarExpedicion();
    }

    renderizarPantalla();

    if (typeof mostrarNotificacion === 'function') {
      const data = TRIBUTOS[nuevoTributo];
      mostrarNotificacion(`${data.icono} Tributo cambiado a: ${nuevoTributo}`, 'info');
    }
  }
}


function cambiarPestana(nombre) {
  pestanaActiva = nombre;
  renderizarPantalla();
}

function renderizarNavegacionHUD() {
  const pestanas = [
    { id: 'bioma', icono: '🌿', label: 'Bioma' },
    { id: 'poblacion', icono: '👥', label: 'Población' },
    { id: 'edificios', icono: '🏛️', label: 'Edificios' },
    { id: 'almacenamiento', icono: '📦', label: 'Almacén' },
    { id: 'comercio', icono: '⚖️', label: 'Comercio' },
    { id: 'eventos', icono: '📜', label: 'Eventos' },
    { id: 'militar', icono: '⚔️', label: 'Militar' },
    { id: 'diplomacia', icono: '🤝', label: 'Diplomacia' },
    { id: 'devocion', icono: '🙏', label: 'Devoción' }
  ];

  const turnoActual = estadoSimulacion?.turno || 0;
  const puedeDeshacer = estadoSimulacion?.historialTurnos?.length > 0;

  return `
    <nav class="hud-nav">
      <div class="nav-tabs-container">
        ${pestanas.map(p => `
          <button class="nav-tab ${pestanaActiva === p.id ? 'activa' : ''}" 
                  onclick="cambiarPestana('${p.id}')"
                  title="${p.label}">
            <span class="tab-icono">${p.icono}</span>
            <span class="tab-label">${p.label}</span>
          </button>
        `).join('')}
      </div>
    </nav>
  `;
}

function renderizarContenidoPestana(a, stats) {
  switch (pestanaActiva) {
    case 'militar': return renderizarPestanaMilitar(a, stats);
    case 'diplomacia': return renderizarPestanaDiplomacia(a, stats);
    case 'devocion': return renderizarPestanaDevocion(a, stats);
    case 'poblacion': return renderizarPestanaPoblacion(a, stats);
    case 'bioma': return renderizarPestanaBioma(a, stats);
    case 'edificios': return renderizarPestanaEdificios(a, stats);
    case 'almacenamiento': return renderizarPestanaAlmacenamiento(a, stats);
    case 'comercio': return renderizarPestanaComercio(a, stats);
    case 'eventos': return renderizarPestanaEventos(a, stats);
    default: return renderizarPestanaBioma(a, stats);
  }
}

function renderizarPestanaResumen(a, stats) {
  const modificadoresPropiedades = calcularModificadoresRecursos(a.propiedades);
  return `
      <div class="hud-stats-principales">
        <div class="stat-card">
          <span class="stat-icono">⭐</span>
          <div class="stat-info">
            <span class="stat-label">Calidad</span>
            <span class="stat-value">${stats.calidadTotal}</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icono">📋</span>
          <div class="stat-info">
            <span class="stat-label">Admin</span>
            <span class="stat-value">${stats.grado.admin}</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icono">⚔️</span>
          <div class="stat-info">
            <span class="stat-label">Guarnición</span>
            <span class="stat-value">${stats.grado.guarnicion}</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icono">⚔️</span>
          <div class="stat-info">
            <span class="stat-label">Guarnición</span>
            <span class="stat-value">${stats.grado.guarnicion}</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icono">📦</span>
          <div class="stat-info">
            <span class="stat-label">Almacén</span>
            <span class="stat-value">${stats.grado.almacenamiento}</span>
          </div>
        </div>
        
        <!-- Crecimiento Stat Calculated with Famine Logic -->
        ${(() => {
      // Recalculate Logic locally for display
      const recursos = a.recursos || {};
      const produccionBioma = calcularProduccionTotal(recursos, stats.calidadTotal);
      const produccionEdificios = calcularProduccionEdificios(a.edificios || [], stats);
      const prodAlimento = (produccionBioma["Alimento"]?.medidas || 0) + (produccionEdificios["Alimento"]?.total || 0);
      const consum = (estadoSimulacion?.poblacion?.length || 0) * 1;
      const balance = prodAlimento - consum;

      // Base Immigration
      const gradoData = GRADOS[a.grado];
      let inmigracion = gradoData.inmigracion + stats.calidadTotal;
      if (estadoSimulacion?.poblacion) {
        estadoSimulacion.poblacion.forEach(c => {
          if (NATURALEZAS_POBLACION[c.naturaleza]) inmigracion += NATURALEZAS_POBLACION[c.naturaleza].bonoInmigracion;
        });
      }
      // Natural Reproduction
      const plebeyos = estadoSimulacion ? estadoSimulacion.poblacion.filter(c => c.rol === 'Plebeyo').length : 0;
      let reproduccion = plebeyos;
      let esDeficit = false;

      if (balance < 0) {
        reproduccion = 0;
        esDeficit = true;
      }

      const total = Math.max(0, inmigracion) + reproduccion;

      return `
            <div class="stat-card ${esDeficit ? 'alerta-borde' : ''}">
              <span class="stat-icono">🌱</span>
              <div class="stat-info">
                <span class="stat-label">Crecimiento</span>
                <span class="stat-value ${esDeficit ? 'texto-error' : ''}">
                    ${esDeficit ? '⚠️' : '+'} ${total}
                </span>
                ${esDeficit ? '<span style="font-size:0.6rem; color:#ef4444;">Falta comida</span>' : ''}
              </div>
            </div>`;
    })()}
      </div>
      
      <div class="hud-paneles">
          
          <div class="panel panel-poblacion">
            <h3>👥 Gestión de Población</h3>
             <div class="panel-contenido">
                <div class="poblacion-resumen-hud">
                    <div class="stat-mini">
                        <span>Total:</span> <strong>${stats.poblacionTotal || obtenerPoblacionTotalHelper()}</strong>
                    </div>
                    <div class="stat-mini">
                         <span>Ociosos:</span> <strong class="texto-ocioso">${obtenerPoblacionOciosaHelper()}</strong>
                    </div>
                </div>

                <div class="lista-cuotas-hud">
                    ${renderizarListaCuotasPoblacion()}
                </div>
            </div>
          </div>

          <div class="panel panel-bioma">
            <h3>🌍 Bioma y Propiedades</h3>

          <div class="panel-contenido">
            <div class="bioma-seccion">
              <h4>Propiedades</h4>
              <div class="tags-mini">
                ${a.propiedades.map(p => `<span class="tag-mini">${PROPIEDADES[p]?.icono} ${p}</span>`).join('')}
              </div>
            </div>
            ${a.peculiaridades?.length > 0 ? `
              <div class="bioma-seccion">
                <h4>Peculiaridades</h4>
                <div class="tags-mini">
                  ${a.peculiaridades.map(p => `<span class="tag-mini ${a.peculiaridadFija === p ? 'fija' : ''}">${PECULIARIDADES[p]?.icono} ${p}</span>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="panel panel-recursos">
          <h3>📦 Recursos del Territorio</h3>
          <div class="panel-contenido">
            ${renderizarRecursosHUD(a.recursos, modificadoresPropiedades)}
          </div>
        </div>
        
        <div class="panel panel-bonificaciones">
          <h3>📊 Modificadores</h3>
          <div class="panel-contenido bonificaciones-lista">
            ${renderizarListaBonificaciones(stats.bonificaciones)}
          </div>
        </div>
      </div>
      
      <div class="hud-footer">
        <p>Sistema de Control Personal</p>
      </div>
    </div>
  `;
}

function renderizarRecursosHUD(recursos, modificadoresPropiedades) {
  const recursosActivos = Object.entries(recursos || {})
    .filter(([, data]) => data.abundancia !== 'Inexistente');

  if (recursosActivos.length === 0) {
    return '<p class="sin-recursos">No hay recursos activos</p>';
  }

  return `
    <div class="recursos-hud-lista">
      ${recursosActivos.map(([nombre, data]) => {
    const modProp = modificadoresPropiedades[nombre] || 0;
    const modAbund = obtenerModificadorAbundancia(data.abundancia);
    const modTotal = modProp + modAbund;

    return `
          <div class="recurso-hud ${obtenerClaseAbundancia(data.abundancia)} ${data.esGarantizado ? 'garantizado' : ''}">
            <span class="recurso-icono">${RECURSOS[nombre]?.icono || '📦'}</span>
            <span class="recurso-nombre">${nombre}</span>
            <span class="recurso-abundancia">${data.abundancia}</span>
            <span class="recurso-mod ${modTotal > 0 ? 'positivo' : modTotal < 0 ? 'negativo' : 'neutro'}">${formatearValor(modTotal)}</span>
          </div>
        `;
  }).join('')}
    </div>
  `;
}

function renderizarListaBonificaciones(bonificaciones) {
  const entries = Object.entries(bonificaciones);
  if (entries.length === 0) {
    return '<p class="sin-bonificaciones">Sin modificadores activos</p>';
  }

  return entries.map(([stat, val]) => `
    <div class="bonificacion-row ${obtenerClaseColor(stat, val)}">
      <span class="bonificacion-stat">${stat}</span>
      <span class="bonificacion-valor">${formatearValor(val)}</span>
    </div>
  `).join('');
}

function mostrarOpciones() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-contenido">
      <h3>⚙️ Opciones</h3>
      <div class="modal-opciones">
        <button class="btn-opcion" onclick="this.closest('.modal-overlay').remove()">
          ← Volver al HUD
        </button>
        <button class="btn-opcion btn-peligro" onclick="confirmarReinicio()">
          🗑️ Eliminar Asentamiento
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function confirmarReinicio() {
  if (confirm('¿Estás seguro de que quieres eliminar tu asentamiento? Esta acción no se puede deshacer.')) {
    eliminarAsentamiento();
    estadoApp.asentamiento = null;
    estadoApp.pantalla = 'inicio';
    document.querySelector('.modal-overlay')?.remove();
    renderizarPantalla();
  }
}

function mostrarError(mensaje) {
  const toast = document.createElement('div');
  toast.className = 'toast toast-error';
  toast.textContent = mensaje;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('visible'), 10);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function renderizarListaBonificaciones(bonificaciones) {
  if (!bonificaciones || Object.keys(bonificaciones).length === 0) {
    return '<p class="sin-bonificaciones">Sin modificadores activos</p>';
  }

  return Object.entries(bonificaciones).map(([stat, valor]) => {
    if (valor === 0) return '';
    const claseColor = obtenerClaseColor(stat, valor);
    return `
            <div class="bonificacion-item ${claseColor}">
                <span class="bono-nombre">${stat}</span>
                <span class="bono-valor">${formatearValor(valor)}</span>
            </div>
        `;
  }).join('');
}

/**
 * Renderiza la pestaña de Eventos
 * Los eventos pueden modificar cualquier característica del asentamiento
 */
function renderizarPestanaEventos(a, stats) {
  const turnoActual = estadoSimulacion?.turno || 0;
  const eventos = a.eventos || [];
  const eventosOrdenados = [...eventos].sort((a, b) => b.turno - a.turno);

  // Tipos de eventos disponibles
  const tiposEvento = [
    { id: 'recurso_almacen', nombre: 'Modificar Almacén', icono: '📦' },
    { id: 'recurso_abundancia', nombre: 'Modificar Abundancia', icono: '🌾' },
    { id: 'bonificador', nombre: 'Modificar Bonificador', icono: '📊' },
    { id: 'doblones', nombre: 'Modificar Doblones', icono: '💰' },
    { id: 'calidad', nombre: 'Modificar Calidad', icono: '⭐' },
    { id: 'poblacion', nombre: 'Modificar Población', icono: '👥' },
    { id: 'propiedad', nombre: 'Agregar/Quitar Propiedad', icono: '🏷️' },
    { id: 'peculiaridad', nombre: 'Agregar/Quitar Peculiaridad', icono: '✨' },
    { id: 'otro', nombre: 'Evento Narrativo', icono: '📝' }
  ];

  // Recursos disponibles para modificar
  const recursosDisponibles = Object.keys(RECURSOS || {});

  // Abundancias disponibles
  const abundancias = ['Inexistente', 'Escaso', 'Normal', 'Abundante', 'Exuberante'];

  const renderFormulario = () => `
    <div class="evento-form">
        <h4>📜 Registrar Nuevo Evento</h4>
        <div class="form-grid-evento">
            <div class="form-group">
                <label>Tipo de Evento</label>
                <select id="evento-tipo" class="select-form" onchange="actualizarFormularioEvento()">
                    ${tiposEvento.map(t => `<option value="${t.id}">${t.icono} ${t.nombre}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Turno</label>
                <input type="number" id="evento-turno" class="input-form" min="0" value="${turnoActual}" />
            </div>
        </div>
        
        <div id="evento-campos-dinamicos" class="form-grid-evento">
            <!-- Campos dinámicos según tipo -->
            <div class="form-group">
                <label>Recurso</label>
                <select id="evento-recurso" class="select-form">
                    ${recursosDisponibles.map(r => `<option value="${r}">${RECURSOS[r]?.icono || '📦'} ${r}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Cantidad (+ o -)</label>
                <input type="number" id="evento-cantidad" class="input-form" value="0" />
            </div>
        </div>
        
        <div class="form-group" style="grid-column: 1 / -1;">
            <label>Descripción del Evento</label>
            <input type="text" id="evento-descripcion" class="input-form" placeholder="Ej: Llegó una caravana comercial..." />
        </div>
        
        <button class="btn-registrar-evento" onclick="registrarEvento()">
            📜 Registrar Evento
        </button>
    </div>
  `;

  const renderHistorial = () => {
    if (eventosOrdenados.length === 0) {
      return `
        <div class="eventos-vacio">
            <div class="icono-vacio">📜</div>
            <p>No hay eventos registrados.</p>
        </div>
      `;
    }

    return `
      <table class="tabla-eventos">
          <thead>
              <tr>
                  <th>Turno</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Efecto</th>
                  <th>Acciones</th>
              </tr>
          </thead>
          <tbody>
              ${eventosOrdenados.map((evento, index) => `
                  <tr>
                      <td><strong>${evento.turno}</strong></td>
                      <td>
                          <span class="badge-evento">
                              ${tiposEvento.find(t => t.id === evento.tipo)?.icono || '📜'}
                              ${tiposEvento.find(t => t.id === evento.tipo)?.nombre || evento.tipo}
                          </span>
                      </td>
                      <td>${evento.descripcion || '-'}</td>
                      <td class="${evento.valorNumerico >= 0 ? 'positivo' : 'negativo'}">
                          ${formatearEfectoEvento(evento)}
                      </td>
                      <td class="acciones-evento">
                          <button class="btn-accion btn-eliminar" onclick="eliminarEvento(${index})" title="Eliminar evento">
                              🗑️
                          </button>
                      </td>
                  </tr>
              `).join('')}
          </tbody>
      </table>
    `;
  };

  return `
    <div class="panel panel-full panel-eventos">
        <h3>📜 Eventos del Asentamiento</h3>
        <p class="panel-descripcion">
            Registra eventos que afectan al asentamiento: llegadas de caravanas, desastres naturales, 
            descubrimientos, cambios políticos, etc.
        </p>
        
        ${renderFormulario()}
        
        <div class="eventos-historial">
            <h4>📚 Historial de Eventos</h4>
            ${renderHistorial()}
        </div>
    </div>
  `;
}

/**
 * Formatea el efecto de un evento para mostrar en la tabla
 */
function formatearEfectoEvento(evento) {
  switch (evento.tipo) {
    case 'recurso_almacen':
      return `${evento.valorNumerico >= 0 ? '+' : ''}${evento.valorNumerico} ${evento.objetivo}`;
    case 'recurso_abundancia':
      return `${evento.objetivo}: ${evento.valorTexto}`;
    case 'bonificador':
      return `${evento.objetivo}: ${evento.valorNumerico >= 0 ? '+' : ''}${evento.valorNumerico}`;
    case 'doblones':
      return `${evento.valorNumerico >= 0 ? '+' : ''}${evento.valorNumerico} 💰`;
    case 'calidad':
      return `Calidad ${evento.valorNumerico >= 0 ? '+' : ''}${evento.valorNumerico}`;
    case 'poblacion':
      return `${evento.valorNumerico >= 0 ? '+' : ''}${evento.valorNumerico} cuotas`;
    case 'propiedad':
    case 'peculiaridad':
      return `${evento.accion === 'agregar' ? '+ ' : '- '}${evento.objetivo}`;
    case 'otro':
    default:
      return evento.valorTexto || 'Narrativo';
  }
}

/**
 * Registra un nuevo evento y aplica sus efectos
 */
function registrarEvento() {
  const asentamiento = estadoApp.asentamiento;
  if (!asentamiento) {
    mostrarNotificacion('No hay asentamiento seleccionado', 'error');
    return;
  }

  const tipo = document.getElementById('evento-tipo')?.value;
  const turno = parseInt(document.getElementById('evento-turno')?.value) || 0;
  const descripcion = document.getElementById('evento-descripcion')?.value || '';
  const recurso = document.getElementById('evento-recurso')?.value;
  const cantidad = parseInt(document.getElementById('evento-cantidad')?.value) || 0;

  // Crear el evento
  const evento = {
    id: Date.now(),
    tipo,
    turno,
    descripcion,
    fechaRegistro: new Date().toISOString()
  };

  // Aplicar efectos según el tipo
  switch (tipo) {
    case 'recurso_almacen':
      evento.objetivo = recurso;
      evento.valorNumerico = cantidad;
      // Aplicar al almacén
      if (!estadoSimulacion.almacen) estadoSimulacion.almacen = {};
      estadoSimulacion.almacen[recurso] = (estadoSimulacion.almacen[recurso] || 0) + cantidad;
      if (estadoSimulacion.almacen[recurso] <= 0) delete estadoSimulacion.almacen[recurso];
      break;

    case 'doblones':
      evento.valorNumerico = cantidad;
      estadoSimulacion.doblones = (estadoSimulacion.doblones || 0) + cantidad;
      break;

    case 'recurso_abundancia':
      const abundanciaSelect = document.getElementById('evento-abundancia');
      const nuevaAbundancia = abundanciaSelect?.value || 'Normal';
      evento.objetivo = recurso;
      evento.valorTexto = nuevaAbundancia;
      // Modificar abundancia en recursos del asentamiento
      if (asentamiento.recursos && asentamiento.recursos[recurso]) {
        evento.valorAnterior = asentamiento.recursos[recurso].abundancia;
        asentamiento.recursos[recurso].abundancia = nuevaAbundancia;
      }
      break;

    case 'bonificador':
      const bonificador = document.getElementById('evento-bonificador')?.value || 'Calidad';
      evento.objetivo = bonificador;
      evento.valorNumerico = cantidad;
      // Agregar a bonificacion de eventos
      if (!asentamiento.bonificacionesEventos) asentamiento.bonificacionesEventos = {};
      asentamiento.bonificacionesEventos[bonificador] = (asentamiento.bonificacionesEventos[bonificador] || 0) + cantidad;
      break;

    case 'calidad':
      evento.valorNumerico = cantidad;
      if (!asentamiento.bonificacionesEventos) asentamiento.bonificacionesEventos = {};
      asentamiento.bonificacionesEventos['Calidad'] = (asentamiento.bonificacionesEventos['Calidad'] || 0) + cantidad;
      break;

    case 'poblacion':
      evento.valorNumerico = cantidad;
      // Agregar o quitar cuotas de población
      if (cantidad > 0) {
        for (let i = 0; i < cantidad; i++) {
          const maxId = Math.max(...estadoSimulacion.poblacion.map(c => c.id), 0);
          estadoSimulacion.poblacion.push({
            id: maxId + 1,
            rol: 'Plebeyo',
            naturaleza: 'Neutral',
            medidas: 20,
            asignacion: null
          });
        }
      } else if (cantidad < 0) {
        for (let i = 0; i < Math.abs(cantidad) && estadoSimulacion.poblacion.length > 0; i++) {
          estadoSimulacion.poblacion.pop();
        }
      }
      break;

    case 'propiedad':
    case 'peculiaridad':
      const accion = document.getElementById('evento-accion')?.value || 'agregar';
      const nombre = document.getElementById('evento-nombre')?.value || '';
      evento.accion = accion;
      evento.objetivo = nombre;
      const lista = tipo === 'propiedad' ? asentamiento.propiedades : asentamiento.peculiaridades;
      if (accion === 'agregar' && nombre && !lista.includes(nombre)) {
        lista.push(nombre);
      } else if (accion === 'quitar') {
        const idx = lista.indexOf(nombre);
        if (idx >= 0) lista.splice(idx, 1);
      }
      break;

    case 'otro':
    default:
      evento.valorTexto = descripcion;
      break;
  }

  // Guardar evento
  if (!asentamiento.eventos) asentamiento.eventos = [];
  asentamiento.eventos.push(evento);

  // Guardar estado
  asentamiento.simulacion = JSON.parse(JSON.stringify(estadoSimulacion));
  guardarExpedicion();

  mostrarNotificacion('📜 Evento registrado', 'success');
  renderizarPantalla();
}

/**
 * Elimina un evento (sin revertir sus efectos)
 */
function eliminarEvento(index) {
  const asentamiento = estadoApp.asentamiento;
  if (!asentamiento || !asentamiento.eventos) return;

  const eventosOrdenados = [...asentamiento.eventos].sort((a, b) => b.turno - a.turno);
  const evento = eventosOrdenados[index];

  if (!confirm(`¿Eliminar este evento?\n\n${evento.descripcion || 'Sin descripción'}\n\n⚠️ Los efectos del evento NO se revertirán automáticamente.`)) {
    return;
  }

  // Encontrar y eliminar el evento original
  const originalIndex = asentamiento.eventos.findIndex(e => e.id === evento.id);
  if (originalIndex >= 0) {
    asentamiento.eventos.splice(originalIndex, 1);
  }

  guardarExpedicion();
  mostrarNotificacion('Evento eliminado', 'success');
  renderizarPantalla();
}


function renderizarPestanaMilitar(a, stats) {
  return `<div class="panel panel-full"><h3>⚔️ Militar</h3><div class="panel-contenido"><p>En construcción...</p></div></div>`;
}

function renderizarPestanaDiplomacia(a, stats) {
  return `<div class="panel panel-full"><h3>🤝 Diplomacia</h3><div class="panel-contenido"><p>En construcción...</p></div></div>`;
}

function renderizarPestanaDevocion(a, stats) {
  // Inicializar estado de devoción si no existe
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
  const tiposDevocion = ["Positiva", "Negativa", "Neutral", "Salvaje"];

  // Contar devotos por tipo de naturaleza
  const devotosPorTipo = { Positiva: 0, Negativa: 0, Neutral: 0, Salvaje: 0 };
  let totalDevotos = 0;

  if (estadoSimulacion.poblacion) {
    estadoSimulacion.poblacion.forEach(cuota => {
      if (cuota.rol === "Devoto") {
        // La naturaleza de la cuota determina el tipo de devoción
        const tipoNat = cuota.naturaleza || "Neutral";
        // Mapear naturaleza a tipo de devoción (Monstruo y Artificial no generan devoción)
        if (tipoNat === "Positiva" || tipoNat === "Negativa" || tipoNat === "Neutral") {
          devotosPorTipo[tipoNat] = (devotosPorTipo[tipoNat] || 0) + 1;
          totalDevotos++;
        } else if (tipoNat === "Monstruo") {
          // Monstruos generan devoción Salvaje
          devotosPorTipo["Salvaje"] = (devotosPorTipo["Salvaje"] || 0) + 1;
          totalDevotos++;
        }
      }
    });
  }

  // Detectar tipos activos
  const tiposActivos = tiposDevocion.filter(t => devotosPorTipo[t] > 0 || devocion.poolPorTipo[t] > 0);

  // Detectar sacrilegio (tipos opuestos activos)
  let haySacrilegio = false;
  if ((devotosPorTipo["Positiva"] > 0 && devotosPorTipo["Negativa"] > 0) ||
    (devotosPorTipo["Neutral"] > 0 && devotosPorTipo["Salvaje"] > 0)) {
    haySacrilegio = true;
  }
  devocion.sacrilegio = haySacrilegio;

  // Determinar tipo dominante
  let maxDevotos = 0;
  let dominante = null;
  tiposDevocion.forEach(t => {
    if (devotosPorTipo[t] > maxDevotos) {
      maxDevotos = devotosPorTipo[t];
      dominante = t;
    }
  });
  devocion.dominantType = dominante;

  // Calcular grado de devoción
  const gradoDevocion = typeof calcularGradoDevocion === 'function'
    ? calcularGradoDevocion(totalDevotos)
    : (totalDevotos >= 300 ? 3 : totalDevotos >= 60 ? 2 : 1);

  // Verificar si hay Plaza de Adoración
  const tienePlazaAdoracion = (a.edificios || []).some(e => {
    const nombre = typeof e === 'string' ? e : e.nombre;
    return nombre === "Plaza de Adoración" || nombre === "Sitio Sagrado" || nombre === "Templo";
  });

  // Calcular modificador de coste de milagros
  let modCoste = 0;
  if (haySacrilegio) modCoste += 20;
  if (devocion.isSyncretic) modCoste -= 20;

  // Estado visual
  let estadoLabel = "Estable";
  let estadoColor = "#4a9eff";
  let estadoIcono = "✅";
  if (haySacrilegio) {
    estadoLabel = "⚠️ SACRILEGIO";
    estadoColor = "#ff4444";
    estadoIcono = "💀";
  } else if (devocion.isSyncretic) {
    estadoLabel = "Sincretismo Activo";
    estadoColor = "#44ff88";
    estadoIcono = "🤝";
  }

  // Contar plebeyos disponibles para conversión
  const plebeyosDisponibles = estadoSimulacion.poblacion?.filter(c => c.rol === "Plebeyo").length || 0;

  return `
    <div class="panel panel-full" style="margin-bottom:1rem;">
      <h3>🙏 Sistema de Devoción</h3>
      <div class="panel-contenido">
        
        <!-- ============ PANEL A: RESUMEN DE FE ============ -->
        <div style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:8px; margin-bottom:1rem;">
          <h4 style="margin-top:0;">📊 Resumen de Fe</h4>
          
          <!-- Estado e Indicadores -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="background:${estadoColor}; color:#fff; padding:0.4rem 0.8rem; border-radius:4px; font-weight:bold;">
                ${estadoIcono} ${estadoLabel}
              </span>
              <span style="opacity:0.7;">Grado de Fe: <strong>${gradoDevocion}</strong></span>
            </div>
            <div>
              <span style="opacity:0.7;">Devotos Totales: </span>
              <strong style="font-size:1.2rem;">${totalDevotos}</strong>
            </div>
          </div>

          ${haySacrilegio ? `
            <div style="background:rgba(255,0,0,0.15); padding:0.8rem; border-radius:6px; margin-bottom:1rem; border-left:3px solid #ff4444;">
              <strong>⚠️ Penalizaciones de Sacrilegio:</strong>
              <ul style="margin:0.5rem 0 0 1rem; padding:0;">
                <li>Coste de Milagros: +20</li>
                <li>Conversiones Forzadas cada 3 Cuotas de Devotos</li>
                <li>-1 Calidad por cada Devoción contraria</li>
              </ul>
            </div>
          ` : ''}

          ${devocion.isSyncretic ? `
            <div style="background:rgba(0,255,100,0.1); padding:0.8rem; border-radius:6px; margin-bottom:1rem; border-left:3px solid #44ff88;">
              <strong>🤝 Sincretismo Activo:</strong> ${devocion.syncreticTypes.join(' + ')}
              <br><small>Coste de Milagros: -20</small>
            </div>
          ` : ''}

          <!-- Distribución por Tipo -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">
            ${tiposDevocion.map(tipo => {
    const tipoData = typeof TIPOS_DEVOCION !== 'undefined' ? TIPOS_DEVOCION[tipo] : null;
    const icono = tipoData?.icono || "⚪";
    const color = tipoData?.color || "#666";
    const cuotas = devotosPorTipo[tipo] || 0;
    const pool = devocion.poolPorTipo[tipo] || 0;
    const porcentajePool = Math.min(100, pool);

    if (cuotas === 0 && pool === 0) return '';

    return `
                <div style="background:rgba(255,255,255,0.05); padding:0.8rem; border-radius:6px; border-left:3px solid ${color};">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                    <span>${icono} <strong>${tipo}</strong></span>
                    <span style="opacity:0.7;">${cuotas} devotos</span>
                  </div>
                  <div style="background:rgba(0,0,0,0.3); border-radius:4px; height:12px; overflow:hidden;">
                    <div style="width:${porcentajePool}%; height:100%; background:${color}; transition:width 0.3s;"></div>
                  </div>
                  <div style="display:flex; justify-content:space-between; font-size:0.8rem; opacity:0.7; margin-top:0.2rem;">
                    <span>Pool: ${pool}/100</span>
                    <span>+${cuotas}/turno</span>
                  </div>
                </div>
              `;
  }).join('')}
          </div>

          ${tiposActivos.length === 0 ? `
            <p style="text-align:center; opacity:0.6; margin:1rem 0;">No hay devociones activas. Convierte Plebeyos a Devotos para comenzar.</p>
          ` : ''}
        </div>

        <!-- ============ PANEL B: GESTIÓN DE CULTO ============ -->
        <div style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:8px; margin-bottom:1rem;">
          <h4 style="margin-top:0;">⛪ Gestión de Culto</h4>
          
          ${!tienePlazaAdoracion ? `
            <div style="background:rgba(255,165,0,0.15); padding:0.8rem; border-radius:6px; margin-bottom:1rem; border-left:3px solid #ffa500;">
              🔒 <strong>Requisito:</strong> Construye una "Plaza de Adoración" o "Sitio Sagrado" para habilitar Devotos.
            </div>
          ` : `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:15px;">
              
              <!-- Conversor Plebeyo → Devoto -->
              <div style="background:rgba(0,0,0,0.2); padding:1rem; border-radius:6px;">
                <h5 style="margin:0 0 0.8rem 0;">🙏 Convertir a Devoto</h5>
                <p style="font-size:0.85rem; opacity:0.7; margin-bottom:0.8rem;">
                  Transforma Plebeyos en Devotos para generar puntos de Devoción.
                </p>
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                  <select id="select-tipo-devoto" style="padding:0.4rem; background:#333; color:#fff; border:1px solid #555; border-radius:4px;">
                    ${tiposDevocion.map(t => {
    const tipoData = typeof TIPOS_DEVOCION !== 'undefined' ? TIPOS_DEVOCION[t] : null;
    return `<option value="${t}">${tipoData?.icono || ''} ${t}</option>`;
  }).join('')}
                  </select>
                  <button onclick="convertirPlebeyoADevoto()" 
                          style="padding:0.5rem 1rem; background:#9932CC; color:#fff; border:none; border-radius:4px; cursor:pointer;"
                          ${plebeyosDisponibles === 0 ? 'disabled style="opacity:0.5;"' : ''}>
                    Convertir 1 Plebeyo
                  </button>
                </div>
                <small style="opacity:0.6; display:block; margin-top:0.5rem;">
                  Plebeyos disponibles: ${plebeyosDisponibles}
                </small>
              </div>

              <!-- Sincretismo -->
              <div style="background:rgba(0,0,0,0.2); padding:1rem; border-radius:6px;">
                <h5 style="margin:0 0 0.8rem 0;">🤝 Pacto Sincrético</h5>
                <p style="font-size:0.85rem; opacity:0.7; margin-bottom:0.8rem;">
                  Une dos devociones compatibles para reducir costes de milagros.
                </p>
                ${haySacrilegio ? `
                  <p style="color:#ff6666; font-size:0.85rem;">❌ No disponible durante Sacrilegio</p>
                ` : tiposActivos.length < 2 ? `
                  <p style="opacity:0.6; font-size:0.85rem;">Requiere 2 devociones activas no opuestas.</p>
                ` : devocion.isSyncretic ? `
                  <button onclick="romperSincretismo()" 
                          style="padding:0.5rem 1rem; background:#aa3333; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                    Romper Sincretismo
                  </button>
                ` : `
                  <button onclick="pactarSincretismo()" 
                          style="padding:0.5rem 1rem; background:#228b22; color:#fff; border:none; border-radius:4px; cursor:pointer;">
                    Pactar Sincretismo
                  </button>
                `}
              </div>
            </div>
          `}
        </div>

        <!-- ============ PANEL C: LIBRO DE MILAGROS ============ -->
        <div style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:8px;">
          <h4 style="margin-top:0;">📖 Libro de Milagros</h4>
          
          ${totalDevotos === 0 ? `
            <p style="text-align:center; opacity:0.6;">Necesitas al menos 1 Devoto para acceder a los milagros.</p>
          ` : `
            <div style="margin-bottom:1rem;">
              <small style="opacity:0.7;">
                Grado actual: <strong>${gradoDevocion}</strong> | 
                Modificador de coste: <strong style="color:${modCoste > 0 ? '#ff6666' : modCoste < 0 ? '#66ff66' : '#fff'};">${modCoste >= 0 ? '+' : ''}${modCoste}</strong>
              </small>
            </div>

            ${tiposActivos.map(tipo => {
    const tipoData = typeof TIPOS_DEVOCION !== 'undefined' ? TIPOS_DEVOCION[tipo] : null;
    const milagrosTipo = typeof MILAGROS !== 'undefined' ? MILAGROS[tipo] : {};
    const pool = devocion.poolPorTipo[tipo] || 0;

    if (!milagrosTipo || Object.keys(milagrosTipo).length === 0) return '';

    return `
                <details style="margin-bottom:0.5rem;">
                  <summary style="cursor:pointer; padding:0.5rem; background:rgba(255,255,255,0.05); border-radius:4px; border-left:3px solid ${tipoData?.color || '#666'};">
                    ${tipoData?.icono || ''} <strong>${tipo}</strong> <small>(Pool: ${pool}/100)</small>
                  </summary>
                  <div style="padding:0.5rem; display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:10px; margin-top:0.5rem;">
                    ${Object.entries(milagrosTipo).map(([nombre, milagro]) => {
      const costeAjustado = milagro.coste + modCoste;
      const puedeInvocar = pool >= costeAjustado && milagro.grado <= gradoDevocion;
      const gradoInsuficiente = milagro.grado > gradoDevocion;

      return `
                        <div style="background:rgba(0,0,0,0.2); padding:0.8rem; border-radius:6px; opacity:${gradoInsuficiente ? '0.5' : '1'};">
                          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.3rem;">
                            <strong style="font-size:0.95rem;">${nombre}</strong>
                            <span style="background:${puedeInvocar ? '#228b22' : '#666'}; padding:0.2rem 0.5rem; border-radius:3px; font-size:0.8rem;">
                              ${costeAjustado} pts
                            </span>
                          </div>
                          <div style="font-size:0.75rem; opacity:0.6; margin-bottom:0.5rem;">
                            Grado ${milagro.grado} | ${milagro.objetivo || 'general'}
                          </div>
                          <p style="font-size:0.85rem; margin:0 0 0.5rem 0; opacity:0.9;">${milagro.efecto}</p>
                          <button onclick="invocarMilagro('${tipo}', '${nombre}')"
                                  style="width:100%; padding:0.4rem; background:${puedeInvocar ? tipoData?.color || '#4a9eff' : '#444'}; color:#fff; border:none; border-radius:4px; cursor:${puedeInvocar ? 'pointer' : 'not-allowed'}; font-size:0.85rem;"
                                  ${!puedeInvocar ? 'disabled' : ''}>
                            ${gradoInsuficiente ? '🔒 Grado insuficiente' : puedeInvocar ? '✨ Invocar' : '❌ Sin puntos'}
                          </button>
                        </div>
                      `;
    }).join('')}
                  </div>
                </details>
              `;
  }).join('')}
          `}
        </div>

      </div>
    </div>
  `;
}

/**
 * Renderiza la tabla editable de población
 */
function renderizarTablaPoblacionEditable() {
  const tiposPoblacion = ["Neutral", "Positiva", "Negativa", "Monstruo", "Artificial"];
  const iconosTipo = { Neutral: "⚪", Positiva: "🌟", Negativa: "🌑", Monstruo: "👹", Artificial: "🤖" };
  // Usar los nombres exactos de ROLES_POBLACION (singular)
  const roles = Object.keys(ROLES_POBLACION);
  const iconosRol = {};
  roles.forEach(r => iconosRol[r] = ROLES_POBLACION[r]?.icono || '👤');

  if (!estadoSimulacion?.poblacion || estadoSimulacion.poblacion.length === 0) {
    return `<p style="text-align:center; opacity:0.6;">No hay población.</p>
            <button onclick="agregarCuotaPoblacion('Neutral','Plebeyo')" style="background:rgba(100,200,100,0.2); border:1px solid rgba(100,200,100,0.5); color:#fff; padding:0.4rem 0.8rem; border-radius:6px; cursor:pointer; margin-top:1rem;">➕ Agregar Cuota</button>`;
  }

  let html = `<table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
    <thead><tr style="border-bottom:2px solid rgba(255,255,255,0.2);">
      <th style="text-align:left; padding:0.5rem;">ID</th>
      <th style="text-align:left; padding:0.5rem;">Naturaleza</th>
      <th style="text-align:left; padding:0.5rem;">Subtipo</th>
      <th style="text-align:left; padding:0.5rem;">Rol</th>
      <th style="text-align:left; padding:0.5rem;">Estado</th>
      <th style="text-align:center; padding:0.5rem;">⚙️</th>
    </tr></thead><tbody>`;

  estadoSimulacion.poblacion.forEach(p => {
    const icon = iconosTipo[p.naturaleza] || '⚪';
    const naturalezaOptions = tiposPoblacion.map(t =>
      `<option value="${t}" ${p.naturaleza === t ? 'selected' : ''}>${iconosTipo[t]} ${t}</option>`
    ).join('');
    const rolOptions = roles.map(r =>
      `<option value="${r}" ${p.rol === r ? 'selected' : ''}>${iconosRol[r]} ${r}</option>`
    ).join('');

    // Determinar estado: asignación a recurso, edificio, o construcción en progreso
    let estadoTexto = '⏸️ Ocioso';
    if (p.asignacion) {
      estadoTexto = '🔧 ' + p.asignacion;
    } else {
      // Verificar si está asignado a una construcción en progreso
      // Note: construcciones pueden usar 'Trabajadores' (número) o 'poblacionAsignada' (array)
      const construccion = estadoSimulacion.construccionesEnProgreso?.find(c => {
        if (Array.isArray(c.poblacionAsignada)) {
          return c.poblacionAsignada.includes(p.id);
        }
        return false; // Trabajadores es un conteo, no IDs específicos
      });
      if (construccion) {
        estadoTexto = '🚧 Construyendo: ' + construccion.nombre;
      }
    }

    html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
      <td style="padding:0.4rem;">${icon} <strong>#${p.id}</strong></td>
      <td style="padding:0.4rem;">
        <select onchange="cambiarNaturalezaPoblacion(${p.id}, this.value)" 
                style="padding:0.25rem; border-radius:4px; background:#333; color:#fff; border:1px solid #555; font-size:0.8rem;">
          ${naturalezaOptions}
        </select>
      </td>
      <td style="padding:0.4rem;">
        ${p.naturaleza === "Artificial" ? `
          <select onchange="cambiarSubtipoPoblacion(${p.id}, this.value)" style="padding:0.25rem; border-radius:4px; background:#333; color:#fff; border:1px solid #555; font-size:0.8rem;">
            ${["Neutral", "Positiva", "Negativa", "Monstruo"].map(s => `<option value="${s}" ${(p.subtipo || "Neutral") === s ? "selected" : ""}>${iconosTipo[s]} ${s}</option>`).join("")}
          </select>
        ` : `<span style="opacity:0.4;">-</span>`}
      </td>
      <td style="padding:0.4rem;">
        ${p.naturaleza === "Artificial" ? `
          <select onchange="cambiarSubtipoPoblacion(${p.id}, this.value)" style="padding:0.25rem; border-radius:4px; background:#333; color:#fff; border:1px solid #555; font-size:0.8rem;">
            ${["Neutral", "Positiva", "Negativa", "Monstruo"].map(s => `<option value="${s}" ${(p.subtipo || "Neutral") === s ? "selected" : ""}>${iconosTipo[s]} ${s}</option>`).join("")}
          </select>
        ` : `<span style="opacity:0.4;">-</span>`}
      </td>
      <td style="padding:0.4rem;">
        <select onchange="cambiarRolPoblacion(${p.id}, this.value)" 
                style="padding:0.25rem; border-radius:4px; background:#333; color:#fff; border:1px solid #555; font-size:0.8rem;">
          ${rolOptions}
        </select>
      </td>
      <td style="padding:0.4rem; opacity:0.7; font-size:0.8rem;">
        ${estadoTexto}
      </td>
      <td style="padding:0.4rem; text-align:center;">
        <button onclick="eliminarCuotaPoblacion(${p.id})" 
                style="background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); color:#fff; padding:0.2rem 0.4rem; border-radius:4px; cursor:pointer; font-size:0.8rem;"
                title="Eliminar cuota">🗑️</button>
      </td>
    </tr>`;
  });

  html += `</tbody></table>
    <div style="margin-top:1rem; padding-top:0.8rem; border-top:1px solid rgba(255,255,255,0.1);">
      <button onclick="agregarCuotaPoblacion('Neutral','Plebeyos')" 
              style="background:rgba(100,200,100,0.2); border:1px solid rgba(100,200,100,0.5); color:#fff; padding:0.4rem 0.8rem; border-radius:6px; cursor:pointer;">
        ➕ Agregar Cuota
      </button>
      <span style="margin-left:0.5rem; opacity:0.6; font-size:0.8rem;">Agrega población manualmente</span>
    </div>`;

  return html;
}

function renderizarPestanaPoblacion(a, stats) {
  const tiposPoblacion = ["Neutral", "Positiva", "Negativa", "Monstruo", "Artificial"];
  const iconosTipo = { Neutral: "⚪", Positiva: "🌟", Negativa: "🌑", Monstruo: "👹", Artificial: "🤖" };

  // Conteo por tipo
  const counts = { Neutral: 0, Positiva: 0, Negativa: 0, Monstruo: 0, Artificial: 0 };
  let total = 0;

  if (estadoSimulacion.poblacion) {
    total = estadoSimulacion.poblacion.length;
    estadoSimulacion.poblacion.forEach(p => {
      const k = p.naturaleza || "Neutral";
      counts[k] = (counts[k] || 0) + 1;
    });
  }

  // Cálculos de inmigración
  const gradoData = GRADOS[a.grado];
  const baseInmigracion = gradoData.inmigracion;
  const modCalidad = stats.calidadTotal;
  let bonoMonstruos = 0;

  if (estadoSimulacion?.poblacion) {
    estadoSimulacion.poblacion.forEach(c => {
      const nat = typeof NATURALEZAS_POBLACION !== 'undefined' ? NATURALEZAS_POBLACION[c.naturaleza] : null;
      if (nat) bonoMonstruos += nat.bonoInmigracion;
    });
  }

  const totalInmigracion = Math.max(0, baseInmigracion + modCalidad + bonoMonstruos);
  const tipoInmigracionActual = estadoSimulacion.tipoInmigracion || "Neutral";

  // Balance alimentos (solo poblaciones que consumen)
  // Sumar TODOS los tipos de alimento: Alimento, Frutos y Tubérculos, Carne, Pesca
  const recursos = a.recursos || {};
  const produccionBioma = calcularProduccionTotal(recursos, stats.calidadTotal);
  const produccionEdificios = calcularProduccionEdificios(a.edificios || [], stats);

  // Tipos de alimento a considerar (en orden de prioridad de consumo)
  const tiposAlimento = ["Alimento", "Frutos y Tubérculos", "Carne", "Pesca"];
  let prodAlimentoTotal = 0;

  tiposAlimento.forEach(tipo => {
    prodAlimentoTotal += produccionBioma[tipo]?.medidas || 0;
    prodAlimentoTotal += produccionEdificios[tipo]?.total || 0;
  });

  // Solo cuentan las poblaciones que consumen alimentos
  const cuotasQueConsumen = estadoSimulacion.poblacion?.filter(c => {
    const nat = NATURALEZAS_POBLACION?.[c.naturaleza];
    return nat?.consumeAlimento !== false;
  }).length || 0;

  const consumo = cuotasQueConsumen;
  const balanceAlimentos = prodAlimentoTotal - consumo;
  const puedeReproducir = balanceAlimentos >= 0;

  // Pendientes por tipo
  const pendientes = estadoSimulacion.inmigracionPendientePorTipo || {};
  const metaConsolidacion = CONVERSION.CUOTA_POBLACION;

  // Reproducción por tipo (estimación para UI, respetando puedeReproducir de cada naturaleza)
  // Reproducción = 1 por cada cuota de población (sin importar rol)
  const reproduccionPorTipo = {};
  if (puedeReproducir && estadoSimulacion.poblacion) {
    estadoSimulacion.poblacion.forEach(c => {
      const t = c.naturaleza || "Neutral";
      const nat = NATURALEZAS_POBLACION?.[t];
      // Solo reproduce si la naturaleza lo permite
      if (nat?.puedeReproducir !== false) {
        reproduccionPorTipo[t] = (reproduccionPorTipo[t] || 0) + 1;
      }
    });
  }

  return `
    <div class="panel panel-full" style="margin-bottom:1rem;">
        <h3>👥 Población del Asentamiento</h3>
        <div class="panel-contenido">
            
            <!-- Resumen Total -->
            <div style="display:flex; align-items:center; gap:20px; margin-bottom:1rem; padding:1rem; background:rgba(255,255,255,0.08); border-radius:8px;">
                <div style="text-align:center;">
                    <span style="font-size:2rem; font-weight:bold;">${total}</span>
                    <br><small>Cuotas Totales</small>
                </div>
                <div style="flex:1; display:flex; flex-wrap:wrap; gap:8px;">
                    ${tiposPoblacion.map(tipo => {
    const c = counts[tipo] || 0;
    if (c === 0) return '';
    const esDominante = c === Math.max(...Object.values(counts));
    return `
                            <div style="background:${esDominante ? 'rgba(100,200,100,0.2)' : 'rgba(255,255,255,0.05)'}; padding:0.4rem 0.8rem; border-radius:4px; display:flex; align-items:center; gap:6px; ${esDominante ? 'border:1px solid rgba(100,200,100,0.5);' : ''}">
                                <span>${iconosTipo[tipo]}</span>
                                <strong>${c}</strong>
                                <small style="opacity:0.7;">${tipo}</small>
                                ${esDominante ? '<span title="Dominante" style="font-size:0.7rem;">👑</span>' : ''}
                            </div>
                        `;
  }).join('')}
                </div>
            </div>
            
            <!-- Desglose Individual de Población -->
            <details style="margin-bottom:1rem;">
                <summary style="cursor:pointer; padding:0.5rem; background:rgba(255,255,255,0.05); border-radius:4px;">📋 Editar cuotas de población (${total} cuotas)</summary>
                <div style="margin-top:0.5rem; padding:0.5rem; background:rgba(0,0,0,0.2); border-radius:4px; max-height:400px; overflow-y:auto;">
                    ${renderizarTablaPoblacionEditable()}
                </div>
            </details>

            <!-- Selector de Tipo de Inmigración -->
            <div style="margin-bottom:1rem; padding:1rem; background:rgba(0,100,200,0.1); border-radius:8px; border-left:3px solid #4a9eff;">
                <label style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span>🌍 Tipo de Inmigración:</span>
                    <select onchange="cambiarTipoInmigracion(this.value)" style="padding:0.4rem; border-radius:4px; background:#333; color:#fff; border:1px solid #555;">
                        ${tiposPoblacion.map(t => `
                            <option value="${t}" ${tipoInmigracionActual === t ? 'selected' : ''}>${iconosTipo[t]} ${t}</option>
                        `).join('')}
                    </select>
                    <small style="opacity:0.7;">(+${totalInmigracion} medidas/turno)</small>
                </label>
                
                ${tipoInmigracionActual === 'Artificial' ? `
                    <div style="margin-top:0.8rem; padding-top:0.8rem; border-top:1px solid rgba(255,255,255,0.1);">
                        <label style="display:flex; align-items:center; gap:10px;">
                            <span>🤖 Subtipo Artificial:</span>
                            <select onchange="cambiarSubtipoArtificial(this.value)" style="padding:0.4rem; border-radius:4px; background:#333; color:#fff; border:1px solid #555;">
                                ${["Neutral", "Positiva", "Negativa", "Monstruo"].map(s => `
                                    <option value="${s}" ${(estadoSimulacion.subtipoInmigracionArtificial || 'Neutral') === s ? 'selected' : ''}>${iconosTipo[s]} ${s}</option>
                                `).join('')}
                            </select>
                            <small style="opacity:0.7;">(define el subtipo de nuevas cuotas Artificiales)</small>
                        </label>
                        <p style="margin:0.5rem 0 0 0; font-size:0.85rem; opacity:0.7;">
                            ℹ️ Los Artificiales no comen, no crecen, cuestan 1 Doblón/turno y pueden tener un subtipo base.
                        </p>
                    </div>
                ` : ''}
            </div>

            ${!puedeReproducir ? `
                <div style="padding:0.8rem; background:rgba(255,0,0,0.15); border-radius:6px; margin-bottom:1rem; border-left:3px solid #ff4444;">
                    ⚠️ <strong>Hambruna:</strong> El crecimiento natural está detenido por falta de alimentos.
                </div>
            ` : ''}

            <!-- Barras de Progreso por Tipo -->
            <h4 style="margin-top:1rem; margin-bottom:0.5rem;">📈 Progreso de Crecimiento por Tipo</h4>
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${tiposPoblacion.map(tipo => {
    const pendiente = pendientes[tipo] || 0;
    const reprod = reproduccionPorTipo[tipo] || 0;
    const inmig = tipoInmigracionActual === tipo ? totalInmigracion : 0;
    const crecimientoTurno = reprod + inmig;
    const porcentaje = Math.min(100, (pendiente / metaConsolidacion) * 100);
    const activo = counts[tipo] > 0 || pendiente > 0 || inmig > 0;

    if (!activo) return '';

    return `
                        <div style="background:rgba(255,255,255,0.05); padding:0.8rem; border-radius:6px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                                <span>${iconosTipo[tipo]} <strong>${tipo}</strong> <small style="opacity:0.6;">(${counts[tipo]} cuotas)</small></span>
                                <span style="font-size:0.85rem;">
                                    ${reprod > 0 ? `<span style="color:#8f8;">+${reprod} reprod</span>` : ''}
                                    ${inmig > 0 ? `<span style="color:#88f;">+${inmig} inmig</span>` : ''}
                                </span>
                            </div>
                            <div class="barra-progreso-container" style="margin:0;">
                                <div class="barra-track" style="height:12px;">
                                    <div class="barra-fill" style="width:${porcentaje}%; background:${porcentaje >= 100 ? '#4f4' : '#4a9eff'};"></div>
                                </div>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; opacity:0.7; margin-top:0.2rem;">
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <span>${pendiente} / ${metaConsolidacion}</span>
                                    <div class="btn-group-sm" style="margin-left:8px;">
                                        <button onclick="modificarProgresionPoblacion('${tipo}', -10)" ${pendiente < 10 ? 'disabled' : ''} title="-10">--</button>
                                        <button onclick="modificarProgresionPoblacion('${tipo}', -1)" ${pendiente <= 0 ? 'disabled' : ''} title="-1">-</button>
                                        <button onclick="modificarProgresionPoblacion('${tipo}', 1)" title="+1">+</button>
                                        <button onclick="modificarProgresionPoblacion('${tipo}', 10)" title="+10">++</button>
                                    </div>
                                </div>
                                ${pendiente >= metaConsolidacion ? '<span style="color:#4f4;">✨ ¡Nueva cuota lista!</span>' : ''}
                            </div>
                        </div>
                    `;
  }).join('')}
            </div>

        </div>
    </div>
  `;
}


function renderizarPestanaBioma(a, stats) {
  const recursos = a.recursos || {};
  const produccionBioma = calcularProduccionTotal(recursos, stats.calidadTotal, stats.bonificaciones || {});
  const produccionEdificios = calcularProduccionEdificios(a.edificios || [], stats);

  // Biome Info
  const biomaDef = a.biomaFusionado || BIOMAS_BASE[a.biomaBase] || {};
  const nombreBioma = biomaDef.nombre || a.biomaBase;
  const descripcion = biomaDef.descripcion || '';

  // Peculiaridades - handle both array and legacy singular
  const peculiaridades = a.peculiaridades || (a.peculiaridad ? [a.peculiaridad] : []);
  const peculiarText = peculiaridades.length > 0
    ? peculiaridades.map(pec => {
      const pecData = PECULIARIDADES && PECULIARIDADES[pec];
      return `${pecData?.icono || ''} ${pec}`;
    }).join(', ')
    : 'Ninguna';

  const bonusesHTML = Object.entries(stats.bonificaciones || {}).map(([k, v]) => {
    if (v === 0) return '';
    return `<li>${k}: <strong>${v > 0 ? '+' : ''}${v}</strong></li>`;
  }).join('');

  // Tables Logic (Simplified Reuse)
  // ... Copied mostly from original PestanaProduccion ...
  const totalCuotas = estadoSimulacion.poblacion ? estadoSimulacion.poblacion.length : 0;
  const countArtificiales = estadoSimulacion.poblacion ? estadoSimulacion.poblacion.filter(p => p.naturaleza === "Artificial").length : 0;
  const costoPoblacionDoblones = countArtificiales;
  const consumoAlimentos = totalCuotas - countArtificiales; // Artificiales no consumen alimento
  const pBioma = produccionBioma["Alimento"]?.medidas || 0;
  const pEdif = produccionEdificios["Alimento"]?.total || 0;
  const bal = (pBioma + pEdif) - consumoAlimentos;

  return `
    <div class="panel panel-full">
         <h3>🌿 Bioma: ${nombreBioma}</h3>
         <div class="bioma-info" style="margin-bottom:1rem; padding:1rem; background:rgba(255,255,255,0.05); border-radius:6px;">
             <p><strong>Peculiaridades:</strong> ${peculiarText}</p>
             <p>${descripcion}</p>
             ${Object.keys(stats.bonificaciones).length > 0 ?
      `<div style="margin-top:0.5rem; background:rgba(0,0,0,0.2); padding:0.5rem; border-radius:4px;">
                  <strong>Bonificadores Totales:</strong>
                  <ul style="padding-left:1.2rem; margin:0.5rem 0; font-size:0.9rem;">${bonusesHTML}</ul>
                </div>` : ''}
         </div>
         
         <hr class="separador-seccion">

         <h3>⚒️ Explotación de Recursos</h3>
         <div class="panel-contenido">
            
             <!-- Tabla Recursos Bioma -->
             <div class="seccion-produccion">
                <h4>🌍 Recursos Naturales</h4>
                ${Object.keys(recursos).length === 0 ? '<p style="opacity:0.7;">No hay recursos definidos en este bioma.</p>' : `
                <table class="tabla-produccion">
                    <thead><tr><th>Recurso</th><th>Abundancia</th><th>Trabajadores</th><th>Producción</th></tr></thead>
                    <tbody>
                        ${Object.entries(recursos).map(([nombre, data]) => {
        const prodData = produccionBioma[nombre];
        const esActiva = prodData && prodData.tipo === 'activa';
        const almacenado = estadoSimulacion?.almacen?.[nombre] || 0;
        const asignados = (estadoSimulacion.poblacion || []).filter(p => p.asignacion === nombre).length;
        const abundancia = data.abundancia || 'Normal';
        const claseAbundancia = abundancia === 'Abundante' ? 'positivo' : (abundancia === 'Escaso' ? 'negativo' : '');

        return `<tr class="${esActiva ? 'fila-activa' : 'fila-pasiva'}">
                                <td>
                                    <span class="recurso-icono">${RECURSOS[nombre]?.icono || '📦'}</span> 
                                    <strong>${nombre}</strong> 
                                    <small>(${almacenado} en almacén)</small>
                                </td>
                                <td class="${claseAbundancia}">${abundancia}</td>
                                <td>
                                    <div class="asignacion-control">
                                        <span>${asignados}</span>
                                        <div class="btn-group-sm">
                                            <button onclick="event.stopPropagation(); asignarPoblacionRecurso('${nombre}', -1)" ${asignados <= 0 ? 'disabled' : ''}>-</button>
                                            <button onclick="event.stopPropagation(); asignarPoblacionRecurso('${nombre}', 1)">+</button>
                                        </div>
                                    </div>
                                </td>
                                <td><strong>${prodData?.medidas || 0}</strong> ${asignados > 0 ? '(activa)' : '(pasiva)'}</td>
                            </tr>`;
      }).join('')}
                    </tbody>
                </table>
                `}
             </div>
         </div>
    </div>
  `;
}


// Helper para modificar cantidad directamente desde la tabla
function modificarCantidadRecurso(recurso, delta) {
  if (!estadoSimulacion || !estadoSimulacion.almacen) return;

  if (!estadoSimulacion.almacen[recurso]) estadoSimulacion.almacen[recurso] = 0;
  estadoSimulacion.almacen[recurso] += delta;

  if (estadoSimulacion.almacen[recurso] <= 0) {
    delete estadoSimulacion.almacen[recurso];
  }
  renderizarPantalla();
}

// Helper para modificar la progresión de crecimiento poblacional por tipo
function modificarProgresionPoblacion(tipo, delta) {
  if (!estadoSimulacion) return;

  if (!estadoSimulacion.inmigracionPendientePorTipo) {
    estadoSimulacion.inmigracionPendientePorTipo = {
      Neutral: 0, Positiva: 0, Negativa: 0, Monstruo: 0, Artificial: 0
    };
  }

  const actual = estadoSimulacion.inmigracionPendientePorTipo[tipo] || 0;
  const nuevo = Math.max(0, actual + delta);
  estadoSimulacion.inmigracionPendientePorTipo[tipo] = nuevo;

  renderizarPantalla();
}

// Helper para determinar si es manufactura
function esManufactura(nombreRecurso) {
  if (typeof RECETAS_MANUFACTURA === 'undefined') return false;
  // Check if name appears as output in any recipe
  return Object.values(RECETAS_MANUFACTURA).some(cat =>
    Object.values(cat).some(rec => {
      if (rec.output && rec.output.Recurso === nombreRecurso) return true;
      if (rec.opcion_a && rec.opcion_a.output && rec.opcion_a.output.Recurso === nombreRecurso) return true;
      if (rec.opcion_b && rec.opcion_b.output && rec.opcion_b.output.Recurso === nombreRecurso) return true;
      return false;
    })
  );
}

function renderizarPestanaAlmacenamiento(a, stats) {
  const almacen = estadoSimulacion?.almacen || {};
  const subPestanaAlmacen = estadoApp.subPestanaAlmacen || 'inventario';

  // Stats Barra
  const capacidadMaxCuotas = stats.grado.almacenamiento;
  const capacidadMaxMedidas = capacidadMaxCuotas * 10;
  const ocupado = Object.values(almacen).reduce((sum, val) => sum + val, 0);
  const porcentaje = Math.min(100, (ocupado / capacidadMaxMedidas) * 100);
  const estadoBarra = porcentaje >= 100 ? 'critico' : porcentaje >= 80 ? 'alerta' : 'normal';

  return `
    <div class="panel panel-full panel-almacenamiento">
        <div class="almacen-header">
             <div class="stat-card stat-doblones">
                <span class="stat-icono">💰</span>
                <div class="stat-info">
                    <span class="stat-label">Tesoro</span>
                    <span class="stat-value">${estadoSimulacion?.doblones || 0} Doblones</span>
                </div>
            </div>

            <div class="almacen-capacidad">
                <div class="barra-info">
                    <span>${ocupado} / ${capacidadMaxMedidas} Medidas</span>
                    <span>${Math.round(porcentaje)}%</span>
                </div>
                <div class="barra-track">
                    <div class="barra-fill ${estadoBarra}" style="width: ${porcentaje}%"></div>
                </div>
            </div>
        </div>

        <!-- Sub-pestañas de Almacenamiento -->
        <nav class="almacen-subtabs">
            <button class="almacen-subtab ${subPestanaAlmacen === 'inventario' ? 'activa' : ''}" 
                    onclick="cambiarSubPestanaAlmacen('inventario')">
                📦 Inventario
            </button>
            <button class="almacen-subtab ${subPestanaAlmacen === 'balance' ? 'activa' : ''}" 
                    onclick="cambiarSubPestanaAlmacen('balance')">
                📊 Balance de Recursos
            </button>
        </nav>

        ${subPestanaAlmacen === 'inventario'
      ? renderizarSubPestanaInventario(almacen, stats)
      : renderizarSubPestanaBalance(a, stats)}
    </div>
    `;
}

function cambiarSubPestanaAlmacen(subPestana) {
  estadoApp.subPestanaAlmacen = subPestana;
  renderizarPantalla();
}

function renderizarSubPestanaInventario(almacen, stats) {
  // Separar y Ordenar
  const itemsManufactura = [];
  const itemsBioma = [];

  Object.entries(almacen).forEach(([nombre, cantidad]) => {
    if (esManufactura(nombre)) {
      itemsManufactura.push({ nombre, cantidad });
    } else {
      itemsBioma.push({ nombre, cantidad });
    }
  });

  // Sort Descending by Quantity
  itemsManufactura.sort((a, b) => b.cantidad - a.cantidad);
  itemsBioma.sort((a, b) => b.cantidad - a.cantidad);

  const renderTable = (items, title, icon) => {
    if (items.length === 0) return `
        <div class="almacen-seccion">
            <h3>${icon} ${title}</h3>
            <p class="sin-recursos">Vacío</p>
        </div>`;

    return `
        <div class="almacen-seccion">
            <h3>${icon} ${title}</h3>
            <table class="tabla-almacen">
                <thead>
                    <tr>
                        <th width="50%">Recurso</th>
                        <th width="20%">Cantidad</th>
                        <th width="30%">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>
                                <span class="item-icono">${RECURSOS[item.nombre]?.icono || '📦'}</span>
                                ${item.nombre}
                            </td>
                            <td><strong>${item.cantidad}</strong></td>
                            <td>
                                <div class="acciones-fila">
                                    <button class="btn-mini" onclick="modificarCantidadRecurso('${item.nombre}', -10)">-10</button>
                                    <button class="btn-mini" onclick="modificarCantidadRecurso('${item.nombre}', -1)">-1</button>
                                    <button class="btn-mini" onclick="modificarCantidadRecurso('${item.nombre}', 1)">+1</button>
                                    <button class="btn-mini" onclick="modificarCantidadRecurso('${item.nombre}', 10)">+10</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
      `;
  };

  return `
    <div class="almacen-secciones-grid">
        ${renderTable(itemsManufactura, "Manufacturas", "🏭")}
        ${renderTable(itemsBioma, "Bioma / Natural", "🌍")}
    </div>

    <div class="form-tipificacion" style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
        <h4>➕ Tipificar Nuevo Recurso</h4>
        <div class="form-row" style="display: flex; gap: 10px; margin-top: 10px;">
            <select id="select-recurso-nuevo" class="select-form" style="flex: 2; background: #2a2a4a; color: white; border: 1px solid #444; padding: 5px;">
                <option value="">Seleccionar recurso...</option>
                ${Object.keys(RECURSOS)
      .sort()
      .map(r => `<option value="${r}">${RECURSOS[r].icono} ${r}</option>`).join('')}
            </select>
            <input type="number" id="input-cantidad-nueva" class="input-form" placeholder="Cant." min="0" value="0" style="flex: 1; background: #2a2a4a; color: white; border: 1px solid #444; padding: 5px;">
            <button class="btn-principal" style="padding: 5px 15px;" onclick="agregarRecursoDesdeUI()">Agregar</button>
        </div>
        <small style="color:#aaa; display:block; margin-top:5px;">Ahora puedes agregar recursos existentes para incrementar su stock.</small>
    </div>
  `;
}

function renderizarSubPestanaBalance(a, stats) {
  const recursos = a.recursos || {};
  const produccionBioma = calcularProduccionTotal(recursos, stats.calidadTotal, stats.bonificaciones || {});
  const produccionEdificios = calcularProduccionEdificios(a.edificios || [], stats);

  const totalCuotas = estadoSimulacion.poblacion ? estadoSimulacion.poblacion.length : 0;
  const countArtificiales = estadoSimulacion.poblacion ? estadoSimulacion.poblacion.filter(p => p.naturaleza === "Artificial").length : 0;
  const costoPoblacionDoblones = countArtificiales;
  const consumoAlimentos = totalCuotas - countArtificiales; // Artificiales no consumen alimento

  // Calcular produccion total de alimentos (sumando todos los tipos)
  let produccionAlimentosTotal = 0;
  const desgloseAlimentos = {};

  // Helper para sumar si es alimento
  const procesarRecursoAlimento = (nombre, cantidad) => {
    if (cantidad <= 0) return;
    const def = RECURSOS[nombre];
    // Check if it's food (by name "Alimento", category "Alimento" or tag "Alimento")
    const esAlimento = nombre === "Alimento" ||
      (def && (def.categoria === "Alimento" || (def.tags && def.tags.includes("Alimento"))));

    if (esAlimento) {
      produccionAlimentosTotal += cantidad;
      desgloseAlimentos[nombre] = (desgloseAlimentos[nombre] || 0) + cantidad;
    }
  };

  // Sumar del Bioma
  Object.entries(produccionBioma).forEach(([nombre, data]) => {
    procesarRecursoAlimento(nombre, data.medidas || 0);
  });

  // Sumar de Edificios
  Object.entries(produccionEdificios).forEach(([nombre, data]) => {
    procesarRecursoAlimento(nombre, data.total || 0);
  });

  const balanceAlimento = produccionAlimentosTotal - consumoAlimentos;

  // Generar HTML del desglose
  const desgloseHTML = Object.entries(desgloseAlimentos)
    .map(([nombre, cant]) => `<div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#aaa;"><span>+ ${nombre}:</span> <span>${cant}</span></div>`)
    .join('');

  // === MANUFACTURA: Calcular input/output ===
  const manufacturaInputs = {};  // Recursos consumidos
  const manufacturaOutputs = {}; // Recursos producidos

  // Leer desde edificios del asentamiento (donde se guarda la receta)
  const edificiosAsentamiento = a.edificios || [];
  edificiosAsentamiento.forEach(instancia => {
    if (typeof instancia === 'string') return; // Skip legacy string format

    const edificioDef = typeof EDIFICIOS !== 'undefined' ? EDIFICIOS[instancia.nombre] : null;
    if (!edificioDef?.permiteManufactura || !instancia.receta) return;

    // Buscar trabajadores asignados
    const trabajadores = (estadoSimulacion?.poblacion || []).filter(p => p.asignacion === instancia.id).length;
    if (trabajadores <= 0) return;

    // Buscar la receta (manejar formato "key" o "key:opcion_a")
    if (typeof RECETAS_MANUFACTURA === 'undefined') return;

    const [recetaKey, opcion] = instancia.receta.includes(':')
      ? instancia.receta.split(':')
      : [instancia.receta, null];

    for (const categoria of Object.values(RECETAS_MANUFACTURA)) {
      const recetaBase = categoria[recetaKey];
      if (!recetaBase) continue;

      // Obtener la receta correcta (base u opción)
      let receta = recetaBase;
      if (opcion && recetaBase[opcion]) {
        receta = recetaBase[opcion];
      }

      // Inputs (consumo)
      const inputData = receta.input;
      if (inputData) {
        for (const [recurso, cantidad] of Object.entries(inputData)) {
          manufacturaInputs[recurso] = (manufacturaInputs[recurso] || 0) + (cantidad * trabajadores);
        }
      }

      // Outputs (producción)
      const outputData = receta.output;
      if (outputData && outputData.Recurso) {
        const recursoProd = outputData.Recurso;
        const cantidadProd = outputData.Cantidad || 1;
        manufacturaOutputs[recursoProd] = (manufacturaOutputs[recursoProd] || 0) + (cantidadProd * trabajadores);
      }
      break;
    }
  });

  // === BALANCE DOBLONES ===
  const tributoActual = a.tributo || "Sin Tributo";
  const tributoData = typeof TRIBUTOS !== 'undefined' ? (TRIBUTOS[tributoActual] || TRIBUTOS["Sin Tributo"]) : { doblones: 0, calidad: 0 };
  const limiteAdmin = stats.grado?.admin || 10;
  const poblacionTributable = Math.min(totalCuotas, limiteAdmin);
  const ingresosTributo = poblacionTributable * tributoData.doblones;

  // Ingresos de edificios (ej: Mercado)
  const ingresosEdificios = produccionEdificios["Doblones"]?.total || 0;

  // Mantenimiento - usar el valor precalculado que aplica modificadores correctamente
  const gastoMantenimiento = stats.mantenimientoEdificios || 0;

  const balanceDoblones = ingresosTributo + ingresosEdificios - gastoMantenimiento - costoPoblacionDoblones;

  // Recopilar todos los recursos con producción
  const recursosConProduccion = new Set();
  Object.keys(produccionBioma).forEach(r => recursosConProduccion.add(r));
  Object.keys(produccionEdificios).forEach(r => recursosConProduccion.add(r));
  Object.keys(manufacturaInputs).forEach(r => recursosConProduccion.add(r));
  Object.keys(manufacturaOutputs).forEach(r => recursosConProduccion.add(r));

  // Calcular balance para cada recurso
  const balances = [];
  recursosConProduccion.forEach(recurso => {
    const prodBioma = produccionBioma[recurso]?.medidas || 0;
    const prodEdif = produccionEdificios[recurso]?.total || 0;
    const manufInput = manufacturaInputs[recurso] || 0;
    const manufOutput = manufacturaOutputs[recurso] || 0;
    let consumo = manufInput;

    // Consumo especial para Alimento
    if (recurso === "Alimento") {
      consumo += consumoAlimentos;
    }

    const neto = (prodBioma + prodEdif + manufOutput) - consumo;

    if (prodBioma !== 0 || prodEdif !== 0 || consumo !== 0 || manufOutput !== 0) {
      balances.push({
        recurso,
        prodBioma,
        prodEdif,
        manufOutput,
        consumo,
        neto,
        icono: RECURSOS[recurso]?.icono || '📦'
      });
    }
  });

  // Ordenar: Alimento primero, luego por nombre
  balances.sort((a, b) => {
    if (a.recurso === "Alimento") return -1;
    if (b.recurso === "Alimento") return 1;
    return a.recurso.localeCompare(b.recurso);
  });

  return `
    <div class="balance-recursos">
        <h4>📊 Balance de Recursos por Turno</h4>
        <p style="opacity:0.7; margin-bottom:1rem;">Este panel muestra cómo cambian tus recursos cada turno.</p>
        
        <!-- Balance Doblones destacado -->
        <div class="balance-destacado ${balanceDoblones >= 0 ? 'positivo' : 'negativo'}">
            <div class="balance-destacado-icono">💰</div>
            <div class="balance-destacado-info">
                <h5>Balance de Doblones</h5>
                <div class="balance-desglose">
                    <span>Tributos: <strong>+${ingresosTributo}</strong></span>
                    ${ingresosEdificios > 0 ? `<span>Edificios: <strong>+${ingresosEdificios}</strong></span>` : ''}
                    <span>Mantenimiento: <strong>-${gastoMantenimiento}</strong></span>
                    ${costoPoblacionDoblones > 0 ? `<span>🤖 Población Artificial: <strong>-${costoPoblacionDoblones}</strong></span>` : ""}
                </div>
            </div>
            <div class="balance-destacado-neto">
                <span class="neto-label">Neto</span>
                <span class="neto-value ${balanceDoblones >= 0 ? 'positivo' : 'negativo'}">
                    ${balanceDoblones >= 0 ? '+' : ''}${balanceDoblones}
                </span>
            </div>
        </div>

        <!-- Balance Alimentos destacado -->
        <div class="balance-destacado ${balanceAlimento >= 0 ? 'positivo' : 'negativo'}">
            <div class="balance-destacado-icono">🌾</div>
            <div class="balance-destacado-info">
                <h5>Balance de Alimentos</h5>
                <div class="balance-desglose" style="display:block;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span>Producción Total: <strong>+${produccionAlimentosTotal}</strong></span></div>
                    ${desgloseHTML ? `<div style="margin-left:5px; border-left:2px solid rgba(255,255,255,0.1); padding-left:8px; margin-bottom:8px;">${desgloseHTML}</div>` : ''}
                    <div style="display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.1); padding-top:4px;"><span>Consumo: <strong>-${consumoAlimentos}</strong></span></div>
                </div>
            </div>
            <div class="balance-destacado-neto">
                <span class="neto-label">Neto</span>
                <span class="neto-value ${balanceAlimento >= 0 ? 'positivo' : 'negativo'}">
                    ${balanceAlimento >= 0 ? '+' : ''}${balanceAlimento}
                </span>
            </div>
        </div>

        <hr class="separador-seccion">

        <!-- Tabla de todos los recursos -->
        <h4>📦 Balance de Recursos</h4>
        ${balances.length > 0 ? `
        <table class="tabla-balance">
            <thead>
                <tr>
                    <th>Recurso</th>
                    <th>Bioma</th>
                    <th>Edificios</th>
                    <th>Manufact.</th>
                    <th>Consumo</th>
                    <th>Neto</th>
                </tr>
            </thead>
            <tbody>
                ${balances.map(b => `
                    <tr class="${b.neto > 0 ? 'fila-positiva' : b.neto < 0 ? 'fila-negativa' : ''}">
                        <td>
                            <span class="recurso-icono">${b.icono}</span>
                            ${b.recurso}
                        </td>
                        <td>${b.prodBioma > 0 ? '+' + b.prodBioma : (b.prodBioma || '-')}</td>
                        <td>${b.prodEdif > 0 ? '+' + b.prodEdif : (b.prodEdif || '-')}</td>
                        <td class="positivo">${b.manufOutput > 0 ? '+' + b.manufOutput : '-'}</td>
                        <td class="negativo">${b.consumo > 0 ? '-' + b.consumo : '-'}</td>
                        <td class="${b.neto >= 0 ? 'positivo' : 'negativo'}">
                            <strong>${b.neto >= 0 ? '+' : ''}${b.neto}</strong>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ` : '<p style="opacity:0.6;">No hay producción de recursos activa.</p>'}
    </div>
  `;
}

function renderizarPestanaComercio(a, stats) {
  const historial = estadoSimulacion?.historialComercio || [];
  const turnoActual = estadoSimulacion?.turno || 0;

  // Backward compatibility: assign IDs to old transactions without them
  historial.forEach((t, i) => {
    if (!t.id) t.id = Date.now() + i;
  });

  // Ordenar historial por turno descendente (más recientes primero)
  const historialOrdenado = [...historial].sort((a, b) => b.turno - a.turno);

  const renderFormulario = () => `
    <div class="comercio-form">
        <h4>➕ Registrar Transacción</h4>
        <div class="form-grid-comercio">
            <div class="form-group">
                <label>Tipo</label>
                <select id="comercio-tipo" class="select-form">
                    <option value="entrada">📥 Entrada</option>
                    <option value="salida">📤 Salida</option>
                </select>
            </div>
            <div class="form-group">
                <label>Recurso</label>
                <select id="comercio-recurso" class="select-form">
                    <option value="">Seleccionar...</option>
                    <option value="Doblones">💰 Doblones</option>
                    ${Object.keys(RECURSOS)
      .sort()
      .map(r => `<option value="${r}">${RECURSOS[r].icono} ${r}</option>`)
      .join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Cantidad</label>
                <input type="number" id="comercio-cantidad" class="input-form" min="1" value="1" placeholder="Cantidad">
            </div>
            <div class="form-group">
                <label>Turno</label>
                <input type="number" id="comercio-turno" class="input-form" min="0" value="${turnoActual}" placeholder="Turno">
            </div>
            <div class="form-group">
                <label>Comerciante</label>
                <input type="text" id="comercio-comerciante" class="input-form" placeholder="Nombre del comerciante">
            </div>
            <div class="form-group form-action">
                <button class="btn-principal" onclick="agregarComercioDesdeUI()">
                    <span class="btn-icono">✓</span>
                    <span class="btn-texto">Registrar</span>
                </button>
            </div>
        </div>
        <small style="color:#aaa; display:block; margin-top:8px;">
            📌 Turno actual de la simulación: <strong>${turnoActual}</strong>
        </small>
    </div>
  `;

  const renderHistorial = () => {
    if (historialOrdenado.length === 0) {
      return `
        <div class="comercio-vacio">
            <div class="icono-vacio">📜</div>
            <p>No hay transacciones registradas.</p>
        </div>
      `;
    }

    return `
      <table class="tabla-comercio">
          <thead>
              <tr>
                  <th>Turno</th>
                  <th>Tipo</th>
                  <th>Recurso</th>
                  <th>Cantidad</th>
                  <th>Comerciante</th>
                  <th>Acciones</th>
              </tr>
          </thead>
          <tbody>
              ${historialOrdenado.map((entry, index) => `
                  <tr class="${entry.tipo === 'entrada' ? 'tipo-entrada' : 'tipo-salida'}">
                      <td><strong>${entry.turno}</strong></td>
                      <td>
                          <span class="badge-tipo ${entry.tipo}">
                              ${entry.tipo === 'entrada' ? '📥 Entrada' : '📤 Salida'}
                          </span>
                      </td>
                      <td>
                          <span class="recurso-icono">${RECURSOS[entry.recurso]?.icono || '📦'}</span>
                          ${entry.recurso}
                      </td>
                      <td class="${entry.tipo === 'entrada' ? 'positivo' : 'negativo'}">
                          ${entry.tipo === 'entrada' ? '+' : '-'}${entry.cantidad}
                      </td>
                      <td>${entry.comerciante || '-'}</td>
                      <td class="acciones-comercio">
                          <button class="btn-accion btn-editar" onclick="editarTransaccion(${entry.id})" title="Editar transacción">
                              ✏️
                          </button>
                          <button class="btn-accion btn-eliminar" onclick="eliminarTransaccion(${entry.id})" title="Eliminar transacción">
                              🗑️
                          </button>
                      </td>
                  </tr>
              `).join('')}
          </tbody>
      </table>
    `;
  };

  // Calcular resumen
  const resumen = historial.reduce((acc, entry) => {
    if (entry.tipo === 'entrada') {
      acc.entradas += entry.cantidad;
      acc.transaccionesEntrada++;
    } else {
      acc.salidas += entry.cantidad;
      acc.transaccionesSalida++;
    }
    return acc;
  }, { entradas: 0, salidas: 0, transaccionesEntrada: 0, transaccionesSalida: 0 });

  return `
    <div class="panel panel-full panel-comercio">
        <h3>⚖️ Centro de Comercio</h3>
        
        <div class="comercio-resumen">
            <div class="stat-comercio entrada">
                <span class="stat-icono">📥</span>
                <div class="stat-info">
                    <span class="stat-label">Entradas</span>
                    <span class="stat-value">${resumen.entradas} medidas</span>
                    <small>${resumen.transaccionesEntrada} transacciones</small>
                </div>
            </div>
            <div class="stat-comercio salida">
                <span class="stat-icono">📤</span>
                <div class="stat-info">
                    <span class="stat-label">Salidas</span>
                    <span class="stat-value">${resumen.salidas} medidas</span>
                    <small>${resumen.transaccionesSalida} transacciones</small>
                </div>
            </div>
            <div class="stat-comercio balance">
                <span class="stat-icono">📊</span>
                <div class="stat-info">
                    <span class="stat-label">Balance</span>
                    <span class="stat-value ${resumen.entradas - resumen.salidas >= 0 ? 'positivo' : 'negativo'}">
                        ${resumen.entradas - resumen.salidas >= 0 ? '+' : ''}${resumen.entradas - resumen.salidas}
                    </span>
                </div>
            </div>
        </div>

        ${renderFormulario()}
        
        <hr class="separador-seccion">
        
        <h4>📜 Historial de Transacciones</h4>
        ${renderHistorial()}
    </div>
    `;
}

function agregarRecursoDesdeUI() {
  const selector = document.getElementById('select-recurso-nuevo');
  const input = document.getElementById('input-cantidad-nueva');
  const recurso = selector.value;
  const cantidad = parseInt(input.value) || 0;

  if (!recurso) {
    alert("Selecciona un recurso");
    return;
  }

  if (estadoSimulacion) {
    if (!estadoSimulacion.almacen) estadoSimulacion.almacen = {};
    estadoSimulacion.almacen[recurso] = (estadoSimulacion.almacen[recurso] || 0) + cantidad;
    renderizarPantalla();
  }
}

function agregarComercioDesdeUI() {
  const tipo = document.getElementById('comercio-tipo')?.value;
  const recurso = document.getElementById('comercio-recurso')?.value;
  const cantidad = parseInt(document.getElementById('comercio-cantidad')?.value) || 0;
  const turno = parseInt(document.getElementById('comercio-turno')?.value) || 0;
  const comerciante = document.getElementById('comercio-comerciante')?.value || '';

  if (!recurso) {
    alert("Selecciona un recurso");
    return;
  }

  if (cantidad <= 0) {
    alert("La cantidad debe ser mayor a 0");
    return;
  }

  if (!estadoSimulacion) return;

  // Inicializar almacen si no existe
  if (!estadoSimulacion.almacen) estadoSimulacion.almacen = {};

  // Aplicar efecto en almacenamiento (Doblones se manejan por separado)
  if (recurso === 'Doblones') {
    // Doblones: usar estadoSimulacion.doblones
    if (tipo === 'entrada') {
      estadoSimulacion.doblones = (estadoSimulacion.doblones || 0) + cantidad;
    } else if (tipo === 'salida') {
      const actual = estadoSimulacion.doblones || 0;
      if (actual < cantidad) {
        alert(`No hay suficientes Doblones (${actual} disponibles)`);
        return;
      }
      estadoSimulacion.doblones = actual - cantidad;
    }
  } else {
    // Recursos normales: usar almacen
    if (tipo === 'entrada') {
      estadoSimulacion.almacen[recurso] = (estadoSimulacion.almacen[recurso] || 0) + cantidad;
    } else if (tipo === 'salida') {
      const actual = estadoSimulacion.almacen[recurso] || 0;
      if (actual < cantidad) {
        alert(`No hay suficiente ${recurso} en el almacén (${actual} disponibles)`);
        return;
      }
      estadoSimulacion.almacen[recurso] = actual - cantidad;
      if (estadoSimulacion.almacen[recurso] <= 0) {
        delete estadoSimulacion.almacen[recurso];
      }
    }
  }

  // Registrar en historial con turno manual
  if (typeof registrarComercio === 'function') {
    registrarComercio(recurso, cantidad, tipo, comerciante, turno);
  }

  // Mostrar notificación
  if (typeof mostrarNotificacion === 'function') {
    const icono = tipo === 'entrada' ? '📥' : '📤';
    mostrarNotificacion(`${icono} ${tipo === 'entrada' ? 'Entrada' : 'Salida'}: ${cantidad} ${recurso}`, 'exito');
  }

  // Actualizar pantalla
  renderizarPantalla();
}

/**
 * Edita una transacción de comercio existente
 * @param {number} transaccionId - ID único de la transacción
 */
function editarTransaccion(transaccionId) {
  const historial = estadoSimulacion?.historialComercio;
  const index = historial?.findIndex(t => t.id === transaccionId);
  if (!historial || index === -1) {
    mostrarNotificacion('Transacción no encontrada', 'error');
    return;
  }

  const transaccion = historial[index];

  // Rellenar el formulario con los datos de la transacción
  const tipoSelect = document.getElementById('comercio-tipo');
  const recursoSelect = document.getElementById('comercio-recurso');
  const cantidadInput = document.getElementById('comercio-cantidad');
  const turnoInput = document.getElementById('comercio-turno');
  const comercianteInput = document.getElementById('comercio-comerciante');

  if (tipoSelect) tipoSelect.value = transaccion.tipo;
  if (recursoSelect) recursoSelect.value = transaccion.recurso;
  if (cantidadInput) cantidadInput.value = transaccion.cantidad;
  if (turnoInput) turnoInput.value = transaccion.turno;
  if (comercianteInput) comercianteInput.value = transaccion.comerciante || '';

  // Eliminar la transacción original (revertir sus efectos primero)
  revertirTransaccion(transaccion);
  historial.splice(index, 1);

  // Guardar estado
  guardarEstadoAsentamiento();

  mostrarNotificacion('Transacción cargada para edición. Modifica y guarda.', 'info');
  renderizarPantalla();

  // Hacer scroll al formulario
  setTimeout(() => {
    const form = document.querySelector('.comercio-form');
    if (form) form.scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

/**
 * Elimina una transacción de comercio
 * @param {number} transaccionId - ID único de la transacción
 */
function eliminarTransaccion(transaccionId) {
  const historial = estadoSimulacion?.historialComercio;
  const index = historial?.findIndex(t => t.id === transaccionId);
  if (!historial || index === -1) {
    mostrarNotificacion('Transacción no encontrada', 'error');
    return;
  }

  const transaccion = historial[index];

  if (!confirm(`¿Eliminar esta transacción?\n\n${transaccion.tipo === 'entrada' ? '📥 Entrada' : '📤 Salida'}: ${transaccion.cantidad} ${transaccion.recurso}\nTurno: ${transaccion.turno}`)) {
    return;
  }

  // Revertir los efectos de la transacción en el almacén
  revertirTransaccion(transaccion);

  // Eliminar del historial
  historial.splice(index, 1);

  // Guardar estado
  guardarEstadoAsentamiento();

  mostrarNotificacion('Transacción eliminada', 'success');
  renderizarPantalla();
}

/**
 * Revierte los efectos de una transacción en el almacén
 * @param {object} transaccion - La transacción a revertir
 */
function revertirTransaccion(transaccion) {
  if (!estadoSimulacion?.almacen) return;

  const { recurso, cantidad, tipo } = transaccion;

  // Si fue una entrada, restar del almacén
  // Si fue una salida, sumar al almacén
  if (tipo === 'entrada') {
    const actual = estadoSimulacion.almacen[recurso] || 0;
    estadoSimulacion.almacen[recurso] = Math.max(0, actual - cantidad);
    if (estadoSimulacion.almacen[recurso] <= 0) {
      delete estadoSimulacion.almacen[recurso];
    }
  } else {
    estadoSimulacion.almacen[recurso] = (estadoSimulacion.almacen[recurso] || 0) + cantidad;
  }
}

/**
 * Guarda el estado actual del asentamiento
 */
function guardarEstadoAsentamiento() {
  const asentamientoActual = obtenerAsentamientoActual();
  if (asentamientoActual) {
    asentamientoActual.simulacion = JSON.parse(JSON.stringify(estadoSimulacion));
    guardarExpedicion();
  }
}

// =====================================================
// HELPERS UI POBLACIÓN
// =====================================================

function obtenerPoblacionTotalHelper() {
  if (typeof obtenerPoblacionTotal === 'function') {
    return obtenerPoblacionTotal();
  }
  return 0;
}

function obtenerPoblacionOciosaHelper() {
  if (estadoSimulacion && estadoSimulacion.poblacion) {
    return estadoSimulacion.poblacion.filter(c => !c.asignacion).reduce((sum, c) => sum + c.medidas, 0);
  }
  return 0;
}

function renderizarListaCuotasPoblacion() {
  if (!estadoSimulacion || !estadoSimulacion.poblacion) return '<p>No hay población</p>';

  const cuotas = estadoSimulacion.poblacion;
  const recursosDisponibles = Object.keys(estadoApp.asentamiento.recursos || {});

  // Agrupar visualmente si es posible, o mostrar lista plana
  return cuotas.map(cuota => {
    const rolData = ROLES_POBLACION[cuota.rol];
    const natData = NATURALEZAS_POBLACION[cuota.naturaleza];
    const asignado = cuota.asignacion;

    return `
        <div class="cuota-card-hud ${asignado ? 'asignado' : 'ocioso'}">
            <div class="cuota-info">
                <span class="cuota-icono">${rolData?.icono || '👤'}</span>
                <div>
                   <div class="cuota-rol">${cuota.rol} <small>(${cuota.naturaleza})</small></div>
                   <div class="cuota-medidas">20 Colonos ${asignado ? '🔨 Trabajando' : '💤 Ociosos'}</div>
                </div>
            </div>
            <div class="cuota-accion">
                <select class="select-trabajo" onchange="asignarTrabajoDesdeUI(${cuota.id}, this.value)">
                    <option value="" ${!asignado ? 'selected' : ''}>-- Ocioso --</option>
                    ${recursosDisponibles.map(r => `
                        <option value="${r}" ${asignado === r ? 'selected' : ''}>⛏️ ${r}</option>
                    `).join('')}
                </select>
            </div>
        </div>
    `;
  }).join('');
}

function asignarTrabajoDesdeUI(idCuota, recurso) {
  // Check Capacity if resource is building
  if (recurso && recurso.startsWith('edificio')) {
    let capacidadTotal = 0;
    let asignados = 0;
    let nombreUI = "";

    const cuotas = estadoSimulacion.poblacion || [];

    // CASE 1: Specific Instance Assignment (New)
    if (recurso.startsWith('edificio_id:')) {
      const instanciaId = recurso.replace('edificio_id:', '');
      const inst = (estadoApp.asentamiento.edificios || []).find(e => typeof e === 'object' && e.id === instanciaId);

      if (inst) {
        nombreUI = inst.nombre;
        // Get Grade from simulation state for accuracy, fallback to object state
        let grado = inst.grado || 1;
        if (estadoSimulacion.edificiosEstado && estadoSimulacion.edificiosEstado[inst.id]) {
          grado = estadoSimulacion.edificiosEstado[inst.id].grado || 1;
        }
        capacidadTotal = calcularCapacidadEdificio(inst.nombre, grado);
        asignados = cuotas.filter(c => c.asignacion === recurso).length;
      }
    }
    // CASE 2: Generic Type Assignment (Legacy)
    else if (recurso.startsWith('edificio:')) {
      const nombreEdificio = recurso.replace('edificio:', '');
      nombreUI = nombreEdificio;

      // Count generic assignments
      asignados = cuotas.filter(c => c.asignacion === recurso).length;

      // Calculate Total Capacity
      const instancias = (estadoApp.asentamiento.edificios || []).filter(e =>
        (typeof e === 'string' ? e : e.nombre) === nombreEdificio
      );

      instancias.forEach(inst => {
        let grado = 1;
        if (typeof inst === 'object') {
          if (inst.id && estadoSimulacion.edificiosEstado && estadoSimulacion.edificiosEstado[inst.id]) {
            grado = estadoSimulacion.edificiosEstado[inst.id].grado || 1;
          } else {
            grado = inst.grado || 1;
          }
        }
        capacidadTotal += calcularCapacidadEdificio(nombreEdificio, grado);
      });
    }

    if (capacidadTotal > 0 && asignados >= capacidadTotal) {
      alert(`¡No hay más cupo en ${nombreUI}! (${asignados}/${capacidadTotal})`);
      renderizarPantalla(); // Reset UI to revert selection
      return;
    }
  }

  // Si recurso es string vacío, pasar null
  const recursoFinal = recurso === "" ? null : recurso;
  const exito = asignarPoblacionARecurso(idCuota, recursoFinal);
  if (exito) {
    actualizarHUD(); // Optimized update
  } else {
    console.error("Error al asignar trabajo");
  }
}

/**
 * Muestra modal para seleccionar a qu� asentamiento conectarse (M�ltiple) - V2
 */
function mostrarModalConexionV2() {
  const container = document.getElementById('app-container');
  const asentamientos = estadoApp.expedicion?.asentamientos || [];

  if (asentamientos.length === 0) {
    iniciarCreacionConOpciones(false, []);
    return;
  }

  const opcionesHTML = asentamientos.map(a =>
    '<div class="conexion-opcion">' +
    '<input type="checkbox" id="conexion-' + a.id + '" value="' + a.id + '" class="check-conexion">' +
    '<label for="conexion-' + a.id + '">' + a.nombre + ' (' + a.grado + ')</label>' +
    '</div>'
  ).join('');

  const modalHTML =
    '<div class="modal-overlay" id="modal-conexion">' +
    '<div class="modal-content">' +
    '<div class="modal-icono">🔗</div>' +
    '<h2>Conectar Asentamiento</h2>' +
    '<p>Selecciona los asentamientos a los que estar�s conectado (opcional):</p>' +

    '<div class="modal-campo lista-conexiones">' +
    opcionesHTML +
    '</div>' +

    '<div class="modal-acciones">' +
    '<button class="btn-principal" onclick="confirmarConexionV2()">' +
    '<span class="btn-icono">✓</span>' +
    '<span class="btn-texto">Continuar</span>' +
    '</button>' +
    '<button class="btn-secundario" onclick="cerrarModalConexion()">' +
    '<span class="btn-texto">Cancelar</span>' +
    '</button>' +
    '</div>' +

    '<button class="btn-cerrar-modal" onclick="cerrarModalConexion()">✕</button>' +
    '</div>' +
    '</div>';

  container.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Confirma la conexi�n y contin�a con la creaci�n - V2
 */
function confirmarConexionV2() {
  const checkboxes = document.querySelectorAll('.check-conexion:checked');
  const conexiones = Array.from(checkboxes).map(cb => parseInt(cb.value));

  cerrarModalConexion();
  iniciarCreacionConOpciones(false, conexiones);
}




// =====================================================
// HELPERS DE RECURSOS (TAGS)
// =====================================================

function calcularRecursosPorTag(tag) {
  let total = 0;
  const almacen = estadoSimulacion?.almacen || {};
  Object.entries(almacen).forEach(([res, cant]) => {
    const def = RECURSOS[res];
    if (def && def.tags && def.tags.includes(tag)) {
      total += cant;
    }
  });
  return total;
}

function consumirRecursosPorTag(tag, cantidadRequerida) {
  const almacen = estadoSimulacion?.almacen || {};
  let porConsumir = cantidadRequerida;

  // Encontrar candidatos
  const candidatos = [];
  Object.entries(almacen).forEach(([res, cant]) => {
    const def = RECURSOS[res];
    if (def && def.tags && def.tags.includes(tag)) {
      candidatos.push({ nombre: res, cantidad: cant, exotico: def.tags.includes('Exotico') });
    }
  });

  // Ordenar: Priorizar NO Exóticos (Normales) primero
  candidatos.sort((a, b) => {
    if (a.exotico === b.exotico) return 0;
    return a.exotico ? 1 : -1; // Normal goes first (false < true ?) false=0, true=1.
  });

  for (const item of candidatos) {
    if (porConsumir <= 0) break;
    const tomar = Math.min(item.cantidad, porConsumir);
    almacen[item.nombre] -= tomar;
    porConsumir -= tomar;
    if (almacen[item.nombre] <= 0) delete almacen[item.nombre];
  }
}

// =====================================================
// HELPERS DE COSTES (checkCostAffordability, consumeCostBlock)
// =====================================================

/**
 * Verifica si un bloque de costos es pagable.
 * @param {Object} costBlock - Objeto con recursos y cantidades { "Recurso": X, ... }
 * @param {number} multiplier - Multiplicador de costos (ej: 10)
 * @returns {Array} - Lista de recursos faltantes, vacía si es pagable
 */
function checkCostAffordability(costBlock, multiplier = 10) {
  const missing = [];
  if (!costBlock || typeof costBlock !== 'object') return missing;

  Object.entries(costBlock).forEach(([recurso, cantidad]) => {
    const cantidadReal = cantidad * multiplier;
    let disponible = 0;

    if (recurso === 'Doblones') {
      disponible = estadoSimulacion.doblones || 0;
    } else if (recurso.startsWith('Cualquier ')) {
      const tag = recurso.replace('Cualquier ', '');
      disponible = calcularRecursosPorTag(tag);
    } else {
      // Primero buscar el recurso por nombre exacto
      disponible = (estadoSimulacion.almacen && estadoSimulacion.almacen[recurso]) || 0;

      // Si no hay suficiente, buscar también por tag (ej: "Piel" busca recursos con tag "Piel" como "Pieles")
      if (disponible < cantidadReal) {
        disponible += calcularRecursosPorTag(recurso);
      }
    }

    if (disponible < cantidadReal) {
      missing.push(`${recurso} (${cantidadReal - disponible} faltan)`);
    }
  });

  return missing;
}

/**
 * Consume recursos de un bloque de costos.
 * @param {Object} costBlock - Objeto con recursos y cantidades
 * @param {number} multiplier - Multiplicador de costos
 */
function consumeCostBlock(costBlock, multiplier = 10) {
  if (!costBlock || typeof costBlock !== 'object') return;

  Object.entries(costBlock).forEach(([recurso, cantidad]) => {
    const cantidadReal = cantidad * multiplier;

    if (recurso === 'Doblones') {
      estadoSimulacion.doblones = (estadoSimulacion.doblones || 0) - cantidadReal;
    } else if (recurso.startsWith('Cualquier ')) {
      const tag = recurso.replace('Cualquier ', '');
      consumirRecursosPorTag(tag, cantidadReal);
    } else {
      // Primero intentar consumir el recurso por nombre exacto
      let porConsumir = cantidadReal;

      if (estadoSimulacion.almacen[recurso]) {
        const tomarDirecto = Math.min(estadoSimulacion.almacen[recurso], porConsumir);
        estadoSimulacion.almacen[recurso] -= tomarDirecto;
        porConsumir -= tomarDirecto;
        if (estadoSimulacion.almacen[recurso] <= 0) {
          delete estadoSimulacion.almacen[recurso];
        }
      }

      // Si aún falta, consumir por tag (ej: "Piel" consume de recursos con tag "Piel" como "Pieles")
      if (porConsumir > 0) {
        consumirRecursosPorTag(recurso, porConsumir);
      }
    }
  });
}

/**
 * Devuelve recursos de un bloque de costos (reembolso al demoler).
 * @param {Object} costBlock - Objeto con recursos y cantidades
 * @param {number} multiplier - Multiplicador de costos
 */
function refundCostBlock(costBlock, multiplier = 10) {
  if (!costBlock || typeof costBlock !== 'object') return;

  Object.entries(costBlock).forEach(([recurso, cantidad]) => {
    const cantidadReal = cantidad * multiplier;

    if (recurso === 'Doblones') {
      estadoSimulacion.doblones = (estadoSimulacion.doblones || 0) + cantidadReal;
    } else if (recurso.startsWith('Cualquier ')) {
      // Para recursos genéricos, devolver como el primer recurso de ese tag disponible
      // o simplemente agregar doblones equivalentes (simplificación)
      // Por ahora, agregamos doblones como compensación
      estadoSimulacion.doblones = (estadoSimulacion.doblones || 0) + cantidadReal;
    } else {
      // Recurso específico
      if (!estadoSimulacion.almacen) estadoSimulacion.almacen = {};
      estadoSimulacion.almacen[recurso] = (estadoSimulacion.almacen[recurso] || 0) + cantidadReal;
    }
  });
}

// =====================================================
// PESTAÑA DE EDIFICIOS
// =====================================================


function controlarPoblacionConstruccion(id, delta) {
  if (typeof asignarPoblacionConstruccion === 'function') {
    const constr = estadoSimulacion.construccionesEnProgreso.find(c => c.id === id);
    if (constr) {
      const current = constr.Trabajadores || constr.poblacionAsignada || 0;
      const newValue = Math.max(0, current + delta);

      // Validar que no se asignen más trabajadores que la población disponible
      if (delta > 0) {
        // Calcular trabajadores disponibles (ociosos)
        const totalPoblacion = estadoSimulacion.poblacion?.length || 0;
        const asignadosARecursos = estadoSimulacion.poblacion?.filter(p => p.asignacion).length || 0;
        const asignadosAConstrucciones = estadoSimulacion.construccionesEnProgreso?.reduce((sum, c) => {
          if (c.id === id) return sum; // No contar la construcción actual
          return sum + (c.Trabajadores || c.poblacionAsignada || 0);
        }, 0) || 0;

        const disponibles = totalPoblacion - asignadosARecursos - asignadosAConstrucciones - current;

        if (disponibles <= 0) {
          mostrarNotificacion('No hay población disponible para asignar', 'error');
          return;
        }
      }

      asignarPoblacionConstruccion(id, newValue);
      actualizarHUD();
    }
  } else {
    console.error('asignarPoblacionConstruccion no está definida');
  }
}

// === HELPERS DE ASIGNACIÓN (NUEVO SISTEMA) ===

function asignarPoblacionRecurso(recurso, delta) {
  if (!estadoSimulacion.poblacion) return;

  if (delta > 0) {
    // Assign: Find one unassigned
    const p = estadoSimulacion.poblacion.find(x => !x.asignacion);
    if (p) {
      p.asignacion = recurso;
      actualizarHUD();
    } else {
      console.log("No hay población ociosa");
      mostrarNotificacion("No hay población ociosa", "error");
    }
  } else {
    // Unassign: Find one assigned to this resource
    const p = estadoSimulacion.poblacion.find(x => x.asignacion === recurso);
    if (p) {
      p.asignacion = null;
      actualizarHUD();
    }
  }
}

function asignarPoblacionEdificio(edificioId, delta, rolRequerido) {
  if (!estadoSimulacion.poblacion) return;

  let token = `edificio_id:${edificioId}`;
  if (edificioId.includes('_legacy_')) {
    const name = edificioId.split('_legacy_')[0];
    token = `edificio:${name}`;
  }

  if (delta > 0) {
    // Find idle worker matching role
    // Check for null, undefined, empty string, or 0 as "no assignment"
    const p = estadoSimulacion.poblacion.find(x =>
      (!x.asignacion || x.asignacion === '' || x.asignacion === null) &&
      (!rolRequerido || rolRequerido === 'Cualquiera' || x.rol === rolRequerido)
    );
    if (p) {
      p.asignacion = token;
      actualizarHUD();
    } else {
      mostrarNotificacion(`No hay población ociosa con rol ${rolRequerido || 'Cualquiera'}`, "error");
    }
  } else {
    // Find worker assigned to this token
    const p = estadoSimulacion.poblacion.find(x => x.asignacion === token);
    if (p) {
      p.asignacion = null;
      actualizarHUD();
    }
  }
}

// Cambiar tipo de inmigración del asentamiento
function cambiarTipoInmigracion(tipo) {
  if (!estadoSimulacion) return;
  estadoSimulacion.tipoInmigracion = tipo;
  actualizarHUD();
}

// Cambiar subtipo para inmigración de Artificiales
function cambiarSubtipoArtificial(subtipo) {
  if (!estadoSimulacion) return;
  estadoSimulacion.subtipoInmigracionArtificial = subtipo;
  actualizarHUD();
}

// =====================================================
// POPULATION EDITING FUNCTIONS
// =====================================================

/**
 * Cambia la naturaleza de una cuota de población
 */
function cambiarNaturalezaPoblacion(id, nuevaNaturaleza) {
  if (!estadoSimulacion?.poblacion) return;

  const cuota = estadoSimulacion.poblacion.find(p => p.id === id);
  if (cuota) {
    cuota.naturaleza = nuevaNaturaleza;
    guardarEstadoAsentamiento();
    mostrarNotificacion(`Cuota #${id} ahora es ${nuevaNaturaleza}`, 'success');
    renderizarPantalla();
  }
}

/**
 * Cambia el rol de una cuota de población
 */
function cambiarRolPoblacion(id, nuevoRol) {
  if (!estadoSimulacion?.poblacion) return;

  const cuota = estadoSimulacion.poblacion.find(p => p.id === id);
  if (cuota) {
    cuota.rol = nuevoRol;
    guardarEstadoAsentamiento();
    mostrarNotificacion(`Cuota #${id} ahora es ${nuevoRol}`, 'success');
    renderizarPantalla();
  }
}

/**
 * Elimina una cuota de población
 */
function eliminarCuotaPoblacion(id) {
  if (!estadoSimulacion?.poblacion) return;

  if (!confirm(`¿Eliminar la cuota #${id}?`)) return;

  const index = estadoSimulacion.poblacion.findIndex(p => p.id === id);
  if (index >= 0) {
    estadoSimulacion.poblacion.splice(index, 1);
    guardarEstadoAsentamiento();
    mostrarNotificacion(`Cuota #${id} eliminada`, 'success');
    renderizarPantalla();
  }
}

/**
 * Agrega una nueva cuota de población
 */
function agregarCuotaPoblacion(naturaleza = 'Neutral', rol = 'Plebeyo') {
  if (!estadoSimulacion?.poblacion) {
    estadoSimulacion.poblacion = [];
  }

  const maxId = estadoSimulacion.poblacion.length > 0
    ? Math.max(...estadoSimulacion.poblacion.map(c => c.id))
    : 0;

  estadoSimulacion.poblacion.push({
    id: maxId + 1,
    rol: rol,
    naturaleza: naturaleza,
    medidas: 20,
    asignacion: null
  });

  guardarEstadoAsentamiento();
  mostrarNotificacion(`Nueva cuota ${naturaleza} agregada`, 'success');
  renderizarPantalla();
}

function renderizarPestanaEdificios(a, stats) {
  const gradoActual = GRADOS[a.grado]?.nivel || 1;

  // === SECCIÓN 0: CONSTRUCCIONES EN PROGRESO ===
  let htmlProgreso = '';
  if (estadoSimulacion.construccionesEnProgreso && estadoSimulacion.construccionesEnProgreso.length > 0) {
    htmlProgreso += `<div class="seccion-progreso"><h3>🚧 Construcciones en Progreso</h3><div class="edificios-grid">`;
    estadoSimulacion.construccionesEnProgreso.forEach(c => {
      const edificio = EDIFICIOS[c.nombre];
      const esMejora = c.esMejora;
      const nombreDisplay = esMejora ? `Mejorando: ${c.nombre}` : `Construyendo: ${c.nombre}`;

      htmlProgreso += `
          <div class="edificio-card en-progreso">
             <div class="edificio-header">
                 <span class="icono">${edificio?.icono || '🔨'}</span>
                 <span class="nombre">${nombreDisplay}</span>
             </div>
             <div class="edificio-body">
                 <div class="barra-progreso-container">
                    <p class="progreso-texto" style="margin:0; padding:0.3rem 0;">Puntos restantes: ${Math.max(0, c.turnosRestantes)} / ${c.turnosTotales}</p>
                    ${c.poblacionAsignada > 0 ? `<p style="font-size:0.8rem; color:#8f8; margin:0;">≈ ${Math.ceil(Math.max(0, c.turnosRestantes) / c.poblacionAsignada)} turno(s) restantes</p>` : `<p style="font-size:0.8rem; color:#fa0; margin:0;">⚠️ Asigna trabajadores para avanzar</p>`}
                 </div>
                 <div class="asignacion-poblacion">
                    <span class="label-trabajadores">👷 Trabajadores: ${c.poblacionAsignada}</span>
                    <div class="botones-asignacion">
                        <button onclick="controlarPoblacionConstruccion('${c.id}', -1)" class="btn-mini" ${c.poblacionAsignada <= 0 ? 'disabled' : ''}>-</button>
                        <button onclick="controlarPoblacionConstruccion('${c.id}', 1)" class="btn-mini">+</button>
                    </div>
                 </div>
                 <small style="color:#aaa; font-style:italic; display:block; margin-top:5px; font-size: 0.75rem;">
                    Cada trabajador avanza 1 punto por turno.
                 </small>
                 <div class="accion-cancelar" style="margin-top:0.5rem; border-top:1px dashed #733; padding-top:0.5rem;">
                    <button class="btn-cancelar-construccion" style="font-size:0.8rem; padding:0.4rem; background:#6b2020; color:#fff; border:1px solid #944; border-radius:4px; cursor:pointer; width:100%;" onclick="cancelarConstruccionEnProgreso('${c.id}')">❌ Cancelar y Reembolsar</button>
                 </div>
             </div>
          </div>
         `;
    });
    htmlProgreso += `</div></div><hr class="separador-seccion">`;
  }

  // === SECCIÓN 1: EDIFICIOS CONSTRUIDOS (INSTANCIAS) ===
  // Migración On-the-fly de strings a objetos (legacy support)
  const edificiosInstancias = (estadoApp.asentamiento.edificios || []).map((e, idx) => {
    if (typeof e === 'string') return { id: `${e}_legacy_${idx}`, nombre: e, receta: null };
    return e;
  });

  let htmlConstruidos = htmlProgreso; // Start with progress section

  if (edificiosInstancias.length > 0) {
    htmlConstruidos += `<div class="seccion-construidos"><h3>🏗️ Edificios Activos</h3><div class="edificios-grid">`;

    edificiosInstancias.forEach(instancia => {
      const edificio = EDIFICIOS[instancia.nombre];
      if (!edificio) return;

      // Control de Trabajadores
      let htmlTrabajadores = '';
      if (edificio.capacidad) {
        let token = `edificio_id:${instancia.id}`;
        if (instancia.id.includes('_legacy_')) token = `edificio:${instancia.nombre}`;

        const count = (estadoSimulacion.poblacion || []).filter(p => p.asignacion === token).length;

        let max = (edificio.capacidad.base || 0);
        if (edificio.capacidad.porGrado) {
          max += ((instancia.grado || 1) - 1) * edificio.capacidad.porGrado;
        }
        const rol = edificio.capacidad.rol || 'Cualquiera';

        htmlTrabajadores = `
            <div class="asignacion-poblacion" style="margin-top:0.5rem; padding: 0.5rem; background:rgba(0,0,0,0.2); border-radius:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="label-trabajadores" title="Rol: ${rol}" style="font-size:0.9rem;">👷 ${count} / ${max}</span>
                    <div class="botones-asignacion btn-group-sm">
                        <button onclick="event.stopPropagation(); asignarPoblacionEdificio('${instancia.id}', -1, '${rol}')" class="btn-mini" ${count <= 0 ? 'disabled' : ''}>-</button>
                        <button onclick="event.stopPropagation(); asignarPoblacionEdificio('${instancia.id}', 1, '${rol}')" class="btn-mini" ${count >= max ? 'disabled' : ''}>+</button>
                    </div>
                </div>
            </div>
          `;
      }

      // Receta Selector
      let htmlReceta = '';
      if (edificio.permiteManufactura) {
        const recetaActual = instancia.receta || '';
        // Buscar recetas
        const recetasDisponibles = [];
        // Check Global RECETAS_MANUFACTURA
        if (typeof RECETAS_MANUFACTURA !== 'undefined') {
          Object.values(RECETAS_MANUFACTURA).forEach(cat => {
            Object.entries(cat).forEach(([key, rec]) => {
              // Check compatibility: generic or specific
              if (!rec.edificio || rec.edificio === instancia.nombre || (rec.edificio === 'Manufactura' && instancia.nombre === 'Taller')) {
                if (rec.opcion_a && rec.opcion_b) {
                  recetasDisponibles.push({
                    k: `${key}:opcion_a`,
                    label: `${rec.opcion_a.output?.Recurso || 'Prod'} (Opción A)`,
                    output: rec.opcion_a.output
                  });
                  recetasDisponibles.push({
                    k: `${key}:opcion_b`,
                    label: `${rec.opcion_b.output?.Recurso || 'Prod'} (Opción B)`,
                    output: rec.opcion_b.output
                  });
                } else {
                  recetasDisponibles.push({ k: key, label: rec.output?.Recurso || 'Prod', ...rec });
                }
              }
            });
          });
        }

        // Selector HTML
        htmlReceta = `<div class="selector-receta">
                    <label>Producción:</label>
                    <select onchange="cambiarReceta('${instancia.id}', this.value)" class="input-receta">
                        <option value="">-- Detenido --</option>
                        ${recetasDisponibles.map(r => `<option value="${r.k}" ${recetaActual === r.k ? 'selected' : ''}>${r.label} (x${r.output?.Cantidad || 10})</option>`).join('')}
                    </select>
                </div>`;
      }

      // Mantenimiento INFO
      let htmlMant = '';
      if (edificio.maintenance || edificio.costoMantenimiento) {
        const mantCost = edificio.costoMantenimiento ? Object.entries(edificio.costoMantenimiento).map(([k, v]) => `${v} ${k}`).join(', ') : `${edificio.maintenance || 0} Doblones`;
        htmlMant = `<div class="info-mantenimiento">💸 Mant: ${mantCost}/turno</div>`;
      }

      htmlConstruidos += `
                <div class="edificio-card construido">
                    <div class="edificio-header">
                        <span class="icono">${edificio.icono}</span>
                        <span class="nombre">${instancia.nombre}</span>
                    </div>
                    ${htmlMant}
                    <div class="edificio-body">
                        ${edificio.descripcion}
                        ${htmlTrabajadores}
                        ${htmlReceta}
                        ${(instancia.grado || 1) < (edificio.maxGrado || 1) && edificio.costesMejora ?
          `<div class="accion-mejora" style="margin-top:0.5rem; border-top:1px dashed #555; padding-top:0.5rem;">
                                <small style="color:#aaa;">Grado ${instancia.grado || 1} / ${edificio.maxGrado}</small><br>
                                <button class="btn-construir" style="font-size:0.8rem; padding:0.4rem;" onclick="mostrarPopupMejora('${instancia.id}')">🔼 Mejorar</button>
                             </div>`
          : ''}
                        <div class="accion-demoler" style="margin-top:0.5rem; border-top:1px dashed #733; padding-top:0.5rem;">
                            <button class="btn-demoler" style="font-size:0.8rem; padding:0.4rem; background:#6b2020; color:#fff; border:1px solid #944; border-radius:4px; cursor:pointer;" onclick="mostrarPopupDemoler('${instancia.id}')">🗑️ Demoler</button>
                        </div>
                    </div>
                </div>
            `;
    });
    htmlConstruidos += `</div></div><hr class="separador-seccion">`;
  }

  // === SECCIÓN 2: MENÚ DE CONSTRUCCIÓN (BLUEPRINTS) ===
  const categorias = {};
  Object.entries(EDIFICIOS).forEach(([nombre, data]) => {
    // Filtrar UNIQUE ya construidos (no multiplicity in v5, check if already built)
    const existingCount = edificiosInstancias.filter(e => e.nombre === nombre).length;
    // Skip if building is already built and can't have multiples (maxGrado <= 1 or not upgradeable)

    const cat = data.tipo || 'Otros';
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push({ nombre, ...data });
  });

  // Ordenar por Tier
  Object.keys(categorias).forEach(k => {
    categorias[k].sort((a, b) => (a.tier || 1) - (b.tier || 1));
  });

  // Función local para renderizar un Bloque de Costos (sea Options o Single)
  const renderCostBlock = (costBlock) => {
    return Object.entries(costBlock).map(([k, v]) => {
      const cantidadReal = v * 10; // Multiplicador 10 visual
      let disponible = 0;
      let label = k;

      if (k === 'Doblones') {
        disponible = estadoSimulacion.doblones || 0;
      } else if (k.startsWith('Cualquier ')) {
        const tag = k.replace('Cualquier ', '');
        disponible = calcularRecursosPorTag(tag);
      } else {
        // Buscar por nombre exacto + fallback por tag
        disponible = (estadoSimulacion.almacen && estadoSimulacion.almacen[k]) || 0;
        if (disponible < cantidadReal) {
          disponible += calcularRecursosPorTag(k);
        }
      }
      return `<span class="tag-coste ${disponible >= cantidadReal ? 'ok' : 'falta'}">${cantidadReal} ${label}</span>`;
    }).join('<span class="separador-mas">+</span>');
  };

  return `
    <div class="panel-edificios">
      <div class="edificios-header">
        <h3>🏗️ Gestión de Edificios</h3>
        <div class="edificios-stats">
          <span class="stat-badge">📊 Grado: ${a.grado}</span>
          <span class="stat-badge">🏠 Total: ${edificiosInstancias.length}</span>
        </div>
      </div>

      ${htmlConstruidos}
      
      <h3>📜 Proyectos Disponibles</h3>
      ${Object.entries(categorias).map(([cat, lista]) => `
          <div class="edificios-tier">
            <h4>${cat}</h4>
            <div class="edificios-grid">
              ${lista.map(edificio => {
    const costesRaw = edificio.costesG1 || [];

    let costesHtml = '';
    let isAffordable = false;

    // costesG1 is always an array of options
    if (Array.isArray(costesRaw) && costesRaw.length > 0) {
      costesHtml = costesRaw.map(opt => `<div class="coste-opcion">${renderCostBlock(opt)}</div>`).join('<div class="separador-opcion">-- Ó --</div>');
      isAffordable = costesRaw.some(opt => checkCostAffordability(opt, 10).length === 0);
    } else {
      costesHtml = '<span class="sin-coste">Sin coste</span>';
      isAffordable = true; // Free to build
    }

    // Verificar Requisitos (requisitos array en v5)
    let requisitosCumplidos = true;
    let mensajeRequisito = '';

    const requisitosArray = edificio.requisitos || [];
    for (const req of requisitosArray) {
      // "Ser un Poblado" / "Ser una Urbe"
      if (req === 'Ser un Poblado' && gradoActual < 2) {
        requisitosCumplidos = false;
        mensajeRequisito = '🔒 Requiere: Ser un Poblado';
        break;
      }
      if (req === 'Ser una Urbe' && gradoActual < 3) {
        requisitosCumplidos = false;
        mensajeRequisito = '🔒 Requiere: Ser una Urbe';
        break;
      }
      // "300 Col." / "600 Col." etc - citizen requirements
      if (req.endsWith(' Col.')) {
        const reqPop = parseInt(req.replace(' Col.', ''));
        const totalPop = estadoSimulacion.poblacion?.reduce((sum, c) => sum + (c.cantidad || 0), 0) || 0;
        if (totalPop < reqPop) {
          requisitosCumplidos = false;
          mensajeRequisito = `🔒 Requiere: ${reqPop} colonos`;
          break;
        }
      }
      // "No tener X"
      if (req.startsWith('No tener ')) {
        const noTener = req.replace('No tener ', '');
        if (edificiosInstancias.some(e => e.nombre === noTener)) {
          requisitosCumplidos = false;
          mensajeRequisito = `🔒 Requiere: ${req}`;
          break;
        }
      }
      // "Mina en Región"
      if (req === 'Mina en Región') {
        const tieneMineria = Object.keys(estadoApp.asentamiento.recursos || {}).some(r =>
          ['Metales', 'Sal', 'Carbón'].includes(r)
        );
        if (!tieneMineria) {
          requisitosCumplidos = false;
          mensajeRequisito = '🔒 Requiere: Mina en Región';
          break;
        }
      }
      // "Costa"
      if (req === 'Costa') {
        const tieneCosta = estadoApp.asentamiento.propiedades?.includes('Costa') ||
          estadoApp.asentamiento.peculiaridades?.includes('Acceso Marítimo');
        if (!tieneCosta) {
          requisitosCumplidos = false;
          mensajeRequisito = '🔒 Requiere: Costa';
          break;
        }
      }
    }

    const canBuild = isAffordable && requisitosCumplidos;

    return `
                    <div class="edificio-card disponible ${!canBuild ? 'bloqueado' : ''}">
                        <div class="edificio-header">
                            <span class="icono">${edificio.icono}</span>
                            <span class="nombre">${edificio.nombre}</span>
                        </div>
                        <div class="edificio-costes-container">
                            <strong>Coste:</strong>
                            <div class="lista-costes">
                                ${costesHtml}
                            </div>
                        </div>
                        <div class="edificio-body">
                           <p>${edificio.descripcion}</p>
                           <p class="efecto">✨ ${edificio.effect || ''}</p>
                           ${!requisitosCumplidos ? `<p class="requisito-faltante">${mensajeRequisito}</p>` : ''}
                           <button class="btn-construir" onclick="mostrarPopupConstruccion('${edificio.nombre}')" ${!requisitosCumplidos ? 'disabled' : ''}>
                               Construir
                           </button>
                        </div>
                    </div>
                  `;
  }).join('')}
            </div>
          </div>
      `).join('')}
    </div>
  `;
}

// =====================================================
// POPUP DE CONSTRUCCIÓN - Selección de Opciones de Coste
// =====================================================

let popupConstruccionActivo = null; // Building name being constructed

function mostrarPopupConstruccion(nombreEdificio) {
  const edificio = EDIFICIOS[nombreEdificio];
  if (!edificio) {
    console.error('Edificio no encontrado:', nombreEdificio);
    return;
  }

  popupConstruccionActivo = nombreEdificio;
  const costesG1 = edificio.costesG1 || [];
  const MULTIPLICADOR = 10;

  // Check affordability for each option
  const opcionesConEstado = costesG1.map((coste, idx) => {
    const asequible = checkCostAffordability(coste, MULTIPLICADOR).length === 0;
    return { coste, idx, asequible };
  });

  // Render cost option for display
  const renderOpcionCoste = (coste, idx, asequible) => {
    const costesHtml = Object.entries(coste).map(([recurso, cantidad]) => {
      const real = cantidad * MULTIPLICADOR;
      let disponible = 0;
      if (recurso === 'Doblones') {
        disponible = estadoSimulacion.doblones || 0;
      } else if (recurso.startsWith('Cualquier ')) {
        const tag = recurso.replace('Cualquier ', '');
        disponible = calcularRecursosPorTag(tag);
      } else {
        disponible = (estadoSimulacion.almacen && estadoSimulacion.almacen[recurso]) || 0;
      }
      const suficiente = disponible >= real;
      return `<span class="recurso-coste ${suficiente ? 'ok' : 'falta'}">${real} ${recurso} (${disponible})</span>`;
    }).join(' <span class="plus">+</span> ');

    return `
      <div class="opcion-coste-popup ${asequible ? '' : 'no-asequible'}">
        <label class="opcion-radio">
          <input type="radio" name="opcionCoste" value="${idx}" ${!asequible ? 'disabled' : ''}>
          <span class="opcion-label">Opción ${idx + 1}</span>
        </label>
        <div class="costes-detalle">${costesHtml}</div>
      </div>
    `;
  };

  const opcionesHtml = opcionesConEstado.length > 0
    ? opcionesConEstado.map(o => renderOpcionCoste(o.coste, o.idx, o.asequible)).join('')
    : '<p class="sin-opciones">Sin coste - construcción gratuita</p>';

  const algunaAsequible = opcionesConEstado.some(o => o.asequible) || opcionesConEstado.length === 0;

  const popupHtml = `
    <div class="modal-overlay" id="modal-construccion" onclick="cerrarPopupConstruccion(event)">
      <div class="modal-popup" onclick="event.stopPropagation()">
        <div class="modal-header">
          <span class="modal-icono">${edificio.icono}</span>
          <h3>Construir ${nombreEdificio}</h3>
          <button class="btn-cerrar" onclick="cerrarPopupConstruccion()">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">${edificio.descripcion}</p>
          <p class="modal-efecto">✨ ${edificio.effect || ''}</p>
          <p class="modal-turnos">⏱️ Turnos de construcción: ${edificio.turnos || 1}</p>
          <hr>
          <h4>Elige una opción de coste:</h4>
          <div class="opciones-coste-lista">
            ${opcionesHtml}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancelar" onclick="cerrarPopupConstruccion()">Cancelar</button>
          <button class="btn-confirmar" onclick="confirmarConstruccion()" ${!algunaAsequible ? 'disabled' : ''}>
            Confirmar Construcción
          </button>
        </div>
      </div>
    </div>
  `;

  // Insert modal into DOM
  document.body.insertAdjacentHTML('beforeend', popupHtml);
}

function cerrarPopupConstruccion(event) {
  if (event && event.target.id !== 'modal-construccion') return;
  const modal = document.getElementById('modal-construccion');
  if (modal) modal.remove();
  popupConstruccionActivo = null;
}

function confirmarConstruccion() {
  if (!popupConstruccionActivo) return;

  const edificio = EDIFICIOS[popupConstruccionActivo];
  if (!edificio) return;

  const costesG1 = edificio.costesG1 || [];
  const MULTIPLICADOR = 10;

  // Get selected option
  const selectedRadio = document.querySelector('input[name="opcionCoste"]:checked');
  let opcionElegida = null;

  if (costesG1.length === 0) {
    // Free building
    opcionElegida = {};
  } else if (selectedRadio) {
    const idx = parseInt(selectedRadio.value);
    opcionElegida = costesG1[idx];
  } else {
    // No option selected - try to find first affordable
    for (const coste of costesG1) {
      if (checkCostAffordability(coste, MULTIPLICADOR).length === 0) {
        opcionElegida = coste;
        break;
      }
    }
  }

  if (!opcionElegida && costesG1.length > 0) {
    alert('❌ Selecciona una opción de coste asequible.');
    return;
  }

  // Consume resources
  if (Object.keys(opcionElegida).length > 0) {
    consumeCostBlock(opcionElegida, MULTIPLICADOR);
  }

  // Iniciar Construcción (simulada)
  const turnos = edificio.turnos || 1;
  if (typeof iniciarConstruccion === 'function') {
    iniciarConstruccion(popupConstruccionActivo, opcionElegida, turnos, false, null);
  } else {
    console.error('iniciarConstruccion no está definida');
  }

  cerrarPopupConstruccion();
  actualizarHUD();
  console.log(`🏗️ Construcción iniciada: ${popupConstruccionActivo}`);
  mostrarNotificacion(`🏗️ Construcción iniciada: ${popupConstruccionActivo}`);
}

function renderizarListaCuotasPoblacion() {
  if (!estadoSimulacion || !estadoSimulacion.poblacion) return '<p>No hay población</p>';

  const cuotas = estadoSimulacion.poblacion;
  const recursosDisponibles = Object.keys(EDIFICIOS).length > 0 ? Object.keys(estadoApp.asentamiento.recursos || {}) : [];

  const edificiosConstruidos = estadoApp.asentamiento.edificios || [];

  // Prepare list of assignable targets
  const assignableTargets = [];
  const genericBuildingsHandled = new Set();

  edificiosConstruidos.forEach((ed, idx) => {
    // Handle string/legacy format on the fly
    const nombre = typeof ed === 'string' ? ed : ed.nombre;
    const item = typeof ed === 'string' ? { id: `${ed}_legacy_${idx}`, nombre: ed, receta: null } : ed;

    // Safety check
    if (!EDIFICIOS[nombre]) return;
    const def = EDIFICIOS[nombre];

    // Check if it has capacity (job slots)
    // We check base capacity here. Simulation checks actual capacity with grade.
    if (def.capacidad || (def.produccionTrabajo && !def.produccionTrabajo.condicion)) {
      if (def.permiteManufactura) {
        // Instance-specific assignment
        const recetaKey = item.receta;
        let recetaLabel = 'Sin receta';

        // Try to resolve recipe label
        if (recetaKey && typeof RECETAS_MANUFACTURA !== 'undefined') {
          // Determine raw key and option if compound
          let rawKey = recetaKey;
          let option = null;
          if (recetaKey.includes(':')) {
            [rawKey, option] = recetaKey.split(':');
          }

          // Search for label
          for (const cat of Object.values(RECETAS_MANUFACTURA)) {
            if (cat[rawKey]) {
              const rec = cat[rawKey];
              if (option && rec[option]) {
                recetaLabel = rec[option].output?.Recurso || 'Produciendo';
              } else {
                recetaLabel = rec.output?.Recurso || 'Produciendo';
              }
              break;
            }
          }
        }

        assignableTargets.push({
          label: `🏭 ${nombre} #${idx + 1} (${recetaLabel})`,
          value: `edificio_id:${item.id}`
        });
      } else {
        // Generic assignment (group by type)
        if (!genericBuildingsHandled.has(nombre)) {
          assignableTargets.push({
            label: `🏭 ${nombre}`,
            value: `edificio:${nombre}`
          });
          genericBuildingsHandled.add(nombre);
        }
      }
    }
  });

  return cuotas.map(cuota => {
    const rolData = ROLES_POBLACION[cuota.rol];
    const asignado = cuota.asignacion;

    // Resolve Display Label for Assignment
    let asignadoDisplay = '';
    if (asignado) {
      if (asignado.startsWith('edificio_id:')) {
        const id = asignado.replace('edificio_id:', '');
        // Find specific instance
        const edificiosConstruidos = estadoApp.asentamiento.edificios || [];
        const inst = edificiosConstruidos.find(e => typeof e === 'object' && e.id === id);
        if (inst) {
          let recipeLabel = '';
          // Resolve Recipe Name
          if (inst.receta && typeof RECETAS_MANUFACTURA !== 'undefined') {
            let rawKey = inst.receta;
            let option = null;
            if (rawKey.includes(':')) { [rawKey, option] = rawKey.split(':'); }

            for (const cat of Object.values(RECETAS_MANUFACTURA)) {
              if (cat[rawKey]) {
                const rec = cat[rawKey];
                if (option && rec[option]) {
                  recipeLabel = rec[option].output?.Recurso;
                } else {
                  recipeLabel = rec.output?.Recurso;
                }
                break;
              }
            }
          }
          const detail = recipeLabel ? `(${recipeLabel})` : `#${id.substr(-3)}`;
          asignadoDisplay = `🏭 ${inst.nombre} ${detail}`;
        } else {
          asignadoDisplay = `🏭 Manufactura (ID:${id})`; // Fallback
        }
      } else if (asignado.startsWith('edificio:')) {
        asignadoDisplay = `🏭 ${asignado.replace('edificio:', '')}`;
      } else {
        asignadoDisplay = `⛏️ ${asignado}`;
      }
    }

    // Select HTML
    let selectHTML = `<select class="select-trabajo" onchange="asignarTrabajoDesdeUI(${cuota.id}, this.value)">`;
    selectHTML += `<option value="" ${!asignado ? 'selected' : ''}>-- Ocioso --</option>`;

    // Resources
    selectHTML += `<optgroup label="Bioma">`;
    recursosDisponibles.forEach(r => {
      selectHTML += `<option value="${r}" ${asignado === r ? 'selected' : ''}>⛏️ ${r}</option>`;
    });
    selectHTML += `</optgroup>`;

    // Buildings
    if (assignableTargets.length > 0) {
      selectHTML += `<optgroup label="Edificios">`;
      assignableTargets.forEach(target => {
        selectHTML += `<option value="${target.value}" ${asignado === target.value ? 'selected' : ''}>${target.label}</option>`;
      });
      selectHTML += `</optgroup>`;
    }

    selectHTML += `</select>`;

    return `
        <div class="cuota-card-hud ${asignado ? 'asignado' : 'ocioso'}">
            <div class="cuota-info">
                <span class="cuota-icono">${rolData?.icono || '👤'}</span>
                <div>
                   <div class="cuota-rol">${cuota.rol} <small>(${cuota.naturaleza})</small></div>
                   <div class="cuota-medidas">20 Colonos ${asignado ? `Trabajando en <br><strong>${asignadoDisplay}</strong>` : 'Ociosos'}</div>
                </div>
            </div>
            <div class="cuota-accion">
                ${selectHTML}
            </div>
        </div>
    `;
  }).join('');
}

function calcularBonificadoresEdificios(edificiosConstruidos) {
  const bonificadores = {};
  // Handle strings (v1) and objects (v2)
  edificiosConstruidos.forEach(item => {
    const nombre = (typeof item === 'string') ? item : item.nombre;
    const edificio = EDIFICIOS[nombre];
    if (edificio && edificio.efectos) {
      Object.entries(edificio.efectos).forEach(([stat, valor]) => {
        if (typeof valor === 'number') {
          bonificadores[stat] = (bonificadores[stat] || 0) + valor;
        }
      });
    }
  });
  return bonificadores;
}

function construirEdificio(nombre) {
  const edificio = EDIFICIOS[nombre];
  if (!edificio) { mostrarError('Edificio no encontrado'); return; }

  const costesRaw = edificio.costes || {};
  const MULTIPLICADOR_COSTES = 10;

  // Determinar qué opción de coste usar
  let opcionElegida = null;

  if (Array.isArray(costesRaw)) {
    // Buscar primera opción asequible
    for (const opt of costesRaw) {
      const missing = checkCostAffordability(opt, MULTIPLICADOR_COSTES);
      if (missing.length === 0) {
        opcionElegida = opt;
        break;
      }
    }
    if (!opcionElegida) {
      // Mostrar error de la primera opción como referencia
      const missing = checkCostAffordability(costesRaw[0], MULTIPLICADOR_COSTES);
      mostrarError(`Faltan recursos (Opción 1): ${missing.join(', ')}`);
      return;
    }
  } else {
    const missing = checkCostAffordability(costesRaw, MULTIPLICADOR_COSTES);
    if (missing.length > 0) {
      mostrarError(`Faltan recursos: ${missing.join(', ')}`);
      return;
    }
    opcionElegida = costesRaw;
  }

  // Ejecutar Consumo
  consumeCostBlock(opcionElegida, MULTIPLICADOR_COSTES);

  // Crear Instancia (Objeto)
  if (!estadoApp.asentamiento.edificios) { estadoApp.asentamiento.edificios = []; }

  const nuevaInstancia = {
    id: `${nombre}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    nombre: nombre,
    receta: null
  };

  estadoApp.asentamiento.edificios.push(nuevaInstancia);

  guardarExpedicion();
  mostrarNotificacion(`✅ ${nombre} construido`);
  renderizarPantalla();
}

function cambiarReceta(instanceId, nuevaReceta) {
  console.log('cambiarReceta called:', instanceId, nuevaReceta);

  const list = estadoApp.asentamiento?.edificios || [];
  let inst = list.find(e => (typeof e === 'string' ? false : e.id === instanceId));

  // Handle legacy format: "NombreEdificio_legacy_INDEX"
  if (!inst && instanceId.includes('_legacy_')) {
    const parts = instanceId.split('_legacy_');
    const nombre = parts[0];
    const idx = parseInt(parts[1]);

    // Check if the item at that index is a string matching the name
    if (list[idx] === nombre) {
      // Convert legacy string to object
      inst = {
        id: `${nombre}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        nombre: nombre,
        grado: 1,
        receta: null
      };

      // Replace the string with the object in the list
      list[idx] = inst;

      console.log('Converted legacy building to object:', inst);
    }
  }

  console.log('Instance found:', inst);

  if (inst) {
    inst.receta = nuevaReceta || null;  // Ensure null if empty string

    // Sincronizar con el estado de simulación explícitamente
    if (!estadoSimulacion.edificiosEstado) {
      estadoSimulacion.edificiosEstado = {};
    }

    estadoSimulacion.edificiosEstado[inst.id] = {
      grado: inst.grado || 1,
      recetaActual: nuevaReceta || null,
      activo: !!nuevaReceta
    };

    guardarExpedicion();
    renderizarPantalla();

    if (nuevaReceta) {
      mostrarNotificacion(`🏭 Receta seleccionada`, 'info');
    }
  } else {
    console.error('Instance not found for id:', instanceId);
    mostrarNotificacion('⚠️ Error: No se encontró el edificio', 'error');
  }
}

// =====================================================
// POPUP DE MEJORA - Selección de Opciones de Coste
// =====================================================

let popupMejoraActivo = null;

function mostrarPopupMejora(instanciaId) {
  let instancia = (estadoApp.asentamiento.edificios || []).find(e => (typeof e !== 'string' && e.id === instanciaId));

  // Handle Legacy Strings Conversion
  if (!instancia && instanciaId.includes('_legacy_')) {
    const parts = instanciaId.split('_legacy_');
    const name = parts[0];
    const idx = parseInt(parts[1]);

    if (estadoApp.asentamiento.edificios && estadoApp.asentamiento.edificios[idx] === name) {
      // Convert to object in place
      instancia = {
        id: `${name}_${Date.now()}_converted`,
        nombre: name,
        grado: 1,
        receta: null
      };
      estadoApp.asentamiento.edificios[idx] = instancia;

      // Initialize state
      if (!estadoSimulacion.edificiosEstado) estadoSimulacion.edificiosEstado = {};
      estadoSimulacion.edificiosEstado[instancia.id] = { grado: 1, activo: true };

      guardarExpedicion();
      // We don't re-render immediately to avoid disrupting the flow, 
      // but next render will show the object correctly.
    }
  }

  if (!instancia) {
    console.error('Instancia no encontrada:', instanciaId);
    return;
  }

  const edificio = EDIFICIOS[instancia.nombre];
  if (!edificio) return;

  popupMejoraActivo = instancia.id;
  const costesMejora = edificio.costesMejora || [];
  const gradoActual = instancia.grado || 1;
  const gradoObjetivo = gradoActual + 1; // El grado AL QUE se está mejorando
  const MULTIPLICADOR = 10 * gradoObjetivo; // Coste = base × 10 × grado objetivo

  const opcionesConEstado = costesMejora.map((coste, idx) => {
    const asequible = checkCostAffordability(coste, MULTIPLICADOR).length === 0;
    return { coste, idx, asequible };
  });

  const renderOpcionCoste = (coste, idx, asequible) => {
    const costesHtml = Object.entries(coste).map(([recurso, cantidad]) => {
      const real = cantidad * MULTIPLICADOR;
      let disponible = 0;
      if (recurso === 'Doblones') {
        disponible = estadoSimulacion.doblones || 0;
      } else if (recurso.startsWith('Cualquier ')) {
        const tag = recurso.replace('Cualquier ', '');
        disponible = calcularRecursosPorTag(tag);
      } else {
        // Buscar por nombre exacto + fallback por tag
        disponible = (estadoSimulacion.almacen && estadoSimulacion.almacen[recurso]) || 0;
        disponible += calcularRecursosPorTag(recurso);
      }
      const suficiente = disponible >= real;
      return `<span class="recurso-coste ${suficiente ? 'ok' : 'falta'}">${real} ${recurso} (${disponible})</span>`;
    }).join(' <span class="plus">+</span> ');

    return `
      <div class="opcion-coste-popup ${asequible ? '' : 'no-asequible'}">
        <label class="opcion-radio">
          <input type="radio" name="opcionCosteMejora" value="${idx}" ${!asequible ? 'disabled' : ''}>
          <span class="opcion-label">Opción ${idx + 1}</span>
        </label>
        <div class="costes-detalle">${costesHtml}</div>
      </div>
    `;
  };

  const opcionesHtml = opcionesConEstado.length > 0
    ? opcionesConEstado.map(o => renderOpcionCoste(o.coste, o.idx, o.asequible)).join('')
    : '<p class="sin-opciones">Sin coste de mejora</p>';

  const algunaAsequible = opcionesConEstado.some(o => o.asequible) || opcionesConEstado.length === 0;

  const modalId = 'modal-mejora';
  if (document.getElementById(modalId)) document.getElementById(modalId).remove();

  const popupHtml = `
    <div class="modal-overlay" id="${modalId}" onclick="cerrarPopupMejora(event)">
      <div class="modal-popup" onclick="event.stopPropagation()">
        <div class="modal-header">
          <span class="modal-icono">${edificio.icono}</span>
          <h3>Mejorar ${instancia.nombre} (Grado ${instancia.grado || 1} ➔ ${(instancia.grado || 1) + 1})</h3>
          <button class="btn-cerrar" onclick="cerrarPopupMejora()">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-desc">Mejora este edificio para aumentar sus beneficios.</p>
          <hr>
          <h4>Coste de Mejora:</h4>
          <div class="opciones-coste-lista">
            ${opcionesHtml}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancelar" onclick="cerrarPopupMejora()">Cancelar</button>
          <button class="btn-confirmar" onclick="confirmarMejora()" ${!algunaAsequible ? 'disabled' : ''}>
            Confirmar Mejora
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', popupHtml);
}

function cerrarPopupMejora(event) {
  if (event && event.target.id !== 'modal-mejora') return;
  const modal = document.getElementById('modal-mejora');
  if (modal) modal.remove();
  popupMejoraActivo = null;
}

function confirmarMejora() {
  if (!popupMejoraActivo) return;

  const instancia = (estadoApp.asentamiento.edificios || []).find(e => e.id === popupMejoraActivo);
  if (!instancia) return;

  const edificio = EDIFICIOS[instancia.nombre];
  if (!edificio) return;

  const costesMejora = edificio.costesMejora || [];
  const gradoActual = instancia.grado || 1;
  const gradoObjetivo = gradoActual + 1; // El grado AL QUE se está mejorando
  const MULTIPLICADOR = 10 * gradoObjetivo; // Coste = base × 10 × grado objetivo

  const selectedRadio = document.querySelector('input[name="opcionCosteMejora"]:checked');
  let opcionElegida = null;

  if (costesMejora.length === 0) {
    opcionElegida = {};
  } else if (selectedRadio) {
    const idx = parseInt(selectedRadio.value);
    opcionElegida = costesMejora[idx];
  } else {
    // Auto-select first affordable
    for (const coste of costesMejora) {
      if (checkCostAffordability(coste, MULTIPLICADOR).length === 0) {
        opcionElegida = coste;
        break;
      }
    }
  }

  if (!opcionElegida && costesMejora.length > 0) {
    alert('❌ Selecciona una opción de coste.');
    return;
  }

  if (Object.keys(opcionElegida).length > 0) {
    consumeCostBlock(opcionElegida, MULTIPLICADOR);
  }

  // Iniciar Mejora (simulada)
  const turnos = edificio.turnos || 1;
  if (typeof iniciarConstruccion === 'function') {
    iniciarConstruccion(instancia.nombre, opcionElegida, turnos, true, popupMejoraActivo);
  }

  cerrarPopupMejora();
  actualizarHUD();
  mostrarNotificacion(`🏗️ Mejora iniciada para ${instancia.nombre}`);
}

// =====================================================
// POPUP DE DEMOLICIÓN - Deshacer Construcciones
// =====================================================

let popupDemolerActivo = null;

function mostrarPopupDemoler(instanciaId) {
  let instancia = (estadoApp.asentamiento.edificios || []).find(e => (typeof e !== 'string' && e.id === instanciaId));

  // Handle Legacy Strings Conversion
  if (!instancia && instanciaId.includes('_legacy_')) {
    const parts = instanciaId.split('_legacy_');
    const name = parts[0];
    const idx = parseInt(parts[1]);

    if (estadoApp.asentamiento.edificios && estadoApp.asentamiento.edificios[idx] === name) {
      instancia = {
        id: instanciaId,
        nombre: name,
        grado: 1,
        receta: null
      };
    }
  }

  if (!instancia) {
    console.error('Instancia no encontrada para demoler:', instanciaId);
    mostrarNotificacion('⚠️ Error: Edificio no encontrado', 'error');
    return;
  }

  const edificio = EDIFICIOS[instancia.nombre];
  if (!edificio) {
    mostrarNotificacion('⚠️ Error: Definición de edificio no encontrada', 'error');
    return;
  }

  popupDemolerActivo = instanciaId;

  // Obtener el coste original del edificio (primera opción disponible)
  const costesG1 = edificio.costesG1 || [];
  const MULTIPLICADOR = 10;

  // Calcular recursos a devolver (primera opción de coste como referencia)
  let recursosADevolver = '';
  if (costesG1.length > 0) {
    const primerCoste = costesG1[0];
    recursosADevolver = Object.entries(primerCoste).map(([recurso, cantidad]) => {
      const cantidadReal = cantidad * MULTIPLICADOR;
      return `<span class="recurso-refund">${cantidadReal} ${recurso}</span>`;
    }).join(' + ');
  } else {
    recursosADevolver = '<span class="sin-coste">Sin recursos a devolver</span>';
  }

  // Contar trabajadores asignados
  let trabajadoresAsignados = 0;
  const tokenId = `edificio_id:${instanciaId}`;
  const tokenNombre = `edificio:${instancia.nombre}`;

  if (estadoSimulacion.poblacion) {
    trabajadoresAsignados = estadoSimulacion.poblacion.filter(p =>
      p.asignacion === tokenId || p.asignacion === tokenNombre
    ).length;
  }

  const modalId = 'modal-demoler';
  if (document.getElementById(modalId)) document.getElementById(modalId).remove();

  const popupHtml = `
    <div class="modal-overlay" id="${modalId}" onclick="cerrarPopupDemoler(event)">
      <div class="modal-popup" onclick="event.stopPropagation()" style="border-color: #944;">
        <div class="modal-header" style="background: linear-gradient(135deg, #6b2020 0%, #3d1515 100%);">
          <span class="modal-icono">${edificio.icono}</span>
          <h3>Demoler ${instancia.nombre}</h3>
          <button class="btn-cerrar" onclick="cerrarPopupDemoler()">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-desc" style="color: #ffaaaa;">⚠️ ¿Estás seguro de que quieres demoler este edificio?</p>
          <p class="modal-info">Esta acción eliminará el edificio y devolverá los recursos invertidos.</p>
          <hr>
          <h4>📦 Recursos a recuperar:</h4>
          <div class="recursos-refund-lista" style="padding: 0.5rem; background: rgba(0,100,0,0.2); border-radius: 4px; margin: 0.5rem 0;">
            ${recursosADevolver}
          </div>
          ${trabajadoresAsignados > 0 ? `
            <p class="modal-warning" style="color: #ffcc00; margin-top: 0.5rem;">
              👷 ${trabajadoresAsignados} cuota(s) de población serán desasignadas.
            </p>
          ` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn-cancelar" onclick="cerrarPopupDemoler()">Cancelar</button>
          <button class="btn-confirmar" style="background: #8b0000; border-color: #aa2020;" onclick="confirmarDemoler()">
            🗑️ Confirmar Demolición
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', popupHtml);
}

function cerrarPopupDemoler(event) {
  if (event && event.target.id !== 'modal-demoler') return;
  const modal = document.getElementById('modal-demoler');
  if (modal) modal.remove();
  popupDemolerActivo = null;
}

function confirmarDemoler() {
  if (!popupDemolerActivo) return;

  const instanciaId = popupDemolerActivo;
  const edificios = estadoApp.asentamiento.edificios || [];

  // Buscar la instancia
  let instanciaIdx = -1;
  let instancia = null;

  for (let i = 0; i < edificios.length; i++) {
    const e = edificios[i];
    if (typeof e === 'string') {
      // Legacy format
      const legacyId = `${e}_legacy_${i}`;
      if (legacyId === instanciaId) {
        instanciaIdx = i;
        instancia = { id: legacyId, nombre: e };
        break;
      }
    } else if (e.id === instanciaId) {
      instanciaIdx = i;
      instancia = e;
      break;
    }
  }

  if (instanciaIdx === -1 || !instancia) {
    mostrarNotificacion('⚠️ Error: Edificio no encontrado', 'error');
    cerrarPopupDemoler();
    return;
  }

  const edificio = EDIFICIOS[instancia.nombre];
  if (!edificio) {
    mostrarNotificacion('⚠️ Error: Definición no encontrada', 'error');
    cerrarPopupDemoler();
    return;
  }

  // 1. Devolver recursos (primera opción de coste)
  const costesG1 = edificio.costesG1 || [];
  const MULTIPLICADOR = 10;

  if (costesG1.length > 0) {
    refundCostBlock(costesG1[0], MULTIPLICADOR);
  }

  // 2. Desasignar trabajadores
  const tokenId = `edificio_id:${instanciaId}`;
  const tokenNombre = `edificio:${instancia.nombre}`;

  if (estadoSimulacion.poblacion) {
    estadoSimulacion.poblacion.forEach(cuota => {
      if (cuota.asignacion === tokenId || cuota.asignacion === tokenNombre) {
        cuota.asignacion = null;
      }
    });
  }

  // 3. Eliminar el edificio de la lista
  estadoApp.asentamiento.edificios.splice(instanciaIdx, 1);

  // 4. Eliminar el estado del edificio
  if (estadoSimulacion.edificiosEstado && estadoSimulacion.edificiosEstado[instanciaId]) {
    delete estadoSimulacion.edificiosEstado[instanciaId];
  }

  // 5. Guardar y actualizar UI
  guardarExpedicion();
  cerrarPopupDemoler();
  actualizarHUD();

  mostrarNotificacion(`🗑️ ${instancia.nombre} demolido. Recursos devueltos.`, 'success');
  console.log(`🗑️ Edificio demolido: ${instancia.nombre} (ID: ${instanciaId})`);
}

// =====================================================
// CANCELAR CONSTRUCCIÓN EN PROGRESO
// =====================================================

/**
 * Cancela una construcción en progreso y devuelve los recursos invertidos
 * @param {string} construccionId - ID de la construcción a cancelar
 */
function cancelarConstruccionEnProgreso(construccionId) {
  if (!estadoSimulacion.construccionesEnProgreso) return;

  const idx = estadoSimulacion.construccionesEnProgreso.findIndex(c => c.id === construccionId);
  if (idx === -1) {
    mostrarNotificacion('⚠️ Construcción no encontrada', 'error');
    return;
  }

  const construccion = estadoSimulacion.construccionesEnProgreso[idx];

  // Confirmar cancelación
  const edificio = EDIFICIOS[construccion.nombre];
  const nombreDisplay = construccion.esMejora ? `mejora de ${construccion.nombre}` : construccion.nombre;

  if (!confirm(`¿Cancelar la construcción de ${nombreDisplay}?\n\nLos recursos invertidos serán devueltos.`)) {
    return;
  }

  // 1. Devolver recursos usando el coste almacenado
  const MULTIPLICADOR = 10;
  if (construccion.costoOpcion && Object.keys(construccion.costoOpcion).length > 0) {
    refundCostBlock(construccion.costoOpcion, MULTIPLICADOR);

    // Log de recursos devueltos
    const recursosDevueltos = Object.entries(construccion.costoOpcion)
      .map(([r, c]) => `${c * MULTIPLICADOR} ${r}`)
      .join(', ');
    console.log(`📦 Recursos devueltos: ${recursosDevueltos}`);
  }

  // 2. Eliminar de la cola de construcciones
  estadoSimulacion.construccionesEnProgreso.splice(idx, 1);

  // 3. Guardar y actualizar UI
  guardarExpedicion();
  actualizarHUD();

  mostrarNotificacion(`❌ Construcción de ${nombreDisplay} cancelada. Recursos devueltos.`, 'success');
  console.log(`❌ Construcción cancelada: ${construccion.nombre} (ID: ${construccionId})`);
}

// =====================================================
// FUNCIONES DE DEVOCIÓN
// =====================================================

/**
 * Convierte un Plebeyo en Devoto del tipo seleccionado
 */
function convertirPlebeyoADevoto() {
  if (!estadoSimulacion.poblacion) return;

  // Obtener el tipo de devoción seleccionado
  const selectTipo = document.getElementById('select-tipo-devoto');
  const tipoDevocion = selectTipo?.value || 'Neutral';

  // Buscar un Plebeyo para convertir (preferir uno de la misma naturaleza)
  let plebeyo = estadoSimulacion.poblacion.find(c =>
    c.rol === 'Plebeyo' && c.naturaleza === tipoDevocion
  );

  // Si no hay de esa naturaleza, buscar cualquier plebeyo
  if (!plebeyo) {
    plebeyo = estadoSimulacion.poblacion.find(c => c.rol === 'Plebeyo');
  }

  if (!plebeyo) {
    mostrarNotificacion('⚠️ No hay Plebeyos disponibles para convertir', 'error');
    return;
  }

  // Verificar que la naturaleza puede tener devoción
  const natData = typeof NATURALEZAS_POBLACION !== 'undefined' ? NATURALEZAS_POBLACION[plebeyo.naturaleza] : null;
  if (natData?.puedeDevocion === false) {
    mostrarNotificacion(`⚠️ Las cuotas ${plebeyo.naturaleza} no pueden tener devoción`, 'error');
    return;
  }

  // Convertir
  plebeyo.rol = 'Devoto';

  // Si la naturaleza es diferente al tipo de devoción seleccionado, ajustar
  // (Monstruos generan devoción Salvaje automáticamente según la UI)

  guardarExpedicion();
  actualizarHUD();

  const tipoData = typeof TIPOS_DEVOCION !== 'undefined' ? TIPOS_DEVOCION[tipoDevocion] : null;
  mostrarNotificacion(`🙏 Plebeyo convertido a Devoto ${tipoData?.icono || ''} ${tipoDevocion}`, 'success');
}

/**
 * Activa el Pacto Sincrético entre las dos devociones activas
 */
function pactarSincretismo() {
  if (!estadoSimulacion.estadoDevocion) return;

  const devocion = estadoSimulacion.estadoDevocion;

  // Verificar que no hay sacrilegio
  if (devocion.sacrilegio) {
    mostrarNotificacion('❌ No se puede pactar sincretismo durante Sacrilegio', 'error');
    return;
  }

  // Obtener tipos activos (con devotos)
  const devotosPorTipo = { Positiva: 0, Negativa: 0, Neutral: 0, Salvaje: 0 };
  estadoSimulacion.poblacion?.forEach(c => {
    if (c.rol === 'Devoto') {
      const tipoNat = c.naturaleza || 'Neutral';
      if (tipoNat === 'Monstruo') {
        devotosPorTipo['Salvaje']++;
      } else if (devotosPorTipo[tipoNat] !== undefined) {
        devotosPorTipo[tipoNat]++;
      }
    }
  });

  const tiposActivos = Object.entries(devotosPorTipo)
    .filter(([_, count]) => count > 0)
    .map(([tipo, _]) => tipo);

  if (tiposActivos.length < 2) {
    mostrarNotificacion('⚠️ Se requieren 2 devociones activas para sincretismo', 'error');
    return;
  }

  // Verificar que las dos primeras no son opuestas
  const tipo1 = tiposActivos[0];
  const tipo2 = tiposActivos[1];

  const sonOpuestos = typeof sonDevocioneOpuestas === 'function'
    ? sonDevocioneOpuestas(tipo1, tipo2)
    : (TIPOS_DEVOCION[tipo1]?.opuesto === tipo2);

  if (sonOpuestos) {
    mostrarNotificacion('❌ No se puede sincretizar devociones opuestas', 'error');
    return;
  }

  // Activar sincretismo
  devocion.isSyncretic = true;
  devocion.syncreticTypes = [tipo1, tipo2];

  guardarExpedicion();
  actualizarHUD();

  const t1 = TIPOS_DEVOCION[tipo1];
  const t2 = TIPOS_DEVOCION[tipo2];
  mostrarNotificacion(`🤝 Sincretismo pactado: ${t1?.icono || ''} ${tipo1} + ${t2?.icono || ''} ${tipo2}`, 'success');
}

/**
 * Rompe el Pacto Sincrético activo
 */
function romperSincretismo() {
  if (!estadoSimulacion.estadoDevocion) return;

  const devocion = estadoSimulacion.estadoDevocion;

  if (!devocion.isSyncretic) {
    mostrarNotificacion('⚠️ No hay sincretismo activo', 'error');
    return;
  }

  devocion.isSyncretic = false;
  devocion.syncreticTypes = [];

  guardarExpedicion();
  actualizarHUD();

  mostrarNotificacion('💔 Sincretismo disuelto', 'warning');
}

/**
 * Invoca un milagro, consumiendo puntos del pool correspondiente
 * @param {string} tipoDevocion - Tipo de devoción (Positiva, Negativa, etc.)
 * @param {string} nombreMilagro - Nombre del milagro a invocar
 */
function invocarMilagro(tipoDevocion, nombreMilagro) {
  if (!estadoSimulacion.estadoDevocion) return;

  const devocion = estadoSimulacion.estadoDevocion;
  const milagrosTipo = typeof MILAGROS !== 'undefined' ? MILAGROS[tipoDevocion] : null;
  const milagro = milagrosTipo?.[nombreMilagro];

  if (!milagro) {
    mostrarNotificacion('⚠️ Milagro no encontrado', 'error');
    return;
  }

  // Calcular coste ajustado
  let modCoste = 0;
  if (devocion.sacrilegio) modCoste += 20;
  if (devocion.isSyncretic) modCoste -= 20;
  const costeAjustado = milagro.coste + modCoste;

  // Verificar pool
  const pool = devocion.poolPorTipo[tipoDevocion] || 0;
  if (pool < costeAjustado) {
    mostrarNotificacion(`❌ Puntos insuficientes (${pool}/${costeAjustado})`, 'error');
    return;
  }

  // Verificar grado
  const totalDevotos = estadoSimulacion.poblacion?.filter(c => c.rol === 'Devoto').length || 0;
  const gradoDevocion = typeof calcularGradoDevocion === 'function'
    ? calcularGradoDevocion(totalDevotos)
    : (totalDevotos >= 300 ? 3 : totalDevotos >= 60 ? 2 : 1);

  if (milagro.grado > gradoDevocion) {
    mostrarNotificacion(`🔒 Grado de fe insuficiente (${gradoDevocion}/${milagro.grado})`, 'error');
    return;
  }

  // Consumir puntos
  devocion.poolPorTipo[tipoDevocion] -= costeAjustado;

  // Registrar en log de eventos (si existe el sistema)
  if (estadoApp.asentamiento && !estadoApp.asentamiento.historialEventos) {
    estadoApp.asentamiento.historialEventos = [];
  }
  if (estadoApp.asentamiento?.historialEventos) {
    estadoApp.asentamiento.historialEventos.push({
      tipo: 'Milagro',
      descripcion: `${nombreMilagro}: ${milagro.efecto}`,
      turno: estadoSimulacion.turno
    });
  }

  guardarExpedicion();
  actualizarHUD();

  const tipoData = typeof TIPOS_DEVOCION !== 'undefined' ? TIPOS_DEVOCION[tipoDevocion] : null;
  mostrarNotificacion(`✨ ¡Milagro invocado! ${tipoData?.icono || ''} ${nombreMilagro}`, 'success');
  console.log(`✨ Milagro: ${nombreMilagro} (${tipoDevocion}) - Coste: ${costeAjustado}, Efecto: ${milagro.efecto}`);
}



// =====================================================
// FUNCIONES RESTAURADAS Y NUEVAS
// =====================================================

// === INDIVIDUAL SETTLEMENT EXPORT ===
function exportarAsentamientoIndividual(id) {
  const asentamiento = estadoApp.expedicion.asentamientos.find(function (a) { return a.id === id; });
  if (!asentamiento) {
    alert("Asentamiento no encontrado");
    return;
  }

  const data = {
    asentamientos: [asentamiento],
    exportedAt: new Date().toISOString(),
    expedicionNombre: estadoApp.expedicion.nombre
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'asentamiento_' + asentamiento.nombre.replace(/[^a-zA-Z0-9]/g, '_') + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  mostrarNotificacion("📤 " + asentamiento.nombre + " exportado", "exito");
}

// === REGION VISUALIZATION (BORDER ONLY) ===
function dibujarRegion() {
  const canvas = document.getElementById('region-canvas');
  if (!canvas) return;

  const mapa = estadoApp.expedicion.mapa;
  const asentamientos = estadoApp.expedicion.asentamientos || [];
  const hexSize = mapa.config.hexSize;
  const offsetX = mapa.config.offsetX || 0;
  const offsetY = mapa.config.offsetY || 0;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Find the first/primary settlement
  const primerAsentamiento = asentamientos.find(function (a) { return a.esPrimerAsentamiento; });
  if (!primerAsentamiento) return;

  const ubicacion = mapa.ubicaciones[primerAsentamiento.id];
  if (!ubicacion) return;

  const REGION_RADIUS = 6; // Hexes radius for the region
  const centerQ = ubicacion.q;
  const centerR = ubicacion.r;

  // Collect all hexes at the boundary (distance = REGION_RADIUS)
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.8)'; // Red border
  ctx.lineWidth = 3;
  ctx.setLineDash([]);

  ctx.beginPath();
  for (let dq = -REGION_RADIUS; dq <= REGION_RADIUS; dq++) {
    for (let dr = Math.max(-REGION_RADIUS, -dq - REGION_RADIUS); dr <= Math.min(REGION_RADIUS, -dq + REGION_RADIUS); dr++) {
      const dist = (Math.abs(dq) + Math.abs(dr) + Math.abs(-dq - dr)) / 2;

      // Only draw hexes AT the boundary
      if (dist !== REGION_RADIUS) continue;

      const q = centerQ + dq;
      const r = centerR + dr;

      // POINTY-TOP center formula
      const hexX = hexSize * Math.sqrt(3) * (q + r / 2) + offsetX;
      const hexY = hexSize * 1.5 * r + offsetY;

      // Draw hex border
      for (let i = 0; i < 6; i++) {
        const angle_deg = 60 * i + 30;
        const angle_rad = Math.PI / 180 * angle_deg;
        const px = hexX + hexSize * Math.cos(angle_rad);
        const py = hexY + hexSize * Math.sin(angle_rad);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
  }
  ctx.stroke();
}

// === ADMIN PIN CLICK (RELOCATION) ===
function clickPinMapa(id, event) {
  event.stopPropagation();

  if (!estadoApp.mapaAdmin) {
    // Normal mode - just show info or open settlement
    gestionarAsentamiento(id);
    return;
  }

  // Admin mode - allow relocation
  const asentamiento = estadoApp.expedicion.asentamientos.find(function (a) { return a.id === id; });
  if (!asentamiento) return;

  if (confirm("¿Reubicar " + asentamiento.nombre + "? Haz clic en la nueva posición.")) {
    asentamientoSeleccionadoId = id;
    mostrarNotificacion("📍 Haz clic en el mapa para reubicar " + asentamiento.nombre);
  }
}

// === EDIT ARTIFICIAL SUBTYPE (HUD) ===
function cambiarSubtipoPoblacion(id, nuevoSubtipo) {
  const cuota = estadoSimulacion.poblacion.find(function (p) { return p.id === id; });
  if (cuota) {
    cuota.subtipo = nuevoSubtipo;
    guardarExpedicion();
    actualizarHUD();
    mostrarNotificacion("🤖 Subtipo actualizado a " + nuevoSubtipo);
  }
}





// =====================================================
// VISOR DE MAPA - RENDERIZADO COMPLETO
// =====================================================

function renderizarVisorMapa(expedicion) {
  const mapa = expedicion?.mapa;
  const asentamientos = expedicion?.asentamientos || [];
  const isAdmin = estadoApp.mapaAdmin || false;

  if (!mapa || !mapa.imagen) {
    return `
      <div class="mapa-vacio">
        <p>🗺️ No hay mapa configurado para esta expedición.</p>
        <p>Usa el modo Admin para cargar una imagen de mapa.</p>
        ${isAdmin ? `
          <label class="btn-cargar-mapa">
            📁 Cargar Imagen de Mapa
            <input type="file" accept="image/*" onchange="cargarImagenMapa(event)" style="display:none;">
          </label>
        ` : ''}
      </div>
    `;
  }

  const config = mapa.config || { hexSize: 30, offsetX: 0, offsetY: 0, mostrarGrid: true, mostrarFow: true };

  // Generate settlement pins HTML
  const pinsHTML = asentamientos.map(a => {
    const ubicacion = mapa.ubicaciones?.[a.id];
    if (!ubicacion) return '';

    const q = ubicacion.q;
    const r = ubicacion.r;
    // POINTY-TOP formula
    const x = config.hexSize * Math.sqrt(3) * (q + r / 2) + (config.offsetX || 0);
    const y = config.hexSize * 1.5 * r + (config.offsetY || 0);

    const gradoData = typeof GRADOS !== 'undefined' ? GRADOS[a.grado] : null;
    const icono = gradoData?.icono || '🏕️';

    // Pin size scales with hexSize (roughly 1.2x hex dimension)
    const pinSize = Math.max(24, Math.round(config.hexSize * 1.2));
    const fontSize = Math.max(12, Math.round(config.hexSize * 0.6));

    // Show custom image if available, otherwise show icon
    const contenidoVisual = a.imagenPersonalizada
      ? `<img src="${a.imagenPersonalizada}" class="pin-imagen" style="width:${pinSize}px; height:${pinSize}px;" alt="${a.nombre}">`
      : `<span class="pin-icono" style="font-size:${fontSize}px;">${icono}</span>`;

    return `
      <div class="mapa-pin" 
           style="left: ${x}px; top: ${y}px; transform: translate(-50%, -50%);"
           onclick="clickPinMapa(${a.id}, event)"
           title="${a.nombre}">
        ${contenidoVisual}
        <span class="pin-label">${a.nombre}</span>
      </div>
    `;
  }).join('');

  // Generate markers HTML
  const marcadores = mapa.marcadores || [];
  const marcadoresHTML = marcadores.map((m, idx) => {
    const q = m.q;
    const r = m.r;
    const x = config.hexSize * Math.sqrt(3) * (q + r / 2) + (config.offsetX || 0);
    const y = config.hexSize * 1.5 * r + (config.offsetY || 0);

    return `
      <div class="mapa-marcador" 
           style="left: ${x}px; top: ${y}px; transform: translate(-50%, -50%); color: ${m.color || '#fff'};"
           title="${m.texto || 'Marcador'}">
        ${m.icono || '📍'}
      </div>
    `;
  }).join('');

  return `
    <div class="visor-mapa-container">
      <div class="mapa-toolbar">
        <div class="toolbar-grupo">
          <label class="toolbar-check">
            <input type="checkbox" ${config.mostrarGrid ? 'checked' : ''} onchange="toggleGridMapa(this.checked)">
            🔲 Grid
          </label>
          ${isAdmin ? `
            <label class="toolbar-check">
              <input type="checkbox" ${config.mostrarFow ? 'checked' : ''} onchange="toggleFowMapa(this.checked)">
              🌫️ Niebla
            </label>
          ` : ''}
        </div>
        
        <div class="toolbar-grupo zoom-controles">
          <button class="btn-zoom" onclick="zoomMapa(-0.1)" title="Alejar">➖</button>
          <input type="range" id="zoom-slider" min="0.25" max="3" step="0.05" value="1" onchange="setZoomMapa(this.value)" title="Zoom">
          <button class="btn-zoom" onclick="zoomMapa(0.1)" title="Acercar">➕</button>
          <button class="btn-zoom" onclick="resetZoomMapa()" title="Restablecer">🔄</button>
          <span id="zoom-level" class="zoom-level">100%</span>
        </div>
        
        ${isAdmin ? `
          <div class="toolbar-grupo admin-controls">
            <button onclick="toggleAdminMapa()" class="btn-admin activo">🔧 Admin</button>
            <label class="btn-toolbar">
              📁 Cargar Mapa
              <input type="file" accept="image/*" onchange="cargarImagenMapa(event)" style="display:none;">
            </label>
            <button onclick="exportarMapaCompleto()" class="btn-toolbar">📤 Exportar</button>
            <label class="btn-toolbar">
              📥 Importar
              <input type="file" accept=".json" onchange="importarMapaCompleto(event)" style="display:none;">
            </label>
          </div>
        ` : `
          <button onclick="toggleAdminMapa()" class="btn-admin">🔧 Admin</button>
        `}
      </div>
      
      <div class="mapa-config-bar" ${isAdmin ? '' : 'style="display:none;"'}>
        <label>Hex Size: <input type="number" value="${config.hexSize}" min="10" max="100" onchange="actualizarConfigMapa('hexSize', this.value)"></label>
        <label>Offset X: <input type="number" value="${config.offsetX || 0}" onchange="actualizarConfigMapa('offsetX', this.value)"></label>
        <label>Offset Y: <input type="number" value="${config.offsetY || 0}" onchange="actualizarConfigMapa('offsetY', this.value)"></label>
      </div>
      
      <div class="mapa-viewport" id="mapa-viewport" onmousedown="iniciarArrastreMapa(event)" onmousemove="arrastrarMapa(event)" onmouseup="terminarArrastreMapa(event)" onmouseleave="terminarArrastreMapa(event)" onwheel="zoomMapaRueda(event)">
        <div class="mapa-lienzo" id="mapa-lienzo" style="position: relative; transform-origin: 0 0;" onclick="manejarClickMapa(event)">
          <img src="${mapa.imagen}" class="mapa-imagen" id="mapa-imagen" onload="inicializarCanvasFow()">
          <canvas id="region-canvas" class="region-canvas"></canvas>
          <canvas id="fow-canvas" class="fow-canvas"></canvas>
          <canvas id="grid-canvas" class="grid-canvas"></canvas>
          <div class="mapa-pins">
            ${pinsHTML}
            ${marcadoresHTML}
          </div>
          <div class="hover-hex" id="hover-hex"></div>
        </div>
      </div>
      
      <div class="mapa-leyenda">
        <span class="leyenda-item">🏕️ Asentamiento</span>
        <span class="leyenda-item">📍 Marcador</span>
        <span class="leyenda-item" style="color: rgba(220, 38, 38, 0.8);">⬡ Región (6 hex)</span>
      </div>
    </div>
    
    <style>
      .visor-mapa-container { display: flex; flex-direction: column; height: 100%; background: #1a1a2e; border-radius: 8px; overflow: hidden; }
      .mapa-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.1); }
      .toolbar-grupo { display: flex; gap: 1rem; align-items: center; }
      .toolbar-check { display: flex; align-items: center; gap: 0.3rem; cursor: pointer; font-size: 0.85rem; }
      .btn-toolbar, .btn-admin { background: rgba(100,100,200,0.2); border: 1px solid rgba(100,100,200,0.4); color: #fff; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
      .btn-admin.activo { background: rgba(200,100,100,0.3); border-color: rgba(200,100,100,0.5); }
      .mapa-config-bar { display: flex; gap: 1rem; padding: 0.5rem 1rem; background: rgba(0,0,0,0.2); font-size: 0.8rem; }
      .mapa-config-bar input { width: 60px; background: #333; border: 1px solid #555; color: #fff; padding: 2px 5px; border-radius: 3px; }
      .mapa-viewport { flex: 1; overflow: auto; position: relative; }
      .mapa-lienzo { display: inline-block; position: relative; min-width: 100%; min-height: 100%; }
      .mapa-imagen { display: block; max-width: none; }
      .region-canvas { position: absolute; top: 0; left: 0; z-index: 12; pointer-events: none; }
      .fow-canvas { position: absolute; top: 0; left: 0; z-index: 15; pointer-events: none; }
      .grid-canvas { position: absolute; top: 0; left: 0; z-index: 18; pointer-events: none; }
      .mapa-pins { position: absolute; top: 0; left: 0; z-index: 25; pointer-events: none; }
      .mapa-pin { position: absolute; display: flex; flex-direction: column; align-items: center; pointer-events: auto; cursor: pointer; transition: transform 0.2s; }
      .mapa-pin:hover { transform: translate(-50%, -50%) scale(1.2); z-index: 30; }
      .pin-icono { font-size: 1.5rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
      .pin-imagen { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #ffd700; box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
      .pin-label { font-size: 0.7rem; background: rgba(0,0,0,0.7); padding: 2px 6px; border-radius: 3px; white-space: nowrap; margin-top: 2px; }
      .mapa-marcador { position: absolute; font-size: 1.2rem; pointer-events: auto; cursor: pointer; }
      .hover-hex { position: absolute; pointer-events: none; z-index: 20; border: 2px solid rgba(255,255,0,0.6); background: rgba(255,255,0,0.1); display: none; }
      .mapa-leyenda { display: flex; gap: 1.5rem; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); font-size: 0.8rem; border-top: 1px solid rgba(255,255,255,0.1); }
      .mapa-vacio { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; gap: 1rem; opacity: 0.7; }
      .btn-cargar-mapa { background: rgba(100,200,100,0.2); border: 1px solid rgba(100,200,100,0.4); color: #fff; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
      
      /* Settlement Popup Styles */
      .popup-mapa { position: absolute; z-index: 100; background: linear-gradient(135deg, rgba(30,30,60,0.98) 0%, rgba(20,20,40,0.98) 100%); border: 1px solid rgba(100,100,255,0.3); border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); min-width: 150px; animation: popupFadeIn 0.15s ease-out; }
      @keyframes popupFadeIn { from { opacity: 0; transform: scale(0.95) translateY(-5px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      .popup-header { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); border-radius: 8px 8px 0 0; }
      .popup-titulo { font-weight: 600; font-size: 0.85rem; color: #ffd700; }
      .popup-cerrar { background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 1rem; padding: 0 0.25rem; }
      .popup-cerrar:hover { color: #ff6b6b; }
      .popup-opciones { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.5rem; }
      .popup-btn { display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 0.5rem 0.75rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; transition: all 0.15s ease; text-align: left; }
      .popup-btn:hover:not(:disabled) { background: rgba(100,150,255,0.2); border-color: rgba(100,150,255,0.4); transform: translateX(2px); }
      .popup-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .popup-btn-explorar { border-color: rgba(100,200,100,0.4); }
      .popup-btn-explorar:hover { background: rgba(100,200,100,0.2); border-color: rgba(100,200,100,0.6); }
      .popup-btn-admin { border-color: rgba(255,100,100,0.3); }
      .popup-btn-admin:hover { background: rgba(255,100,100,0.15); border-color: rgba(255,100,100,0.5); }
      
      /* Zoom Controls */
      .zoom-controles { display: flex; align-items: center; gap: 0.5rem; }
      .btn-zoom { background: rgba(100,150,255,0.2); border: 1px solid rgba(100,150,255,0.4); color: #fff; padding: 0.3rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.9rem; transition: all 0.15s; }
      .btn-zoom:hover { background: rgba(100,150,255,0.4); transform: scale(1.1); }
      #zoom-slider { width: 80px; cursor: pointer; }
      .zoom-level { font-size: 0.75rem; color: rgba(255,255,255,0.7); min-width: 40px; text-align: center; }
      
      /* Drag cursor states */
      .mapa-viewport { cursor: grab; }
      .mapa-viewport.arrastrando { cursor: grabbing; }
      .mapa-viewport.arrastrando .mapa-pin { pointer-events: none; }
      .mapa-viewport.arrastrando .mapa-marcador { pointer-events: none; }
      
      /* Smooth zoom transition */
      .mapa-lienzo { transition: transform 0.1s ease-out; }
    </style>
  `;
}

// Toggle Admin mode for map (with password)
function toggleAdminMapa() {
  if (!estadoApp.mapaAdmin) {
    // Enabling admin - require password
    const password = prompt("Ingresa la contraseña de administrador:");
    if (password !== "admin") {
      mostrarNotificacion("Contraseña incorrecta", "error");
      return;
    }
  }
  estadoApp.mapaAdmin = !estadoApp.mapaAdmin;
  mostrarNotificacion(estadoApp.mapaAdmin ? "🔧 Modo Admin activado" : "🔒 Modo Admin desactivado");
  renderizarPantalla();
}

// =====================================================
// MAP DRAG AND ZOOM FUNCTIONALITY
// =====================================================

// State for map drag and zoom
let mapaArrastreActivo = false;
let mapaArrastreStartX = 0;
let mapaArrastreStartY = 0;
let mapaScrollStartX = 0;
let mapaScrollStartY = 0;
let mapaZoomLevel = 1;

// Start dragging the map
function iniciarArrastreMapa(event) {
  // Only left mouse button
  if (event.button !== 0) return;

  // Don't start drag if clicking on controls or pins
  if (event.target.closest('.mapa-pin') ||
    event.target.closest('.mapa-marcador') ||
    event.target.closest('.popup-mapa') ||
    event.target.closest('button') ||
    event.target.closest('input')) {
    return;
  }

  const viewport = document.getElementById('mapa-viewport');
  if (!viewport) return;

  mapaArrastreActivo = true;
  mapaArrastreStartX = event.clientX;
  mapaArrastreStartY = event.clientY;
  mapaScrollStartX = viewport.scrollLeft;
  mapaScrollStartY = viewport.scrollTop;

  viewport.classList.add('arrastrando');
  event.preventDefault();
}

// Handle map dragging
function arrastrarMapa(event) {
  if (!mapaArrastreActivo) return;

  const viewport = document.getElementById('mapa-viewport');
  if (!viewport) return;

  const deltaX = event.clientX - mapaArrastreStartX;
  const deltaY = event.clientY - mapaArrastreStartY;

  viewport.scrollLeft = mapaScrollStartX - deltaX;
  viewport.scrollTop = mapaScrollStartY - deltaY;
}

// Stop dragging the map
function terminarArrastreMapa(event) {
  if (!mapaArrastreActivo) return;

  mapaArrastreActivo = false;

  const viewport = document.getElementById('mapa-viewport');
  if (viewport) {
    viewport.classList.remove('arrastrando');
  }
}

// Zoom with mouse wheel
function zoomMapaRueda(event) {
  event.preventDefault();

  // Determine zoom direction
  const delta = event.deltaY > 0 ? -0.1 : 0.1;
  zoomMapa(delta);
}

// Apply zoom change
function zoomMapa(delta) {
  const nuevoZoom = Math.max(0.25, Math.min(3, mapaZoomLevel + delta));
  setZoomMapa(nuevoZoom);
}

// Set specific zoom level
function setZoomMapa(nivel) {
  mapaZoomLevel = parseFloat(nivel);

  const lienzo = document.getElementById('mapa-lienzo');
  const slider = document.getElementById('zoom-slider');
  const label = document.getElementById('zoom-level');

  if (lienzo) {
    lienzo.style.transform = `scale(${mapaZoomLevel})`;
  }

  if (slider) {
    slider.value = mapaZoomLevel;
  }

  if (label) {
    label.textContent = `${Math.round(mapaZoomLevel * 100)}%`;
  }
}

// Reset zoom to 100%
function resetZoomMapa() {
  setZoomMapa(1);

  // Also reset scroll position to center
  const viewport = document.getElementById('mapa-viewport');
  if (viewport) {
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  }
}

// State for settlement relocation and exploration
let asentamientoReubicando = null;
let asentamientoExplorando = null;

// Click handler for map pins - shows popup with options
function clickPinMapa(asentamientoId, event) {
  event.stopPropagation();

  const asentamiento = estadoApp.expedicion.asentamientos.find(a => a.id === asentamientoId);
  if (!asentamiento) return;

  // Get click position for popup placement
  const rect = event.target.closest('.mapa-viewport')?.getBoundingClientRect() || { left: 0, top: 0 };
  const popupX = event.clientX - rect.left + 10;
  const popupY = event.clientY - rect.top - 20;

  mostrarPopupAsentamiento(asentamientoId, popupX, popupY);
}

// Show popup with settlement options
function mostrarPopupAsentamiento(asentamientoId, x, y) {
  // Remove any existing popup
  cerrarPopupMapa();

  const asentamiento = estadoApp.expedicion.asentamientos.find(a => a.id === asentamientoId);
  if (!asentamiento) return;

  const isAdmin = estadoApp.mapaAdmin;

  // Check if exploration was used this turn
  const exploracionUsada = estadoSimulacion.exploracionUsadaTurno?.[asentamientoId] || false;

  const popup = document.createElement('div');
  popup.id = 'popup-mapa-asentamiento';
  popup.className = 'popup-mapa';
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';

  popup.innerHTML = `
    <div class="popup-header">
      <span class="popup-titulo">${asentamiento.nombre}</span>
      <button class="popup-cerrar" onclick="cerrarPopupMapa()">✕</button>
    </div>
    <div class="popup-opciones">
      <button class="popup-btn" onclick="gestionarAsentamiento(${asentamientoId}); cerrarPopupMapa();">
        📋 Ver Detalles
      </button>
      ${!exploracionUsada ? `
        <button class="popup-btn popup-btn-explorar" onclick="iniciarExploracion(${asentamientoId})">
          🔭 Explorar
        </button>
      ` : `
        <button class="popup-btn" disabled title="Ya exploraste este turno">
          ✓ Explorado
        </button>
      `}
      ${isAdmin ? `
        <button class="popup-btn popup-btn-admin" onclick="iniciarReubicacion(${asentamientoId})">
          📍 Mover Token
        </button>
      ` : ''}
    </div>
  `;

  document.querySelector('.mapa-viewport')?.appendChild(popup);
}

// Close map popup
function cerrarPopupMapa() {
  const popup = document.getElementById('popup-mapa-asentamiento');
  if (popup) popup.remove();
}

// Start relocation mode (Admin only)
function iniciarReubicacion(asentamientoId) {
  cerrarPopupMapa();
  asentamientoReubicando = asentamientoId;
  const asentamiento = estadoApp.expedicion.asentamientos.find(a => a.id === asentamientoId);
  mostrarNotificacion("📍 Haz clic en el mapa para reubicar " + asentamiento?.nombre, "info");
}

// Start exploration mode
function iniciarExploracion(asentamientoId) {
  cerrarPopupMapa();
  asentamientoExplorando = asentamientoId;
  const asentamiento = estadoApp.expedicion.asentamientos.find(a => a.id === asentamientoId);
  mostrarNotificacion("🔭 Haz clic en un hex visible para explorar alrededor", "info");
}

// Handle click on map for relocation OR exploration
function manejarClickMapa(event) {
  // Close any open popup first
  cerrarPopupMapa();

  const mapa = estadoApp.expedicion.mapa;
  const config = mapa.config;
  const rect = event.target.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickY = event.clientY - rect.top;

  // Convert pixel to hex coordinates (pointy-top)
  const x = clickX - (config.offsetX || 0);
  const y = clickY - (config.offsetY || 0);
  const size = config.hexSize;

  const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / size;
  const r = (2 / 3 * y) / size;
  const rounded = roundHex(q, r);

  // Handle relocation mode
  if (asentamientoReubicando) {
    mapa.ubicaciones[asentamientoReubicando] = { q: rounded.q, r: rounded.r };
    const asentamiento = estadoApp.expedicion.asentamientos.find(a => a.id === asentamientoReubicando);
    mostrarNotificacion(`✅ ${asentamiento?.nombre || 'Asentamiento'} reubicado`);
    asentamientoReubicando = null;
    guardarExpedicion();
    renderizarPantalla();
    return;
  }

  // Handle exploration mode
  if (asentamientoExplorando) {
    ejecutarExploracion(asentamientoExplorando, rounded.q, rounded.r);
    return;
  }
}

// Execute exploration: reveal 2 hexes around clicked hex
function ejecutarExploracion(asentamientoId, centerQ, centerR) {
  const mapa = estadoApp.expedicion.mapa;

  // Initialize hexesExplorados if needed
  if (!mapa.hexesExplorados) mapa.hexesExplorados = {};
  if (!mapa.hexesExplorados[asentamientoId]) mapa.hexesExplorados[asentamientoId] = [];

  const explorados = mapa.hexesExplorados[asentamientoId];
  const EXPLORATION_RADIUS = 2;
  let nuevosHexes = 0;

  // Add hexes within 2 radius of clicked hex
  for (let dq = -EXPLORATION_RADIUS; dq <= EXPLORATION_RADIUS; dq++) {
    for (let dr = Math.max(-EXPLORATION_RADIUS, -dq - EXPLORATION_RADIUS); dr <= Math.min(EXPLORATION_RADIUS, -dq + EXPLORATION_RADIUS); dr++) {
      const q = centerQ + dq;
      const r = centerR + dr;

      // Check if already explored
      const yaExplorado = explorados.some(h => h.q === q && h.r === r);
      if (!yaExplorado) {
        explorados.push({ q, r });
        nuevosHexes++;
      }
    }
  }

  // Mark exploration as used this turn
  if (!estadoSimulacion.exploracionUsadaTurno) estadoSimulacion.exploracionUsadaTurno = {};
  estadoSimulacion.exploracionUsadaTurno[asentamientoId] = true;

  const asentamiento = estadoApp.expedicion.asentamientos.find(a => a.id === asentamientoId);
  mostrarNotificacion(`🔭 ${asentamiento?.nombre}: ${nuevosHexes} hexes explorados`);

  asentamientoExplorando = null;
  guardarExpedicion();
  renderizarPantalla();
}

// Helper: Round fractional hex to nearest hex
function roundHex(q, r) {
  let x = q;
  let z = r;
  let y = -x - z;

  let rx = Math.round(x);
  let rz = Math.round(z);
  let ry = Math.round(y);

  const x_diff = Math.abs(rx - x);
  const y_diff = Math.abs(ry - y);
  const z_diff = Math.abs(rz - z);

  if (x_diff > y_diff && x_diff > z_diff) {
    rx = -ry - rz;
  } else if (y_diff > z_diff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
}

// Toggle grid visibility
function toggleGridMapa(mostrar) {
  if (!estadoApp.expedicion.mapa) return;
  estadoApp.expedicion.mapa.config = estadoApp.expedicion.mapa.config || {};
  estadoApp.expedicion.mapa.config.mostrarGrid = mostrar;
  const canvas = document.getElementById('grid-canvas');
  if (canvas) canvas.style.display = mostrar ? 'block' : 'none';
  guardarExpedicion();
}

// Toggle fog of war visibility
function toggleFowMapa(mostrar) {
  if (!estadoApp.expedicion.mapa) return;
  estadoApp.expedicion.mapa.config = estadoApp.expedicion.mapa.config || {};
  estadoApp.expedicion.mapa.config.mostrarFow = mostrar;
  const canvas = document.getElementById('fow-canvas');
  if (canvas) canvas.style.display = mostrar ? 'block' : 'none';
  guardarExpedicion();
}

// Load map image
function cargarImagenMapa(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    if (!estadoApp.expedicion.mapa) {
      estadoApp.expedicion.mapa = { config: { hexSize: 30, offsetX: 0, offsetY: 0, mostrarGrid: true, mostrarFow: true }, ubicaciones: {}, marcadores: [] };
    }
    estadoApp.expedicion.mapa.imagen = e.target.result;
    guardarExpedicion();
    renderizarPantalla();
    mostrarNotificacion('🗺️ Mapa cargado correctamente');
  };
  reader.readAsDataURL(file);
}

// Update map config
function actualizarConfigMapa(prop, valor) {
  if (!estadoApp.expedicion.mapa) return;
  estadoApp.expedicion.mapa.config = estadoApp.expedicion.mapa.config || {};
  estadoApp.expedicion.mapa.config[prop] = parseInt(valor) || 0;
  guardarExpedicion();

  // Re-render canvases
  inicializarCanvasFow();
  renderizarPantalla();
}

// Initialize canvas layers for fog of war, grid, and region
function inicializarCanvasFow() {
  const img = document.getElementById('mapa-imagen');
  if (!img || !img.complete) return;

  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvasFow = document.getElementById('fow-canvas');
  const canvasGrid = document.getElementById('grid-canvas');
  const canvasRegion = document.getElementById('region-canvas');

  if (canvasFow) { canvasFow.width = w; canvasFow.height = h; }
  if (canvasGrid) { canvasGrid.width = w; canvasGrid.height = h; }
  if (canvasRegion) { canvasRegion.width = w; canvasRegion.height = h; }

  dibujarRegion();
  dibujarNiebla();
  dibujarGrid();
}

// Draw fog of war with 3 states:
// 1. Unexplored: Fully black
// 2. Explored but not visible: Dark fog (semi-transparent)
// 3. Visible (in settlement range): Clear
function dibujarNiebla() {
  const canvas = document.getElementById('fow-canvas');
  if (!canvas) return;

  const mapa = estadoApp.expedicion?.mapa;
  if (!mapa?.config?.mostrarFow) {
    canvas.style.display = 'none';
    return;
  }
  canvas.style.display = 'block';

  const ctx = canvas.getContext('2d');
  const asentamientos = estadoApp.expedicion?.asentamientos || [];
  const hexSize = mapa.config.hexSize || 30;
  const offsetX = mapa.config.offsetX || 0;
  const offsetY = mapa.config.offsetY || 0;
  const hexesExplorados = mapa.hexesExplorados || {};

  // Step 1: Fill entire canvas with fully black fog (unexplored)
  ctx.fillStyle = 'rgba(0, 0, 0, 1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Step 2: Draw explored hexes with semi-transparent fog
  ctx.globalCompositeOperation = 'destination-out';

  Object.values(hexesExplorados).forEach(hexList => {
    hexList.forEach(hex => {
      const x = hexSize * Math.sqrt(3) * (hex.q + hex.r / 2) + offsetX;
      const y = hexSize * 1.5 * hex.r + offsetY;

      // Draw hex shape to cut out
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + (Math.PI / 6);
        const px = x + hexSize * Math.cos(angle);
        const py = y + hexSize * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    });
  });

  // Step 3: Overlay fog on explored areas (semi-transparent)
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(20, 30, 50, 0.6)'; // Dark fog for explored but not visible

  Object.values(hexesExplorados).forEach(hexList => {
    hexList.forEach(hex => {
      const x = hexSize * Math.sqrt(3) * (hex.q + hex.r / 2) + offsetX;
      const y = hexSize * 1.5 * hex.r + offsetY;

      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + (Math.PI / 6);
        const px = x + hexSize * Math.cos(angle);
        const py = y + hexSize * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    });
  });

  // Step 4: Clear areas around settlements (fully visible)
  ctx.globalCompositeOperation = 'destination-out';

  asentamientos.forEach(a => {
    const ubicacion = mapa.ubicaciones?.[a.id];
    if (!ubicacion) return;

    const q = ubicacion.q;
    const r = ubicacion.r;
    const x = hexSize * Math.sqrt(3) * (q + r / 2) + offsetX;
    const y = hexSize * 1.5 * r + offsetY;

    // Vision radius (primary settlement sees further)
    const visionRadius = (a.esPrimerAsentamiento ? 7 : 4) * hexSize;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, visionRadius);
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(0.7, 'rgba(0,0,0,0.8)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, visionRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalCompositeOperation = 'source-over';
}

// Draw region border around first settlement (4 hex radius)
function dibujarRegion() {
  const canvas = document.getElementById('region-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const mapa = estadoApp.expedicion?.mapa;
  if (!mapa) return;

  const asentamientos = estadoApp.expedicion?.asentamientos || [];
  const primerAsentamiento = asentamientos.find(a => a.esPrimerAsentamiento);
  if (!primerAsentamiento) return;

  const ubicacion = mapa.ubicaciones?.[primerAsentamiento.id];
  if (!ubicacion) return;

  const hexSize = mapa.config.hexSize || 30;
  const offsetX = mapa.config.offsetX || 0;
  const offsetY = mapa.config.offsetY || 0;
  const REGION_RADIUS = 4; // 4 hexes de distancia

  const centerQ = ubicacion.q;
  const centerR = ubicacion.r;

  // Draw red border for boundary hexes
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.8)';
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(220, 38, 38, 0.05)';

  for (let dq = -REGION_RADIUS; dq <= REGION_RADIUS; dq++) {
    for (let dr = Math.max(-REGION_RADIUS, -dq - REGION_RADIUS); dr <= Math.min(REGION_RADIUS, -dq + REGION_RADIUS); dr++) {
      const dist = (Math.abs(dq) + Math.abs(dr) + Math.abs(-dq - dr)) / 2;
      if (dist > REGION_RADIUS) continue;

      const q = centerQ + dq;
      const r = centerR + dr;

      // POINTY-TOP center
      const x = hexSize * Math.sqrt(3) * (q + r / 2) + offsetX;
      const y = hexSize * 1.5 * r + offsetY;

      // Only draw border for boundary hexes
      if (dist === REGION_RADIUS) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i + (Math.PI / 6);
          const px = x + hexSize * Math.cos(angle);
          const py = y + hexSize * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
}

// Draw hex grid
function dibujarGrid() {
  const canvas = document.getElementById('grid-canvas');
  if (!canvas) return;

  const mapa = estadoApp.expedicion?.mapa;
  if (!mapa?.config?.mostrarGrid) {
    canvas.style.display = 'none';
    return;
  }
  canvas.style.display = 'block';

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const hexSize = mapa.config.hexSize || 30;
  const offsetX = mapa.config.offsetX || 0;
  const offsetY = mapa.config.offsetY || 0;

  // Calculate grid bounds
  const hexWidth = Math.sqrt(3) * hexSize;
  const hexHeight = 2 * hexSize;
  const vertDist = hexHeight * 0.75;

  const cols = Math.ceil(canvas.width / hexWidth) + 2;
  const rows = Math.ceil(canvas.height / vertDist) + 2;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const q = col;
      const r = row;

      // POINTY-TOP center
      const x = hexSize * Math.sqrt(3) * (q + r / 2) + offsetX;
      const y = hexSize * 1.5 * r + offsetY;

      // Draw hex
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle_deg = 60 * i + 30; // Pointy-top
        const angle_rad = Math.PI / 180 * angle_deg;
        const px = x + hexSize * Math.cos(angle_rad);
        const py = y + hexSize * Math.sin(angle_rad);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
}

// Export complete map data
function exportarMapaCompleto() {
  const mapa = estadoApp.expedicion?.mapa;
  if (!mapa) {
    mostrarNotificacion('No hay mapa para exportar', 'error');
    return;
  }

  const data = {
    mapa: mapa,
    asentamientos: estadoApp.expedicion.asentamientos.map(a => ({
      id: a.id,
      nombre: a.nombre,
      grado: a.grado,
      esPrimerAsentamiento: a.esPrimerAsentamiento
    })),
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mapa_' + (estadoApp.expedicion.nombre || 'expedicion').replace(/[^a-zA-Z0-9]/g, '_') + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  mostrarNotificacion('📤 Mapa exportado correctamente');
}

// Import complete map data with smart name matching
// If imported map has markers with same name as existing settlements,
// place those settlements at the marker locations
function importarMapaCompleto(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.mapa) {
        mostrarNotificacion('Archivo no contiene datos de mapa válidos', 'error');
        return;
      }

      // Initialize mapa if needed
      if (!estadoApp.expedicion.mapa) {
        estadoApp.expedicion.mapa = { config: { hexSize: 30, offsetX: 0, offsetY: 0, mostrarGrid: true, mostrarFow: true }, ubicaciones: {}, marcadores: [], hexesExplorados: {} };
      }

      const mapa = estadoApp.expedicion.mapa;
      const asentamientos = estadoApp.expedicion.asentamientos || [];

      // Copy map image and config
      mapa.imagen = data.mapa.imagen || mapa.imagen;
      mapa.config = { ...mapa.config, ...data.mapa.config };
      mapa.hexesExplorados = data.mapa.hexesExplorados || mapa.hexesExplorados || {};

      let asentamientosColocados = 0;
      let marcadoresImportados = 0;

      // Smart matching: Check imported asentamientos data
      if (data.asentamientos && Array.isArray(data.asentamientos)) {
        data.asentamientos.forEach(importedAsen => {
          // Find matching settlement by name (case-insensitive)
          const localAsen = asentamientos.find(a =>
            a.nombre.toLowerCase() === importedAsen.nombre?.toLowerCase()
          );

          // Check if imported data has ubicaciones for this settlement
          const importedUbicacion = data.mapa.ubicaciones?.[importedAsen.id];

          if (localAsen && importedUbicacion) {
            // Place local settlement at imported location
            mapa.ubicaciones[localAsen.id] = { q: importedUbicacion.q, r: importedUbicacion.r };
            asentamientosColocados++;
          }
        });
      }

      // Also check marcadores for settlement names
      if (data.mapa.marcadores && Array.isArray(data.mapa.marcadores)) {
        data.mapa.marcadores.forEach(marker => {
          // Find matching settlement by marker name
          const localAsen = asentamientos.find(a =>
            a.nombre.toLowerCase() === (marker.nombre || marker.texto)?.toLowerCase()
          );

          if (localAsen && (marker.q !== undefined && marker.r !== undefined)) {
            // Place local settlement at marker location
            mapa.ubicaciones[localAsen.id] = { q: marker.q, r: marker.r };
            asentamientosColocados++;
          } else {
            // Keep as marker if no match
            if (!mapa.marcadores) mapa.marcadores = [];
            // Avoid duplicate markers
            const exists = mapa.marcadores.some(m =>
              m.q === marker.q && m.r === marker.r && m.nombre === marker.nombre
            );
            if (!exists) {
              mapa.marcadores.push(marker);
              marcadoresImportados++;
            }
          }
        });
      }

      guardarExpedicion();
      renderizarPantalla();

      let mensaje = '📥 Mapa importado';
      if (asentamientosColocados > 0) mensaje += ` - ${asentamientosColocados} asentamiento(s) colocado(s)`;
      if (marcadoresImportados > 0) mensaje += ` - ${marcadoresImportados} marcador(es) agregado(s)`;
      mostrarNotificacion(mensaje);

    } catch (err) {
      mostrarNotificacion('Error al importar mapa: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// =====================================================
// TOKEN UPLOAD FOR HUD (EXISTING SETTLEMENT)
// =====================================================

// Upload token image for the current settlement in HUD view
function subirTokenAsentamiento(input) {
  const file = input.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    mostrarNotificacion('Por favor selecciona un archivo de imagen válido', 'error');
    return;
  }

  // Limit to 2MB
  if (file.size > 2 * 1024 * 1024) {
    mostrarNotificacion('La imagen es muy grande. Máximo 2MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    if (estadoApp.asentamiento) {
      estadoApp.asentamiento.imagenPersonalizada = e.target.result;
      guardarExpedicion();
      actualizarHUD();
      mostrarNotificacion('🖼️ Token actualizado correctamente', 'success');
    }
  };
  reader.readAsDataURL(file);
}

// Remove token image from the current settlement
function eliminarTokenAsentamiento() {
  if (estadoApp.asentamiento) {
    estadoApp.asentamiento.imagenPersonalizada = null;
    guardarExpedicion();
    actualizarHUD();
    mostrarNotificacion('🗑️ Token eliminado', 'success');
  }
}

// =====================================================
// SETTLEMENT EXPORT/IMPORT FUNCTIONS
// =====================================================

// Export a single settlement to JSON file
function exportarAsentamientoIndividual(asentamientoId) {
  const asentamiento = estadoApp.expedicion.asentamientos.find(a => a.id === asentamientoId);
  if (!asentamiento) {
    mostrarNotificacion('Asentamiento no encontrado', 'error');
    return;
  }

  const data = {
    asentamientos: [asentamiento],
    exportedAt: new Date().toISOString(),
    expedicionNombre: estadoApp.expedicion.nombre,
    version: '1.0'
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'asentamiento_' + asentamiento.nombre.replace(/[^a-zA-Z0-9]/g, '_') + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  mostrarNotificacion(`📤 ${asentamiento.nombre} exportado`, 'success');
}

// Export all settlements to JSON file
function exportarTodosAsentamientos() {
  const asentamientos = estadoApp.expedicion.asentamientos || [];
  if (asentamientos.length === 0) {
    mostrarNotificacion('No hay asentamientos para exportar', 'error');
    return;
  }

  const data = {
    asentamientos: asentamientos,
    exportedAt: new Date().toISOString(),
    expedicionNombre: estadoApp.expedicion.nombre,
    version: '1.0'
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'asentamientos_' + (estadoApp.expedicion.nombre || 'expedicion').replace(/[^a-zA-Z0-9]/g, '_') + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  mostrarNotificacion(`📤 ${asentamientos.length} asentamiento(s) exportado(s)`, 'success');
}

// UI for importing settlements - triggers file selection
function importarAsentamientosUI() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';

  input.onchange = function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
        importarAsentamientos(data);
      } catch (err) {
        mostrarNotificacion('Error al leer archivo: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}

// Import settlements from JSON data
// Merges with existing settlements (replaces if same ID, adds if new)
function importarAsentamientos(data) {
  if (!data.asentamientos || !Array.isArray(data.asentamientos)) {
    mostrarNotificacion('Archivo no contiene asentamientos válidos', 'error');
    return;
  }

  if (!estadoApp.expedicion.asentamientos) {
    estadoApp.expedicion.asentamientos = [];
  }

  const existentes = estadoApp.expedicion.asentamientos;
  let agregados = 0;
  let actualizados = 0;

  data.asentamientos.forEach(importado => {
    // Check if settlement with same ID exists
    const idx = existentes.findIndex(e => e.id === importado.id);

    if (idx >= 0) {
      // Replace existing
      existentes[idx] = importado;
      actualizados++;
    } else {
      // Check if settlement with same name exists
      const idxNombre = existentes.findIndex(e =>
        e.nombre.toLowerCase() === importado.nombre.toLowerCase()
      );

      if (idxNombre >= 0) {
        // Replace by name match
        existentes[idxNombre] = { ...importado, id: existentes[idxNombre].id };
        actualizados++;
      } else {
        // Add new with unique ID
        importado.id = Date.now() + Math.floor(Math.random() * 1000);
        existentes.push(importado);
        agregados++;
      }
    }
  });

  guardarExpedicion();
  renderizarPantalla();

  let mensaje = '📥 Importación completada';
  if (agregados > 0) mensaje += ` - ${agregados} nuevo(s)`;
  if (actualizados > 0) mensaje += ` - ${actualizados} actualizado(s)`;
  mostrarNotificacion(mensaje, 'success');
}

// =====================================================
// DROPDOWN MENU FUNCTIONS
// =====================================================

// Toggle datos dropdown menu
function toggleDropdownDatos() {
  const menu = document.getElementById('dropdown-datos-menu');
  if (menu) {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }
}

// Close datos dropdown menu
function cerrarDropdownDatos() {
  const menu = document.getElementById('dropdown-datos-menu');
  if (menu) {
    menu.style.display = 'none';
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', function (event) {
  const dropdown = document.getElementById('dropdown-datos');
  if (dropdown && !dropdown.contains(event.target)) {
    cerrarDropdownDatos();
  }
});

// =====================================================
// SMART TOOLTIP POSITIONING
// =====================================================

// Add smart tooltip behavior to elements with tooltip-container class
document.addEventListener('mouseover', function (event) {
  const tooltip = event.target.closest('.tooltip-container');
  if (!tooltip) return;

  const rect = tooltip.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const spaceAbove = rect.top;
  const spaceBelow = viewportHeight - rect.bottom;

  // If more space below OR not enough space above (less than 150px), show tooltip below
  if (spaceBelow > spaceAbove || spaceAbove < 150) {
    tooltip.classList.add('tooltip-below');
    tooltip.classList.remove('tooltip-above');
  } else {
    tooltip.classList.add('tooltip-above');
    tooltip.classList.remove('tooltip-below');
  }
});

document.addEventListener('mouseout', function (event) {
  const tooltip = event.target.closest('.tooltip-container');
  if (tooltip) {
    tooltip.classList.remove('tooltip-below', 'tooltip-above');
  }
});
