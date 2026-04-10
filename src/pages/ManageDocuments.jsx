import React, { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import Button from '../components/Button'
import StatusBadge from '../components/StatusBadge'
import '../styles/history.css'
import '../styles/form.css'
import api from '../api/axios'
import mockApi from '../api/mockApi'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

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
  const [processingRequest, setProcessingRequest] = useState(null)
  const [documentFields, setDocumentFields] = useState({
    name: '',
    birthdate: '',
    address: '',
    purpose: '',
    business_name: '',
    province: '',
    barangay: ''
  })

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

  const getTemplateForType = (value) => {
    const normalized = String(value || '').toLowerCase()
    if(normalized.includes('clearance')) return 'Barangay Clearance'
    if(normalized.includes('residency') || normalized.includes('residence')) return 'Certificate of Residency'
    if(normalized.includes('indigency')) return 'Certificate of Indigency'
    if(normalized.includes('business')) return 'Business Permit'
    return 'Barangay Clearance'
  }

  const getTemplateFields = (template) => {
    switch(template){
      case 'Certificate of Residency':
        return [
          { name: 'name', label: 'Full Name', type: 'text' },
          { name: 'birthdate', label: 'Birthdate', type: 'date' },
          { name: 'address', label: 'Address', type: 'text' },
          { name: 'purpose', label: 'Purpose', type: 'text' }
        ]
      case 'Certificate of Indigency':
        return [
          { name: 'name', label: 'Full Name', type: 'text' },
          { name: 'address', label: 'Address', type: 'text' },
          { name: 'purpose', label: 'Reason for Indigency', type: 'text' }
        ]
      case 'Business Permit':
        return [
          { name: 'name', label: 'Owner Name', type: 'text' },
          { name: 'business_name', label: 'Business Name', type: 'text' },
          { name: 'address', label: 'Business Address', type: 'text' },
          { name: 'purpose', label: 'Purpose', type: 'text' }
        ]
      default:
        return [
          { name: 'name', label: 'Full Name', type: 'text' },
          { name: 'birthdate', label: 'Birthdate', type: 'date' },
          { name: 'address', label: 'Address', type: 'text' },
          { name: 'purpose', label: 'Purpose', type: 'text' }
        ]
    }
  }

  const buildDocumentFields = (item) => ({
    name: item.name || item.resident_name || item.requester_name || '',
    birthdate: item.birthdate || '',
    address: item.address || item.business_address || '',
    purpose: item.purpose || `Request for ${item.document_type || item.type || ''}`,
    business_name: item.business_name || item.document_name || '',
    province: item.province || '',
    barangay: item.barangay || ''
  })

  const handleProcessRequest = (item) => {
    setProcessingRequest(item)
    setDocumentFields(buildDocumentFields(item))
  }

  const handleFieldChange = (field, value) => {
    setDocumentFields(prev => ({ ...prev, [field]: value }))
  }

  const closeProcessingModal = () => {
    setProcessingRequest(null)
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

  const createDocumentPdf = async (item, fields) => {
    const template = getTemplateForType(item.document_type || item.type)
    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([620, 760])
    const { height } = page.getSize()
    const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const rows = [
      'Republic of the Philippines',
      `Province of ${fields.province || '[Province]'}`,
      `Barangay ${fields.barangay || '[Barangay Name]'}`,
      '',
      `Document: ${template}`,
      `Reference: ${item.reference_number || item.request_id || item.id || 'N/A'}`,
      '',
      `Name: ${fields.name || 'N/A'}`,
      template === 'Business Permit' ? `Business Name: ${fields.business_name || 'N/A'}` : null,
      `Address: ${fields.address || 'N/A'}`,
      fields.birthdate ? `Birthdate: ${fields.birthdate}` : null,
      '',
      ...(template === 'Barangay Clearance' ? [
        `This is to certify that ${fields.name || 'the resident'} is a bonafide resident of ${fields.address || 'the barangay'}.`,
        `This certification is issued upon the request of the above named person for ${fields.purpose || 'barangay purposes'}.`
      ] : []),
      ...(template === 'Certificate of Residency' ? [
        `This is to certify that ${fields.name || 'the resident'} currently resides at ${fields.address || 'the address given above'}.`,
        `This certificate is issued for the purpose of ${fields.purpose || 'official use'}.`
      ] : []),
      ...(template === 'Certificate of Indigency' ? [
        `This is to certify that ${fields.name || 'the resident'} is indigent and resides at ${fields.address || 'the address given above'}.`,
        `This certificate is issued for the purpose of ${fields.purpose || 'supporting indigency assistance'}.`
      ] : []),
      ...(template === 'Business Permit' ? [
        `This is to certify that ${fields.business_name || 'the business'} owned by ${fields.name || 'the owner'}`,
        `is operating at ${fields.address || 'the business address'} and is applying for the required permit.`,
        `Purpose: ${fields.purpose || 'Business operation'}`
      ] : []),
      '',
      `Date Issued: ${new Date().toLocaleDateString()}`,
      '',
      'Barangay Captain',
      '__________________________'
    ].filter(Boolean)

    let y = height - 40
    page.drawText('BARANGAY DOCUMENT TEMPLATE', {
      x: 40,
      y,
      size: 18,
      font: titleFont,
      color: rgb(0, 0, 0)
    })

    y -= 32

    rows.forEach(line => {
      const wrapped = wrapText(line, 72)
      wrapped.forEach(row => {
        if(y < 60){
          page = pdfDoc.addPage([620, 760])
          y = height - 40
        }
        page.drawText(row, {
          x: 40,
          y,
          size: row === 'BARANGAY DOCUMENT TEMPLATE' ? 14 : 12,
          font: row.endsWith(':') ? boldFont : normalFont,
          color: rgb(0, 0, 0)
        })
        y -= 18
      })
    })

    return pdfDoc.save()
  }

  const handleDownloadPdf = async () => {
    if(!processingRequest) return
    const pdfBytes = await createDocumentPdf(processingRequest, documentFields)
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const name = (processingRequest.reference_number || processingRequest.request_id || 'document').toString().replace(/[^a-zA-Z0-9-_]/g, '_')
    const template = getTemplateForType(processingRequest.document_type || processingRequest.type)
    link.download = `${name}_${template.replace(/\s+/g, '_')}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handlePrintPdf = async () => {
    if(!processingRequest) return
    const pdfBytes = await createDocumentPdf(processingRequest, documentFields)
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const printWin = window.open(url)
    if(printWin){
      printWin.focus()
      printWin.onload = () => printWin.print()
    } else {
      alert('Unable to open document for printing. Please allow popups.')
    }
  }

  const handleFinalizeRequest = async () => {
    if(!processingRequest) return
    mockApi.updateDocStatus(processingRequest.request_id, 'Released')
    try {
      await api.put(`/docs/${processingRequest.request_id}`, { status: 'Released' })
    } catch {
      // Best-effort; continue with local state
    }
    load()
    setProcessingRequest(null)
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
            <>
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
                        <div className="table-actions-inline">
                          <Button
                            variant="secondary"
                            onClick={()=>handleProcessRequest(it)}
                          >
                            Process
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>

            {processingRequest && (
              <div className="modal-overlay" onClick={closeProcessingModal}>
                <div className="modal-card complaint-details-modal" onClick={e => e.stopPropagation()}>
                  <button className="modal-close-btn" type="button" onClick={closeProcessingModal}>
                    ✕
                  </button>

                  <h2 className="modal-title">Process Document Request</h2>
                  <p className="modal-subtitle">Auto-detected template: {getTemplateForType(processingRequest.document_type || processingRequest.type)}</p>

                  <div className="form-card">
                    <div className="form-field" style={{ marginBottom: '14px' }}>
                      <label className="form-label">Province</label>
                      <input
                        className="ui-input"
                        value={documentFields.province || ''}
                        onChange={e => handleFieldChange('province', e.target.value)}
                      />
                    </div>
                    <div className="form-field" style={{ marginBottom: '14px' }}>
                      <label className="form-label">Barangay Name</label>
                      <input
                        className="ui-input"
                        value={documentFields.barangay || ''}
                        onChange={e => handleFieldChange('barangay', e.target.value)}
                      />
                    </div>
                    {getTemplateFields(getTemplateForType(processingRequest.document_type || processingRequest.type)).map(field => (
                      <div key={field.name} className="form-field" style={{ marginBottom: '14px' }}>
                        <label className="form-label">{field.label}</label>
                        {field.type === 'text' ? (
                          <input
                            className="ui-input"
                            value={documentFields[field.name] || ''}
                            onChange={e => handleFieldChange(field.name, e.target.value)}
                          />
                        ) : (
                          <input
                            type={field.type}
                            className="ui-input"
                            value={documentFields[field.name] || ''}
                            onChange={e => handleFieldChange(field.name, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="table-actions-inline" style={{ marginTop: '18px', justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={handlePrintPdf}>Print</Button>
                    <Button variant="secondary" onClick={handleDownloadPdf}>Download PDF</Button>
                    <Button variant="secondary" onClick={handleFinalizeRequest}>Finalize Request</Button>
                  </div>
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