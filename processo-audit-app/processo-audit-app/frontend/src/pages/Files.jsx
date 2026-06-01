import React, { useState, useEffect } from 'react';
import { fileAPI } from '../api/index';
import styles from './Files.module.css';
import { FiFolder, FiFile, FiPlus, FiUpload, FiArrowLeft, FiTrash2, FiDownload, FiEdit2, FiMoreVertical, FiCopy, FiScissors, FiClipboard } from 'react-icons/fi';

const Files = () => {
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderHistory, setFolderHistory] = useState([]);
  const [contents, setContents] = useState({ folders: [], files: [], currentFolder: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [clipboard, setClipboard] = useState(null); // { type, id, action: 'copy' | 'cut', name }
  const [activeMenu, setActiveMenu] = useState(null); // { type: 'folder' | 'file', id }
  const [draggedItem, setDraggedItem] = useState(null); // { type, id }
  const [dropTargetId, setDropTargetId] = useState(null);

  useEffect(() => {
    loadContents();
    
    // Close menu when clicking outside
    const handleClickOutside = () => setActiveMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [currentFolderId]);

  const loadContents = async () => {
    try {
      setLoading(true);
      const data = await fileAPI.list(currentFolderId);
      setContents(data);
    } catch (err) {
      setError('Erro ao carregar arquivos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    const name = prompt('Nome da nova pasta:');
    if (!name) return;
    try {
      await fileAPI.createFolder(name, currentFolderId);
      loadContents();
    } catch (err) {
      setError('Erro ao criar pasta: ' + err.message);
    }
  };

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    formData.append('folder_id', currentFolderId || '');

    try {
      setUploading(true);
      await fileAPI.upload(formData);
      loadContents();
    } catch (err) {
      setError('Erro ao subir arquivos: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadFolder = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
      // webkitRelativePath contains the path starting with the folder name
      formData.append('paths', files[i].webkitRelativePath);
    }
    formData.append('folder_id', currentFolderId || '');

    try {
      setUploading(true);
      await fileAPI.upload(formData);
      loadContents();
    } catch (err) {
      setError('Erro ao subir pasta: ' + err.message);
    } finally {
      setUploading(false);
      // Clear input
      e.target.value = null;
    }
  };

  const handleDeleteFolder = async (id, name) => {
    if (!window.confirm(`Tem certeza que deseja inativar a pasta "${name}"?`)) return;
    try {
      await fileAPI.deleteFolder(id);
      loadContents();
    } catch (err) {
      setError('Erro ao inativar pasta: ' + err.message);
    }
  };

  const handleDeleteFile = async (id, name) => {
    if (!window.confirm(`Tem certeza que deseja inativar o arquivo "${name}"?`)) return;
    try {
      await fileAPI.deleteFile(id);
      loadContents();
    } catch (err) {
      setError('Erro ao inativar arquivo: ' + err.message);
    }
  };

  const handleRenameFolder = async (id, currentName) => {
    const newName = prompt('Novo nome da pasta:', currentName);
    if (!newName || newName === currentName) return;
    try {
      await fileAPI.renameFolder(id, newName);
      loadContents();
    } catch (err) {
      setError('Erro ao renomear pasta: ' + err.message);
    }
  };

  const handleRenameFile = async (id, currentName) => {
    const newName = prompt('Novo nome do arquivo:', currentName);
    if (!newName || newName === currentName) return;
    try {
      await fileAPI.renameFile(id, newName);
      loadContents();
    } catch (err) {
      setError('Erro ao renomear arquivo: ' + err.message);
    }
  };

  const handleDragStart = (e, type, id) => {
    setDraggedItem({ type, id });
    e.dataTransfer.setData('text/plain', id); // Required for some browsers
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, folderId) => {
    e.preventDefault();
    if (draggedItem && (draggedItem.type !== 'folder' || draggedItem.id !== folderId)) {
      setDropTargetId(folderId);
    }
  };

  const handleDragLeave = () => {
    setDropTargetId(null);
  };

  const handleDrop = async (e, targetFolderId) => {
    e.preventDefault();
    setDropTargetId(null);
    
    // Check if it's an external file drop (upload)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = e.dataTransfer.files;
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      formData.append('folder_id', targetFolderId === 'back' ? (folderHistory[folderHistory.length - 1]?.id || '') : (targetFolderId || currentFolderId || ''));

      try {
        setUploading(true);
        await fileAPI.upload(formData);
        loadContents();
      } catch (err) {
        setError('Erro ao subir arquivos: ' + err.message);
      } finally {
        setUploading(false);
      }
      return;
    }

    if (!draggedItem) return;
    
    // Prevent dropping a folder into itself
    if (draggedItem.type === 'folder' && draggedItem.id === targetFolderId) return;

    try {
      await fileAPI.move(draggedItem.type, draggedItem.id, targetFolderId);
      loadContents();
    } catch (err) {
      setError('Erro ao mover item: ' + err.message);
    } finally {
      setDraggedItem(null);
    }
  };

  const handleCopy = (type, id, name) => {
    setClipboard({ type, id, action: 'copy', name });
  };

  const handleCut = (type, id, name) => {
    setClipboard({ type, id, action: 'cut', name });
  };

  const handlePaste = async () => {
    if (!clipboard) return;
    try {
      if (clipboard.action === 'copy') {
        await fileAPI.copy(clipboard.type, clipboard.id, currentFolderId);
      } else {
        await fileAPI.move(clipboard.type, clipboard.id, currentFolderId);
      }
      setClipboard(null);
      loadContents();
    } catch (err) {
      setError('Erro ao colar: ' + err.message);
    }
  };

  const handleDownloadFolder = async (id, name) => {
    try {
      const blob = await fileAPI.downloadFolder(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Erro ao baixar pasta: ' + err.message);
    }
  };

  const handleDownloadFile = async (id, name) => {
    try {
      const blob = await fileAPI.downloadFile(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Erro ao baixar arquivo: ' + err.message);
    }
  };

  const navigateToFolder = (folder) => {
    setFolderHistory([...folderHistory, contents.currentFolder]);
    setCurrentFolderId(folder.id);
  };

  const goBack = () => {
    const newHistory = [...folderHistory];
    const prevFolder = newHistory.pop();
    setFolderHistory(newHistory);
    setCurrentFolderId(prevFolder ? prevFolder.id : null);
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          {currentFolderId && (
            <button 
              onClick={goBack} 
              className={`${styles.backBtn} ${dropTargetId === 'back' ? styles.dropTargetBack : ''}`} 
              title="Voltar"
              onDragOver={(e) => handleDragOver(e, 'back')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                const prevFolder = folderHistory[folderHistory.length - 1];
                handleDrop(e, prevFolder ? prevFolder.id : null);
              }}
            >
              <FiArrowLeft />
            </button>
          )}
          <div>
            <h1>{contents.currentFolder ? contents.currentFolder.name : 'Arquivos'}</h1>
            <p className={styles.breadcrumb}>
              Raiz {folderHistory.map(f => f ? ` / ${f.name}` : '').join('')} 
              {contents.currentFolder ? ` / ${contents.currentFolder.name}` : ''}
            </p>
          </div>
        </div>

        <div className={styles.actions}>
          {currentFolderId && (
            <button 
              className="btn btn-secondary" 
              onClick={() => handleDownloadFolder(currentFolderId, contents.currentFolder.name)}
              title="Baixar esta pasta atual como ZIP"
            >
              <FiDownload /> Baixar Tudo
            </button>
          )}
          <label className={`btn btn-primary ${styles.uploadLabel} ${uploading ? styles.disabled : ''}`}>
            <FiUpload /> {uploading ? 'Subindo...' : 'Enviar Arquivos'}
            <input 
              type="file" 
              multiple 
              onChange={handleUpload} 
              hidden 
              disabled={uploading}
            />
          </label>
          <label className={`btn btn-secondary ${styles.uploadLabel} ${uploading ? styles.disabled : ''}`}>
            <FiFolder /> {uploading ? 'Subindo...' : 'Enviar Pasta'}
            <input 
              type="file" 
              webkitdirectory="" 
              directory=""
              onChange={handleUploadFolder} 
              hidden 
              disabled={uploading}
            />
          </label>
          <button className="btn btn-secondary" onClick={handleCreateFolder}>
            <FiPlus /> Nova Pasta
          </button>
          {clipboard && (
            <button className="btn btn-primary" onClick={handlePaste} title={`Colar ${clipboard.name}`}>
              <FiClipboard /> Colar
            </button>
          )}
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {clipboard && (
        <div className={styles.clipboardInfo}>
          <span>{clipboard.action === 'copy' ? 'Copiando' : 'Recortando'}: <strong>{clipboard.name}</strong></span>
          <button onClick={() => setClipboard(null)} className="btn btn-link btn-sm">Cancelar</button>
        </div>
      )}

      {loading ? (
        <div className="spinner-container"><div className="spinner" /></div>
      ) : (
        <div 
          className={`${styles.grid} ${dropTargetId === 'current' ? styles.gridDropTarget : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            if (e.dataTransfer.types.includes('Files')) {
              setDropTargetId('current');
            }
          }}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, currentFolderId)}
        >
          {contents.folders.length === 0 && contents.files.length === 0 && (
            <div className={styles.empty}>
              <FiFolder size={48} />
              <p>Esta pasta está vazia.</p>
            </div>
          )}

          {contents.folders.map(folder => (
            <div 
              key={`folder-${folder.id}`} 
              className={`${styles.item} ${dropTargetId === folder.id ? styles.dropTarget : ''}`} 
              onClick={() => navigateToFolder(folder)}
              draggable
              onDragStart={(e) => handleDragStart(e, 'folder', folder.id)}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder.id)}
            >
              <div className={styles.itemIcon}>
                <FiFolder className={styles.folderIcon} />
              </div>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{folder.name}</span>
                <span className={styles.itemMeta}>Pasta • Criada por {folder.user_name}</span>
              </div>
              <div className={styles.itemActions} onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={() => handleDownloadFolder(folder.id, folder.name)}
                  className={styles.downloadBtn}
                  title="Baixar Pasta (ZIP)"
                >
                  <FiDownload />
                </button>
                
                <div className={styles.dropdownContainer}>
                  <button 
                    onClick={() => setActiveMenu(activeMenu?.id === folder.id ? null : { type: 'folder', id: folder.id })}
                    className={styles.moreBtn}
                    title="Mais ações"
                  >
                    <FiMoreVertical />
                  </button>
                  
                  {activeMenu?.type === 'folder' && activeMenu?.id === folder.id && (
                    <div className={styles.dropdownMenu}>
                      <button onClick={() => { handleCopy('folder', folder.id, folder.name); setActiveMenu(null); }}>
                        <FiCopy /> Copiar
                      </button>
                      <button onClick={() => { handleCut('folder', folder.id, folder.name); setActiveMenu(null); }}>
                        <FiScissors /> Recortar
                      </button>
                      <button onClick={() => { handleRenameFolder(folder.id, folder.name); setActiveMenu(null); }}>
                        <FiEdit2 /> Renomear
                      </button>
                      <button onClick={() => { handleDeleteFolder(folder.id, folder.name); setActiveMenu(null); }} className={styles.deleteOption}>
                        <FiTrash2 /> Inativar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {contents.files.map(file => (
            <div 
              key={`file-${file.id}`} 
              className={styles.item}
              draggable
              onDragStart={(e) => handleDragStart(e, 'file', file.id)}
            >
              <div className={styles.itemIcon}>
                <FiFile className={styles.fileIcon} />
              </div>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{file.name}</span>
                <span className={styles.itemMeta}>
                  {formatSize(file.file_size)} • {file.file_type} • Por {file.user_name}
                </span>
              </div>
              <div className={styles.itemActions}>
                <button 
                  onClick={() => handleDownloadFile(file.id, file.name)}
                  className={styles.downloadBtn}
                  title="Baixar"
                >
                  <FiDownload />
                </button>

                <div className={styles.dropdownContainer}>
                  <button 
                    onClick={() => setActiveMenu(activeMenu?.id === file.id ? null : { type: 'file', id: file.id })}
                    className={styles.moreBtn}
                    title="Mais ações"
                  >
                    <FiMoreVertical />
                  </button>
                  
                  {activeMenu?.type === 'file' && activeMenu?.id === file.id && (
                    <div className={styles.dropdownMenu}>
                      <button onClick={() => { handleCopy('file', file.id, file.name); setActiveMenu(null); }}>
                        <FiCopy /> Copiar
                      </button>
                      <button onClick={() => { handleCut('file', file.id, file.name); setActiveMenu(null); }}>
                        <FiScissors /> Recortar
                      </button>
                      <button onClick={() => { handleRenameFile(file.id, file.name); setActiveMenu(null); }}>
                        <FiEdit2 /> Renomear
                      </button>
                      <button onClick={() => { handleDeleteFile(file.id, file.name); setActiveMenu(null); }} className={styles.deleteOption}>
                        <FiTrash2 /> Inativar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Files;
