import React, { useState, useEffect } from 'react';
export default function App() {
  // Forzar el cambio de título directamente en el navegador de forma agresiva
  useEffect(() => {
    const cambiarTitulo = () => {
      document.title = "Sistema de Cancelaciones";
    };
    cambiarTitulo();
    // Lo refuerza por si algún componente secundario lo pisa
    setTimeout(cambiarTitulo, 500);
  }, []);
}

import axios from 'axios';
import { 
  Upload, FileText, Download, CheckCircle, AlertCircle, History, 
  Search, FileArchive, FolderPlus, Lock, Unlock, 
  LogOut, User, Loader2, ChevronDown, ChevronUp, Users, Settings, 
  Plus, Trash2, Edit, Save, FileCode, Check, Calendar, Clock, DollarSign,
  Sun, Moon, ArrowUpDown, Filter
} from 'lucide-react';

// Configuración producción / Railway
axios.defaults.withCredentials = true;

const api = axios.create({
  baseURL: 'https://sistema-cancelaciones-production.up.railway.app/api'
});

export default function App() {
  // --- TEMA (CLARO / OSCURO) ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // --- ESTADO DE SESIÓN Y USUARIO ACTIVO ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const [loginUser, setLoginUser] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // --- NAVEGACIÓN ---
  const [activeTab, setActiveTab] = useState('single');
  
  // Mapa de desbloqueo: clave única `key` -> boolean
  const [unlockedFields, setUnlockedFields] = useState({});

  // ESTADOS - Caso Individual
  const [singleFiles, setSingleFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progressSingle, setProgressSingle] = useState(0);
  const [expedienteId, setExpedienteId] = useState('');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  // ESTADOS - Carga Masiva
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [progressBatch, setProgressBatch] = useState(0);
  const [batchResults, setBatchResults] = useState([]);
  const [openAccordion, setOpenAccordion] = useState({});

  // ESTADOS - Historial & Filtros Dinámicos
  const [historial, setHistorial] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all', 'day', 'week', 'month', 'year'
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0 - 11
  const [selectedWeek, setSelectedWeek] = useState('all'); // 'all', 1, 2, 3, 4, 5
  const [selectedDay, setSelectedDay] = useState('all'); // 'all', 1 .. 31
  const [sortAscending, setSortAscending] = useState(true);

  // ESTADOS - Panel de Administración
  const [usuariosLista, setUsuariosLista] = useState([]);
  const [nuevoUsuario, setNuevoUsuario] = useState({ username: '', password: '', role: 'operador', es_admin: false });
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  // ESTADOS - Plantillas
  const [plantillas, setPlantillas] = useState([]);
  const [archivoPlantilla, setArchivoPlantilla] = useState(null);

  useEffect(() => {
    verificarSesion();
  }, []);

  const verificarSesion = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.user) {
        setCurrentUser(res.data.user);
        setIsAuthenticated(true);
      }
    } catch {
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const res = await api.post('/auth/login', {
        username: loginUser.trim(),
        password: loginPassword
      });

      if (res.data?.status === 'ok') {
        setCurrentUser(res.data.user);
        setIsAuthenticated(true);
        setLoginPassword('');
        setSingleFiles([]);
        setDatos(null);
        setBatchResults([]);
      }
    } catch (err) {
      setLoginError(err.response?.data?.detail || 'Error al iniciar sesión.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleConfirmLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setShowLogoutModal(false);
      setLoginUser('');
      setLoginPassword('');
      setDatos(null);
      setBatchResults([]);
      setHistorial([]);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'history') cargarHistorialUsuario();
      if (activeTab === 'users' && (currentUser?.es_admin || currentUser?.role === 'admin')) cargarUsuarios();
      if (activeTab === 'templates' && (currentUser?.es_admin || currentUser?.role === 'admin')) cargarPlantillas();
    }
  }, [activeTab, isAuthenticated, currentUser]);

  const cargarHistorialUsuario = async () => {
    try {
      const res = await api.get('/expedientes', {
        params: { usuario: currentUser.username }
      });
      setHistorial(res.data || []);
    } catch (err) {
      console.error('Error al cargar historial:', err);
    }
  };

  const cargarUsuarios = async () => {
    setLoadingUsuarios(true);
    try {
      const res = await api.get('/admin/usuarios');
      setUsuariosLista(res.data || []);
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const cargarPlantillas = async () => {
    try {
      const res = await api.get('/admin/plantilla');
      setPlantillas(res.data || []);
    } catch (err) {
      console.error('Error al cargar plantillas:', err);
    }
  };

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('username', nuevoUsuario.username);
      formData.append('password', nuevoUsuario.password);
      formData.append('es_admin', nuevoUsuario.es_admin);

      await api.post('/admin/usuarios', formData);
      setNuevoUsuario({ username: '', password: '', role: 'operador', es_admin: false });
      cargarUsuarios();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al crear usuario.');
    }
  };

  const handleEliminarUsuario = async (param1, param2) => {
  // Evitar conflictos si React envía el evento como primer argumento
  if (param1 && param1.preventDefault) {
    param1.preventDefault();
  }

  // Asegurar obtener el ID correcto sin importar el orden de parámetros
  const usuarioId = typeof param1 === 'string' ? param1 : param2;

  if (!usuarioId || typeof usuarioId !== 'string') {
    alert('ID de usuario no válido');
    return;
  }

  if (!window.confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
    return;
  }

  // Obtener token guardado en la sesión
  const token = localStorage.getItem('token');

  if (!token) {
    alert('Sesión no válida o expirada. Por favor, vuelve a iniciar sesión.');
    return;
  }

  try {
    const response = await fetch(
      `https://sistema-cancelaciones-production.up.railway.app/api/admin/usuarios/${usuarioId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (response.status === 401) {
      alert('Sesión no válida o expirada. Por favor, inicia sesión nuevamente.');
      // Opcional: redirigir a login o cerrar sesión
      return;
    }

    if (!response.ok) {
      alert(data.detail || 'Error al eliminar usuario');
      return;
    }

    alert('Usuario eliminado correctamente');
    
    // Si tienes una función para recargar la lista de usuarios, llámala aquí:
    if (typeof fetchUsuarios === 'function') {
      fetchUsuarios();
    }
  } catch (error) {
    console.error('Error al borrar usuario:', error);
    alert('Error de conexión al eliminar usuario');
  }
};

  const handleSubirPlantilla = async (e) => {
    e.preventDefault();
    if (!archivoPlantilla) return;

    const formData = new FormData();
    formData.append('file', archivoPlantilla);

    try {
      await api.post('/admin/plantilla', formData);
      setArchivoPlantilla(null);
      cargarPlantillas();
      alert('Plantilla subida correctamente.');
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al subir la plantilla.');
    }
  };

  // --- TOGGLE DIRECTO DEL CANDADO SIN CONTRASEÑA ---
  const handleToggleUnlock = (fieldKey) => {
    setUnlockedFields((prev) => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  };

  const toggleAccordion = (index) => {
    setOpenAccordion((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const scanFilesFromEntry = async (entry) => {
    let pdfFiles = [];
    if (entry.isFile) {
      if (entry.name.toLowerCase().endsWith('.pdf')) {
        const file = await new Promise((resolve) => entry.file(resolve));
        pdfFiles.push(file);
      }
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries = await new Promise((resolve) => dirReader.readEntries(resolve));
      for (const childEntry of entries) {
        const childFiles = await scanFilesFromEntry(childEntry);
        pdfFiles = pdfFiles.concat(childFiles);
      }
    }
    return pdfFiles;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDropSingle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
      if (files.length > 0) {
        setSingleFiles(files);
        setDatos(null);
      }
    }
  };

  const handleDropBatch = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    let allPdfFiles = [];
    const items = e.dataTransfer.items;

    if (items && items.length > 0) {
      const promises = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
        if (entry) promises.push(scanFilesFromEntry(entry));
      }
      if (promises.length > 0) {
        const results = await Promise.all(promises);
        allPdfFiles = results.flat();
      }
    }

    if (allPdfFiles.length === 0 && e.dataTransfer.files) {
      allPdfFiles = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    }

    if (allPdfFiles.length > 0) {
      setBatchFiles(allPdfFiles);
      setBatchResults([]);
      setError('');
    } else {
      setError('No se encontraron archivos PDF.');
    }
  };

  const handleSingleFileChange = (e) => {
    if (e.target.files) {
      setSingleFiles(Array.from(e.target.files));
      setDatos(null);
    }
  };

  const handleBatchFileChange = (e) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
      setBatchFiles(selectedFiles);
      setBatchResults([]);
    }
  };

  const handleUploadSingle = async () => {
    if (singleFiles.length === 0) return;
    setLoading(true);
    setProgressSingle(10);
    setError('');

    const interval = setInterval(() => {
      setProgressSingle((prev) => (prev < 90 ? prev + 15 : prev));
    }, 200);

    const formData = new FormData();
    singleFiles.forEach((f) => formData.append('files', f));
    formData.append('usuario_propietario', currentUser.username);

    try {
      const res = await api.post('/expedientes/procesar', formData);
      clearInterval(interval);
      setProgressSingle(100);
      setTimeout(() => {
        setExpedienteId(res.data.expediente_id);
        const rawDatos = res.data.datos_extraidos || {};
        setDatos({
          acreditado: rawDatos.acreditado || rawDatos.nombre_acreditado || '',
          monto: rawDatos.monto || rawDatos.monto_credito || '',
          numero_credito: rawDatos.numero_credito || '',
          ...rawDatos
        });
        setUnlockedFields({});
        setLoading(false);
      }, 400);
    } catch (err) {
      clearInterval(interval);
      setError(err.response?.data?.detail || 'Error al procesar los archivos.');
      setLoading(false);
    }
  };

  const handleUploadBatch = async () => {
    if (batchFiles.length === 0) return;
    setBatchLoading(true);
    setProgressBatch(5);
    setError('');

    const interval = setInterval(() => {
      setProgressBatch((prev) => (prev < 90 ? prev + 10 : prev));
    }, 300);

    const formData = new FormData();
    batchFiles.forEach((f) => formData.append('files', f));
    formData.append('usuario_propietario', currentUser.username);

    try {
      const res = await api.post('/expedientes/procesar-masivo', formData);
      clearInterval(interval);
      setProgressBatch(100);
      setTimeout(() => {
        const detallesNormalizados = (res.data.detalles || []).map((item) => {
          const raw = item.datos_extraidos || {};
          return {
            ...item,
            datos_extraidos: {
              acreditado: raw.acreditado || raw.nombre_acreditado || '',
              monto: raw.monto || raw.monto_credito || '',
              numero_credito: raw.numero_credito || '',
              ...raw
            }
          };
        });

        setBatchResults(detallesNormalizados);
        if (detallesNormalizados.length > 0) {
          setOpenAccordion({ 0: true });
        }
        setUnlockedFields({});
        setBatchLoading(false);
      }, 500);
    } catch (err) {
      clearInterval(interval);
      setError(err.response?.data?.detail || 'Error al procesar el lote.');
      setBatchLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setDatos((prev) => ({ ...prev, [field]: value }));
  };

  const handleBatchInputChange = (index, field, value) => {
    setBatchResults((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        datos_extraidos: {
          ...updated[index].datos_extraidos,
          [field]: value
        }
      };
      return updated;
    });
  };

  const handleDownloadWord = async (id, datosActuales) => {
    try {
      const response = await api.post(
        `/expedientes/${id}/generar-word`,
        datosActuales || {},
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Cancelacion_${datosActuales?.numero_credito || 'expediente'}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Error al descargar el archivo Word.');
    }
  };

  const handleDownloadZip = async () => {
    const ids = batchResults.map((r) => r.expediente_id);
    try {
      const res = await api.post('/expedientes/descargar-zip', ids, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Cancelaciones_Lote.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Error al descargar el archivo ZIP.');
    }
  };

  const formatLabel = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  const esAdmin = currentUser?.es_admin || currentUser?.role === 'admin';

  // --- CÁLCULOS DINÁMICOS DE FECHAS, SEMANAS Y DÍAS DEL MES ---
  const getWeekOfMonth = (date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    return Math.ceil((date.getDate() + firstDay.getDay()) / 7);
  };

  const daysInSelectedMonth = new Date(Number(selectedYear), Number(selectedMonth) + 1, 0).getDate();

  const mesesNombres = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const filteredHistorial = historial
    .filter((item) => {
      const query = searchQuery.toLowerCase();
      const acreditado = (item.datos_extraidos?.acreditado || item.datos_extraidos?.nombre_acreditado || '').toLowerCase();
      const numCredito = (item.datos_extraidos?.numero_credito || item.numero_credito || '').toLowerCase();
      const matchesQuery = acreditado.includes(query) || numCredito.includes(query);

      const itemDate = new Date(item.created_at || item.fecha || Date.now());
      const isSelectedYearMonth = itemDate.getFullYear() === Number(selectedYear) && itemDate.getMonth() === Number(selectedMonth);

      let matchesPeriod = true;
      if (filterPeriod === 'day') {
        matchesPeriod = isSelectedYearMonth && (selectedDay === 'all' || itemDate.getDate() === Number(selectedDay));
      } else if (filterPeriod === 'week') {
        matchesPeriod = isSelectedYearMonth && (selectedWeek === 'all' || getWeekOfMonth(itemDate) === Number(selectedWeek));
      } else if (filterPeriod === 'month') {
        matchesPeriod = isSelectedYearMonth;
      } else if (filterPeriod === 'year') {
        matchesPeriod = itemDate.getFullYear() === Number(selectedYear);
      }

      return matchesQuery && matchesPeriod;
    })
    .sort((a, b) => {
      const nameA = (a.datos_extraidos?.acreditado || a.datos_extraidos?.nombre_acreditado || '').toLowerCase();
      const nameB = (b.datos_extraidos?.acreditado || b.datos_extraidos?.nombre_acreditado || '').toLowerCase();
      return sortAscending ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

  const theme = {
    bg: isDarkMode ? '#0b0f19' : '#f8fafc',
    cardBg: isDarkMode ? '#111827' : '#ffffff',
    textPrimary: isDarkMode ? '#f9fafb' : '#0f172a',
    textSecondary: isDarkMode ? '#9ca3af' : '#64748b',
    border: isDarkMode ? '#1f2937' : '#e2e8f0',
    inputBg: isDarkMode ? '#1f2937' : '#ffffff',
    subtleBg: isDarkMode ? '#1f2937' : '#f1f5f9',
    dropzoneBg: isDarkMode ? '#131c2e' : '#f8fafc',
    dropzoneBorder: isDarkMode ? '#3b82f6' : '#93c5fd',
    accent: '#2563eb'
  };

  return (
    <div style={{
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      backgroundColor: theme.bg,
      color: theme.textPrimary,
      minHeight: '100vh',
      margin: 0,
      padding: '24px 16px',
      boxSizing: 'border-box',
      transition: 'background-color 0.2s, color 0.2s'
    }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        input:focus, button:focus, select:focus {
          outline: none;
        }
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: ${isDarkMode ? '#111827' : '#f1f5f9'};
        }
        ::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? '#374151' : '#cbd5e1'};
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? '#4b5563' : '#94a3b8'};
        }
      `}</style>

      {isCheckingAuth ? (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
          <div style={{ textAlign: 'center' }}>
            <Loader2 size={48} color={theme.accent} style={{ animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      ) : !isAuthenticated ? (
        <div className="fade-in" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: isDarkMode ? '#0b0f19' : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)' }}>
          <div style={{ maxWidth: '420px', width: '100%', backgroundColor: theme.cardBg, padding: '40px 32px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)', border: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <button onClick={toggleTheme} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: theme.textSecondary }}>
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
            {isLoggingIn ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <Loader2 size={48} color={theme.accent} style={{ margin: '0 auto 20px auto', display: 'block', animation: 'spin 1s linear infinite' }} />
                <h3 style={{ margin: '0 0 8px 0', color: theme.textPrimary, fontSize: '18px', fontWeight: '600' }}>Cargando perfil...</h3>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                  <div style={{ backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                    <Lock color={theme.accent} size={30} />
                  </div>
                  <h2 style={{ margin: '0 0 6px 0', color: theme.textPrimary, fontSize: '24px', fontWeight: '700' }}>Acceso al Sistema</h2>
                </div>

                {loginError && (
                  <div style={{ backgroundColor: isDarkMode ? '#450a0a' : '#fef2f2', borderLeft: '4px solid #ef4444', color: isDarkMode ? '#fca5a5' : '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertCircle size={18} />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: theme.textSecondary, marginBottom: '8px' }}>Usuario</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '0 14px', backgroundColor: theme.inputBg }}>
                      <User size={18} color={theme.textSecondary} />
                      <input
                        type="text"
                        value={loginUser}
                        onChange={(e) => setLoginUser(e.target.value)}
                        required
                        style={{ width: '100%', padding: '12px 10px', border: 'none', outline: 'none', fontSize: '14px', backgroundColor: 'transparent', color: theme.textPrimary }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '28px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: theme.textSecondary, marginBottom: '8px' }}>Contraseña</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '0 14px', backgroundColor: theme.inputBg }}>
                      <Lock size={18} color={theme.textSecondary} />
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        style={{ width: '100%', padding: '12px 10px', border: 'none', outline: 'none', fontSize: '14px', backgroundColor: 'transparent', color: theme.textPrimary }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    style={{ width: '100%', backgroundColor: theme.accent, color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: '600', fontSize: '15px', cursor: 'pointer' }}
                  >
                    Ingresar a mi Perfil
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          
          {/* Encabezado Principal */}
          <header style={{ borderBottom: `1px solid ${theme.border}`, paddingBottom: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ color: theme.textPrimary, margin: '0 0 6px 0', fontSize: '24px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center' }}>
                  <FileText color={theme.accent} size={24} />
                </div> 
                Sistema de Cancelación de Hipotecas
              </h1>
              <p style={{ color: theme.textSecondary, margin: 0, fontSize: '14px' }}>
                Gestión individualizada de expedientes notariales
              </p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button 
                onClick={toggleTheme} 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: theme.subtleBg, border: `1px solid ${theme.border}`, color: theme.textPrimary, padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
              >
                {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                {isDarkMode ? 'Claro' : 'Oscuro'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: theme.subtleBg, padding: '6px 14px 6px 6px', borderRadius: '40px', border: `1px solid ${theme.border}` }}>
                <div style={{ backgroundColor: theme.accent, color: '#fff', width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '15px' }}>
                  {currentUser?.username?.charAt(0).toUpperCase()}
                </div>
                <div style={{ textAlign: 'left', paddingRight: '4px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: theme.textPrimary }}>{currentUser?.username}</div>
                  <div style={{ fontSize: '11px', color: theme.textSecondary, textTransform: 'uppercase' }}>{currentUser?.role || (currentUser?.es_admin ? 'admin' : 'operador')}</div>
                </div>
              </div>

              <button
                onClick={() => setShowLogoutModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: isDarkMode ? '#450a0a' : '#fff1f2', color: '#dc2626', border: '1px solid #fecdd3', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
              >
                <LogOut size={16} /> Salir
              </button>
            </div>
          </header>

          {/* NAVEGACIÓN TABS */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('single')}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: activeTab === 'single' ? theme.accent : theme.subtleBg,
                color: activeTab === 'single' ? '#fff' : theme.textSecondary,
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <FileText size={16} /> Caso Individual
            </button>

            <button
              onClick={() => setActiveTab('batch')}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: activeTab === 'batch' ? theme.accent : theme.subtleBg,
                color: activeTab === 'batch' ? '#fff' : theme.textSecondary,
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <FolderPlus size={16} /> Carga Masiva
            </button>

            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: activeTab === 'history' ? theme.accent : theme.subtleBg,
                color: activeTab === 'history' ? '#fff' : theme.textSecondary,
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <History size={16} /> Mi Historial
            </button>

            {esAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('users')}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: activeTab === 'users' ? theme.accent : theme.subtleBg,
                    color: activeTab === 'users' ? '#fff' : theme.textSecondary,
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Users size={16} /> Usuarios
                </button>

                <button
                  onClick={() => setActiveTab('templates')}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: activeTab === 'templates' ? theme.accent : theme.subtleBg,
                    color: activeTab === 'templates' ? '#fff' : theme.textSecondary,
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Settings size={16} /> Configuración Notarial
                </button>
              </>
            )}
          </div>

          {/* NOTIFICACIÓN DE ERROR */}
          {error && (
            <div style={{ backgroundColor: isDarkMode ? '#450a0a' : '#fef2f2', borderLeft: '4px solid #ef4444', color: isDarkMode ? '#fca5a5' : '#991b1b', padding: '14px 18px', borderRadius: '10px', marginBottom: '24px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* TAB: CASO INDIVIDUAL */}
          {activeTab === 'single' && (
            <div style={{ display: 'grid', gridTemplateColumns: datos ? '1fr 1fr' : '1fr', gap: '24px' }}>
              <div style={{ backgroundColor: theme.cardBg, padding: '24px', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Upload size={20} color={theme.accent} /> Cargar Expediente Individual
                </h2>

                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDropSingle}
                  style={{ border: `2px dashed ${theme.dropzoneBorder}`, backgroundColor: theme.dropzoneBg, borderRadius: '12px', padding: '32px 20px', textAlign: 'center', marginBottom: '20px', cursor: 'pointer' }}
                >
                  <FileText size={40} color={theme.accent} style={{ margin: '0 auto 12px auto' }} />
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: theme.textPrimary }}>
                    Arrastra aquí tus archivos PDF
                  </p>
                  <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: theme.textSecondary }}>o selecciona manualmente desde tu equipo</p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    onChange={handleSingleFileChange}
                    style={{ display: 'none' }}
                    id="single-file-input"
                  />
                  <label htmlFor="single-file-input" style={{ backgroundColor: theme.subtleBg, border: `1px solid ${theme.border}`, padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: theme.textPrimary, cursor: 'pointer' }}>
                    Buscar Archivos
                  </label>
                </div>

                {singleFiles.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: theme.textSecondary }}>
                      Archivos Seleccionados ({singleFiles.length}):
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '150px', overflowY: 'auto' }}>
                      {singleFiles.map((f, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', backgroundColor: theme.subtleBg, marginBottom: '6px', fontSize: '13px', color: theme.textPrimary }}>
                          <FileText size={14} color={theme.textSecondary} />
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {loading && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary }}>
                      <span>Procesando documentos...</span>
                      <span>{progressSingle}%</span>
                    </div>
                    <div style={{ width: '100%', backgroundColor: theme.subtleBg, height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${progressSingle}%`, backgroundColor: theme.accent, height: '100%', transition: 'width 0.2s' }} />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUploadSingle}
                  disabled={singleFiles.length === 0 || loading}
                  style={{
                    width: '100%',
                    backgroundColor: singleFiles.length === 0 || loading ? theme.subtleBg : theme.accent,
                    color: singleFiles.length === 0 || loading ? theme.textSecondary : '#fff',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '10px',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: singleFiles.length === 0 || loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={16} />}
                  Procesar Expediente
                </button>
              </div>

              {datos && (
                <div style={{ backgroundColor: theme.cardBg, padding: '24px', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={20} color="#10b981" /> Datos Extraídos
                    </h2>
                    <button
                      onClick={() => handleDownloadWord(expedienteId, datos)}
                      style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Download size={14} /> Descargar Word
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '500px', overflowY: 'auto', paddingRight: '4px' }}>
                    {Object.entries(datos).map(([key, val]) => {
                      const isUnlocked = unlockedFields[`single_${key}`];
                      return (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: '600', color: theme.textSecondary }}>
                            {formatLabel(key)}
                          </label>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={val || ''}
                              disabled={!isUnlocked}
                              onChange={(e) => handleInputChange(key, e.target.value)}
                              style={{
                                flex: 1,
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: `1px solid ${theme.border}`,
                                backgroundColor: isUnlocked ? theme.inputBg : theme.subtleBg,
                                color: theme.textPrimary,
                                fontSize: '13px',
                                opacity: isUnlocked ? 1 : 0.8
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleToggleUnlock(`single_${key}`)}
                              style={{
                                padding: '10px',
                                borderRadius: '8px',
                                border: `1px solid ${theme.border}`,
                                backgroundColor: isUnlocked ? '#fef3c7' : theme.subtleBg,
                                color: isUnlocked ? '#d97706' : theme.textSecondary,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {isUnlocked ? <Unlock size={16} /> : <Lock size={16} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: CARGA MASIVA */}
          {activeTab === 'batch' && (
            <div>
              <div style={{ backgroundColor: theme.cardBg, padding: '24px', borderRadius: '16px', border: `1px solid ${theme.border}`, marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderPlus size={20} color={theme.accent} /> Carga Masiva de Expedientes
                </h2>

                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDropBatch}
                  style={{ border: `2px dashed ${theme.dropzoneBorder}`, backgroundColor: theme.dropzoneBg, borderRadius: '12px', padding: '32px 20px', textAlign: 'center', marginBottom: '20px', cursor: 'pointer' }}
                >
                  <FileArchive size={40} color={theme.accent} style={{ margin: '0 auto 12px auto' }} />
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: theme.textPrimary }}>
                    Arrastra aquí tu carpeta o múltiples archivos PDF
                  </p>
                  <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: theme.textSecondary }}>se escanearán subcarpetas automáticamente</p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf"
                    webkitdirectory="true"
                    onChange={handleBatchFileChange}
                    style={{ display: 'none' }}
                    id="batch-file-input"
                  />
                  <label htmlFor="batch-file-input" style={{ backgroundColor: theme.subtleBg, border: `1px solid ${theme.border}`, padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: theme.textPrimary, cursor: 'pointer' }}>
                    Buscar Carpeta / Archivos
                  </label>
                </div>

                {batchFiles.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: theme.textSecondary }}>
                      Archivos Detectados ({batchFiles.length}):
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '150px', overflowY: 'auto' }}>
                      {batchFiles.map((f, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', backgroundColor: theme.subtleBg, marginBottom: '6px', fontSize: '13px', color: theme.textPrimary }}>
                          <FileText size={14} color={theme.textSecondary} />
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {batchLoading && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', color: theme.textSecondary }}>
                      <span>Procesando lote de documentos...</span>
                      <span>{progressBatch}%</span>
                    </div>
                    <div style={{ width: '100%', backgroundColor: theme.subtleBg, height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${progressBatch}%`, backgroundColor: theme.accent, height: '100%', transition: 'width 0.2s' }} />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUploadBatch}
                  disabled={batchFiles.length === 0 || batchLoading}
                  style={{
                    width: '100%',
                    backgroundColor: batchFiles.length === 0 || batchLoading ? theme.subtleBg : theme.accent,
                    color: batchFiles.length === 0 || batchLoading ? theme.textSecondary : '#fff',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '10px',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: batchFiles.length === 0 || batchLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {batchLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FolderPlus size={16} />}
                  Procesar Carga Masiva
                </button>
              </div>

              {batchResults.length > 0 && (
                <div style={{ backgroundColor: theme.cardBg, padding: '24px', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: theme.textPrimary }}>
                      Resultados del Lote ({batchResults.length})
                    </h2>
                    <button
                      onClick={handleDownloadZip}
                      style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Download size={16} /> Descargar Todo (ZIP)
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {batchResults.map((res, idx) => {
                      const isOpen = !!openAccordion[idx];
                      const datosExtraidos = res.datos_extraidos || {};
                      const acreditadoNombre = datosExtraidos.acreditado || datosExtraidos.nombre_acreditado || 'Acreditado no identificado';

                      return (
                        <div key={idx} style={{ border: `1px solid ${theme.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                          <div 
                            onClick={() => toggleAccordion(idx)}
                            style={{ padding: '14px 18px', backgroundColor: theme.subtleBg, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <CheckCircle size={18} color="#10b981" />
                              <span style={{ fontWeight: '600', fontSize: '14px', color: theme.textPrimary }}>
                                {acreditadoNombre}
                              </span>
                              {datosExtraidos.numero_credito && (
                                <span style={{ fontSize: '12px', color: theme.textSecondary, backgroundColor: theme.cardBg, padding: '2px 8px', borderRadius: '4px', border: `1px solid ${theme.border}` }}>
                                  Crédito: {datosExtraidos.numero_credito}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadWord(res.expediente_id, datosExtraidos);
                                }}
                                style={{ backgroundColor: theme.accent, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Download size={12} /> DOCX
                              </button>
                              {isOpen ? <ChevronUp size={18} color={theme.textSecondary} /> : <ChevronDown size={18} color={theme.textSecondary} />}
                            </div>
                          </div>

                          {isOpen && (
                            <div style={{ padding: '18px', backgroundColor: theme.cardBg, borderTop: `1px solid ${theme.border}`, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                              {Object.entries(datosExtraidos).map(([bKey, bVal]) => {
                                const fieldKey = `batch_${idx}_${bKey}`;
                                const isUnlocked = unlockedFields[fieldKey];

                                return (
                                  <div key={bKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '600', color: theme.textSecondary }}>
                                      {formatLabel(bKey)}
                                    </label>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                      <input
                                        type="text"
                                        value={bVal || ''}
                                        disabled={!isUnlocked}
                                        onChange={(e) => handleBatchInputChange(idx, bKey, e.target.value)}
                                        style={{
                                          flex: 1,
                                          padding: '8px 10px',
                                          borderRadius: '6px',
                                          border: `1px solid ${theme.border}`,
                                          backgroundColor: isUnlocked ? theme.inputBg : theme.subtleBg,
                                          color: theme.textPrimary,
                                          fontSize: '12px',
                                          opacity: isUnlocked ? 1 : 0.8
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleToggleUnlock(fieldKey)}
                                        style={{
                                          padding: '8px',
                                          borderRadius: '6px',
                                          border: `1px solid ${theme.border}`,
                                          backgroundColor: isUnlocked ? '#fef3c7' : theme.subtleBg,
                                          color: isUnlocked ? '#d97706' : theme.textSecondary,
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        }}
                                      >
                                        {isUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: HISTORIAL */}
          {activeTab === 'history' && (
            <div style={{ backgroundColor: theme.cardBg, padding: '24px', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={20} color={theme.accent} /> Historial de Expedientes
                </h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Búsqueda por texto */}
                  <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '0 10px', backgroundColor: theme.inputBg }}>
                    <Search size={16} color={theme.textSecondary} />
                    <input
                      type="text"
                      placeholder="Buscar por acreditado o crédito..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ padding: '8px', border: 'none', backgroundColor: 'transparent', color: theme.textPrimary, fontSize: '13px', width: '200px' }}
                    />
                  </div>

                  {/* Selector de Periodo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '0 8px', backgroundColor: theme.inputBg }}>
                    <Filter size={14} color={theme.textSecondary} />
                    <select
                      value={filterPeriod}
                      onChange={(e) => setFilterPeriod(e.target.value)}
                      style={{ border: 'none', backgroundColor: 'transparent', color: theme.textPrimary, fontSize: '13px', padding: '8px 0', cursor: 'pointer' }}
                    >
                      <option value="all">Todo el historial</option>
                      <option value="day">Por Día</option>
                      <option value="week">Por Semana</option>
                      <option value="month">Por Mes</option>
                      <option value="year">Por Año</option>
                    </select>
                  </div>

                  {/* Filtro Dinámico: Año */}
                  {filterPeriod !== 'all' && (
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      style={{ border: `1px solid ${theme.border}`, borderRadius: '8px', backgroundColor: theme.inputBg, color: theme.textPrimary, fontSize: '13px', padding: '8px', cursor: 'pointer' }}
                    >
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  )}

                  {/* Filtro Dinámico: Mes */}
                  {(filterPeriod === 'day' || filterPeriod === 'week' || filterPeriod === 'month') && (
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      style={{ border: `1px solid ${theme.border}`, borderRadius: '8px', backgroundColor: theme.inputBg, color: theme.textPrimary, fontSize: '13px', padding: '8px', cursor: 'pointer' }}
                    >
                      {mesesNombres.map((m, idx) => (
                        <option key={idx} value={idx}>{m}</option>
                      ))}
                    </select>
                  )}

                  {/* Filtro Dinámico: Semana */}
                  {filterPeriod === 'week' && (
                    <select
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value)}
                      style={{ border: `1px solid ${theme.border}`, borderRadius: '8px', backgroundColor: theme.inputBg, color: theme.textPrimary, fontSize: '13px', padding: '8px', cursor: 'pointer' }}
                    >
                      <option value="all">Todas las semanas</option>
                      <option value="1">Semana 1</option>
                      <option value="2">Semana 2</option>
                      <option value="3">Semana 3</option>
                      <option value="4">Semana 4</option>
                    </select>
                  )}

                  {/* Filtro Dinámico: Día */}
                  {filterPeriod === 'day' && (
                    <select
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(e.target.value)}
                      style={{ border: `1px solid ${theme.border}`, borderRadius: '8px', backgroundColor: theme.inputBg, color: theme.textPrimary, fontSize: '13px', padding: '8px', cursor: 'pointer' }}
                    >
                      <option value="all">Todos los días</option>
                      {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>Día {d}</option>
                      ))}
                    </select>
                  )}

                  {/* Orden A-Z / Z-A */}
                  <button
                    onClick={() => setSortAscending(!sortAscending)}
                    title={sortAscending ? 'Orden A-Z' : 'Orden Z-A'}
                    style={{ border: `1px solid ${theme.border}`, borderRadius: '8px', backgroundColor: theme.inputBg, color: theme.textPrimary, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                  >
                    <ArrowUpDown size={14} />
                    {sortAscending ? 'A-Z' : 'Z-A'}
                  </button>
                </div>
              </div>

              {filteredHistorial.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: theme.textSecondary, fontSize: '14px' }}>
                  No se encontraron expedientes con los criterios seleccionados.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${theme.border}`, color: theme.textSecondary }}>
                        <th style={{ padding: '12px' }}>Acreditado</th>
                        <th style={{ padding: '12px' }}>No. Crédito</th>
                        <th style={{ padding: '12px' }}>Fecha</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistorial.map((item, idx) => {
                        const dExtra = item.datos_extraidos || {};
                        const nombre = dExtra.acreditado || dExtra.nombre_acreditado || item.nombre_acreditado || 'N/A';
                        const numCred = dExtra.numero_credito || item.numero_credito || 'N/A';
                        const fechaStr = new Date(item.created_at || item.fecha || Date.now()).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        });

                        return (
                          <tr key={idx} style={{ borderBottom: `1px solid ${theme.border}` }}>
                            <td style={{ padding: '12px', fontWeight: '600', color: theme.textPrimary }}>{nombre}</td>
                            <td style={{ padding: '12px', color: theme.textSecondary }}>{numCred}</td>
                            <td style={{ padding: '12px', color: theme.textSecondary }}>{fechaStr}</td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>
                              <button
                                onClick={() => handleDownloadWord(item.id || item.expediente_id, dExtra)}
                                style={{ backgroundColor: theme.subtleBg, color: theme.textPrimary, border: `1px solid ${theme.border}`, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Download size={12} /> Descargar DOCX
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

{/* TAB: USUARIOS (SOLO ADMIN) */}
          {activeTab === 'users' && esAdmin && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
              {/* Formulario Crear Usuario */}
              <div style={{ backgroundColor: theme.cardBg, padding: '24px', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={20} color={theme.accent} /> Crear Nuevo Usuario
                </h2>
                <form onSubmit={handleCrearUsuario}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: theme.textSecondary, marginBottom: '6px' }}>Nombre de Usuario</label>
                    <input
                      type="text"
                      required
                      value={nuevoUsuario.username}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, username: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${theme.border}`, backgroundColor: theme.inputBg, color: theme.textPrimary, fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: theme.textSecondary, marginBottom: '6px' }}>Contraseña</label>
                    <input
                      type="password"
                      required
                      value={nuevoUsuario.password}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${theme.border}`, backgroundColor: theme.inputBg, color: theme.textPrimary, fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id="es_admin_cb"
                      checked={nuevoUsuario.es_admin}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, es_admin: e.target.checked, role: e.target.checked ? 'admin' : 'operador' })}
                    />
                    <label htmlFor="es_admin_cb" style={{ fontSize: '13px', color: theme.textPrimary, cursor: 'pointer' }}>Es Administrador</label>
                  </div>

                  <button
                    type="submit"
                    style={{ width: '100%', backgroundColor: theme.accent, color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
                  >
                    Guardar Usuario
                  </button>
                </form>
              </div>

              {/* Lista de Usuarios */}
              <div style={{ backgroundColor: theme.cardBg, padding: '24px', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={20} color={theme.accent} /> Lista de Usuarios
                </h2>

                {loadingUsuarios ? (
                  <div style={{ textAlign: 'center', padding: '20px' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${theme.border}`, color: theme.textSecondary }}>
                        <th style={{ padding: '10px' }}>Usuario</th>
                        <th style={{ padding: '10px' }}>Rol</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuariosLista.map((u) => {
                        const esUsuarioAdmin = u.es_admin || u.role === 'admin' || u.username === 'admin';
                        return (
                          <tr key={u.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                            <td style={{ padding: '10px', fontWeight: '600', color: theme.textPrimary }}>{u.username}</td>
                            <td style={{ padding: '10px', color: theme.textSecondary }}>{esUsuarioAdmin ? 'Administrador' : 'Operador'}</td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>
                              {!esUsuarioAdmin ? (
                                <button
                                  type="button"
                                  onClick={(e) => handleEliminarUsuario(e, u.id)}
                                  style={{ backgroundColor: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', padding: '6px' }}
                                  title="Eliminar usuario"
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : (
                                <span style={{ fontSize: '11px', color: theme.textSecondary, fontStyle: 'italic' }}>Protegido</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB: PLANTILLAS (SOLO ADMIN) */}
          {activeTab === 'templates' && esAdmin && (
            <div style={{ backgroundColor: theme.cardBg, padding: '24px', borderRadius: '16px', border: `1px solid ${theme.border}` }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} color={theme.accent} /> Gestión de Plantillas Notariales (.docx)
              </h2>

              <form onSubmit={handleSubirPlantilla} style={{ marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="file"
                  accept=".docx"
                  onChange={(e) => setArchivoPlantilla(e.target.files?.[0] || null)}
                  style={{ fontSize: '13px', color: theme.textPrimary }}
                />
                <button
                  type="submit"
                  disabled={!archivoPlantilla}
                  style={{
                    backgroundColor: archivoPlantilla ? theme.accent : theme.subtleBg,
                    color: archivoPlantilla ? '#fff' : theme.textSecondary,
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: archivoPlantilla ? 'pointer' : 'not-allowed'
                  }}
                >
                  Subir Plantilla
                </button>
              </form>

              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: theme.textSecondary }}>Plantillas Existentes:</h3>
                {plantillas.length === 0 ? (
                  <p style={{ fontSize: '13px', color: theme.textSecondary }}>No hay plantillas personalizadas registradas.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {plantillas.map((p, idx) => (
                      <li key={idx} style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: theme.subtleBg, marginBottom: '8px', fontSize: '13px', color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileCode size={16} color={theme.accent} />
                        <span>{p.nombre || p.filename || `Plantilla ${idx + 1}`}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* MODAL DE CERRAR SESIÓN */}
          {showLogoutModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div style={{ backgroundColor: theme.cardBg, padding: '24px', borderRadius: '16px', maxWidth: '360px', width: '100%', border: `1px solid ${theme.border}` }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', color: theme.textPrimary }}>¿Cerrar Sesión?</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: theme.textSecondary }}>¿Estás seguro de que deseas salir del sistema?</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowLogoutModal(false)}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: `1px solid ${theme.border}`, backgroundColor: theme.subtleBg, color: theme.textPrimary, cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmLogout}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                  >
                    Sí, Salir
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}