/**
 * ═══════════════════════════════════════════════════════════════
 *  FM-HSE-022 · Análisis Continuo de Peligros por la Tarea
 *  app.js · v2.1 · Fase 2
 *
 *  Arquitectura: módulos como objetos literales con estado central
 *  compartido. Sin frameworks, sin transpilación, ES6+ vanilla.
 *
 *  Módulos implementados en esta fase:
 *    Config   → carga y acceso a los 4 JSON externos
 *    State    → AppState centralizado + persistencia localStorage
 *    Utils    → helpers reutilizables (uuid, fecha, DOM, toast)
 *    Modal    → modal de confirmación genérica
 *    Backup   → exportación e importación JSON
 *    UI.General      → SF-01 Información General
 *    UI.Responsables → SF-02 Responsables de la Tarea
 *    UI.Ubicacion    → SF-03 Punto de Encuentro / SF-04 Ducha
 *    UI.Senales      → SF-05 Señales para Detener la Tarea
 *    App      → orquestador principal, inicialización, autosave
 *
 *  Módulos diferidos (Fase 3+):
 *    UI.Pasos · UI.Peligros · UI.Controles · UI.Completitud
 *    UI.Resumen · UI.Aprobacion · UI.DocId · Matrix · Print · Admin
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

/* ───────────────────────────────────────────────────────────────
   UTILS — Helpers reutilizables sin dependencias
──────────────────────────────────────────────────────────────── */
const Utils = {

  /** Genera un UUID v4 simplificado */
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  /**
   * Genera el consecutivo en formato DDMMAA-HHMM
   * Usa la hora local del dispositivo
   */
  generarConsecutivo() {
    const d  = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const aa = String(d.getFullYear()).slice(-2);
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}${mm}${aa}-${hh}${mi}`;
  },

  /** Formatea una fecha ISO para mostrar al usuario */
  formatearFechaHora(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('es-CO', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch {
      return isoString;
    }
  },

  /** Obtiene elemento del DOM; lanza error descriptivo si no existe */
  $el(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`[Utils.$el] Elemento no encontrado: #${id}`);
    return el;
  },

  /** Renderiza un badge de estado en un span de status */
  renderStatus(spanId, tipo, texto) {
    const el = Utils.$el(spanId);
    if (!el) return;
    const clases = {
      ok:      'badge badge--success',
      warning: 'badge badge--warning',
      error:   'badge badge--danger',
      info:    'badge badge--info',
      neutral: 'badge badge--neutral'
    };
    el.className = clases[tipo] || clases.neutral;
    el.textContent = texto;
  },

  /** Limpia el badge de status */
  clearStatus(spanId) {
    const el = Utils.$el(spanId);
    if (!el) return;
    el.className = 'section-card__status';
    el.textContent = '';
  },

  /**
   * Muestra un toast no bloqueante
   * @param {string} mensaje
   * @param {'success'|'warning'|'danger'|'info'} tipo
   * @param {number} duracion ms
   */
  toast(mensaje, tipo = 'info', duracion) {
    const cfg      = Config.get('ui') || {};
    const ms       = duracion || cfg.toastDuracionMs || 3000;
    const container = Utils.$el('toast-container');
    if (!container) return;

    const iconos = {
      success: '<svg class="h-5 w-5 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      warning: '<svg class="h-5 w-5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      danger:  '<svg class="h-5 w-5 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info:    '<svg class="h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    };

    const div = document.createElement('div');
    const baseClasses = 'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-xs font-bold pointer-events-auto transition-all duration-200 transform translate-y-0 opacity-100';
    const typeClasses = {
      success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/80 dark:border-green-900/50 dark:text-green-200',
      warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/80 dark:border-amber-900/50 dark:text-amber-200',
      danger:  'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/80 dark:border-red-900/50 dark:text-red-200',
      info:    'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/80 dark:border-blue-900/50 dark:text-blue-200'
    };
    div.className = `${baseClasses} ${typeClasses[tipo] || typeClasses.info} animate-toast-in`;
    div.innerHTML = `${iconos[tipo] || iconos.info}<span>${mensaje}</span>`;
    container.appendChild(div);

    setTimeout(() => {
      div.classList.remove('animate-toast-in');
      div.classList.add('animate-toast-out');
      div.addEventListener('animationend', () => div.remove(), { once: true });
      setTimeout(() => { if (div.parentNode) div.remove(); }, 250);
    }, ms);
  },

  /** Clona profundamente un objeto JSON-serializable */
  clonar(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /** Escapa HTML para evitar XSS al insertar texto en innerHTML */
  escaparHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /** Detecta si el dispositivo es móvil */
  esMobil() {
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
  }
};


/* ───────────────────────────────────────────────────────────────
   CONFIG — Carga y acceso a los 4 JSON de configuración
   Estrategia: primero localStorage (override Admin), luego fetch
──────────────────────────────────────────────────────────────── */
const Config = (() => {

  const LS_KEY_PREFIX = 'fmhse022_config_';
  const BASE_PATH     = './config/';

  // Almacén interno una vez cargado
  let _data = {
    configuracion: null,
    peligros:      null,
    controles:     null,
    matriz:        null,
    tiposTrabajo:  null,
    responsables:  []
  };

  /** Carga un JSON: primero override de localStorage, luego fetch */
  async function _cargarArchivo(nombre) {
    const lsKey = `${LS_KEY_PREFIX}${nombre}`;
    const override = localStorage.getItem(lsKey);
    if (override) {
      try {
        console.info(`[Config] Usando override Admin para: ${nombre}`);
        return JSON.parse(override);
      } catch (e) {
        console.warn(`[Config] Override inválido para ${nombre}, usando archivo base.`);
        localStorage.removeItem(lsKey);
      }
    }
    const resp = await fetch(`${BASE_PATH}${nombre}.json`);
    if (!resp.ok) throw new Error(`[Config] No se pudo cargar ${nombre}.json (${resp.status})`);
    return resp.json();
  }

  /** Carga todos los JSON en paralelo */
  async function cargarTodo() {
    const [configuracion, peligros, controles, matriz, tiposTrabajo, responsables] = await Promise.all([
      _cargarArchivo('configuracion'),
      _cargarArchivo('peligros'),
      _cargarArchivo('controles'),
      _cargarArchivo('matriz-peligro-control'),
      _cargarArchivo('tipos-trabajo'),
      _cargarArchivo('responsables').catch(() => [])
    ]);
    _data.configuracion = configuracion;
    _data.peligros      = peligros;
    _data.controles     = controles;
    _data.matriz        = matriz;
    _data.tiposTrabajo  = tiposTrabajo;
    _data.responsables  = responsables || [];
    _validarCatalogoTiposTrabajo();
    console.info('[Config] Todos los archivos cargados correctamente.');
  }

  /**
   * Validación defensiva del catálogo de Tipos de Trabajo (Fase 1.2).
   * Genera advertencias de configuración SIN bloquear la aplicación:
   *   - IDs duplicados
   *   - peligroTT inexistente en peligros.json
   *   - campos obligatorios faltantes
   *   - órdenes duplicados
   */
  function _validarCatalogoTiposTrabajo() {
    try {
      const cat = _data.tiposTrabajo;
      if (!cat || !Array.isArray(cat.tiposTrabajo)) {
        console.warn('[Config] tipos-trabajo.json ausente o malformado: catálogo de Tipos de Trabajo no disponible.');
        return;
      }
      const lista = cat.tiposTrabajo;
      const OBLIGATORIOS = ['id', 'label', 'peligroTT', 'orden'];
      const idsVistos = new Set();
      const ordenesVistos = new Set();
      // Defensa adicional: si peligros.json está ausente o malformado, getPeligros()
      // podría no devolver un array; se degrada a conjunto vacío sin lanzar.
      const peligrosLista = getPeligros();
      const codigosPeligro = new Set(
        Array.isArray(peligrosLista) ? peligrosLista.map(p => p && p.codigo) : []
      );
      if (!Array.isArray(peligrosLista) || codigosPeligro.size === 0) {
        console.warn('[Config] peligros.json ausente o sin códigos: no se pudo verificar el mapeo peligroTT de los Tipos de Trabajo.');
      }

      lista.forEach((tt, i) => {
        if (!tt || typeof tt !== 'object') {
          console.warn(`[Config] Tipo de Trabajo en índice ${i}: entrada inválida (no es un objeto).`);
          return;
        }
        const ref = tt.id ? `'${tt.id}'` : `índice ${i}`;
        OBLIGATORIOS.forEach(campo => {
          if (tt[campo] === undefined || tt[campo] === null || tt[campo] === '') {
            console.warn(`[Config] Tipo de Trabajo ${ref}: falta el campo obligatorio '${campo}'.`);
          }
        });
        if (tt.id !== undefined) {
          if (idsVistos.has(tt.id)) {
            console.warn(`[Config] Tipo de Trabajo ${ref}: id duplicado '${tt.id}'.`);
          }
          idsVistos.add(tt.id);
        }
        // Solo se reporta peligroTT inexistente si hubo catálogo de peligros con el cual comparar.
        if (tt.peligroTT && codigosPeligro.size > 0 && !codigosPeligro.has(tt.peligroTT)) {
          console.warn(`[Config] Tipo de Trabajo ${ref}: peligroTT '${tt.peligroTT}' no existe en peligros.json.`);
        }
        if (tt.orden !== undefined && tt.orden !== null) {
          if (ordenesVistos.has(tt.orden)) {
            console.warn(`[Config] Tipo de Trabajo ${ref}: orden duplicado '${tt.orden}'.`);
          }
          ordenesVistos.add(tt.orden);
        }
      });
    } catch (e) {
      // La validación NUNCA debe interrumpir el arranque de la aplicación.
      console.warn('[Config] No se pudo validar el catálogo de Tipos de Trabajo:', e && e.message);
    }
  }

  /** Acceso a una clave de configuracion.json */
  function get(clave) {
    if (!_data.configuracion) return null;
    return _data.configuracion[clave] ?? null;
  }

  /** Listado plano de peligros {codigo, descripcion, categoria, criticidad} */
  function getPeligros() {
    if (!_data.peligros) return [];
    return _data.peligros.flatMap(cat =>
      (cat.peligros || []).map(p => ({ ...p }))
    );
  }

  /** Peligros agrupados por categoría tal como vienen del JSON */
  function getPeligrosPorCategoria() {
    return _data.peligros || [];
  }

  /** Lookup rápido de peligro por código */
  function getPeligro(codigo) {
    return getPeligros().find(p => p.codigo === codigo) || null;
  }

  /** Listado plano de controles */
  function getControles() {
    if (!_data.controles) return [];
    return _data.controles.flatMap(grp =>
      (grp.controles || []).map(c => ({ ...c }))
    );
  }

  /** Controles agrupados por grupo */
  function getControlesPorGrupo() {
    return _data.controles || [];
  }

  /** Lookup rápido de control por código */
  function getControl(codigo) {
    return getControles().find(c => c.codigo === codigo) || null;
  }

  /** Entrada de matriz para un peligro */
  function getMatriz(codigoPeligro) {
    if (!_data.matriz) return null;
    return _data.matriz[codigoPeligro] || null;
  }

  /** Guarda override en localStorage (usado por Admin en Fase 6) */
  function guardarOverride(nombre, datos) {
    localStorage.setItem(`${LS_KEY_PREFIX}${nombre}`, JSON.stringify(datos));
  }

  /** Elimina override y restaura archivo base */
  function eliminarOverride(nombre) {
    localStorage.removeItem(`${LS_KEY_PREFIX}${nombre}`);
  }

  /**
   * Catálogo de Tipos de Trabajo (Fase 1.2).
   * Devuelve la lista ordenada por 'orden'. Solo lectura.
   */
  function getTiposTrabajo() {
    if (!_data.tiposTrabajo || !Array.isArray(_data.tiposTrabajo.tiposTrabajo)) return [];
    return _data.tiposTrabajo.tiposTrabajo
      .slice()
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }

  /**
   * Devuelve el Tipo de Trabajo cuyo peligroTT coincide con el código dado,
   * o null si ninguno mapea a ese peligro. (Fase 1.2)
   */
  function getTipoTrabajoPorPeligro(codigoPeligro) {
    if (!codigoPeligro) return null;
    return getTiposTrabajo().find(tt => tt.peligroTT === codigoPeligro) || null;
  }

  function getResponsables() {
    return _data.responsables || [];
  }

  return {
    cargarTodo,
    get,
    getPeligros, getPeligrosPorCategoria, getPeligro,
    getControles, getControlesPorGrupo, getControl,
    getMatriz,
    getTiposTrabajo, getTipoTrabajoPorPeligro,
    getResponsables,
    guardarOverride, eliminarOverride
  };
})();


/* ───────────────────────────────────────────────────────────────
   STATE — AppState centralizado + persistencia localStorage
──────────────────────────────────────────────────────────────── */
const State = (() => {

  const LS_KEY_DRAFT = 'fmhse022_draft';
  const VERSION      = '2.1';

  /** Estructura canónica de un estado vacío */
  function _estadoVacio() {
    return {
      _meta: {
        version:       VERSION,
        app:           'FM-HSE-022',
        creadoEn:      new Date().toISOString(),
        modificadoEn:  new Date().toISOString()
      },
      general: {
        lugar: '',
        fecha: '',
        tarea: ''
      },
      responsables: [],
      puntoEncuentro: '',
      duchaLavaojos: '',
      tiposTrabajo: [],         // IDs de tipos-trabajo.json seleccionados globalmente (Fase 1.3)
      senalesParada: {
        seleccionadas: [],    // IDs de checkboxes marcados
        textos: {}            // { id: texto } para los "Otros"
      },
      pasos: [],
      aprobacion: {
        nombreSupervisor: '',
        observaciones:    '',
        estado:           null   // null | 'aprobado' | 'requiere_correccion'
      },
      identificacion: {
        areaEjecutora: '',
        consecutivo:   '',
        nombreArchivo: '',
        modoPDF:       'corporativo'
      }
    };
  }

  let _estado = _estadoVacio();
  let _listeners = {};   // { evento: [fn, ...] }

  /** Emite un evento interno al estado */
  function _emit(evento, payload) {
    (_listeners[evento] || []).forEach(fn => {
      try { fn(payload); } catch (e) { console.error(`[State] Error en listener '${evento}':`, e); }
    });
    // Siempre emitir 'change' para autosave
    if (evento !== 'change') {
      (_listeners['change'] || []).forEach(fn => {
        try { fn({ evento, payload }); } catch (e) { console.error('[State] Error en listener change:', e); }
      });
    }
  }

  /** Suscribe un listener a un evento del estado */
  function on(evento, fn) {
    if (!_listeners[evento]) _listeners[evento] = [];
    _listeners[evento].push(fn);
  }

  /** Lee una clave del estado (soporta dot-notation: 'general.lugar') */
  function get(clave) {
    if (!clave) return Utils.clonar(_estado);
    const partes = clave.split('.');
    let cur = _estado;
    for (const p of partes) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[p];
    }
    return cur != null ? Utils.clonar(cur) : cur;
  }

  /** Actualiza una clave del estado y emite el evento correspondiente */
  function set(clave, valor, evento = 'update') {
    const partes = clave.split('.');
    let cur = _estado;
    for (let i = 0; i < partes.length - 1; i++) {
      if (cur[partes[i]] == null) cur[partes[i]] = {};
      cur = cur[partes[i]];
    }
    cur[partes[partes.length - 1]] = valor;
    _estado._meta.modificadoEn = new Date().toISOString();
    _emit(evento, { clave, valor });
  }

  /**
   * Normalización defensiva del estado (Fase 1.3).
   * Garantiza que todo estado que entre a la aplicación (borrador de localStorage,
   * importación de Backup o cualquier reemplazo) tenga la forma canónica mínima,
   * añadiendo campos nuevos ausentes SIN alterar los datos existentes.
   * Punto único de normalización: cualquier vía de carga debe pasar por aquí.
   * No muta el objeto recibido; devuelve una copia normalizada.
   */
  function _normalizarEstado(estado) {
    if (!estado || typeof estado !== 'object') return _estadoVacio();
    const norm = estado;
    // Campo nuevo de Fase 1.3: tiposTrabajo[] a nivel global.
    if (!Array.isArray(norm.tiposTrabajo)) {
      norm.tiposTrabajo = [];
    }
    // El esquema de pasos se mantiene intacto: no se toca norm.pasos.
    return norm;
  }

  /** Reemplaza el estado completo (usado en importación y restauración de borrador) */
  function reemplazar(nuevoEstado) {
    _estado = _normalizarEstado(nuevoEstado);
    _estado._meta.modificadoEn = new Date().toISOString();
    _emit('reset', null);
  }

  /** Resetea al estado vacío */
  function resetear() {
    _estado = _estadoVacio();
    _emit('reset', null);
  }

  // ── Persistencia localStorage ──────────────────────────────

  /** Guarda el estado actual en localStorage */
  function guardarBorrador() {
    try {
      localStorage.setItem(LS_KEY_DRAFT, JSON.stringify(_estado));
    } catch (e) {
      // Etapa 2A — Robustez defensiva de almacenamiento (aditiva, sin cambiar
      // el modelo de datos ni las claves). Distingue cuota excedida para avisar
      // al usuario en lugar de fallar silenciosamente; recomienda exportar.
      const esCuota = e && (e.name === 'QuotaExceededError' ||
                            e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                            e.code === 22 || e.code === 1014);
      if (esCuota) {
        console.warn('[State] Cuota de almacenamiento excedida; el borrador no se guardó.');
        try {
          Utils.toast('No se pudo guardar el borrador (almacenamiento lleno). Exporta un respaldo JSON.', 'danger');
        } catch (_) { /* Utils/toast no disponible: degradación silenciosa segura */ }
      } else {
        console.warn('[State] No se pudo guardar en localStorage:', e.message);
      }
    }
  }

  /** Lee el borrador de localStorage; retorna null si no existe o es inválido */
  function leerBorrador() {
    try {
      const raw = localStorage.getItem(LS_KEY_DRAFT);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?._meta?.app !== 'FM-HSE-022') return null;
      return _normalizarEstado(parsed);
    } catch {
      return null;
    }
  }

  /** Elimina el borrador de localStorage */
  function descartarBorrador() {
    localStorage.removeItem(LS_KEY_DRAFT);
  }

  /** Indica si existe un borrador guardado */
  function tieneBorrador() {
    return leerBorrador() !== null;
  }

  return {
    get, set, reemplazar, resetear,
    guardarBorrador, leerBorrador, descartarBorrador, tieneBorrador,
    on,
    _estadoVacio   // expuesto para Backup
  };
})();


/* ───────────────────────────────────────────────────────────────
   MODAL — Diálogo de confirmación genérico reutilizable
──────────────────────────────────────────────────────────────── */
const Modal = (() => {

  let _resolverPromesa = null;

  function _bindOnce() {
    const overlay  = Utils.$el('modal-confirm');
    const btnOk    = Utils.$el('btn-confirm-ok');
    const btnCancel= Utils.$el('btn-confirm-cancel');

    const cerrar = (resultado) => {
      overlay.classList.add('hidden');
      if (_resolverPromesa) {
        _resolverPromesa(resultado);
        _resolverPromesa = null;
      }
    };

    btnOk.addEventListener('click',     () => cerrar(true));
    btnCancel.addEventListener('click', () => cerrar(false));
    overlay.addEventListener('click', e => {
      if (e.target === overlay) cerrar(false);
    });
  }

  /**
   * Muestra el modal de confirmación
   * @returns {Promise<boolean>} true si el usuario confirmó
   */
  function confirmar(titulo, mensaje, { labelOk = 'Confirmar', peligroso = true } = {}) {
    Utils.$el('modal-confirm-title').textContent   = titulo;
    Utils.$el('modal-confirm-message').textContent = mensaje;

    const btnOk = Utils.$el('btn-confirm-ok');
    btnOk.textContent = labelOk;
    btnOk.className   = peligroso
      ? 'bg-red-600 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-md hover:bg-red-700 transition-all active:scale-95 cursor-pointer outline-none'
      : 'bg-primary text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-md hover:opacity-90 transition-all active:scale-95 cursor-pointer outline-none';

    Utils.$el('modal-confirm').classList.remove('hidden');

    return new Promise(resolve => { _resolverPromesa = resolve; });
  }

  return { _bindOnce, confirmar };
})();


