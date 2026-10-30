import { useEffect, useState } from 'react';

const API_URL = '/api/base-characters';
const emptyForm = { character_name: '', description: '' };

function BaseMenu({ currentAdmin, setError, setMessage, onCountChange }) {
  const [characters, setCharacters] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCharacters = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Unable to load base characters');
      const data = await response.json();
      setCharacters(data);
      onCountChange(data.length);
      setError('');
    } catch (err) { setError(err.message || 'Failed to load base characters'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCharacters(); }, []);
  useEffect(() => {
    if (!file) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(''); setMessage('');
    const characterName = form.character_name.trim();
    const userId = Number(currentAdmin?.admin_id);
    if (!userId || !characterName || (!editingId && !file)) return setError(!userId ? 'Unable to identify the logged-in admin.' : editingId ? 'Character name is required.' : 'Character name and image file are required.');
    try {
      const payload = new FormData();
      payload.append('user_id', String(userId));
      payload.append('character_name', characterName);
      payload.append('description', form.description.trim());
      if (file) payload.append('image', file);
      const response = await fetch(editingId ? `${API_URL}/${editingId}` : API_URL, { method: editingId ? 'PUT' : 'POST', body: payload });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Failed to save base character');
      setForm(emptyForm); setFile(null); setEditingId(null);
      setMessage(editingId ? 'Base character updated successfully.' : 'Base character added successfully.');
      await fetchCharacters();
    } catch (err) { setError(err.message || 'Unable to save base character'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this base character?')) return;
    try {
      const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to delete base character');
      setMessage('Base character deleted successfully.');
      await fetchCharacters();
    } catch (err) { setError(err.message || 'Delete failed'); }
  };

  return (
    <>
      <div className="toolbar"><h2>{editingId ? 'Edit Base Character' : 'Add Base Character'}</h2></div>
      <form className="item-form image-form" onSubmit={handleSubmit}>
        <div className="field-grid image-grid">
          <label><span>Character name</span><input name="character_name" value={form.character_name} onChange={(event) => setForm({ ...form, character_name: event.target.value })} placeholder="Enter character name" required /></label>
          <label><span>Image file</span><input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} required={!editingId} /></label>
        </div>
        <label className="full-width-label"><span>Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength="250" rows="4" placeholder="Write a short description" /></label>
        {(preview || editingId) && <div className="image-preview-box"><img src={preview || characters.find((character) => character.id === editingId)?.image_path} alt={form.character_name || 'Preview'} /></div>}
        <div className="form-actions"><button type="submit" className="primary-btn">{editingId ? 'Save Changes' : 'Add Base Character'}</button>{editingId && <button type="button" className="secondary-btn" onClick={() => { setEditingId(null); setForm(emptyForm); setFile(null); }}>Cancel</button>}</div>
      </form>
      <div className="table-wrap"><table><thead><tr><th>Image</th><th>ID</th><th>Name</th><th>Description</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="5" className="empty-state">Loading base characters...</td></tr> : characters.length === 0 ? <tr><td colSpan="5" className="empty-state">No base characters found</td></tr> : characters.map((character) => <tr key={character.id}><td><img src={character.image_path} alt={character.character_name} className="thumb" /></td><td>{character.id}</td><td>{character.character_name}</td><td>{character.description || '-'}</td><td className="actions"><button type="button" className="tiny-button edit" onClick={() => { setEditingId(character.id); setForm({ character_name: character.character_name, description: character.description || '' }); setFile(null); }}>Edit</button><button type="button" className="tiny-button delete" onClick={() => handleDelete(character.id)}>Delete</button></td></tr>)}
      </tbody></table></div>
    </>
  );
}

export default BaseMenu;
