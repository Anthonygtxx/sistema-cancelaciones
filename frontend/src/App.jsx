import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Upload, FileText, Download, CheckCircle, AlertCircle, History, 
  Search, FileArchive, FolderPlus, Lock, Unlock, KeyRound, 
  LogOut, User, Loader2, ChevronDown, ChevronUp, Users, Settings, 
  Plus, Trash2, Edit, Save, FileCode, Check, Calendar, Clock, DollarSign,
  Sun, Moon
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
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [fieldToUnlock, setFieldToUnlock] = useState(null);
  const [inputPassword, setInputPassword] = useState('');
  const [authError, setAuthError] = useState('');

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

  // ESTADOS - Historial
  const [historial, setHistorial] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // ESTADOS - Panel de Administración de Usuarios
  const [usuariosLista, setUsuariosLista] = useState([]);
  const [nuevoUsuario, setNuevoUsuario] = useState({ username: '', password: '', role: 'operador', es_admin: false });
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  // ESTADOS - Panel de Plantillas / Configuración Notarial
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
      setHistorial(res.data);
    } catch (err) {
      console.error('Error al cargar historial:', err);
    }
  };

  const cargarUsuarios = async () => {
    setLoadingUsuarios(true);
    try {
      const res = await api.get('/admin/usuarios');
      setUsuariosLista(res.data);
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

  const handleEliminarUsuario = async (id) => {
    if (!window.confirm('¿Deseas eliminar este usuario?')) return;
    try {
      await api.delete(`/admin/usuarios/${id}`);
      cargarUsuarios();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al eliminar usuario.');
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

  const handleRequestUnlock = (fieldKey) => {
    if (unlockedFields[fieldKey]) {
      setUnlockedFields((prev) => ({ ...prev, [fieldKey]: false }));
    } else {
      setFieldToUnlock(fieldKey);
      setInputPassword('');
      setAuthError('');
      setPasswordModalOpen(true);
    }
  };

  const handleConfirmUnlock = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/verify-password', { 
        username: currentUser?.username,
        password: inputPassword 
      });
      if (res.data?.status === 'autorizado') {
        setUnlockedFields((prev) => ({ ...prev, [fieldToUnlock]: true }));
        setPasswordModalOpen(false);
        setFieldToUnlock(null);
        setInputPassword('');
      }
    } catch (err) {
      setAuthError(err.response?.data?.detail || 'Contraseña incorrecta.');
    }
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

  const filteredHistorial = historial.filter((item) => {
    const query = searchQuery.toLowerCase();
    const acreditado = (item.datos_extraidos?.acreditado || item.datos_extraidos?.nombre_acreditado || '').toLowerCase();
    const numCredito = (item.datos_extraidos?.numero_credito || item.numero_credito || '').toLowerCase();
    return acreditado.includes(query) || numCredito.includes(query);
  });

  // Estilos temáticos de alto contraste
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
      padding: 0,
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
        input:focus, button:focus {
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
                      <KeyRound size={18} color={theme.textSecondary} />
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
        <div className="fade-in" style={{ width: '100%', padding: '24px 32px', boxSizing: 'border-box' }}>
          
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

          {/* TAB 1: CASO INDIVIDUAL */}
          {activeTab === 'single' && (
            <div className="fade-in">
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDropSingle}
                style={{
                  border: `2px dashed ${theme.dropzoneBorder}`,
                  backgroundColor: theme.dropzoneBg,
                  borderRadius: '16px',
                  padding: '40px 20px',
                  textAlign: 'center',
                  marginBottom: '24px',
                  transition: 'border-color 0.2s'
                }}
              >
                <Upload size={40} color={theme.accent} style={{ margin: '0 auto 12px auto', display: 'block' }} />
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: theme.textPrimary }}>
                  Arrastra y suelta tus expedientes PDF en esta zona
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: theme.textSecondary }}>
                  O si lo prefieres, selecciona los archivos localmente
                </p>
                <label style={{ display: 'inline-block', backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: theme.textPrimary }}>
                  Seleccionar Documentos
                  <input type="file" multiple accept=".pdf" onChange={handleSingleFileChange} style={{ display: 'none' }} />
                </label>
              </div>

              {singleFiles.length > 0 && (
                <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: theme.textPrimary }}>Archivos seleccionados:</h4>
                  <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px', color: theme.textSecondary, fontSize: '13px' }}>
                    {singleFiles.map((file, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{file.name}</li>
                    ))}
                  </ul>

                  {loading ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: theme.textSecondary }}>
                        <span>Procesando archivo con IA...</span>
                        <span>{progressSingle}%</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: theme.subtleBg, borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressSingle}%`, height: '100%', backgroundColor: theme.accent, transition: 'width 0.2s' }}></div>
                      </div>
                    </div>
                  ) : (
                    <button onClick={handleUploadSingle} style={{ backgroundColor: theme.accent, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                      Procesar Archivo
                    </button>
                  )}
                </div>
              )}

              {datos && (
                <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '16px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: theme.textPrimary }}>Datos Extraídos del Expediente</h3>
                    <button onClick={() => handleDownloadWord(expedienteId, datos)} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                      <Download size={16} /> Descargar Cancelación (.docx)
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {Object.entries(datos).map(([key, val]) => {
                      const isUnlocked = unlockedFields[key];
                      return (
                        <div key={key} style={{ backgroundColor: theme.subtleBg, padding: '12px 16px', borderRadius: '10px', border: `1px solid ${theme.border}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase' }}>
                              {formatLabel(key)}
                            </label>
                            <button onClick={() => handleRequestUnlock(key)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isUnlocked ? '#10b981' : theme.textSecondary }}>
                              {isUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
                            </button>
                          </div>
                          <input
                            type="text"
                            value={val || ''}
                            disabled={!isUnlocked}
                            onChange={(e) => handleInputChange(key, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              border: `1px solid ${isUnlocked ? theme.accent : theme.border}`,
                              borderRadius: '6px',
                              fontSize: '14px',
                              backgroundColor: isUnlocked ? theme.inputBg : 'transparent',
                              color: theme.textPrimary,
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CARGA MASIVA */}
          {activeTab === 'batch' && (
            <div className="fade-in">
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDropBatch}
                style={{
                  border: `2px dashed ${theme.dropzoneBorder}`,
                  backgroundColor: theme.dropzoneBg,
                  borderRadius: '16px',
                  padding: '40px 20px',
                  textAlign: 'center',
                  marginBottom: '24px'
                }}
              >
                <FolderPlus size={40} color={theme.accent} style={{ margin: '0 auto 12px auto', display: 'block' }} />
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: theme.textPrimary }}>
                  Carga Masiva de Expedientes
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: theme.textSecondary }}>
                  Arrastra carpetas o múltiples archivos PDF
                </p>
                <label style={{ display: 'inline-block', backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: theme.textPrimary }}>
                  Seleccionar Carpeta / Archivos
                  <input type="file" multiple accept=".pdf" onChange={handleBatchFileChange} style={{ display: 'none' }} />
                </label>
              </div>

              {batchFiles.length > 0 && (
                <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: theme.textPrimary }}>Lote listo para procesar: {batchFiles.length} archivos</h4>
                  
                  {batchLoading ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: theme.textSecondary }}>
                        <span>Procesando lote de archivos...</span>
                        <span>{progressBatch}%</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: theme.subtleBg, borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressBatch}%`, height: '100%', backgroundColor: theme.accent, transition: 'width 0.2s' }}></div>
                      </div>
                    </div>
                  ) : (
                    <button onClick={handleUploadBatch} style={{ backgroundColor: theme.accent, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                      Iniciar Procesamiento Masivo
                    </button>
                  )}
                </div>
              )}

              {batchResults.length > 0 && (
                <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '16px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: theme.textPrimary }}>Resultados del Procesamiento</h3>
                    <button onClick={handleDownloadZip} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                      <FileArchive size={16} /> Descargar Todos (.ZIP)
                    </button>
                  </div>

                  {batchResults.map((resItem, idx) => {
                    const isOpen = openAccordion[idx];
                    return (
                      <div key={idx} style={{ border: `1px solid ${theme.border}`, borderRadius: '10px', marginBottom: '12px', overflow: 'hidden' }}>
                        <div 
                          onClick={() => toggleAccordion(idx)} 
                          style={{ backgroundColor: theme.subtleBg, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        >
                          <span style={{ fontWeight: '600', fontSize: '14px', color: theme.textPrimary }}>
                            {resItem.datos_extraidos?.acreditado ? `Expediente: ${resItem.datos_extraidos.acreditado}` : `Expediente #${idx + 1}`}
                          </span>
                          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>

                        {isOpen && (
                          <div style={{ padding: '18px', backgroundColor: theme.cardBg }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                              {Object.entries(resItem.datos_extraidos || {}).map(([bKey, bVal]) => (
                                <div key={bKey} style={{ backgroundColor: theme.subtleBg, padding: '10px 14px', borderRadius: '8px' }}>
                                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', marginBottom: '4px' }}>
                                    {formatLabel(bKey)}
                                  </label>
                                  <input
                                    type="text"
                                    value={bVal || ''}
                                    onChange={(e) => handleBatchInputChange(idx, bKey, e.target.value)}
                                    style={{ width: '100%', border: `1px solid ${theme.border}`, borderRadius: '4px', padding: '6px', fontSize: '13px', backgroundColor: theme.inputBg, color: theme.textPrimary, boxSizing: 'border-box' }}
                                  />
                                </div>
                              ))}
                            </div>
                            <button onClick={() => handleDownloadWord(resItem.expediente_id, resItem.datos_extraidos)} style={{ backgroundColor: theme.accent, color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>
                              Descargar Word
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: HISTORIAL */}
          {activeTab === 'history' && (
            <div className="fade-in" style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: theme.textPrimary }}>Historial de Expedientes</h3>
                <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '0 12px', backgroundColor: theme.inputBg }}>
                  <Search size={16} color={theme.textSecondary} />
                  <input
                    type="text"
                    placeholder="Buscar por acreditado o crédito..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ border: 'none', padding: '8px 10px', fontSize: '13px', backgroundColor: 'transparent', color: theme.textPrimary, outline: 'none' }}
                  />
                </div>
              </div>

              {filteredHistorial.length === 0 ? (
                <p style={{ color: theme.textSecondary, fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>No se encontraron expedientes registrados.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${theme.border}`, color: theme.textSecondary }}>
                        <th style={{ padding: '12px' }}>Acreditado</th>
                        <th style={{ padding: '12px' }}>No. Crédito</th>
                        <th style={{ padding: '12px' }}>Fecha</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistorial.map((item, index) => (
                        <tr key={index} style={{ borderBottom: `1px solid ${theme.border}` }}>
                          <td style={{ padding: '12px', color: theme.textPrimary, fontWeight: '600' }}>
                            {item.datos_extraidos?.acreditado || item.datos_extraidos?.nombre_acreditado || 'N/D'}
                          </td>
                          <td style={{ padding: '12px', color: theme.textSecondary }}>
                            {item.datos_extraidos?.numero_credito || item.numero_credito || 'N/D'}
                          </td>
                          <td style={{ padding: '12px', color: theme.textSecondary }}>
                            {item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleDateString() : 'N/D'}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <button onClick={() => handleDownloadWord(item.id || item.expediente_id, item.datos_extraidos)} style={{ backgroundColor: theme.subtleBg, border: `1px solid ${theme.border}`, color: theme.textPrimary, padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                              Descargar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: USUARIOS (ADMIN) */}
          {activeTab === 'users' && esAdmin && (
            <div className="fade-in" style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: theme.textPrimary }}>Administración de Usuarios</h3>

              <form onSubmit={handleCrearUsuario} style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: theme.textSecondary, marginBottom: '4px' }}>Usuario</label>
                  <input
                    type="text"
                    value={nuevoUsuario.username}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, username: e.target.value })}
                    required
                    style={{ border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '8px 12px', fontSize: '14px', backgroundColor: theme.inputBg, color: theme.textPrimary }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: theme.textSecondary, marginBottom: '4px' }}>Contraseña</label>
                  <input
                    type="password"
                    value={nuevoUsuario.password}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
                    required
                    style={{ border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '8px 12px', fontSize: '14px', backgroundColor: theme.inputBg, color: theme.textPrimary }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '10px' }}>
                  <input
                    type="checkbox"
                    id="es_admin"
                    checked={nuevoUsuario.es_admin}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, es_admin: e.target.checked })}
                  />
                  <label htmlFor="es_admin" style={{ fontSize: '13px', color: theme.textPrimary, fontWeight: '600', cursor: 'pointer' }}>¿Es Admin?</label>
                </div>
                <button type="submit" style={{ backgroundColor: theme.accent, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                  Crear Usuario
                </button>
              </form>

              {loadingUsuarios ? (
                <p style={{ color: theme.textSecondary }}>Cargando usuarios...</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${theme.border}`, color: theme.textSecondary }}>
                        <th style={{ padding: '12px' }}>Usuario</th>
                        <th style={{ padding: '12px' }}>Rol</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuariosLista.map((u) => (
                        <tr key={u.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                          <td style={{ padding: '12px', color: theme.textPrimary, fontWeight: '600' }}>{u.username}</td>
                          <td style={{ padding: '12px', color: theme.textSecondary }}>{u.es_admin || u.role === 'admin' ? 'Administrador' : 'Operador'}</td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            <button onClick={() => handleEliminarUsuario(u.id)} style={{ backgroundColor: '#fee2e2', border: 'none', color: '#dc2626', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CONFIGURACIÓN NOTARIAL (ADMIN) */}
          {activeTab === 'templates' && esAdmin && (
            <div className="fade-in" style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: theme.textPrimary }}>Configuración Notarial / Plantillas</h3>

              <form onSubmit={handleSubirPlantilla} style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: theme.textSecondary, marginBottom: '8px' }}>
                  Subir o reemplazar plantilla de Word (.docx):
                </label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="file"
                    accept=".docx"
                    onChange={(e) => setArchivoPlantilla(e.target.files[0] || null)}
                    style={{ fontSize: '14px', color: theme.textPrimary }}
                  />
                  <button type="submit" disabled={!archivoPlantilla} style={{ backgroundColor: theme.accent, color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: archivoPlantilla ? 'pointer' : 'not-allowed', opacity: archivoPlantilla ? 1 : 0.6 }}>
                    Subir Plantilla
                  </button>
                </div>
              </form>

              <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '700', color: theme.textPrimary }}>Plantillas Disponibles</h4>
              {plantillas.length === 0 ? (
                <p style={{ color: theme.textSecondary, fontSize: '14px' }}>No hay plantillas registradas actualmente.</p>
              ) : (
                <ul style={{ paddingLeft: '20px', color: theme.textPrimary, fontSize: '14px' }}>
                  {plantillas.map((p, idx) => (
                    <li key={idx} style={{ marginBottom: '6px' }}>{p.nombre || p.filename || `Plantilla ${idx + 1}`}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}