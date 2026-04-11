import React, { useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import Button from '../components/Button'
import InputField from '../components/InputField'
import '../styles/form.css'
import api from '../api/axios'
import mockApi from '../api/mockApi'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function ComplaintForm(){
  const { user } = useAuth()
  const [form, setForm] = useState({
    resident_name: user?.name || '',
    category: '',
    title: '',
    description: '',
    location: '',
    date: '',
    anonymous: false,
    images: [], // Changed from image to images array
  })

  const [errors, setErrors] = useState({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [previews, setPreviews] = useState([]) // Store preview URLs
  const [expandedPreview, setExpandedPreview] = useState(null) // For expanded view

  const nav = useNavigate()

  function setField(key, value){
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleFileChange(e){
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/') || file.type.startsWith('video/')
      const isValidSize = file.size <= 10 * 1024 * 1024 // 10MB limit
      return isValidType && isValidSize
    })

    if (validFiles.length !== files.length) {
      alert('Some files were skipped. Only images/videos under 10MB are allowed.')
    }

    // Create preview URLs
    const newPreviews = validFiles.map(file => ({
      url: URL.createObjectURL(file),
      type: file.type,
      name: file.name
    }))

    setField('images', [...form.images, ...validFiles])
    setPreviews([...previews, ...newPreviews])
    // Reset the input so the same file can be selected again if needed
    e.target.value = ''
  }

  function removeFile(index){
    // Clean up the preview URL
    if (previews[index]) {
      URL.revokeObjectURL(previews[index].url)
    }
    setField('images', form.images.filter((_, i) => i !== index))
    setPreviews(previews.filter((_, i) => i !== index))
  }

  function validate(){
    const e = {}
    if(!form.category) e.category = 'Category required'
    if(!form.title) e.title = 'Title required'
    if(!form.description) e.description = 'Description required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submitToApi(){
    try {
      const residentName = form.resident_name || user?.name || ''

      // Use mock API to ensure all data is stored properly
      const result = mockApi.addComplaint({
        category: form.category,
        title: form.title,
        description: form.description,
        location: form.location,
        date: form.date,
        anonymous: form.anonymous,
        images: form.images,
        resident_name: residentName
      })
      
      // Also try to send to real backend for redundancy
      try {
        const formData = new FormData()
        Object.keys(form).forEach(key => {
          if (key === 'images') {
            form.images.forEach((file, index) => {
              formData.append(`images[${index}]`, file)
            })
          } else {
            formData.append(key, form[key])
          }
        })
        if (form.resident_name) {
          formData.append('resident_name', form.resident_name)
        } else if (user?.name) {
          formData.append('resident_name', user.name)
        }
        await api.post('/complaints', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
      } catch(err) {
        console.log('Real API unavailable, but complaint saved to local storage')
      }
      
      return { data: { success: true, data: result } }
    } catch(err) {
      throw err
    }
  }

  async function handleSubmit(e){
    e?.preventDefault?.()
    if(!validate()) return

    try{
      const res = await submitToApi()
      if(res.data.success) nav('/complaint-history')
      else alert('Error: ' + res.data.message)
    } catch(err){
      alert('Error submitting complaint: ' + (err.response?.data?.message || err.message))
    }
  }

  function openConfirm(e){
    e.preventDefault()
    if(!validate()) return
    setConfirmOpen(true)
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Header />

        <main>
          <h1 className="page-title">Submit Complaint</h1>

          <form className="form-card" onSubmit={openConfirm} noValidate>
            <div className="form-head">
              <h2 className="form-title">Complaint Details</h2>
              <p className="form-sub">
                Fill out the details below. Fields marked with <span className="req">*</span> are required.
              </p>
            </div>

            <div className="form-grid">
              {/* Category */}
              <label className="form-label">
                Category <span className="req">*</span>
              </label>
              <div className="form-field">
                <select
                  className={`ui-input ${errors.category ? 'ui-error' : ''}`}
                  value={form.category}
                  onChange={e => setField('category', e.target.value)}
                >
                  <option value="">Select Category</option>
                  <option value="Noise">Noise</option>
                  <option value="Garbage">Garbage</option>
                  <option value="Traffic">Traffic</option>
                </select>
                {errors.category && <div className="field-error">{errors.category}</div>}
              </div>

              {/* Title */}
              <label className="form-label">
                Title <span className="req">*</span>
              </label>
              <div className="form-field">
                <InputField
                  label={null}
                  value={form.title}
                  onChange={e => setField('title', e.target.value)}
                  error={errors.title}
                  placeholder="Short title (e.g., Loud music at night)"
                />
              </div>

              {/* Resident */}
              <label className="form-label">
                Resident <span className="req">*</span> 
              </label>
              <div className="form-field">
                <InputField
                  label={null}
                  value={form.resident_name}
                  onChange={e => setField('resident_name', e.target.value)}
                  placeholder="Resident name"
                />
              </div>

              {/* Description */}
              <label className="form-label">
                Description <span className="req">*</span>
              </label>
              <div className="form-field">
                <textarea
                  className={`ui-input ui-textarea ${errors.description ? 'ui-error' : ''}`}
                  value={form.description}
                  onChange={e => setField('description', e.target.value)}
                  placeholder="Write the full details of your complaint..."
                />
                {errors.description && <div className="field-error">{errors.description}</div>}
              </div>

              {/* Location */}
              <label className="form-label">Location</label>
              <div className="form-field">
                <InputField
                  label={null}
                  value={form.location}
                  onChange={e => setField('location', e.target.value)}
                  placeholder="Street / Purok / Landmark"
                />
              </div>

              {/* Date */}
              <label className="form-label">Date</label>
              <div className="form-field">
                <input
                  className="ui-input"
                  type="date"
                  value={form.date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setField('date', e.target.value)}
                />
              </div>

              {/* Upload */}
              <label className="form-label">Upload Image/Video</label>
              <div className="form-field">
                <div className="file-upload-container">
                  <input
                    id="file-upload"
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="file-upload" className="file-upload-btn-small">
                    <span className="upload-icon">📎</span>
                    <span className="upload-text-small">Choose</span>
                  </label>

                  {/* Display uploaded file previews beside button */}
                  {form.images.length > 0 && (
                    <div className="uploaded-files-horizontal">
                      {previews.map((preview, index) => (
                        <div key={index} className="preview-container">
                          <div 
                            className="preview-thumbnail"
                            onClick={() => setExpandedPreview(preview)}
                            title="Click to expand"
                          >
                            {preview.type.startsWith('image/') ? (
                              <img src={preview.url} alt={`Preview ${index}`} />
                            ) : (
                              <video src={preview.url} />
                            )}
                            <div className="preview-overlay">🔍</div>
                            <button
                              type="button"
                              className="remove-preview-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeFile(index)
                              }}
                              title="Remove file"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="helper">Optional. You can attach multiple evidence files (photos/videos). Max 10MB each.</div>
              </div>

              {/* Anonymous */}
              <label className="form-label">Anonymous</label>
              <div className="form-field">
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={form.anonymous}
                    onChange={e => setField('anonymous', e.target.checked)}
                  />
                  <span>Submit anonymously</span>
                </label>
              </div>
            </div>

            <div className="form-actions">
              <Button type="submit">Submit</Button>
            </div>
          </form>

          {/* ✅ EXPANDED PREVIEW MODAL */}
          {expandedPreview && (
            <div
              className="modal-overlay"
              onClick={() => setExpandedPreview(null)}
            >
              <div className="modal-card expanded-preview-modal" onClick={(e) => e.stopPropagation()}>
                <button 
                  className="close-preview-btn"
                  onClick={() => setExpandedPreview(null)}
                  type="button"
                >
                  ✕
                </button>
                {expandedPreview.type.startsWith('image/') ? (
                  <img src={expandedPreview.url} alt="Expanded preview" className="expanded-image" />
                ) : (
                  <video src={expandedPreview.url} controls className="expanded-video" />
                )}
                <p className="preview-filename">{expandedPreview.name}</p>
              </div>
            </div>
          )}

          {/* ✅ CONFIRM MODAL */}
          {confirmOpen && (
            <div
              className="modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm complaint submission"
              onClick={() => setConfirmOpen(false)}
            >
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <h3>Confirm Submission</h3>
                <p>Are you sure you want to submit this complaint?</p>

                <div className="modal-actions">
                  <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                    Cancel
                  </Button>

                  <Button
                    onClick={() => {
                      setConfirmOpen(false)
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