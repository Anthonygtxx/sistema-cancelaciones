import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Upload, FileText, Download, CheckCircle, AlertCircle, History, 
  Search, FolderPlus, Lock, Unlock, KeyRound, 
  LogOut, User, Loader2, ChevronDown, ChevronUp, Users, Settings, 
  Plus, Trash2, Check, Calendar, Clock, DollarSign
} from 'lucide-react';

// Configuración producción / Railway
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
    <div style={{
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      backgroundColor: '#f8fafc',
      color: '#1e293b',
      minHeight: '100vh',
      margin: 0,
      padding: 0,
      boxSizing: 'border-box'
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
          background: #f1f5f9;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      {isCheckingAuth ? (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
          <div style={{ textAlign: 'center' }}>
            <Loader2 className="animate-spin" size={48} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      ) : !isAuthenticated ? (
        <div className="fade-in" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)' }}>
          <div style={{ maxWidth: '420px', width: '100%', backgroundColor: '#ffffff', padding: '40px 32px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' }}>
            {isLoggingIn ? (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <Loader2 size={48} color="#2563eb" style={{ margin: '0 auto 20px auto', display: 'block', animation: 'spin 1s linear infinite' }} />
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
                  <div style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertCircle size={18} />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Usuario</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0 14px', backgroundColor: '#fff' }}>
                      <User size={18} color="#94a3b8" />
                      <input
                        type="text"
                        value={loginUser}
                        onChange={(e) => setLoginUser(e.target.value)}
                        required
                        style={{ width: '100%', padding: '12px 10px', border: 'none', outline: 'none', fontSize: '14px', backgroundColor: 'transparent' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '28px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Contraseña</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0 14px', backgroundColor: '#fff' }}>
                      <KeyRound size={18} color="#94a3b8" />
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                        style={{ width: '100%', padding: '12px 10px', border: 'none', outline: 'none', fontSize: '14px', backgroundColor: 'transparent' }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    style={{ width: '100%', backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: '600', fontSize: '15px', cursor: 'pointer' }}
                  >
                    Ingresar a mi Perfil
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '32px', borderRadius: '16px', boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' }}>
            
            {/* Encabezado */}
            <header style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '24px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ color: '#0f172a', margin: '0 0 6px 0', fontSize: '26px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center' }}>
                    <FileText color="#2563eb" size={26} />
                  </div> 
                  Sistema de Cancelación de Hipotecas
                </h1>
                <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
                  Gestión individualizada de expedientes notariales
                </p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#f8fafc', padding: '6px 14px 6px 6px', borderRadius: '40px', border: '1px solid #e2e8f0' }}>
                  <div style={{ backgroundColor: '#2563eb', color: '#fff', width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '15px' }}>
                    {currentUser?.username?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ textAlign: 'left', paddingRight: '4px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{currentUser?.username}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>{currentUser?.role || (currentUser?.es_admin ? 'admin' : 'operador')}</div>
                  </div>
                </div>

                <button
                  onClick={() => setShowLogoutModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fff1f2', color: '#dc2626', border: '1px solid #fecdd3', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                >
                  <LogOut size={16} /> Salir
                </button>
              </div>
            </header>

            {/* MODAL CERRAR SESIÓN */}
            {showLogoutModal && (
              <div className="fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
                <div style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '16px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', border: '1px solid #e2e8f0' }}>
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
              <div className="fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}>
                <div style={{ backgroundColor: '#fff', padding: '32px', borderRadius: '16px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', border: '1px solid #e2e8f0' }}>
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
                    <div style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', padding: '10px 12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <div style={{ display: 'flex', gap: '10px', marginBottom: '28px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveTab('single')}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: activeTab === 'single' ? '#2563eb' : '#f1f5f9',
                  color: activeTab === 'single' ? '#fff' : '#475569',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FileText size={18} /> Caso Individual
              </button>

              <button
                onClick={() => setActiveTab('batch')}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: activeTab === 'batch' ? '#2563eb' : '#f1f5f9',
                  color: activeTab === 'batch' ? '#fff' : '#475569',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FolderPlus size={18} /> Carga Masiva
              </button>

              <button
                onClick={() => setActiveTab('history')}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: activeTab === 'history' ? '#2563eb' : '#f1f5f9',
                  color: activeTab === 'history' ? '#fff' : '#475569',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <History size={18} /> Mi Historial ({currentUser?.username})
              </button>

              {esAdmin && (
                <>
                  <button
                    onClick={() => setActiveTab('users')}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: activeTab === 'users' ? '#2563eb' : '#f1f5f9',
                      color: activeTab === 'users' ? '#fff' : '#475569',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Users size={18} /> Usuarios
                  </button>

                  <button
                    onClick={() => setActiveTab('templates')}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: activeTab === 'templates' ? '#2563eb' : '#f1f5f9',
                      color: activeTab === 'templates' ? '#fff' : '#475569',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <Settings size={18} /> Plantillas
                  </button>
                </>
              )}
            </div>

            {/* MENSAJE DE ERROR GLOBAL */}
            {error && (
              <div style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', padding: '14px 18px', borderRadius: '10px', marginBottom: '24px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            {/* TAB: CASO INDIVIDUAL */}
            {activeTab === 'single' && (
              <div className="fade-in">
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDropSingle}
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '16px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                    marginBottom: '24px'
                  }}
                  onClick={() => document.getElementById('single-file-input').click()}
                >
                  <input
                    type="file"
                    id="single-file-input"
                    multiple
                    accept=".pdf"
                    style={{ display: 'none' }}
                    onChange={handleSingleFileChange}
                  />
                  <Upload size={40} color="#2563eb" style={{ margin: '0 auto 12px auto' }} />
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                    Arrastra aquí los archivos PDF de tu expediente
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    O haz clic para explorar en tu equipo
                  </p>
                  {singleFiles.length > 0 && (
                    <div style={{ marginTop: '16px', display: 'inline-block', backgroundColor: '#eff6ff', color: '#2563eb', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                      {singleFiles.length} archivo(s) seleccionado(s)
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', marginBottom: '32px' }}>
                  <button
                    onClick={handleUploadSingle}
                    disabled={singleFiles.length === 0 || loading}
                    style={{
                      backgroundColor: singleFiles.length === 0 || loading ? '#94a3b8' : '#2563eb',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '10px',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: singleFiles.length === 0 || loading ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                    Procesar Documentos
                  </button>
                </div>

                {loading && (
                  <div style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                      <span>Procesando expediente...</span>
                      <span>{progressSingle}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${progressSingle}%`, height: '100%', backgroundColor: '#2563eb', transition: 'width 0.2s' }} />
                    </div>
                  </div>
                )}

                {datos && (
                  <div className="fade-in" style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Datos Extraídos del Expediente</h3>
                      <button
                        onClick={() => handleDownloadWord(expedienteId, datos)}
                        style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <Download size={16} /> Descargar Cancelación (.docx)
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                      {Object.keys(datos).map((key) => {
                        const isUnlocked = unlockedFields[`single_${key}`];
                        return (
                          <div key={key} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', backgroundColor: isUnlocked ? '#fff' : '#f8fafc' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>{formatLabel(key)}</label>
                              <button
                                type="button"
                                onClick={() => handleRequestUnlock(`single_${key}`)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isUnlocked ? '#16a34a' : '#94a3b8', padding: '2px' }}
                                title={isUnlocked ? 'Bloquear campo' : 'Solicitar desbloqueo'}
                              >
                                {isUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
                              </button>
                            </div>
                            <input
                              type="text"
                              value={datos[key] || ''}
                              disabled={!isUnlocked}
                              onChange={(e) => handleInputChange(key, e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px 10px',
                                border: '1px solid',
                                borderColor: isUnlocked ? '#2563eb' : '#cbd5e1',
                                borderRadius: '6px',
                                fontSize: '13px',
                                color: '#0f172a',
                                backgroundColor: isUnlocked ? '#ffffff' : '#f1f5f9',
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

            {/* TAB: CARGA MASIVA */}
            {activeTab === 'batch' && (
              <div className="fade-in">
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDropBatch}
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: '16px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                    marginBottom: '24px'
                  }}
                  onClick={() => document.getElementById('batch-file-input').click()}
                >
                  <input
                    type="file"
                    id="batch-file-input"
                    multiple
                    accept=".pdf"
                    style={{ display: 'none' }}
                    onChange={handleBatchFileChange}
                  />
                  <FolderPlus size={40} color="#2563eb" style={{ margin: '0 auto 12px auto' }} />
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                    Arrastra carpetas o múltiples archivos PDF
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    Se procesarán múltiples expedientes en lote de forma automática
                  </p>
                  {batchFiles.length > 0 && (
                    <div style={{ marginTop: '16px', display: 'inline-block', backgroundColor: '#eff6ff', color: '#2563eb', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                      {batchFiles.length} archivo(s) lote cargado(s)
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', marginBottom: '32px' }}>
                  <button
                    onClick={handleUploadBatch}
                    disabled={batchFiles.length === 0 || batchLoading}
                    style={{
                      backgroundColor: batchFiles.length === 0 || batchLoading ? '#94a3b8' : '#2563eb',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '10px',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: batchFiles.length === 0 || batchLoading ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {batchLoading ? <Loader2 className="animate-spin" size={18} /> : <FolderPlus size={18} />}
                    Procesar Lote Masivo
                  </button>
                </div>

                {batchLoading && (
                  <div style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                      <span>Procesando paquete de expedientes...</span>
                      <span>{progressBatch}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${progressBatch}%`, height: '100%', backgroundColor: '#2563eb', transition: 'width 0.2s' }} />
                    </div>
                  </div>
                )}

                {batchResults.length > 0 && (
                  <div className="fade-in">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                        Resultados del Lote ({batchResults.length})
                      </h3>
                      <button
                        onClick={handleDownloadZip}
                        style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        <Download size={16} /> Descargar Todo (.ZIP)
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {batchResults.map((item, idx) => {
                        const isOpen = !!openAccordion[idx];
                        const datosItem = item.datos_extraidos || {};
                        return (
                          <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff' }}>
                            <div
                              onClick={() => toggleAccordion(idx)}
                              style={{ padding: '16px 20px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <CheckCircle size={20} color="#16a34a" />
                                <div>
                                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>
                                    {datosItem.acreditado || datosItem.nombre_acreditado || `Expediente ${idx + 1}`}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                                    Crédito: {datosItem.numero_credito || 'N/A'}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadWord(item.expediente_id, datosItem);
                                  }}
                                  style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                                >
                                  DOCX
                                </button>
                                {isOpen ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
                              </div>
                            </div>

                            {isOpen && (
                              <div style={{ padding: '20px', borderTop: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
                                  {Object.keys(datosItem).map((key) => {
                                    const isUnlocked = unlockedFields[`batch_${idx}_${key}`];
                                    return (
                                      <div key={key} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', backgroundColor: isUnlocked ? '#fff' : '#f8fafc' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                          <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>{formatLabel(key)}</label>
                                          <button
                                            type="button"
                                            onClick={() => handleRequestUnlock(`batch_${idx}_${key}`)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isUnlocked ? '#16a34a' : '#94a3b8', padding: '2px' }}
                                          >
                                            {isUnlocked ? <Unlock size={12} /> : <Lock size={12} />}
                                          </button>
                                        </div>
                                        <input
                                          type="text"
                                          value={datosItem[key] || ''}
                                          disabled={!isUnlocked}
                                          onChange={(e) => handleBatchInputChange(idx, key, e.target.value)}
                                          style={{
                                            width: '100%',
                                            padding: '6px 8px',
                                            border: '1px solid',
                                            borderColor: isUnlocked ? '#2563eb' : '#cbd5e1',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            color: '#0f172a',
                                            backgroundColor: isUnlocked ? '#ffffff' : '#f1f5f9',
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
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: HISTORIAL */}
            {activeTab === 'history' && (
              <div className="fade-in">
                <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0 14px', backgroundColor: '#fff', maxWidth: '400px' }}>
                  <Search size={18} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="Buscar por acreditado o número de crédito..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: 'none', outline: 'none', fontSize: '14px', backgroundColor: 'transparent' }}
                  />
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569' }}>Fecha</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569' }}>Acreditado</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569' }}>Crédito</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistorial.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                            No se encontraron registros asociados al usuario.
                          </td>
                        </tr>
                      ) : (
                        filteredHistorial.map((row) => (
                          <tr key={row.id || row.expediente_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '13px' }}>
                              {row.fecha_creacion ? new Date(row.fecha_creacion).toLocaleDateString() : 'N/A'}
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                              {row.datos_extraidos?.acreditado || row.datos_extraidos?.nombre_acreditado || 'Sin nombre'}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#475569' }}>
                              {row.datos_extraidos?.numero_credito || row.numero_credito || 'N/A'}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <button
                                onClick={() => handleDownloadWord(row.id || row.expediente_id, row.datos_extraidos)}
                                style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Download size={14} /> Descargar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: ADMINISTRACIÓN DE USUARIOS */}
            {activeTab === 'users' && esAdmin && (
              <div className="fade-in">
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={18} color="#2563eb" /> Registrar Nuevo Usuario
                  </h3>
                  <form onSubmit={handleCrearUsuario} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Nombre de usuario"
                      value={nuevoUsuario.username}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, username: e.target.value })}
                      required
                      style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', flex: '1', minWidth: '180px' }}
                    />
                    <input
                      type="password"
                      placeholder="Contraseña"
                      value={nuevoUsuario.password}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
                      required
                      style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', flex: '1', minWidth: '180px' }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={nuevoUsuario.es_admin}
                        onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, es_admin: e.target.checked })}
                      />
                      Permisos de Admin
                    </label>
                    <button
                      type="submit"
                      style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
                    >
                      Guardar
                    </button>
                  </form>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569' }}>Usuario</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569' }}>Rol</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingUsuarios ? (
                        <tr>
                          <td colSpan={3} style={{ padding: '24px', textAlign: 'center' }}>
                            <Loader2 className="animate-spin" size={24} color="#2563eb" style={{ margin: '0 auto' }} />
                          </td>
                        </tr>
                      ) : usuariosLista.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                            No existen usuarios registrados.
                          </td>
                        </tr>
                      ) : (
                        usuariosLista.map((u) => (
                          <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>{u.username}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ backgroundColor: u.es_admin ? '#fef3c7' : '#f1f5f9', color: u.es_admin ? '#b45309' : '#475569', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                                {u.es_admin ? 'Administrador' : 'Operador'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <button
                                onClick={() => handleEliminarUsuario(u.id)}
                                style={{ backgroundColor: '#fff1f2', color: '#dc2626', border: '1px solid #fecdd3', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Trash2 size={14} /> Eliminar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: PLANTILLAS NOTARIALES */}
            {activeTab === 'templates' && esAdmin && (
              <div className="fade-in">
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Upload size={18} color="#2563eb" /> Actualizar Plantilla Notarial Base (.docx)
                  </h3>
                  <form onSubmit={handleSubirPlantilla} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      accept=".docx"
                      onChange={(e) => setArchivoPlantilla(e.target.files[0])}
                      required
                      style={{ fontSize: '14px' }}
                    />
                    <button
                      type="submit"
                      disabled={!archivoPlantilla}
                      style={{ backgroundColor: !archivoPlantilla ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: !archivoPlantilla ? 'not-allowed' : 'pointer' }}
                    >
                      Cargar Plantilla
                    </button>
                  </form>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', backgroundColor: '#fff' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '15px', fontWeight: '700' }}>Plantillas Activas</h4>
                  {plantillas.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>No hay plantillas configuradas actualmente en el servidor.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#334155', fontSize: '14px' }}>
                      {plantillas.map((p, idx) => (
                        <li key={idx} style={{ marginBottom: '6px' }}>
                          {p.nombre || p.filename || `Plantilla Base ${idx + 1}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}