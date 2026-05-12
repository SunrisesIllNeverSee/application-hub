import { ProfileTab } from '@/components/ProfileTab'

const TABS = [
  { label: 'About', href: '/profile/about' },
  { label: 'Persona', href: '/profile/persona' },
  { label: 'Integrations', href: '/profile/integrations' },
  { label: 'Import', href: '/profile/import' },
  { label: 'Settings', href: '/profile/settings' },
  { label: 'Days', href: '/profile/credits' },
]

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Profile</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Your founder profile and answer library
        </p>
      </div>

      <nav className="flex gap-1 mb-8 border-b border-neutral-200 dark:border-neutral-800">
        {TABS.map((tab) => (
          <ProfileTab key={tab.href} href={tab.href} label={tab.label} />
        ))}
      </nav>

      {children}
    </div>
  )
}
