import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import '../styles/history.css'
import api from '../api/axios'
import mockApi from '../api/mockApi'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'

export default function DocumentHistory(){

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [isEditingDocument, setIsEditingDocument] = useState(false)
  const [editFormData, setEditFormData] = useState({})
  const [editTimeExceeded, setEditTimeExceeded] = useState(false)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({show: false, docId: null})
  const { user: authUser, loading: authLoading } = useAuth()
  const currentUser = authUser || mockApi.getCurrentUser()

  const canDeleteDocument = (doc) => {
    if(!currentUser) return false
    const ownerId = Number(doc.userId ?? doc.resident_id ?? doc.user_id ?? doc.residentId)
    const currentUserId = Number(currentUser?.id ?? currentUser?.user_id ?? currentUser?.userId)
    const isOwner = !Number.isNaN(ownerId) && !Number.isNaN(currentUserId) && ownerId === currentUserId
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'staff'
    return isOwner || isAdmin
  }

  useEffect(() => {
    if(authLoading) return

    const currentUser = authUser || mockApi.getCurrentUser()
    const currentUserId = Number(currentUser?.id ?? currentUser?.user_id ?? currentUser?.userId)

    let mockData = []
    if(currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff')){
      mockData = mockApi.listDocs()
    } else if(currentUser){
      mockData = mockApi.listDocsByUser(currentUserId)
    } else {
      mockData = []
    }

    setData(mockData)
    setLoading(false)
  }, [authUser, authLoading])

  const handleViewDocument = (doc) => {
    setSelectedDocument(doc)
    setIsEditingDocument(false)
    setEditFormData({})
    setEditTimeExceeded(false)
    checkIfCanEdit(doc)
  }

  const checkIfCanEdit = (doc) => {
    const requestedTime = new Date(doc.date_requested).getTime()
    const currentTime = new Date().getTime()
    const minutesElapsed = (currentTime - requestedTime) / (1000 * 60)
    setEditTimeExceeded(minutesElapsed > 15)
  }

  const isProcessStatus = (st) => {
    if(!st) return false
    const s = String(st).toLowerCase()
    return ['pending', 'in process', 'inprocess', 'resolved', 'closed', 'released', 'received'].some(p => s.includes(p))
  }

  const closeModal = () => {
    setSelectedDocument(null)
    setIsEditingDocument(false)
  }

  const handleDeleteDocument = (docId) => {
    const doc = data.find(item => String(item.request_id) === String(docId))
    if(!doc || !canDeleteDocument(doc)) return
    setDeleteConfirmModal({show: true, docId})
  }

  const confirmDeleteDocument = () => {
    const docId = deleteConfirmModal.docId
    const currentUser = authUser || mockApi.getCurrentUser()
    if(!currentUser) return
    
    const doc = data.find(item => String(item.request_id) === String(docId))
    if(!doc) return
    
    const result = mockApi.deleteDoc(docId, currentUser)
    
    if(result.success){
      let updatedData = []
      const currentUserId = Number(currentUser?.id ?? currentUser?.user_id ?? currentUser?.userId)
      if(currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff')){
        updatedData = mockApi.listDocs()
      } else if(currentUser){
        updatedData = mockApi.listDocsByUser(currentUserId)
      }
      setData(updatedData)
      setSelectedDocument(null)
    } else {
      alert(result.message || 'Failed to delete document')
    }
    
    setDeleteConfirmModal({show: false, docId: null})
  }

  const cancelDeleteDocument = () => {
    setDeleteConfirmModal({show: false, docId: null})
  }

  const handleEditClick = () => {
    const status = selectedDocument?.status || ''

    if(!editTimeExceeded && !isProcessStatus(status)){
      setEditFormData({
        document_type: selectedDocument.document_type || '',
        purpose: selectedDocument.purpose || '',
        name: selectedDocument.name || '',
        birthdate: selectedDocument.birthdate || '',
        address: selectedDocument.address || '',
        business_name: selectedDocument.business_name || '',
        notes: selectedDocument.notes || ''
      })
      setIsEditingDocument(true)
    }
  }

  const handleEditFieldChange = (field, value) => {
    setEditFormData(prev => ({...prev, [field]: value}))
  }

  const handleSaveEdit = () => {
    const currentUser = authUser || mockApi.getCurrentUser()
    if(!currentUser) {
      alert('Not authenticated')
      return
    }
    const status = selectedDocument?.status || ''

    if(isProcessStatus(status)){
      alert('Cannot edit a document that is already in process or completed.')
      return
    }

    const result = mockApi.updateDoc(selectedDocument.request_id, editFormData, currentUser)

    if(result.success) {
      const saved = result.data || { ...selectedDocument, ...editFormData }
      const updatedData = data.map(d => 
        d.request_id === selectedDocument.request_id ? saved : d
      )
      setData(updatedData)
      setSelectedDocument(saved)
      setIsEditingDocument(false)
    } else {
      alert(result.message || 'Failed to update document')
    }
  }

  const handleCancelEdit = () => {
    setIsEditingDocument(false)
    setEditFormData({})
  }

  const [receivedConfirmModal, setReceivedConfirmModal] = useState({show: false})

  const openReceivedConfirm = () => {
    setReceivedConfirmModal({show: true})
  }

  const handleMarkReceived = () => {
    const currentUser = authUser || mockApi.getCurrentUser()
    if(!currentUser){
      alert('Not authenticated')
      setReceivedConfirmModal({show: false})
      return
    }

    const status = selectedDocument?.status || ''
    if(!String(status).toLowerCase().includes('released')){
      alert('Document is not released')
      setReceivedConfirmModal({show: false})
      return
    }

    const result = mockApi.updateDocStatus(selectedDocument.request_id, 'Received')
    if(result.success){
      const saved = result.data
      const updatedData = data.map(d => d.request_id === selectedDocument.request_id ? saved : d)
      setData(updatedData)
      setSelectedDocument(saved)

      try{
        mockApi.notifyAdmins({
          message: `Document ${saved.reference_number || saved.request_id} was marked as Received by ${currentUser.name || currentUser.email || 'a user'}`,
          category: 'document_received',
          data: { request_id: saved.request_id }
        })
      } catch(e){
        // ignore notification failure in mock
        console.warn('notifyAdmins failed', e)
      }

      setReceivedConfirmModal({show: false})
    } else {
      alert(result.message || 'Failed to mark as received')
      setReceivedConfirmModal({show: false})
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Header title="Document History" />

        <main>
          <h1 className="page-title">Document History</h1>

          <div className="history-card">

            {loading ? (
              <div className="empty-state">Loading documents...</div>
            ) : data.length === 0 ? (
              <div className="empty-state">No document requests found.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Resident</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(d => (
                      <tr key={d.request_id}>
                        <td>{d.reference_number}</td>
                        <td>{d.name || d.resident_id || '—'}</td>
                        <td>{d.document_type}</td>
                        <td>{new Date(d.date_requested).toLocaleDateString('en-US')}</td>
                        <td><StatusBadge status={d.status} /></td>
                        <td>
                          <button 
                            className="table-action"
                            onClick={() => handleViewDocument(d)}
                          >
                            View
                          </button>
                          {canDeleteDocument(d) && (
                            <button 
                              className="table-action table-action-danger"
                              onClick={() => handleDeleteDocument(d.request_id)}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>

          {/* DOCUMENT DETAILS MODAL */}
          {selectedDocument && (
            <div
              className="modal-overlay"
              onClick={closeModal}
            >
              <div className="modal-card complaint-details-modal" onClick={(e) => e.stopPropagation()}>
                <button 
                  className="modal-close-btn"
                  onClick={closeModal}
                  type="button"
                >
                  ✕
                </button>

                <h2 className="modal-title">Document Request Details</h2>

                {!isEditingDocument ? (
                  <>
                    <div className="complaint-detail-row">
                      <span className="detail-label">Reference:</span>
                      <span className="detail-value">{selectedDocument.reference_number || `DOC-${selectedDocument.request_id}`}</span>
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Resident:</span>
                      <span className="detail-value">{selectedDocument.name || selectedDocument.resident_id || '—'}</span>
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Document Type:</span>
                      <span className="detail-value">{selectedDocument.document_type || '—'}</span>
                    </div>

                    <div className="complaint-detail-row full-width">
                      <span className="detail-label">Purpose:</span>
                      <p className="detail-value description">{selectedDocument.purpose || '—'}</p>
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Birthdate:</span>
                      <span className="detail-value">{selectedDocument.birthdate || '—'}</span>
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Address:</span>
                      <span className="detail-value">{selectedDocument.address || '—'}</span>
                    </div>

                    {selectedDocument.business_name && (
                      <div className="complaint-detail-row">
                        <span className="detail-label">Business Name:</span>
                        <span className="detail-value">{selectedDocument.business_name}</span>
                      </div>
                    )}

                    <div className="complaint-detail-row">
                      <span className="detail-label">Date Requested:</span>
                      <span className="detail-value">{selectedDocument.date_requested ? new Date(selectedDocument.date_requested).toLocaleDateString('en-US') : '—'}</span>
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Status:</span>
                      <span className="detail-value"><StatusBadge status={selectedDocument.status} /></span>
                    </div>

                    {selectedDocument.notes && selectedDocument.notes.trim() && (
                      <div className="complaint-detail-row full-width">
                        <span className="detail-label">Notes:</span>
                        <p className="detail-value description">{selectedDocument.notes}</p>
                      </div>
                    )}

                    {editTimeExceeded && (
                      <div className="edit-time-warning">
                        Cannot edit - 15 minutes have passed since request
                      </div>
                    )}

                    <div className="modal-actions">
                      {String(selectedDocument.status || '').toLowerCase().includes('released') && (
                        <button
                          className="modal-action-btn modal-action-received"
                          onClick={openReceivedConfirm}
                          type="button"
                        >
                          Mark Received
                        </button>
                      )}

                      <button 
                        className="modal-action-btn modal-action-edit"
                        onClick={handleEditClick}
                        disabled={editTimeExceeded || isProcessStatus(selectedDocument?.status)}
                        type="button"
                      >
                        Edit
                      </button>
                      {canDeleteDocument(selectedDocument) && (
                        <button 
                          className="modal-action-btn modal-action-delete"
                          onClick={() => handleDeleteDocument(selectedDocument.request_id)}
                          type="button"
                        >
                          Delete
                        </button>
                      )}
                      <button 
                        className="modal-action-btn"
                        onClick={closeModal}
                        type="button"
                      >
                        Close
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="complaint-detail-row">
                      <span className="detail-label">Document Type:</span>
                      <select
                        className="edit-field"
                        value={editFormData.document_type || ''}
                        onChange={(e) => handleEditFieldChange('document_type', e.target.value)}
                      >
                        <option value="">Select Document Type</option>
                        <option value="Birth Certificate">Birth Certificate</option>
                        <option value="Barangay Clearance">Barangay Clearance</option>
                        <option value="Residency">Residency</option>
                        <option value="Indigency">Indigency</option>
                      </select>
                    </div>

                    <div className="complaint-detail-row full-width">
                      <span className="detail-label">Purpose:</span>
                      <textarea
                        className="edit-field edit-textarea"
                        value={editFormData.purpose || ''}
                        onChange={(e) => handleEditFieldChange('purpose', e.target.value)}
                        placeholder="Purpose of request"
                        rows={3}
                      />
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Name:</span>
                      <input
                        type="text"
                        className="edit-field"
                        value={editFormData.name || ''}
                        onChange={(e) => handleEditFieldChange('name', e.target.value)}
                        placeholder="Full name"
                      />
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Birthdate:</span>
                      <input
                        type="date"
                        className="edit-field"
                        value={editFormData.birthdate || ''}
                        onChange={(e) => handleEditFieldChange('birthdate', e.target.value)}
                      />
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Address:</span>
                      <input
                        type="text"
                        className="edit-field"
                        value={editFormData.address || ''}
                        onChange={(e) => handleEditFieldChange('address', e.target.value)}
                        placeholder="Address"
                      />
                    </div>

                    {/* Business name removed from edit modal per clearance policy */}

                    <div className="complaint-detail-row full-width">
                      <span className="detail-label">Notes:</span>
                      <textarea
                        className="edit-field edit-textarea"
                        value={editFormData.notes || ''}
                        onChange={(e) => handleEditFieldChange('notes', e.target.value)}
                        placeholder="Additional notes"
                        rows={3}
                      />
                    </div>

                    <div className="modal-actions">
                      <button 
                        className="modal-action-btn modal-action-save"
                        onClick={handleSaveEdit}
                        type="button"
                      >
                        Save Changes
                      </button>
                      <button 
                        className="modal-action-btn modal-action-cancel"
                        onClick={handleCancelEdit}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* DELETE CONFIRMATION MODAL */}
          {deleteConfirmModal.show && (
            <div
              className="modal-overlay"
              onClick={cancelDeleteDocument}
            >
              <div className="modal-card confirm-delete-modal" onClick={(e) => e.stopPropagation()}>
                <div className="delete-modal-icon"></div>
                <h2 className="modal-title">Delete Document Request?</h2>
                <p className="delete-modal-message">
                  Are you sure you want to delete this document request? This action cannot be undone.
                </p>
                
                <div className="modal-actions confirm-actions">
                  <button 
                    className="modal-action-btn modal-action-cancel"
                    onClick={cancelDeleteDocument}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button 
                    className="modal-action-btn modal-action-delete"
                    onClick={confirmDeleteDocument}
                    type="button"
                  >
                    Delete Permanently
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RECEIVED CONFIRMATION MODAL */}
          {receivedConfirmModal.show && (
            <div
              className="modal-overlay"
              onClick={() => setReceivedConfirmModal({show: false})}
            >
              <div className="modal-card confirm-delete-modal" onClick={(e) => e.stopPropagation()}>
                <h2 className="modal-title">Mark Document as Received?</h2>
                <p className="delete-modal-message">Are you sure you want to mark this document as received? Administrators will be notified.</p>

                <div className="modal-actions confirm-actions">
                  <button 
                    className="modal-action-btn modal-action-cancel"
                    onClick={() => setReceivedConfirmModal({show: false})}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button 
                    className="modal-action-btn modal-action-received"
                    onClick={handleMarkReceived}
                    type="button"
                  >
                    Mark Received
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}