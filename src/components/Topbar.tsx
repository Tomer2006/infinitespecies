import { useState, useRef, useEffect } from 'react'
import { findAllByQuery, pulseAtNode } from '../modules/search'
import { updateNavigation } from '../modules/navigation'
import { getNodePath } from '../modules/deeplink'
import { perf } from '../modules/settings'

// Type for taxonomy nodes from the state module
interface TaxonomyNode {
  _id: number
  name: string
  level: number
  children?: TaxonomyNode[]
  parent?: TaxonomyNode | null
  _leaves?: number
  _vx?: number
  _vy?: number
  _vr?: number
}

interface TopbarProps {
  onBackToMenu: () => void
  onCopyLink: () => void
  onSettings: () => void
  onUpdateBreadcrumbs: (node: TaxonomyNode) => void
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error', duration?: number) => string
}

interface SearchResult {
  _id: number
  name: string
  path: string
  node: any
}

export default function Topbar({
  onBackToMenu,
  onCopyLink,
  onSettings,
  onUpdateBreadcrumbs,
  onShowToast,
}: TopbarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleClear = () => {
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)
  }

  // Handle Escape key to clear search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Escape if search input is focused or search results are shown
      const isSearchFocused = document.activeElement === searchInputRef.current
      if ((e.key === 'Escape' || e.code === 'Escape') && (isSearchFocused || showResults)) {
        e.preventDefault()
        handleClear()
        // Blur the input to remove focus
        searchInputRef.current?.blur()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showResults])

  const handleSearch = () => {
    if (!searchQuery.trim()) return

    // Show searching toast
    onShowToast('Searching...', 'info', 1000)

    const matches = findAllByQuery(searchQuery, perf.search.maxResults)
    
    if (matches.length === 0) {
      setSearchResults([])
      setShowResults(false)
      onShowToast('No results found', 'warning')
      return
    }

    if (matches.length === 1) {
      const node = matches[0]
      updateNavigation(node, false)
      pulseAtNode(node)
      onUpdateBreadcrumbs(node)
      setShowResults(false)
      setSearchQuery('')
    } else {
      const results: SearchResult[] = matches.map((node: any) => {
        let path = ''
        try {
          const parts = getNodePath(node)
          path = parts.slice(0, -1).join(' / ')
        } catch {}
        return {
          _id: node._id,
          name: node.name,
          path,
          node,
        }
      })
      setSearchResults(results)
      setShowResults(true)
    }
  }

  const handleResultClick = (result: SearchResult) => {
    updateNavigation(result.node, false)
    pulseAtNode(result.node)
    onUpdateBreadcrumbs(result.node)
    setShowResults(false)
    setSearchQuery('')
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-brand" onClick={onBackToMenu} title="Return to main menu" style={{ cursor: 'pointer' }}>
          <span className="topbar-brand-icon">🧬</span>
          <span>infinitespecies</span>
        </div>
      </div>

      <div className="topbar-center">
        <div className="searchbar" ref={searchRef}>
          <input
            ref={searchInputRef}
            className="searchbar-input"
            type="search"
            placeholder="Search organism or group…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch()
              } else if (e.key === 'Escape') {
                handleClear()
                searchInputRef.current?.blur()
              }
            }}
          />
          <button className="searchbar-btn" onClick={handleSearch} title="Search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>

          {showResults && searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((result) => (
                <div
                  key={result._id}
                  className="search-result-item"
                  onClick={() => handleResultClick(result)}
                >
                  <div className="search-result-name">{result.name}</div>
                  {result.path && (
                    <div className="search-result-path">{result.path}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="topbar-right">
        <button className="btn btn-icon" onClick={onCopyLink} title="Copy deep link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
        <button className="btn btn-icon" onClick={onSettings} title="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </header>
  )
}

