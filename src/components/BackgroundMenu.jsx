import { useEffect, useState } from 'react';

const API_URL = '/api/backgrounds';
const emptyForm = { background_name: '', description: '' };

function BackgroundMenu({ currentAdmin, setError, setMessage, onCountChange }) {
  const [backgrounds, setBackgrounds] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchBackgrounds = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Unable to load backgrounds');
      const data = await response.json();
      setBackgrounds(data);
      onCountChange(data.length);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load backgrounds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBackgrounds(); }, []);

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

    const backgroundName = form.background_name.trim();
    const userId = Number(currentAdmin?.admin_id);
    if (!userId || !backgroundName || (!editingId && !file)) {
      return setError(!userId ? 'Unable to identify the logged-in admin.' : editingId ? 'Background name is required.' : 'Background name and image file are required.');
    }

    try {
      const payload = new FormData();
      payload.append('user_id', String(userId));
      payload.append('background_name', backgroundName);
      payload.append('description', form.description.trim());
      if (file) payload.append('image', file);

      const response = await fetch(editingId ? `${API_URL}/${editingId}` : API_URL, {
        method: editingId ? 'PUT' : 'POST',
        body: payload,
      });

      if (!response.ok) {
        throw new Error((await response.json().catch(() => ({}))).message || 'Failed to save background');
      }

      setForm(emptyForm);
      setFile(null);
      setEditingId(null);
      setMessage(editingId ? 'Background updated successfully.' : 'Background added successfully.');
      await fetchBackgrounds();
    } catch (err) {
      setError(err.message || 'Unable to save background');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this background?')) return;

    try {
      const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to delete background');
      setMessage('Background deleted successfully.');
      await fetchBackgrounds();
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  return (
    <>
      <div className="toolbar"><h2>{editingId ? 'Edit Background' : 'Add Background'}</h2></div>

      <form className="item-form image-form" onSubmit={handleSubmit}>
        <div className="field-grid image-grid">
          <label>
            <span>Background name</span>
            <input
              name="background_name"
              value={form.background_name}
              onChange={(event) => setForm({ ...form, background_name: event.target.value })}
              placeholder="Enter background name"
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
            <img src={preview || backgrounds.find((background) => background.id === editingId)?.image_path} alt={form.background_name || 'Preview'} />
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="primary-btn">{editingId ? 'Save Changes' : 'Add Background'}</button>
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
              <th>Preview</th>
              <th>ID</th>
              <th>Name</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="empty-state">Loading backgrounds...</td></tr>
            ) : backgrounds.length === 0 ? (
              <tr><td colSpan="5" className="empty-state">No backgrounds found</td></tr>
            ) : (
              backgrounds.map((background) => (
                <tr key={background.id}>
                  <td><img src={background.image_path} alt={background.background_name} className="thumb" /></td>
                  <td>{background.id}</td>
                  <td>{background.background_name}</td>
                  <td>{background.description || '-'}</td>
                  <td className="actions">
                    <button
                      type="button"
                      className="tiny-button edit"
                      onClick={() => {
                        setEditingId(background.id);
                        setForm({ background_name: background.background_name, description: background.description || '' });
                        setFile(null);
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="tiny-button delete" onClick={() => handleDelete(background.id)}>Delete</button>
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

export default BackgroundMenu;
