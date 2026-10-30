import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const uploadDirectory = path.join(process.cwd(), 'uploads');
const additionalUploadDirectory = 'C:\\server\\uploads';

fs.mkdirSync(uploadDirectory, { recursive: true });
fs.mkdirSync(additionalUploadDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    },
  }),
  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new Error('Only image files are allowed.'));
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dressup_db',
};

const pool = mysql.createPool(dbConfig);

async function initializeDatabase() {
  const adminPool = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
  });

  await adminPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
  await adminPool.end();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin (
      admin_id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS image_record (
      image_id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(100) NOT NULL,
      image_url VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS characters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      character_name VARCHAR(255) NOT NULL,
      image_path VARCHAR(255) NOT NULL,
      category TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      description VARCHAR(250) DEFAULT NULL,
      KEY user_id (user_id),
      CONSTRAINT characters_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      image_path VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'accessory',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      description VARCHAR(250) DEFAULT NULL,
      KEY user_id (user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS backgrounds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      background_name VARCHAR(255) NOT NULL,
      image_path VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'background',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      description VARCHAR(250) DEFAULT NULL,
      KEY user_id (user_id)
    )
  `);

  await pool.query(
    "UPDATE items SET category = 'accessory' WHERE image_path LIKE '/uploads/items/accessory/%'",
  );
  await pool.query(
    "UPDATE items SET category = 'hair' WHERE image_path LIKE '/uploads/items/hair/%'",
  );
  await pool.query(
    "UPDATE items SET category = 'maleclothes' WHERE image_path LIKE '/uploads/items/maleclothes/%'",
  );
  await pool.query(
    "UPDATE items SET category = 'femaleclothes' WHERE image_path LIKE '/uploads/items/femaleclothes/%'",
  );
  await pool.query(
    "UPDATE items SET category = 'tallclothes' WHERE image_path LIKE '/uploads/items/tallclothes/%'",
  );
  await pool.query(
    "UPDATE items SET category = 'shortclothes' WHERE image_path LIKE '/uploads/items/shortclothes/%'",
  );
  await pool.query(
    "UPDATE items SET category = 'chubbyclothes' WHERE image_path LIKE '/uploads/items/chubbyclothes/%'",
  );
  await pool.query(
    "UPDATE items SET category = 'shoes' WHERE image_path LIKE '/uploads/items/shoes/%'",
  );

  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM admin');
  const count = Number(rows[0]?.count || 0);

  if (count === 0) {
    await pool.query(
      'INSERT INTO admin (username, password) VALUES (?, ?)',
      ['admin', 'admin123'],
    );
  }

  const [imageRows] = await pool.query('SELECT COUNT(*) AS count FROM image_record');
  const imageCount = Number(imageRows[0]?.count || 0);

  if (imageCount === 0) {
    await pool.query(
      'INSERT INTO image_record (title, image_url, description) VALUES (?, ?, ?)',
      [
        'Sample Banner',
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
        'Sample image for the admin panel',
      ],
    );
  }

  await importExistingItems('accessory');
  await importExistingItems('hair');
  await importExistingItems('maleclothes');
  await importExistingItems('femaleclothes');
  await importExistingItems('tallclothes');
  await importExistingItems('shortclothes');
  await importExistingItems('chubbyclothes');
  await importExistingItems('shoes');
  await syncExistingItemsToCharacters();
  await importExistingBackgrounds();
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDirectory));

function removeUploadedFile(imageUrl) {
  if (!imageUrl?.startsWith('/uploads/')) return;

  const filename = path.basename(imageUrl);
  const uploadedFilePath = path.join(uploadDirectory, filename);
  fs.unlink(uploadedFilePath, () => {});

  const additionalFilePath = path.join(additionalUploadDirectory, filename);
  if (path.resolve(uploadedFilePath) !== path.resolve(additionalFilePath)) {
    fs.unlink(additionalFilePath, () => {});
  }
}

async function getUserIdForAdmin(connection, adminId) {
  const [admins] = await connection.query(
    'SELECT username FROM admin WHERE admin_id = ?',
    [adminId],
  );
  if (!admins[0]) return null;

  const [result] = await connection.query(
    'INSERT INTO users (username) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)',
    [admins[0].username],
  );
  return result.insertId;
}

async function createItemWithCharacter({ adminId, itemName, imagePath, category, description }) {
  const connection = await pool.getConnection();
  const characterCategory = category === 'accessory' ? 'item' : category;

  try {
    await connection.beginTransaction();
    const userId = await getUserIdForAdmin(connection, adminId);
    if (!userId) {
      const error = new Error('Admin account was not found.');
      error.status = 400;
      throw error;
    }

    const [result] = await connection.query(
      'INSERT INTO items (user_id, item_name, image_path, category, description) VALUES (?, ?, ?, ?, ?)',
      [userId, itemName, imagePath, category, description],
    );
    await connection.query(
      'INSERT INTO characters (user_id, character_name, image_path, category, description) VALUES (?, ?, ?, ?, ?)',
      [userId, itemName, imagePath, characterCategory, description],
    );
    const [rows] = await connection.query(
      'SELECT id, item_name, image_path, category, created_at, updated_at, description FROM items WHERE id = ?',
      [result.insertId],
    );
    await connection.commit();
    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateItemWithCharacter({ id, adminId, itemName, imagePath, category, description }) {
  const connection = await pool.getConnection();
  const characterCategory = category === 'accessory' ? 'item' : category;

  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.query(
      'SELECT image_path FROM items WHERE id = ? AND category = ?',
      [id, category],
    );
    if (!existingRows[0]) {
      const error = new Error('Item not found.');
      error.status = 404;
      throw error;
    }

    const userId = await getUserIdForAdmin(connection, adminId);
    if (!userId) {
      const error = new Error('Admin account was not found.');
      error.status = 400;
      throw error;
    }

    const previousImagePath = existingRows[0].image_path;
    const nextImagePath = imagePath || previousImagePath;
    await connection.query(
      'UPDATE items SET user_id = ?, item_name = ?, image_path = ?, description = ? WHERE id = ? AND category = ?',
      [userId, itemName, nextImagePath, description, id, category],
    );

    const [characterRows] = await connection.query(
      'SELECT id FROM characters WHERE image_path = ? AND category = ?',
      [previousImagePath, characterCategory],
    );
    if (characterRows.length) {
      await connection.query(
        'UPDATE characters SET user_id = ?, character_name = ?, image_path = ?, description = ? WHERE image_path = ? AND category = ?',
        [userId, itemName, nextImagePath, description, previousImagePath, characterCategory],
      );
    } else {
      await connection.query(
        'INSERT INTO characters (user_id, character_name, image_path, category, description) VALUES (?, ?, ?, ?, ?)',
        [userId, itemName, nextImagePath, characterCategory, description],
      );
    }

    const [rows] = await connection.query(
      'SELECT id, item_name, image_path, category, created_at, updated_at, description FROM items WHERE id = ?',
      [id],
    );
    await connection.commit();
    return { item: rows[0], previousImagePath };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteItemWithCharacter(id, category) {
  const connection = await pool.getConnection();
  const characterCategory = category === 'accessory' ? 'item' : category;

  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      'SELECT image_path FROM items WHERE id = ? AND category = ?',
      [id, category],
    );
    if (rows[0]) {
      await connection.query(
        'DELETE FROM characters WHERE image_path = ? AND category = ?',
        [rows[0].image_path, characterCategory],
      );
      await connection.query('DELETE FROM items WHERE id = ? AND category = ?', [id, category]);
    }
    await connection.commit();
    return rows[0]?.image_path;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function importExistingItems(category) {
  const categoryDirectory = path.join(uploadDirectory, 'items', category);
  if (!fs.existsSync(categoryDirectory)) return;

  const [admins] = await pool.query('SELECT admin_id FROM admin ORDER BY admin_id LIMIT 1');
  const userId = admins[0] ? await getUserIdForAdmin(pool, admins[0].admin_id) : null;
  if (!userId) return;

  function collectImages(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectImages(entryPath);
      return /\.(png|jpe?g|gif|webp)$/i.test(entry.name) ? [entryPath] : [];
    });
  }

  for (const filePath of collectImages(categoryDirectory)) {
    const imagePath = `/${path.relative(process.cwd(), filePath).replaceAll(path.sep, '/')}`;
    const itemName = path.basename(filePath, path.extname(filePath));
    const [existingRows] = await pool.query('SELECT id FROM items WHERE image_path = ?', [imagePath]);
    if (!existingRows.length) {
      await pool.query(
        'INSERT INTO items (user_id, item_name, image_path, category) VALUES (?, ?, ?, ?)',
        [userId, itemName, imagePath, category],
      );
    }
  }
}

async function syncExistingItemsToCharacters() {
  await pool.query(`
    INSERT INTO characters (user_id, character_name, image_path, category, description)
    SELECT i.user_id, i.item_name, i.image_path,
      CASE WHEN i.category = 'accessory' THEN 'item' ELSE i.category END,
      i.description
    FROM items i
    INNER JOIN users u ON u.id = i.user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM characters c
      WHERE c.image_path = i.image_path
        AND c.category = CASE WHEN i.category = 'accessory' THEN 'item' ELSE i.category END
    )
  `);
}

async function importExistingBackgrounds() {
  const backgroundDirectory = path.join(uploadDirectory, 'backgound', 'background');
  if (!fs.existsSync(backgroundDirectory)) return;

  const [admins] = await pool.query('SELECT admin_id FROM admin ORDER BY admin_id LIMIT 1');
  const userId = admins[0]?.admin_id;
  if (!userId) return;

  const imageFiles = fs.readdirSync(backgroundDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(png|jpe?g|gif|webp)$/i.test(entry.name));

  for (const imageFile of imageFiles) {
    const filePath = path.join(backgroundDirectory, imageFile.name);
    const imagePath = `/${path.relative(process.cwd(), filePath).replaceAll(path.sep, '/')}`;
    const backgroundName = path.basename(imageFile.name, path.extname(imageFile.name));
    const [existingRows] = await pool.query('SELECT id FROM backgrounds WHERE image_path = ?', [imagePath]);
    if (!existingRows.length) {
      await pool.query(
        'INSERT INTO backgrounds (user_id, background_name, image_path, category) VALUES (?, ?, ?, ?)',
        [userId, backgroundName, imagePath, 'background'],
      );
    }
  }
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1 + 1 AS ok');
    res.json({ ok: true, database: dbConfig.database });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT admin_id, username, password, created_at FROM admin WHERE username = ? AND password = ?',
      [String(username).trim(), String(password)],
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const admin = rows[0];
    res.json({
      success: true,
      admin: {
        admin_id: admin.admin_id,
        username: admin.username,
        created_at: admin.created_at,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

app.get('/api/admins', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT admin_id, username, password, created_at FROM admin ORDER BY admin_id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Cannot fetch admins', error: error.message });
  }
});

app.post('/api/admins', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO admin (username, password) VALUES (?, ?)',
      [username.trim(), password],
    );

    const [rows] = await pool.query('SELECT admin_id, username, password, created_at FROM admin WHERE admin_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Cannot create admin', error: error.message });
  }
});

app.put('/api/admins/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Username is required.' });
  }

  try {
    const query = password
      ? 'UPDATE admin SET username = ?, password = ? WHERE admin_id = ?'
      : 'UPDATE admin SET username = ? WHERE admin_id = ?';

    const params = password
      ? [username.trim(), password, id]
      : [username.trim(), id];

    await pool.query(query, params);

    const [rows] = await pool.query('SELECT admin_id, username, password, created_at FROM admin WHERE admin_id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Cannot update admin', error: error.message });
  }
});

app.delete('/api/admins/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM admin WHERE admin_id = ?', [id]);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ message: 'Cannot delete admin', error: error.message });
  }
});

app.get('/api/images', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT image_id, title, image_url, description, created_at FROM image_record ORDER BY image_id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Cannot fetch images', error: error.message });
  }
});

app.post('/api/images', upload.single('image'), async (req, res) => {
  const { title, image_url, description } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : image_url;

  if (!title || !imageUrl) {
    return res.status(400).json({ message: 'Title and image file are required.' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO image_record (title, image_url, description) VALUES (?, ?, ?)',
      [String(title).trim(), String(imageUrl).trim(), description ? String(description).trim() : ''],
    );

    const [rows] = await pool.query('SELECT image_id, title, image_url, description, created_at FROM image_record WHERE image_id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Cannot create image', error: error.message });
  }
});

app.put('/api/images/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { title, image_url, description } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : image_url;

  if (!title || !imageUrl) {
    return res.status(400).json({ message: 'Title and image file are required.' });
  }

  try {
    const [existingRows] = await pool.query('SELECT image_url FROM image_record WHERE image_id = ?', [id]);
    await pool.query(
      'UPDATE image_record SET title = ?, image_url = ?, description = ? WHERE image_id = ?',
      [String(title).trim(), String(imageUrl).trim(), description ? String(description).trim() : '', id],
    );
    if (req.file && existingRows[0]) removeUploadedFile(existingRows[0].image_url);

    const [rows] = await pool.query('SELECT image_id, title, image_url, description, created_at FROM image_record WHERE image_id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Cannot update image', error: error.message });
  }
});

app.delete('/api/images/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT image_url FROM image_record WHERE image_id = ?', [id]);
    await pool.query('DELETE FROM image_record WHERE image_id = ?', [id]);
    if (rows[0]) removeUploadedFile(rows[0].image_url);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ message: 'Cannot delete image', error: error.message });
  }
});

app.get('/api/characters', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, character_name, image_path, category, created_at, updated_at, description FROM characters WHERE category = 'face' ORDER BY id DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Cannot fetch face characters', error: error.message });
  }
});

app.post('/api/characters', upload.single('image'), async (req, res) => {
  const { user_id, character_name, description } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !character_name || !imagePath) {
    if (imagePath) removeUploadedFile(imagePath);
    return res.status(400).json({ message: 'User ID, character name and image file are required.' });
  }

  try {
    const linkedUserId = await getUserIdForAdmin(pool, Number(user_id));
    if (!linkedUserId) {
      removeUploadedFile(imagePath);
      return res.status(400).json({ message: 'Admin account was not found.' });
    }
    const additionalFilePath = path.join(additionalUploadDirectory, req.file.filename);
    if (path.resolve(req.file.path) !== path.resolve(additionalFilePath)) {
      await fs.promises.copyFile(req.file.path, additionalFilePath);
    }
    const [result] = await pool.query(
      'INSERT INTO characters (user_id, character_name, image_path, category, description) VALUES (?, ?, ?, ?, ?)',
      [linkedUserId, String(character_name).trim(), imagePath, 'face', description ? String(description).trim() : ''],
    );
    const [rows] = await pool.query('SELECT id, character_name, image_path, category, created_at, updated_at, description FROM characters WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    removeUploadedFile(imagePath);
    res.status(500).json({ message: 'Cannot create face character', error: error.message });
  }
});

app.put('/api/characters/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { user_id, character_name, description } = req.body;

  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !character_name) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    return res.status(400).json({ message: 'User ID and character name are required.' });
  }

  try {
    const [existingRows] = await pool.query('SELECT image_path FROM characters WHERE id = ? AND category = \'face\'', [id]);
    if (!existingRows[0]) {
      if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
      return res.status(404).json({ message: 'Face character not found.' });
    }

    const linkedUserId = await getUserIdForAdmin(pool, Number(user_id));
    if (!linkedUserId) {
      if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
      return res.status(400).json({ message: 'Admin account was not found.' });
    }
    const imagePath = req.file ? `/uploads/${req.file.filename}` : existingRows[0].image_path;
    await pool.query(
      'UPDATE characters SET user_id = ?, character_name = ?, image_path = ?, category = ?, description = ? WHERE id = ? AND category = ?',
      [linkedUserId, String(character_name).trim(), imagePath, 'face', description ? String(description).trim() : '', id, 'face'],
    );
    if (req.file) removeUploadedFile(existingRows[0].image_path);

    const [rows] = await pool.query('SELECT id, character_name, image_path, category, created_at, updated_at, description FROM characters WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    res.status(500).json({ message: 'Cannot update face character', error: error.message });
  }
});

app.delete('/api/characters/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT image_path FROM characters WHERE id = ? AND category = \'face\'', [id]);
    await pool.query("DELETE FROM characters WHERE id = ? AND category = 'face'", [id]);
    if (rows[0]) removeUploadedFile(rows[0].image_path);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ message: 'Cannot delete face character', error: error.message });
  }
});

app.get('/api/items', async (req, res) => {
  const category = String(req.query.category || 'accessory');
  if (!['accessory', 'shoes'].includes(category)) {
    return res.status(400).json({ message: 'Unsupported item category.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, item_name, image_path, category, created_at, updated_at, description FROM items WHERE category = ? ORDER BY id DESC',
      [category],
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Cannot fetch items', error: error.message });
  }
});

app.get('/api/shoes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, item_name, image_path, category, created_at, updated_at, description FROM items WHERE category IN ('shoe', 'shoes') ORDER BY id DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Cannot fetch shoes', error: error.message });
  }
});

app.get('/api/hair', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, item_name, image_path, category, created_at, updated_at, description FROM items WHERE category = 'hair' ORDER BY id DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Cannot fetch hair items', error: error.message });
  }
});

app.post('/api/hair', upload.single('image'), async (req, res) => {
  const { user_id, item_name, description } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : '';
  const itemName = String(item_name || '').trim();

  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !itemName || !imagePath) {
    if (imagePath) removeUploadedFile(imagePath);
    return res.status(400).json({ message: 'User ID, item name and image file are required.' });
  }

  try {
    const item = await createItemWithCharacter({
      adminId: Number(user_id),
      itemName,
      imagePath,
      category: 'hair',
      description: description ? String(description).trim() : '',
    });
    res.status(201).json(item);
  } catch (error) {
    removeUploadedFile(imagePath);
    res.status(error.status || 500).json({ message: 'Cannot create hair item', error: error.message });
  }
});

app.put('/api/hair/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { user_id, item_name, description } = req.body;
  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !item_name) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    return res.status(400).json({ message: 'User ID and item name are required.' });
  }
  try {
    const result = await updateItemWithCharacter({
      id,
      adminId: Number(user_id),
      itemName: String(item_name).trim(),
      imagePath: req.file ? `/uploads/${req.file.filename}` : null,
      category: 'hair',
      description: description ? String(description).trim() : '',
    });
    if (req.file) removeUploadedFile(result.previousImagePath);
    res.json(result.item);
  } catch (error) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    res.status(error.status || 500).json({ message: 'Cannot update hair', error: error.message });
  }
});

app.delete('/api/hair/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const imagePath = await deleteItemWithCharacter(id, 'hair');
    if (imagePath) removeUploadedFile(imagePath);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ message: 'Cannot delete hair', error: error.message });
  }
});

app.get('/api/maleclothes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, item_name, image_path, category, created_at, updated_at, description FROM items WHERE category = 'maleclothes' ORDER BY id DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Cannot fetch male clothes', error: error.message });
  }
});

app.post('/api/maleclothes', upload.single('image'), async (req, res) => {
  const { user_id, item_name, description } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !item_name?.trim() || !imagePath) {
    if (imagePath) removeUploadedFile(imagePath);
    return res.status(400).json({ message: 'User ID, item name and image file are required.' });
  }

  try {
    const item = await createItemWithCharacter({
      adminId: Number(user_id),
      itemName: String(item_name).trim(),
      imagePath,
      category: 'maleclothes',
      description: description ? String(description).trim() : '',
    });
    res.status(201).json(item);
  } catch (error) {
    removeUploadedFile(imagePath);
    res.status(error.status || 500).json({ message: 'Cannot create male clothes item', error: error.message });
  }
});

app.put('/api/maleclothes/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { user_id, item_name, description } = req.body;
  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !item_name) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    return res.status(400).json({ message: 'User ID and item name are required.' });
  }
  try {
    const result = await updateItemWithCharacter({
      id,
      adminId: Number(user_id),
      itemName: String(item_name).trim(),
      imagePath: req.file ? `/uploads/${req.file.filename}` : null,
      category: 'maleclothes',
      description: description ? String(description).trim() : '',
    });
    if (req.file) removeUploadedFile(result.previousImagePath);
    res.json(result.item);
  } catch (error) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    res.status(error.status || 500).json({ message: 'Cannot update male clothes', error: error.message });
  }
});

app.delete('/api/maleclothes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const imagePath = await deleteItemWithCharacter(id, 'maleclothes');
    if (imagePath) removeUploadedFile(imagePath);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ message: 'Cannot delete male clothes', error: error.message });
  }
});

app.get('/api/femaleclothes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, item_name, image_path, category, created_at, updated_at, description FROM items WHERE category = 'femaleclothes' ORDER BY id DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Cannot fetch female clothes', error: error.message });
  }
});

app.post('/api/femaleclothes', upload.single('image'), async (req, res) => {
  const { user_id, item_name, description } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !item_name || !imagePath) {
    if (imagePath) removeUploadedFile(imagePath);
    return res.status(400).json({ message: 'User ID, item name and image file are required.' });
  }

  try {
    const item = await createItemWithCharacter({
      adminId: Number(user_id),
      itemName: String(item_name).trim(),
      imagePath,
      category: 'femaleclothes',
      description: description ? String(description).trim() : '',
    });
    res.status(201).json(item);
  } catch (error) {
    removeUploadedFile(imagePath);
    res.status(error.status || 500).json({ message: 'Cannot create female clothes item', error: error.message });
  }
});

app.get('/api/tallclothes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, item_name, image_path, category, created_at, updated_at, description FROM items WHERE category = 'tallclothes' ORDER BY id DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Cannot fetch tall clothes', error: error.message });
  }
});

app.post('/api/tallclothes', upload.single('image'), async (req, res) => {
  const { user_id, item_name, description } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !item_name?.trim() || !imagePath) {
    if (imagePath) removeUploadedFile(imagePath);
    return res.status(400).json({ message: 'User ID, item name and image file are required.' });
  }

  try {
    const item = await createItemWithCharacter({
      adminId: Number(user_id),
      itemName: String(item_name).trim(),
      imagePath,
      category: 'tallclothes',
      description: description ? String(description).trim() : '',
    });
    res.status(201).json(item);
  } catch (error) {
    removeUploadedFile(imagePath);
    res.status(error.status || 500).json({ message: 'Cannot create tall clothes item', error: error.message });
  }
});

app.get('/api/shortclothes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, item_name, image_path, category, created_at, updated_at, description FROM items WHERE category = 'shortclothes' ORDER BY id DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Cannot fetch short clothes', error: error.message });
  }
});

app.post('/api/shortclothes', upload.single('image'), async (req, res) => {
  const { user_id, item_name, description } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !item_name?.trim() || !imagePath) {
    if (imagePath) removeUploadedFile(imagePath);
    return res.status(400).json({ message: 'User ID, item name and image file are required.' });
  }

  try {
    const item = await createItemWithCharacter({
      adminId: Number(user_id),
      itemName: String(item_name).trim(),
      imagePath,
      category: 'shortclothes',
      description: description ? String(description).trim() : '',
    });
    res.status(201).json(item);
  } catch (error) {
    removeUploadedFile(imagePath);
    res.status(error.status || 500).json({ message: 'Cannot create short clothes item', error: error.message });
  }
});

app.get('/api/chubbyclothes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, item_name, image_path, category, created_at, updated_at, description FROM items WHERE category = 'chubbyclothes' ORDER BY id DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Cannot fetch chubby clothes', error: error.message });
  }
});

app.post('/api/chubbyclothes', upload.single('image'), async (req, res) => {
  const { user_id, item_name, description } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !item_name?.trim() || !imagePath) {
    if (imagePath) removeUploadedFile(imagePath);
    return res.status(400).json({ message: 'User ID, item name and image file are required.' });
  }

  try {
    const item = await createItemWithCharacter({
      adminId: Number(user_id),
      itemName: String(item_name).trim(),
      imagePath,
      category: 'chubbyclothes',
      description: description ? String(description).trim() : '',
    });
    res.status(201).json(item);
  } catch (error) {
    removeUploadedFile(imagePath);
    res.status(error.status || 500).json({ message: 'Cannot create chubby clothes item', error: error.message });
  }
});

app.put('/api/chubbyclothes/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { user_id, item_name, description } = req.body;
  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !item_name) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    return res.status(400).json({ message: 'User ID and item name are required.' });
  }
  try {
    const result = await updateItemWithCharacter({
      id,
      adminId: Number(user_id),
      itemName: String(item_name).trim(),
      imagePath: req.file ? `/uploads/${req.file.filename}` : null,
      category: 'chubbyclothes',
      description: description ? String(description).trim() : '',
    });
    if (req.file) removeUploadedFile(result.previousImagePath);
    res.json(result.item);
  } catch (error) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    res.status(error.status || 500).json({ message: 'Cannot update chubby clothes', error: error.message });
  }
});

app.delete('/api/chubbyclothes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const imagePath = await deleteItemWithCharacter(id, 'chubbyclothes');
    if (imagePath) removeUploadedFile(imagePath);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ message: 'Cannot delete chubby clothes', error: error.message });
  }
});

app.put('/api/shortclothes/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { user_id, item_name, description } = req.body;
  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !item_name) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    return res.status(400).json({ message: 'User ID and item name are required.' });
  }
  try {
    const result = await updateItemWithCharacter({
      id,
      adminId: Number(user_id),
      itemName: String(item_name).trim(),
      imagePath: req.file ? `/uploads/${req.file.filename}` : null,
      category: 'shortclothes',
      description: description ? String(description).trim() : '',
    });
    if (req.file) removeUploadedFile(result.previousImagePath);
    res.json(result.item);
  } catch (error) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    res.status(error.status || 500).json({ message: 'Cannot update short clothes', error: error.message });
  }
});

app.delete('/api/shortclothes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const imagePath = await deleteItemWithCharacter(id, 'shortclothes');
    if (imagePath) removeUploadedFile(imagePath);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ message: 'Cannot delete short clothes', error: error.message });
  }
});

app.put('/api/tallclothes/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { user_id, item_name, description } = req.body;
  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !item_name) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    return res.status(400).json({ message: 'User ID and item name are required.' });
  }
  try {
    const result = await updateItemWithCharacter({
      id,
      adminId: Number(user_id),
      itemName: String(item_name).trim(),
      imagePath: req.file ? `/uploads/${req.file.filename}` : null,
      category: 'tallclothes',
      description: description ? String(description).trim() : '',
    });
    if (req.file) removeUploadedFile(result.previousImagePath);
    res.json(result.item);
  } catch (error) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    res.status(error.status || 500).json({ message: 'Cannot update tall clothes', error: error.message });
  }
});

app.delete('/api/tallclothes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const imagePath = await deleteItemWithCharacter(id, 'tallclothes');
    if (imagePath) removeUploadedFile(imagePath);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ message: 'Cannot delete tall clothes', error: error.message });
  }
});

app.put('/api/femaleclothes/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { user_id, item_name, description } = req.body;
  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !item_name) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    return res.status(400).json({ message: 'User ID and item name are required.' });
  }
  try {
    const result = await updateItemWithCharacter({
      id,
      adminId: Number(user_id),
      itemName: String(item_name).trim(),
      imagePath: req.file ? `/uploads/${req.file.filename}` : null,
      category: 'femaleclothes',
      description: description ? String(description).trim() : '',
    });
    if (req.file) removeUploadedFile(result.previousImagePath);
    res.json(result.item);
  } catch (error) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    res.status(error.status || 500).json({ message: 'Cannot update female clothes', error: error.message });
  }
});

app.delete('/api/femaleclothes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const imagePath = await deleteItemWithCharacter(id, 'femaleclothes');
    if (imagePath) removeUploadedFile(imagePath);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ message: 'Cannot delete female clothes', error: error.message });
  }
});

app.post('/api/items', upload.single('image'), async (req, res) => {
  const { user_id, item_name, description } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : '';
  const adminId = Number(user_id);
  const itemName = String(item_name || '').trim();

  if (!Number.isInteger(adminId) || adminId < 1 || !itemName || !imagePath) {
    if (imagePath) removeUploadedFile(imagePath);
    return res.status(400).json({ message: 'User ID, item name and image file are required.' });
  }

  try {
    const item = await createItemWithCharacter({
      adminId,
      itemName,
      imagePath,
      category: 'accessory',
      description: description ? String(description).trim() : '',
    });
    res.status(201).json(item);
  } catch (error) {
    removeUploadedFile(imagePath);
    res.status(error.status || 500).json({ message: 'Cannot create item', error: error.message });
  }
});

app.put('/api/items/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { user_id, item_name, description } = req.body;
  const adminId = Number(user_id);
  const itemName = String(item_name || '').trim();

  if (!Number.isInteger(adminId) || adminId < 1 || !itemName) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    return res.status(400).json({ message: 'User ID and item name are required.' });
  }

  try {
    const result = await updateItemWithCharacter({
      id,
      adminId,
      itemName,
      imagePath: req.file ? `/uploads/${req.file.filename}` : null,
      category: 'accessory',
      description: description ? String(description).trim() : '',
    });
    if (req.file) removeUploadedFile(result.previousImagePath);
    res.json(result.item);
  } catch (error) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    res.status(error.status || 500).json({ message: 'Cannot update item', error: error.message });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const imagePath = await deleteItemWithCharacter(id, 'accessory');
    if (imagePath) removeUploadedFile(imagePath);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ message: 'Cannot delete item', error: error.message });
  }
});

app.get('/api/backgrounds', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, background_name, image_path, category, created_at, updated_at, description FROM backgrounds WHERE category = 'background' ORDER BY id DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Cannot fetch backgrounds', error: error.message });
  }
});

app.post('/api/backgrounds', upload.single('image'), async (req, res) => {
  const { user_id, background_name, description } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !background_name || !imagePath) {
    return res.status(400).json({ message: 'User ID, background name and image file are required.' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO backgrounds (user_id, background_name, image_path, category, description) VALUES (?, ?, ?, ?, ?)',
      [Number(user_id), String(background_name).trim(), imagePath, 'background', description ? String(description).trim() : ''],
    );
    const [rows] = await pool.query('SELECT id, background_name, image_path, category, created_at, updated_at, description FROM backgrounds WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    removeUploadedFile(imagePath);
    res.status(500).json({ message: 'Cannot create background', error: error.message });
  }
});

app.put('/api/backgrounds/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { user_id, background_name, description } = req.body;

  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !background_name) {
    return res.status(400).json({ message: 'User ID and background name are required.' });
  }

  try {
    const [existingRows] = await pool.query("SELECT image_path FROM backgrounds WHERE id = ? AND category = 'background'", [id]);
    if (!existingRows[0]) return res.status(404).json({ message: 'Background not found.' });

    const imagePath = req.file ? `/uploads/${req.file.filename}` : existingRows[0].image_path;
    await pool.query(
      "UPDATE backgrounds SET user_id = ?, background_name = ?, image_path = ?, category = 'background', description = ? WHERE id = ? AND category = 'background'",
      [Number(user_id), String(background_name).trim(), imagePath, description ? String(description).trim() : '', id],
    );
    if (req.file) removeUploadedFile(existingRows[0].image_path);

    const [rows] = await pool.query('SELECT id, background_name, image_path, category, created_at, updated_at, description FROM backgrounds WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    res.status(500).json({ message: 'Cannot update background', error: error.message });
  }
});

app.delete('/api/backgrounds/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query("SELECT image_path FROM backgrounds WHERE id = ? AND category = 'background'", [id]);
    await pool.query("DELETE FROM backgrounds WHERE id = ? AND category = 'background'", [id]);
    if (rows[0]) removeUploadedFile(rows[0].image_path);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ message: 'Cannot delete background', error: error.message });
  }
});

app.get('/api/base-characters', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, character_name, image_path, category, created_at, updated_at, description FROM characters WHERE category = 'base' ORDER BY id DESC",
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Cannot fetch base characters', error: error.message });
  }
});

app.post('/api/base-characters', upload.single('image'), async (req, res) => {
  const { user_id, character_name, description } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !character_name || !imagePath) {
    if (imagePath) removeUploadedFile(imagePath);
    return res.status(400).json({ message: 'User ID, character name and image file are required.' });
  }

  try {
    const linkedUserId = await getUserIdForAdmin(pool, Number(user_id));
    if (!linkedUserId) {
      removeUploadedFile(imagePath);
      return res.status(400).json({ message: 'Admin account was not found.' });
    }
    const [result] = await pool.query(
      'INSERT INTO characters (user_id, character_name, image_path, category, description) VALUES (?, ?, ?, ?, ?)',
      [linkedUserId, String(character_name).trim(), imagePath, 'base', description ? String(description).trim() : ''],
    );
    const [rows] = await pool.query('SELECT id, character_name, image_path, category, created_at, updated_at, description FROM characters WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    removeUploadedFile(imagePath);
    res.status(500).json({ message: 'Cannot create base character', error: error.message });
  }
});

app.put('/api/base-characters/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { user_id, character_name, description } = req.body;

  if (!Number.isInteger(Number(user_id)) || Number(user_id) < 1 || !character_name) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    return res.status(400).json({ message: 'User ID and character name are required.' });
  }

  try {
    const [existingRows] = await pool.query("SELECT image_path FROM characters WHERE id = ? AND category = 'base'", [id]);
    if (!existingRows[0]) {
      if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
      return res.status(404).json({ message: 'Base character not found.' });
    }

    const linkedUserId = await getUserIdForAdmin(pool, Number(user_id));
    if (!linkedUserId) {
      if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
      return res.status(400).json({ message: 'Admin account was not found.' });
    }
    const imagePath = req.file ? `/uploads/${req.file.filename}` : existingRows[0].image_path;
    await pool.query(
      "UPDATE characters SET user_id = ?, character_name = ?, image_path = ?, category = 'base', description = ? WHERE id = ? AND category = 'base'",
      [linkedUserId, String(character_name).trim(), imagePath, description ? String(description).trim() : '', id],
    );
    if (req.file) removeUploadedFile(existingRows[0].image_path);

    const [rows] = await pool.query('SELECT id, character_name, image_path, category, created_at, updated_at, description FROM characters WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    res.status(500).json({ message: 'Cannot update base character', error: error.message });
  }
});

app.delete('/api/base-characters/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query("SELECT image_path FROM characters WHERE id = ? AND category = 'base'", [id]);
    await pool.query("DELETE FROM characters WHERE id = ? AND category = 'base'", [id]);
    if (rows[0]) removeUploadedFile(rows[0].image_path);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ message: 'Cannot delete base character', error: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  const isUploadError = err instanceof multer.MulterError || err.message === 'Only image files are allowed.';
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : isUploadError ? 400 : 500;
  res.status(status).json({ message: err.message || 'Unexpected server error' });
});

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to MySQL database:', error.message);
    process.exit(1);
  }
}

startServer();
