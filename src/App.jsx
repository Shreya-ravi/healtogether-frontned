import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = 'https://healtogether-backend.onrender.com'
const ACCOUNTS_KEY = 'healTogetherAccounts'
const DOCTOR_QUEUE_KEY = 'healTogetherDoctorQueue'
const PATIENT_HISTORY_KEY = 'healTogetherPatientHistory'
const SHARED_REVIEWS_KEY = 'healTogetherSharedReviews'

const symptomOptions = [
  { value: 'fever', label: 'Fever' },
  { value: 'cold', label: 'Cold' },
  { value: 'cough', label: 'Cough' },
  { value: 'headache', label: 'Headache' },
  { value: 'stomach-pain', label: 'Stomach Pain' },
]

const durationOptions = [
  { value: '1-day', label: 'Less than 24 hours' },
  { value: '2-3-days', label: '2-3 Days' },
  { value: '1-week', label: 'About a week' },
  { value: '2-weeks', label: '2 Weeks or more' },
  { value: 'chronic', label: 'Chronic (Long term)' },
]

function readStoredList(key) {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStoredList(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function readStoredAccounts() {
  return readStoredList(ACCOUNTS_KEY)
}

function buildDoctorQueueItems(patient, remedies) {
  return remedies.map((remedy, index) => ({
    queue_id: `queue-${Date.now()}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
    patient_id: patient.id,
    patient_name: patient.name,
    patient_age: patient.age,
    patient_dob: patient.dob,
    patient_symptoms: patient.diseases || [],
    patient_duration: patient.duration || '',
    patient_notes: patient.notes || '',
    remedy_name: remedy.remedy_name,
    description: remedy.description,
    tags: remedy.tags || [],
    doctor_status: 'pending',
    doctor_note: '',
    reviewed_by: '',
    reviewed_at: '',
    created_at: patient.created_at,
  }))
}

function generateDoctorRegNo(name) {
  const cleaned = String(name || 'DR')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4) || 'DR'

  const alphaNumeric = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `REG-${cleaned}-${alphaNumeric}`
}

function getMedicineCategory(remedy) {
  const title = String(remedy?.remedy_name || '').toLowerCase()
  const tags = Array.isArray(remedy?.tags) ? remedy.tags.map((tag) => String(tag).toLowerCase()) : []

  if (
    title.includes('paracetamol') ||
    title.includes('tablet') ||
    title.includes('capsule') ||
    tags.includes('allopathy') ||
    tags.includes('medicine')
  ) {
    return 'Allopathy'
  }

  if (
    title.includes('tulsi') ||
    title.includes('ginger') ||
    title.includes('honey') ||
    title.includes('jeera') ||
    title.includes('steam') ||
    tags.includes('ayurveda') ||
    tags.includes('home remedy')
  ) {
    return 'Ayurveda'
  }

  return 'Allopathy'
}

function enrichRemedy(remedy) {
  const medicineCategory = getMedicineCategory(remedy)
  const nextTags = Array.isArray(remedy.tags) ? [...remedy.tags] : []

  if (!nextTags.includes(medicineCategory)) {
    nextTags.unshift(medicineCategory)
  }

  return {
    ...remedy,
    medicine_category: medicineCategory,
    tags: nextTags,
  }
}

function createPatientReview({ patient, remedyName, rating, comment }) {
  return {
    review_id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'patient',
    remedy_name: remedyName,
    patient_id: patient.id,
    patient_name: patient.name,
    rating,
    comment,
    review_status: 'pending',
    doctor_suggestion: '',
    reviewed_by: '',
    reviewed_at: '',
    useful_count: 0,
    created_at: new Date().toISOString(),
  }
}

function createDoctorReview(queueItem, status, doctorName) {
  return {
    review_id: `doctor-review-${queueItem.queue_id}`,
    type: 'doctor',
    remedy_name: queueItem.remedy_name,
    patient_id: queueItem.patient_id,
    patient_name: queueItem.patient_name,
    doctor_status: status,
    doctor_note: queueItem.doctor_note || (status === 'approved' ? 'Safe to use' : 'Needs review'),
    reviewed_by: doctorName,
    doctor_department: queueItem.doctor_department || 'Community Review Desk',
    doctor_reg_no: queueItem.doctor_reg_no || 'REG-HT-001',
    doctor_clinic: queueItem.doctor_clinic || 'Heal Together Clinic',
    useful_count: 0,
    created_at: new Date().toISOString(),
  }
}

function App() {
  const [currentView, setCurrentView] = useState('auth')
  const [currentUser, setCurrentUser] = useState(null)
  const [patientRecord, setPatientRecord] = useState(null)
  const [remedies, setRemedies] = useState([])
  const [selectedRemedy, setSelectedRemedy] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [],
  )

  function showToast(message) {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(''), 2500)
  }

  function handlePatientEntry(account) {
    setCurrentUser(account)
    setPatientRecord(null)
    setRemedies([])
    setSelectedRemedy(null)
    setCurrentView('form')
  }

  function handleDoctorEntry(doctor) {
    setCurrentUser(doctor)
    setPatientRecord(null)
    setRemedies([])
    setSelectedRemedy(null)
    setCurrentView('doctor')
  }

  function handleLogout() {
    setCurrentUser(null)
    setPatientRecord(null)
    setRemedies([])
    setSelectedRemedy(null)
    setCurrentView('auth')
  }

  async function handlePatientSubmit(payload) {
    const patientResponse = await fetch(`${API_BASE}/add-patient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const patientData = await patientResponse.json().catch(() => ({}))
    if (!patientResponse.ok) {
      throw new Error(patientData.message || 'Unable to submit patient details.')
    }

    const remedyResponse = await fetch(`${API_BASE}/get-remedies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        diseases: payload.diseases,
        patient: payload,
      }),
    })

    const remedyData = await remedyResponse.json().catch(() => [])
    if (!remedyResponse.ok) {
      throw new Error(remedyData.message || 'Unable to fetch remedies.')
    }

    const nextPatientRecord = {
      ...payload,
      id: `patient-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
    }
    const nextRemedies = (Array.isArray(remedyData) ? remedyData : []).map(enrichRemedy)

    const existingHistory = readStoredList(PATIENT_HISTORY_KEY)
    writeStoredList(PATIENT_HISTORY_KEY, [nextPatientRecord, ...existingHistory])

    const existingQueue = readStoredList(DOCTOR_QUEUE_KEY)
    const queueItems = buildDoctorQueueItems(nextPatientRecord, nextRemedies)
    writeStoredList(DOCTOR_QUEUE_KEY, [...queueItems, ...existingQueue])

    setPatientRecord(nextPatientRecord)
    setRemedies(nextRemedies)
    setSelectedRemedy(nextRemedies.length ? nextRemedies[0] : null)
    setCurrentView('remedies')
    showToast('Patient details submitted successfully!')
  }

  return (
    <div className="app-shell">
      {toastMessage ? (
        <div className="success-toast">
          <div className="success-toast-row">
            <svg className="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <p>{toastMessage}</p>
          </div>
        </div>
      ) : null}

      {currentView === 'auth' ? (
        <AuthScreen
          todayLabel={todayLabel}
          onPatientEntry={handlePatientEntry}
          onDoctorEntry={handleDoctorEntry}
          onToast={showToast}
        />
      ) : null}

      {currentView === 'form' ? (
        <PatientFormScreen
          todayLabel={todayLabel}
          user={currentUser}
          onLogout={handleLogout}
          onSubmit={handlePatientSubmit}
          onToast={showToast}
        />
      ) : null}

      {currentView === 'remedies' ? (
        <RemediesScreen
          user={currentUser}
          remedies={remedies}
          selectedRemedy={selectedRemedy}
          patientRecord={patientRecord}
          onSelectRemedy={setSelectedRemedy}
          onBack={() => setCurrentView('form')}
          onLogout={handleLogout}
          onToast={showToast}
        />
      ) : null}

      {currentView === 'doctor' ? (
        <DoctorScreen user={currentUser} onLogout={handleLogout} onToast={showToast} />
      ) : null}
    </div>
  )
}

function AuthScreen({ todayLabel, onPatientEntry, onDoctorEntry, onToast }) {
  const [registerForm, setRegisterForm] = useState({
    display_name: '',
    age: '',
    dob: '',
    phone: '',
    email: '',
    password: '',
  })
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  })
  const [doctorForm, setDoctorForm] = useState({
    username: '',
    password: '',
  })

  function handleRegister(event) {
    event.preventDefault()

    if (
      !registerForm.display_name.trim() ||
      !registerForm.age.trim() ||
      !registerForm.dob ||
      !registerForm.phone.trim() ||
      !registerForm.email.trim() ||
      !registerForm.password.trim()
    ) {
      onToast('Please fill in all contact details and create a password.')
      return
    }

    if (!/^\d{5}$/.test(registerForm.phone.trim())) {
      onToast('Phone number must be exactly 5 digits.')
      return
    }

    const existingAccounts = readStoredAccounts()
    const normalizedEmail = registerForm.email.trim().toLowerCase()
    const duplicateAccount = existingAccounts.find(
      (account) => String(account.email || '').toLowerCase() === normalizedEmail,
    )

    if (duplicateAccount) {
      onToast('An account with this email already exists. Please login instead.')
      return
    }

    const createdAccount = {
      name: registerForm.display_name.trim(),
      age: registerForm.age.trim(),
      dob: registerForm.dob,
      phone: registerForm.phone.trim(),
      email: normalizedEmail,
      password: registerForm.password.trim(),
      role: 'patient',
      created_at: new Date().toISOString(),
    }

    writeStoredList(ACCOUNTS_KEY, [createdAccount, ...existingAccounts])

    onPatientEntry(createdAccount)
    onToast('Account created successfully!')
  }

  function handleLogin(event) {
    event.preventDefault()

    if (!loginForm.email.trim() || !loginForm.password.trim()) {
      onToast('Please enter your email and password to login.')
      return
    }

    const existingAccounts = readStoredAccounts()
    const normalizedEmail = loginForm.email.trim().toLowerCase()
    const matchedAccount = existingAccounts.find(
      (account) =>
        String(account.email || '').toLowerCase() === normalizedEmail &&
        String(account.password || '') === loginForm.password.trim(),
    )

    if (!matchedAccount) {
      onToast('Only created accounts can login here. Please create the account first.')
      return
    }

    onPatientEntry({
      name: matchedAccount.name || 'Patient',
      age: matchedAccount.age || '',
      dob: matchedAccount.dob || '',
      phone: matchedAccount.phone || '',
      email: matchedAccount.email || normalizedEmail,
      role: matchedAccount.role || 'patient',
    })
    onToast('Logged in successfully!')
  }

  function handleDoctorLogin(event) {
    event.preventDefault()

    if (!doctorForm.username.trim() || !doctorForm.password.trim()) {
      onToast('Please enter doctor username and password.')
      return
    }

    if (!doctorForm.username.trim().toLowerCase().startsWith('dr ')) {
      onToast('Doctor username must start with dr.')
      return
    }

    if (doctorForm.password.trim() !== '123') {
      onToast('Invalid doctor password.')
      return
    }

    onDoctorEntry({
      name: doctorForm.username.trim(),
      account_id: `doctor-${Date.now()}`,
      role: 'doctor',
      department: 'Community Review Desk',
      reg_no: generateDoctorRegNo(doctorForm.username.trim()),
      clinic: 'Heal Together Clinic',
    })
    onToast('Doctor login successful!')
  }

  return (
    <div className="page-center">
      <div className="glass-card auth-card">
        <div className="text-center mb-10">
          <div className="inline-block mb-4">
            <BrandMark />
          </div>
          <h1 className="text-4xl font-bold text-slate-800 tracking-tight">HEAL TOGETHER</h1>
          <p className="text-slate-500 mt-2">Account Access Before Patient Check-In</p>
          <div className="text-xs font-medium text-slate-400 mt-2 uppercase tracking-widest">
            Check-in Date: {todayLabel}
          </div>
        </div>

        <div className="auth-grid">
          <div className="soft-panel">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-slate-800">Create Account</h2>
              <span className="tag-blue">New User</span>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Add your contact details first, then continue to patient information.
            </p>

            <form className="space-y-5" onSubmit={handleRegister}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter your full name"
                  className="input-field w-full px-4 py-3 rounded-xl bg-white text-slate-800 placeholder:text-slate-400"
                  value={registerForm.display_name}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, display_name: event.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Age</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    required
                    placeholder="Enter age"
                    className="input-field w-full px-4 py-3 rounded-xl bg-white text-slate-800 placeholder:text-slate-400"
                    value={registerForm.age}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, age: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    required
                    className="input-field w-full px-4 py-3 rounded-xl bg-white text-slate-800"
                    value={registerForm.dob}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, dob: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="Enter your phone number"
                  inputMode="numeric"
                  pattern="[0-9]{5}"
                  maxLength="5"
                  className="input-field w-full px-4 py-3 rounded-xl bg-white text-slate-800 placeholder:text-slate-400"
                  value={registerForm.phone}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, phone: event.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="Enter your email address"
                  className="input-field w-full px-4 py-3 rounded-xl bg-white text-slate-800 placeholder:text-slate-400"
                  value={registerForm.email}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                <input
                  type="password"
                  required
                  minLength="6"
                  placeholder="Create a password"
                  className="input-field w-full px-4 py-3 rounded-xl bg-white text-slate-800 placeholder:text-slate-400"
                  value={registerForm.password}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, password: event.target.value }))
                  }
                />
              </div>

              <button type="submit" className="hero-button bg-blue-600 hover:bg-blue-700">
                Continue to Patient Form
              </button>
            </form>
          </div>

          <div className="soft-panel">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-slate-800">Already Have Account</h2>
              <span className="tag-gray">Returning User</span>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Login with the email and password you used during account creation.
            </p>
            <div className="mb-6 rounded-2xl bg-white border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500">
                Your account still stays remembered on this device after a successful login.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="Enter your email address"
                  className="input-field w-full px-4 py-3 rounded-xl bg-white text-slate-800 placeholder:text-slate-400"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  className="input-field w-full px-4 py-3 rounded-xl bg-white text-slate-800 placeholder:text-slate-400"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, password: event.target.value }))
                  }
                />
              </div>

              <button type="submit" className="hero-button bg-slate-800 hover:bg-slate-900">
                Login
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-800">Doctors Login</h3>
                <span className="tag-emerald">Protected</span>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Use a doctor username starting with <span className="font-semibold text-slate-700">dr </span>
                and the doctor password.
              </p>

              <form className="space-y-4" onSubmit={handleDoctorLogin}>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Doctor Username</label>
                  <input
                    type="text"
                    required
                    placeholder="Example: dr Monica"
                    className="input-field w-full px-4 py-3 rounded-xl bg-white text-slate-800 placeholder:text-slate-400"
                    value={doctorForm.username}
                    onChange={(event) =>
                      setDoctorForm((current) => ({ ...current, username: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter doctor password"
                    className="input-field w-full px-4 py-3 rounded-xl bg-white text-slate-800 placeholder:text-slate-400"
                    value={doctorForm.password}
                    onChange={(event) =>
                      setDoctorForm((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </div>

                <button type="submit" className="hero-button bg-emerald-600 hover:bg-emerald-700">
                  Doctors Login
                </button>
              </form>
            </div>
          </div>
        </div>

        <SecureFooter />
      </div>
    </div>
  )
}

function PatientFormScreen({ todayLabel, user, onLogout, onSubmit, onToast }) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    age: user?.age || '',
    dob: user?.dob || '',
    duration: '',
    notes: '',
  })
  const [selectedSymptoms, setSelectedSymptoms] = useState([])
  const [symptomSeverity, setSymptomSeverity] = useState({})
  const [submitting, setSubmitting] = useState(false)

  function toggleSymptom(value) {
    setSelectedSymptoms((current) => {
      const exists = current.includes(value)
      if (exists) {
        setSymptomSeverity((previous) => {
          const next = { ...previous }
          delete next[value]
          return next
        })
        return current.filter((item) => item !== value)
      }

      setSymptomSeverity((previous) => ({
        ...previous,
        [value]: previous[value] || 'Moderate',
      }))
      return [...current, value]
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!selectedSymptoms.length) {
      onToast('Please select at least one symptom.')
      return
    }

    setSubmitting(true)

    try {
      await onSubmit({
        name: formData.name.trim(),
        age: formData.age,
        dob: formData.dob,
        diseases: selectedSymptoms,
        symptomSeverity,
        duration: formData.duration,
        notes: formData.notes.trim(),
      })
    } catch (error) {
      onToast(error.message || 'Something went wrong while submitting the form.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-center">
      <div className="account-badge-wrap">
        <div className="glass-card account-badge-card">
          <div className="account-initial">{(user?.name || 'A').charAt(0).toUpperCase()}</div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account</p>
            <p className="text-sm font-semibold text-slate-700">{user?.name || 'Guest'}</p>
          </div>
          <button type="button" className="logout-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="glass-card form-card">
        <div className="text-center mb-10">
          <div className="inline-block mb-4">
            <BrandMark />
          </div>
          <h1 className="text-4xl font-bold text-slate-800 tracking-tight">HEAL TOGETHER</h1>
          <p className="text-slate-500 mt-2">Comprehensive Patient Health Check</p>
          <div className="text-xs font-medium text-slate-400 mt-2 uppercase tracking-widest">
            Check-in Date: {todayLabel}
          </div>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
              <input
                type="text"
                required
                placeholder="Enter your full name"
                className="input-field w-full px-4 py-3 rounded-xl bg-slate-50 text-slate-800 placeholder:text-slate-400"
                value={formData.name}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Age</label>
              <select
                required
                className="input-field w-full px-4 py-3 rounded-xl bg-slate-50 text-slate-800"
                value={formData.age}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, age: event.target.value }))
                }
              >
                <option value="" disabled>
                  Select Age
                </option>
                {Array.from({ length: 101 }).map((_, index) => (
                  <option key={index} value={index}>
                    {index}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Date of Birth</label>
              <input
                type="date"
                required
                className="input-field w-full px-4 py-3 rounded-xl bg-slate-50 text-slate-800"
                value={formData.dob}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, dob: event.target.value }))
                }
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium text-slate-800">Select Your Symptoms</h2>
              <span className="text-xs font-medium text-blue-500 bg-blue-50 px-2 py-1 rounded-md">
                General Symptoms
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-4">Select all symptoms that apply to you.</p>

            <div className="flex flex-wrap gap-3">
              {symptomOptions.map((symptom) => {
                const active = selectedSymptoms.includes(symptom.value)
                return (
                  <button
                    key={symptom.value}
                    type="button"
                    className={`symptom-pill-button ${active ? 'symptom-pill-button-active' : ''}`}
                    onClick={() => toggleSymptom(symptom.value)}
                  >
                    {symptom.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Symptom Severity</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedSymptoms.length ? (
                  selectedSymptoms.map((symptom) => (
                    <label key={symptom} className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
                      <span className="block text-sm font-semibold text-slate-700 mb-2">
                        {formatSymptomLabel(symptom)}
                      </span>
                      <select
                        className="input-field w-full px-3 py-2 rounded-xl bg-slate-50 text-slate-800"
                        value={symptomSeverity[symptom] || 'Moderate'}
                        onChange={(event) =>
                          setSymptomSeverity((current) => ({
                            ...current,
                            [symptom]: event.target.value,
                          }))
                        }
                      >
                        <option value="Mild">Mild</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Severe">Severe</option>
                      </select>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">Select symptoms above to rate severity.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Duration of Suffering</label>
              <select
                required
                className="input-field w-full px-4 py-3 rounded-xl bg-slate-50 text-slate-800"
                value={formData.duration}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, duration: event.target.value }))
                }
              >
                <option value="" disabled>
                  How long have you felt this?
                </option>
                {durationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Other Symptoms or Pain</label>
              <textarea
                placeholder="Describe any other discomfort..."
                rows="1"
                className="input-field w-full px-4 py-3 rounded-xl bg-slate-50 text-slate-800 placeholder:text-slate-400 resize-none"
                value={formData.notes}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </div>
          </div>

          <button type="submit" className="hero-button bg-blue-600 hover:bg-blue-700" disabled={submitting}>
            <span className="flex items-center justify-center">
              {submitting ? 'Submitting...' : 'Submit to Healtogether'}
            </span>
          </button>
        </form>

        <SecureFooter />
      </div>
    </div>
  )
}

function RemediesScreen({
  user,
  patientRecord,
  remedies,
  selectedRemedy,
  onSelectRemedy,
  onBack,
  onLogout,
  onToast,
}) {
  const [sharedReviews, setSharedReviews] = useState([])
  const [reviewForm, setReviewForm] = useState({
    rating: '5',
    comment: '',
  })

  useEffect(() => {
    setSharedReviews(readStoredList(SHARED_REVIEWS_KEY))
  }, [])

  const remedyReviews = selectedRemedy
    ? sharedReviews.filter((review) => {
        if (review.remedy_name !== selectedRemedy.remedy_name) {
          return false
        }

        if (review.type === 'doctor') {
          return true
        }

        return review.review_status === 'approved' || review.patient_id === patientRecord?.id
      })
    : []

  const patientDecision = selectedRemedy
    ? remedyReviews.find(
        (review) => review.type === 'doctor' && review.patient_id === patientRecord?.id,
      )
    : null

  function handleShareReview() {
    if (!selectedRemedy || !patientRecord) {
      onToast('Select a remedy before sharing a review.')
      return
    }

    if (!reviewForm.comment.trim()) {
      onToast('Please write your review before sharing.')
      return
    }

    const nextReview = createPatientReview({
      patient: patientRecord,
      remedyName: selectedRemedy.remedy_name,
      rating: Number(reviewForm.rating),
      comment: reviewForm.comment.trim(),
    })

    const nextReviews = [nextReview, ...sharedReviews]
    setSharedReviews(nextReviews)
    writeStoredList(SHARED_REVIEWS_KEY, nextReviews)
    setReviewForm({
      rating: '5',
      comment: '',
    })
    onToast('Review shared successfully!')
  }

  function markUseful(reviewId) {
    const nextReviews = sharedReviews.map((review) =>
      review.review_id === reviewId
        ? {
            ...review,
            useful_count: Number(review.useful_count || 0) + 1,
          }
        : review,
    )

    setSharedReviews(nextReviews)
    writeStoredList(SHARED_REVIEWS_KEY, nextReviews)
    onToast('Marked as useful.')
  }

  return (
    <div className="page-wrap">
      <div className="account-badge-wrap">
        <div className="glass-card account-badge-card">
          <div className="account-initial">{(user?.name || 'A').charAt(0).toUpperCase()}</div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account</p>
            <p className="text-sm font-semibold text-slate-700">{user?.name || 'Guest'}</p>
          </div>
          <button type="button" className="logout-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 tracking-tight">HEAL TOGETHER</h1>
            <p className="text-slate-500 mt-2">Remedy suggestions after symptom submission</p>
          </div>
          <button type="button" className="back-button" onClick={onBack}>
            Back to Form
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="main-card rounded-[2rem] p-6">
            <div className="mb-5">
              <h2 className="text-3xl font-bold text-slate-800">Select a Remedy</h2>
              <p className="mt-2 text-sm text-slate-500">
                Suggestions are shown only after symptom form submission.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700">
                Personalized Suggestion
              </p>
              <p className="mt-2 text-sm text-emerald-900">
                {patientRecord?.diseases?.length
                  ? `Suggestions for ${patientRecord.diseases.map(formatSymptomLabel).join(', ')} are prioritized first.`
                  : 'Suggestions appear after successful submission.'}
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {remedies.length ? (
                remedies.map((remedy, index) => {
                  const active = selectedRemedy?.remedy_name === remedy.remedy_name
                  return (
                    <button
                      key={`${remedy.remedy_name}-${index}`}
                      type="button"
                      className={`remedy-item w-full rounded-[1.75rem] p-5 text-left ${active ? 'active' : ''}`}
                      onClick={() => onSelectRemedy(remedy)}
                    >
                      <h3 className="text-lg font-semibold text-slate-800">{remedy.remedy_name}</h3>
                      <p className="mt-2 text-sm text-slate-500">
                        {remedy.description || 'No description available.'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(remedy.tags || []).map((tag) => (
                          <span key={tag} className="tag-chip">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-400">
                  No remedies found.
                </div>
              )}
            </div>
          </aside>

          <section className="main-card rounded-[2rem] p-6">
            {selectedRemedy ? (
              <>
                <div className="mb-6">
                  <h2 className="text-3xl font-bold text-slate-800">Suggested Remedy</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Remedy content appears only after the backend returns results.
                  </p>
                </div>

                <div className="section-block p-6">
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-4xl font-black text-slate-800">{selectedRemedy.remedy_name}</h3>
                      <p className="mt-2 text-sm text-slate-500">{selectedRemedy.disease || 'General support'}</p>
                    </div>
                    <span className="doctor-badge">{selectedRemedy.verified_label || 'Community Shared'}</span>
                  </div>

                  <div className="section-block p-5">
                    <p className="review-pill">Detailed Usage</p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {selectedRemedy.description || 'No description available.'}
                    </p>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="summary-chip">
                      <span>Trust Score</span>
                      <strong>{selectedRemedy.trust_score ?? 'N/A'}</strong>
                    </div>
                    <div className="summary-chip">
                      <span>Opinion</span>
                      <strong>{selectedRemedy.opinion || 'No review opinion available.'}</strong>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="summary-chip">
                      <span>Medicine Category</span>
                      <strong>{selectedRemedy.medicine_category || 'General'}</strong>
                    </div>
                    <div className="summary-chip">
                      <span>Recommendation Style</span>
                      <strong>
                        {selectedRemedy.medicine_category === 'Ayurveda'
                          ? 'Ayurvedic supportive care'
                          : 'Allopathy supportive care'}
                      </strong>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="summary-chip">
                      <span>Doctor Decision</span>
                      <strong>
                        {patientDecision
                          ? `${patientDecision.doctor_status} by ${patientDecision.reviewed_by}`
                          : 'Awaiting doctor review'}
                      </strong>
                    </div>
                    <div className="summary-chip">
                      <span>Doctor Suggestion</span>
                      <strong>{patientDecision?.doctor_note || 'No doctor note yet'}</strong>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {(selectedRemedy.tags || []).map((tag) => (
                      <span key={tag} className="tag-chip">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="section-block p-5 mt-6">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="review-pill">Shared Reviews</p>
                        <p className="text-sm text-slate-500 mt-2">
                          Patient reviews and doctor decisions for this remedy.
                        </p>
                      </div>
                      <span className="doctor-badge">
                        {remedyReviews.length} shared
                      </span>
                    </div>

                    <div className="mt-5 space-y-4">
                      {remedyReviews.length ? (
                        remedyReviews.map((review) => (
                          <article key={review.review_id} className="shared-review-card">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">
                                  {review.type === 'doctor'
                                    ? `${review.reviewed_by || 'Doctor'} Decision`
                                    : review.patient_name || 'Patient'}
                                </p>
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mt-1">
                                  {review.created_at
                                    ? new Date(review.created_at).toLocaleString()
                                    : 'No timestamp'}
                                </p>
                              </div>
                              <span className={review.type === 'doctor' ? 'doctor-review-badge' : 'patient-review-badge'}>
                                {review.type === 'doctor'
                                  ? review.doctor_status || 'review'
                                  : review.review_status === 'approved'
                                    ? `${review.rating || 0}/5`
                                    : review.review_status || 'pending'}
                              </span>
                            </div>

                            <p className="text-sm text-slate-600 leading-6 mt-3">
                              {review.type === 'doctor'
                                ? review.doctor_note || 'No doctor note provided.'
                                : review.comment || 'No comment provided.'}
                            </p>

                            {review.type === 'patient' ? (
                              <div className="mt-3 review-suggestion-box">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                  Doctor Suggestion
                                </p>
                                <p className="text-sm text-slate-600 mt-2">
                                  {review.doctor_suggestion || 'No doctor suggestion yet.'}
                                </p>
                              </div>
                            ) : null}

                            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                              <span className="text-xs text-slate-500">
                                Useful: {review.useful_count || 0}
                              </span>
                              <button
                                type="button"
                                className="useful-button"
                                onClick={() => markUseful(review.review_id)}
                              >
                                Mark Useful
                              </button>
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="empty-state-card">No shared reviews yet for this remedy.</div>
                      )}
                    </div>

                    <div className="share-review-form mt-5">
                      <div className="grid grid-cols-1 md:grid-cols-[120px_minmax(0,1fr)] gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Rating</label>
                          <select
                            className="input-field w-full px-4 py-3 rounded-xl bg-slate-50 text-slate-800"
                            value={reviewForm.rating}
                            onChange={(event) =>
                              setReviewForm((current) => ({ ...current, rating: event.target.value }))
                            }
                          >
                            <option value="5">5 / 5</option>
                            <option value="4">4 / 5</option>
                            <option value="3">3 / 5</option>
                            <option value="2">2 / 5</option>
                            <option value="1">1 / 5</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Share Review</label>
                          <textarea
                            rows="3"
                            placeholder="Share how this remedy worked for you..."
                            className="input-field w-full px-4 py-3 rounded-xl bg-slate-50 text-slate-800 placeholder:text-slate-400"
                            value={reviewForm.comment}
                            onChange={(event) =>
                              setReviewForm((current) => ({ ...current, comment: event.target.value }))
                            }
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        className="share-review-button mt-4"
                        onClick={handleShareReview}
                      >
                        Share Review
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[500px] items-center justify-center rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 text-center text-slate-400">
                Select a remedy after form submission
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function DoctorScreen({ user, onLogout, onToast }) {
  const [queueItems, setQueueItems] = useState([])
  const [patientHistory, setPatientHistory] = useState([])
  const [sharedReviewItems, setSharedReviewItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [doctorComments, setDoctorComments] = useState({})
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [reviewModerationNotes, setReviewModerationNotes] = useState({})

  useEffect(() => {
    try {
      setLoading(true)
      setQueueItems(readStoredList(DOCTOR_QUEUE_KEY))
      setPatientHistory(readStoredList(PATIENT_HISTORY_KEY))
      setSharedReviewItems(readStoredList(SHARED_REVIEWS_KEY))
    } catch (error) {
      onToast(error.message || 'Unable to load doctor portal.')
    } finally {
      setLoading(false)
    }
  }, [onToast])

  const filteredQueueItems = queueItems.filter(
    (item) => (item.doctor_status || 'pending') === 'pending',
  )

  const selectedPatient =
    patientHistory.find((patient) => patient.id === selectedPatientId) || patientHistory[0] || null

  const selectedPatientTimeline = selectedPatient
    ? sharedReviewItems
        .filter((review) => review.patient_id === selectedPatient.id)
        .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
    : []

  const patientSharedReviews = sharedReviewItems
    .filter((review) => review.type === 'patient')
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))

  const pendingSharedReviews = patientSharedReviews.filter(
    (review) => (review.review_status || 'pending') === 'pending',
  )

  function updateStatus(queueId, remedyName, status) {
    try {
      const nextReviewedAt = new Date().toISOString()
      const nextComment = String(doctorComments[queueId] || '').trim()
      const updatedQueue = queueItems.map((item) =>
        item.queue_id === queueId || item.remedy_name === remedyName
          ? {
              ...item,
              doctor_status: status,
              doctor_note: nextComment || (status === 'approved' ? 'Safe to use' : 'Needs review'),
              reviewed_by: user?.name || 'Doctor',
              doctor_department: user?.department || 'Community Review Desk',
              doctor_reg_no: user?.reg_no || 'REG-HT-001',
              doctor_clinic: user?.clinic || 'Heal Together Clinic',
              reviewed_at: nextReviewedAt,
            }
          : item,
      )

      setQueueItems(updatedQueue)
      writeStoredList(DOCTOR_QUEUE_KEY, updatedQueue)

      const reviewedItem = updatedQueue.find((item) => item.queue_id === queueId)
      if (reviewedItem) {
        const existingReviews = sharedReviewItems.filter(
          (review) => review.review_id !== `doctor-review-${reviewedItem.queue_id}`,
        )
        const doctorReview = createDoctorReview(reviewedItem, status, user?.name || 'Doctor')
        const nextSharedReviews = [doctorReview, ...existingReviews]
        writeStoredList(SHARED_REVIEWS_KEY, nextSharedReviews)
        setSharedReviewItems(nextSharedReviews)
      }

      setDoctorComments((current) => ({
        ...current,
        [queueId]: '',
      }))
      onToast(`Remedy ${status}.`)
    } catch (error) {
      onToast(error.message || 'Unable to update remedy status.')
    }
  }

  function updateSharedReview(reviewId, status) {
    try {
      const suggestion = String(reviewModerationNotes[reviewId] || '').trim()
      const updatedReviews = sharedReviewItems.map((review) =>
        review.review_id === reviewId
          ? {
              ...review,
              review_status: status,
              doctor_suggestion:
                suggestion || (status === 'approved' ? 'Review approved for community view.' : 'Please revise this review.'),
              reviewed_by: user?.name || 'Doctor',
              reviewed_at: new Date().toISOString(),
              doctor_department: user?.department || 'Community Review Desk',
              doctor_reg_no: user?.reg_no || 'REG-HT-001',
            }
          : review,
      )

      writeStoredList(SHARED_REVIEWS_KEY, updatedReviews)
      setSharedReviewItems(updatedReviews)
      setReviewModerationNotes((current) => ({
        ...current,
        [reviewId]: '',
      }))
      onToast(`Review ${status}.`)
    } catch (error) {
      onToast(error.message || 'Unable to update shared review.')
    }
  }

  return (
    <div className="page-wrap">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 tracking-tight">HEAL TOGETHER</h1>
            <p className="text-slate-500 mt-2">Doctor Site For Remedy Approval And Patient History</p>
          </div>
          <button type="button" className="back-button" onClick={onLogout}>
            Logout
          </button>
        </div>

        <div className="doctor-profile-card mb-6">
          <div className="doctor-profile-icon">+</div>
          <div className="doctor-profile-copy">
            <p className="doctor-profile-name">{user?.name || 'Doctor'}</p>
            <p className="doctor-profile-line">{user?.clinic || 'Heal Together Clinic'}</p>
            <p className="doctor-profile-line">{user?.department || 'Community Review Desk'}</p>
            <p className="doctor-profile-line">Reg no.: {user?.reg_no || 'REG-HT-001'}</p>
          </div>
        </div>

        <div className="doctor-grid">
          <section className="main-card rounded-[2rem] p-6">
            <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Remedy Queue</p>
                <p className="mt-2 text-sm text-slate-500">Approve or reject patient-facing remedy suggestions.</p>
              </div>
              <span className="doctor-badge">Pending only</span>
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="empty-state-card">Loading remedy submissions...</div>
              ) : filteredQueueItems.length ? (
                filteredQueueItems.map((item) => (
                  <article key={item.queue_id} className="doctor-remedy-card">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                          {(item.patient_symptoms || []).map(formatSymptomLabel).join(', ') || 'General'}
                        </p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">{item.remedy_name}</h3>
                        <p className="text-sm text-slate-500 mt-1">For {item.patient_name || 'Patient'}</p>
                      </div>
                      <span className={`status-pill ${item.doctor_status === 'approved' ? 'approved' : item.doctor_status === 'rejected' ? 'rejected' : 'pending'}`}>
                        {item.doctor_status}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 leading-6">{item.description || 'No description available.'}</p>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="summary-chip">
                        <span>Patient Duration</span>
                        <strong>{item.patient_duration || 'Not provided'}</strong>
                      </div>
                      <div className="summary-chip">
                        <span>Doctor Note</span>
                        <strong>{item.doctor_note || 'Awaiting review'}</strong>
                      </div>
                    </div>

                    <div className="mt-4 doctor-meta-card">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Doctor Identity
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{item.reviewed_by || user?.name || 'Doctor'}</p>
                      <p className="text-sm text-slate-500">{item.doctor_clinic || user?.clinic || 'Heal Together Clinic'}</p>
                      <p className="text-sm text-slate-500">{item.doctor_department || user?.department || 'Community Review Desk'}</p>
                      <p className="text-sm text-slate-500">Reg no.: {item.doctor_reg_no || user?.reg_no || 'REG-HT-001'}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {(item.tags || []).map((tag) => (
                        <span key={tag} className="tag-chip">{tag}</span>
                      ))}
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Doctor Comment
                      </label>
                      <textarea
                        rows="3"
                        className="input-field w-full px-4 py-3 rounded-xl bg-white text-slate-800 placeholder:text-slate-400"
                        placeholder={item.doctor_note || 'Write approval or rejection comment...'}
                        value={doctorComments[item.queue_id] ?? ''}
                        onChange={(event) =>
                          setDoctorComments((current) => ({
                            ...current,
                            [item.queue_id]: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="mt-5 flex gap-3">
                      <button type="button" className="approve-btn" onClick={() => updateStatus(item.queue_id, item.remedy_name, 'approved')}>
                        Approve
                      </button>
                      <button type="button" className="reject-btn" onClick={() => updateStatus(item.queue_id, item.remedy_name, 'rejected')}>
                        Reject
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state-card">No pending remedy submissions.</div>
              )}
            </div>
          </section>

          <section className="main-card rounded-[2rem] p-6">
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Patient History</p>
              <p className="mt-2 text-sm text-slate-500">Submitted details are shown here for doctor review.</p>
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="empty-state-card">Loading patient history...</div>
              ) : patientHistory.length ? (
                patientHistory.map((patient) => (
                  <article
                    key={patient.id}
                    className={`patient-history-card patient-history-selectable ${selectedPatient?.id === patient.id ? 'active' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <button
                          type="button"
                          className="patient-name-button"
                          onClick={() => setSelectedPatientId(patient.id)}
                        >
                          {patient.name || 'Patient'}
                        </button>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mt-1">
                          {patient.created_at ? new Date(patient.created_at).toLocaleString() : 'No timestamp'}
                        </p>
                      </div>
                      <span className="tag-blue">Age {patient.age || 'N/A'}</span>
                    </div>

                    <div className="space-y-2 text-sm text-slate-600">
                      <p><strong className="text-slate-700">DOB:</strong> {patient.dob || 'Not provided'}</p>
                      <p><strong className="text-slate-700">Symptoms:</strong> {(patient.diseases || []).map(formatSymptomLabel).join(', ') || 'Not provided'}</p>
                      <p><strong className="text-slate-700">Duration:</strong> {patient.duration || 'Not provided'}</p>
                      <p><strong className="text-slate-700">Notes:</strong> {patient.notes || 'No extra notes'}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {Object.entries(patient.symptomSeverity || {}).length ? (
                        Object.entries(patient.symptomSeverity).map(([symptom, severity]) => (
                          <span key={symptom} className="severity-chip">
                            {formatSymptomLabel(symptom)}: {String(severity)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">No severity records</span>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state-card">No patient history yet.</div>
              )}
            </div>

            {selectedPatient ? (
              <div className="patient-detail-panel mt-6">
                <div className="mb-4">
                  <p className="review-pill">Selected Patient History</p>
                  <h3 className="text-2xl font-bold text-slate-800 mt-2">{selectedPatient.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Entire history, doctor actions, and shared review chats.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="summary-chip">
                    <span>Recent Symptoms</span>
                    <strong>
                      {(selectedPatient.diseases || []).map(formatSymptomLabel).join(', ') || 'Not provided'}
                    </strong>
                  </div>
                  <div className="summary-chip">
                    <span>Recent Duration</span>
                    <strong>{selectedPatient.duration || 'Not provided'}</strong>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {selectedPatientTimeline.length ? (
                    selectedPatientTimeline.map((entry) => (
                      <article key={entry.review_id} className="timeline-card">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {entry.type === 'doctor'
                                ? `${entry.reviewed_by || 'Doctor'} updated ${entry.remedy_name}`
                                : `${entry.patient_name || selectedPatient.name} shared review`}
                            </p>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mt-1">
                              {entry.created_at
                                ? new Date(entry.created_at).toLocaleString()
                                : 'No timestamp'}
                            </p>
                          </div>
                          <span className={entry.type === 'doctor' ? 'doctor-review-badge' : 'patient-review-badge'}>
                            {entry.type === 'doctor' ? entry.doctor_status : `${entry.rating || 0}/5`}
                          </span>
                        </div>

                        <p className="text-sm text-slate-600 leading-6 mt-3">
                          {entry.type === 'doctor'
                            ? `${entry.doctor_note || 'No doctor note.'} • ${entry.doctor_department || 'Community Review Desk'} • Reg no.: ${entry.doctor_reg_no || 'REG-HT-001'}`
                            : entry.comment || 'No patient comment.'}
                        </p>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state-card">No detailed chats or review history yet for this patient.</div>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <section className="main-card rounded-[2rem] p-6 mt-6">
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Shared Review Approval</p>
            <p className="mt-2 text-sm text-slate-500">
              Approve or reject patient-shared reviews and add doctor suggestions for the remedy page.
            </p>
          </div>

          <div className="space-y-4">
            {pendingSharedReviews.length ? (
              pendingSharedReviews.map((review) => (
                <article key={review.review_id} className="doctor-remedy-card">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                        {review.remedy_name}
                      </p>
                      <h3 className="text-lg font-bold text-slate-800 mt-1">{review.patient_name}</h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Rating {review.rating || 0}/5
                      </p>
                    </div>
                    <span className={`status-pill ${review.review_status === 'approved' ? 'approved' : review.review_status === 'rejected' ? 'rejected' : 'pending'}`}>
                      {review.review_status || 'pending'}
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 leading-6">{review.comment || 'No review comment provided.'}</p>

                  <div className="mt-4 doctor-meta-card">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      Doctor Suggestion For Review
                    </p>
                    <textarea
                      rows="3"
                      className="input-field w-full px-4 py-3 rounded-xl bg-white text-slate-800 placeholder:text-slate-400 mt-3"
                      placeholder={review.doctor_suggestion || 'Add a suggestion or moderation note for this review...'}
                      value={reviewModerationNotes[review.review_id] ?? ''}
                      onChange={(event) =>
                        setReviewModerationNotes((current) => ({
                          ...current,
                          [review.review_id]: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      className="approve-btn"
                      onClick={() => updateSharedReview(review.review_id, 'approved')}
                    >
                      Approve Review
                    </button>
                    <button
                      type="button"
                      className="reject-btn"
                      onClick={() => updateSharedReview(review.review_id, 'rejected')}
                    >
                      Reject Review
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state-card">No pending shared patient reviews.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function SecureFooter() {
  return (
    <div className="mt-8 flex items-center justify-center space-x-2 text-slate-400 text-xs">
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      <span>Verified Secure Healthcare Check</span>
    </div>
  )
}

function BrandMark() {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
      <path d="M70 15C60 15 50 20 45 30C40 40 42 60 55 75L40 100M70 15C80 15 90 20 95 30C100 40 98 60 85 75L100 100" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M60 25C55 25 52 30 52 35" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M58 35C53 35 50 40 50 45" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M58 45C53 45 50 50 50 55" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M60 55C55 55 52 60 52 65" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M80 25C85 25 88 30 88 35" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M82 35C87 35 90 40 90 45" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M82 45C87 45 90 50 90 55" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M80 55C85 55 88 60 88 65" stroke="#78350f" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M10 50L45 80L35 110L5 95Z" fill="none" stroke="#78350f" strokeWidth="2.5"/>
      <path d="M130 50L95 80L105 110L135 95Z" fill="none" stroke="#78350f" strokeWidth="2.5"/>
      <circle cx="115" cy="90" r="4" fill="#78350f"/>
    </svg>
  )
}

function formatSymptomLabel(symptom) {
  return String(symptom || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default App
