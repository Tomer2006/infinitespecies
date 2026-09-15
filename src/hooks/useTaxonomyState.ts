import { useSyncExternalStore } from 'react'
import { getTaxonomySnapshot, subscribeTaxonomyState } from '../modules/state'

/** React adapter for the framework-independent taxonomy engine store. */
export function useTaxonomyState() {
  return useSyncExternalStore(subscribeTaxonomyState, getTaxonomySnapshot, getTaxonomySnapshot)
}

/** Subscribe only to navigation, without re-rendering the app on hover. */
export function useCurrentNode() {
  return useSyncExternalStore(subscribeTaxonomyState, () => getTaxonomySnapshot().current, () => null)
}
