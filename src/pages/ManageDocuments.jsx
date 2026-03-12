import React, { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import Button from '../components/Button'
import StatusBadge from '../components/StatusBadge'
import '../styles/history.css'
import api from '../api/axios'

export default function ManageDocuments(){

  const [items,setItems] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState(null)

  async function load(){
    setLoading(true)

    try{
      const res = await api.get('/docs')
      if(res.data?.success) setItems(res.data.data || [])
      else setError(res.data?.message || 'Failed to load')
    }catch(err){
      setError(err.message)
    }

    setLoading(false)
  }

  useEffect(()=>{ load() }, [])

  async function handleUpdate(id){
    const item = items.find(i=>i.request_id===id)
    if(!item) return

    const status = prompt(
      'Set status (Submitted, Pending, Approved, Released):',
      item.status || 'Submitted'
    )

    if(status==null) return

    try{
      await api.put(`/docs/${id}`,{ status })
      load()
    }catch(err){
      alert('Update failed: '+(err?.response?.data?.message || err.message))
    }
  }

  return(
    <div className="app-shell">
      <Sidebar/>

      <div className="main-area">
        <Header/>

        <main>
          <h1 className="page-title">Manage Documents</h1>

          {error && <div className="field-error">{error}</div>}

          {loading ? (
            <div className="empty-state">Loading documents...</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Type</th>
                    <th>Resident</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(it=>(
                    <tr key={it.request_id}>
                      <td>{it.reference_number || it.request_id}</td>
                      <td>{it.document_type || it.document}</td>
                      <td>{it.resident_id || '—'}</td>
                      <td>{new Date(it.date_requested || Date.now()).toLocaleDateString()}</td>
                      <td><StatusBadge status={it.status}/></td>
                      <td>
                        <Button
                          variant="secondary"
                          onClick={()=>handleUpdate(it.request_id)}
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