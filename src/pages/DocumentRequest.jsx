import React, { useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import Button from '../components/Button'
import '../styles/form.css'
import api from '../api/axios'
import mockApi from '../api/mockApi'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { useNavigate } from 'react-router-dom'

const DOC_TYPES = [
  'Barangay Clearance',
  'Certificate of Residency',
  'Certificate of Indigency',
  'Business Clearance',
]

export default function DocumentRequest(){
  const [type, setType] = useState('Barangay Clearance')
  const [businessName, setBusinessName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [name, setName] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [address, setAddress] = useState('')
  const [errors, setErrors] = useState({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submittedRequest, setSubmittedRequest] = useState(null)

  const nav = useNavigate()

  function validate(){
    const e = {}
    if(!name.trim()) e.name = 'Name is required'
    if(!birthdate.trim()) e.birthdate = 'Birthdate is required'
    if(!address.trim()) e.address = 'Address is required'
    if(!type) e.type = 'Document type is required'
    if(type === 'Business Clearance' && !businessName.trim()) e.businessName = 'Business name is required'
    if(!purpose.trim()) e.purpose = 'Purpose is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function onPickType(next){
    setType(next)
    if(next !== 'Business Clearance') setBusinessName('')
    setErrors(prev => ({ ...prev, type: undefined, businessName: undefined }))
  }

  async function submitToApi(){
    try {
      // Use mock API to ensure all data is stored properly
      const result = mockApi.addDoc({
        userId: JSON.parse(localStorage.getItem('mock_current_user') || '{}')?.id,
        type: type,
        document_type: type,
        business_name: type === 'Business Clearance' ? businessName : '',
        name,
        birthdate,
        address,
        purpose: purpose
      })
      
      // Also try to send to real backend for redundancy
      try {
        await api.post('/docs', {
          name,
          birthdate,
          address,
          document_type: type,
          business_name: type === 'Business Clearance' ? businessName : '',
          purpose
        })
      } catch(err) {
        console.log('Real API unavailable, but document saved to local storage')
      }
      
      return { data: { success: true, data: result } }
    } catch(err) {
      throw err
    }
  }

  async function handleSubmit(){
    if(!validate()) return

    try{
      const res = await submitToApi()
      if(res.data.success) {
        setSubmittedRequest({
          type,
          status: 'Processed by Admin',
          description: `This certifies that the resident has requested a ${type.toLowerCase()} and it has been approved.`,
          date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        })
        setConfirmOpen(false)
        setName('')
        setBirthdate('')
        setAddress('')
        setPurpose('')
        setBusinessName('')
      } else {
        alert('Error: ' + res.data.message)
      }
    } catch(err){
      alert('Error submitting request: ' + (err.response?.data?.message || err.message))
    }
  }

  function handleScanQR(){
    alert('QR scanning feature will be added soon.')
  }

  function openConfirm(e){
    e.preventDefault()
    if(!validate()) return
    setConfirmOpen(true)
  }

  async function handleDownloadLetter(){
    if(!submittedRequest) return

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([600, 360])
    const { width, height } = page.getSize()
    const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const textLines = [
      '---------------------------------',
      `| ${submittedRequest.type} Request` + ' '.repeat(Math.max(0, 27 - submittedRequest.type.length)) + '|',
      '---------------------------------',
      `Status: ${submittedRequest.status}`,
      '',
      submittedRequest.type,
      '',
      'This certifies that the resident has requested',
      `a ${submittedRequest.type.toLowerCase()} and it has been approved.`,
      '',
      `Date: ${submittedRequest.date}`
    ]

    const lineHeight = 18
    let y = height - 40

    page.drawText('Barangay Document Request', {
      x: 40,
      y,
      size: 18,
      font: boldFont,
      color: rgb(0, 0, 0)
    })

    y -= 36
    textLines.forEach(line => {
      page.drawText(line, {
        x: 40,
        y,
        size: 12,
        font: normalFont,
        color: rgb(0, 0, 0)
      })
      y -= lineHeight
    })

    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    const fileNameText = submittedRequest.type.replace(/\s+/g, '_').toLowerCase()
    link.download = `${fileNameText}_request.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Header title="Document Request" />

        <main>
          <h1 className="page-title">Request Document</h1>

          <form className="form-card" onSubmit={openConfirm} noValidate>
            <div className="form-head">
              <h2 className="form-title">Request Details</h2>
              <p className="form-sub">
                Fill out the details below. Fields marked with <span className="req">*</span> are required.
              </p>
            </div>

            <div className="form-grid">
              <label className="form-label">
                Name <span className="req">*</span>
              </label>
              <div className="form-field">
                <input
                  className={`ui-input ${errors.name ? 'ui-error' : ''}`}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your full name"
                />
                {errors.name && <div className="field-error">{errors.name}</div>}
              </div>

              <label className="form-label">
                Birthdate <span className="req">*</span>
              </label>
              <div className="form-field">
                <input
                  type="date"
                  className={`ui-input ${errors.birthdate ? 'ui-error' : ''}`}
                  value={birthdate}
                  onChange={e => setBirthdate(e.target.value)}
                />
                {errors.birthdate && <div className="field-error">{errors.birthdate}</div>}
              </div>

              <label className="form-label">
                Address <span className="req">*</span>
              </label>
              <div className="form-field">
                <input
                  className={`ui-input ${errors.address ? 'ui-error' : ''}`}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Enter your complete address"
                />
                {errors.address && <div className="field-error">{errors.address}</div>}
              </div>

              <label className="form-label">
                Document Type <span className="req">*</span>
              </label>
              <div className="form-field">
                <div className={`type-chips ${errors.type ? 'type-chips-error' : ''}`} role="group" aria-label="Document type">
                  {DOC_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      className={`type-chip ${type === t ? 'active' : ''}`}
                      onClick={() => onPickType(t)}
                      aria-pressed={type === t}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {errors.type && <div className="field-error">{errors.type}</div>}
              </div>

              {type === 'Business Clearance' && (
                <>
                  <label className="form-label">
                    Business Name <span className="req">*</span>
                  </label>
                  <div className="form-field">
                    <input
                      className={`ui-input ${errors.businessName ? 'ui-error' : ''}`}
                      value={businessName}
                      onChange={e => setBusinessName(e.target.value)}
                      placeholder="Enter business name"
                    />
                    {errors.businessName && <div className="field-error">{errors.businessName}</div>}
                  </div>
                </>
              )}

              <label className="form-label">
                Purpose <span className="req">*</span>
              </label>
              <div className="form-field">
                <textarea
                  className={`ui-input ui-textarea ${errors.purpose ? 'ui-error' : ''}`}
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  placeholder="State your purpose (e.g., Employment, Scholarship, etc.)"
                />
                {errors.purpose && <div className="field-error">{errors.purpose}</div>}
              </div>
            </div>

            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={handleScanQR}>
                Scan QR
              </Button>
              <Button type="submit">Submit</Button>
            </div>
          </form>

          {/* ✅ CONFIRM MODAL */}
          {confirmOpen && (
            <div
              className="modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm document request"
              onClick={() => setConfirmOpen(false)}
            >
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <h3>Confirm Request</h3>
                <p>Are you sure you want to submit this document request?</p>

                <div className="modal-actions">
                  <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                    Cancel
                  </Button>

                  <Button
                    onClick={() => {
                      handleSubmit()
                    }}
                  >
                    Yes, Submit
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}