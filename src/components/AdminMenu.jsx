import { useEffect, useState } from 'react';

const API_URL = '/api/admins';
const emptyForm = { username: '', password: '' };

function AdminMenu({ setError, setMessage, onCountChange }) {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Unable to load admins');
      const data = await response.json();
      setAdmins(data);
      onCountChange(data.length);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const username = form.username.trim();
    if (!username) return setError('Username is required.');
    if (!editingId && !form.password) return setError('Password is required.');

    try {
      const response = await fetch(editingId ? `${API_URL}/${editingId}` : API_URL, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: form.password }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save admin');
      }
      setForm(emptyForm);
      setEditingId(null);
      setMessage(editingId ? 'Admin updated successfully.' : 'Admin added successfully.');
      await fetchAdmins();
    } catch (err) {
      setError(err.message || 'Unable to save admin');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this admin?')) return;
    try {
      const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to delete admin');
      setMessage('Admin deleted successfully.');
      await fetchAdmins();
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  return (
    <>
      <div className="toolbar"><h2>{editingId ? 'Edit Admin' : 'Add Admin'}</h2></div>
      <form className="item-form" onSubmit={handleSubmit}>
        <div className="field-grid">
          <label><span>Username</span><input name="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Enter username" required /></label>
          <label><span>Password</span><input type="password" name="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={editingId ? 'Leave blank to keep current password' : 'Enter password'} required={!editingId} /></label>
        </div>
        <div className="form-actions">
          <button type="submit" className="primary-btn">{editingId ? 'Save Changes' : 'Add Admin'}</button>
          {editingId && <button type="button" className="secondary-btn" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</button>}
        </div>
      </form>
      <div className="table-wrap"><table><thead><tr><th>ID</th><th>Username</th><th>Created At</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="4" className="empty-state">Loading admins...</td></tr> : admins.length === 0 ? <tr><td colSpan="4" className="empty-state">No admins found</td></tr> : admins.map((admin) => <tr key={admin.admin_id}><td>{admin.admin_id}</td><td>{admin.username}</td><td>{new Date(admin.created_at).toLocaleString()}</td><td className="actions"><button type="button" className="tiny-button edit" onClick={() => { setEditingId(admin.admin_id); setForm({ username: admin.username, password: '' }); }}>Edit</button><button type="button" className="tiny-button delete" onClick={() => handleDelete(admin.admin_id)}>Delete</button></td></tr>)}
      </tbody></table></div>
    </>
  );
}

export default AdminMenu;
