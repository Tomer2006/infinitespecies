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
      <div className="topbar-brand" onClick={onBackToMenu} title="Return to main menu" style={{ cursor: 'pointer' }}>
        <span className="topbar-brand-icon">🧬</span>
        <span>infinitespecies</span>
      </div>

      <div className="topbar-controls">
        <div className="searchbar" ref={searchRef}>
          <svg className="searchbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
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
          <div className="searchbar-actions">
            <button className="btn" onClick={handleSearch}>
              Search
            </button>
          </div>

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

        <button className="btn" onClick={onCopyLink} title="Copy deep link">
          Share
        </button>
      </div>
    </header>
  )
}

