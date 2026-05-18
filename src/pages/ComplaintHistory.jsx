import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import StatusBadge from '../components/StatusBadge'
import '../styles/history.css'
import api from '../api/axios'
import mockApi from '../api/mockApi'
import { useAuth } from '../context/AuthContext'

export default function ComplaintHistory(){

  const [filter, setFilter] = useState('All')
  const [q, setQ] = useState('')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [useBackend, setUseBackend] = useState(true)
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [isEditingComplaint, setIsEditingComplaint] = useState(false)
  const [editFormData, setEditFormData] = useState({})
  const [editTimeExceeded, setEditTimeExceeded] = useState(false)
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({show: false, complaintId: null})
  const { user: authUser, loading: authLoading } = useAuth()
  const currentUser = authUser || mockApi.getCurrentUser()

  const canDeleteComplaint = (complaint) => {
    if(!currentUser) return false
    const ownerId = Number(complaint.userId ?? complaint.resident_id ?? complaint.user_id ?? complaint.residentId)
    const currentUserId = Number(currentUser?.id ?? currentUser?.user_id ?? currentUser?.userId)
    const isOwner = !Number.isNaN(ownerId) && !Number.isNaN(currentUserId) && ownerId === currentUserId
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'staff'
    return isOwner || isAdmin
  }

  useEffect(() => {
    if(authLoading) return

    const currentUser = authUser || mockApi.getCurrentUser()
    const currentUserId = Number(currentUser?.id ?? currentUser?.user_id ?? currentUser?.userId)

    const loadComplaints = async () => {
      if(!currentUser){
        setData([])
        setLoading(false)
        return
      }

      const isAdminOrStaff = currentUser.role === 'admin' || currentUser.role === 'staff'
      if(!isAdminOrStaff){
        const mockData = mockApi.listComplaintsByUser(currentUserId)
        setData(mockData)
        setUseBackend(false)
        setLoading(false)
        return
      }

      try {
        const res = await api.get('/complaints')
        if(res?.data?.success && Array.isArray(res.data.data)){
          setData(res.data.data)
          setUseBackend(true)
          setLoading(false)
          return
        }
        throw new Error(res?.data?.message || 'Invalid complaints response')
      } catch(err) {
        const mockData = mockApi.listComplaints()
        setData(mockData)
        setUseBackend(false)
        if(err && err.message){
          console.log('Complaint backend unavailable, using local mock data:', err.message)
        }
        setLoading(false)
      }
    }

    loadComplaints()
  }, [authUser, authLoading])

  const handleViewComplaint = (complaint) => {
    setSelectedComplaint(complaint)
    setIsEditingComplaint(false)
    setEditFormData({})
    setEditTimeExceeded(false)
    checkIfCanEdit(complaint)
  }

  const checkIfCanEdit = (complaint) => {
    const submittedTime = new Date(complaint.date_submitted).getTime()
    const currentTime = new Date().getTime()
    const minutesElapsed = (currentTime - submittedTime) / (1000 * 60)
    setEditTimeExceeded(minutesElapsed > 15)
  }

  const isProcessStatus = (st) => {
    if(!st) return false
    const s = String(st).toLowerCase()
    return ['pending', 'in process', 'inprocess', 'resolved', 'closed', 'released', 'received'].some(p => s.includes(p))
  }

  const handleDeleteComplaint = (complaintId) => {
    const complaint = data.find(item => String(item.complaint_id) === String(complaintId))
    if(!complaint || !canDeleteComplaint(complaint)) return
    setDeleteConfirmModal({show: true, complaintId})
  }

  const confirmDeleteComplaint = async () => {
    const complaintId = deleteConfirmModal.complaintId
    const currentUser = authUser || mockApi.getCurrentUser()
    if(!currentUser) return

    const complaint = data.find(item => String(item.complaint_id) === String(complaintId))
    if(!complaint) return

    let result = { success: false, message: 'Unable to delete complaint' }
    let attemptedBackend = false

    try {
      const res = await api.delete(`/complaints/${complaintId}`)
      attemptedBackend = true
      if(res?.data?.success){
        result = { success: true }
      } else {
        result = { success: false, message: res?.data?.message || 'Failed to delete complaint' }
      }
    } catch(err) {
      if(err.response){
        result = { success: false, message: err.response?.data?.message || err.message || 'Failed to delete complaint' }
      }
    }

    if(!result.success && !attemptedBackend){
      result = mockApi.deleteComplaint(complaintId, currentUser)
    }

    if(result.success){
      if(attemptedBackend){
        try {
          mockApi.deleteComplaint(complaintId, currentUser)
        } catch {}
      }
      setData(prevData => prevData.filter(item => String(item.complaint_id) !== String(complaintId)))
      setSelectedComplaint(null)
      try {
        localStorage.setItem('complaint_sync', Date.now().toString())
      } catch {}
    } else {
      alert(result.message || 'Failed to delete complaint')
    }

    setDeleteConfirmModal({show: false, complaintId: null})
  }

  const cancelDeleteComplaint = () => {
    setDeleteConfirmModal({show: false, complaintId: null})
  }

  const handleEditClick = () => {
    if(!editTimeExceeded && !isProcessStatus(selectedComplaint?.status)){
      setEditFormData({
        title: selectedComplaint.title || '',
        category: selectedComplaint.category || '',
        description: selectedComplaint.description || '',
        location: selectedComplaint.location || '',
        notes: selectedComplaint.notes || ''
      })
      setIsEditingComplaint(true)
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
    const status = selectedComplaint?.status || ''
    if(isProcessStatus(status)){
      alert('Cannot edit a complaint that is already in process or completed.')
      return
    }

    const result = mockApi.updateComplaint(selectedComplaint.complaint_id, editFormData, currentUser)

    if(result.success) {
      const saved = result.data || { ...selectedComplaint, ...editFormData }
      const updatedData = data.map(c => 
        c.complaint_id === selectedComplaint.complaint_id ? saved : c
      )
      setData(updatedData)
      setSelectedComplaint(saved)
      setIsEditingComplaint(false)
    } else {
      alert(result.message || 'Failed to update complaint')
    }
  }

  const handleCancelEdit = () => {
    setIsEditingComplaint(false)
    setEditFormData({})
  }

  const closeModal = () => {
    setSelectedComplaint(null)
    setIsEditingComplaint(false)
  }

  const getStatusEmoji = (status) => {
    const normalized = (status || '').toLowerCase()
    if(normalized.includes('processed') || normalized.includes('resolved') || normalized.includes('approved')) return '🟢'
    if(normalized.includes('processing') || normalized.includes('in progress')) return '🟡'
    if(normalized.includes('pending') || normalized.includes('submitted')) return '⚪'
    return '⚪'
  }

  const summaryItems = data.slice(0, 3).map(item => ({
    complaint: item.title || item.category || `C-${item.complaint_id}`,
    statusText: `${item.status || 'Pending'} ${getStatusEmoji(item.status)}`
  }))

  const list = data.filter(item =>
    (filter === 'All' || item.status === filter) &&
    (q === '' ||
      item.complaint_id?.toString().includes(q) ||
      item.title?.toLowerCase().includes(q.toLowerCase())
    )
  )

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Header title="Complaint History" />

        <main>
          <h1 className="page-title">Complaint History</h1>

          <div className="history-card">

            <div className="history-controls">
              <div className="filter-group">
                <select
                  className="ui-input"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                >
                  <option>All</option>
                  <option>Resolved</option>
                  <option>Pending</option>
                </select>

                <input
                  className="ui-input"
                  placeholder="Search by Ref or Title"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="empty-state">Loading complaints...</div>
            ) : list.length === 0 ? (
              <div className="empty-state">No complaints found.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Resident</th>
                      <th>Category</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(r => (
                      <tr key={r.complaint_id}>
                        <td>{r.ref || `C-${r.complaint_id}`}</td>
                        <td>{r.resident_name || r.name || r.resident_id || '—'}</td>
                        <td>{r.category || r.category_id || '—'}</td>
                        <td>{r.date_submitted ? new Date(r.date_submitted).toLocaleDateString('en-US') : '—'}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td>
                          <button 
                            className="table-action"
                            onClick={() => handleViewComplaint(r)}
                          >
                            View
                          </button>
                          {canDeleteComplaint(r) && (
                            <button 
                              className="table-action table-action-danger"
                              onClick={() => handleDeleteComplaint(r.complaint_id)}
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

          {/* COMPLAINT DETAILS MODAL */}
          {selectedComplaint && (
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

                <h2 className="modal-title">Complaint Details</h2>

                {!isEditingComplaint ? (
                  <>
                    <div className="complaint-detail-row">
                      <span className="detail-label">Reference:</span>
                      <span className="detail-value">{selectedComplaint.ref || `C-${selectedComplaint.complaint_id}`}</span>
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Resident:</span>
                      <span className="detail-value">{selectedComplaint.resident_name || selectedComplaint.name || selectedComplaint.resident_id || '—'}</span>
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Category:</span>
                      <span className="detail-value">{selectedComplaint.category || selectedComplaint.category_id || '—'}</span>
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Title:</span>
                      <span className="detail-value">{selectedComplaint.title || '—'}</span>
                    </div>

                    <div className="complaint-detail-row full-width">
                      <span className="detail-label">Description:</span>
                      <p className="detail-value description">{selectedComplaint.description || '—'}</p>
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Location:</span>
                      <span className="detail-value">{selectedComplaint.location || '—'}</span>
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Date Submitted:</span>
                      <span className="detail-value">{selectedComplaint.date_submitted ? new Date(selectedComplaint.date_submitted).toLocaleDateString('en-US') : '—'}</span>
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Status:</span>
                      <span className="detail-value"><StatusBadge status={selectedComplaint.status} /></span>
                    </div>

                    {selectedComplaint.notes && selectedComplaint.notes.trim() && (
                      <div className="complaint-detail-row full-width">
                        <span className="detail-label">Notes:</span>
                        <p className="detail-value description">{selectedComplaint.notes}</p>
                      </div>
                    )}

                    {selectedComplaint.anonymous && (
                      <div className="complaint-detail-row">
                        <span className="detail-label">Anonymous:</span>
                        <span className="detail-value">Yes</span>
                      </div>
                    )}

                    {editTimeExceeded && (
                      <div className="edit-time-warning">
                        Cannot edit - 15 minutes have passed since submission
                      </div>
                    )}

                    <div className="modal-actions">
                      <button 
                        className="modal-action-btn modal-action-edit"
                        onClick={handleEditClick}
                        disabled={editTimeExceeded || isProcessStatus(selectedComplaint?.status)}
                        type="button"
                      >
                        Edit
                      </button>
                      {canDeleteComplaint(selectedComplaint) && (
                        <button 
                          className="modal-action-btn modal-action-delete"
                          onClick={() => handleDeleteComplaint(selectedComplaint.complaint_id)}
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
                      <span className="detail-label">Category:</span>
                      <select
                        className="edit-field"
                        value={editFormData.category || ''}
                        onChange={(e) => handleEditFieldChange('category', e.target.value)}
                      >
                        <option value="">Select Category</option>
                        <option value="Noise">Noise</option>
                        <option value="Garbage">Garbage</option>
                        <option value="Traffic">Traffic</option>
                      </select>
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Title:</span>
                      <input
                        type="text"
                        className="edit-field"
                        value={editFormData.title || ''}
                        onChange={(e) => handleEditFieldChange('title', e.target.value)}
                        placeholder="Complaint title"
                      />
                    </div>

                    <div className="complaint-detail-row full-width">
                      <span className="detail-label">Description:</span>
                      <textarea
                        className="edit-field edit-textarea"
                        value={editFormData.description || ''}
                        onChange={(e) => handleEditFieldChange('description', e.target.value)}
                        placeholder="Complaint description"
                        rows={4}
                      />
                    </div>

                    <div className="complaint-detail-row">
                      <span className="detail-label">Location:</span>
                      <input
                        type="text"
                        className="edit-field"
                        value={editFormData.location || ''}
                        onChange={(e) => handleEditFieldChange('location', e.target.value)}
                        placeholder="Location"
                      />
                    </div>

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
              onClick={cancelDeleteComplaint}
            >
              <div className="modal-card confirm-delete-modal" onClick={(e) => e.stopPropagation()}>
                <p className="delete-modal-message">
                  Are you sure you want to delete this complaint? This action cannot be undone.
                </p>
                
                <div className="modal-actions confirm-actions">
                  <button 
                    className="modal-action-btn modal-action-cancel"
                    onClick={cancelDeleteComplaint}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button 
                    className="modal-action-btn modal-action-delete"
                    onClick={confirmDeleteComplaint}
                    type="button"
                  >
                    Delete Permanently
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