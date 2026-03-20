import React, { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import Button from '../components/Button'
import StatusBadge from '../components/StatusBadge'
import '../styles/history.css'
import api from '../api/axios'
import mockApi from '../api/mockApi'

const REQUEST_DOC_TYPES = [
  'Barangay Clearance',
  'Business Permit',
  'Residency Certificate',
  'Certificate of Indigency'
]

export default function ManageDocuments(){

  const [items,setItems] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState(null)
  const [requestType, setRequestType] = useState('Barangay Clearance')
  const [documentStatuses, setDocumentStatuses] = useState([
    { name: 'Barangay Clearance', status: 'Active' },
    { name: 'Business Permit', status: 'Active' },
    { name: 'Residency Certificate', status: 'Disabled' }
  ])

  const toggleDocumentStatus = (idx) => {
    setDocumentStatuses(prev => prev.map((doc, i) =>
      i === idx
        ? { ...doc, status: doc.status === 'Active' ? 'Disabled' : 'Active' }
        : doc
    ))
  }

  async function load(){
    setLoading(true)

    try{
      const data = mockApi.listDocs() // local version of data, keep consistent with mock API
      setItems(data || [])
    }catch(err){
      setError(err?.message || 'Failed to load')
    }

    setLoading(false)
  }

  async function submitRequest(){
    try{
      mockApi.addDoc({
        type: requestType,
        document_type: requestType,
        purpose: `Request for ${requestType}`
      })
      await api.post('/docs', {
        document_type: requestType,
        purpose: `Request for ${requestType}`
      }).catch(() => {})

      load()
      alert(`${requestType} request submitted`)
    }catch(err){
      alert('Error submitting request: ' + (err?.message || 'Unknown error'))
    }
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

          <div className="form-card">
            <h2>Request Document</h2>

            <label htmlFor="doc-type" style={{ display: 'block', marginBottom: '8px' }}>
              Select Type:
            </label>

            <select
              id="doc-type"
              value={requestType}
              onChange={e => setRequestType(e.target.value)}
              className="ui-input"
              style={{ width: '260px', marginBottom: '12px' }}
            >
              {REQUEST_DOC_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <br />

            <Button onClick={submitRequest}>Submit Request</Button>

            <div style={{ marginTop: '10px', fontSize: '14px' }}>
              {REQUEST_DOC_TYPES.join(' | ')}
            </div>
          </div>

          <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Document Name</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {documentStatuses.map((doc, idx) => (
                    <tr key={doc.name}>
                      <td>{doc.name}</td>
                      <td>{doc.status}</td>
                      <td>
                        <button
                          className="table-action"
                          onClick={() => toggleDocumentStatus(idx)}
                          type="button"
                        >
                          {doc.status === 'Active' ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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