/* ───────────────────────────────────────────────────────────────
   BACKUP — Exportación e importación del formulario completo
──────────────────────────────────────────────────────────────── */
const Backup = (() => {

  /** Exporta el AppState como archivo JSON descargable */
  function exportar() {
    const estado    = State.get();
    const area      = estado.identificacion.areaEjecutora || 'FORM';
    const consec    = estado.identificacion.consecutivo   || Utils.generarConsecutivo();
    const nombreBase = `${area}-${consec}`;

    const payload = {
      _meta: {
        version:     '2.1',
        app:         'FM-HSE-022',
        exportadoEn: new Date().toISOString(),
        dispositivo: navigator.userAgent.substring(0, 120)
      },
      state: estado
    };

    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `${nombreBase}-backup.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    Utils.toast('Borrador exportado correctamente.', 'success');
  }

  /**
   * Importa un archivo JSON y reconstruye el formulario
   * @param {File} archivo
   */
  async function importar(archivo) {
    if (!archivo) return;

    let payload;
    try {
      const texto = await archivo.text();
      payload = JSON.parse(texto);
    } catch {
      Utils.toast('El archivo no es un JSON válido.', 'danger');
      return;
    }

    // Validar firma del archivo
    if (payload?._meta?.app !== 'FM-HSE-022') {
      Utils.toast('El archivo no corresponde a un formulario FM-HSE-022.', 'danger');
      return;
    }

    // Validar que tenga estado
    if (!payload?.state?._meta) {
      Utils.toast('El archivo de respaldo está incompleto o corrupto.', 'danger');
      return;
    }

    // Confirmar si el formulario actual tiene datos
    const estadoActual = State.get();
    const tieneData    = estadoActual.general.tarea ||
                         estadoActual.responsables.length > 0 ||
                         estadoActual.pasos.length > 0;

    if (tieneData) {
      const ok = await Modal.confirmar(
        'Importar borrador',
        '¿Reemplazar el formulario actual con el borrador importado? Los datos no guardados se perderán.',
        { labelOk: 'Importar', peligroso: true }
      );
      if (!ok) return;
    }

    State.reemplazar(payload.state);
    State.guardarBorrador();

    const fecha = Utils.formatearFechaHora(payload._meta.exportadoEn);
    Utils.toast(`Formulario importado (exportado el ${fecha}).`, 'success');
  }

  return { exportar, importar };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Theme — Cambio de tema Claro/Oscuro
──────────────────────────────────────────────────────────────── */
const UITheme = (() => {
  const BUTTON_ID = 'btn-toggle-theme';
  
  function _actualizarUI(isDark) {
    const icon = document.getElementById('theme-menu-icon');
    const text = document.getElementById('theme-menu-text');
    
    if (isDark) {
      document.documentElement.classList.add('dark');
      if (icon) icon.textContent = 'light_mode';
      if (text) text.textContent = 'Modo Claro';
    } else {
      document.documentElement.classList.remove('dark');
      if (icon) icon.textContent = 'dark_mode';
      if (text) text.textContent = 'Modo Oscuro';
    }
  }

  function init() {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;
    
    // Cargar e inicializar tema de localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    _actualizarUI(savedTheme === 'dark');
    
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      _actualizarUI(isDark);
      Utils.toast(isDark ? 'Tema oscuro activado' : 'Tema claro activado', 'info');
    });
  }
  
  return { init };
})();


/* ───────────────────────────────────────────────────────────────
   UI.HeaderMenu — Menú Hamburguesa Desplegable
──────────────────────────────────────────────────────────────── */
const UIHeaderMenu = (() => {
  const TRIGGER_ID = 'btn-menu-trigger';
  const DROPDOWN_ID = 'header-dropdown-menu';

  function init() {
    const trigger = document.getElementById(TRIGGER_ID);
    const dropdown = document.getElementById(DROPDOWN_ID);
    if (!trigger || !dropdown) return;

    // Abrir/Cerrar menú al hacer clic en el trigger
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const visible = !dropdown.classList.contains('hidden');
      if (visible) {
        colapsar();
      } else {
        expandir();
      }
    });

    // Colapsar al hacer clic fuera del menú
    document.addEventListener('click', (e) => {
      if (!dropdown.classList.contains('hidden')) {
        const clickedInsideTrigger = trigger.contains(e.target);
        const clickedInsideDropdown = dropdown.contains(e.target);
        if (!clickedInsideTrigger && !clickedInsideDropdown) {
          colapsar();
        }
      }
    });

    // Colapsar al presionar la tecla Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !dropdown.classList.contains('hidden')) {
        colapsar();
      }
    });

    // Cerrar el menú al hacer clic en cualquier botón del dropdown
    dropdown.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        colapsar();
      });
    });
  }

  function expandir() {
    const trigger = document.getElementById(TRIGGER_ID);
    const dropdown = document.getElementById(DROPDOWN_ID);
    if (!trigger || !dropdown) return;
    
    dropdown.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
  }

  function colapsar() {
    const trigger = document.getElementById(TRIGGER_ID);
    const dropdown = document.getElementById(DROPDOWN_ID);
    if (!trigger || !dropdown) return;
    
    dropdown.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
  }

  return { init, expandir, colapsar };
})();


/* ───────────────────────────────────────────────────────────────
   UI.General — SF-01 Información General
──────────────────────────────────────────────────────────────── */
const UIGeneral = (() => {

  const STATUS_ID = 'status-general';
  let _listenersBound = false;

  function _validar(datos) {
    const errores = [];
    if (!datos.lugar || !datos.lugar.trim())   errores.push('Lugar');
    if (!datos.fecha)                          errores.push('Fecha');
    if (!datos.tarea || !datos.tarea.trim())   errores.push('Tarea');
    return errores;
  }

  function _actualizarStatus() {
    const datos  = State.get('general') || { lugar: '', fecha: '', tarea: '' };
    const errores = _validar(datos);
    if (errores.length === 0) {
      Utils.renderStatus(STATUS_ID, 'ok', '✓ Completo');
    } else {
      Utils.renderStatus(STATUS_ID, 'warning', `⚠ ${errores.length} campo${errores.length > 1 ? 's' : ''} pendiente${errores.length > 1 ? 's' : ''}`);
    }
  }

  function _bindEventos() {
    if (_listenersBound) return;
    const inpLugar = document.getElementById('inp-lugar');
    const inpFecha = document.getElementById('inp-fecha');
    const inpTarea = document.getElementById('inp-tarea');
    if (!inpLugar || !inpFecha || !inpTarea) return;

    inpLugar.addEventListener('input', () => {
      State.set('general.lugar', inpLugar.value);
      _actualizarStatus();
    });

    inpFecha.addEventListener('change', () => {
      State.set('general.fecha', inpFecha.value);
      _actualizarStatus();
    });

    inpTarea.addEventListener('input', () => {
      State.set('general.tarea', inpTarea.value);
      _actualizarStatus();
    });

    _listenersBound = true;
  }

  function _poblarDesdeEstado() {
    const datos = State.get('general') || { lugar: '', fecha: '', tarea: '' };
    const inpLugar = document.getElementById('inp-lugar');
    const inpFecha = document.getElementById('inp-fecha');
    const inpTarea = document.getElementById('inp-tarea');
    if (inpLugar) inpLugar.value = datos.lugar || '';
    if (inpFecha) inpFecha.value = datos.fecha || '';
    if (inpTarea) inpTarea.value = datos.tarea || '';
  }

  function render() {
    _poblarDesdeEstado();
    _bindEventos();
    _actualizarStatus();
  }

  function validar() {
    return _validar(State.get('general') || { lugar: '', fecha: '', tarea: '' }).length === 0;
  }

  State.on('reset', render);

  return { render, validar };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Responsables — SF-02 Responsables de la Tarea
──────────────────────────────────────────────────────────────── */
const UIResponsables = (() => {

  const STATUS_ID = 'status-responsables';
  let _listenersBound = false;

  function _htmlFila(resp) {
    const id = Utils.escaparHtml(resp.id);
    const nombre = Utils.escaparHtml(resp.nombre.toUpperCase());
    const cedula = Utils.escaparHtml(resp.cedula);
    
    return `
      <tr class="list-row group hover:bg-slate-50 transition-colors" data-resp-id="${id}">
        <td class="px-2 py-2 text-sm font-semibold text-primary">
          ${nombre}
        </td>
        <td class="px-2 py-2 text-sm font-semibold text-[#171c1f]">
          ${cedula}
        </td>
        <td class="px-2 py-2 text-right">
          <button type="button" class="text-red-600 hover:bg-red-50 p-1 rounded-full transition-colors btn-eliminar-resp" data-id="${id}" title="Eliminar responsable">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </td>
      </tr>`;
  }

  function _actualizarStatus() {
    const cfg      = Config.get('validaciones') || {};
    const minimo   = cfg.minimoResponsables || 1;
    const lista    = State.get('responsables') || [];
    const completos = lista.filter(r => r.nombre.trim() && r.cedula.trim()).length;

    if (completos >= minimo) {
      Utils.renderStatus(STATUS_ID, 'ok', `✓ ${lista.length} responsable${lista.length > 1 ? 's' : ''}`);
    } else {
      Utils.renderStatus(STATUS_ID, 'warning', `⚠ Mínimo ${minimo} requerido${minimo > 1 ? 's' : ''}`);
    }
  }

  async function _eliminarResponsable(id) {
    const lista = State.get('responsables') || [];
    const resp  = lista.find(r => r.id === id);
    if (!resp) return;

    const ok = await Modal.confirmar(
      'Eliminar responsable',
      `¿Desea retirar a "${resp.nombre || 'sin nombre'}" de la lista?`,
      { labelOk: 'Retirar', peligroso: true }
    );
    if (!ok) return;

    const nueva = lista.filter(r => r.id !== id);
    State.set('responsables', nueva, 'responsables:update');
    _renderTabla();
  }

  function _bindEventosTabla() {
    if (_listenersBound) return;

    const btnAdd = document.getElementById('btn-add-responsable');
    btnAdd?.addEventListener('click', () => {
      const nameInp = document.getElementById('resp-nombre');
      const cedInp = document.getElementById('resp-cedula');

      const nombre = nameInp?.value.trim() || '';
      const cedula = cedInp?.value.trim() || '';

      if (!nombre || !cedula) {
        alert('Por favor complete el nombre y la cédula.');
        return;
      }

      const lista = State.get('responsables') || [];
      if (lista.length >= 8) {
        alert('Límite de 8 operarios alcanzado.');
        return;
      }

      lista.push({ id: Utils.uuid(), nombre, cedula });
      State.set('responsables', lista, 'responsables:update');

      if (nameInp) nameInp.value = '';
      if (cedInp) cedInp.value = '';

      _renderTabla();
    });

    const tbody = document.getElementById('tbody-responsables');
    tbody?.addEventListener('click', e => {
      const btn = e.target.closest('.btn-eliminar-resp');
      if (btn) _eliminarResponsable(btn.dataset.id);
    });

    // ── Autocompletado pre-filtrado por área ejecutora ──
    const nameInp = document.getElementById('resp-nombre');
    const cedInp = document.getElementById('resp-cedula');
    const nameAuto = document.getElementById('autocomplete-resp-nombre');
    const cedAuto = document.getElementById('autocomplete-resp-cedula');

    function buscarResponsables(texto) {
      const txt = (texto || '').trim().toLowerCase();
      if (txt.length < 2) return [];
      
      const areaActual = State.get('identificacion.areaEjecutora') || '';
      const listado = Config.getResponsables() || [];
      
      return listado
        .filter(r => r.area === areaActual)
        .filter(r => 
          (r.nombre || '').toLowerCase().includes(txt) ||
          (r.apellido || '').toLowerCase().includes(txt) ||
          (r.cedula || '').toLowerCase().includes(txt)
        )
        .slice(0, 3);
    }

    function renderDropdown(dropdown, input, cedInput, coincidencias) {
      if (!coincidencias.length) {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        return;
      }
      
      dropdown.innerHTML = coincidencias.map(r => {
        const nombreCompleto = `${r.nombre} ${r.apellido}`;
        return `
          <div class="p-2 hover:bg-slate-50 cursor-pointer text-xs flex justify-between items-center text-[#171c1f] font-medium" 
               data-nombre="${Utils.escaparHtml(nombreCompleto)}" 
               data-cedula="${Utils.escaparHtml(r.cedula)}">
            <span>${Utils.escaparHtml(nombreCompleto)}</span>
            <span class="text-[10px] text-slate-500 font-mono">C.C. ${Utils.escaparHtml(r.cedula)}</span>
          </div>`;
      }).join('');
      dropdown.classList.remove('hidden');
    }

    function setupInputAutocomplete(input, dropdown, inputDestino) {
      if (!input || !dropdown) return;
      
      input.addEventListener('input', () => {
        const coincidencias = buscarResponsables(input.value);
        renderDropdown(dropdown, input, inputDestino, coincidencias);
      });

      dropdown.addEventListener('click', e => {
        const item = e.target.closest('[data-nombre]');
        if (item) {
          input.value = item.dataset.nombre;
          inputDestino.value = item.dataset.cedula;
          dropdown.classList.add('hidden');
          dropdown.innerHTML = '';
        }
      });

      document.addEventListener('click', e => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      });
    }

    setupInputAutocomplete(nameInp, nameAuto, cedInp);
    setupInputAutocomplete(cedInp, cedAuto, nameInp);

    _listenersBound = true;
  }

  function _renderTabla() {
    const tbody = document.getElementById('tbody-responsables');
    const container = document.getElementById('table-responsables-container');
    const badge = document.getElementById('responsables-badge');
    const counter = document.getElementById('responsables-counter');
    
    if (!tbody) return;

    const responsables = State.get('responsables') || [];

    if (responsables.length > 0) {
      if (container) container.style.display = 'block';
      tbody.innerHTML = responsables.map(_htmlFila).join('');
    } else {
      if (container) container.style.display = 'none';
      tbody.innerHTML = '';
    }

    if (badge) badge.textContent = `${responsables.length} Miembro${responsables.length !== 1 ? 's' : ''}`;
    if (counter) counter.textContent = `${responsables.length} / 8 registrados`;

    _bindEventosTabla();
    _actualizarStatus();
  }

  function render() {
    _renderTabla();
  }

  function validar() {
    const cfg    = Config.get('validaciones') || {};
    const minimo = cfg.minimoResponsables || 1;
    const lista  = State.get('responsables') || [];
    return lista.filter(r => r.nombre.trim() && r.cedula.trim()).length >= minimo;
  }

  State.on('reset', render);

  return { render, validar };
})();


/* ───────────────────────────────────────────────────────────────
   WIZARD — Navegación paso a paso
   ──────────────────────────────────────────────────────────────── */
const Wizard = (() => {
  let currentStep = 1;
  const totalSteps = 8;
  
  const stepTitles = [
    "Información General",
    "Responsables de la Tarea",
    "Ubicación de Emergencia",
    "Señales para Detener la Tarea",
    "Tipos de Trabajo",
    "Pasos (Análisis de Riesgos)",
    "Resumen Técnico del Análisis",
    "Aprobación y Descarga"
  ];

  function init() {
    const btnPrev = document.getElementById('btn-wizard-prev');
    const btnNext = document.getElementById('btn-wizard-next');

    btnPrev?.addEventListener('click', () => prevStep());
    btnNext?.addEventListener('click', () => nextStep());

    // Navegación directa al hacer clic en las burbujas
    const dotsContainer = document.getElementById('wizard-progress-dots');
    dotsContainer?.addEventListener('click', e => {
      const bubble = e.target.closest('.step-bubble');
      if (bubble) {
        const step = parseInt(bubble.dataset.step, 10);
        if (step >= 1 && step <= totalSteps) {
          mostrarPaso(step);
        }
      }
    });

    // Enlazar botones del Modal de Finalización y Cierre
    const modalFinalizar = document.getElementById('modal-finalizar-app');
    
    document.getElementById('btn-finalizar-cancelar')?.addEventListener('click', () => {
      modalFinalizar?.classList.add('hidden');
    });

    document.getElementById('btn-finalizar-guardar')?.addEventListener('click', () => {
      State.guardarBorrador();
      modalFinalizar?.classList.add('hidden');
      Utils.toast('Progreso guardado de forma local.', 'success');
      
      // Intentar cerrar la ventana/app
      window.close();
      
      // Si la ventana sigue abierta, mostrar pantalla de salida segura
      setTimeout(() => {
        document.body.innerHTML = `
          <div class="fixed inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#00193c] text-white">
            <span class="material-symbols-outlined text-[64px] text-green-400 mb-4 animate-bounce">check_circle</span>
            <h1 class="text-xl font-bold uppercase tracking-wider">¡Formulario Guardado!</h1>
            <p class="text-xs text-slate-300 mt-2 max-w-[280px]">El progreso actual ha sido guardado de forma segura en este dispositivo.</p>
            <p class="text-xs text-slate-400 mt-4">Ya puede salir de la aplicación o cerrar esta pestaña de su navegador.</p>
            <button onclick="location.reload()" class="mt-6 bg-[#fcd400] text-primary text-xs font-bold py-2 px-5 rounded-lg shadow-md cursor-pointer hover:bg-[#e0bd00] transition-colors">Volver a Empezar</button>
          </div>
        `;
      }, 500);
    });

    document.getElementById('btn-finalizar-descartar')?.addEventListener('click', () => {
      State.descartarBorrador();
      State.resetear();
      modalFinalizar?.classList.add('hidden');
      Utils.toast('Formulario borrado. Restableciendo...', 'info');
      setTimeout(() => {
        location.reload();
      }, 800);
    });

    mostrarPaso(1);
  }

  function mostrarPaso(paso) {
    currentStep = paso;
    
    for (let i = 1; i <= totalSteps; i++) {
      const stepEl = document.getElementById(`step-${i}`);
      if (stepEl) {
        if (i === currentStep) {
          stepEl.classList.add('active');
          stepEl.classList.remove('hidden');
        } else {
          stepEl.classList.remove('active');
          stepEl.classList.add('hidden');
        }
      }
    }

    // Actualizar Título
    const titleEl = document.getElementById('wizard-progress-title');
    if (titleEl) {
      titleEl.textContent = `PANTALLA ${currentStep} DE ${totalSteps}: ${stepTitles[currentStep - 1].toUpperCase()}`;
    }

    // Actualizar Porcentaje y Barra
    const percent = Math.round((currentStep / totalSteps) * 100);
    const percentEl = document.getElementById('wizard-progress-percent');
    if (percentEl) percentEl.textContent = `${percent}%`;

    const barEl = document.getElementById('wizard-progress-bar');
    if (barEl) barEl.style.width = `${percent}%`;

    // Actualizar Burbujas de progreso
    const dotsContainer = document.getElementById('wizard-progress-dots');
    if (dotsContainer) {
      let dotsHtml = '';
      for (let i = 1; i <= totalSteps; i++) {
        if (i === currentStep) {
          dotsHtml += `<button type="button" class="step-bubble p-1 cursor-pointer outline-none focus:outline-none" data-step="${i}">
            <div class="w-6 h-6 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-primary ring-offset-1 transition-all select-none pointer-events-none">${i}</div>
          </button>`;
        } else if (i < currentStep) {
          dotsHtml += `<button type="button" class="step-bubble p-1 cursor-pointer outline-none focus:outline-none" data-step="${i}">
            <div class="w-6 h-6 rounded-full bg-blue-100 text-primary text-[11px] font-bold flex items-center justify-center border border-primary/20 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/30 transition-all select-none pointer-events-none">${i}</div>
          </button>`;
        } else {
          dotsHtml += `<button type="button" class="step-bubble p-1 cursor-pointer outline-none focus:outline-none" data-step="${i}">
            <div class="w-6 h-6 rounded-full bg-slate-100 text-[#43474f] text-[11px] font-semibold flex items-center justify-center border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 transition-all select-none pointer-events-none">${i}</div>
          </button>`;
        }
      }
      dotsContainer.innerHTML = dotsHtml;
    }

    // Configurar Botones Navegación
    const btnPrev = document.getElementById('btn-wizard-prev');
    const btnNext = document.getElementById('btn-wizard-next');

    if (btnPrev) {
      if (currentStep === 1) {
        btnPrev.disabled = true;
        btnPrev.classList.add('opacity-40', 'cursor-not-allowed');
      } else {
        btnPrev.disabled = false;
        btnPrev.classList.remove('opacity-40', 'cursor-not-allowed');
      }
    }

    if (btnNext) {
      if (currentStep === totalSteps) {
        btnNext.innerHTML = `Finalizar <span class="material-symbols-outlined text-[18px]">done_all</span>`;
      } else {
        btnNext.innerHTML = `Siguiente <span class="material-symbols-outlined text-[18px]">arrow_forward</span>`;
      }
    }
  }

  function nextStep() {
    if (currentStep < totalSteps) {
      mostrarPaso(currentStep + 1);
    } else {
      document.getElementById('modal-finalizar-app')?.classList.remove('hidden');
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      mostrarPaso(currentStep - 1);
    }
  }

  return { init, mostrarPaso, getStep: () => currentStep };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Ubicacion — SF-03 Punto de Encuentro + SF-04 Ducha y Lavaojos
──────────────────────────────────────────────────────────────── */
const UIUbicacion = (() => {

  function _htmlSelect(id, opciones, valorActual, labelVacio) {
    const opts = opciones.map(op =>
      `<option value="${Utils.escaparHtml(op)}" ${op === valorActual ? 'selected' : ''}>${Utils.escaparHtml(op)}</option>`
    ).join('');
    return `
      <div class="relative">
        <select id="${id}" class="w-full bg-white border border-slate-200 rounded-lg py-2 pl-3 pr-10 text-sm text-[#171c1f] focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer" aria-required="true">
          <option value="">${Utils.escaparHtml(labelVacio)}</option>
          ${opts}
        </select>
        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">
          arrow_drop_down
        </span>
      </div>`;
  }

  function _renderSeccion(bodyId, selectId, statusId, stateKey, labelTexto, opciones, valorActual, iconName) {
    const body = Utils.$el(bodyId);
    if (!body) return;

    body.innerHTML = `
      <div class="field space-y-2">
        <label class="text-xs font-bold text-primary flex items-center gap-1.5" for="${selectId}">
          <span class="material-symbols-outlined text-[16px] text-accent">${iconName}</span>
          ${Utils.escaparHtml(labelTexto)}
        </label>
        ${_htmlSelect(selectId, opciones, valorActual, `Seleccione ${labelTexto.toLowerCase()}…`)}
      </div>`;

    const select = Utils.$el(selectId);
    if (select) {
      select.addEventListener('change', () => {
        State.set(stateKey, select.value);
        _actualizarStatus(statusId, select.value, labelTexto);
      });
    }
    _actualizarStatus(statusId, valorActual, labelTexto);
  }

  function _actualizarStatus(statusId, valor, label) {
    if (valor && valor.trim()) {
      Utils.renderStatus(statusId, 'ok', `✓ ${Utils.escaparHtml(valor)}`);
    } else {
      Utils.renderStatus(statusId, 'warning', `⚠ Sin seleccionar`);
    }
  }

  function renderEncuentro() {
    const opciones = Config.get('puntosEncuentro') || [];
    const actual   = State.get('puntoEncuentro') || '';
    _renderSeccion(
      'body-encuentro', 'sel-encuentro', 'status-encuentro',
      'puntoEncuentro', 'Punto de Encuentro Cercano', opciones, actual, 'meeting_room'
    );
  }

  function renderDucha() {
    const opciones = Config.get('duchasLavaojos') || [];
    const actual   = State.get('duchaLavaojos') || '';
    _renderSeccion(
      'body-ducha', 'sel-ducha', 'status-ducha',
      'duchaLavaojos', 'Ducha y Lavaojos Cercano', opciones, actual, 'shower'
    );
  }

  function render() {
    renderEncuentro();
    renderDucha();
  }

  function validar() {
    return !!(State.get('puntoEncuentro') && State.get('duchaLavaojos'));
  }

  State.on('reset', render);

  return { render, validar };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Senales — SF-05 Señales para Detener la Tarea
──────────────────────────────────────────────────────────────── */
const UISenales = (() => {

  const BODY_ID   = 'body-senales';
  const STATUS_ID = 'status-senales';
  let _listenersBound = false;

  function _htmlItem(senal, seleccionadas, textos) {
    const id   = Utils.escaparHtml(senal.id);
    const checked = seleccionadas.includes(senal.id);
    const activeClasses = checked 
      ? 'bg-blue-50 border-blue-300 text-primary font-semibold' 
      : 'bg-white border-slate-200 text-[#171c1f]';

    if (senal.tipo === 'checkbox') {
      return `
        <label class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 ${activeClasses}" for="senal-${id}">
          <input
            type="checkbox"
            id="senal-${id}"
            class="senal-check rounded text-primary focus:ring-primary h-4 w-4"
            data-senal-id="${id}"
            ${checked ? 'checked' : ''}
          >
          <span class="text-sm">${Utils.escaparHtml(senal.texto)}</span>
        </label>`;
    }

    // tipo === 'texto' (Otros con campo libre)
    const textoActual = textos[senal.id] || '';
    return `
      <div class="senal-otros-item p-3 rounded-lg border transition-all ${activeClasses}" data-senal-id="${id}">
        <label class="flex items-center gap-3 cursor-pointer" for="senal-${id}">
          <input
            type="checkbox"
            id="senal-${id}"
            class="senal-check rounded text-primary focus:ring-primary h-4 w-4"
            data-senal-id="${id}"
            ${checked ? 'checked' : ''}
          >
          <span class="text-sm">${Utils.escaparHtml(senal.texto)}:</span>
        </label>
        <textarea
          id="senal-texto-${id}"
          class="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171c1f] focus:ring-1 focus:ring-primary focus:border-primary transition-colors mt-2 resize-none overflow-hidden senal-texto min-h-[44px]"
          data-senal-id="${id}"
          placeholder="${Utils.escaparHtml(senal.placeholder || 'Especifique…')}"
          maxlength="20"
          rows="1"
          ${!checked ? 'disabled' : ''}
          aria-label="${Utils.escaparHtml(senal.texto)}"
        >${Utils.escaparHtml(textoActual)}</textarea>
      </div>`;
  }

  function _htmlSeccion(senales, seleccionadas, textos) {
    return senales.map(s => _htmlItem(s, seleccionadas, textos)).join('');
  }

  function _actualizarStatus() {
    const cfg         = Config.get('validaciones') || {};
    const minimo      = cfg.minimoSenalesParada || 2;
    const estado      = State.get('senalesParada');
    const totalMarcadas = (estado.seleccionadas || []).length;

    if (totalMarcadas >= minimo) {
      Utils.renderStatus(STATUS_ID, 'ok', `✓ ${totalMarcadas} seleccionada${totalMarcadas > 1 ? 's' : ''}`);
    } else {
      const falta = minimo - totalMarcadas;
      Utils.renderStatus(STATUS_ID, 'warning', `⚠ Seleccione ${falta} más`);
    }

    // Actualizar contador pequeño de la cinta
    const countText = document.getElementById('senales-counter-text');
    if (countText) {
      countText.textContent = `${totalMarcadas} seleccionada${totalMarcadas !== 1 ? 's' : ''}`;
    }
    const ribbon = document.getElementById('senales-counter-ribbon');
    if (ribbon) {
      if (totalMarcadas >= minimo) {
        ribbon.classList.remove('bg-primary');
        ribbon.classList.add('bg-green-600');
      } else {
        ribbon.classList.remove('bg-green-600');
        ribbon.classList.add('bg-primary');
      }
    }
  }

  function _bindEventos() {
    if (_listenersBound) return;
    const body = Utils.$el(BODY_ID);
    if (!body) return;

    // Delegación: checkboxes de señales
    body.addEventListener('change', e => {
      const el = e.target;

      if (el.classList.contains('senal-check')) {
        const senalId = el.dataset.senalId;
        const estado  = State.get('senalesParada');
        let seleccionadas = [...(estado.seleccionadas || [])];

        // Resaltar visualmente de inmediato
        const parent = el.closest('.senal-otros-item') || el.closest('label');
        if (parent) {
          if (el.checked) {
            parent.classList.remove('bg-white', 'border-slate-200', 'text-[#171c1f]');
            parent.classList.add('bg-blue-50', 'border-blue-300', 'text-primary', 'font-semibold');
          } else {
            parent.classList.remove('bg-blue-50', 'border-blue-300', 'text-primary', 'font-semibold');
            parent.classList.add('bg-white', 'border-slate-200', 'text-[#171c1f]');
          }
        }

        if (el.checked) {
          if (!seleccionadas.includes(senalId)) seleccionadas.push(senalId);
          const inputTexto = Utils.$el(`senal-texto-${senalId}`);
          if (inputTexto) {
            inputTexto.disabled = false;
            inputTexto.focus();
          }
        } else {
          seleccionadas = seleccionadas.filter(id => id !== senalId);
          const inputTexto = Utils.$el(`senal-texto-${senalId}`);
          if (inputTexto) {
            inputTexto.disabled = true;
            inputTexto.value    = '';
            const textos = State.get('senalesParada.textos') || {};
            delete textos[senalId];
            State.set('senalesParada.textos', textos);
          }
        }

        State.set('senalesParada.seleccionadas', seleccionadas);
        _actualizarStatus();
      }
    });

    // Delegación: campos de texto "Otros"
    body.addEventListener('input', e => {
      const el = e.target;
      if (el.classList.contains('senal-texto')) {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';

        const senalId = el.dataset.senalId;
        const textos  = State.get('senalesParada.textos') || {};
        textos[senalId] = el.value;
        State.set('senalesParada.textos', textos);
      }
    });

    _listenersBound = true;
  }

  function render() {
    const body = Utils.$el(BODY_ID);
    if (!body) return;

    const senales       = Config.get('senalesParada') || [];
    const estado        = State.get('senalesParada');
    const seleccionadas = estado.seleccionadas || [];
    const textos        = estado.textos || {};

    body.innerHTML = _htmlSeccion(senales, seleccionadas, textos);
    
    // Auto-ajustar altura inicial de los textareas
    body.querySelectorAll('.senal-texto').forEach(tx => {
      if (tx.value.trim()) {
        tx.style.height = 'auto';
        tx.style.height = tx.scrollHeight + 'px';
      }
    });

    _bindEventos();
    _actualizarStatus();
  }

  function validar() {
    const cfg    = Config.get('validaciones') || {};
    const minimo = cfg.minimoSenalesParada || 2;
    const estado = State.get('senalesParada');
    return (estado.seleccionadas || []).length >= minimo;
  }

  State.on('reset', render);

  return { render, validar };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Completitud — SF-17 Indicador de estado por paso
   Evalúa en tiempo real y retorna { estado, texto, clase }
   Preparada para recibir validaciones de peligros y controles
   en Fase 3B sin modificar su interfaz pública.
──────────────────────────────────────────────────────────────── */
const UICompletitud = (() => {

  /**
   * Evalúa el estado de completitud de un paso.
   * Criterios activos desde Fase 3B:
   *   - Descripción: texto no vacío
   *   - Peligros:    al menos 1 código en paso.peligros
   *   - Controles:   al menos 1 código activo en paso.controles
   *                  (un control con eliminadoPorUsuario:true con justificación
   *                   cuenta como "atendido" — no bloquea la completitud)
   *
   * @param {Object} paso  Objeto paso del AppState
   * @returns {{ estado: string, texto: string, clase: string, icono: string }}
   */
  function evaluar(paso) {
    const tieneDescripcion = !!(paso.descripcion && paso.descripcion.trim());
    const tienePeligros    = Array.isArray(paso.peligros)  && paso.peligros.length > 0;

    const controlesActivos = Array.isArray(paso.controles) ? paso.controles : [];
    const justificaciones  = Array.isArray(paso.justificaciones) ? paso.justificaciones : [];

    // Fase 1.5 — Exigibilidad real basada en Matrix.
    // Un control obligatorio derivado de los peligros del paso se considera
    // "atendido" si está seleccionado (en paso.controles) o si tiene una
    // justificación de omisión registrada. Un obligatorio ni seleccionado ni
    // justificado es un FALTANTE que bloquea la completitud.
    const peligros = Array.isArray(paso.peligros) ? paso.peligros : [];
    const sugerencias = peligros.length > 0
      ? Matrix.calcular(peligros)
      : { obligatorios: new Set(), recomendados: new Set() };
    const obligatorios = Array.from(sugerencias.obligatorios || []);
    const estaSeleccionado = cod => controlesActivos.includes(cod);
    const estaJustificado  = cod => justificaciones.some(
      j => j.control === cod && j.eliminadoPorUsuario && j.justificacion
    );
    const obligatoriosFaltantes = obligatorios.filter(
      cod => !estaSeleccionado(cod) && !estaJustificado(cod)
    );
    // Si el paso tiene peligros con obligatorios, la cobertura de esos obligatorios
    // es el criterio. Si no hay obligatorios, se conserva el criterio previo
    // (al menos un control o una justificación) para no exigir de más.
    const tieneControles = obligatorios.length > 0
      ? obligatoriosFaltantes.length === 0
      : (controlesActivos.length > 0 || justificaciones.length > 0);

    const fallas = [];
    if (!tieneDescripcion) fallas.push('descripción');
    if (!tienePeligros)    fallas.push('peligros');
    if (!tieneControles)   fallas.push('controles');

    if (fallas.length === 0) {
      return { estado: 'completo',   texto: '✓ Completo',           clase: 'step-completitud--complete', icono: '✓' };
    }
    if (fallas.length === 1) {
      const mapa = {
        'descripción': '⚠ Sin descripción',
        'peligros':    '⚠ Sin peligros',
        'controles':   '⚠ Sin controles'
      };
      return { estado: 'pendiente',  texto: mapa[fallas[0]],        clase: 'step-completitud--pending',  icono: '⚠' };
    }
    return   { estado: 'incompleto', texto: `⚠ Pendiente (${fallas.length})`, clase: 'step-completitud--error', icono: '⚠' };
  }

  /** Resumen global para el encabezado de la sección */
  function resumenGlobal() {
    const pasos = State.get('pasos') || [];
    let completos = 0, pendientes = 0;
    pasos.forEach(p => { evaluar(p).estado === 'completo' ? completos++ : pendientes++; });
    return { completos, pendientes, total: pasos.length };
  }

  return { evaluar, resumenGlobal };
})();


/* ───────────────────────────────────────────────────────────────
   UITiposTrabajo — Fase 1.4
   Selección global múltiple de Tipos de Trabajo mediante chips.
   Fuente de datos: Config.getTiposTrabajo() (catálogo, ya ordenado)
                    State.get('tiposTrabajo') (selección persistida).
   Persiste exclusivamente en State.tiposTrabajo[] (IDs del catálogo).
   No crea estructuras de datos nuevas.
──────────────────────────────────────────────────────────────── */
/* ────────────────────────────────────────────────────────────────
   Coherencia — Fase 1.7 (RI-6: coherencia bidireccional TT global ↔ paso).
   Capa de CÁLCULO PURA (RI-8): sin DOM, sin efectos secundarios, sin
   mutación. Deriva D y U y devuelve un objeto de resultado. NO persiste
   nada (RI-7): D y U se recalculan en cada evaluación y NO se almacenan.

   D = conjunto de IDs declarados globalmente (State.tiposTrabajo[]).
   U = conjunto de IDs de Tipos de Trabajo realmente usados en los pasos,
       obtenidos EXCLUSIVAMENTE mediante Config.getTipoTrabajoPorPeligro()
       sobre cada código de paso.peligros[].

   IMPORTANTE (observación de auditoría): los peligros TT37 (Estática),
   TT38 (Herramientas eléctricas) y TT39 (Baja/media tensión) tienen
   prefijo "TT" pero NO pertenecen al catálogo de Tipos de Trabajo
   (solo TT32-TT36 lo hacen). La derivación de U usa el catálogo, nunca
   el prefijo: getTipoTrabajoPorPeligro devuelve null para TT37/38/39, que
   por tanto se ignoran correctamente. Prohibido identificar TT por prefijo.

   Coherencia: D = U  ⇔  (U ⊆ D) ∧ (D ⊆ U).
   ──────────────────────────────────────────────────────────────── */
const Coherencia = (() => {

  // Deriva D: IDs de TT declarados globalmente (lectura de State).
  function _declarados() {
    const ids = State.get('tiposTrabajo') || [];
    return new Set(Array.isArray(ids) ? ids : []);
  }

  // Deriva U: IDs de TT usados en los pasos, vía catálogo (nunca por prefijo).
  function _usados() {
    const usados = new Set();
    const pasos  = State.get('pasos') || [];
    pasos.forEach(paso => {
      const peligros = Array.isArray(paso.peligros) ? paso.peligros : [];
      peligros.forEach(codigo => {
        // getTipoTrabajoPorPeligro devuelve el TT del catálogo o null.
        // TT37/38/39 (no catalogados) devuelven null → se ignoran.
        const tt = Config.getTipoTrabajoPorPeligro(codigo);
        if (tt && tt.id) usados.add(tt.id);
      });
    });
    return usados;
  }

  // Evaluación pura de coherencia. Devuelve un objeto efímero (no persistido).
  function evaluar() {
    const D = _declarados();
    const U = _usados();
    const usadosSinDeclarar  = [...U].filter(id => !D.has(id)); // viola Regla 1 (U ⊆ D)
    const declaradosSinUsar  = [...D].filter(id => !U.has(id)); // viola Regla 2 (D ⊆ U)
    return {
      coherente:          usadosSinDeclarar.length === 0 && declaradosSinUsar.length === 0,
      usadosSinDeclarar,
      declaradosSinUsar
    };
  }

  return { evaluar };
})();

/* ────────────────────────────────────────────────────────────────
   AuditoriaConsolidada — Fase 1.8 (supervisión consolidada de Etapa 1).
   Capa de CÁLCULO PURA (RI-8): sin DOM, sin render, sin State.set, sin
   side effects. NO persiste su resultado (RI-7/RI-9): deriva en cada
   llamada de las fuentes existentes y NO almacena.

   NO reimplementa cálculos base (RI-10): consume
     - UICompletitud.resumenGlobal()  → dimensión global de completitud
     - Coherencia.evaluar()           → dimensión de coherencia D=U
     - UITiposTrabajo.validar()       → ≥1 TT declarado
     - Matrix / Config.getMatriz()    → obligatorios por unidad (fuente única)

   RA-1.8 (atribución): los obligatorios de una unidad TT se obtienen
   EXCLUSIVAMENTE de Config.getMatriz(peligroTT). Nunca por prefijo, ni
   por nombre, ni por criticidad.

   Caso de borde TT37/TT38/TT39: no pertenecen al catálogo de Tipos de
   Trabajo. La identificación de unidades parte del catálogo
   (Config.getTiposTrabajo), por lo que esos códigos nunca son unidades.
   En la detección de presencia se usa Config.getTipoTrabajoPorPeligro,
   que devuelve null para ellos → se ignoran (igual que en Fase 1.7).

   Criterio canónico de estado de control (deuda técnica aceptada,
   Addendum 1.8): aplicado idéntico al de UICompletitud y _htmlItem.
     seleccionado = paso.controles.includes(codigo)
     justificado  = ∃ j ∈ paso.justificaciones :
                      j.control === codigo ∧ j.eliminadoPorUsuario ∧ j.justificacion
     faltante     = obligatorio ∧ ¬seleccionado ∧ ¬justificado
   ──────────────────────────────────────────────────────────────── */
const AuditoriaConsolidada = (() => {

  // Criterio canónico — estado de un control en un paso (solo lectura).
  function _estaSeleccionado(paso, codigo) {
    return Array.isArray(paso.controles) && paso.controles.includes(codigo);
  }
  function _estaJustificado(paso, codigo) {
    return Array.isArray(paso.justificaciones) && paso.justificaciones.some(
      j => j && j.control === codigo && j.eliminadoPorUsuario && j.justificacion
    );
  }

  // auditarUnidad(peligroTT) — GENÉRICA, parametrizada por la unidad
  // (código de peligro TT del catálogo). No acoplada a ningún TT fijo.
  // Consolida el estado de los obligatorios de la unidad a través de los
  // pasos donde aparece, conservando la distribución por paso. RA-1.8: los
  // obligatorios salen de Config.getMatriz(peligroTT), no de agregación.
  function auditarUnidad(peligroTT) {
    if (!peligroTT) return null;
    const entrada      = Config.getMatriz(peligroTT);
    const obligatorios = (entrada && Array.isArray(entrada.obligatorios))
      ? entrada.obligatorios.slice()
      : [];
    const pasos = State.get('pasos') || [];
    const porPaso = []; // distribución observacional por paso
    pasos.forEach((paso, idx) => {
      const peligros = Array.isArray(paso.peligros) ? paso.peligros : [];
      if (!peligros.includes(peligroTT)) return; // la unidad no aparece en este paso
      const seleccionados = [];
      const justificados  = [];
      const faltantes     = [];
      obligatorios.forEach(cod => {
        if (_estaSeleccionado(paso, cod))      seleccionados.push(cod);
        else if (_estaJustificado(paso, cod))  justificados.push(cod);
        else                                   faltantes.push(cod); // obligatorio ∧ ¬sel ∧ ¬just
      });
      porPaso.push({ pasoIndex: idx, seleccionados, justificados, faltantes });
    });
    // Consolidación: un obligatorio está cubierto si en TODOS los pasos donde
    // la unidad aparece está seleccionado o justificado. Derivado, no autoritativo.
    const totalFaltantes = porPaso.reduce((n, p) => n + p.faltantes.length, 0);
    return {
      peligroTT,
      obligatorios,
      pasosConUnidad: porPaso.length,
      porPaso,
      completa: porPaso.length > 0 && totalFaltantes === 0,
      sinUso:   porPaso.length === 0
    };
  }

  // evaluarGlobal() — consolidación de supervisión. Combina las dimensiones
  // existentes SIN recalcularlas. Informativa: no bloquea, sin porcentajes
  // como criterio de aprobación, criterio humano final.
  function evaluarGlobal() {
    const completitud = UICompletitud.resumenGlobal();           // {completos, pendientes, total}
    const coherencia  = Coherencia.evaluar();                    // {coherente, ...}
    const ttValido    = UITiposTrabajo.validar();                // ≥1 TT declarado

    // Auditoría por unidad: solo TT declarados globalmente, mapeando id→peligroTT
    // vía catálogo (RA-1.8 / caso TT37-39: solo catalogados son unidades).
    const declarados  = State.get('tiposTrabajo') || [];
    const catalogo    = Config.getTiposTrabajo() || [];
    const porId       = new Map(catalogo.map(tt => [tt.id, tt.peligroTT]));
    const unidades    = declarados
      .map(id => porId.get(id))
      .filter(peligroTT => !!peligroTT)        // ignora ids sin mapeo
      .map(peligroTT => auditarUnidad(peligroTT));

    return {
      completitud,
      coherencia,
      ttValido,
      unidades   // detalle por TT declarado; informativo
    };
  }

  return { auditarUnidad, evaluarGlobal };
})();

const UITiposTrabajo = (() => {

  const BODY_ID   = 'body-tipos-trabajo';
  const STATUS_ID = 'status-tipos-trabajo';
  let _listenersBound = false;

  // ── HTML de un chip ──────────────────────────────────────
  function _htmlChip(tt, seleccionado) {
    const id    = Utils.escaparHtml(tt.id);
    const label = Utils.escaparHtml(tt.label);
    const desc  = Utils.escaparHtml(tt.descripcion || '');
    const idCheckbox = `tt-${id}`;
    const activeClasses = seleccionado 
      ? 'bg-blue-50 border-blue-300 text-primary' 
      : 'bg-white border-slate-200 text-[#171c1f]';

    return `
      <label class="flex flex-col p-2.5 rounded-lg border transition-all hover:bg-slate-50 cursor-pointer ${activeClasses}" for="${idCheckbox}" title="${desc}">
        <div class="flex items-center gap-3">
          <input
            type="checkbox"
            id="${idCheckbox}"
            class="tt-check rounded text-primary focus:ring-primary h-4 w-4 shrink-0"
            data-tt-id="${id}"
            ${seleccionado ? 'checked' : ''}
            aria-label="${label} - ${desc}"
          >
          <span class="text-xs font-bold uppercase tracking-tight">${label}</span>
        </div>
        <p class="text-[10px] text-[#43474f] mt-1 pl-7 leading-normal">${desc}</p>
      </label>`;
  }

  // ── HTML del contenedor de chips ─────────────────────────
  function _htmlChips(catalogo, seleccionados) {
    if (!catalogo.length) {
      return '<p class="text-xs text-[#43474f]">No hay Tipos de Trabajo configurados.</p>';
    }
    const chips = catalogo
      .map(tt => _htmlChip(tt, seleccionados.includes(tt.id)))
      .join('');
    return `<div class="grid grid-cols-1 gap-2" id="tt-chips" role="group" aria-label="Tipos de Trabajo">${chips}</div>`;
  }

  // ── Estado visual (Completo / Pendiente) ─────────────────
  function _actualizarStatus() {
    const ok = validar();
    const seleccionados = State.get('tiposTrabajo') || [];

    // Actualizar contador pequeño en el encabezado
    const badge = document.getElementById('tt-counter-badge');
    if (badge) {
      badge.textContent = seleccionados.length;
      if (seleccionados.length > 0) {
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    if (!ok) {
      Utils.renderStatus(STATUS_ID, 'warning', 'Pendiente');
      return;
    }

    // Fase 1.7 — Presentación de coherencia bidireccional (RI-6).
    const coh = Coherencia.evaluar();
    if (coh.coherente) {
      Utils.renderStatus(STATUS_ID, 'ok', 'Completo');
    } else {
      Utils.renderStatus(STATUS_ID, 'warning', 'Revisar coherencia TT');
    }
  }

  // ── Toggle de selección de un TT ─────────────────────────
  function _toggle(ttId) {
    const seleccionados = (State.get('tiposTrabajo') || []).slice();
    const idx = seleccionados.indexOf(ttId);
    if (idx === -1) {
      seleccionados.push(ttId);
    } else {
      seleccionados.splice(idx, 1);
    }
    State.set('tiposTrabajo', seleccionados, 'tiposTrabajo:update');
    _render();
  }

  // ── Binding por delegación de eventos ───────
  function _bindEventos() {
    if (_listenersBound) return;
    const body = Utils.$el(BODY_ID);
    if (!body) return;
    body.addEventListener('change', (e) => {
      const el = e.target;
      if (!el.classList.contains('tt-check')) return;
      _toggle(el.getAttribute('data-tt-id'));
    });
    _listenersBound = true;
  }

  // ── Render ───────────────────────────────────────────────
  function _render() {
    const body = Utils.$el(BODY_ID);
    if (!body) return;
    const catalogo      = Config.getTiposTrabajo();            // ya ordenado por 'orden'
    const seleccionados = State.get('tiposTrabajo') || [];
    body.innerHTML = _htmlChips(catalogo, seleccionados);
    _bindEventos();
    _actualizarStatus();
  }

  function render() {
    _render();
  }

  // ── Validación: ≥1 Tipo de Trabajo seleccionado ──────────
  function validar() {
    const seleccionados = State.get('tiposTrabajo') || [];
    return seleccionados.length > 0;
  }

  State.on('reset', render);
  State.on('pasos:update', _actualizarStatus);

  return { render, validar };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Pasos — SF-06 Motor de pasos
   Operaciones: agregar, editar, duplicar, eliminar, reordenar,
   expandir/colapsar. Integra UICompletitud para badges visuales.
──────────────────────────────────────────────────────────────── */
const UIPasos = (() => {

  const _expandidos = new Set();
  let _listenersBound = false;

  function _nuevoPaso(numero) {
    return {
      id:             Utils.uuid(),
      numero:         numero,
      descripcion:    '',
      peligros:       [],
      controles:      [],
      justificaciones: []
    };
  }

  function _htmlAcciones(paso, idx, total) {
    const esPrimero = idx === 0;
    const esUltimo  = idx === total - 1;
    const idEsc     = Utils.escaparHtml(paso.id);

    return `
      <div class="flex items-center gap-1 shrink-0 ml-2">
        <button type="button"
          class="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-primary transition-colors disabled:opacity-30 disabled:pointer-events-none"
          data-action="up" data-id="${idEsc}"
          title="Mover arriba"
          aria-label="Mover paso arriba"
          ${esPrimero ? 'disabled' : ''}>
          <span class="material-symbols-outlined text-[16px] pointer-events-none font-black">arrow_upward</span>
        </button>
        <button type="button"
          class="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-primary transition-colors disabled:opacity-30 disabled:pointer-events-none"
          data-action="down" data-id="${idEsc}"
          title="Mover abajo"
          aria-label="Mover paso abajo"
          ${esUltimo ? 'disabled' : ''}>
          <span class="material-symbols-outlined text-[16px] pointer-events-none font-black">arrow_downward</span>
        </button>
        <button type="button"
          class="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-primary transition-colors"
          data-action="duplicate" data-id="${idEsc}"
          title="Duplicar paso"
          aria-label="Duplicar paso">
          <span class="material-symbols-outlined text-[16px] pointer-events-none">content_copy</span>
        </button>
        <button type="button"
          class="p-1 hover:bg-red-50 rounded text-red-500 hover:text-red-700 transition-colors"
          data-action="delete" data-id="${idEsc}"
          title="Eliminar paso"
          aria-label="Eliminar paso">
          <span class="material-symbols-outlined text-[16px] pointer-events-none">delete</span>
        </button>
      </div>`;
  }

  function _htmlContadores(paso) {
    const np = paso.peligros.length;
    const nc = paso.controles.length;
    const badgeP = np > 0 ? 'bg-blue-100 text-primary font-bold' : 'bg-slate-100 text-slate-500';
    const badgeC = nc > 0 ? 'bg-indigo-100 text-indigo-700 font-bold' : 'bg-slate-100 text-slate-500';
    return `
      <div class="flex items-center gap-1.5 mt-0.5 step-counters-container">
        <span class="text-[9px] px-1.5 py-0.5 rounded ${badgeP}">
          ${np} Peligro${np !== 1 ? 's' : ''}
        </span>
        <span class="text-[9px] px-1.5 py-0.5 rounded ${badgeC}">
          ${nc} Control${nc !== 1 ? 'es' : ''}
        </span>
      </div>`;
  }

  function _htmlSubpanel(paso, tipo) {
    const esPeligros = tipo === 'peligros';
    const titulo     = esPeligros ? 'Peligros del Paso' : 'Medidas de Control';
    const count      = esPeligros ? paso.peligros.length : paso.controles.length;
    const idEsc      = Utils.escaparHtml(paso.id);

    return `
      <div class="border border-slate-200 rounded-lg overflow-hidden bg-white" id="subpanel-${tipo}-${idEsc}">
        <div class="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer select-none"
          data-subpanel="${tipo}" data-id="${idEsc}"
          role="button" tabindex="0"
          aria-expanded="false">
          <div class="flex items-center gap-1.5 pointer-events-none">
            <span class="material-symbols-outlined text-slate-500 text-[18px]">
              ${esPeligros ? 'warning' : 'shield'}
            </span>
            <span class="text-xs font-bold text-primary">${titulo}</span>
            <span class="bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono shrink-0" id="subpanel-count-${tipo}-${idEsc}">${count}</span>
          </div>
          <span class="material-symbols-outlined text-slate-400 text-[18px] transition-transform duration-300 subpanel-chevron">
            keyboard_arrow_right
          </span>
        </div>
        <div class="hidden border-t border-slate-100 p-3 bg-white" id="subpanel-body-${tipo}-${idEsc}">
          <!-- Renderizado bajo demanda por UIPeligros / UIControles -->
        </div>
      </div>`;
  }

  function _htmlPaso(paso, idx, total) {
    const idEsc      = Utils.escaparHtml(paso.id);
    const estaAbierto = _expandidos.has(paso.id);
    const completitud = UICompletitud.evaluar(paso);
    const borderClass = completitud.estado === 'completo' ? 'border-green-300 bg-green-50/5' : 'border-slate-200 bg-white';

    const tituloDesc  = paso.descripcion.trim()
      ? Utils.escaparHtml(paso.descripcion)
      : null;

    const completitudBadge = completitud.estado === 'completo'
      ? `<span class="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
          <span class="material-symbols-outlined text-[10px] font-bold">check</span> Completo
         </span>`
      : `<span class="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
          <span class="material-symbols-outlined text-[10px] font-bold">warning</span> Pendiente
         </span>`;

    return `
      <article
        class="rounded-lg border custom-shadow p-3.5 flex flex-col gap-3 transition-all duration-300 step-card ${estaAbierto ? 'step-card--open' : ''} ${borderClass}"
        id="step-card-${idEsc}"
        data-step-id="${idEsc}"
        role="listitem">

        <!-- CABECERA -->
        <div class="flex flex-col gap-2.5 cursor-pointer select-none"
          data-action="toggle" data-id="${idEsc}"
          role="button"
          tabindex="0"
          aria-expanded="${estaAbierto}"
          aria-controls="step-body-${idEsc}">

          <!-- Fila 1: Número y Descripción del Paso (Ancho Completo) -->
          <div class="flex items-start gap-2.5">
            <div class="w-6 h-6 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
              ${paso.numero}
            </div>
            <div class="flex-1 min-w-0 step-title-text text-xs font-bold text-primary whitespace-pre-wrap break-words ${tituloDesc ? '' : 'italic text-slate-400'}">
              ${tituloDesc || 'Describa este paso...'}
            </div>
          </div>

          <!-- Fila 2: Estados, Contadores y Acciones (Ubicadas debajo de la descripción) -->
          <div class="flex items-center justify-between gap-2 flex-wrap border-t border-slate-100/50 pt-2">
            <!-- Izquierda: Estado y Contadores -->
            <div class="flex items-center gap-2 flex-wrap">
              <div class="completitud-badge-container">
                ${completitudBadge}
              </div>
              ${_htmlContadores(paso)}
            </div>
            
            <!-- Derecha: Chevron y Botones de control -->
            <div class="flex items-center gap-1.5 ml-auto">
              <!-- Chevron expandible -->
              <span class="material-symbols-outlined text-slate-400 text-[18px] transition-transform duration-300 chevron-icon ${estaAbierto ? 'rotate-180' : ''}">
                keyboard_arrow_down
              </span>
              
              <!-- Separador vertical sutil -->
              <span class="w-[1px] h-3.5 bg-slate-200 block mx-0.5"></span>
              
              <!-- Acciones del paso -->
              ${_htmlAcciones(paso, idx, total)}
            </div>
          </div>
        </div>

        <!-- CUERPO (colapsable) -->
        <div class="${estaAbierto ? 'flex flex-col gap-3.5 pt-2 border-t border-slate-100' : 'hidden'}" id="step-body-${idEsc}">

          <!-- Descripción del paso -->
          <div class="space-y-1">
            <label class="block text-[10px] font-bold text-primary uppercase" for="step-desc-${idEsc}">
              Descripción del Paso <span class="text-red-500">*</span>
            </label>
            <textarea
              id="step-desc-${idEsc}"
              class="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-[#171c1f] focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none step-desc-input"
              data-id="${idEsc}"
              placeholder="Describa la actividad específica de este paso…"
              maxlength="300"
              rows="2"
              aria-required="true"
            >${Utils.escaparHtml(paso.descripcion)}</textarea>
          </div>

          <!-- Subpaneles Peligros y Controles -->
          <div class="flex flex-col gap-2">
            ${_htmlSubpanel(paso, 'peligros')}
            ${_htmlSubpanel(paso, 'controles')}
          </div>

        </div>
      </article>`;
  }

  function _htmlListaVacia() {
    return `
      <div class="flex flex-col items-center justify-center p-8 text-center bg-white border border-slate-200 rounded-lg custom-shadow" id="steps-empty-state">
        <span class="material-symbols-outlined text-slate-300 text-[48px] mb-2">assignment_late</span>
        <p class="text-sm font-bold text-primary">Sin pasos definidos</p>
        <p class="text-xs text-slate-500 mt-1 max-w-[240px]">Agregue los pasos de la tarea usando el botón superior.</p>
      </div>`;
  }

  function _renderLista() {
    const lista  = Utils.$el('steps-list');
    const pasos  = State.get('pasos') || [];
    if (!lista) return;

    if (pasos.length === 0) {
      lista.innerHTML = _htmlListaVacia();
    } else {
      lista.innerHTML = pasos
        .map((p, i) => _htmlPaso(p, i, pasos.length))
        .join('');
    }

    _actualizarOverview();
    _actualizarStatusSeccion();
  }

  function _actualizarOverview() {
    const overview = Utils.$el('steps-overview');
    const pasos    = State.get('pasos') || [];

    if (pasos.length === 0) {
      overview?.setAttribute('hidden', '');
      return;
    }

    overview?.removeAttribute('hidden');
    const resumen = UICompletitud.resumenGlobal();
    const elComp  = Utils.$el('steps-counter-complete');
    const elPend  = Utils.$el('steps-counter-pending');
    if (elComp) elComp.textContent = `${resumen.completos} completo${resumen.completos !== 1 ? 's' : ''}`;
    if (elPend) elPend.textContent = `${resumen.pendientes} pendiente${resumen.pendientes !== 1 ? 's' : ''}`;
  }

  function _actualizarStatusSeccion() {
    const pasos   = State.get('pasos') || [];
    const resumen = UICompletitud.resumenGlobal();

    if (pasos.length === 0) {
      Utils.renderStatus('status-pasos', 'warning', '⚠ Sin pasos');
      return;
    }
    if (resumen.pendientes === 0) {
      Utils.renderStatus('status-pasos', 'ok', `✓ ${pasos.length} paso${pasos.length !== 1 ? 's' : ''}`);
    } else {
      Utils.renderStatus('status-pasos', 'warning',
        `${resumen.completos}/${pasos.length} completo${resumen.completos !== 1 ? 's' : ''}`);
    }
  }

  function _actualizarTarjeta(id) {
    const pasos = State.get('pasos') || [];
    const idx   = pasos.findIndex(p => p.id === id);
    if (idx === -1) return;

    const card = document.getElementById(`step-card-${id}`);
    if (!card) { _renderLista(); return; }

    const paso        = pasos[idx];
    const completitud = UICompletitud.evaluar(paso);

    card.classList.toggle('border-green-300', completitud.estado === 'completo');
    card.classList.toggle('bg-green-50/5', completitud.estado === 'completo');
    card.classList.toggle('border-slate-200', completitud.estado !== 'completo');
    card.classList.toggle('bg-white', completitud.estado !== 'completo');

    const titleEl = card.querySelector('.step-title-text');
    if (titleEl) {
      const tituloDesc = paso.descripcion.trim()
        ? Utils.escaparHtml(paso.descripcion)
        : null;
      titleEl.textContent = tituloDesc || 'Describa este paso...';
      titleEl.classList.toggle('italic', !tituloDesc);
      titleEl.classList.toggle('text-slate-400', !tituloDesc);
      titleEl.classList.remove('truncate');
      titleEl.classList.add('whitespace-pre-wrap', 'break-words');
    }

    const compEl = card.querySelector('.completitud-badge-container');
    if (compEl) {
      compEl.innerHTML = completitud.estado === 'completo'
        ? `<span class="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
            <span class="material-symbols-outlined text-[10px] font-bold">check</span> Completo
           </span>`
        : `<span class="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
            <span class="material-symbols-outlined text-[10px] font-bold">warning</span> Pendiente
           </span>`;
    }

    const countContainer = card.querySelector('.step-counters-container');
    if (countContainer) {
      countContainer.innerHTML = _htmlContadores(paso);
    }

    _actualizarOverview();
    _actualizarStatusSeccion();
  }

  function _agregar() {
    const pasos  = State.get('pasos') || [];
    if (pasos.length === 0 && (State.get('tiposTrabajo') || []).length === 0) {
      Utils.toast('Debe seleccionar al menos un Tipo de Trabajo antes de crear pasos.', 'warning');
      return;
    }
    const nuevo  = _nuevoPaso(pasos.length + 1);
    pasos.push(nuevo);
    State.set('pasos', pasos, 'pasos:update');
    _expandidos.add(nuevo.id);
    _renderLista();
    setTimeout(() => {
      const ta = document.getElementById(`step-desc-${nuevo.id}`);
      if (ta) {
        ta.focus();
        ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  }

  function _editar(id, descripcion) {
    const pasos = State.get('pasos') || [];
    const idx   = pasos.findIndex(p => p.id === id);
    if (idx === -1) return;
    pasos[idx].descripcion = descripcion;
    State.set('pasos', pasos, 'pasos:update');
    _actualizarTarjeta(id);
  }

  function _duplicar(id) {
    const pasos = State.get('pasos') || [];
    const idx   = pasos.findIndex(p => p.id === id);
    if (idx === -1) return;

    const origen = pasos[idx];
    const copia  = {
      id:             Utils.uuid(),
      numero:         0,
      descripcion:    origen.descripcion,
      peligros:       [...origen.peligros],
      controles:      [...origen.controles],
      justificaciones: Utils.clonar(origen.justificaciones || [])
    };

    pasos.splice(idx + 1, 0, copia);
    _renumerarPasos(pasos);
    State.set('pasos', pasos, 'pasos:update');

    _expandidos.add(copia.id);
    _renderLista();

    setTimeout(() => {
      const card = document.getElementById(`step-card-${copia.id}`);
      if (card) {
        card.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => card.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 1600);
      }
    }, 50);

    Utils.toast(`Paso ${origen.numero} duplicado como Paso ${copia.numero}.`, 'info');
  }

  async function _eliminar(id) {
    const pasos = State.get('pasos') || [];
    const paso  = pasos.find(p => p.id === id);
    if (!paso) return;

    const tieneContenido = paso.descripcion.trim() ||
                           paso.peligros.length > 0 ||
                           paso.controles.length > 0;

    if (tieneContenido) {
      const label = paso.descripcion.trim()
        ? `"${paso.descripcion.substring(0, 40)}${paso.descripcion.length > 40 ? '…' : ''}"`
        : `Paso ${paso.numero}`;
      const ok = await Modal.confirmar(
        'Eliminar paso',
        `¿Eliminar ${label}? Esta acción no se puede deshacer.`,
        { labelOk: 'Eliminar', peligroso: true }
      );
      if (!ok) return;
    }

    const nuevos = pasos.filter(p => p.id !== id);
    _renumerarPasos(nuevos);
    _expandidos.delete(id);
    State.set('pasos', nuevos, 'pasos:update');
    _renderLista();
  }

  function _mover(id, direccion) {
    const pasos = State.get('pasos') || [];
    const idx   = pasos.findIndex(p => p.id === id);
    if (idx === -1) return;

    const idxDestino = direccion === 'up' ? idx - 1 : idx + 1;
    if (idxDestino < 0 || idxDestino >= pasos.length) return;

    [pasos[idx], pasos[idxDestino]] = [pasos[idxDestino], pasos[idx]];
    _renumerarPasos(pasos);
    State.set('pasos', pasos, 'pasos:update');
    _renderLista();

    setTimeout(() => {
      document.getElementById(`step-card-${id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  function _toggleExpansion(id) {
    if (_expandidos.has(id)) {
      _expandidos.delete(id);
    } else {
      _expandidos.add(id);
    }

    const card = document.getElementById(`step-card-${id}`);
    if (!card) return;
    const estaAbierto = _expandidos.has(id);

    const body = document.getElementById(`step-body-${id}`);
    const chevron = card.querySelector('.chevron-icon');
    if (body) {
      if (estaAbierto) {
        body.classList.remove('hidden');
        body.classList.add('flex', 'flex-col', 'gap-3.5', 'pt-2', 'border-t', 'border-slate-100');
        chevron?.classList.add('rotate-180');
      } else {
        body.classList.add('hidden');
        body.classList.remove('flex', 'flex-col', 'gap-3.5', 'pt-2', 'border-t', 'border-slate-100');
        chevron?.classList.remove('rotate-180');
      }
    }

    card.classList.toggle('step-card--open', estaAbierto);
    const header = card.querySelector('[data-action="toggle"]');
    if (header) header.setAttribute('aria-expanded', String(estaAbierto));
  }

  function _toggleSubpanel(tipo, id) {
    const subpanel = document.getElementById(`subpanel-${tipo}-${id}`);
    if (!subpanel) return;
    
    const bodyEl = document.getElementById(`subpanel-body-${tipo}-${id}`);
    const chevron = subpanel.querySelector('.subpanel-chevron');
    if (!bodyEl) return;

    const estaCerrado = bodyEl.classList.contains('hidden');
    
    if (estaCerrado) {
      bodyEl.classList.remove('hidden');
      chevron?.classList.add('rotate-90');

      if (tipo === 'controles') {
        const peligrosPanel = document.getElementById(`subpanel-peligros-${id}`);
        const peligrosBody = document.getElementById(`subpanel-body-peligros-${id}`);
        const peligrosChevron = peligrosPanel?.querySelector('.subpanel-chevron');
        if (peligrosBody && !peligrosBody.classList.contains('hidden')) {
          peligrosBody.classList.add('hidden');
          peligrosChevron?.classList.remove('rotate-90');
          peligrosPanel?.querySelector('[data-subpanel]')?.setAttribute('aria-expanded', 'false');
        }
      }
    } else {
      bodyEl.classList.add('hidden');
      chevron?.classList.remove('rotate-90');
    }

    const headerEl = subpanel.querySelector('[data-subpanel]');
    if (headerEl) headerEl.setAttribute('aria-expanded', String(estaCerrado));

    if (estaCerrado) {
      if (bodyEl && (bodyEl.innerHTML.trim() === '' || bodyEl.innerHTML.includes('<!-- Renderizado'))) {
        if (tipo === 'peligros') UIPeligros.renderEnPaso(id, bodyEl);
        else                     UIControles.renderEnPaso(id, bodyEl);
      }
    }
  }

  function _renumerarPasos(pasos) {
    pasos.forEach((p, i) => { p.numero = i + 1; });
  }

  function _bindEventos() {
    if (_listenersBound) return;

    const lista   = Utils.$el('steps-list');
    const btnAdd  = Utils.$el('btn-add-step');

    if (!lista || !btnAdd) return;

    btnAdd.addEventListener('click', _agregar);

    lista.addEventListener('click', async e => {
      const btnAccion = e.target.closest('[data-action]');
      if (!btnAccion) return;

      const action = btnAccion.dataset.action;
      const id     = btnAccion.dataset.id;

      e.stopPropagation();

      switch (action) {
        case 'toggle':    _toggleExpansion(id);          break;
        case 'up':        _mover(id, 'up');               break;
        case 'down':      _mover(id, 'down');             break;
        case 'duplicate': _duplicar(id);                  break;
        case 'delete':    await _eliminar(id);             break;
      }
    });

    lista.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const header = e.target.closest('[data-action="toggle"]');
      if (header) {
        e.preventDefault();
        _toggleExpansion(header.dataset.id);
      }
    });

    lista.addEventListener('click', e => {
      const subHeader = e.target.closest('[data-subpanel]');
      if (subHeader) {
        _toggleSubpanel(subHeader.dataset.subpanel, subHeader.dataset.id);
        return;
      }

      const btnNuevo = e.target.closest('.btn-nuevo-paso-acc');
      if (btnNuevo) {
        const id = btnNuevo.dataset.pasoId;
        _expandidos.delete(id);
        _agregar();
        return;
      }

      const btnFin = e.target.closest('.btn-fin-pasos-acc');
      if (btnFin) {
        _expandidos.clear();
        _renderLista();
        Utils.toast('Todos los pasos han sido contraídos.', 'info');
        return;
      }
    });

    lista.addEventListener('input', e => {
      const ta = e.target.closest('.step-desc-input');
      if (!ta) return;
      _editar(ta.dataset.id, ta.value);
    });

    _listenersBound = true;
  }

  function render() {
    _renderLista();
    _bindEventos();
  }

  function validar() {
    const pasos = State.get('pasos') || [];
    if (pasos.length === 0) return false;
    return pasos.every(p => {
      const r = UICompletitud.evaluar(p);
      return r.estado === 'completo';
    });
  }

  State.on('reset', () => {
    _expandidos.clear();
    render();
  });

  return { render, validar, _actualizarTarjetaPublico: _actualizarTarjeta };
})();


