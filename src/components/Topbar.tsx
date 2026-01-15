import { useState, useRef, useEffect } from 'react'
import { processSearchResults } from '../modules/search'
import { performSearch, handleSingleSearchResult, handleSearchResultClick } from '../modules/search-handler'

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

/**
 * Highlight matching text in a string (returns JSX elements)
 */
function highlightMatchJSX(text: string, query: string): (string | JSX.Element)[] {
  if (!query) return [text]
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()
  const index = textLower.indexOf(queryLower)
  
  if (index === -1) {
    // Try fuzzy highlighting - find characters in order
    const parts: (string | JSX.Element)[] = []
    let lastIdx = 0
    let queryIdx = 0
    
    for (let i = 0; i < text.length && queryIdx < query.length; i++) {
      if (textLower[i] === queryLower[queryIdx]) {
        if (i > lastIdx) {
          parts.push(text.slice(lastIdx, i))
        }
        parts.push(<mark key={`${i}-${queryIdx}`}>{text[i]}</mark>)
        lastIdx = i + 1
        queryIdx++
      }
    }
    
    if (queryIdx === query.length && lastIdx < text.length) {
      parts.push(text.slice(lastIdx))
    }
    
    return queryIdx === query.length ? parts : [text]
  }
  
  // Direct match - highlight the substring
  const before = text.slice(0, index)
  const match = text.slice(index, index + query.length)
  const after = text.slice(index + query.length)
  return [
    before,
    <mark key="match">{match}</mark>,
    after
  ]
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    // Use vanilla JS function for all search logic
    const result = await performSearch(searchQuery, onShowToast)
    
    if (!result.hasResults) {
      setSearchResults([])
      setShowResults(false)
      onShowToast('No results found', 'warning')
      return
    }

    if (result.singleResult) {
      // Single result - navigate to it
      handleSingleSearchResult(result.matches[0], onUpdateBreadcrumbs)
      setShowResults(false)
      setSearchQuery('')
    } else {
      // Multiple results - show list
      const results: SearchResult[] = processSearchResults(result.matches, searchQuery)
      setSearchResults(results)
      setShowResults(true)
    }
  }

  const handleResultClick = (result: SearchResult) => {
    // Use vanilla JS function - handles zoom and pulse
    handleSearchResultClick(result.node)
    
    // Just update UI state
    setShowResults(false)
    setSearchQuery('')
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-brand" onClick={onBackToMenu} title="Return to main menu" style={{ cursor: 'pointer' }}>
          <span>InfiniteSpecies</span>
        </div>
      </div>

      <div className="topbar-center">
        <div className="searchbar" ref={searchRef}>
          <input
            ref={searchInputRef}
            className="searchbar-input"
            type="search"
            placeholder="Search organism or group (use scientific names)"
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
                  <div className="search-result-name">
                    {highlightMatchJSX(result.name, searchQuery)}
                  </div>
                  {result.path && (
                    <div className="search-result-path">
                      {highlightMatchJSX(result.path, searchQuery)}
                    </div>
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

