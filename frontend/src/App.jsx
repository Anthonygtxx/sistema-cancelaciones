import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Upload, FileText, Download, CheckCircle, AlertCircle, History, 
  Search, FileArchive, FolderPlus, Lock, Unlock, KeyRound, 
  LogOut, User, Loader2, ChevronDown, ChevronUp, Users, Settings, 
  Plus, Trash2, Edit, Save, FileCode, Check, Calendar, Clock, DollarSign
} from 'lucide-react';
import './App.css'; // Importación de la hoja de estilos externa

// ✅ Configuración producción / Railway
axios.defaults.withCredentials = true;

const api = axios.create({
  baseURL: 'https://sistema-cancelaciones-production.up.railway.app/api'
});

export default function App() {
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

  // Verificar sesión activa al cargar
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

  // --- HANDLERS DE SESIÓN Y AUTENTICACIÓN ---
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

  // --- LÓGICA DE CREACIÓN Y BORRADO DE USUARIOS ---
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

  // --- LÓGICA DE CARGA DE PLANTILLAS ---
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

  // --- LÓGICA DE DESBLOQUEO MEDIANTE CONTRASEÑA ---
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

  // --- ACCORDION Y MANEJO DE ARCHIVOS ---
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

  // --- PROCESAMIENTO ---
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

  return (
    <div className="app-container">
      {isCheckingAuth ? (
        <div className="loading-screen">
          <Loader2 className="spinner" size={48} color="#2563eb" />
        </div>
      ) : !isAuthenticated ? (
        <div className="login-screen fade-in">
          <div className="login-card">
            {isLoggingIn ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <Loader2 className="spinner" size={48} color="#2563eb" style={{ margin: '0 auto 20px auto', display: 'block' }} />
                <h3 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '18px', fontWeight: '600' }}>Cargando perfil...</h3>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                  <div style={{ backgroundColor: '#eff6ff', width: '64px', height: '64px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                    <Lock color="#2563eb" size={30} />
                  </div>
                  <h2 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '24px', fontWeight: '700' }}>Acceso al Sistema</h2>
                </div>

                {loginError && (
                  <div className="alert-error">
                    <AlertCircle size={18} />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin}>
                  <div className="form-group">
                    <label className="form-label">Usuario</label>
                    <div className="input-icon-wrapper">
                      <User size={18} color="#94a3b8" />
                      <input
                        type="text"
                        className="input-field"
                        value={loginUser}
                        onChange={(e) => setLoginUser(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '28px' }}>
                    <label className="form-label">Contraseña</label>
                    <div className="input-icon-wrapper">
                      <KeyRound size={18} color="#94a3b8" />
                      <input
                        type="password"
                        className="input-field"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn-primary">
                    Ingresar a mi Perfil
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="dashboard-container fade-in">
          <div className="dashboard-card">
            
            {/* Encabezado */}
            <header className="header-container">
              <div>
                <h1 className="header-title">
                  <div className="header-icon-box">
                    <FileText color="#2563eb" size={26} />
                  </div> 
                  Sistema de Cancelación de Hipotecas
                </h1>
                <p className="header-subtitle">
                  Gestión individualizada de expedientes notariales
                </p>
              </div>
              
              <div className="user-badge-container">
                <div className="user-badge">
                  <div className="user-avatar">
                    {currentUser?.username?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ textAlign: 'left', paddingRight: '4px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{currentUser?.username}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>{currentUser?.role || (currentUser?.es_admin ? 'admin' : 'operador')}</div>
                  </div>
                </div>

                <button onClick={() => setShowLogoutModal(true)} className="btn-logout">
                  <LogOut size={16} /> Salir
                </button>
              </div>
            </header>

            {/* MODAL CERRAR SESIÓN */}
            {showLogoutModal && (
              <div className="modal-overlay fade-in">
                <div className="modal-content">
                  <h3 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ backgroundColor: '#fee2e2', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                      <LogOut size={20} color="#dc2626" />
                    </div> 
                    Cerrar Sesión
                  </h3>
                  <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748b' }}>
                    ¿Deseas salir del perfil de <b style={{ color: '#0f172a' }}>{currentUser?.username}</b>?
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button 
                      type="button" 
                      onClick={() => setShowLogoutModal(false)} 
                      style={{ border: '1px solid #cbd5e1', background: '#ffffff', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', color: '#475569', fontWeight: '600' }}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button" 
                      onClick={handleConfirmLogout} 
                      style={{ border: 'none', background: '#dc2626', padding: '10px 18px', borderRadius: '10px', cursor: 'pointer', color: '#fff', fontWeight: '600' }}
                    >
                      Sí, Salir
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL DE CONTRASEÑA PARA DESBLOQUEAR CAMPOS */}
            {passwordModalOpen && (
              <div className="modal-overlay fade-in" style={{ zIndex: 1100 }}>
                <div className="modal-content">
                  <h3 style={{ margin: '0 0 10px 0', color: '#0f172a', fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ backgroundColor: '#eff6ff', padding: '8px', borderRadius: '10px', display: 'flex' }}>
                      <Lock size={20} color="#2563eb" />
                    </div>
                    Autorización Requerida
                  </h3>
                  <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
                    Ingresa tu contraseña de <b style={{ color: '#0f172a' }}>{currentUser?.username}</b> para desbloquear y editar este campo.
                  </p>

                  {authError && (
                    <div className="alert-error" style={{ marginBottom: '16px' }}>
                      <AlertCircle size={16} />
                      <span>{authError}</span>
                    </div>
                  )}

                  <form onSubmit={handleConfirmUnlock}>
                    <div style={{ marginBottom: '20px' }}>
                      <input
                        type="password"
                        placeholder="Tu contraseña actual"
                        value={inputPassword}
                        onChange={(e) => setInputPassword(e.target.value)}
                        required
                        autoFocus
                        style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '14px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setPasswordModalOpen(false)}
                        style={{ border: '1px solid #cbd5e1', background: '#fff', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', color: '#475569' }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        style={{ border: 'none', background: '#2563eb', color: '#fff', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}
                      >
                        Desbloquear
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* NAVEGACIÓN TABS */}
            <div className="tabs-navigation">
              <button
                onClick={() => setActiveTab('single')}
                className={`tab-button ${activeTab === 'single' ? 'active' : ''}`}
              >
                <FileText size={18} /> Caso Individual
              </button>

              <button
                onClick={() => setActiveTab('batch')}
                className={`tab-button ${activeTab === 'batch' ? 'active' : ''}`}
              >
                <FolderPlus size={18} /> Carga Masiva
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
              >
                <History size={18} /> Mi Historial ({currentUser?.username})
              </button>

              {esAdmin && (
                <>
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
                  >
                    <Users size={18} /> Usuarios
                  </button>
                  <button
                    onClick={() => setActiveTab('templates')}
                    className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
                  >
                    <Settings size={18} /> Plantillas
                  </button>
                </>
              )}
            </div>

            {/* CONTENIDO PRINCIPAL POR TAB */}
            {activeTab === 'single' && (
              <div className="fade-in">
                {/* Zona Carga Archivo */}
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDropSingle}
                  style={{ border: '2px dashed #cbd5e1', padding: '30px', borderRadius: '12px', textAlign: 'center', backgroundColor: '#f8fafc', marginBottom: '20px' }}
                >
                  <Upload size={36} color="#2563eb" style={{ marginBottom: '10px' }} />
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#475569' }}>Arrastra tu expediente en PDF aquí o</p>
                  <input type="file" accept=".pdf" multiple onChange={handleSingleFileChange} id="single-file" style={{ display: 'none' }} />
                  <label htmlFor="single-file" style={{ backgroundColor: '#2563eb', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                    Buscar Archivos
                  </label>
                  {singleFiles.length > 0 && (
                    <div style={{ marginTop: '15px', fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>
                      {singleFiles.length} archivo(s) seleccionado(s)
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleUploadSingle} 
                  disabled={singleFiles.length === 0 || loading}
                  className="btn-primary"
                  style={{ opacity: singleFiles.length === 0 || loading ? 0.6 : 1 }}
                >
                  {loading ? 'Procesando Expediente...' : 'Procesar Expediente'}
                </button>

                {/* Formulario con Campos Extraídos */}
                {datos && (
                  <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '15px' }}>Datos Extraídos del Expediente</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                      {Object.keys(datos).map((key) => (
                        <div key={key} className="form-group">
                          <label className="form-label">{formatLabel(key)}</label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              disabled={!unlockedFields[key]}
                              value={datos[key] || ''}
                              onChange={(e) => handleInputChange(key, e.target.value)}
                              style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: unlockedFields[key] ? '#fff' : '#f1f5f9'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRequestUnlock(key)}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                background: unlockedFields[key] ? '#dcfce7' : '#fff',
                                cursor: 'pointer'
                              }}
                            >
                              {unlockedFields[key] ? <Unlock size={16} color="#16a34a" /> : <Lock size={16} color="#64748b" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleDownloadWord(expedienteId, datos)}
                      className="btn-primary"
                      style={{ marginTop: '20px', backgroundColor: '#16a34a' }}
                    >
                      <Download size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Descargar Documento Word
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Carga Masiva */}
            {activeTab === 'batch' && (
              <div className="fade-in">
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDropBatch}
                  style={{ border: '2px dashed #cbd5e1', padding: '30px', borderRadius: '12px', textAlign: 'center', backgroundColor: '#f8fafc', marginBottom: '20px' }}
                >
                  <FolderPlus size={36} color="#2563eb" style={{ marginBottom: '10px' }} />
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#475569' }}>Arrastra múltiples archivos o carpetas PDF aquí</p>
                  <input type="file" accept=".pdf" multiple onChange={handleBatchFileChange} id="batch-file" style={{ display: 'none' }} />
                  <label htmlFor="batch-file" style={{ backgroundColor: '#2563eb', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                    Seleccionar Archivos
                  </label>
                  {batchFiles.length > 0 && (
                    <div style={{ marginTop: '15px', fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>
                      {batchFiles.length} archivos preparados para procesamiento
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleUploadBatch} 
                  disabled={batchFiles.length === 0 || batchLoading}
                  className="btn-primary"
                  style={{ opacity: batchFiles.length === 0 || batchLoading ? 0.6 : 1 }}
                >
                  {batchLoading ? 'Procesando Lote...' : 'Procesar Lote Completo'}
                </button>

                {batchResults.length > 0 && (
                  <div style={{ marginTop: '25px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Resultados del Lote</h3>
                      <button onClick={handleDownloadZip} style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Download size={16} /> Descargar Todo (ZIP)
                      </button>
                    </div>
                    {batchResults.map((item, idx) => (
                      <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden' }}>
                        <div 
                          onClick={() => toggleAccordion(idx)}
                          style={{ padding: '14px 18px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        >
                          <span style={{ fontWeight: '600', fontSize: '14px' }}>
                            Expediente: {item.datos_extraidos?.acreditado || `Item ${idx + 1}`}
                          </span>
                          {openAccordion[idx] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                        {openAccordion[idx] && (
                          <div style={{ padding: '18px', backgroundColor: '#fff', borderTop: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                              {Object.keys(item.datos_extraidos || {}).map((k) => (
                                <div key={k}>
                                  <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>{formatLabel(k)}</label>
                                  <input 
                                    type="text" 
                                    value={item.datos_extraidos[k] || ''} 
                                    onChange={(e) => handleBatchInputChange(idx, k, e.target.value)}
                                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                                  />
                                </div>
                              ))}
                            </div>
                            <button 
                              onClick={() => handleDownloadWord(item.expediente_id, item.datos_extraidos)}
                              style={{ marginTop: '12px', backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                            >
                              Descargar Word
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Historial */}
            {activeTab === 'history' && (
              <div className="fade-in">
                <div className="input-icon-wrapper" style={{ marginBottom: '20px' }}>
                  <Search size={18} color="#94a3b8" />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Buscar por acreditado o número de crédito..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '12px' }}>Acreditado</th>
                        <th style={{ padding: '12px' }}>Crédito</th>
                        <th style={{ padding: '12px' }}>Fecha</th>
                        <th style={{ padding: '12px' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistorial.map((h, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px' }}>{h.datos_extraidos?.acreditado || 'N/A'}</td>
                          <td style={{ padding: '12px' }}>{h.datos_extraidos?.numero_credito || h.numero_credito || 'N/A'}</td>
                          <td style={{ padding: '12px' }}>{h.fecha_creacion ? new Date(h.fecha_creacion).toLocaleDateString() : 'N/A'}</td>
                          <td style={{ padding: '12px' }}>
                            <button 
                              onClick={() => handleDownloadWord(h.expediente_id, h.datos_extraidos)}
                              style={{ border: 'none', background: 'transparent', color: '#2563eb', cursor: 'pointer', fontWeight: '600' }}
                            >
                              Descargar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Administración de Usuarios (solo Admin) */}
            {activeTab === 'users' && esAdmin && (
              <div className="fade-in">
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '15px' }}>Gestión de Usuarios</h3>
                <form onSubmit={handleCrearUsuario} style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    placeholder="Nuevo Usuario" 
                    value={nuevoUsuario.username} 
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, username: e.target.value })}
                    required
                    style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', flex: 1 }}
                  />
                  <input 
                    type="password" 
                    placeholder="Contraseña" 
                    value={nuevoUsuario.password} 
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
                    required
                    style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', flex: 1 }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <input 
                      type="checkbox" 
                      checked={nuevoUsuario.es_admin} 
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, es_admin: e.target.checked })}
                    />
                    Es Admin
                  </label>
                  <button type="submit" style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                    Crear Usuario
                  </button>
                </form>

                <div>
                  {usuariosLista.map((u) => (
                    <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
                      <span><b>{u.username}</b> ({u.es_admin ? 'Admin' : 'Operador'})</span>
                      <button onClick={() => handleEliminarUsuario(u.id)} style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer' }}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Configuración de Plantillas (solo Admin) */}
            {activeTab === 'templates' && esAdmin && (
              <div className="fade-in">
                <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '15px' }}>Plantilla de Notario</h3>
                <form onSubmit={handleSubirPlantilla} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input 
                    type="file" 
                    accept=".docx" 
                    onChange={(e) => setArchivoPlantilla(e.target.files[0])}
                    style={{ fontSize: '14px' }}
                  />
                  <button type="submit" style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                    Subir Nueva Plantilla
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}