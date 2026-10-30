import { useEffect, useState } from 'react';

const API_URL = '/api/items';
const emptyForm = { item_name: '', description: '' };

function ItemMenu({ currentAdmin, setError, setMessage, onCountChange }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Unable to load items');
      const data = await response.json();
      setItems(data);
      onCountChange(data.length);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const itemName = form.item_name.trim();
    const userId = Number(currentAdmin?.admin_id);
    if (!userId || !itemName || (!editingId && !file)) {
      return setError(!userId ? 'Unable to identify the logged-in admin.' : editingId ? 'Item name is required.' : 'Item name and image file are required.');
    }

    try {
      const payload = new FormData();
      payload.append('user_id', String(userId));
      payload.append('item_name', itemName);
      payload.append('description', form.description.trim());
      if (file) payload.append('image', file);

      const response = await fetch(editingId ? `${API_URL}/${editingId}` : API_URL, {
        method: editingId ? 'PUT' : 'POST',
        body: payload,
      });

      if (!response.ok) {
        throw new Error((await response.json().catch(() => ({}))).message || 'Failed to save item');
      }

      setForm(emptyForm);
      setFile(null);
      setEditingId(null);
      setMessage(editingId ? 'Item updated successfully.' : 'Item added successfully.');
      await fetchItems();
    } catch (err) {
      setError(err.message || 'Unable to save item');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;

    try {
      const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to delete item');
      setMessage('Item deleted successfully.');
      await fetchItems();
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  return (
    <>
      <div className="toolbar"><h2>{editingId ? 'Edit Item' : 'Add Item'}</h2></div>

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
            <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} required={!editingId} />
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
            <img src={preview || items.find((item) => item.id === editingId)?.image_path} alt={form.item_name || 'Preview'} />
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="primary-btn">{editingId ? 'Save Changes' : 'Add Item'}</button>
          {editingId && (
            <button type="button" className="secondary-btn" onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setFile(null);
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
              <tr><td colSpan="5" className="empty-state">Loading items...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan="5" className="empty-state">No items found</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td><img src={item.image_path} alt={item.item_name} className="thumb" /></td>
                  <td>{item.id}</td>
                  <td>{item.item_name}</td>
                  <td>{item.description || '-'}</td>
                  <td className="actions">
                    <button
                      type="button"
                      className="tiny-button edit"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({ item_name: item.item_name, description: item.description || '' });
                        setFile(null);
                      }}
                    >
                      Edit
                    </button>
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

export default ItemMenu;
