import { useEffect, useRef, useState } from 'react';

const API_URL = '/api/maleclothes';
const emptyForm = { item_name: '', description: '' };

function MaleclothesMenu({ currentAdmin, setError, setMessage, onCountChange }) {
  const [clothes, setClothes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const previewUrl = useRef('');
  const fileInput = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchMaleclothes = async () => {
      try {
        setLoading(true);
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Unable to load male clothes');
        const data = await response.json();
        if (!mounted) return;
        setClothes(data);
        onCountChange(data.length);
        setError('');
      } catch (error) {
        if (mounted) setError(error.message || 'Failed to load male clothes');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchMaleclothes();
    return () => { mounted = false; };
  }, []);

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  const clearSelectedFile = () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = '';
    setPreview('');
    setFile(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = '';
    if (selectedFile) {
      previewUrl.current = URL.createObjectURL(selectedFile);
      setPreview(previewUrl.current);
    } else {
      setPreview('');
    }
    setFile(selectedFile);
  };

  const fetchMaleclothes = async () => {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Unable to load male clothes');
    const data = await response.json();
    setClothes(data);
    onCountChange(data.length);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const userId = Number(currentAdmin?.admin_id);
    if (!userId || !form.item_name.trim() || (!editingId && !file)) {
      setError(!userId ? 'Unable to identify the logged-in admin.' : editingId ? 'Item name is required.' : 'Item name and image file are required.');
      return;
    }
    try {
      const payload = new FormData();
      payload.append('user_id', String(userId));
      payload.append('item_name', form.item_name.trim());
      payload.append('description', form.description.trim());
      if (file) payload.append('image', file);
      const response = await fetch(editingId ? `${API_URL}/${editingId}` : API_URL, {
        method: editingId ? 'PUT' : 'POST',
        body: payload,
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Failed to save male clothes');
      const wasEditing = Boolean(editingId);
      setEditingId(null);
      setForm(emptyForm);
      clearSelectedFile();
      setMessage(wasEditing ? 'Male clothes updated successfully.' : 'Male clothes added successfully.');
      await fetchMaleclothes();
    } catch (error) {
      setError(error.message || 'Unable to save male clothes');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to delete male clothes');
      setMessage('Male clothes deleted successfully.');
      await fetchMaleclothes();
    } catch (error) {
      setError(error.message || 'Delete failed');
    }
  };

  return (
    <>
      <div className="toolbar"><h2>{editingId ? 'Edit Item' : 'Add Male Clothes'}</h2></div>
      <form className="item-form image-form" onSubmit={handleSubmit}>
        <div className="field-grid image-grid">
          <label>
            <span>Item name</span>
            <input
              name="item_name"
              value={form.item_name}
              onChange={(event) => setForm({ ...form, item_name: event.target.value })}
              placeholder="Enter item name"
              required
            />
          </label>
          <label>
            <span>Image file</span>
            <input ref={fileInput} type="file" accept="image/*" onChange={handleFileChange} required={!editingId} />
          </label>
        </div>
        <label className="full-width-label">
          <span>Description</span>
          <textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            maxLength="250"
            rows="4"
            placeholder="Write a short description"
          />
        </label>
        {(preview || editingId) && (
          <div className="image-preview-box">
            <img src={preview || clothes.find((item) => item.id === editingId)?.image_path} alt={form.item_name || 'Preview'} />
          </div>
        )}
        <div className="form-actions">
          <button type="submit" className="primary-btn">{editingId ? 'Save Changes' : 'Add Item'}</button>
          {editingId && (
            <button type="button" className="secondary-btn" onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              clearSelectedFile();
            }}>
              Cancel
            </button>
          )}
        </div>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>ID</th>
              <th>Name</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="empty-state">Loading male clothes...</td></tr>
            ) : clothes.length === 0 ? (
              <tr><td colSpan="5" className="empty-state">No male clothes found</td></tr>
            ) : (
              clothes.map((item) => (
                <tr key={item.id}>
                  <td><img src={item.image_path} alt={item.item_name} className="thumb" /></td>
                  <td>{item.id}</td>
                  <td>{item.item_name}</td>
                  <td>{item.description || '-'}</td>
                  <td className="actions">
                    <button type="button" className="tiny-button edit" onClick={() => { setEditingId(item.id); setForm({ item_name: item.item_name, description: item.description || '' }); clearSelectedFile(); }}>Edit</button>
                    <button type="button" className="tiny-button delete" onClick={() => handleDelete(item.id)}>Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default MaleclothesMenu;
