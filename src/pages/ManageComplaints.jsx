import React, { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import StatusBadge from '../components/StatusBadge'
import '../styles/history.css'
import mockApi from '../api/mockApi'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export default function ManageComplaints(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedComplaint, setSelectedComplaint] = useState(null)

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

  const handleViewComplaint = (complaint) => {
    setSelectedComplaint(complaint)
  }

  const closeModal = () => {
    setSelectedComplaint(null)
  }

  const wrapText = (text, maxChars = 72) => {
    return String(text || '').split('\n').flatMap(line => {
      if(line.length <= maxChars) return [line]
      const words = line.split(' ')
      const lines = []
      let current = ''
      words.forEach(word => {
        if((current + ' ' + word).trim().length > maxChars){
          lines.push(current.trim())
          current = word
        } else {
          current = (current + ' ' + word).trim()
        }
      })
      if(current) lines.push(current.trim())
      return lines
    })
  }

  async function handleDownloadPdf(complaint){
    const record = complaint || selectedComplaint
    if(!record) return

    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([620, 520])
    const { height } = page.getSize()
    const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const header = 'Barangay Complaint Record'
    let y = height - 40

    page.drawText(header, {
      x: 40,
      y,
      size: 18,
      font: boldFont,
      color: rgb(0, 0, 0)
    })

    y -= 32

    const content = [
      `Reference: ${record.ref || `C-${record.complaint_id}`}`,
      `Title: ${record.title || 'N/A'}`,
      `Category: ${record.category || record.category_id || 'N/A'}`,
      `Resident: ${record.resident_name || record.name || record.resident_id || record.userId || 'N/A'}`,
      `Location: ${record.location || 'N/A'}`,
      `Date Submitted: ${record.date_submitted ? new Date(record.date_submitted).toLocaleDateString() : 'N/A'}`,
      `Status: ${record.status || 'Submitted'}`,
      '',
      'Complaint Letter:',
      ...wrapText(record.description || 'No description provided.', 72),
      '',
      'Notes:',
      ...wrapText(record.notes || 'None', 72)
    ]

    content.forEach(line => {
      page.drawText(line, {
        x: 40,
        y,
        size: 12,
        font: /Complaint Letter:|Notes:/.test(line) ? boldFont : normalFont,
        color: rgb(0, 0, 0)
      })
      y -= 18
      if(y < 40){
        y = height - 40
        const nextPage = pdfDoc.addPage([620, 520])
        page = nextPage
      }
    })

    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const fileNameText = (record.ref || `C-${record.complaint_id}`).replace(/[^a-zA-Z0-9-_]/g, '_')
    link.download = `${fileNameText}_complaint.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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
            <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Resident</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(it => (
                    <tr key={it.complaint_id}>
                      <td>{it.complaint_id}</td>
                      <td>{it.title || it.description?.slice(0,60) || '—'}</td>
                      <td>{it.resident_name || it.name || it.resident_id || '—'}</td>
                      <td>{new Date(it.date_submitted || Date.now()).toLocaleDateString()}</td>
                      <td>
                        <StatusBadge status={it.status} />
                      </td>
                      <td>
                        <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                          {new Date(it.date_updated || it.date_submitted || Date.now()).toLocaleDateString()}
                          <div style={{ fontSize: '0.85rem', marginTop: '4px', fontWeight: '700' }}>
                            {new Date(it.date_updated || it.date_submitted || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="table-actions-inline" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <select
                            className="ui-input"
                            value={it.status || 'Submitted'}
                            onChange={(e) => handleUpdate(it.complaint_id, e.target.value)}
                            style={{ height: '36px', fontSize: '0.9rem', maxWidth: '140px' }}
                          >
                            {statusOptions.map(option => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="table-action"
                            onClick={() => handleViewComplaint(it)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="table-action"
                            onClick={() => handleDownloadPdf(it)}
                          >
                            Download PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>

            {selectedComplaint && (
              <div className="modal-overlay" onClick={closeModal}>
                <div className="modal-card complaint-details-modal" onClick={e => e.stopPropagation()}>
                  <button className="modal-close-btn" type="button" onClick={closeModal}>
                    ✕
                  </button>

                  <h2 className="modal-title">Complaint Details</h2>

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
                    <span className="detail-label">Complaint Letter:</span>
                    <p className="detail-value description">{selectedComplaint.description || '—'}</p>
                  </div>

                  <div className="complaint-detail-row">
                    <span className="detail-label">Location:</span>
                    <span className="detail-value">{selectedComplaint.location || '—'}</span>
                  </div>

                  <div className="complaint-detail-row">
                    <span className="detail-label">Submitted:</span>
                    <span className="detail-value">{selectedComplaint.date_submitted ? new Date(selectedComplaint.date_submitted).toLocaleDateString() : '—'}</span>
                  </div>

                  <div className="complaint-detail-row">
                    <span className="detail-label">Status:</span>
                    <span className="detail-value"><StatusBadge status={selectedComplaint.status} /></span>
                  </div>

                  {selectedComplaint.notes && selectedComplaint.notes.trim() && (
                    <div className="complaint-detail-row full-width">
                      <span className="detail-label">Admin Notes:</span>
                      <p className="detail-value description">{selectedComplaint.notes}</p>
                    </div>
                  )}

                  <button className="modal-action-btn" type="button" onClick={() => handleDownloadPdf(selectedComplaint)}>
                    Download Complaint PDF
                  </button>
                  <button className="modal-action-btn" type="button" onClick={closeModal}>
                    Close
                  </button>
                </div>
              </div>
            )}
            </>
          )}

        </main>
      </div>
    </div>
  )
}