/* ───────────────────────────────────────────────────────────────
   MATRIX — Motor de sugerencias peligro → control
   Fuente de verdad exclusiva: matriz-peligro-control.json
   Ninguna regla de obligatoriedad/recomendación está en JS.
   HSE puede modificar la clasificación editando solo el JSON.
──────────────────────────────────────────────────────────────── */
const Matrix = (() => {

  function calcular(codigosPeligros) {
    const obligatorios = new Set();
    const recomendados = new Set();

    codigosPeligros.forEach(cod => {
      const entrada = Config.getMatriz(cod);
      if (!entrada) return;

      (entrada.obligatorios || []).forEach(c => {
        obligatorios.add(c);
        recomendados.delete(c);
      });

      (entrada.recomendados || []).forEach(c => {
        if (!obligatorios.has(c)) recomendados.add(c);
      });
    });

    return { obligatorios, recomendados };
  }

  function criticidadMaxima(codigosPeligros) {
    const orden = { ALTA: 3, MEDIA: 2, BAJA: 1 };
    let max = 0;
    let resultado = null;
    codigosPeligros.forEach(cod => {
      const entrada = Config.getMatriz(cod);
      if (!entrada) return;
      const val = orden[entrada.criticidad] || 0;
      if (val > max) { max = val; resultado = entrada.criticidad; }
    });
    return resultado;
  }

  function criticidadPeligro(codigoPeligro) {
    const entrada = Config.getMatriz(codigoPeligro);
    if (entrada) return entrada.criticidad;
    const peligro = Config.getPeligro(codigoPeligro);
    return peligro ? peligro.criticidad : null;
  }

  return { calcular, criticidadMaxima, criticidadPeligro };
})();

