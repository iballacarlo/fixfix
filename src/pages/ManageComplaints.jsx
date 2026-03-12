import React, { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import Button from '../components/Button'
import StatusBadge from '../components/StatusBadge'
import '../styles/history.css'
import api from '../api/axios'

export default function ManageComplaints(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load(){
    setLoading(true)
    setError(null)

    try{
      const res = await api.get('/complaints')
      if(res.data?.success) setItems(res.data.data || [])
      else setError(res.data?.message || 'Failed to load')
    }catch(err){
      setError(err.message)
    }

    setLoading(false)
  }

  useEffect(()=>{ load() }, [])

  async function handleUpdate(id){
    const item = items.find(i => i.complaint_id === id)
    if(!item) return

    const status = prompt(
      'Set status (Submitted, Pending, Resolved, Closed):',
      item.status || 'Submitted'
    )

    if(status == null) return

    try{
      await api.put(`/complaints/${id}`, { status })
      load()
    }catch(err){
      alert('Update failed: ' + (err?.response?.data?.message || err.message))
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
                        <Button
                          variant="secondary"
                          onClick={()=>handleUpdate(it.complaint_id)}
                        >
                          Change Status
                        </Button>
                      </td>
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