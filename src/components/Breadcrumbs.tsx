import { motion } from 'framer-motion'

interface Crumb {
  id: number
  name: string
  node: any
}

interface BreadcrumbsProps {
  crumbs: Crumb[]
  onCrumbClick: (node: any) => void
}

export default function Breadcrumbs({ crumbs, onCrumbClick }: BreadcrumbsProps) {
  return (
    <nav className="breadcrumbs" aria-label="Taxonomy path">
      {crumbs.map((crumb, index) => (
        <motion.div
          key={crumb.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.03, duration: 0.2 }}
          style={{ display: 'contents' }}
        >
          {index > 0 && <span className="crumb-separator">›</span>}
          <button
            className="crumb"
            onClick={() => onCrumbClick(crumb.node)}
            title={`Navigate to ${crumb.name}`}
          >
            {crumb.name}
          </button>
        </motion.div>
      ))}
    </nav>
  )
}

