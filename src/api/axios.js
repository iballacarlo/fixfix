import axios from 'axios'

// default backend base URL; aligns with instructions in README.  Can be overridden
// via VITE_API_BASE environment variable (useful if you run PHP on different port). 
const 
api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost/barangay-api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
})

// Auto-attach token to requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if(token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
