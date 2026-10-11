import type { ReactNode } from 'react'
import type { TabType } from '../App'
import {
  ArogyaLogoIcon,
  OverviewIcon,
  BatchesIcon,
  ProductsIcon,
  CustomersIcon,
  SuppliersIcon,
  OrdersIcon,
  DispatchesIcon,
  RecallsIcon,
  TraceabilityIcon,
  ColdChainIcon,
  ReturnsIcon,
  ShortagesIcon,
  SimulatorIcon,
  AgentIcon,
  ApprovalsIcon,
  AuditIcon,
  SettingsIcon,
  HelpIcon,
  CloseIcon,
} from './Icons'

interface SidebarProps {
  activeTab: TabType
  onSelectTab: (tab: TabType) => void
  onOpenOfflineModelModal: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

interface NavItem {
  tab: TabType
  label: string
  icon: ReactNode
}

interface NavGroup {
  heading: string
  items: NavItem[]
}

export function Sidebar({
  activeTab,
  onSelectTab,
  onOpenOfflineModelModal,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navGroups: NavGroup[] = [
    {
      heading: 'OPERATIONS',
      items: [
        { tab: 'dashboard', label: 'Overview', icon: <OverviewIcon size={18} /> },
        { tab: 'inventory', label: 'Batches', icon: <BatchesIcon size={18} /> },
        { tab: 'products', label: 'Products', icon: <ProductsIcon size={18} /> },
        { tab: 'customers', label: 'Customers', icon: <CustomersIcon size={18} /> },
        { tab: 'suppliers', label: 'Suppliers', icon: <SuppliersIcon size={18} /> },
        { tab: 'purchase_orders', label: 'Purchase Orders', icon: <OrdersIcon size={18} /> },
        { tab: 'dispatches', label: 'Dispatches', icon: <DispatchesIcon size={18} /> },
      ],
    },
    {
      heading: 'COMPLIANCE & SAFETY',
      items: [
        { tab: 'recalls', label: 'Recall Mgmt', icon: <RecallsIcon size={18} /> },
        { tab: 'traceability', label: 'Traceability', icon: <TraceabilityIcon size={18} /> },
        { tab: 'cold_chain', label: 'Cold-Chain Logs', icon: <ColdChainIcon size={18} /> },
        { tab: 'returns', label: 'Expiry & Returns', icon: <ReturnsIcon size={18} /> },
        { tab: 'shortage', label: 'Shortage Planning', icon: <ShortagesIcon size={18} /> },
      ],
    },
    {
      heading: 'INTELLIGENCE & AUDIT',
      items: [
        { tab: 'simulator', label: 'What-If Simulator', icon: <SimulatorIcon size={18} /> },
        { tab: 'agent', label: 'AI Agent Desk', icon: <AgentIcon size={18} /> },
        { tab: 'approvals', label: 'QP Approvals', icon: <ApprovalsIcon size={18} /> },
        { tab: 'audit', label: 'Audit Trail', icon: <AuditIcon size={18} /> },
        { tab: 'settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
      ],
    },
  ]

  const handleItemClick = (tab: TabType) => {
    onSelectTab(tab)
    onCloseMobile()
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Main Navigation">
        {/* Brand Header */}
        <div className="sidebar-brand-header">
          <div
            className="sidebar-brand-link"
            onClick={() => handleItemClick('dashboard')}
            role="button"
            tabIndex={0}
            title="Arogya AI Operations Dashboard"
            aria-label="Arogya AI Home"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleItemClick('dashboard')
              }
            }}
          >
            <ArogyaLogoIcon size={32} />
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-title">Arogya AI</span>
              <span className="sidebar-brand-subtitle">Pharma Operations</span>
            </div>
          </div>

          {/* Mobile close button */}
          <button
            className="sidebar-mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Navigation Items grouped by functional area */}
        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.heading} className="sidebar-group">
              <div className="sidebar-group-heading">{group.heading}</div>
              {group.items.map((item) => {
                const isActive = activeTab === item.tab
                return (
                  <button
                    key={item.tab}
                    className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handleItemClick(item.tab)}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="sidebar-nav-icon">{item.icon}</span>
                    <span className="sidebar-nav-label">{item.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Help / Offline Model Button */}
        <div className="sidebar-footer">
          <button
            className="sidebar-footer-btn"
            onClick={onOpenOfflineModelModal}
            title="Offline Model Status & Ollama Setup"
            aria-label="Offline Model Status & Ollama Setup"
          >
            <span className="sidebar-footer-icon"><HelpIcon size={18} /></span>
            <div className="sidebar-footer-text">
              <span className="sidebar-footer-title">Offline AI Model</span>
              <span className="sidebar-footer-subtitle">Check Ollama status</span>
            </div>
          </button>
        </div>
      </aside>
    </>
  )
}