const UIPeligros = (() => {

  function _htmlItem(peligro, seleccionados) {
    const cod     = Utils.escaparHtml(peligro.codigo);
    const desc    = Utils.escaparHtml(peligro.descripcion);
    const checked = seleccionados.includes(peligro.codigo);
    const crit    = Matrix.criticidadPeligro(peligro.codigo);
    
    let critClass = 'bg-slate-100 text-slate-500';
    if (crit === 'ALTA') critClass = 'bg-red-100 text-red-700 font-bold';
    else if (crit === 'MEDIA') critClass = 'bg-amber-100 text-amber-700 font-bold';
    else if (crit === 'BAJA') critClass = 'bg-blue-100 text-blue-700 font-bold';

    const critHtml = crit
      ? `<span class="text-[8px] px-1 py-0.2 rounded scale-90 origin-left shrink-0 ${critClass}">${crit}</span>`
      : '';

    const activeClasses = checked 
      ? 'bg-blue-50 border-blue-300 text-primary font-semibold shadow-sm' 
      : 'bg-white border-slate-200 text-slate-700';

    return `
      <label class="flex items-start gap-1.5 p-1.5 rounded border cursor-pointer transition-all hover:bg-slate-50 ${activeClasses}" for="peligro-${cod}">
        <input
          type="checkbox"
          id="peligro-${cod}"
          class="peligro-check rounded text-primary focus:ring-primary h-3 w-3 shrink-0 mt-0.5"
          data-codigo="${cod}"
          ${checked ? 'checked' : ''}
          aria-label="${cod} - ${desc}"
        >
        <div class="flex-1 min-w-0 flex flex-col gap-0.5 leading-tight">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[9px] font-bold text-primary font-mono shrink-0">${cod}</span>
            ${critHtml}
          </div>
          <span class="text-[9px] text-slate-600 font-normal break-words">${desc}</span>
        </div>
      </label>`;
  }

  function _htmlCategoria(cat, seleccionados, catIdx) {
    const nombreEsc  = Utils.escaparHtml(cat.categoria);
    const peligros   = cat.peligros || [];
    const selEnCat   = peligros.filter(p => seleccionados.includes(p.codigo)).length;
    const labelConConteo = selEnCat > 0 ? `${nombreEsc} ${selEnCat}` : nombreEsc;
    const items      = peligros.map(p => _htmlItem(p, seleccionados)).join('');

    return `
      <div class="border-b border-slate-100 last:border-0 checkbox-group" id="catpel-${catIdx}">
        <button type="button"
          class="w-full flex items-center justify-between py-2 px-1 text-xs font-semibold text-primary hover:bg-slate-50 transition-colors text-left checkbox-group__toggle"
          data-cat-toggle="catpel-items-${catIdx}"
          aria-expanded="false"
          aria-controls="catpel-items-${catIdx}">
          <span class="flex items-center font-bold tracking-wide uppercase text-[11px] text-[#002d62] cat-title-span" data-raw-name="${nombreEsc}">
            ${labelConConteo}
          </span>
          <span class="checkbox-group__toggle-arrow" style="width: 5px; height: 5px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform 0.2s; display: inline-block;"></span>
        </button>
        <div class="pl-1 pr-1 pb-3 grid grid-cols-2 gap-1.5 checkbox-group__items checkbox-list" id="catpel-items-${catIdx}" hidden>
          ${items}
        </div>
      </div>`;
  }

  function renderEnPaso(pasoId, container) {
    const paso        = (State.get('pasos') || []).find(p => p.id === pasoId);
    if (!paso) return;
    const seleccionados = paso.peligros || [];
    const categorias    = Config.getPeligrosPorCategoria();

    const html = `
      <div class="flex flex-col gap-1.5" data-paso-id="${Utils.escaparHtml(pasoId)}">
        <p class="text-[10px] text-slate-500 italic mb-2">
          Seleccione todos los peligros asociados a este paso.
        </p>
        ${categorias.map((cat, i) => _htmlCategoria(cat, seleccionados, `${pasoId}-${i}`)).join('')}
      </div>`;

    container.innerHTML = html;
    _bindEventos(container, pasoId);
  }

  function _bindEventos(container, pasoId) {
    if (container._peligrosListenersBound) return;
    container._peligrosListenersBound = true;

    // Toggle de categoría
    container.addEventListener('click', e => {
      const btn = e.target.closest('[data-cat-toggle]');
      if (!btn) return;
      const targetId = btn.dataset.catToggle;
      const items    = document.getElementById(targetId);
      if (!items) return;
      const abierto = items.hasAttribute('hidden');
      items.toggleAttribute('hidden');
      btn.setAttribute('aria-expanded', String(abierto));
      btn.classList.toggle('checkbox-group--open', abierto);
      const arrow = btn.querySelector('.checkbox-group__toggle-arrow');
      if (arrow) arrow.style.transform = abierto ? 'rotate(45deg)' : 'rotate(-45deg)';
    });

    // Selección/deselección de peligro
    container.addEventListener('change', e => {
      const el = e.target;
      if (!el.classList.contains('peligro-check')) return;

      const label = el.closest('label');
      if (label) {
        if (el.checked) {
          label.className = 'flex items-start gap-1.5 p-1.5 rounded border cursor-pointer transition-all hover:bg-slate-50 bg-blue-50 border-blue-300 text-primary font-semibold shadow-sm';
        } else {
          label.className = 'flex items-start gap-1.5 p-1.5 rounded border cursor-pointer transition-all hover:bg-slate-50 bg-white border-slate-200 text-slate-700';
        }
      }

      const codigo      = el.dataset.codigo;
      const pasos       = State.get('pasos') || [];
      const idx         = pasos.findIndex(p => p.id === pasoId);
      if (idx === -1) return;

      const peligrosAnteriores = [...(pasos[idx].peligros || [])];
      let   peligros           = [...peligrosAnteriores];

      if (el.checked) {
        if (!peligros.includes(codigo)) peligros.push(codigo);
      } else {
        peligros = peligros.filter(c => c !== codigo);
      }

      pasos[idx].peligros = peligros;

      if (!el.checked && peligrosAnteriores.length > 0) {
        const { obligatorios: obAnt, recomendados: recAnt } = Matrix.calcular(peligrosAnteriores);
        const { obligatorios: obNew, recomendados: recNew } = Matrix.calcular(peligros);
        const eraDeMAtrix   = cod => obAnt.has(cod) || recAnt.has(cod);
        const sigueEnMatrix = cod => obNew.has(cod) || recNew.has(cod);
        pasos[idx].controles = (pasos[idx].controles || []).filter(cod =>
          !eraDeMAtrix(cod) || sigueEnMatrix(cod)
        );
      }

      State.set('pasos', pasos, 'pasos:update');

      const countEl = document.getElementById(`subpanel-count-peligros-${pasoId}`);
      if (countEl) countEl.textContent = peligros.length;

      _actualizarContadorCategoria(el);
      _notificarControles(pasoId, peligros);
      UIPasos._actualizarTarjetaPublico(pasoId);
    });
  }

  function _actualizarContadorCategoria(checkboxEl) {
    const grupo  = checkboxEl.closest('.checkbox-group');
    if (!grupo) return;
    const titleSpan = grupo.querySelector('.cat-title-span');
    if (!titleSpan) return;
    const rawName = titleSpan.dataset.rawName;
    const total  = grupo.querySelectorAll('.peligro-check:checked').length;
    if (total > 0) {
      titleSpan.textContent = `${rawName} ${total}`;
    } else {
      titleSpan.textContent = rawName;
    }
  }

  function _notificarControles(pasoId, peligros) {
    const bodyControles = document.getElementById(`subpanel-body-controles-${pasoId}`);
    if (bodyControles && !bodyControles.innerHTML.includes('<!-- Renderizado')) {
      UIControles.renderEnPaso(pasoId, bodyControles);
    }
  }

  function refrescarSiAbierto(pasoId) {
    const body = document.getElementById(`subpanel-body-peligros-${pasoId}`);
    if (body && !body.innerHTML.includes('<!-- Renderizado')) {
      renderEnPaso(pasoId, body);
    }
  }

  return { renderEnPaso, refrescarSiAbierto };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Controles — SF-08 Selección de controles por paso
   Integra Matrix para mostrar obligatorios (🔒) y recomendados (⚠).
   Toda clasificación proviene exclusivamente del JSON.
──────────────────────────────────────────────────────────────── */
const UIControles = (() => {

  function _htmlItem(control, seleccionados, rolMatrix, justificaciones) {
    const cod         = Utils.escaparHtml(control.codigo);
    const desc        = Utils.escaparHtml(control.descripcion);
    const checked     = seleccionados.includes(control.codigo);
    const esObligat   = rolMatrix === 'obligatorio';
    const esRecomend  = rolMatrix === 'recomendado';
    const justif      = (justificaciones || []).find(j => j.control === control.codigo);
    const fueEliminadoConJustif = justif && justif.eliminadoPorUsuario && justif.justificacion;

    let activeClasses = 'bg-white border-slate-200 text-[#171c1f]';
    if (checked) {
      activeClasses = 'bg-green-50 border-green-300 text-green-900 font-semibold';
    } else if (esObligat && !fueEliminadoConJustif) {
      activeClasses = 'bg-red-50 border-red-200 text-red-900';
    } else if (fueEliminadoConJustif) {
      activeClasses = 'bg-slate-50 border-slate-200 text-slate-400 italic';
    } else if (esRecomend) {
      activeClasses = 'bg-amber-50/50 border-amber-200 text-[#171c1f]';
    }

    let prefijo = '';
    if (esObligat)  prefijo = `<span class="bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Obligatorio por matriz">🔒 Obligatorio</span>`;
    if (esRecomend) prefijo = `<span class="bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Recomendado por matriz">⚠ Recomendado</span>`;

    const eliminadoHtml = fueEliminadoConJustif
      ? `<span class="bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded italic flex items-center gap-0.5" title="Eliminado: ${Utils.escaparHtml(justif.justificacion)}">✗ Justificado</span>`
      : '';

    const estaFaltante  = esObligat && !checked && !fueEliminadoConJustif;
    const justifOmisionHtml = estaFaltante
      ? `<button type="button" class="control-justificar-omision text-[10px] text-red-600 hover:text-red-800 font-bold underline mt-1 block self-start pointer-events-auto"
            data-codigo="${cod}"
            title="Justificar por qué se omite este control obligatorio">
            Justificar omisión
         </button>`
      : '';

    return `
      <label class="flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 ${activeClasses}" for="control-${cod}">
        <input
          type="checkbox"
          id="control-${cod}"
          class="control-check rounded text-primary focus:ring-primary h-4 w-4 shrink-0 pointer-events-auto mt-0.5"
          data-codigo="${cod}"
          data-rol="${rolMatrix || 'manual'}"
          ${checked ? 'checked' : ''}
          aria-label="${cod} - ${desc}"
        >
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <div class="text-xs leading-normal">
            <span class="font-bold text-primary font-mono mr-1.5">${cod}</span>
            <span>${desc}</span>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap">
            ${prefijo}
            ${eliminadoHtml}
          </div>
          ${justifOmisionHtml}
        </div>
      </label>`;
  }

  function _htmlGrupo(grp, seleccionados, sugerencias, justificaciones, grpIdx) {
    const { obligatorios, recomendados } = sugerencias;
    const fontName = Utils.escaparHtml(grp.grupo);
    const controles = grp.controles || [];

    const ordenados = [...controles].sort((a, b) => {
      const rankA = obligatorios.has(a.codigo) ? 0 : recomendados.has(a.codigo) ? 1 : 2;
      const rankB = obligatorios.has(b.codigo) ? 0 : recomendados.has(b.codigo) ? 1 : 2;
      return rankA - rankB;
    });

    const selEnGrupo = controles.filter(c => seleccionados.includes(c.codigo)).length;
    const counter    = selEnGrupo > 0
      ? `<span class="bg-[#002d62] text-white text-[9px] font-bold px-2 py-0.5 rounded-full font-mono ml-2 checkbox-group__counter">${selEnGrupo}</span>`
      : '';

    const items = ordenados.map(c => {
      const rol = obligatorios.has(c.codigo) ? 'obligatorio'
                : recomendados.has(c.codigo)  ? 'recomendado'
                : null;
      return _htmlItem(c, seleccionados, rol, justificaciones);
    }).join('');

    const tieneDestacados = controles.some(c => obligatorios.has(c.codigo) || recomendados.has(c.codigo));
    const abierto         = tieneDestacados;

    return `
      <div class="border-b border-slate-100 last:border-0 checkbox-group" id="ctrlgrp-${grpIdx}">
        <button type="button"
          class="w-full flex items-center justify-between py-2.5 px-1 text-xs font-semibold text-primary hover:bg-slate-50 transition-colors text-left checkbox-group__toggle"
          data-grp-toggle="ctrlgrp-items-${grpIdx}"
          aria-expanded="${abierto}"
          aria-controls="ctrlgrp-items-${grpIdx}">
          <span class="flex items-center">
            ${fontName}${counter}
          </span>
          <span class="checkbox-group__toggle-arrow" style="width: 5px; height: 5px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform:${abierto ? 'rotate(45deg)' : 'rotate(-45deg)'}; transition: transform 0.2s; display: inline-block;"></span>
        </button>
        <div class="pl-2 pr-1 pb-3 flex flex-col gap-2 checkbox-group__items checkbox-list" id="ctrlgrp-items-${grpIdx}"
          ${abierto ? '' : 'hidden'}>
          ${items}
        </div>
      </div>`;
  }

  const _vistaActiva = new Map();

  function _agruparPorTipoTrabajo(peligros) {
    const grupos = [];
    const tiposTrabajo = Config.getTiposTrabajo();
    tiposTrabajo.forEach(tt => {
      if (!peligros.includes(tt.peligroTT)) return;
      const sug = Matrix.calcular([tt.peligroTT]);
      const obligatoriosTT = Array.from(sug.obligatorios || []);
      grupos.push({ tt, codigosObligatorios: obligatoriosTT });
    });
    return grupos;
  }

  function _htmlGrupoTT(grupoTT, seleccionados, justificaciones, grpIdx) {
    const { tt, codigosObligatorios } = grupoTT;
    const nombreEsc = Utils.escaparHtml(tt.label);
    const items = codigosObligatorios.map(cod => {
      const ctrl = Config.getControl(cod) || { codigo: cod, descripcion: cod };
      return _htmlItem(ctrl, seleccionados, 'obligatorio', justificaciones);
    }).join('');
    const selEnGrupo = codigosObligatorios.filter(c => seleccionados.includes(c)).length;
    const counter = `<span class="bg-[#002d62] text-white text-[9px] font-bold px-2 py-0.5 rounded-full font-mono ml-2 checkbox-group__counter">${selEnGrupo}/${codigosObligatorios.length}</span>`;
    return `
      <div class="border-b border-slate-100 last:border-0 checkbox-group" id="ttgrp-${grpIdx}">
        <button type="button"
          class="w-full flex items-center justify-between py-2.5 px-1 text-xs font-semibold text-primary hover:bg-slate-50 transition-colors text-left checkbox-group__toggle"
          data-grp-toggle="ttgrp-items-${grpIdx}"
          aria-expanded="true"
          aria-controls="ttgrp-items-${grpIdx}">
          <span class="flex items-center font-bold">
            ${nombreEsc}${counter}
          </span>
          <span class="checkbox-group__toggle-arrow" style="width: 5px; height: 5px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform:rotate(45deg); transition: transform 0.2s; display: inline-block;"></span>
        </button>
        <div class="pl-2 pr-1 pb-3 flex flex-col gap-2 checkbox-group__items checkbox-list" id="ttgrp-items-${grpIdx}">
          ${items}
        </div>
      </div>`;
  }

  function renderEnPaso(pasoId, container) {
    const pasos = State.get('pasos') || [];
    const paso  = pasos.find(p => p.id === pasoId);
    if (!paso) return;

    const seleccionados  = paso.controles    || [];
    const justificaciones = paso.justificaciones || [];
    const peligros       = paso.peligros     || [];
    const grupos         = Config.getControlesPorGrupo();

    const sugerencias = peligros.length > 0
      ? Matrix.calcular(peligros)
      : { obligatorios: new Set(), recomendados: new Set() };

    const leyenda = peligros.length > 0 ? `
      <div class="bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-slate-600 mb-3 justify-center">
        <span class="flex items-center gap-1"><span class="bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">🔒 Obligatorio</span> por matriz HSE</span>
        <span class="flex items-center gap-1"><span class="bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">⚠ Recomendado</span> por matriz</span>
      </div>` : `
      <p class="text-xs text-slate-500 text-center py-2 mb-3">
        Seleccione primero peligros para ver sugerencias de controles.
      </p>`;

    const vista = _vistaActiva.get(pasoId) || 'funcional';
    const gruposTT = peligros.length > 0 ? _agruparPorTipoTrabajo(peligros) : [];
    const hayTT    = gruposTT.length > 0;

    const selectorVista = (peligros.length > 0 && hayTT) ? `
      <div class="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-50 p-0.5 mb-3 select-none" role="group" aria-label="Vista de controles">
        <button type="button" class="vista-btn flex-1 text-[10px] font-bold py-1.5 rounded transition-all text-center ${vista === 'funcional' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-primary hover:bg-slate-100'}"
          data-vista="funcional" data-paso-id="${Utils.escaparHtml(pasoId)}">Por grupo funcional</button>
        <button type="button" class="vista-btn flex-1 text-[10px] font-bold py-1.5 rounded transition-all text-center ${vista === 'tt' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-primary hover:bg-slate-100'}"
          data-vista="tt" data-paso-id="${Utils.escaparHtml(pasoId)}">Por Tipo de Trabajo</button>
      </div>` : '';

    const cuerpo = (vista === 'tt' && hayTT)
      ? gruposTT.map((g, i) => _htmlGrupoTT(g, seleccionados, justificaciones, `${pasoId}-tt-${i}`)).join('')
      : grupos.map((grp, i) =>
          _htmlGrupo(grp, seleccionados, sugerencias, justificaciones, `${pasoId}-${i}`)
        ).join('');

    const html = `
      <div class="flex flex-col gap-1.5" data-paso-id="${Utils.escaparHtml(pasoId)}">
        ${leyenda}
        ${selectorVista}
        ${cuerpo}
        
        <!-- Botones de Acción de Flujo de Pasos -->
        <div class="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-100 flex-wrap">
          <button type="button" 
            class="flex items-center gap-1.5 bg-[#fcd400] text-primary hover:bg-[#e0bd00] transition-colors rounded-lg py-1.5 px-3 text-xs font-bold shadow-sm btn-nuevo-paso-acc cursor-pointer"
            data-paso-id="${Utils.escaparHtml(pasoId)}">
            <span class="material-symbols-outlined text-[16px] font-bold">add</span>
            Nuevo Paso
          </button>
          <button type="button" 
            class="flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors rounded-lg py-1.5 px-3 text-xs font-bold border border-slate-200 btn-fin-pasos-acc cursor-pointer"
            data-paso-id="${Utils.escaparHtml(pasoId)}">
            <span class="material-symbols-outlined text-[16px]">done_all</span>
            Fin de Pasos
          </button>
        </div>
      </div>`;

    container.innerHTML = html;
    _bindEventos(container, pasoId);
  }

  function _bindEventos(container, pasoId) {
    if (container._controlesListenersBound) return;
    container._controlesListenersBound = true;

    container.addEventListener('click', e => {
      const btn = e.target.closest('[data-grp-toggle]');
      if (!btn) return;
      const targetId = btn.dataset.grpToggle;
      const items    = document.getElementById(targetId);
      if (!items) return;
      const abierto = items.hasAttribute('hidden');
      items.toggleAttribute('hidden');
      btn.setAttribute('aria-expanded', String(abierto));
      btn.classList.toggle('checkbox-group--open', abierto);
      const arrow = btn.querySelector('.checkbox-group__toggle-arrow');
      if (arrow) arrow.style.transform = abierto ? 'rotate(45deg)' : 'rotate(-45deg)';
    });

    container.addEventListener('click', e => {
      const btn = e.target.closest('.vista-btn');
      if (!btn) return;
      const nuevaVista = btn.dataset.vista;
      if (nuevaVista !== 'funcional' && nuevaVista !== 'tt') return;
      _vistaActiva.set(pasoId, nuevaVista);
      renderEnPaso(pasoId, container);
    });

    container.addEventListener('click', async e => {
      const btn = e.target;
      if (!btn.classList.contains('control-justificar-omision')) return;
      e.preventDefault();
      const codigo = btn.dataset.codigo;
      await _gestionarEliminacionObligatorio(pasoId, codigo, null);
    });

    container.addEventListener('change', async e => {
      const el = e.target;
      if (!el.classList.contains('control-check')) return;

      const codigo = el.dataset.codigo;
      const rol    = el.dataset.rol;

      const label = el.closest('label');
      if (label) {
        if (el.checked) {
          label.className = 'flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 bg-green-50 border-green-300 text-green-900 font-semibold';
        } else {
          if (rol === 'obligatorio') {
            label.className = 'flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 bg-red-50 border-red-200 text-red-900';
          } else if (rol === 'recomendado') {
            label.className = 'flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 bg-amber-50/50 border-amber-200 text-[#171c1f]';
          } else {
            label.className = 'flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 bg-white border-slate-200 text-[#171c1f]';
          }
        }
      }

      if (!el.checked && rol === 'obligatorio') {
        el.checked = true;
        if (label) {
          label.className = 'flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 bg-green-50 border-green-300 text-green-900 font-semibold';
        }
        await _gestionarEliminacionObligatorio(pasoId, codigo, el);
      } else {
        _toggleControl(pasoId, codigo, el.checked);
        _actualizarContadorGrupo(el);
        UIPasos._actualizarTarjetaPublico(pasoId);
      }
    });
  }

  function _toggleControl(pasoId, codigo, agregar) {
    const pasos = State.get('pasos') || [];
    const idx   = pasos.findIndex(p => p.id === pasoId);
    if (idx === -1) return;

    let controles = [...(pasos[idx].controles || [])];
    if (agregar) {
      if (!controles.includes(codigo)) controles.push(codigo);
      const justificacionesPrev = pasos[idx].justificaciones || [];
      const justificacionesDepuradas = justificacionesPrev.filter(j => j.control !== codigo);
      if (justificacionesDepuradas.length !== justificacionesPrev.length) {
        pasos[idx].justificaciones = justificacionesDepuradas;
      }
    } else {
      controles = controles.filter(c => c !== codigo);
    }
    pasos[idx].controles = controles;
    State.set('pasos', pasos, 'pasos:update');

    const countEl = document.getElementById(`subpanel-count-controles-${pasoId}`);
    if (countEl) countEl.textContent = controles.length;
  }

  async function _gestionarEliminacionObligatorio(pasoId, codigo, checkboxEl) {
    const control = Config.getControl(codigo);
    const desc    = control ? control.descripcion : codigo;

    // Modal de justificación
    const titulo  = `Eliminar control obligatorio`;
    const mensaje = `El control "${codigo} - ${desc}" es obligatorio según la matriz HSE.
Para eliminarlo debe registrar una justificación que quedará almacenada para auditoría.`;

    // Usamos Modal genérico con campo de texto inyectado dinámicamente
    const overlay     = Utils.$el('modal-confirm');
    const titleEl     = Utils.$el('modal-confirm-title');
    const messageEl   = Utils.$el('modal-confirm-message');
    const btnOk       = Utils.$el('btn-confirm-ok');
    const btnCancel   = Utils.$el('btn-confirm-cancel');

    titleEl.textContent   = titulo;
    messageEl.innerHTML   = `<p class="text-xs text-[#43474f] leading-relaxed mb-4 text-justify">${Utils.escaparHtml(mensaje)}</p>
      <label class="block text-xs font-bold text-primary uppercase tracking-tight mb-1.5">
        Justificación
      </label>
      <textarea id="justif-textarea" class="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-[#171c1f] focus:ring-1 focus:ring-primary focus:border-primary transition-colors outline-none resize-none h-24 shadow-sm"
        placeholder="Explique por qué este control no aplica a esta tarea…"
        maxlength="300"></textarea>`;
    btnOk.textContent   = 'Confirmar eliminación';
    btnOk.className     = 'bg-red-600 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-md hover:bg-red-700 transition-all active:scale-95 cursor-pointer outline-none';
    overlay.classList.remove('hidden');

    // Esperar respuesta
    const confirmado = await new Promise(resolve => {
      const onOk     = () => { cleanup(); resolve(true);  };
      const onCancel = () => { cleanup(); resolve(false); };
      const onOverlay = e => { if (e.target === overlay) { cleanup(); resolve(false); } };

      btnOk.addEventListener('click',     onOk,     { once: true });
      btnCancel.addEventListener('click', onCancel, { once: true });
      overlay.addEventListener('click',   onOverlay, { once: true });

      function cleanup() {
        overlay.classList.add('hidden');
        btnOk.removeEventListener('click', onOk);
        btnCancel.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlay);
      }
    });

    if (!confirmado) return;

    const justifEl = document.getElementById('justif-textarea');
    const texto    = justifEl ? justifEl.value.trim() : '';
    if (!texto) {
      Utils.toast('La justificación es obligatoria para eliminar un control obligatorio.', 'warning');
      return;
    }

    // Registrar justificación y eliminar del array controles
    const pasos = State.get('pasos') || [];
    const idx   = pasos.findIndex(p => p.id === pasoId);
    if (idx === -1) return;

    pasos[idx].controles = (pasos[idx].controles || []).filter(c => c !== codigo);
    const justificaciones = pasos[idx].justificaciones || [];

    // Reemplazar si ya existe una justificación previa para este control
    const idxJustif = justificaciones.findIndex(j => j.control === codigo);
    const entrada   = {
      control:              codigo,
      eliminadoPorUsuario:  true,
      justificacion:        texto,
      registradoEn:         new Date().toISOString()
    };
    if (idxJustif >= 0) justificaciones[idxJustif] = entrada;
    else justificaciones.push(entrada);

    pasos[idx].justificaciones = justificaciones;
    State.set('pasos', pasos, 'pasos:update');

    // Actualizar UI
    // NC-01: cuando la justificación llega por el botón de omisión directa,
    // checkboxEl es null (no hay checkbox que desmarcar). El re-render posterior
    // del ítem refleja el nuevo estado JUSTIFICADO.
    if (checkboxEl) {
      checkboxEl.checked = false;
      _actualizarContadorGrupo(checkboxEl);
    }
    const countEl = document.getElementById(`subpanel-count-controles-${pasoId}`);
    if (countEl) countEl.textContent = pasos[idx].controles.length;

    // Refrescar el item para mostrar badge "✗ Justificado"
    const bodyEl = document.getElementById(`subpanel-body-controles-${pasoId}`);
    if (bodyEl) renderEnPaso(pasoId, bodyEl);

    UIPasos._actualizarTarjetaPublico(pasoId);
    Utils.toast(`Control ${codigo} eliminado. Justificación registrada.`, 'warning');
  }

  function _actualizarContadorGrupo(checkboxEl) {
    const grupo  = checkboxEl.closest('.checkbox-group');
    if (!grupo) return;
    const total  = grupo.querySelectorAll('.control-check:checked').length;
    let counter  = grupo.querySelector('.checkbox-group__counter');
    const toggle = grupo.querySelector('.checkbox-group__toggle');
    if (!toggle) return;
    if (total > 0) {
      if (!counter) {
        counter = document.createElement('span');
        counter.className = 'checkbox-group__counter';
        toggle.insertBefore(counter, toggle.querySelector('.checkbox-group__toggle-arrow'));
      }
      counter.textContent = total;
    } else if (counter) {
      counter.remove();
    }
  }

  /** Re-renderiza si ya estaba visible */
  function refrescarSiAbierto(pasoId) {
    const body = document.getElementById(`subpanel-body-controles-${pasoId}`);
    if (body && !body.innerHTML.includes('<!-- Renderizado')) {
      renderEnPaso(pasoId, body);
    }
  }

  return { renderEnPaso, refrescarSiAbierto };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Resumen — SF-09 Resumen técnico (solo lectura)
   Vista de revisión para el Supervisor HSE.
   Lee State y Config, nunca escribe.
   Re-renderiza completo en cada apertura.
──────────────────────────────────────────────────────────────── */
const UIResumen = (() => {

  const BODY_ID = 'body-resumen';
  let _listenersBound = false;  // guard — SF C1

  // ── Helpers de formato ───────────────────────────────────

  function _fila(etiqueta, valor, alerta = false) {
    const valueColor = alerta ? 'text-red-600 font-semibold' : 'text-slate-700';
    const valorHtml = valor
      ? `<span class="text-xs font-semibold ${valueColor}">${Utils.escaparHtml(valor)}</span>`
      : `<span class="text-xs font-semibold text-red-600 flex items-center gap-1">
          <span class="material-symbols-outlined text-[14px]">warning</span> Sin completar
         </span>`;
    return `
      <div class="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs">
        <span class="text-slate-500 font-medium">${Utils.escaparHtml(etiqueta)}</span>
        ${valorHtml}
      </div>`;
  }

  function _badge(texto, tipo) {
    let classes = 'bg-slate-100 text-slate-700';
    if (tipo === 'success') classes = 'bg-green-100 text-green-800 font-bold';
    else if (tipo === 'warning') classes = 'bg-amber-100 text-amber-800 font-bold';
    else if (tipo === 'danger') classes = 'bg-red-100 text-red-800 font-bold';
    return `<span class="text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${classes}">${Utils.escaparHtml(texto)}</span>`;
  }

  // ── Bloque 1: Información General ────────────────────────
  function _htmlGeneral() {
    const g = State.get('general') || {};
    let fechaDisplay = '';
    if (g.fecha) {
      try {
        const [y, m, d] = g.fecha.split('-');
        fechaDisplay = `${d}/${m}/${y}`;
      } catch { fechaDisplay = g.fecha; }
    }
    return `
      <div class="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 custom-shadow">
        <h4 class="font-bold text-primary text-xs uppercase mb-2 tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[16px] text-accent">info</span>
          Información General
        </h4>
        <div class="divide-y divide-slate-100">
          ${_fila('Lugar', g.lugar)}
          ${_fila('Fecha', fechaDisplay)}
          ${_fila('Tarea', g.tarea)}
        </div>
      </div>`;
  }

  // ── Bloque 2: Responsables ────────────────────────────────
  function _htmlResponsables() {
    const lista = State.get('responsables') || [];
    const filas = lista.length > 0
      ? lista.map(r => `
          <div class="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs">
            <span class="text-slate-700 font-semibold">${Utils.escaparHtml(r.nombre || '—')}</span>
            <span class="text-slate-500 font-mono">${Utils.escaparHtml(r.cedula || '—')}</span>
          </div>`).join('')
      : `<div class="py-3 text-center text-xs font-semibold text-red-600 flex items-center justify-center gap-1">
           <span class="material-symbols-outlined text-[16px]">warning</span> Sin responsables registrados
         </div>`;
    return `
      <div class="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 custom-shadow">
        <h4 class="font-bold text-primary text-xs uppercase mb-2 tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[16px] text-accent">group</span>
          Responsables de la Tarea
        </h4>
        <div class="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-200">
          <span>Nombre</span>
          <span>Cédula</span>
        </div>
        <div class="divide-y divide-slate-100">
          ${filas}
        </div>
      </div>`;
  }

  // ── Bloque 3: Ubicación ───────────────────────────────────
  function _htmlUbicacion() {
    return `
      <div class="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 custom-shadow">
        <h4 class="font-bold text-primary text-xs uppercase mb-2 tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[16px] text-accent">my_location</span>
          Puntos de Referencia y Emergencia
        </h4>
        <div class="divide-y divide-slate-100">
          ${_fila('Punto de Encuentro', State.get('puntoEncuentro'))}
          ${_fila('Ducha y Lavaojos',  State.get('duchaLavaojos'))}
        </div>
      </div>`;
  }

  // ── Bloque 4: Señales de Parada ───────────────────────────
  function _htmlSenales() {
    const cfg         = Config.get('validaciones') || {};
    const minimo      = cfg.minimoSenalesParada || 2;
    const estado      = State.get('senalesParada') || {};
    const selIds      = estado.seleccionadas || [];
    const textos      = estado.textos || {};
    const catalogoMap = {};
    (Config.get('senalesParada') || []).forEach(s => { catalogoMap[s.id] = s; });

    const items = selIds.map(id => {
      const senal = catalogoMap[id];
      if (!senal) return '';
      const textoLibre = textos[id] ? `: "${Utils.escaparHtml(textos[id])}"` : '';
      return `
        <div class="flex items-start gap-1.5 py-1.5 border-b border-slate-100 last:border-0 text-xs">
          <span class="material-symbols-outlined text-green-600 text-[16px] shrink-0 font-bold">check</span>
          <span class="text-slate-700 leading-normal">${Utils.escaparHtml(senal.texto)}${textoLibre}</span>
        </div>`;
    }).join('');

    const alertaMin = selIds.length < minimo
      ? `
        <div class="mt-3 p-2 bg-red-50 border border-red-200 text-red-800 text-[11px] rounded-lg flex items-center gap-1.5 font-medium">
          <span class="material-symbols-outlined text-[16px] shrink-0">error</span>
          <span>Se requieren mínimo ${minimo} señales (${selIds.length} seleccionada${selIds.length !== 1 ? 's' : ''})</span>
        </div>` 
      : '';

    return `
      <div class="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 custom-shadow">
        <h4 class="font-bold text-primary text-xs uppercase mb-2 tracking-wider flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px] text-accent">do_not_disturb_on</span>
            <span>Señales para Detener la Tarea</span>
          </div>
          <span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">${selIds.length}</span>
        </h4>
        <div class="divide-y divide-slate-100">
          ${items || '<p class="text-xs text-slate-400 italic py-2 text-center">Sin señales seleccionadas</p>'}
        </div>
        ${alertaMin}
      </div>`;
  }

  // ── Bloque 5: Pasos ───────────────────────────────────────
  function _htmlControlItem(codControl, paso) {
    const ctrl          = Config.getControl(codControl);
    const desc          = ctrl ? ctrl.descripcion : codControl;
    const { obligatorios, recomendados } = Matrix.calcular(paso.peligros || []);
    const rol = obligatorios.has(codControl) ? 'obligatorio'
              : recomendados.has(codControl)  ? 'recomendado'
              : 'manual';
    
    let badgeHtml = '';
    if (rol === 'obligatorio') {
      badgeHtml = `<span class="bg-red-50 border border-red-200 text-red-700 text-[8px] font-bold px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">🔒 Obligatorio</span>`;
    } else if (rol === 'recomendado') {
      badgeHtml = `<span class="bg-amber-50 border border-amber-200 text-amber-700 text-[8px] font-bold px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">⚠ Recomendado</span>`;
    } else {
      badgeHtml = `<span class="bg-blue-50 border border-blue-200 text-blue-700 text-[8px] font-bold px-1.5 py-0.2 rounded shrink-0 flex items-center gap-0.5">➕ Manual</span>`;
    }

    return `
      <div class="flex items-start gap-2 p-1.5 bg-slate-50 border border-slate-100 rounded text-xs leading-normal">
        <span class="text-[10px] font-bold text-slate-600 font-mono shrink-0 mt-0.5">${Utils.escaparHtml(codControl)}</span>
        <div class="flex-1 min-w-0 flex flex-col gap-0.5">
          <div class="flex items-center gap-1.5 flex-wrap">
            ${badgeHtml}
          </div>
          <span class="text-[10px] text-slate-700">${Utils.escaparHtml(desc)}</span>
        </div>
      </div>`;
  }

  function _htmlJustificacionItem(justif) {
    const ctrl = Config.getControl(justif.control);
    const desc = ctrl ? ctrl.descripcion : justif.control;
    let fechaStr = '';
    if (justif.registradoEn) {
      try {
        const d = new Date(justif.registradoEn);
        fechaStr = d.toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
      } catch { fechaStr = justif.registradoEn; }
    }
    return `
      <div class="flex flex-col gap-1 p-2 bg-red-50/50 border border-red-100 rounded text-[10px] leading-normal">
        <div class="flex items-center gap-1.5 flex-wrap font-semibold text-red-900">
          <span class="font-mono">${Utils.escaparHtml(justif.control)}</span>
          <span class="bg-slate-100 text-slate-600 text-[8px] font-bold px-1 py-0.2 rounded italic">✗ Justificado</span>
          <span class="text-slate-500 font-normal line-through">${Utils.escaparHtml(desc)}</span>
        </div>
        <div class="text-[10px] text-red-800 bg-white border border-red-100 rounded p-1.5 italic flex flex-col gap-0.5">
          <span>"${Utils.escaparHtml(justif.justificacion)}"</span>
          ${fechaStr ? `<span class="text-[8px] text-slate-400 not-italic text-right">${fechaStr}</span>` : ''}
        </div>
      </div>`;
  }

  function _htmlPasoResumen(paso, idx) {
    const idEsc       = Utils.escaparHtml(paso.id);
    const completitud = UICompletitud.evaluar(paso);
    const badgeComp   = completitud.estado === 'completo'
      ? `<span class="bg-green-100 text-green-800 text-[9px] font-bold px-2 py-0.5 rounded-full">✓ Completo</span>`
      : `<span class="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full">${Utils.escaparHtml(completitud.texto)}</span>`;

    const tituloDesc = paso.descripcion.trim()
      ? Utils.escaparHtml(paso.descripcion.substring(0, 60) + (paso.descripcion.length > 60 ? '…' : ''))
      : '<em class="text-slate-400">Sin descripción</em>';

    // Peligros
    const peligrosHtml = (paso.peligros || []).length > 0
      ? `<div class="grid grid-cols-2 gap-1.5">` + (paso.peligros.map(cod => {
          const p    = Config.getPeligro(cod);
          const desc = p ? p.descripcion : cod;
          const crit = Matrix.criticidadPeligro(cod);
          
          let critClass = 'bg-slate-100 text-slate-500';
          if (crit === 'ALTA') critClass = 'bg-red-100 text-red-700 font-bold';
          else if (crit === 'MEDIA') critClass = 'bg-amber-100 text-amber-700 font-bold';
          else if (crit === 'BAJA') critClass = 'bg-blue-100 text-blue-700 font-bold';

          return `
            <div class="flex items-start gap-1 p-1 bg-slate-50 border border-slate-100 rounded text-[10px] leading-tight">
              <span class="font-bold text-primary font-mono shrink-0">${Utils.escaparHtml(cod)}</span>
              ${crit ? `<span class="text-[7px] px-1 py-0.2 rounded scale-90 origin-left shrink-0 ${critClass}">${crit}</span>` : ''}
              <span class="text-slate-600 break-words">${Utils.escaparHtml(desc)}</span>
            </div>`;
        }).join('')) + `</div>`
      : '<p class="text-xs text-slate-400 italic py-1">Sin peligros seleccionados</p>';

    // Controles activos
    const controlesHtml = (paso.controles || []).length > 0
      ? `<div class="flex flex-col gap-1.5">` + paso.controles.map(cod => _htmlControlItem(cod, paso)).join('') + `</div>`
      : '<p class="text-xs text-slate-400 italic py-1">Sin controles seleccionados</p>';

    // Justificaciones (controles eliminados)
    const justifs      = paso.justificaciones || [];
    const justifHtml   = justifs.length > 0
      ? `
        <div class="space-y-1.5 mt-2 border-t border-slate-100 pt-2">
          <h5 class="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Controles Eliminados con Justificación</h5>
          <div class="flex flex-col gap-1.5">
            ${justifs.map(_htmlJustificacionItem).join('')}
          </div>
        </div>` 
      : '';

    return `
      <div class="border border-slate-200 rounded-lg overflow-hidden bg-white resumen-paso-card" id="resumen-paso-${idEsc}">
        <div class="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 transition-colors text-left cursor-pointer resumen-paso__header"
          data-resumen-toggle="${idEsc}"
          role="button" tabindex="0"
          aria-expanded="false">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <span class="bg-[#002d62] text-white font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center font-mono shrink-0">${paso.numero}</span>
            <div class="min-w-0 flex-1">
              <div class="text-xs font-semibold text-slate-800 truncate">${tituloDesc}</div>
              <div class="flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap">
                <span>${(paso.peligros||[]).length} peligros</span>
                <span>•</span>
                <span>${(paso.controles||[]).length} controles</span>
                ${justifs.length > 0 ? `<span>•</span><span class="text-red-500 font-semibold">${justifs.length} justif.</span>` : ''}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${badgeComp}
            <span class="resumen-paso__arrow" style="width: 5px; height: 5px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform 0.2s; display: inline-block;"></span>
          </div>
        </div>
        <div class="p-3 border-t border-slate-100 bg-slate-50/30 flex flex-col gap-2.5 resumen-paso__body" id="resumen-cuerpo-${idEsc}" hidden>
          <div class="space-y-1">
            <h5 class="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Peligros Identificados</h5>
            ${peligrosHtml}
          </div>
          <div class="space-y-1 mt-2">
            <h5 class="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Medidas Preventivas y de Control</h5>
            ${controlesHtml}
          </div>
          ${justifHtml}
        </div>
      </div>`;
  }

  function _htmlPasos() {
    const pasos   = State.get('pasos') || [];
    const resumen = UICompletitud.resumenGlobal();
    if (pasos.length === 0) {
      return `
        <div class="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 text-center custom-shadow">
          <p class="text-slate-400 text-xs italic">Sin pasos definidos</p>
        </div>`;
    }

    const leyenda = `
      <div class="flex items-center gap-3 text-[10px] text-slate-500 font-medium flex-wrap mb-2">
        <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-red-100 border border-red-200"></span> Obligatorio</span>
        <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-blue-100 border border-blue-200"></span> Manual</span>
        <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-200"></span> Justificado</span>
      </div>`;

    const btnExpandir = `
      <div class="flex justify-end gap-1.5 mb-2">
        <button type="button" class="border border-slate-200 hover:bg-slate-50 text-[10px] font-bold text-slate-600 px-2.5 py-1 rounded transition-colors" id="btn-resumen-expandir-todo">
          Expandir todos
        </button>
        <button type="button" class="border border-slate-200 hover:bg-slate-50 text-[10px] font-bold text-slate-600 px-2.5 py-1 rounded transition-colors" id="btn-resumen-colapsar-todo">
          Colapsar todos
        </button>
      </div>`;

    return `
      <div class="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 custom-shadow">
        <h4 class="font-bold text-primary text-xs uppercase mb-3 tracking-wider flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px] text-accent">format_list_numbered</span>
            <span>Pasos de la Tarea</span>
          </div>
          <span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
            ${resumen.completos} de ${pasos.length} completos
          </span>
        </h4>
        ${leyenda}
        ${btnExpandir}
        <div class="flex flex-col gap-2" id="resumen-pasos-lista">
          ${pasos.map((p, i) => _htmlPasoResumen(p, i)).join('')}
        </div>
      </div>`;
  }

  // ── Eventos del resumen ───────────────────────────────────
  function _bindEventos() {
    if (_listenersBound) return;
    const body = Utils.$el(BODY_ID);
    if (!body) return;

    body.addEventListener('click', e => {
      const header = e.target.closest('[data-resumen-toggle]');
      if (header) {
        const id    = header.dataset.resumenToggle;
        const cuerpo = document.getElementById(`resumen-cuerpo-${id}`);
        if (!cuerpo) return;
        const abierto = cuerpo.hasAttribute('hidden');
        cuerpo.toggleAttribute('hidden');
        header.setAttribute('aria-expanded', String(abierto));
        header.classList.toggle('resumen-paso__header--open', abierto);
        
        const arrow = header.querySelector('.resumen-paso__arrow');
        if (arrow) {
          arrow.style.transform = abierto ? 'rotate(45deg)' : 'rotate(-45deg)';
        }
      }
    });

    body.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const header = e.target.closest('[data-resumen-toggle]');
      if (header) { e.preventDefault(); header.click(); }
    });

    Utils.$el('btn-resumen-expandir-todo')?.addEventListener('click', () => {
      body.querySelectorAll('.resumen-paso__body').forEach(el => {
        el.removeAttribute('hidden');
      });
      body.querySelectorAll('[data-resumen-toggle]').forEach(el => {
        el.setAttribute('aria-expanded', 'true');
        el.classList.add('resumen-paso__header--open');
        const arrow = el.querySelector('.resumen-paso__arrow');
        if (arrow) arrow.style.transform = 'rotate(45deg)';
      });
    });

    Utils.$el('btn-resumen-colapsar-todo')?.addEventListener('click', () => {
      body.querySelectorAll('.resumen-paso__body').forEach(el => {
        el.setAttribute('hidden', '');
      });
      body.querySelectorAll('[data-resumen-toggle]').forEach(el => {
        el.setAttribute('aria-expanded', 'false');
        el.classList.remove('resumen-paso__header--open');
        const arrow = el.querySelector('.resumen-paso__arrow');
        if (arrow) arrow.style.transform = 'rotate(-45deg)';
      });
    });

    _listenersBound = true;
  }

  function _htmlSupervision(auditoria) {
    if (!auditoria) return '';
    const { completitud, coherencia, ttValido, unidades } = auditoria;

    // Sección: resumen global (reutiliza _fila)
    const c = completitud || { completos: 0, pendientes: 0, total: 0 };
    const filasGlobal =
      _fila('Pasos completos',  `${c.completos} de ${c.total}`) +
      _fila('Pasos pendientes', String(c.pendientes), c.pendientes > 0) +
      _fila('Tipo de Trabajo declarado', ttValido ? 'Sí' : 'No', !ttValido);

    // Sección: coherencia (reutiliza _badge)
    const badgeCoh = coherencia && coherencia.coherente
      ? _badge('Coherente', 'success')
      : _badge('Revisar coherencia', 'warning');
    
    const detalleCoh = (coherencia && !coherencia.coherente)
      ? _fila('TT usados sin declarar', (coherencia.usadosSinDeclarar || []).join(', ') || '—',
              (coherencia.usadosSinDeclarar || []).length > 0) +
        _fila('TT declarados sin usar', (coherencia.declaradosSinUsar || []).join(', ') || '—',
              (coherencia.declaradosSinUsar || []).length > 0)
      : '';

    // Sección: unidades auditadas + hallazgos (CA-1.8A.10: vacío explícito)
    let htmlUnidades;
    if (!unidades || unidades.length === 0) {
      htmlUnidades = `<p class="text-xs text-slate-400 italic py-2 text-center">Sin unidades auditadas</p>`;
    } else {
      htmlUnidades = `<div class="flex flex-col gap-2">` + unidades.map(u => {
        let estadoBadge;
        if (u.sinUso)        estadoBadge = _badge('Sin uso en pasos', 'warning');
        else if (u.completa) estadoBadge = _badge('Completa', 'success');
        else                 estadoBadge = _badge('Con faltantes', 'warning');
        
        // Hallazgos por paso (faltantes) — solo si los hay
        const hallazgos = (u.porPaso || [])
          .filter(p => p.faltantes && p.faltantes.length > 0)
          .map(p => _fila(`Paso ${p.pasoIndex + 1} — faltantes`,
                          p.faltantes.join(', '), true))
          .join('');
          
        return `
          <div class="p-2 border border-slate-100 rounded-lg bg-slate-50/50 flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-xs flex-wrap gap-2.5">
              <span class="font-bold text-primary font-mono text-[10px]">${Utils.escaparHtml(u.peligroTT)}</span>
              <div class="flex items-center gap-1.5 flex-wrap">
                ${estadoBadge}
                <span class="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.2 rounded-full font-mono">${u.pasosConUnidad} paso(s)</span>
              </div>
            </div>
            ${hallazgos ? `<div class="border-t border-slate-100 pt-1.5 divide-y divide-slate-100">${hallazgos}</div>` : ''}
          </div>`;
      }).join('') + `</div>`;
    }

    return `
      <div class="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 custom-shadow">
        <h4 class="font-bold text-primary text-xs uppercase mb-3 tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[16px] text-accent">fact_check</span>
          Supervisión Consolidada
        </h4>
        <div class="divide-y divide-slate-100">
          ${filasGlobal}
          <div class="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs">
            <span class="text-slate-500 font-medium">Coherencia de Tipos de Trabajo</span>
            ${badgeCoh}
          </div>
          ${detalleCoh}
        </div>
        <h5 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-4 mb-2">Unidades Auditadas por Matriz</h5>
        ${htmlUnidades}
      </div>`;
  }

  function render() {
    const body = Utils.$el(BODY_ID);
    if (!body) return;
    const auditoria = AuditoriaConsolidada.evaluarGlobal();
    body.innerHTML = `
      <div class="flex flex-col gap-4">
        ${_htmlGeneral()}
        ${_htmlResponsables()}
        ${_htmlUbicacion()}
        ${_htmlSenales()}
        ${_htmlPasos()}
        ${_htmlSupervision(auditoria)}
      </div>`;
    _bindEventos();
  }

  State.on('reset', render);
  State.on('pasos:update', render);

  return { render };
})();


/* ───────────────────────────────────────────────────────────────
   UI.Aprobacion — SF-10 Aprobación HSE
   El supervisor HSE registra nombre, observaciones y decisión.
   Controla habilitación del botón PDF en App.
   Si el formulario cambia tras aprobar, se resetea la aprobación.
──────────────────────────────────────────────────────────────── */
const UIAprobacion = (() => {

  const BODY_ID   = 'body-aprobacion';
  const STATUS_ID = 'status-aprobacion';
  let _listenersBound = false;  // guard — SF C1

  // ── HTML ──────────────────────────────────────────────────
  function _html(datos) {
    const { nombreSupervisor, observaciones, estado } = datos;
    const aprobado    = estado === 'aprobado';
    const correccion  = estado === 'requiere_correccion';

    return `
      <div class="flex flex-col gap-3">

        <!-- Nombre Supervisor -->
        <div class="space-y-1">
          <label class="block text-xs font-bold text-primary uppercase tracking-tight" for="inp-supervisor">
            Nombre Supervisor HSE <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="inp-supervisor"
            class="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-[#171c1f] focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            value="${Utils.escaparHtml(nombreSupervisor || '')}"
            placeholder="Nombre completo del supervisor"
            maxlength="100"
            autocomplete="off"
            inputmode="text"
          >
        </div>

        <!-- Observaciones -->
        <div class="space-y-1">
          <label class="block text-xs font-bold text-primary uppercase tracking-tight" for="inp-observaciones">
            Observaciones <span class="text-[10px] text-slate-500 lowercase font-normal">(opcional)</span>
          </label>
          <textarea
            id="inp-observaciones"
            class="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs text-[#171c1f] focus:ring-1 focus:ring-primary focus:border-primary transition-colors resize-none overflow-hidden min-h-[44px]"
            placeholder="Condiciones, restricciones o notas para el registro…"
            maxlength="500"
            rows="1"
          >${Utils.escaparHtml(observaciones || '')}</textarea>
          <p class="text-[10px] text-[#43474f] italic mt-0.5">Máximo 500 caracteres</p>
        </div>

        <!-- Decisión -->
        <div class="space-y-1">
          <p class="block text-xs font-bold text-primary uppercase tracking-tight">
            Decisión del Supervisor HSE <span class="text-red-500">*</span>
          </p>
          <div class="grid grid-cols-2 gap-2 mt-1">

            <!-- Opción Aprobar -->
            <label class="flex items-center gap-2 py-2 px-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 border-slate-200 ${aprobado ? 'bg-green-50 border-green-300 text-green-900 font-semibold' : 'bg-white text-slate-700'}" for="radio-aprobado">
              <input type="radio" name="decision-hse" id="radio-aprobado"
                value="aprobado" class="text-primary focus:ring-primary h-4 w-4 shrink-0" ${aprobado ? 'checked' : ''}>
              <div class="flex items-center gap-1.5 text-xs">
                <span class="material-symbols-outlined text-[18px] text-green-600 font-bold">check_circle</span>
                <span>Aprobar</span>
              </div>
            </label>

            <!-- Opción Requiere Corrección -->
            <label class="flex items-center gap-2 py-2 px-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 border-slate-200 ${correccion ? 'bg-red-50 border-red-300 text-red-900 font-semibold' : 'bg-white text-slate-700'}" for="radio-correccion">
              <input type="radio" name="decision-hse" id="radio-correccion"
                value="requiere_correccion" class="text-primary focus:ring-primary h-4 w-4 shrink-0" ${correccion ? 'checked' : ''}>
              <div class="flex items-center gap-1.5 text-xs">
                <span class="material-symbols-outlined text-[18px] text-red-600 font-bold">cancel</span>
                <span>Requiere Corrección</span>
              </div>
            </label>

          </div>
        </div>

        <!-- Banner de Estado -->
        <div class="py-2 px-3 rounded-lg border text-xs flex items-center gap-2.5 font-medium ${
          aprobado ? 'bg-green-50 border-green-200 text-green-800'
          : correccion ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-slate-50 border-slate-200 text-slate-600'
        }"
          id="aprobacion-status-banner">
          ${_htmlBanner(datos)}
        </div>

      </div>`;
  }

  function _htmlBanner(datos) {
    const { nombreSupervisor, estado } = datos;
    if (estado === 'aprobado') {
      const nombre = nombreSupervisor.trim() || 'Supervisor';
      return `
        <span class="material-symbols-outlined text-green-600 text-[18px] shrink-0">check_circle</span>
        <span>Aprobado por: <strong class="font-bold">${Utils.escaparHtml(nombre)}</strong> — Formulario listo para generar PDF.</span>`;
    }
    if (estado === 'requiere_correccion') {
      return `
        <span class="material-symbols-outlined text-red-600 text-[18px] shrink-0">error</span>
        <span>Requiere corrección — La generación de PDF está bloqueada hasta nueva aprobación.</span>`;
    }
    return `
      <span class="material-symbols-outlined text-slate-400 text-[18px] shrink-0">info</span>
      <span>Pendiente de decisión del Supervisor HSE.</span>`;
  }

  // ── Sincronización de campos ──────────────────────────────
  function _actualizarStatus() {
    const datos = State.get('aprobacion') || {};
    const { nombreSupervisor, estado } = datos;

    if (estado === 'aprobado' && nombreSupervisor.trim().length >= 3) {
      Utils.renderStatus(STATUS_ID, 'ok', '✓ Aprobado');
    } else if (estado === 'requiere_correccion') {
      Utils.renderStatus(STATUS_ID, 'warning', '⚠ Requiere corrección');
    } else {
      Utils.renderStatus(STATUS_ID, 'neutral', 'Pendiente');
    }
  }

  function _actualizarBanner() {
    const el = Utils.$el('aprobacion-status-banner');
    if (!el) return;
    const datos = State.get('aprobacion') || {};
    el.innerHTML = _htmlBanner(datos);
    el.className = `p-3 rounded-lg border text-xs flex items-center gap-2.5 font-medium ${
      datos.estado === 'aprobado'             ? 'bg-green-50 border-green-200 text-green-800'
      : datos.estado === 'requiere_correccion' ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-slate-50 border-slate-200 text-slate-600'
    }`;
  }

  // ── Eventos ───────────────────────────────────────────────
  function _bindEventos() {
    if (_listenersBound) return;
    const body = Utils.$el(BODY_ID);
    if (!body) return;

    body.addEventListener('input', e => {
      if (e.target.id === 'inp-supervisor') {
        State.set('aprobacion.nombreSupervisor', e.target.value);
        _actualizarStatus();
        App.actualizarBtnPDF();
      }
      if (e.target.id === 'inp-observaciones') {
        State.set('aprobacion.observaciones', e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
      }
    });

    body.addEventListener('change', e => {
      const radio = e.target.closest('input[name="decision-hse"]');
      if (!radio) return;
      State.set('aprobacion.estado', radio.value);

      const cardAprobado = body.querySelector('label[for="radio-aprobado"]');
      const cardCorreccion = body.querySelector('label[for="radio-correccion"]');

      if (radio.value === 'aprobado') {
        cardAprobado.className = 'flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 bg-green-50 border-green-300 text-green-900 font-semibold';
        cardCorreccion.className = 'flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 border-slate-200 bg-white text-slate-700';
      } else if (radio.value === 'requiere_correccion') {
        cardAprobado.className = 'flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 border-slate-200 bg-white text-slate-700';
        cardCorreccion.className = 'flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all hover:bg-slate-50 bg-red-50 border-red-300 text-red-900 font-semibold';
      }

      _actualizarBanner();
      _actualizarStatus();
      App.actualizarBtnPDF();
    });

    _listenersBound = true;
  }

  function render() {
    const body = Utils.$el(BODY_ID);
    if (!body) return;
    const datos = State.get('aprobacion') || {};
    body.innerHTML = _html(datos);
    _bindEventos();
    _actualizarStatus();

    // Auto-ajustar altura inicial de observaciones
    const tx = Utils.$el('inp-observaciones');
    if (tx && tx.value.trim()) {
      tx.style.height = 'auto';
      tx.style.height = tx.scrollHeight + 'px';
    }
  }

  function validar() {
    const datos = State.get('aprobacion') || {};
    return datos.estado === 'aprobado' &&
           (datos.nombreSupervisor || '').trim().length >= 3;
  }

  /**
   * Resetea la aprobación si el formulario cambia después de aprobar.
   * Llamado desde App cuando detecta State.on('change') con estado = 'aprobado'.
   * Solo resetea si el cambio no provino de la propia sección de aprobación.
   */
  function resetearSiAprobado(claveModificada) {
    const aprobacionClaves = [
      'aprobacion.nombreSupervisor',
      'aprobacion.observaciones',
      'aprobacion.estado'
    ];
    if (aprobacionClaves.includes(claveModificada)) return;
    if ((State.get('aprobacion.estado')) !== 'aprobado') return;

    State.set('aprobacion.estado', null, 'aprobacion:reset');
    Utils.toast(
      'Formulario modificado. El supervisor HSE debe aprobar nuevamente.',
      'warning', 4000
    );
    render();
    App.actualizarBtnPDF();
  }

  State.on('reset', render);

  return { render, validar, resetearSiAprobado };
})();


/* ───────────────────────────────────────────────────────────────
   UI.DocId — SF-11 Identificación del Documento
   Genera el nombre único del archivo (área + consecutivo).
   El consecutivo se genera al abrir la sección por primera vez.
   El nombre del archivo se persiste en State inmediatamente.
──────────────────────────────────────────────────────────────── */
const UIDocId = (() => {

  const STATUS_ID = 'status-docid';
  let _listenersBound = false;

  function _recalcularNombre() {
    const area   = State.get('identificacion.areaEjecutora') || '';
    const consec = (State.get('identificacion.consecutivo') || '').trim();

    let nombre = '';
    if (area && consec)       nombre = `${area}-${consec}`;
    else if (area)            nombre = `${area}-`;
    else if (consec)          nombre = `---${consec}`;

    State.set('identificacion.nombreArchivo', nombre);

    _actualizarStatus(area, consec);
    App.actualizarBtnPDF();
  }

  function _actualizarStatus(area, consec) {
    if (area && consec) {
      Utils.renderStatus(STATUS_ID, 'ok', `✓ ${Utils.escaparHtml(area)}-${Utils.escaparHtml(consec)}`);
    } else {
      Utils.renderStatus(STATUS_ID, 'warning', '⚠ Incompleto');
    }
  }

  function _bindEventos() {
    if (_listenersBound) return;

    document.getElementById('inp-area-ejecutora')?.addEventListener('change', e => {
      State.set('identificacion.areaEjecutora', e.target.value);
      _recalcularNombre();
    });

    document.getElementById('inp-consecutivo')?.addEventListener('input', e => {
      const limpio = e.target.value.replace(/\s/g, '');
      e.target.value = limpio;
      State.set('identificacion.consecutivo', limpio);
      _recalcularNombre();
    });

    document.getElementById('btn-regenerar-consec')?.addEventListener('click', async () => {
      const actual = State.get('identificacion.consecutivo') || '';
      if (actual.trim()) {
        const ok = await Modal.confirmar(
          'Regenerar consecutivo',
          `El consecutivo actual "${actual}" se reemplazará con la hora actual. ¿Continuar?`,
          { labelOk: 'Regenerar', peligroso: false }
        );
        if (!ok) return;
      }
      const nuevo = Utils.generarConsecutivo();
      State.set('identificacion.consecutivo', nuevo);
      const inp = document.getElementById('inp-consecutivo');
      if (inp) inp.value = nuevo;
      _recalcularNombre();
    });

    _listenersBound = true;
  }

  function _inicializarConsecutivo() {
    const actual = State.get('identificacion.consecutivo') || '';
    if (!actual.trim()) {
      const generado = Utils.generarConsecutivo();
      State.set('identificacion.consecutivo', generado);
      return generado;
    }
    return actual;
  }

  function render() {
    const selArea = document.getElementById('inp-area-ejecutora');
    if (!selArea) return;

    _inicializarConsecutivo();

    const areaActual = State.get('identificacion.areaEjecutora') || '';
    const areas = Config.get('areasEjecutoras') || [];
    
    let html = '<option value="">Seleccione un área...</option>';
    areas.forEach(a => {
      html += `<option value="${Utils.escaparHtml(a.codigo)}" ${a.codigo === areaActual ? 'selected' : ''}>
        ${Utils.escaparHtml(a.codigo)} — ${Utils.escaparHtml(a.descripcion)}
      </option>`;
    });
    selArea.innerHTML = html;

    const inpConsec = document.getElementById('inp-consecutivo');
    if (inpConsec) {
      inpConsec.value = State.get('identificacion.consecutivo') || '';
    }

    _bindEventos();
    _recalcularNombre();
  }

  function validar() {
    const area   = State.get('identificacion.areaEjecutora') || '';
    const consec = State.get('identificacion.consecutivo')   || '';
    return !!(area.trim() && consec.trim());
  }

  State.on('reset', render);

  return { render, validar };
})();


/* ───────────────────────────────────────────────────────────────
   PRINT — SF-12/SF-18/SF-19 Generación PDF con jsPDF
   Arquitectura: DD-01 a DD-07 + AJ-01 a AJ-04 (aprobadas)

   Decisiones fijas:
   · Catálogo peligros → desde Config (peligros.json)   [AJ-01]
   · Guía controles   → desde Config (controles.json)   [AJ-02]
   · Fuente única de datos JSON → Config → PDF           [AJ-03]
   · Logo con aspect-ratio preservado                    [AJ-04]
   · Máximo 8 responsables                               [DD-02]
   · Catálogo y guía son contenido fijo en Pág. 1       [DD-03/04]
   · Página 2+ solo Ítem|Paso|Ítem|Peligros|Ítem|Ctrl   [DD-05]
   · Solo códigos en Pág. 2                              [DD-06]
   · ITEM = paso.numero (único origen)
──────────────────────────────────────────────────────────────── */
const Print = (() => {

  // ── Layout — Fase 5C.6: medidas exactas DOCX maestro (FINAL) ───
  // Fuente: FORMATO_FM_HSE_022_DIMENSIONES.md + TYPOGRAPHY.md
  // Sin estimaciones. Sin aproximaciones visuales.
  const L = {
    // Página — Letter Landscape
    pw: 279.4, ph: 215.9,
    ml: 12.7,  mr: 12.7, mt: 12.7, mb: 12.7,
    footerH: 7.0,
    get aw()      { return this.pw - this.ml - this.mr; },
    get contentH(){ return this.ph - this.mt - this.mb; },

    // Columnas Pág 1 — DOCX exacto
    p1ColW: 76.3411,
    tblW:   79.00,
    tblGap: 3.53,
    ctlNumColW: 4.0,
    ctlNumGap:  0.8,
    ctlHang:    6.297,
    ctlLeft:    12.594,
    szCtlNum:   8,
    ctlEmptyPara: 1.94,
    p1Gap:  12.4883,
    get p1C2X(){ return this.ml + this.p1ColW + this.p1Gap; },
    get p1C3X(){ return this.ml + this.p1ColW*2 + this.p1Gap*2; },

    // Encabezado (Tabla 0) — DOCX exacto
    hdrH:       15.52,
    hdrRowH:     3.8806,
    logoCol:    15.6104,
    titleCol:   34.1313,
    metaLblCol: 12.4354,
    metaValCol: 14.5521,

    // CF-09: logo dimensiones exactas
    logoW: 13.0969,
    logoH:  8.9958,

    // Responsables (Tabla 1) — DOCX exacto
    rNomW: 31.9969, rCedW: 23.0011, rFirW: 24.0065,
    rRowH:  4.9918,
    rRow8:  4.2333,
    rRow9:  3.9688,
    rRows:  8,

    // Punto encuentro / Ducha (Tabla 2) — DOCX exacto
    ptLblH: 2.9986,
    ptValH: 4.992,
    dlValH: 4.992,

    // Señales (Tabla 3) — CF-04 DOCX exacto
    spColL:  39.5288,
    spColR:  39.4758,
    spHdrH:   2.9986,
    spInstrH: 8.9958,
    spRowH:   4.9918,
    spLastH:  3.3514,

    // CF-08: Padding real Word (default tblCellMar)
    padL: 1.9, padR: 1.9, padT: 0.0, padB: 0.0,

    // Catálogo peligros (Tabla 4) — CF-03 DOCX exacto
    pelSubL: 39.4935,
    pelSubR: 39.5111,
    pelHdrH:  7.0026,
    pelRowH:  3.792,
    pelItemH: 3.493,

    // Guía controles (Tabla 5) — CF-05 DOCX exacto
    ctlNumW:  9.9131,
    ctlDescW: 69.0915,
    ctlHdrH:  3.4396,
    ctlRowH:  2.9986,

    // Página 2 — alineada con columnas DOCX
    get p2B1X(){ return this.ml; },
    get p2B2X(){ return this.p1C2X; },
    get p2B3X(){ return this.p1C3X; },
    p2BW:   76.3411,
    p2ItmW:  9.5,
    get p2ContW(){ return this.p2BW - this.p2ItmW; },
    p2HdrH:  5.997,
    p2RowH: 19.403,
    p2Rows:  9,

    // Tipografías — valores AN (generador_html.py / ESPECIFICACION AN / Word AN)
    szEncHdr:    10,
    szMetaLbl:    7,
    szMetaVal:    6.5,
    szCampo:      10,
    szComp:       9,
    szResp:       10,
    szPtEnc:      10,
    szSenHdr:     10,
    szSenInstr:   9,
    szSenTxt:     8.5,
    szPelTitulo:  8.5,
    szPelCat:     7.5,
    szPelItem:    7,
    szPelDesc:    7,
    szCtlHdr:     8,
    szCtlDesc:    7.5,
    szFooter:     8,
    szFooterPag:  7,
    szTblHdr:     10,
    szTblItem:    8,
    szTblCont:    9,

    // CF-07: Leading exacto DOCX (font_pt × 1.2 × 0.352778mm)
    lh7:   2.963,
    lh75:  3.175,
    lh8:   3.387,
    lh9:   3.810,
    lh10:  4.233,

    // Bordes — DOCX single/0.5pt
    lwExt: 0.5,
    lwInt: 0.3,
    // Casilla vectorial AN (.cbox: 2x2mm, borde 0.2mm) — R2 reconstrucción AN
    cbSize: 2.0, cbLine: 0.2, cbCheck: 0.35, cbRise: 0.55,
    // Factor de cap-height (Arial Narrow) para centrado vertical de celdas (vAlign=center AN)
    capFactor: 0.72,
    cellPadV: 0.5,

    // Colores
    cHdrBg:  [0, 48, 87],
    cHdrFg:  [255, 255, 255],
    cSecBg:  [173, 198, 222],
    cBorder: [0, 0, 0],
    cText:   [0, 0, 0],
    cFooter: [80, 80, 80],
    cLine:   [170, 170, 170],
    cWhite:  [255, 255, 255],

    get footerY(){ return this.ph - this.mb + 1.5; }
  };

    // ── Variables de sesión de renderizado ───────────────────
  let _doc = null;
  let _blobURL = null;
  let _genTimestamp = '';

  // ── Helpers de dibujo ────────────────────────────────────

  // Fuentes disponibles en el documento (se actualizan al cargar)
  let _arialNarrowLoaded = false;

  function _setFont(style, size, color, useNarrow = false) {
    // useNarrow: usar Arial Narrow (fuente oficial del DOCX maestro)
    //            si no está cargada, fallback a Helvetica
    if (useNarrow && _arialNarrowLoaded) {
      _doc.setFont('ArialNarrow', style || 'normal');
    } else {
      _doc.setFont('helvetica', style || 'normal');
    }
    if (size)  _doc.setFontSize(size);
    if (color) _doc.setTextColor(...color);
  }

  function _setFontNarrow(style, size, color) {
    _setFont(style, size, color, true);
  }

  function _rect(x, y, w, h, fillColor, strokeColor) {
    if (fillColor) {
      _doc.setFillColor(...fillColor);
      _doc.rect(x, y, w, h, strokeColor ? 'FD' : 'F');
    } else {
      _doc.setDrawColor(...(strokeColor || L.cBorder));
      _doc.rect(x, y, w, h, 'S');
    }
    _doc.setDrawColor(...L.cBorder);
  }

  function _text(txt, x, y, opts) {
    _doc.text(String(txt || ''), x, y, opts || {});
  }

  /**
   * Baseline para CENTRAR verticalmente texto en una celda (replica el
   * vAlign=center del Word AN, presente en las 174 celdas del documento).
   * @param topCelda  borde superior de la celda (mm)
   * @param altoCelda altura de la celda (mm)
   * @param fontPt    tamaño de fuente del texto (pt)
   * @returns coordenada Y del baseline (mm)
   */
  function _vbase(topCelda, altoCelda, fontPt) {
    const capH = fontPt * 0.352778 * L.capFactor; // cap-height aprox. Arial Narrow
    return topCelda + altoCelda / 2 + capH / 2;
  }

  /** Escribe texto con wrap dentro de una celda y retorna el alto real usado */
  function _cellText(txt, x, y, w, size, style, color) {
    _setFont(style || 'normal', size || L.szNorm, color || L.cText);
    const lines = _doc.splitTextToSize(String(txt || ''), w - L.tPadL * 2);
    const lineH = (size || L.szNorm) * 0.352778 * 1.35; // pt → mm × leading
    lines.forEach((line, i) => {
      _text(line, x + L.tPadL, y + L.tPadH + lineH * (i + 0.75));
    });
    return Math.max(L.tMinH, L.tPadH * 2 + lines.length * lineH);
  }

  /** Dibuja una línea horizontal */
  function _hline(x, y, w, color) {
    _doc.setDrawColor(...(color || L.cBorder));
    _doc.line(x, y, x + w, y);
    _doc.setDrawColor(...L.cBorder);
  }

  /**
   * Casilla de verificación vectorial (reemplaza glifos Unicode ☐/☑ que
   * Helvetica/Arial Narrow no contienen). Réplica de la casilla AN
   * (.cbox del generador_html: cuadro 2x2mm + palomita cuando está marcada).
   * @param x  coordenada X (mm) del borde izquierdo del cuadro
   * @param yBaseline  baseline del texto adyacente (mm); el cuadro se centra sobre ella
   * @param sel  true si está marcada (dibuja la palomita)
   */
  function _checkbox(x, yBaseline, sel) {
    const s = L.cbSize;                 // lado del cuadro (mm)
    const top = yBaseline - s + L.cbRise; // alinear el cuadro con el texto
    _doc.setLineWidth(L.cbLine);
    _doc.setDrawColor(...L.cBorder);
    _doc.rect(x, top, s, s, 'S');       // contorno del cuadro
    if (sel) {                          // palomita vectorial (dos trazos)
      _doc.setLineWidth(L.cbCheck);
      const x1 = x + s * 0.18, y1 = top + s * 0.52;
      const x2 = x + s * 0.42, y2 = top + s * 0.78;
      const x3 = x + s * 0.84, y3 = top + s * 0.20;
      _doc.line(x1, y1, x2, y2);
      _doc.line(x2, y2, x3, y3);
    }
    _doc.setLineWidth(L.lwInt);
  }

  /** Posición X de inicio del área útil */
  function _x0() { return L.ml; }

  // ── Encabezado — CF-01/CF-02/CF-09 ─────────────────────────────

  function _dibujarEncabezado(logoData) {
    const x = L.ml, y = L.mt, w = L.p1ColW, h = L.hdrH;
    _doc.setLineWidth(L.lwExt); _doc.setDrawColor(...L.cBorder);
    _doc.rect(x, y, w, h, 'S');

    // CF-09: logo dimensiones exactas del DOCX (13.0969×8.9958mm)
    if (logoData && logoData.uri) {
      try {
        const fmt = logoData.mime || 'PNG';
        const offX = x + (L.logoCol - L.logoW) / 2;
        const offY = y + (h - L.logoH) / 2;
        _doc.addImage(logoData.uri, fmt, offX, offY, L.logoW, L.logoH, undefined, 'FAST');
      } catch(e) {}
    }
    _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
    _doc.line(x + L.logoCol, y, x + L.logoCol, y + h);

    // Título — Arial Narrow Bold 10pt, centrado H+V
    const titX = x + L.logoCol, titW = L.titleCol;
    _setFontNarrow('bold', L.szEncHdr, L.cText);
    const TITULO = ['ANÁLISIS CONTINUO', 'DE PELIGROS POR', 'LA TAREA'];
    const totalHT = TITULO.length * L.lh10;
    const y0 = y + (h - totalHT) / 2 + L.lh10 * 0.78;
    TITULO.forEach((ln, i) => _text(ln, titX + titW / 2, y0 + i * L.lh10, { align: 'center' }));

    // Línea vertical título|etiqueta
    const mx = x + L.logoCol + L.titleCol;
    _doc.setLineWidth(L.lwInt);
    _doc.line(mx, y, mx, y + h);

    // CF-01: valores metadatos con alineación CENTER
    const valX = mx + L.metaLblCol;
    _doc.line(valX, y, valX, y + h);

    const docCfg = Config.get('empresa') || {};
    const metas = [
      ['Código:',   docCfg.documentoCodigo   || 'FM-HSE-022'],
      ['Página:',   'Pie de pág.'],
      ['Revisión:', docCfg.documentoRevision || '1'],
      ['Fecha:',    docCfg.documentoFecha    || '11-mar-2026'],
    ];
    const capH7 = L.szMetaLbl * 0.352778 * 0.72;
    const vOff  = L.hdrRowH / 2 + capH7 / 2;

    metas.forEach(([lbl, val], i) => {
      const rowY = y + i * L.hdrRowH;
      if (i > 0) { _doc.setLineWidth(L.lwInt); _doc.line(mx, rowY, x + w, rowY); }
      _setFontNarrow('bold',   L.szMetaLbl, L.cText);
      _text(lbl, mx + L.padL, rowY + vOff);
      // CF-01: CENTER en la celda valor
      _setFontNarrow('normal', L.szMetaVal, L.cText);
      _text(val, valX + L.metaValCol / 2, rowY + vOff, { align: 'center' });
    });
  }

  // ── Información General — CF-06/CF-07 ────────────────────────

  function _dibujarInfoGeneral(general, yStart) {
    const x = L.ml; let y = yStart;
    [['Lugar', general.lugar], ['Fecha', general.fecha], ['Tarea', general.tarea]]
    .forEach(([lbl, val]) => {
      _setFontNarrow('bold',   L.szCampo, L.cText);
      _text(`${lbl}:`, x + L.padL, _vbase(y, L.lh9 + 1.5, L.szCampo));
      _setFontNarrow('normal', L.szCampo, L.cText);
      const lines = _doc.splitTextToSize(val || '', L.p1ColW - 16);
      _text(lines[0] || '', x + 16, _vbase(y, L.lh9 + 1.5, L.szCampo));
      _doc.setDrawColor(...L.cLine); _doc.setLineWidth(0.2);
      _doc.line(x + 16, y + L.lh9 + 0.5, x + L.p1ColW - L.padL, y + L.lh9 + 0.5);
      _doc.setDrawColor(...L.cBorder);
      y += L.lh9 + 1.5;
    });
    _setFontNarrow('italic', L.szComp, L.cText);
    const compL = _doc.splitTextToSize(
      'Identificar continuamente los peligros generados por la tarea y tomaré las medidas de control para prevenir accidentes',
      L.p1ColW - L.padL * 2);
    compL.slice(0, 4).forEach((ln, i) => _text(ln, x + L.padL, y + (i + 1) * L.lh9));
    return y + Math.min(compL.length, 4) * L.lh9 + 1.5;
  }

  // ── Responsables — CF-02/CF-07 ────────────────────────────────

  function _dibujarResponsables(responsables, yStart) {
    const x = L.ml; let y = yStart; const w = L.tblW;
    const NW = L.rNomW, CW = L.rCedW, FW = L.rFirW;

    _rect(x, y, w, L.lh9 + 2, L.cHdrBg);
    _setFontNarrow('bold', L.szResp, L.cHdrFg);
    _text('Responsables de la Tarea', x + w / 2, _vbase(y, L.lh9 + 2, L.szResp), { align: 'center' });
    y += L.lh9 + 2;

    _rect(x, y, w, L.lh9 + 1.5, L.cSecBg);
    _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
    _doc.rect(x, y, w, L.lh9 + 1.5, 'S');
    _setFontNarrow('bold', L.szResp, L.cText);
    _text('Nombre', x + NW / 2, _vbase(y, L.lh9 + 1.5, L.szResp), { align: 'center' });
    _doc.line(x + NW, y, x + NW, y + L.lh9 + 1.5);
    _text('Cédula', x + NW + CW / 2, _vbase(y, L.lh9 + 1.5, L.szResp), { align: 'center' });
    _doc.line(x + NW + CW, y, x + NW + CW, y + L.lh9 + 1.5);
    _text('Firma', x + NW + CW + FW / 2, _vbase(y, L.lh9 + 1.5, L.szResp), { align: 'center' });
    y += L.lh9 + 1.5;

    const lista = (responsables || []).slice(0, L.rRows);
    for (let i = 0; i < L.rRows; i++) {
      const rh = i < 6 ? L.rRowH : (i === 6 ? L.rRow8 : L.rRow9);
      const r  = lista[i] || { nombre: '', cedula: '' };
      _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
      _doc.rect(x, y, w, rh, 'S');
      _doc.line(x + NW, y, x + NW, y + rh);
      _doc.line(x + NW + CW, y, x + NW + CW, y + rh);
      _setFontNarrow('normal', 9, L.cText);
      if (r.nombre) _text(r.nombre.substring(0, 26), x + L.padL, _vbase(y, rh, 9));
      if (r.cedula) _text(r.cedula, x + NW + L.padL, _vbase(y, rh, 9));
      y += rh;
    }
    return y;
  }

  // ── Punto de Encuentro y Ducha — CF-02/CF-07 ─────────────────

  function _dibujarUbicacion(pe, dl, yStart) {
    const x = L.ml; let y = yStart; const w = L.tblW;
    const pairs = [
      ['Punto de encuentro cercano:', pe, L.ptLblH, L.ptValH],
      ['Ducha y lavaojos cercano:',  dl, L.ptLblH, L.dlValH],
    ];
    pairs.forEach(([lbl, val, lblH, valH]) => {
      // atLeast: la fila crece si el texto (AN10) es más alto que el mínimo
      const lblHE = Math.max(lblH, L.szPtEnc * 0.352778 + L.cellPadV);
      _rect(x, y, w, lblHE, L.cSecBg);
      _doc.setLineWidth(L.lwExt); _doc.setDrawColor(...L.cBorder);
      _doc.rect(x, y, w, lblHE, 'S');
      _setFontNarrow('bold', L.szPtEnc, L.cText);
      _text(lbl, x + L.padL, _vbase(y, lblHE, L.szPtEnc));
      y += lblHE;
      _doc.setLineWidth(L.lwInt); _doc.rect(x, y, w, valH, 'S');
      _setFontNarrow('normal', L.szPtEnc, L.cText);
      _text(val || '', x + L.padL, _vbase(y, valH, L.szPtEnc));
      y += valH;
    });
    return y;
  }

  // ── Señales para Detener la Tarea — CF-04/CF-07 ──────────────

  function _dibujarSenales(senalesParada, yStart) {
    const x = L.ml; let y = yStart; const w = L.tblW;
    const botY   = L.mt + L.contentH;
    const totalH = botY - y;
    _doc.setLineWidth(L.lwExt); _doc.setDrawColor(...L.cBorder);
    _doc.rect(x, y, w, totalH, 'S');

    const spHdrHE = Math.max(L.spHdrH, L.szSenHdr * 0.352778 + L.cellPadV);
    _rect(x, y, w, spHdrHE, L.cHdrBg);
    _setFontNarrow('bold', L.szSenHdr, L.cHdrFg);
    _text('SEÑALES PARA DETENER LA TAREA', x + w / 2, _vbase(y, spHdrHE, L.szSenHdr), { align: 'center' });
    y += spHdrHE;

    _setFontNarrow('normal', L.szSenInstr, L.cText);
    const instrW = w - L.padL * 2;
    const instrL = _doc.splitTextToSize(
      'Escoja dos o más situaciones que podrían ocurrir o que le hayan ocurrido.',
      instrW);
    const instrLh = L.szSenInstr * 0.352778 * 1.0;  // interlineado 1.0
    instrL.slice(0, 2).forEach((ln, i) =>
      _text(ln, x + L.padL, y + L.szSenInstr * 0.352778 * L.capFactor + 0.6 + i * instrLh,
        { maxWidth: instrW, align: 'justify' }));
    y += L.spInstrH;

    const catalogo = Config.get('senalesParada') || [];
    const selIds   = (senalesParada && senalesParada.seleccionadas) || [];
    const textos   = (senalesParada && senalesParada.textos) || {};
    const checks   = catalogo.filter(s => s.tipo === 'checkbox');
    const otros    = catalogo.filter(s => s.tipo === 'texto');

    // Orden EXACTO del Word AN (T3): 8 filas, distribución por filas left/right.
    // Izquierda: los primeros 8 checkbox. Derecha: los 5 checkbox restantes
    // seguidos de los 3 "Otros" al final de la columna derecha.
    const nFilas = 8;
    const colIzq = checks.slice(0, nFilas);
    const colDer = checks.slice(nFilas).concat(otros);

    // Recalcular el alto de fila para ocupar todo el alto disponible de la tabla
    const rowH = (totalH - spHdrHE - L.spInstrH) / nFilas;

    for (let i = 0; i < nFilas; i++) {
      [colIzq[i], colDer[i]].forEach((s, ci) => {
        if (!s) return;
        const sel = selIds.includes(s.id);
        const cx  = x + ci * (w / 2) + L.padL;
        _setFontNarrow('normal', L.szSenTxt, L.cText);
        // Alinear la casilla con la primera línea de texto en el rowH recalculado
        const yBaseline = _vbase(y, rowH, L.szSenTxt);
        _checkbox(cx, yBaseline, sel);
        const tx = cx + L.cbSize + 1;
        const tw = w / 2 - (L.cbSize + 1) - L.padL * 2;
        const lh = L.szSenTxt * 0.352778 * 1.15;
        if (s.tipo === 'texto') {
          // Campo "Otros": etiqueta + línea de relleno estática que llena el ancho de la celda
          const tv = textos[s.id] || '';
          _text("Otros: ", tx, yBaseline);
          const labelW = _doc.getTextWidth("Otros: ");
          const lineX = tx + labelW;
          const cellRight = x + (ci + 1) * (w / 2) - L.padR;
          _hline(lineX, yBaseline + 0.5, cellRight - lineX, [170, 170, 170]);
          if (tv) {
            _text(tv, lineX + 1, yBaseline);
          }
        } else {
          // Si el texto tiene dos líneas, la segunda queda por debajo del checkbox
          const lns = _doc.splitTextToSize(s.texto, tw).slice(0, 2);
          lns.forEach((ln, li) => _text(ln, tx, yBaseline + li * lh));
        }
      });
      y += rowH;
    }
  }

  // ── Catálogo peligros — CF-02/CF-03/CF-07 ────────────────────

  function _dibujarCatalogoPeligros(xCol, yTop) {
    const categorias = Config.getPeligrosPorCategoria();
    let y = yTop; const w = L.tblW;
    _doc.setLineWidth(L.lwExt); _doc.setDrawColor(...L.cBorder);
    _doc.rect(xCol, yTop, w, L.contentH, 'S');

    _setFontNarrow('normal', L.szPelTitulo, L.cText);
    const titL = _doc.splitTextToSize(
      'Seleccione los peligros identificados antes del desarrollo de la tarea',
      w - L.padL * 2).slice(0, 2);
    const titLh = L.szPelTitulo * 0.352778 * 1.05;
    const titY0 = y + L.pelHdrH / 2 - ((titL.length - 1) * titLh) / 2
                  + (L.szPelTitulo * 0.352778 * L.capFactor) / 2;
    titL.forEach((ln, i) => _text(ln, xCol + L.padL, titY0 + i * titLh));
    y += L.pelHdrH;

    // CF-03: sub-cols exactas del DOCX
    const SL = L.pelSubL;
    const maxW = SL - L.padL - 6.5;
    const itemLh = L.szPelDesc * 0.352778 * 1.0;

    // Preprocesar categorías y filas para calcular la altura necesaria sin escalar
    const preprocessedCat = [];
    let H_unscaled = 0;
    categorias.forEach(cat => {
      const p   = cat.peligros || [];
      const mid = Math.ceil(p.length / 2);
      const s1  = p.slice(0, mid), s2 = p.slice(mid);
      const rowHeights = [];
      const rowLines = [];
      for (let i = 0; i < Math.max(s1.length, s2.length); i++) {
        const lns = [s1[i], s2[i]].map(pp =>
          pp ? _doc.splitTextToSize(pp.descripcion, maxW).slice(0, 2) : []);
        const nMax = Math.max(1, lns[0].length, lns[1].length);
        const rowH = Math.max(L.pelItemH, nMax * itemLh + 0.6);
        rowHeights.push(rowH);
        rowLines.push(lns);
      }
      preprocessedCat.push({ cat, s1, s2, rowHeights, rowLines });
      H_unscaled += L.pelRowH;
      rowHeights.forEach(h => { H_unscaled += h; });
      H_unscaled += 0.4;
    });

    // Calcular factor de escala para dejar un padding mínimo al final (evitando que la última celda pegue al recuadro)
    const bottomPadding = 1.0; // padding mínimo de 1mm al final (ajustado a 1/3)
    const availableH = L.contentH - L.pelHdrH - bottomPadding;
    const scale = H_unscaled > availableH ? (availableH / H_unscaled) : 1.0;

    preprocessedCat.forEach(({ cat, s1, s2, rowHeights, rowLines }) => {
      const catH = L.pelRowH * scale;
      _rect(xCol, y, w, catH, L.cSecBg);
      _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
      _doc.rect(xCol, y, w, catH, 'S');
      _setFontNarrow('bold', L.szPelCat, L.cText);
      _text(cat.categoria, xCol + w / 2, _vbase(y, catH, L.szPelCat), { align: 'center' });
      y += catH;

      for (let i = 0; i < rowHeights.length; i++) {
        const rowH = rowHeights[i] * scale;
        const lns = rowLines[i];
        [s1[i], s2[i]].forEach((pp, ci) => {
          if (!pp) return;
          const px = xCol + ci * SL + L.padL;
          const nl = lns[ci].length;
          const y0 = y + rowH / 2 - ((nl - 1) * itemLh * scale) / 2
                     + (L.szPelDesc * 0.352778 * L.capFactor) / 2;
          _setFontNarrow('bold',   L.szPelItem, L.cText);
          _text(`${pp.codigo}.`, px, y0);
          _setFontNarrow('normal', L.szPelDesc, L.cText);
          lns[ci].forEach((ln, li) => _text(ln, px + 6.5, y0 + li * itemLh * scale));
        });
        y += rowH;
      }
      y += 0.4 * scale;
    });
  }

  // ── Guía controles — CF-02/CF-05/CF-07 ───────────────────────

  function _dibujarGuiaControles(xCol, yTop) {
    const controles = Config.getControles()
      .slice().sort((a, b) => parseInt(a.codigo) - parseInt(b.codigo));
    let y = yTop; const w = 76.02; // Ancho real de la Tabla 5 en DOCX (10.00 + 0.34 + 63.27 + 2.42 mm)
    _doc.setLineWidth(L.lwExt); _doc.setDrawColor(...L.cBorder);
    _doc.rect(xCol, yTop, w, L.contentH, 'S');

    // CF-05: header altura exacta 3.4396mm
    _rect(xCol, y, w, L.ctlHdrH, L.cHdrBg);
    _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
    _doc.rect(xCol, y, w, L.ctlHdrH, 'S');
    _setFontNarrow('bold', L.szCtlHdr, L.cHdrFg);
    _text('GUÍA MEDIDAS PREVENTIVAS Y DE CONTROL',
      xCol + w / 2, _vbase(y, L.ctlHdrH, L.szCtlHdr), { align: 'center' });
    y += L.ctlHdrH;

    // Sangría AN (numbering.xml): left=12.594mm, hanging=6.297mm, relativos
    // al margen de celda. El número se ubica en (left-hanging) y el texto en left.
    // Número Arial Narrow 8pt, texto 7.5pt, interlineado 1.15, sin espacios.
    const cellL  = xCol + L.padL;            // borde interno de celda
    const numX   = cellL + L.ctlHang;        // número en left-hanging = 6.297mm
    const descX  = cellL + L.ctlLeft;        // texto en left = 12.594mm
    const descW  = w - L.padL - L.ctlLeft - L.padL; // Ajustado dinámicamente al nuevo ancho

    // Párrafo vacío inicial (5.5pt)
    y += L.ctlEmptyPara;                     

    // Reservar espacio al final de la columna para un párrafo en blanco de fuente tamaño 5 (5 * 0.352778 * 1.15 = 2.03 mm)
    const blankParaH = 5 * 0.352778 * 1.15; 
    const availableH = L.contentH - L.ctlHdrH - L.ctlEmptyPara - blankParaH;
    let totalLines = 0;
    const preprocessed = [];
    controles.forEach(ctrl => {
      const lines = _doc.splitTextToSize(ctrl.descripcion, descW);
      const count = Math.max(1, lines.length);
      preprocessed.push({ ctrl, lines, count });
      totalLines += count;
    });

    const ctlLh = availableH / (totalLines || 1);

    preprocessed.forEach(({ ctrl, lines, count }) => {
      const baseY = y + L.szCtlDesc * 0.352778 * L.capFactor + 0.4;
      _setFontNarrow('normal', L.szCtlNum, L.cText);
      _text(`${ctrl.codigo}.`, numX, baseY);
      _setFontNarrow('normal', L.szCtlDesc, L.cText);
      lines.forEach((ln, li) => _text(ln, descX, baseY + li * ctlLh));
      y += count * ctlLh;
    });
  }

  // ── Footer — CF-02/CF-07 ──────────────────────────────────────

  function _dibujarFooter(pageNum) {
    const x = L.ml, y = L.footerY;
    const nombre = (State.get('identificacion') || {}).nombreArchivo || 'FM-HSE-022';
    _setFontNarrow('normal', L.szFooter, L.cFooter);
    // Eliminada la línea horizontal que se superponía con las tablas del contenido
    // Trazabilidad documental (mejora funcional aprobada, conservada): nombre + timestamp
    _text(`${nombre} | ${_genTimestamp}`, x, y + 2);
    // Texto AN del documento maestro (capitalización oficial)
    _text('Copia no Controlada', x + L.aw / 2, y + 2, { align: 'center' });
    // El número de página lo escribe _actualizarTotalPaginas (fuente única,
    // evita superposición). NC-H.
  }

  // ── Tabla Pág 2 — R-14/R-15/R-16 ────────────────────────────

  function _dibujarHeaderTabla(yTop) {
    const blqs = [
      [L.p2B1X, 'Pasos de la Tarea'],
      [L.p2B2X, 'Peligros Identificados'],
      [L.p2B3X, 'Medidas Preventivas y de Control'],
    ];
    blqs.forEach(([bx, lbl]) => {
      _rect(bx, yTop, L.p2BW, L.p2HdrH, L.cSecBg);
      _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
      _doc.rect(bx, yTop, L.p2BW, L.p2HdrH, 'S');
      _doc.line(bx + L.p2ItmW, yTop, bx + L.p2ItmW, yTop + L.p2HdrH);
      _setFontNarrow('bold', L.szTblHdr, L.cText);
      _text('Ítem', bx + L.p2ItmW / 2, yTop + L.p2HdrH / 2 + 1.5, { align: 'center' });
      _text(lbl, bx + L.p2ItmW + L.p2ContW / 2, yTop + L.p2HdrH / 2 + 1.5, { align: 'center' });
    });
    return yTop + L.p2HdrH;
  }

  function _calcularAlturaFila() { return L.p2RowH; }

  function _dibujarFilaPaso(paso, yTop, contenidos) {
    [L.p2B1X, L.p2B2X, L.p2B3X].forEach((bx, bi) => {
      _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
      _doc.rect(bx, yTop, L.p2BW, L.p2RowH, 'S');
      _doc.line(bx + L.p2ItmW, yTop, bx + L.p2ItmW, yTop + L.p2RowH);
      _setFontNarrow('bold',   L.szTblItem, L.cText);
      _text(String(paso.numero), bx + L.p2ItmW / 2, yTop + L.p2RowH / 2 + 1.5, { align: 'center' });
      _setFontNarrow('normal', L.szTblCont, L.cText);
      const lines = _doc.splitTextToSize(contenidos[bi], L.p2ContW - L.padL * 2);
      lines.slice(0, 3).forEach((ln, li) =>
        _text(ln, bx + L.p2ItmW + L.padL, yTop + 4.5 + li * 4.5));
    });
    return yTop + L.p2RowH;
  }

  // ── Orquestador Página 1 ──────────────────────────────────────

  function _generarPagina1(state, logoData) {
    _doc.setPage(1);
    const xC2 = L.p1C2X, xC3 = L.p1C3X;
    _dibujarEncabezado(logoData);
    const yInfo  = L.mt + L.hdrH + 2.0;
    const yResp  = _dibujarInfoGeneral(state.general || {}, yInfo);
    const yUbic  = _dibujarResponsables(state.responsables || [], yResp) + L.tblGap;
    const ySenal = _dibujarUbicacion(
      state.puntoEncuentro || '', state.duchaLavaojos || '', yUbic) + L.tblGap;
    _dibujarSenales(state.senalesParada || {}, ySenal);
    _dibujarCatalogoPeligros(xC2, L.mt);
    _dibujarGuiaControles(xC3, L.mt);
    _dibujarFooter(1);
  }

  // ── Orquestador Páginas 2+ ────────────────────────────────────

  function _generarPaginasPasos(pasos) {
    _doc.addPage(); const curPage = 2;
    let curY = L.mt;
    curY = _dibujarHeaderTabla(curY);
    const totalH = L.p2HdrH + L.p2Rows * L.p2RowH;
    [L.p2B1X, L.p2B2X, L.p2B3X].forEach(bx => {
      _doc.setLineWidth(L.lwExt); _doc.setDrawColor(...L.cBorder);
      _doc.rect(bx, L.mt, L.p2BW, totalH, 'S');
    });
    for (let i = 0; i < L.p2Rows; i++) {
      if (i < pasos.length) {
        const p = pasos[i];
        const contenidos = [
          p.descripcion || '',
          (p.peligros || []).join(', '),
          (p.controles || []).join(', '),
        ];
        curY = _dibujarFilaPaso(p, curY, contenidos);
      } else {
        [L.p2B1X, L.p2B2X, L.p2B3X].forEach(bx => {
          _doc.setLineWidth(L.lwInt); _doc.setDrawColor(...L.cBorder);
          _doc.rect(bx, curY, L.p2BW, L.p2RowH, 'S');
          _doc.line(bx + L.p2ItmW, curY, bx + L.p2ItmW, curY + L.p2RowH);
        });
        curY += L.p2RowH;
      }
    }
    _dibujarFooter(curPage);
    return curPage;
  }

  // ── Actualización de totales  // ── Actualización de totales en footer (second-pass) ─────
  // ── Actualización de totales en footer (second-pass) ─────
  // ── Actualización de totales en footer (second-pass) ─────
  // ── Actualización de totales en footer (second-pass) ─────

  function _actualizarTotalPaginas(totalPages) {
    for (let p = 1; p <= totalPages; p++) {
      _doc.setPage(p);
      const x = _x0() + L.aw - 20;
      const y = L.footerY - 1;
      _doc.setFillColor(...L.cWhite);
      _doc.rect(x, y, 22, 5, 'F');
      _setFontNarrow('normal', L.szFooterPag, L.cFooter);
      const pageNum = _doc.internal.getCurrentPageInfo().pageNumber;
      _text(`${pageNum}/${totalPages}`, _x0() + L.aw, L.footerY + 2, { align: 'right' });
    }
  }

  // ── Carga del logo ───────────────────────────────────────

  async function _cargarFuentes() {
    // Carga Arial Narrow (Regular + Bold) extraída del DOCX maestro
    // Fuente oficial del formato corporativo FM-HSE-022
    const fuentes = [
      { file: 'arial-narrow.b64.txt',      name: 'ArialNarrow', style: 'normal' },
      { file: 'arial-narrow-bold.b64.txt', name: 'ArialNarrow', style: 'bold'   },
    ];
    for (const { file, name, style } of fuentes) {
      try {
        const resp = await fetch(`./assets/${file}`);
        if (!resp.ok) continue;
        const b64 = (await resp.text()).trim();
        if (!b64 || b64.length < 100) continue;
        // Registrar en jsPDF
        const ttfName = file.replace('.b64.txt', '.ttf');
        _doc.addFileToVFS(ttfName, b64);
        _doc.addFont(ttfName, name, style);
      } catch(e) { /* fuente no disponible — usar Helvetica como fallback */ }
    }
  }

  async function _cargarLogo() {
    // Prioridad declarada (AJ-04):
    //   1. assets/logo.png  (imagen original — se convierte a base64 en tiempo de ejecución)
    //   2. assets/logo.b64.txt  (base64 pre-generado)
    //   3. null  (modo degradado — encabezado sin logo)

    // ── Prioridad 1: assets/logo.png ─────────────────────
    try {
      const respPng = await fetch('./assets/logo.png');
      if (respPng.ok) {
        const blob    = await respPng.blob();
        const mimeOk  = blob.type === 'image/png' || blob.type === 'image/jpeg'
                     || blob.type === 'image/jpg'  || blob.type === 'application/octet-stream';
        if (mimeOk || blob.size > 0) {
          // Convertir a data URI detectando el tipo real por los magic bytes
          const buf    = await blob.arrayBuffer();
          const bytes  = new Uint8Array(buf);
          const mime   = (bytes[0] === 0xFF && bytes[1] === 0xD8)
            ? 'image/jpeg'
            : 'image/png';
          const b64    = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
          const dataURI = `data:${mime};base64,${b64}`;
          return { uri: dataURI, mime: mime === 'image/jpeg' ? 'JPEG' : 'PNG' };
        }
      }
    } catch { /* logo.png no disponible — continuar */ }

    // ── Prioridad 2: assets/logo.b64.txt ─────────────────
    try {
      const respB64 = await fetch('./assets/logo.b64.txt');
      if (respB64.ok) {
        const txt = (await respB64.text()).trim();
        if (txt.startsWith('data:image') && !txt.startsWith('REEMPLAZAR')) {
          const mime = txt.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
          return { uri: txt, mime };
        }
      }
    } catch { /* logo.b64.txt no disponible */ }

    // ── Prioridad 3: sin logo ─────────────────────────────
    return null;
  }

  // ── API pública: generar PDF + modal de vista previa ─────

  async function generarPDF() {
    // 1. Leer state completo (una sola vez)
    const state = State.get();
    if (!state) { Utils.toast('Error al leer el formulario.', 'danger'); return; }

    // 2. Verificar aprobación (guard — no debería llegar aquí sin aprobación)
    if (state.aprobacion?.estado !== 'aprobado') {
      Utils.toast('El formulario debe estar aprobado por el supervisor HSE.', 'warning');
      return;
    }

    // 3. Capturar timestamp de generación
    _genTimestamp = new Date().toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    // 4. Cargar logo y fuentes en paralelo
    const [ logoData ] = await Promise.all([
      _cargarLogo(),
    ]);

    // 5. Crear documento jsPDF
    const { jsPDF } = window.jspdf;
    _doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'landscape' });

    // 5b. Cargar Arial Narrow (fuente oficial del DOCX maestro)
    await _cargarFuentes();
    // Verificar si Arial Narrow quedó registrada
    try {
      const fontList = _doc.getFontList();
      _arialNarrowLoaded = 'ArialNarrow' in fontList;
    } catch(e) { _arialNarrowLoaded = false; } // R-01: Letter Landscape

    // 6. Página 1
    _generarPagina1(state, logoData);

    // 7. Páginas 2+
    const lastPage = _generarPaginasPasos(state.pasos || [], logoData);

    // 8. Second-pass: actualizar total de páginas en footers
    const totalPages = _doc.internal.getNumberOfPages();
    _actualizarTotalPaginas(totalPages);

    // 9. Generar Blob y abrir vista previa (SF-19)
    const blob    = _doc.output('blob');
    const nombre  = (state.identificacion?.nombreArchivo || 'FM-HSE-022') + '.pdf';
    _blobURL = URL.createObjectURL(blob);

    _mostrarVistaPrevia(blob, nombre);
  }

  // ── Modal de vista previa (SF-19) ────────────────────────

  function _mostrarVistaPrevia(blob, nombre) {
    const overlay   = Utils.$el('modal-preview');
    const iframe    = Utils.$el('pdf-preview-frame');
    const fallback  = Utils.$el('pdf-preview-fallback');
    const fileLabel = Utils.$el('modal-preview-filename');

    if (!overlay) return;

    if (fileLabel) fileLabel.textContent = nombre;

    // Detectar móvil para mostrar fallback
    if (Utils.esMobil()) {
      iframe?.classList.add('hidden');
      fallback?.classList.remove('hidden');
      Utils.$el('btn-open-pdf-tab')?.addEventListener('click', () => {
        window.open(_blobURL, '_blank');
      }, { once: true });
    } else {
      if (iframe) iframe.src = _blobURL;
      iframe?.classList.remove('hidden');
      fallback?.classList.add('hidden');
    }

    overlay.classList.remove('hidden');

    // Botones del modal
    const btnClose   = Utils.$el('btn-preview-close');
    const btnCancel  = Utils.$el('btn-preview-cancel');
    const btnConfirm = Utils.$el('btn-preview-confirm');

    const cerrar = () => {
      overlay.classList.add('hidden');
      if (iframe) iframe.src = '';
      if (_blobURL) { URL.revokeObjectURL(_blobURL); _blobURL = null; }
    };

    const descargar = () => {
      const state = State.get();
      const n = (state?.identificacion?.nombreArchivo || 'FM-HSE-022') + '.pdf';
      _doc.save(n);
      cerrar();
      Utils.toast(`PDF generado: ${n}`, 'success', 4000);
    };

    btnClose?.addEventListener('click', cerrar, { once: true });
    btnCancel?.addEventListener('click', cerrar, { once: true });
    btnConfirm?.addEventListener('click', descargar, { once: true });

    // Cerrar al hacer clic en overlay
    overlay.addEventListener('click', e => {
      if (e.target === overlay) cerrar();
    }, { once: true });
  }

  return { generarPDF };
})();


