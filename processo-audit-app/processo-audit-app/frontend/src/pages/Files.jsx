import React, { useState, useEffect } from 'react';
import { fileAPI } from '../api/index';
import styles from './Files.module.css';
import { FiFolder, FiFile, FiPlus, FiUpload, FiArrowLeft, FiTrash2, FiDownload, FiEdit2, FiMoreVertical } from 'react-icons/fi';

const Files = () => {
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderHistory, setFolderHistory] = useState([]);
  const [contents, setContents] = useState({ folders: [], files: [], currentFolder: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadContents();
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
    if (!window.confirm(`Tem certeza que deseja excluir a pasta "${name}" e todo seu conteúdo?`)) return;
    try {
      await fileAPI.deleteFolder(id);
      loadContents();
    } catch (err) {
      setError('Erro ao excluir pasta: ' + err.message);
    }
  };

  const handleDeleteFile = async (id, name) => {
    if (!window.confirm(`Tem certeza que deseja excluir o arquivo "${name}"?`)) return;
    try {
      await fileAPI.deleteFile(id);
      loadContents();
    } catch (err) {
      setError('Erro ao excluir arquivo: ' + err.message);
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

  const getFullUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return path;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          {currentFolderId && (
            <button onClick={goBack} className={styles.backBtn} title="Voltar">
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
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className="spinner-container"><div className="spinner" /></div>
      ) : (
        <div className={styles.grid}>
          {contents.folders.length === 0 && contents.files.length === 0 && (
            <div className={styles.empty}>
              <FiFolder size={48} />
              <p>Esta pasta está vazia.</p>
            </div>
          )}

          {contents.folders.map(folder => (
            <div key={`folder-${folder.id}`} className={styles.item} onClick={() => navigateToFolder(folder)}>
              <div className={styles.itemIcon}>
                <FiFolder className={styles.folderIcon} />
              </div>
              <div className={styles.itemInfo}>
                <span className={styles.itemName}>{folder.name}</span>
                <span className={styles.itemMeta}>Pasta • Criada por {folder.user_name}</span>
              </div>
              <div className={styles.itemActions}>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDownloadFolder(folder.id, folder.name); }}
                  className={styles.downloadBtn}
                  title="Baixar Pasta (ZIP)"
                >
                  <FiDownload />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder.id, folder.name); }}
                  className={styles.editBtn}
                  title="Renomear"
                >
                  <FiEdit2 />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id, folder.name); }}
                  className={styles.deleteBtn}
                  title="Excluir"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}

          {contents.files.map(file => (
            <div key={`file-${file.id}`} className={styles.item}>
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
                <a 
                  href={getFullUrl(file.file_path)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={styles.downloadBtn}
                  title="Baixar / Abrir"
                >
                  <FiDownload />
                </a>
                <button 
                  onClick={() => handleDeleteFile(file.id, file.name)}
                  className={styles.deleteBtn}
                  title="Excluir"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Files;
