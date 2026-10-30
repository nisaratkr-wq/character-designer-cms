import { useEffect, useState } from 'react';

const API_URL = '/api/images';
const emptyForm = { title: '', image_url: '', description: '' };

function ImageMenu({ setError, setMessage, onCountChange }) {
  const [images, setImages] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Unable to load images');
      const data = await response.json();
      setImages(data);
      onCountChange(data.length);
      setError('');
    } catch (err) { setError(err.message || 'Failed to load images'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchImages(); }, []);
  useEffect(() => {
    if (!file) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(''); setMessage('');
    const title = form.title.trim();
    if (!title || (!editingId && !file)) return setError(editingId ? 'Title is required.' : 'Title and image file are required.');
    try {
      const payload = new FormData();
      payload.append('title', title);
      payload.append('description', form.description.trim());
      if (file) payload.append('image', file);
      else if (editingId) payload.append('image_url', form.image_url);
      const response = await fetch(editingId ? `${API_URL}/${editingId}` : API_URL, { method: editingId ? 'PUT' : 'POST', body: payload });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Failed to save image');
      setForm(emptyForm); setFile(null); setEditingId(null);
      setMessage(editingId ? 'Image updated successfully.' : 'Image added successfully.');
      await fetchImages();
    } catch (err) { setError(err.message || 'Unable to save image'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this image?')) return;
    try {
      const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to delete image');
      setMessage('Image deleted successfully.');
      await fetchImages();
    } catch (err) { setError(err.message || 'Delete failed'); }
  };

  return (
    <>
      <div className="toolbar"><h2>{editingId ? 'Edit Image' : 'Add Image'}</h2></div>
      <form className="item-form image-form" onSubmit={handleSubmit}>
        <div className="field-grid image-grid">
          <label><span>Title</span><input name="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Enter image title" required /></label>
          <label><span>Image file</span><input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} required={!editingId} /></label>
        </div>
        <label className="full-width-label"><span>Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows="4" placeholder="Write a short description" /></label>
        {(preview || form.image_url) && <div className="image-preview-box"><img src={preview || form.image_url} alt={form.title || 'Preview'} /></div>}
        <div className="form-actions"><button type="submit" className="primary-btn">{editingId ? 'Save Changes' : 'Add Image'}</button>{editingId && <button type="button" className="secondary-btn" onClick={() => { setEditingId(null); setForm(emptyForm); setFile(null); }}>Cancel</button>}</div>
      </form>
      <div className="table-wrap"><table><thead><tr><th>Image</th><th>Title</th><th>Description</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="4" className="empty-state">Loading images...</td></tr> : images.length === 0 ? <tr><td colSpan="4" className="empty-state">No images found</td></tr> : images.map((image) => <tr key={image.image_id}><td><img src={image.image_url} alt={image.title} className="thumb" /></td><td>{image.title}</td><td>{image.description || '-'}</td><td className="actions"><button type="button" className="tiny-button edit" onClick={() => { setEditingId(image.image_id); setForm({ title: image.title, image_url: image.image_url, description: image.description || '' }); setFile(null); }}>Edit</button><button type="button" className="tiny-button delete" onClick={() => handleDelete(image.image_id)}>Delete</button></td></tr>)}
      </tbody></table></div>
    </>
  );
}

export default ImageMenu;