/* ───────────────────────────────────────────────────────────────
   ADMIN CONFIG — Panel de Configuración de Bases de Datos
──────────────────────────────────────────────────────────────── */
const UIAdminConfig = (() => {
  const PASSWORD_CORRECT = 'AdminHSE2026';
  let _tempResponsables = [];

  function init() {
    const trigger = document.getElementById('btn-admin-trigger');
    if (!trigger) return;

    trigger.addEventListener('click', () => {
      document.getElementById('inp-admin-password').value = '';
      document.getElementById('lbl-admin-auth-error').classList.add('hidden');
      document.getElementById('modal-admin-auth').classList.remove('hidden');
    });

    document.getElementById('btn-admin-auth-cancel')?.addEventListener('click', () => {
      document.getElementById('modal-admin-auth').classList.add('hidden');
    });

    document.getElementById('btn-admin-auth-submit')?.addEventListener('click', () => {
      const pwd = document.getElementById('inp-admin-password').value;
      if (pwd === PASSWORD_CORRECT) {
        document.getElementById('modal-admin-auth').classList.add('hidden');
        document.getElementById('modal-admin-config').classList.remove('hidden');
        _cargarBasesDeDatos();
      } else {
        document.getElementById('lbl-admin-auth-error').classList.remove('hidden');
      }
    });

    document.getElementById('inp-admin-password')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        document.getElementById('btn-admin-auth-submit')?.click();
      }
    });

    const btnClose = document.getElementById('btn-admin-config-close');
    const btnCancel = document.getElementById('btn-admin-config-cancel');
    const btnSave = document.getElementById('btn-admin-config-save');

    const cerrarConfig = () => {
      document.getElementById('modal-admin-config').classList.add('hidden');
    };

    btnClose?.addEventListener('click', cerrarConfig);
    btnCancel?.addEventListener('click', cerrarConfig);
    btnSave?.addEventListener('click', _guardarCambios);

    document.getElementById('btn-admin-add-encuentro')?.addEventListener('click', () => {
      _agregarInputUbicacion('admin-list-encuentro', 'inp-encuentro-item', 'btn-delete-encuentro', '');
    });

    document.getElementById('btn-admin-add-ducha')?.addEventListener('click', () => {
      _agregarInputUbicacion('admin-list-duchas', 'inp-ducha-item', 'btn-delete-ducha', '');
    });

    document.getElementById('admin-list-encuentro')?.addEventListener('click', e => {
      const btn = e.target.closest('.btn-delete-encuentro');
      if (btn) btn.closest('.flex').remove();
    });

    document.getElementById('admin-list-duchas')?.addEventListener('click', e => {
      const btn = e.target.closest('.btn-delete-ducha');
      if (btn) btn.closest('.flex').remove();
    });

    document.getElementById('btn-admin-add-responsable')?.addEventListener('click', () => {
      const nombreInp = document.getElementById('admin-resp-nombre');
      const apellidoInp = document.getElementById('admin-resp-apellido');
      const cedulaInp = document.getElementById('admin-resp-cedula');
      const areaSelect = document.getElementById('admin-resp-area');

      const nombre = nombreInp.value.trim();
      const apellido = apellidoInp.value.trim();
      const cedula = cedulaInp.value.trim();
      const area = areaSelect.value;

      if (!nombre || !apellido || !cedula || !area) {
        alert('Por favor complete todos los campos del responsable.');
        return;
      }

      if (_tempResponsables.some(r => r.cedula === cedula)) {
        alert('Ya existe un responsable registrado con esta cédula.');
        return;
      }

      _tempResponsables.push({ nombre, apellido, cedula, area });
      
      nombreInp.value = '';
      apellidoInp.value = '';
      cedulaInp.value = '';
      
      _renderResponsablesTable();
    });

    document.getElementById('admin-table-responsables')?.addEventListener('click', e => {
      const btn = e.target.closest('.btn-admin-delete-resp');
      if (btn) {
        const ced = btn.dataset.cedula;
        _tempResponsables = _tempResponsables.filter(r => r.cedula !== ced);
        _renderResponsablesTable();
      }
    });

    document.getElementById('admin-resp-search')?.addEventListener('input', e => {
      _renderResponsablesTable(e.target.value);
    });
  }

  function _agregarInputUbicacion(containerId, inpClass, btnClass, valor) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'flex items-center gap-1.5';
    div.innerHTML = `
      <input type="text" class="w-full bg-white border border-slate-200 rounded-lg py-1 px-2.5 text-xs text-[#171c1f] focus:ring-1 focus:ring-primary focus:border-primary ${inpClass}" value="${Utils.escaparHtml(valor)}">
      <button type="button" class="text-red-500 hover:bg-red-50 p-1 rounded-full transition-colors ${btnClass}">
        <span class="material-symbols-outlined text-[16px]">delete</span>
      </button>
    `;
    container.appendChild(div);
  }

  async function _cargarBasesDeDatos() {
    const encuentros = Config.get('puntosEncuentro') || [];
    const duchas = Config.get('duchasLavaojos') || [];

    const encCont = document.getElementById('admin-list-encuentro');
    const duchCont = document.getElementById('admin-list-duchas');
    if (encCont) encCont.innerHTML = '';
    if (duchCont) duchCont.innerHTML = '';

    encuentros.forEach(val => _agregarInputUbicacion('admin-list-encuentro', 'inp-encuentro-item', 'btn-delete-encuentro', val));
    duchas.forEach(val => _agregarInputUbicacion('admin-list-duchas', 'inp-ducha-item', 'btn-delete-ducha', val));

    const areaSelect = document.getElementById('admin-resp-area');
    if (areaSelect) {
      const areas = Config.get('areasEjecutoras') || [];
      areaSelect.innerHTML = areas.map(a => `<option value="${Utils.escaparHtml(a.codigo)}">${Utils.escaparHtml(a.descripcion)}</option>`).join('');
    }

    _tempResponsables = Utils.clonar(Config.getResponsables() || []);
    _renderResponsablesTable();
  }

  function _renderResponsablesTable(filtro = '') {
    const tbody = document.getElementById('admin-table-responsables');
    if (!tbody) return;

    const query = filtro.trim().toLowerCase();
    const filtrados = _tempResponsables.filter(r => {
      if (!query) return true;
      return (r.nombre || '').toLowerCase().includes(query) ||
             (r.apellido || '').toLowerCase().includes(query) ||
             (r.cedula || '').toLowerCase().includes(query);
    });

    if (!filtrados.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-[#43474f] italic">No se encontraron responsables.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtrados.map(r => {
      const nombreCompleto = `${r.nombre} ${r.apellido}`;
      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="p-2.5 font-semibold text-[#171c1f]">${Utils.escaparHtml(nombreCompleto)}</td>
          <td class="p-2.5 text-slate-600">${Utils.escaparHtml(r.cedula)}</td>
          <td class="p-2.5"><span class="bg-blue-50 text-primary text-[10px] px-2 py-0.5 rounded font-bold">${Utils.escaparHtml(r.area)}</span></td>
          <td class="p-2.5 text-center">
            <button type="button" class="text-red-500 hover:bg-red-50 p-1 rounded-full transition-colors btn-admin-delete-resp" data-cedula="${Utils.escaparHtml(r.cedula)}">
              <span class="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function _guardarCambios() {
    try {
      const encInputs = document.querySelectorAll('.inp-encuentro-item');
      const nuevosEncuentros = Array.from(encInputs).map(inp => inp.value.trim()).filter(Boolean);

      const duchInputs = document.querySelectorAll('.inp-ducha-item');
      const nuevasDuchas = Array.from(duchInputs).map(inp => inp.value.trim()).filter(Boolean);

      if (!nuevosEncuentros.length || !nuevasDuchas.length) {
        alert('Debe tener al menos un Punto de Encuentro y una Ducha y Lavaojos.');
        return;
      }

      let configObj;
      const localConfig = localStorage.getItem('fmhse022_config_configuracion');
      if (localConfig) {
        configObj = JSON.parse(localConfig);
      } else {
        configObj = await fetch('./config/configuracion.json').then(r => r.json());
      }
      
      configObj.puntosEncuentro = nuevosEncuentros;
      configObj.duchasLavaojos = nuevasDuchas;

      Config.guardarOverride('configuracion', configObj);
      localStorage.setItem('fmhse022_config_responsables', JSON.stringify(_tempResponsables));

      try {
        const respConf = await fetch('./api/save-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configObj)
        });
        if (respConf.ok) {
          console.info('[Admin] Archivo configuracion.json guardado físicamente en disco.');
        }

        const respResp = await fetch('./api/save-responsables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(_tempResponsables)
        });
        if (respResp.ok) {
          console.info('[Admin] Archivo responsables.json guardado físicamente en disco.');
        }
      } catch (errServer) {
        console.info('[Admin] Ejecutando fuera de servidor local. Cambios guardados en LocalStorage.', errServer);
      }

      await Config.cargarTodo();
      App.renderTodo();

      Utils.toast('Bases de datos actualizadas con éxito.', 'success');
      document.getElementById('modal-admin-config').classList.add('hidden');
    } catch (e) {
      console.error('[Admin] Error al guardar cambios:', e);
      alert('Ocurrió un error al guardar las configuraciones: ' + e.message);
    }
  }

  return { init };
})();


