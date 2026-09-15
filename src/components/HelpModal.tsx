import { motion } from 'framer-motion'
import { translate, type AppLanguage } from '../modules/i18n'
import { useModalFocus } from '../hooks/useModalFocus'
import { discoveryCopy } from '../modules/discovery-copy'

interface HelpModalProps {
  language: AppLanguage
  onClose: () => void
}

export default function HelpModal({ language, onClose }: HelpModalProps) {
  const initialFocusRef = useModalFocus(true)
  const copy = discoveryCopy(language)
  const controls = [
    { key: translate('help.leftClickKey', undefined, language), description: translate('help.leftClickDescription', undefined, language) },
    { key: translate('help.rightClickKey', undefined, language), description: translate('help.rightClickDescription', undefined, language) },
    { key: translate('help.mouseWheelKey', undefined, language), description: translate('help.mouseWheelDescription', undefined, language) },
    { key: translate('help.middleDragKey', undefined, language), description: translate('help.middleDragDescription', undefined, language) },
    { key: translate('help.hoverKey', undefined, language), description: translate('help.hoverDescription', undefined, language) },
    { key: translate('help.enterKey', undefined, language), description: translate('help.enterDescription', undefined, language) },
    { key: translate('help.searchKey', undefined, language), description: translate('help.searchDescription', undefined, language) },
    { key: translate('help.resetKey', undefined, language), description: translate('help.resetDescription', undefined, language) },
    { key: translate('help.fitKey', undefined, language), description: translate('help.fitDescription', undefined, language) },
    { key: translate('help.toggleKey', undefined, language), description: translate('help.toggleDescription', undefined, language) },
    { key: translate('help.tapKey', undefined, language), description: translate('help.tapDescription', undefined, language) },
    { key: translate('help.pinchKey', undefined, language), description: translate('help.pinchDescription', undefined, language) },
    { key: translate('help.dragKey', undefined, language), description: translate('help.dragDescription', undefined, language) },
  ]

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-dialog-title"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="help-dialog-title">{copy.helpTitle}</h2>
          <button ref={initialFocusRef} className="modal-close" type="button" onClick={onClose} aria-label={translate('common.close', undefined, language)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <ol className="simple-help" dir={language === 'he' ? 'rtl' : 'ltr'}>
            {[[copy.stepChoose, copy.stepChooseBody], [copy.stepExplore, copy.stepExploreBody], [copy.stepReturn, copy.stepReturnBody]].map(([title, body]) => <li key={title}><strong>{title}</strong><p>{body}</p></li>)}
          </ol>
          <details className="help-shortcuts"><summary>{copy.shortcuts}</summary><div className="help-grid">
            {controls.map((control) => (
              <div key={control.key} className="help-item">
                <span className="help-key">{control.key}</span>
                <span className="help-description">{control.description}</span>
              </div>
            ))}
          </div></details>
        </div>
      </motion.div>
    </motion.div>
  )
}
