// Simple frontend-only mock API backed by localStorage

const KEY_USERS = 'mock_users'
const KEY_COMPLAINTS = 'mock_complaints'
const KEY_DOCS = 'mock_docs'
const KEY_NOTIFICATIONS = 'mock_notifications'
const KEY_CATEGORIES = 'mock_categories'
const KEY_SYSTEM_SETTINGS = 'mock_system_settings'

function load(key){
  return JSON.parse(localStorage.getItem(key) || '[]')
}

function save(key, data){
  localStorage.setItem(key, JSON.stringify(data))
}

function loadJson(key, defaultValue){
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(defaultValue))
  } catch {
    return defaultValue
  }
}

function nowIso(){
  return new Date().toISOString()
}

function todayYmd(){
  return new Date().toISOString().slice(0, 10)
}

function getNextNumericId(list, field = 'numericId'){
  return (list[list.length - 1]?.[field] || 0) + 1
}

function generateComplaintRef(list){
  const year = new Date().getFullYear()
  const next = String(list.length + 1).padStart(3, '0')
  return `BRG-${year}-${next}`
}

function generateDocRef(list){
  const year = new Date().getFullYear()
  const next = String(list.length + 1).padStart(3, '0')
  return `DOC-${year}-${next}`
}

function normalizeUserId(value){
  if(value === undefined || value === null) return null
  const id = Number(value)
  return Number.isFinite(id) && id === Math.floor(id) && id > 0 ? id : null
}

function getAnyIdFromObject(obj, excludePatterns = []){
  if(!obj || typeof obj !== 'object') return null
  for(const key of Object.keys(obj)){
    const lower = String(key).toLowerCase()
    if(excludePatterns.some(pattern => lower.includes(pattern))) continue
    if(lower === 'id' || lower.endsWith('id') || lower.includes('_id')){
      const value = normalizeUserId(obj[key])
      if(value !== null) return value
    }
  }
  return null
}

function getUserId(user){
  const direct = normalizeUserId(
    user?.id ??
    user?.user_id ??
    user?.userId ??
    user?.resident_id ??
    user?.residentId ??
    user?.owner_id ??
    user?.ownerId
  )
  if(direct !== null) return direct
  return getAnyIdFromObject(user, ['complaint', 'request', 'document', 'numeric', 'ref'])
}

function getItemOwnerId(item){
  const direct = normalizeUserId(
    item?.userId ??
    item?.resident_id ??
    item?.user_id ??
    item?.residentId ??
    item?.ownerId ??
    item?.owner_id ??
    item?.user?.id ??
    item?.user?.user_id ??
    item?.user?.userId ??
    item?.resident?.id ??
    item?.resident?.user_id ??
    item?.resident?.userId
  )
  if(direct !== null) return direct
  return getAnyIdFromObject(item, ['complaint', 'request', 'document', 'numeric', 'ref'])
}

function getUsers(){
  return load(KEY_USERS)
}

function getAdminUsers(){
  return getUsers().filter(u => u?.role === 'admin' || u?.role === 'staff')
}

function getNotificationTargetUserId(notification){
  return normalizeUserId(
    notification.targetUserId ??
    notification.target_user_id ??
    notification.userId ??
    notification.user_id
  )
}

function getNotificationTargetEmail(notification){
  const email = (
    notification.targetUserEmail ??
    notification.target_user_email ??
    notification.userEmail ??
    notification.user_email ??
    notification.email ??
    notification.user_email_address
  )
  return typeof email === 'string' ? email.trim().toLowerCase() : null
}

function normalizeNotificationRecipient(value){
  if(value && typeof value === 'object'){
    return {
      id: getUserId(value),
      email: getNotificationTargetEmail(value) || (value.email || value.user_email || value.username || '')?.toString().trim().toLowerCase() || null
    }
  }

  if(typeof value === 'number' || /^[0-9]+$/.test(String(value).trim())){
    return { id: normalizeUserId(value), email: null }
  }

  if(typeof value === 'string'){
    const trimmed = value.trim()
    if(trimmed.includes('@')){
      return { id: null, email: trimmed.toLowerCase() }
    }
    const numeric = normalizeUserId(trimmed)
    if(numeric !== null){
      return { id: numeric, email: null }
    }
  }

  return { id: null, email: null }
}