/* ───────────────────────────────────────────────────────────────
   APP — Orquestador principal
──────────────────────────────────────────────────────────────── */
const App = (() => {

  let _autosaveTimer = null;

  // ── Autosave ───────────────────────────────────────────────

  function _iniciarAutosave() {
    const cfg      = Config.get('ui') || {};
    const intervalo = cfg.autosaveIntervaloMs || 5000;

    State.on('change', () => {
      clearTimeout(_autosaveTimer);
      _autosaveTimer = setTimeout(() => {
        State.guardarBorrador();
      }, intervalo);
    });
  }

  // ── Banner de borrador ─────────────────────────────────────

  function _gestionarBanner() {
    if (!State.tieneBorrador()) return;

    const borrador = State.leerBorrador();
    const banner   = Utils.$el('draft-banner');
    const texto    = Utils.$el('draft-banner-text');
    if (!banner || !borrador) return;

    // Mostrar info del borrador
    const modificado = borrador._meta?.modificadoEn
      ? Utils.formatearFechaHora(borrador._meta.modificadoEn)
      : 'fecha desconocida';
    const tarea = borrador.general?.tarea
      ? `"${borrador.general.tarea.substring(0, 40)}${borrador.general.tarea.length > 40 ? '…' : ''}"`
      : 'formulario sin título';

    texto.textContent = `Borrador guardado el ${modificado}: ${tarea}`;
    banner.classList.remove('hidden');

    Utils.$el('btn-restore-draft')?.addEventListener('click', () => {
      State.reemplazar(borrador);
      banner.classList.add('hidden');
      Utils.toast('Formulario restaurado correctamente.', 'success');
      App.renderTodo();
    });

    Utils.$el('btn-discard-draft')?.addEventListener('click', async () => {
      const ok = await Modal.confirmar(
        'Descartar borrador',
        '¿Eliminar el borrador guardado? Esta acción no se puede deshacer.',
        { labelOk: 'Descartar', peligroso: true }
      );
      if (ok) {
        State.descartarBorrador();
        banner.classList.add('hidden');
        Utils.toast('Borrador descartado.', 'info');
      }
    });
  }

  // ── Nuevo formulario ───────────────────────────────────────

  function _bindNuevoFormulario() {
    Utils.$el('btn-new-form')?.addEventListener('click', async () => {
      const ok = await Modal.confirmar(
        'Nuevo formulario',
        '¿Iniciar un formulario nuevo? Se perderán todos los datos actuales no guardados.',
        { labelOk: 'Nuevo formulario', peligroso: true }
      );
      if (!ok) return;
      State.resetear();
      State.descartarBorrador();
      App.renderTodo();
      Utils.$el('draft-banner')?.classList.add('hidden');
      Utils.toast('Formulario reiniciado.', 'info');
      // Hacer scroll al tope
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Exportación / Importación ──────────────────────────────

  function _bindBackup() {
    Utils.$el('btn-export-backup')?.addEventListener('click', () => {
      Backup.exportar();
    });

    Utils.$el('btn-import-backup')?.addEventListener('click', () => {
      Utils.$el('input-import-file')?.click();
    });

    Utils.$el('input-import-file')?.addEventListener('change', async e => {
      const archivo = e.target.files?.[0];
      if (archivo) {
        await Backup.importar(archivo);
        // Limpiar el input para permitir re-importar el mismo archivo
        e.target.value = '';
        // Re-render completo después de importar
        App.renderTodo();
      }
    });
  }

  // ── Render global ──────────────────────────────────────────

  function renderTodo() {
    UIGeneral.render();
    UIResponsables.render();
    UIUbicacion.render();
    UISenales.render();
    UITiposTrabajo.render();
    UIPasos.render();
    UIResumen.render();
    UIAprobacion.render();
    UIDocId.render();
  }

  // ── Mostrar formulario tras carga ──────────────────────────

  function _mostrarFormulario() {
    Utils.$el('loading-screen')?.classList.add('hidden');
    Utils.$el('form-hse')?.removeAttribute('hidden');
  }

  // ── Inicialización ─────────────────────────────────────────

  async function init() {
    try {
      // 1. Cargar configuración JSON
      await Config.cargarTodo();

      // 2. Inicializar modal de confirmación
      Modal._bindOnce();

      // 3. Verificar y gestionar borrador guardado
      _gestionarBanner();

      // 4. Renderizar todas las secciones activas
      renderTodo();

      // 5. Mostrar el formulario
      _mostrarFormulario();

      // 6. Iniciar autosave
      _iniciarAutosave();

      // 7. Bind de controles globales
      _bindNuevoFormulario();
      _bindBackup();
      _bindPDF();
      UITheme.init();
      UIHeaderMenu.init();
      UIAdminConfig.init();
      Wizard.init();

      // 8. Observer post-aprobación y estado inicial del botón PDF
      _iniciarObserverPostAprobacion();
      actualizarBtnPDF();

      console.info('[App] FM-HSE-022 iniciada correctamente.');

    } catch (err) {
      console.error('[App] Error durante la inicialización:', err);
      _mostrarErrorCarga(err.message);
    }
  }

  function _mostrarErrorCarga(mensaje) {
    const screen = Utils.$el('loading-screen');
    if (!screen) return;
    screen.innerHTML = `
      <div style="text-align:center;padding:2rem;max-width:400px;">
        <svg style="width:48px;height:48px;color:#e74c3c;margin-bottom:1rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style="color:#e8edf2;font-weight:600;margin-bottom:0.5rem;">Error al cargar la configuración</p>
        <p style="color:#8da3b8;font-size:0.875rem;margin-bottom:1.5rem;">${Utils.escaparHtml(mensaje)}</p>
        <p style="color:#5a7a96;font-size:0.8rem;">
          Asegúrese de servir la aplicación desde un servidor HTTP.<br>
          Ejemplo: <code style="color:#f5c518;">python -m http.server 8080</code>
        </p>
      </div>`;
  }

  // ── Bind del botón Generar PDF ───────────────────────────
  function _bindPDF() {
    const btnPDF     = Utils.$el('btn-generate-pdf');
    const btnPrint   = Utils.$el('btn-print-fallback');

    btnPDF?.addEventListener('click', () => {
      Print.generarPDF();
    });

    btnPrint?.addEventListener('click', () => {
      window.print();
    });
  }

  // ── Habilitación del botón PDF ────────────────────────────
  function actualizarBtnPDF() {
    const btn = Utils.$el('btn-generate-pdf');
    if (!btn) return;
    const habilitado = UIAprobacion.validar() && UIDocId.validar();
    btn.disabled = !habilitado;
    btn.setAttribute('aria-disabled', String(!habilitado));
  }

  // ── Observer de cambios post-aprobación ───────────────────
  // Si el formulario cambia después de una aprobación, se resetea.
  // Se registra una sola vez en init().
  function _iniciarObserverPostAprobacion() {
    State.on('update', ({ clave }) => {
      if (!clave) return;
      UIAprobacion.resetearSiAprobado(clave);
      actualizarBtnPDF();
    });
  }

  return { init, renderTodo, actualizarBtnPDF };
})();


/* ───────────────────────────────────────────────────────────────
   PUNTO DE ENTRADA
──────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => App.init());
