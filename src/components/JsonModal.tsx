import { useState, useRef } from 'react'
import { motion } from 'framer-motion'

interface JsonModalProps {
  onClose: () => void
  onLoad: (json: string) => Promise<void>
}

const sampleJson = {
  name: 'Life',
  children: [
    {
      name: 'Eukarya',
      children: [
        {
          name: 'Animalia',
          children: [
            {
              name: 'Chordata',
              children: [
                {
                  name: 'Mammalia',
                  children: [
                    {
                      name: 'Primates',
                      children: [
                        {
                          name: 'Hominidae',
                          children: [
                            {
                              name: 'Homo',
                              children: [{ name: 'Homo sapiens' }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

export default function JsonModal({ onClose, onLoad }: JsonModalProps) {
  const [jsonText, setJsonText] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onerror = () => setError('Failed to read file.')
    reader.onload = (ev) => {
      setJsonText(ev.target?.result as string || '')
    }
    reader.readAsText(file)
  }

  const handleInsertSample = () => {
    setJsonText(JSON.stringify(sampleJson, null, 2))
    setError('')
  }

  const handleApply = async () => {
    if (!jsonText.trim()) {
      setError('Please paste JSON or choose a file.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await onLoad(jsonText)
    } catch (err: any) {
      setError(err.message || String(err))
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      className="modal-backdrop json-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        style={{ width: 'min(900px, 95vw)' }}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Load Custom Taxonomy JSON</h2>
          <div className="modal-header-actions">
            <button className="btn btn-ghost" onClick={handleInsertSample}>
              Insert Sample
            </button>
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleApply}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Parse & Load'}
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1rem' }}>
          <div>
            <div className="file-input-wrapper">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
              />
              {error && <span className="error-text">{error}</span>}
            </div>
            <textarea
              className="json-textarea"
              placeholder="Paste your JSON here..."
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
            />
          </div>

          <div className="modal-section">
            <h4>Supported Schemas</h4>
            <p>
              1) Array/object with children:{' '}
              <code>{'{ name, level?, children:[...] }'}</code>. Level inferred if
              missing.
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              2) Nested key map:{' '}
              <code>{'{ "Life": { "Bacteria": { ... } } }'}</code>. Auto-transformed.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

