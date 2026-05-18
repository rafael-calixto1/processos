import express from 'express';
import pool from '../config/database.js';
import { verifyToken } from '../middlewares/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';

const router = express.Router();

// Ensure upload directory exists
const uploadDir = 'uploads/archives/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Get folders and files
router.get(['/files', '/file'], verifyToken, async (req, res) => {
  try {
    const { folder_id } = req.query;
    const parentId = !folder_id || folder_id === 'null' ? null : folder_id;

    // Get folders
    const [folders] = await pool.execute(
      `SELECT f.*, u.name as user_name 
       FROM folders f 
       JOIN users u ON f.user_id = u.id 
       WHERE f.parent_id ${parentId ? '= ?' : 'IS NULL'} 
       ORDER BY f.name`,
      parentId ? [parentId] : []
    );

    // Get files
    const [files] = await pool.execute(
      `SELECT f.*, u.name as user_name 
       FROM files f 
       JOIN users u ON f.user_id = u.id 
       WHERE f.folder_id ${parentId ? '= ?' : 'IS NULL'} 
       ORDER BY f.name`,
      parentId ? [parentId] : []
    );

    // Get current folder info if not root
    let currentFolder = null;
    if (parentId) {
      const [f] = await pool.execute('SELECT * FROM folders WHERE id = ?', [parentId]);
      currentFolder = f[0];
    }

    res.json({ folders, files, currentFolder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download single file (Moved up for priority)
router.get(['/files/:id/download', '/file/:id/download'], verifyToken, async (req, res) => {
  try {
    const [file] = await pool.execute('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (file.length === 0) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    const f = file[0];
    // file_path starts with /uploads/archives/
    const relativePath = f.file_path.startsWith('/') ? f.file_path.substring(1) : f.file_path;
    const filePath = path.join(process.cwd(), relativePath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo físico não encontrado' });
    }

    res.download(filePath, f.name);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download folder as ZIP (Moved up for priority)
router.get(['/files/folders/:id/download', '/file/folders/:id/download'], verifyToken, async (req, res) => {
  try {
    const folderId = req.params.id;
    
    // Check if folder exists
    const [folders] = await pool.execute('SELECT * FROM folders WHERE id = ?', [folderId]);
    if (folders.length === 0) return res.status(404).json({ error: 'Pasta não encontrada' });
    
    const rootFolder = folders[0];

    // Set response headers
    res.attachment(`${rootFolder.name}.zip`);
    
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      if (!res.headersSent) {
        res.status(500).send({ error: err.message });
      }
    });

    // Pipe archive data to the response
    archive.pipe(res);

    // Recursive function to add folder contents
    async function addFolderToArchive(fId, zipPath) {
      // Get files in this folder
      const [files] = await pool.execute('SELECT * FROM files WHERE folder_id = ?', [fId]);
      for (const file of files) {
        // file_path starts with /uploads/archives/
        const relativePath = file.file_path.startsWith('/') ? file.file_path.substring(1) : file.file_path;
        const fullPath = path.join(process.cwd(), relativePath);
        
        if (fs.existsSync(fullPath)) {
          archive.file(fullPath, { name: path.join(zipPath, file.name) });
        }
      }

      // Get subfolders
      const [subfolders] = await pool.execute('SELECT * FROM folders WHERE parent_id = ?', [fId]);
      for (const sub of subfolders) {
        const subPath = path.join(zipPath, sub.name);
        // Add the directory itself to ensure it exists even if empty
        archive.append(null, { name: subPath + '/' });
        await addFolderToArchive(sub.id, subPath);
      }
    }

    await addFolderToArchive(folderId, '');
    await archive.finalize();

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get single file metadata
router.get(['/files/:id', '/file/:id'], verifyToken, async (req, res) => {
  try {
    const [file] = await pool.execute(
      `SELECT f.*, u.name as user_name 
       FROM files f 
       JOIN users u ON f.user_id = u.id 
       WHERE f.id = ?`,
      [req.params.id]
    );
    if (file.length === 0) return res.status(404).json({ error: 'Arquivo não encontrado' });
    res.json(file[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create folder
router.post(['/files/folders', '/file/folders'], verifyToken, async (req, res) => {
  try {
    const { name, parent_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const [result] = await pool.execute(
      'INSERT INTO folders (name, parent_id, user_id) VALUES (?, ?, ?)',
      [name, parent_id || null, req.userId]
    );

    res.status(201).json({ id: result.insertId, name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to ensure folder path exists and return leaf folder ID
async function ensureFolderPath(rootId, relativePath, userId) {
  const parts = relativePath.split('/').filter(p => p);
  // webkitRelativePath is "root_folder/sub/file.txt", we need "root_folder/sub"
  const folderParts = parts.slice(0, -1);
  
  let currentParentId = rootId === 'null' || !rootId ? null : rootId;
  
  for (const part of folderParts) {
    // Check if folder exists under current parent
    const [existing] = await pool.execute(
      'SELECT id FROM folders WHERE name = ? AND parent_id <=> ?',
      [part, currentParentId]
    );
    
    if (existing.length > 0) {
      currentParentId = existing[0].id;
    } else {
      const [result] = await pool.execute(
        'INSERT INTO folders (name, parent_id, user_id) VALUES (?, ?, ?)',
        [part, currentParentId, userId]
      );
      currentParentId = result.insertId;
    }
  }
  
  return currentParentId;
}

// Upload files
router.post(['/files/upload', '/file/upload'], verifyToken, upload.array('files'), async (req, res) => {
  try {
    const { folder_id, paths } = req.body;
    const results = [];
    const root_id = !folder_id || folder_id === 'null' ? null : folder_id;
    
    // paths can be a string (if one file) or an array
    const relativePaths = Array.isArray(paths) ? paths : [paths];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const relativePath = relativePaths[i];
      
      let targetFolderId = root_id;
      
      // If relativePath is provided, ensure folders exist
      if (relativePath && relativePath.includes('/')) {
        targetFolderId = await ensureFolderPath(root_id, relativePath, req.userId);
      }

      const [result] = await pool.execute(
        `INSERT INTO files (name, folder_id, file_path, file_type, file_size, user_id) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [file.originalname, targetFolderId, `/uploads/archives/${file.filename}`, file.mimetype, file.size, req.userId]
      );
      results.push({ id: result.insertId, name: file.originalname });
    }

    res.status(201).json(results);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Rename folder
router.put(['/files/folders/:id', '/file/folders/:id'], verifyToken, async (req, res) => {
  try {
    const { name } = req.body;
    await pool.execute('UPDATE folders SET name = ? WHERE id = ?', [name, req.params.id]);
    res.json({ message: 'Pasta renomeada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rename file
router.put(['/files/:id', '/file/:id'], verifyToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    await pool.execute('UPDATE files SET name = ? WHERE id = ?', [name, req.params.id]);
    res.json({ message: 'Arquivo renomeado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Move file or folder
router.post(['/files/move', '/file/move'], verifyToken, async (req, res) => {
  try {
    const { type, id, target_folder_id } = req.body;
    const targetId = target_folder_id === 'null' ? null : target_folder_id;

    if (type === 'folder') {
      // Prevent moving a folder into itself or its children
      if (targetId) {
        let currentId = targetId;
        while (currentId) {
          if (currentId == id) return res.status(400).json({ error: 'Não é possível mover uma pasta para dentro de si mesma' });
          const [parent] = await pool.execute('SELECT parent_id FROM folders WHERE id = ?', [currentId]);
          currentId = parent[0]?.parent_id;
        }
      }
      await pool.execute('UPDATE folders SET parent_id = ? WHERE id = ?', [targetId, id]);
    } else {
      await pool.execute('UPDATE files SET folder_id = ? WHERE id = ?', [targetId, id]);
    }

    res.json({ message: 'Movido com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Copy file or folder
router.post(['/files/copy', '/file/copy'], verifyToken, async (req, res) => {
  try {
    const { type, id, target_folder_id } = req.body;
    const targetId = target_folder_id === 'null' ? null : target_folder_id;

    if (type === 'file') {
      const [file] = await pool.execute('SELECT * FROM files WHERE id = ?', [id]);
      if (file.length === 0) return res.status(404).json({ error: 'Arquivo não encontrado' });
      
      const f = file[0];
      await pool.execute(
        `INSERT INTO files (name, folder_id, file_path, file_type, file_size, user_id) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [`Cópia de ${f.name}`, targetId, f.file_path, f.file_type, f.file_size, req.userId]
      );
    } else {
      // Recursive copy for folders
      async function copyFolderRecursive(folderId, newParentId) {
        const [folder] = await pool.execute('SELECT * FROM folders WHERE id = ?', [folderId]);
        if (folder.length === 0) return;

        const [result] = await pool.execute(
          'INSERT INTO folders (name, parent_id, user_id) VALUES (?, ?, ?)',
          [newParentId ? folder[0].name : `Cópia de ${folder[0].name}`, newParentId, req.userId]
        );
        const newFolderId = result.insertId;

        // Copy files
        const [files] = await pool.execute('SELECT * FROM files WHERE folder_id = ?', [folderId]);
        for (const f of files) {
          await pool.execute(
            `INSERT INTO files (name, folder_id, file_path, file_type, file_size, user_id) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [f.name, newFolderId, f.file_path, f.file_type, f.file_size, req.userId]
          );
        }

        // Copy subfolders
        const [subfolders] = await pool.execute('SELECT * FROM folders WHERE parent_id = ?', [folderId]);
        for (const sub of subfolders) {
          await copyFolderRecursive(sub.id, newFolderId);
        }
      }

      await copyFolderRecursive(id, targetId);
    }

    res.json({ message: 'Copiado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete folder
router.delete(['/files/folders/:id', '/file/folders/:id'], verifyToken, async (req, res) => {
  try {
    // Note: cascade delete in DB handles children, but we should delete files from disk
    // For a simple implementation, let's just delete the folder entry and depend on ON DELETE CASCADE for DB
    // A robust implementation would recursively delete files from disk.
    await pool.execute('DELETE FROM folders WHERE id = ?', [req.params.id]);
    res.json({ message: 'Pasta removida' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file
router.delete(['/files/:id', '/file/:id'], verifyToken, async (req, res) => {
  try {
    const [file] = await pool.execute('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (file.length === 0) return res.status(404).json({ error: 'Arquivo não encontrado' });

    // Physical delete
    const filePath = path.join(process.cwd(), file[0].file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await pool.execute('DELETE FROM files WHERE id = ?', [req.params.id]);
    res.json({ message: 'Arquivo removido' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download folder as ZIP
router.get(['/files/folders/:id/download', '/file/folders/:id/download'], verifyToken, async (req, res) => {
  try {
    const folderId = req.params.id;
    
    // Check if folder exists
    const [folders] = await pool.execute('SELECT * FROM folders WHERE id = ?', [folderId]);
    if (folders.length === 0) return res.status(404).json({ error: 'Pasta não encontrada' });
    
    const rootFolder = folders[0];

    // Set response headers
    res.attachment(`${rootFolder.name}.zip`);
    
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      if (!res.headersSent) {
        res.status(500).send({ error: err.message });
      }
    });

    // Pipe archive data to the response
    archive.pipe(res);

    // Recursive function to add folder contents
    async function addFolderToArchive(fId, zipPath) {
      // Get files in this folder
      const [files] = await pool.execute('SELECT * FROM files WHERE folder_id = ?', [fId]);
      for (const file of files) {
        // file_path starts with /uploads/archives/
        const relativePath = file.file_path.startsWith('/') ? file.file_path.substring(1) : file.file_path;
        const fullPath = path.join(process.cwd(), relativePath);
        
        if (fs.existsSync(fullPath)) {
          archive.file(fullPath, { name: path.join(zipPath, file.name) });
        }
      }

      // Get subfolders
      const [subfolders] = await pool.execute('SELECT * FROM folders WHERE parent_id = ?', [fId]);
      for (const sub of subfolders) {
        const subPath = path.join(zipPath, sub.name);
        // Add the directory itself to ensure it exists even if empty
        archive.append(null, { name: subPath + '/' });
        await addFolderToArchive(sub.id, subPath);
      }
    }

    await addFolderToArchive(folderId, '');
    await archive.finalize();

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

export default router;
