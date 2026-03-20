import React, { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import Button from '../components/Button'
import StatusBadge from '../components/StatusBadge'
import '../styles/history.css'
import mockApi from '../api/mockApi'

export default function ManageComplaints(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load(){
    setLoading(true)
    setError(null)

    try{
      const data = mockApi.listComplaints()
      setItems(data || [])
    }catch(err){
      setError(err?.message || 'Failed to load')
    }

    setLoading(false)
  }

  useEffect(()=>{ load() }, [])

  const statusOptions = ['Submitted', 'Pending', 'Resolved', 'Closed']

  async function handleUpdate(id, status){
    const item = items.find(i => i.complaint_id === id)
    if(!item) return

    if(!status || status === item.status) return

    try{
      const result = mockApi.updateComplaintStatus(id, status)
      if(!result.success) throw new Error(result.message || 'Failed to update status')
      load()
    }catch(err){
      alert('Update failed: ' + (err?.message || 'Unknown error'))
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Header />

        <main>
          <h1 className="page-title">Manage Complaints</h1>

          {error && <div className="field-error">{error}</div>}

          {loading ? (
            <div className="empty-state">Loading complaints...</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Resident</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(it => (
                    <tr key={it.complaint_id}>
                      <td>{it.complaint_id}</td>
                      <td>{it.title || it.description?.slice(0,60) || '—'}</td>
                      <td>{it.resident_id || '—'}</td>
                      <td>{new Date(it.date_submitted || Date.now()).toLocaleDateString()}</td>
                      <td>
                        <StatusBadge status={it.status} />
                      </td>
                      <td>
                        <select
                          className="ui-input"
                          value={it.status || 'Submitted'}
                          onChange={(e) => handleUpdate(it.complaint_id, e.target.value)}
                        >
                          {statusOptions.map(option => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{it.updated_at ? new Date(it.updated_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}