function addNotification(notification){
  const list = load(KEY_NOTIFICATIONS)
  const nextId = getNextNumericId(list, 'id')
  const targetUserId = getNotificationTargetUserId(notification)
  const targetUserEmail = getNotificationTargetEmail(notification)
  const item = {
    id: nextId,
    notification_id: nextId,
    userId: targetUserId,
    user_id: targetUserId,
    targetUserId: targetUserId,
    target_user_id: targetUserId,
    targetUserEmail,
    target_user_email: targetUserEmail,
    message: notification.message || '',
    category: notification.category || '',
    data: notification.data || {},
    read: false,
    created_at: nowIso(),
    updated_at: nowIso()
  }
  list.unshift(item)
  save(KEY_NOTIFICATIONS, list)
  return item
}

function listNotificationsByUser(user){
  const normalized = normalizeNotificationRecipient(user)
  if(normalized.id === null && !normalized.email) return []
  return load(KEY_NOTIFICATIONS)
    .filter(n => {
      const targetId = getNotificationTargetUserId(n)
      const targetEmail = getNotificationTargetEmail(n)
      return (normalized.id !== null && targetId === normalized.id) || (normalized.email && targetEmail === normalized.email)
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

function getUnreadNotificationCount(user){
  return listNotificationsByUser(user).filter(n => !n.read).length
}

function markNotificationRead(id){
  const list = load(KEY_NOTIFICATIONS)
  const idx = list.findIndex(item => String(item.notification_id) === String(id) || String(item.id) === String(id))
  if(idx === -1) return null
  list[idx] = { ...list[idx], read: true, updated_at: nowIso() }
  save(KEY_NOTIFICATIONS, list)
  return list[idx]
}

function markAllNotificationsRead(user){
  const normalized = normalizeNotificationRecipient(user)
  if(normalized.id === null && !normalized.email) return []
  const list = load(KEY_NOTIFICATIONS)
  const updated = list.map(item => {
    const targetId = getNotificationTargetUserId(item)
    const targetEmail = getNotificationTargetEmail(item)
    if(((normalized.id !== null && targetId === normalized.id) || (normalized.email && targetEmail === normalized.email)) && !item.read){
      return { ...item, read: true, updated_at: nowIso() }
    }
    return item
  })
  save(KEY_NOTIFICATIONS, updated)
  return updated.filter(item => {
    const targetId = getNotificationTargetUserId(item)
    const targetEmail = getNotificationTargetEmail(item)
    return (normalized.id !== null && targetId === normalized.id) || (normalized.email && targetEmail === normalized.email)
  })
}

function isOwnedBy(item, currentUser){
  const ownerId = getItemOwnerId(item)
  const currentUserId = getUserId(currentUser)
  return ownerId !== null && currentUserId !== null && ownerId === currentUserId
}

function seed(){
  if(!localStorage.getItem(KEY_USERS)){
    const users = [
      {
        id: 1,
        name: 'Admin',
        first_name: 'Admin',
        last_name: '',
        email: 'admin@gmail.com',
        password: '123',
        address: 'Barangay Hall, Mambog II',
        role: 'admin'
      },
      {
        id: 2,
        name: 'Carlo',
        first_name: 'Carlo',
        last_name: '',
        email: 'carlo@gmail.com',
        password: '123',
        address: 'Phase 1, Block 5, Lot 12, Mambog II',
        role: 'resident'
      }
    ]
    save(KEY_USERS, users)
  }

  // Only initialize empty arrays if they don't exist - don't clear existing data!
  if(!localStorage.getItem(KEY_COMPLAINTS)) save(KEY_COMPLAINTS, [])
  if(!localStorage.getItem(KEY_DOCS)) save(KEY_DOCS, [])
  if(!localStorage.getItem(KEY_NOTIFICATIONS)) save(KEY_NOTIFICATIONS, [])

  // Ensure categories include the full set of required defaults without
  // removing any existing custom categories. This updates localStorage on
  // first load and for any client that already has a categories entry.
  const REQUIRED_DEFAULT_CATEGORIES = ['Noise', 'Garbage', 'Traffic', 'Water Supply', 'Electricity', 'Public Safety', 'Other']

  if(!localStorage.getItem(KEY_CATEGORIES)) {
    save(KEY_CATEGORIES, REQUIRED_DEFAULT_CATEGORIES)
  } else {
    try {
      const existing = JSON.parse(localStorage.getItem(KEY_CATEGORIES) || '[]')
      if(Array.isArray(existing)){
        const merged = [...existing]
        REQUIRED_DEFAULT_CATEGORIES.forEach(cat => {
          if(!merged.some(e => String(e).toLowerCase() === String(cat).toLowerCase())){
            merged.push(cat)
          }
        })
        save(KEY_CATEGORIES, merged)
      }
    } catch (e) {
      // If parsing fails, overwrite with required defaults to be safe
      save(KEY_CATEGORIES, REQUIRED_DEFAULT_CATEGORIES)
    }
  }

  if(!localStorage.getItem(KEY_SYSTEM_SETTINGS)) save(KEY_SYSTEM_SETTINGS, {
    systemName: 'Barangay Service & Complaint Management System',
    contactEmail: 'brgy.mambog.ii@gmail.com'
  })
}

seed()

function findUserByEmail(email){
  const users = load(KEY_USERS)
  return users.find(u => u.email === email)
}

const api = {
  // =========================
  // Auth
  // =========================
  register(data){
    const users = load(KEY_USERS)

    if(findUserByEmail(data.email)){
      return { success:false, message:'Email already used' }
    }

    const id = (users[users.length - 1]?.id || 0) + 1

    const first_name = data.first_name || ''
    const last_name = data.last_name || ''
    const name =
      data.name ||
      `${first_name}${last_name ? ' ' + last_name : ''}`.trim() ||
      data.email

    const user = {
      id,
      name,
      first_name,
      middle_name: data.middle_name || '',
      last_name,
      suffix: data.suffix || '',
      gender: data.gender || '',
      email: data.email,
      password: data.password,
      role: 'resident',
      created_at: nowIso()
    }

    users.push(user)
    save(KEY_USERS, users)

    getAdminUsers().forEach(admin => {
      addNotification({
        targetUserId: admin.id,
        targetUserEmail: admin.email,
        message: `New resident registration: ${user.name || user.email}`,
        category: 'registration',
        data: { user_id: user.id, userId: user.id }
      })
    })

    const token = 'tok_' + id
    return { success:true, token, user }
  },

  login(email, password){
    const user = findUserByEmail(email)

    if(!user || user.password !== password){
      return { success:false, message:'Invalid credentials' }
    }

    const token = 'tok_' + user.id
    return { success:true, token, user }
  },

  getCurrentUser(){
    let token = localStorage.getItem('token')
    if(!token){
      token = sessionStorage.getItem('token')
    }
    if(!token) return null

    const id = parseInt(token.split('_')[1], 10)
    const users = load(KEY_USERS)

    return users.find(u => u.id === id) || null
  },

  // Update a user's profile fields (mock support)
  updateUser(id, updates){
    const users = load(KEY_USERS)
    const idx = users.findIndex(u => u.id === id)
    if(idx === -1) return null
    users[idx] = { ...users[idx], ...updates }
    save(KEY_USERS, users)
    return users[idx]
  },

  listNotificationsByUser(userId){
    return listNotificationsByUser(userId)
  },

  getUnreadNotificationCount(userId){
    return getUnreadNotificationCount(userId)
  },

  markAllNotificationsRead(userId){
    return markAllNotificationsRead(userId)
  },

  // Send a notification to all admin/staff users
  notifyAdmins(notification){
    const admins = getAdminUsers()
    admins.forEach(admin => {
      addNotification({
        targetUserId: admin.id,
        targetUserEmail: admin.email,
        message: notification.message || '',
        category: notification.category || '',
        data: notification.data || {}
      })
    })
    return { success:true }
  },

  // =========================
  // Complaints
  // =========================
  listComplaints(){
    return load(KEY_COMPLAINTS)
  },

  listComplaintsByUser(userId){
    const normalizedUserId = normalizeUserId(userId)
    if(normalizedUserId === null) return []
    return load(KEY_COMPLAINTS).filter(c => getItemOwnerId(c) === normalizedUserId)
  },

  addComplaint(c){
    const list = load(KEY_COMPLAINTS)
    const currentUser = api.getCurrentUser()

    const numericId = getNextNumericId(list, 'numericId')
    const reference = generateComplaintRef(list)

    const residentName = c.resident_name || c.name || ''

    const userId = normalizeUserId(c.userId ?? getUserId(currentUser))
    const item = {
      numericId,
      id: reference,
      ref: reference,
      complaint_id: numericId,

      userId,
      user_id: userId,
      resident_id: userId,
      residentId: userId,
      ownerId: userId,
      owner_id: userId,
      resident_name: residentName,
      name: residentName,

      // Respondent (person being complained about) - optional
      respondent_name: c.respondent_name || '',
      respondent_contact: c.respondent_contact || '',

      category: c.category || c.category_id || '',
      category_id: c.category || c.category_id || '',
      title: c.title || '',
      description: c.description || '',
      location: c.location || '',
      anonymous: !!c.anonymous,
      notes: c.notes || '',
      images: c.images || [],

      status: c.status || 'Submitted',

      date: todayYmd(),
      created: nowIso(),
      created_at: nowIso(),
      date_submitted: nowIso()
    }

    list.unshift(item)
    save(KEY_COMPLAINTS, list)

    const authorName = currentUser?.name || currentUser?.first_name || currentUser?.email || 'Resident'
    getAdminUsers().forEach(admin => {
      addNotification({
        targetUserId: admin.id,
        targetUserEmail: admin.email,
        message: `New complaint submitted by ${authorName}: ${item.title || item.category || item.ref}`,
        category: 'complaint',
        data: { complaint_id: item.complaint_id, ref: item.ref }
      })
    })

    return item
  },

  updateComplaintStatus(id, status){
    const list = load(KEY_COMPLAINTS)
    const idx = list.findIndex(item => {
      const isEqual = v => v === id || String(v) === String(id)
      return isEqual(item.id) || isEqual(item.complaint_id) || isEqual(item.numericId)
    })

    if(idx === -1){
      return { success:false, message:'Complaint not found' }
    }

    list[idx].status = status
    list[idx].updated_at = nowIso()
    save(KEY_COMPLAINTS, list)

    return { success:true, data:list[idx] }
  },

  // Update arbitrary complaint fields
  updateComplaint(id, updates, currentUser){
    const list = load(KEY_COMPLAINTS)
    const idx = list.findIndex(item => {
      const isEqual = v => v === id || String(v) === String(id)
      return isEqual(item.id) || isEqual(item.complaint_id) || isEqual(item.numericId)
    })
    if(idx === -1) return { success:false, message:'Complaint not found' }
    if(!currentUser) return { success:false, message:'Not authenticated' }
    const complaint = list[idx]
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'staff'
    if(!isAdmin && !isOwnedBy(complaint, currentUser)){
      return { success:false, message:'Unauthorized to update this complaint' }
    }
    list[idx] = { ...list[idx], ...updates, updated_at: nowIso() }
    save(KEY_COMPLAINTS, list)
    return { success:true, data: list[idx] }
  },

  // Delete a complaint
  deleteComplaint(id, currentUser){
    currentUser = currentUser || api.getCurrentUser()
    const list = load(KEY_COMPLAINTS)
    
    // Find the exact complaint to delete by comparing complaint_id, numericId, or id
    let foundIdx = -1
    for(let i = 0; i < list.length; i++){
      const complaint = list[i]
      if(String(complaint.complaint_id) === String(id) || String(complaint.numericId) === String(id) || String(complaint.id) === String(id)){
        foundIdx = i
        break
      }
    }
    
    if(foundIdx === -1){
      return { success:false, message:'Complaint not found' }
    }
    
    // Allow deletion once the complaint is found.
    // The UI already controls which complaints are deletable.
    list.splice(foundIdx, 1)
    save(KEY_COMPLAINTS, list)

    return { success:true }
  },

  listCategories(){
    return load(KEY_CATEGORIES)
  },

  saveCategories(categories){
    save(KEY_CATEGORIES, categories)
    return categories
  },

  getSystemSettings(){
    return loadJson(KEY_SYSTEM_SETTINGS, {
      systemName: 'Barangay Service & Complaint Management System',
      contactEmail: 'brgy.mambog.ii@gmail.com'
    })
  },

  saveSystemSettings(settings){
    const existing = loadJson(KEY_SYSTEM_SETTINGS, {})
    const merged = { ...existing, ...settings }
    save(KEY_SYSTEM_SETTINGS, merged)
    return merged
  },

  // =========================
  // Documents
  // =========================
  listDocs(){
    return load(KEY_DOCS)
  },

  listDocsByUser(userId){
    const normalizedUserId = normalizeUserId(userId)
    if(normalizedUserId === null) return []
    return load(KEY_DOCS).filter(d => getItemOwnerId(d) === normalizedUserId)
  },

  addDoc(d){
    const list = load(KEY_DOCS)
    const currentUser = api.getCurrentUser()

    const numericId = getNextNumericId(list, 'numericId')
    const reference = generateDocRef(list)

    const userId = normalizeUserId(d.userId ?? getUserId(currentUser))
    const item = {
      numericId,
      id: reference,
      ref: reference,
      request_id: numericId,
      reference_number: reference,

      userId,
      user_id: userId,
      resident_id: userId,
      residentId: userId,
      ownerId: userId,
      owner_id: userId,

      type: d.type || d.document_type || '',
      document_type: d.document_type || d.type || '',
      purpose: d.purpose || '',
      name: d.name || '',
      birthdate: d.birthdate || '',
      address: d.address || '',
      business_name: d.business_name || '',
      notes: d.notes || '',

      status: d.status || 'Submitted',

      date: todayYmd(),
      created: nowIso(),
      created_at: nowIso(),
      date_requested: nowIso()
    }

    list.unshift(item)
    save(KEY_DOCS, list)
    const authorName = currentUser?.name || currentUser?.first_name || currentUser?.email || 'Resident'
    getAdminUsers().forEach(admin => {
      addNotification({
        targetUserId: admin.id,
        targetUserEmail: admin.email,
        message: `New document request submitted by ${authorName}: ${item.document_type || item.type || item.reference_number}`,
        category: 'document_request',
        data: { request_id: item.request_id, reference_number: item.reference_number }
      })
    })
    return item
  },

  updateDocStatus(id, status){
    const list = load(KEY_DOCS)
    const idx = list.findIndex(item => {
      const isEqual = v => v === id || String(v) === String(id)
      return isEqual(item.id) || isEqual(item.request_id) || isEqual(item.numericId)
    })

    if(idx === -1){
      return { success:false, message:'Document request not found' }
    }

    list[idx].status = status
    list[idx].updated_at = nowIso()
    save(KEY_DOCS, list)

    return { success:true, data:list[idx] }
  }
  ,

  // Update arbitrary document fields
  updateDoc(id, updates, currentUser){
    const list = load(KEY_DOCS)
    const idx = list.findIndex(item => {
      const isEqual = v => v === id || String(v) === String(id)
      return isEqual(item.id) || isEqual(item.request_id) || isEqual(item.numericId)
    })
    if(idx === -1) return { success:false, message:'Document not found' }
    if(!currentUser) return { success:false, message:'Not authenticated' }
    const doc = list[idx]
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'staff'
    if(!isAdmin && !isOwnedBy(doc, currentUser)){
      return { success:false, message:'Unauthorized to update this document' }
    }
    list[idx] = { ...list[idx], ...updates, updated_at: nowIso() }
    save(KEY_DOCS, list)
    return { success:true, data: list[idx] }
  },

  // Delete a document
  deleteDoc(id, currentUser){
    currentUser = currentUser || api.getCurrentUser()
    const list = load(KEY_DOCS)
    
    // Find the exact document to delete by comparing request_id, numericId, or id
    let foundIdx = -1
    for(let i = 0; i < list.length; i++){
      const doc = list[i]
      if(String(doc.request_id) === String(id) || String(doc.numericId) === String(id) || String(doc.id) === String(id)){
        foundIdx = i
        break
      }
    }
    
    if(foundIdx === -1){
      return { success:false, message:'Document not found' }
    }
    
    // Require authenticated user and verify ownership or admin/staff role.
    if(!currentUser) return { success:false, message:'Not authenticated' }
    const doc = list[foundIdx]
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'staff'
    if(!isAdmin && !isOwnedBy(doc, currentUser)){
      return { success:false, message:'Unauthorized to delete this document' }
    }

    list.splice(foundIdx, 1)
    save(KEY_DOCS, list)

    return { success:true }
  }
}

export default api